import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WeeklyAttendanceReportService } from './weekly-attendance-report.service.js';

const employees = [
  {
    id: 'emp-1',
    employeeCode: 'EXP-1',
    firstName: 'Asha',
    lastName: 'Rao',
    user: { email: 'asha@1solutions.biz' },
  },
  {
    id: 'emp-2',
    employeeCode: 'EXP-2',
    firstName: 'Bala',
    lastName: 'Iyer',
    user: { email: 'bala@1solutions.biz' },
  },
];

// A plausible Mon-Fri history: present with 8h on Mon/Tue/Thu, late on Wed,
// absent on Fri - exercises every field the report reads.
const sampleHistory = [
  { date: '2026-09-07', status: 'PRESENT', firstCheckInAt: new Date('2026-09-07T03:30:00Z'), lastCheckOutAt: new Date('2026-09-07T12:00:00Z'), workedMinutes: 480, lateMinutes: 0 },
  { date: '2026-09-08', status: 'PRESENT', firstCheckInAt: new Date('2026-09-08T03:30:00Z'), lastCheckOutAt: new Date('2026-09-08T12:00:00Z'), workedMinutes: 480, lateMinutes: 0 },
  { date: '2026-09-09', status: 'LATE', firstCheckInAt: new Date('2026-09-09T04:15:00Z'), lastCheckOutAt: new Date('2026-09-09T12:00:00Z'), workedMinutes: 405, lateMinutes: 45 },
  { date: '2026-09-10', status: 'PRESENT', firstCheckInAt: new Date('2026-09-10T03:30:00Z'), lastCheckOutAt: new Date('2026-09-10T12:00:00Z'), workedMinutes: 480, lateMinutes: 0 },
  { date: '2026-09-11', status: 'ABSENT', firstCheckInAt: null, lastCheckOutAt: null, workedMinutes: null, lateMinutes: 0 },
];

function buildPrismaMock() {
  return { employee: { findMany: vi.fn().mockResolvedValue(employees) } };
}

describe('WeeklyAttendanceReportService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let attendanceService: { getHistoryForEmployeeId: ReturnType<typeof vi.fn> };
  let mailService: {
    sendWeeklyAttendanceReport: ReturnType<typeof vi.fn>;
    sendAdminWeeklyAttendanceReport: ReturnType<typeof vi.fn>;
  };
  let service: WeeklyAttendanceReportService;

  beforeEach(() => {
    // A Saturday, so lastCompletedWeekRange resolves to Mon 2026-09-07 - Fri
    // 2026-09-11 - matches sampleHistory above.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-12T02:30:00Z'));

    prisma = buildPrismaMock();
    attendanceService = { getHistoryForEmployeeId: vi.fn().mockResolvedValue(sampleHistory) };
    mailService = {
      sendWeeklyAttendanceReport: vi.fn().mockResolvedValue(undefined),
      sendAdminWeeklyAttendanceReport: vi.fn().mockResolvedValue(undefined),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new WeeklyAttendanceReportService(prisma as any, attendanceService as any, mailService as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('queries only active employees and asks attendance history for last Mon-Fri', async () => {
    await service.sendWeeklyReports();

    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'ACTIVE' } }),
    );
    expect(attendanceService.getHistoryForEmployeeId).toHaveBeenCalledWith('emp-1', {
      from: '2026-09-07',
      to: '2026-09-11',
    });
  });

  it('emails each active employee their own weekly summary with correct totals', async () => {
    await service.sendWeeklyReports();

    expect(mailService.sendWeeklyAttendanceReport).toHaveBeenCalledTimes(2);
    const [to, payload] = mailService.sendWeeklyAttendanceReport.mock.calls[0];
    expect(to).toBe('asha@1solutions.biz');
    expect(payload.employeeName).toBe('Asha Rao');
    expect(payload.rows).toHaveLength(5);
    expect(payload.totals).toEqual({
      present: 3,
      late: 1,
      absent: 1,
      onLeave: 0,
      totalHours: '30.8', // (480+480+405+480+0) / 60 = 30.75
    });
  });

  it('sends HR exactly one email covering every active employee, as a CSV attachment', async () => {
    await service.sendWeeklyReports();

    expect(mailService.sendAdminWeeklyAttendanceReport).toHaveBeenCalledTimes(1);
    const [to, payload] = mailService.sendAdminWeeklyAttendanceReport.mock.calls[0];
    expect(to).toBe('hr@1solutions.biz');
    expect(payload.employeeCount).toBe(2);

    const csv = Buffer.from(payload.csvBase64, 'base64').toString('utf-8');
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(3); // header + 2 employees
    expect(lines[0]).toBe('Employee code,Name,Monday,Tuesday,Wednesday,Thursday,Friday,Present,Late,Absent,On leave,Total hours');
    expect(lines[1]).toContain('EXP-1,Asha Rao');
    expect(lines[1]).toContain('Absent'); // Friday, no "(Nh)" suffix for a day with no worked minutes
  });

  it('quotes a CSV cell that itself contains a comma', async () => {
    prisma.employee.findMany.mockResolvedValue([
      { id: 'emp-3', employeeCode: 'EXP-3', firstName: 'Cee, Jr.', lastName: 'Deo', user: { email: 'cee@1solutions.biz' } },
    ]);

    await service.sendWeeklyReports();

    const [, payload] = mailService.sendAdminWeeklyAttendanceReport.mock.calls[0];
    const csv = Buffer.from(payload.csvBase64, 'base64').toString('utf-8');
    expect(csv).toContain('"Cee, Jr. Deo"');
  });
});
