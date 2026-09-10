import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { AttendanceService } from '../attendance/attendance.service.js';
import {
  MailService,
  type WeeklyAttendanceDayRow,
  type WeeklyAttendanceTotals,
} from '../mail/mail.service.js';
import { addDays, formatDateOnly, toDateOnly } from '../common/date-only.js';
import type { AttendanceDayStatus } from '../generated/prisma/enums.js';

const STATUS_LABELS: Record<AttendanceDayStatus, string> = {
  PRESENT: 'Present',
  LATE: 'Late',
  HALF_DAY: 'Half day',
  ABSENT: 'Absent',
  ON_LEAVE: 'On leave',
  HOLIDAY: 'Holiday',
  WEEKEND: 'Weekend',
};

const ISO_WEEKDAY_LABELS = [
  '',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

// hr@1solutions.biz is also the sending mailbox (MailService's MS_SENDER_EMAIL
// default) - the admin report is effectively self-addressed, which is fine,
// it's a shared HR mailbox rather than a personal inbox.
const ADMIN_REPORT_RECIPIENT = 'hr@1solutions.biz';

interface EmployeeWeekRow {
  employeeCode: string;
  name: string;
  email: string;
  days: WeeklyAttendanceDayRow[];
  totals: WeeklyAttendanceTotals;
}

/**
 * Every Saturday morning: each active employee gets their own Mon-Fri
 * attendance summary, and HR gets one email covering every active employee
 * in a single CSV attachment. Both come from the same underlying per-employee
 * query (AttendanceService.getHistoryForEmployeeId), run once per employee,
 * not fetched twice.
 */
@Injectable()
export class WeeklyAttendanceReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
    private readonly mailService: MailService,
  ) {}

  @Cron('0 8 * * 6', { timeZone: 'Asia/Kolkata' })
  async sendWeeklyReports(): Promise<void> {
    const { label, weekRows } = await this.computeWeekRows();

    for (const row of weekRows) {
      await this.mailService.sendWeeklyAttendanceReport(row.email, {
        employeeName: row.name,
        weekLabel: label,
        rows: row.days,
        totals: row.totals,
      });
    }

    await this.sendAdminReport(weekRows, label);
  }

  /**
   * Manually triggered from an admin action (see ReportsController) - sends
   * exactly the same content the real Saturday run would, just to `to`
   * instead of every employee and HR, so it's safe to fire on demand. The
   * "individual" copy uses the caller's own row when they have one (an
   * admin is usually also an employee), so what lands in their inbox is
   * real data about them, not an arbitrary stand-in.
   */
  async sendTestReports(callerEmail: string, to: string): Promise<void> {
    const { label, weekRows } = await this.computeWeekRows();

    const sample = weekRows.find((r) => r.email === callerEmail) ?? weekRows[0];
    if (sample) {
      await this.mailService.sendWeeklyAttendanceReport(to, {
        employeeName: sample.name,
        weekLabel: label,
        rows: sample.days,
        totals: sample.totals,
      });
    }

    await this.sendAdminReport(weekRows, label, to);
  }

  private async computeWeekRows(): Promise<{ label: string; weekRows: EmployeeWeekRow[] }> {
    const { from, to, label } = this.mostRecentCompletedWeek();

    const employees = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        user: { select: { email: true } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    const weekRows: EmployeeWeekRow[] = [];

    for (const employee of employees) {
      const history = await this.attendanceService.getHistoryForEmployeeId(employee.id, {
        from: formatDateOnly(from),
        to: formatDateOnly(to),
      });

      const days: WeeklyAttendanceDayRow[] = history.map((day) => {
        const date = new Date(`${day.date}T00:00:00Z`);
        return {
          dayLabel: ISO_WEEKDAY_LABELS[date.getUTCDay() === 0 ? 7 : date.getUTCDay()],
          date: this.formatDisplayDate(date),
          status: STATUS_LABELS[day.status],
          checkIn: this.formatTime(day.firstCheckInAt),
          checkOut: this.formatTime(day.lastCheckOutAt),
          hours: day.workedMinutes != null ? (day.workedMinutes / 60).toFixed(1) : null,
        };
      });

      const totals: WeeklyAttendanceTotals = {
        present: history.filter((d) => d.status === 'PRESENT' || d.status === 'HALF_DAY').length,
        late: history.filter((d) => d.status === 'LATE').length,
        absent: history.filter((d) => d.status === 'ABSENT').length,
        onLeave: history.filter((d) => d.status === 'ON_LEAVE').length,
        totalHours: (history.reduce((sum, d) => sum + (d.workedMinutes ?? 0), 0) / 60).toFixed(1),
      };

      weekRows.push({
        employeeCode: employee.employeeCode,
        name: `${employee.firstName} ${employee.lastName}`,
        email: employee.user.email,
        days,
        totals,
      });
    }

    return { label, weekRows };
  }

  private async sendAdminReport(
    rows: EmployeeWeekRow[],
    weekLabel: string,
    recipient: string = ADMIN_REPORT_RECIPIENT,
  ): Promise<void> {
    const header = [
      'Employee code',
      'Name',
      ...(rows[0]?.days.map((d) => d.dayLabel) ?? []),
      'Present',
      'Late',
      'Absent',
      'On leave',
      'Total hours',
    ];
    const csvLines = [this.toCsvRow(header)];
    for (const row of rows) {
      csvLines.push(
        this.toCsvRow([
          row.employeeCode,
          row.name,
          ...row.days.map((d) => `${d.status}${d.hours ? ` (${d.hours}h)` : ''}`),
          String(row.totals.present),
          String(row.totals.late),
          String(row.totals.absent),
          String(row.totals.onLeave),
          row.totals.totalHours,
        ]),
      );
    }
    const csvBase64 = Buffer.from(csvLines.join(''), 'utf-8').toString('base64');

    await this.mailService.sendAdminWeeklyAttendanceReport(recipient, {
      weekLabel,
      employeeCount: rows.length,
      csvBase64,
      csvFilename: `weekly-attendance-${weekLabel.replace(/\s+/g, '-')}.csv`,
    });
  }

  /**
   * The most recent Mon-Fri that has fully finished as of right now - not
   * hardcoded to "the cron always runs on Saturday," since sendTestReports
   * can be triggered manually on any day of the week. If today is itself a
   * Friday, that week isn't finished yet, so this steps back a further 7
   * days rather than returning a Friday that hasn't happened yet.
   */
  private mostRecentCompletedWeek(): { from: Date; to: Date; label: string } {
    const today = toDateOnly(new Date());
    const isoWeekday = today.getUTCDay() === 0 ? 7 : today.getUTCDay();
    const daysSinceLastFriday = ((isoWeekday - 5 + 7) % 7) || 7;
    const to = addDays(today, -daysSinceLastFriday);
    const from = addDays(to, -4);
    return { from, to, label: `${this.formatDisplayDate(from)} – ${this.formatDisplayDate(to)}` };
  }

  private formatDisplayDate(date: Date): string {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  }

  private formatTime(date: Date | null): string | null {
    if (!date) return null;
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });
  }

  private toCsvRow(cells: string[]): string {
    return cells.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',') + '\r\n';
  }
}
