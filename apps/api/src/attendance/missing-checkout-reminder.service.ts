import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { toDateOnly } from '../common/date-only.js';

const REMINDER_TITLE = 'Forgot to check out?';
const REMINDER_DESCRIPTION = "You checked in today but haven't checked out yet.";

/**
 * Once a day, not a repeating tick like DailyReportRemindersService - a
 * forgotten checkout only needs one same-evening nudge, not reminders
 * every 15 minutes. 9 PM IST is a placeholder past typical office hours
 * (not read from CompanySettings - no such field exists, same "verbal
 * policy, not yet configurable" posture as leave.service.ts's monthly
 * Casual Leave cap).
 *
 * Deliberately does not touch anyone's ability to check in tomorrow or
 * finish checking out today after this fires - it's a nudge, not an
 * enforcement mechanism. The actual backstop for someone who misses it
 * entirely is HR/admin's "Missing checkout" filter on the Team Attendance
 * page plus the manual correction dialog there.
 */
@Injectable()
export class MissingCheckoutReminderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron('0 21 * * *', { timeZone: 'Asia/Kolkata' })
  async remindMissingCheckouts(): Promise<void> {
    const employeeIds = await this.findMissingCheckoutEmployeeIds();
    for (const employeeId of employeeIds) {
      await this.notificationsService.createForEmployee(employeeId, {
        type: 'ATTENDANCE',
        title: REMINDER_TITLE,
        description: REMINDER_DESCRIPTION,
        linkUrl: '/attendance',
      });
    }
  }

  /**
   * Sends one [TEST]-labelled preview to the caller only, describing what
   * the real run would do - mirrors DailyReportRemindersService.sendTest
   * and WeeklyAttendanceReportService.sendTestReports, so this can be
   * verified on demand without waiting for 9 PM or notifying real
   * employees.
   */
  async sendTest(actorUserId: string): Promise<{ missingCheckoutCount: number }> {
    const employeeIds = await this.findMissingCheckoutEmployeeIds();
    await this.notificationsService.create({
      userId: actorUserId,
      type: 'ATTENDANCE',
      title: `[TEST] ${REMINDER_TITLE}`,
      description: `Real content preview: "${REMINDER_DESCRIPTION}" Would go to ${employeeIds.length} employee(s) currently checked in with no checkout today.`,
      linkUrl: '/attendance',
    });
    return { missingCheckoutCount: employeeIds.length };
  }

  private async findMissingCheckoutEmployeeIds(): Promise<string[]> {
    const today = toDateOnly(new Date());
    const days = await this.prisma.attendanceDay.findMany({
      where: { date: today, firstCheckInAt: { not: null }, lastCheckOutAt: null },
      select: { employeeId: true },
    });
    return days.map((d) => d.employeeId);
  }
}
