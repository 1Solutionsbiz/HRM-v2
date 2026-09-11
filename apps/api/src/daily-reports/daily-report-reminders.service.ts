import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { toDateOnly } from '../common/date-only.js';

/**
 * Fires the pre-deadline reminder and the post-grace overdue notice
 * (employee + one digest per manager). Ticks every 15 minutes and no-ops
 * immediately if `dailyReportRequired` is off — decision #6: the policy
 * being disabled must mean zero notification traffic, not just zero
 * attendance consequences.
 *
 * Each notification is one-shot per day by construction: the tick window
 * (15 min) matches the check window, so "30 minutes before deadline" and
 * "just past grace" are each true for exactly one tick, not tracked via a
 * separate "already sent" flag. A missed tick (e.g. a redeploy at the
 * exact moment) means that day's reminder silently doesn't fire — an
 * accepted simplification for a reminder, not a compliance record.
 */
@Injectable()
export class DailyReportRemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron('*/15 * * * *', { timeZone: 'Asia/Kolkata' })
  async checkAndNotify(): Promise<void> {
    const context = await this.loadContext();
    if (!context) return;
    const { deadline, deadlineMinutes, graceEnd } = context;

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const reminderAt = deadlineMinutes - 30;

    const isReminderTick = nowMinutes >= reminderAt && nowMinutes < reminderAt + 15;
    const isOverdueTick = nowMinutes >= graceEnd && nowMinutes < graceEnd + 15;
    if (!isReminderTick && !isOverdueTick) return;

    const stillMissing = await this.computeStillMissing();
    if (stillMissing.length === 0) return;

    if (isReminderTick) {
      await this.notificationsService.createForUsers(
        stillMissing.map((e) => e.userId),
        {
          type: 'DAILY_REPORT',
          title: "Today's work report is due soon",
          description: `Submit your Daily Work Report before ${this.formatDeadline(deadline)}.`,
          linkUrl: '/daily-report',
        },
      );
    }

    if (isOverdueTick) {
      await this.notificationsService.createForUsers(
        stillMissing.map((e) => e.userId),
        {
          type: 'DAILY_REPORT',
          title: 'Daily Work Report overdue',
          description: "You haven't submitted today's Daily Work Report yet.",
          linkUrl: '/daily-report',
        },
      );

      const managerIds = [...new Set(stillMissing.map((e) => e.managerId).filter((id): id is string => !!id))];
      for (const managerId of managerIds) {
        const count = stillMissing.filter((e) => e.managerId === managerId).length;
        await this.notificationsService.createForEmployee(managerId, {
          type: 'DAILY_REPORT',
          title: "Team members missing today's report",
          description: `${count} of your team ${count === 1 ? 'has' : 'have'} not submitted today's Daily Work Report.`,
          linkUrl: '/team/daily-reports',
        });
      }
    }
  }

  /**
   * Manually fires both notification variants for the caller only, using
   * the real "who's still missing today" computation - proves the
   * settings/holiday/weekday gating, the query, and the notification
   * write path all work without waiting for a real tick or touching any
   * other employee's notifications. Mirrors
   * WeeklyAttendanceReportService.sendTestReports's "redirect real
   * content to one recipient" approach.
   */
  async sendTest(actorUserId: string): Promise<{
    policyActive: boolean;
    stillMissingCount: number;
    managerDigestCount: number;
  }> {
    const context = await this.loadContext();
    if (!context) {
      await this.notificationsService.create({
        userId: actorUserId,
        type: 'DAILY_REPORT',
        title: '[TEST] Daily Work Report reminders',
        description:
          "Reminders would not fire right now - either the policy is off, no deadline is configured, today isn't a working day, or today is a holiday.",
        linkUrl: '/admin/company',
      });
      return { policyActive: false, stillMissingCount: 0, managerDigestCount: 0 };
    }

    const { deadline } = context;
    const stillMissing = await this.computeStillMissing();
    const managerIds = [...new Set(stillMissing.map((e) => e.managerId).filter((id): id is string => !!id))];

    await this.notificationsService.create({
      userId: actorUserId,
      type: 'DAILY_REPORT',
      title: "[TEST] Today's work report is due soon",
      description: `Real content preview: "Submit your Daily Work Report before ${this.formatDeadline(deadline)}." Would go to ${stillMissing.length} employee(s) currently missing today's report.`,
      linkUrl: '/daily-report',
    });

    await this.notificationsService.create({
      userId: actorUserId,
      type: 'DAILY_REPORT',
      title: '[TEST] Daily Work Report overdue',
      description: `Real content preview: "You haven't submitted today's Daily Work Report yet." Would go to the same ${stillMissing.length} employee(s), plus a digest to ${managerIds.length} manager(s).`,
      linkUrl: '/team/daily-reports',
    });

    return { policyActive: true, stillMissingCount: stillMissing.length, managerDigestCount: managerIds.length };
  }

  private async loadContext(): Promise<{
    deadline: Date;
    deadlineMinutes: number;
    graceEnd: number;
  } | null> {
    const settings = await this.prisma.companySettings.findUnique({ where: { id: 'singleton' } });
    if (!settings?.dailyReportRequired || !settings.dailyReportDeadline) return null;

    const today = toDateOnly(new Date());
    const policy = await this.prisma.attendancePolicy.findUnique({ where: { id: 'singleton' } });
    if (!policy) return null;
    const workingWeekdays = new Set(policy.workingWeekdays as number[]);
    const isoWeekday = today.getUTCDay() === 0 ? 7 : today.getUTCDay();
    if (!workingWeekdays.has(isoWeekday)) return null;

    const holiday = await this.prisma.holiday.findFirst({ where: { date: today, isActive: true } });
    if (holiday) return null;

    const deadline = settings.dailyReportDeadline;
    const deadlineMinutes = deadline.getUTCHours() * 60 + deadline.getUTCMinutes();
    const graceEnd = deadlineMinutes + (settings.dailyReportGraceMinutes ?? 0);
    return { deadline, deadlineMinutes, graceEnd };
  }

  private async computeStillMissing() {
    const today = toDateOnly(new Date());
    const employees = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE', dailyReportExempt: false },
      select: {
        id: true,
        userId: true,
        managerId: true,
        dailyReports: { where: { date: today }, select: { id: true } },
      },
    });

    const onApprovedLeave = await this.prisma.leaveRequest.findMany({
      where: { status: 'APPROVED', startDate: { lte: today }, endDate: { gte: today } },
      select: { employeeId: true },
    });
    const onLeaveIds = new Set(onApprovedLeave.map((l) => l.employeeId));

    return employees.filter((e) => e.dailyReports.length === 0 && !onLeaveIds.has(e.id));
  }

  private formatDeadline(deadline: Date): string {
    const h = deadline.getUTCHours();
    const m = deadline.getUTCMinutes();
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  }
}
