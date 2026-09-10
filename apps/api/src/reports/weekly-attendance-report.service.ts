import { Injectable, Logger } from '@nestjs/common';
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
 *
 * The date math below (`lastCompletedWeekRange`) is coupled to this running
 * on a Saturday - "yesterday" is Friday, "yesterday minus 4" is Monday. If
 * this schedule ever moves off Saturday, that method needs to change with it.
 */
@Injectable()
export class WeeklyAttendanceReportService {
  private readonly logger = new Logger(WeeklyAttendanceReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
    private readonly mailService: MailService,
  ) {}

  @Cron('0 8 * * 6', { timeZone: 'Asia/Kolkata' })
  async sendWeeklyReports(): Promise<void> {
    const { from, to, label } = this.lastCompletedWeekRange();

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

      const employeeName = `${employee.firstName} ${employee.lastName}`;
      weekRows.push({ employeeCode: employee.employeeCode, name: employeeName, email: employee.user.email, days, totals });

      await this.mailService.sendWeeklyAttendanceReport(employee.user.email, {
        employeeName,
        weekLabel: label,
        rows: days,
        totals,
      });
    }

    await this.sendAdminReport(weekRows, label);
  }

  private async sendAdminReport(rows: EmployeeWeekRow[], weekLabel: string): Promise<void> {
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

    await this.mailService.sendAdminWeeklyAttendanceReport(ADMIN_REPORT_RECIPIENT, {
      weekLabel,
      employeeCount: rows.length,
      csvBase64,
      csvFilename: `weekly-attendance-${weekLabel.replace(/\s+/g, '-')}.csv`,
    });
  }

  private lastCompletedWeekRange(): { from: Date; to: Date; label: string } {
    const today = toDateOnly(new Date());
    const to = addDays(today, -1);
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
