import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DailyReportsService } from './daily-reports.service.js';
import type { AuthContext } from '../common/auth-context.js';

const EMPLOYEE_ID = 'emp-1';
const USER_ID = 'user-1';

function buildPrismaMock() {
  const mock = {
    employee: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    dailyReport: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({ id: 'dr-1' }),
    },
    dailyReportTaskEntry: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    companySettings: {
      findUniqueOrThrow: vi.fn(),
    },
    attendancePolicy: {
      findUnique: vi.fn().mockResolvedValue({ workingWeekdays: [1, 2, 3, 4, 5] }),
    },
    holiday: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    leaveRequest: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    // Same shape as the real FakePrismaService: a transaction just runs the
    // callback against this same mock instance.
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mock)),
  };
  return mock;
}

const OFF_SETTINGS = { dailyReportRequired: false, dailyReportDeadline: null, dailyReportGraceMinutes: null };
// 18:00 deadline, 30 min grace - matches the "HH:mm, UTC getters" TIME-column convention.
const ON_SETTINGS = {
  dailyReportRequired: true,
  dailyReportDeadline: new Date(Date.UTC(1970, 0, 1, 18, 0, 0)),
  dailyReportGraceMinutes: 30,
};

function employeeSelectResult(overrides: Partial<{ dailyReportExempt: boolean; dailyReportTemplateOverride: string | null; designation: { dailyReportTemplate: string | null } | null }> = {}) {
  return {
    dailyReportExempt: false,
    dailyReportTemplateOverride: null,
    designation: null,
    ...overrides,
  };
}

describe('DailyReportsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let auditService: { log: ReturnType<typeof vi.fn> };
  let service: DailyReportsService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    auditService = { log: vi.fn().mockResolvedValue(undefined) };
    prisma.employee.findUnique.mockResolvedValue({ id: EMPLOYEE_ID });
    prisma.employee.findUniqueOrThrow.mockResolvedValue(employeeSelectResult());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new DailyReportsService(prisma as any, auditService as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('when the policy is off', () => {
    it('every date is NOT_REQUIRED, regardless of holidays/leave/weekday', async () => {
      prisma.companySettings.findUniqueOrThrow.mockResolvedValue(OFF_SETTINGS);
      const result = await service.getMyReport(USER_ID, { date: '2026-09-12' }); // a Saturday
      expect(result.status).toBe('NOT_REQUIRED');
    });
  });

  describe('when the policy is on', () => {
    beforeEach(() => {
      prisma.companySettings.findUniqueOrThrow.mockResolvedValue(ON_SETTINGS);
    });

    it('is NOT_REQUIRED on a weekend even though the policy is on', async () => {
      const result = await service.getMyReport(USER_ID, { date: '2026-09-12' }); // Saturday
      expect(result.status).toBe('NOT_REQUIRED');
    });

    it('is NOT_REQUIRED on an active holiday', async () => {
      prisma.holiday.findFirst.mockResolvedValue({ date: new Date('2026-09-11'), isActive: true });
      const result = await service.getMyReport(USER_ID, { date: '2026-09-11' }); // Friday
      expect(result.status).toBe('NOT_REQUIRED');
    });

    it('is NOT_REQUIRED for an employee on approved leave that day', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValue({ id: 'leave-1' });
      const result = await service.getMyReport(USER_ID, { date: '2026-09-11' });
      expect(result.status).toBe('NOT_REQUIRED');
    });

    it('is NOT_REQUIRED for an exempt employee', async () => {
      prisma.employee.findUniqueOrThrow.mockResolvedValue(employeeSelectResult({ dailyReportExempt: true }));
      const result = await service.getMyReport(USER_ID, { date: '2026-09-11' });
      expect(result.status).toBe('NOT_REQUIRED');
    });

    it('is PENDING for a required working day before the deadline+grace, with no row', async () => {
      vi.useFakeTimers();
      // Local Date constructor, not a UTC ISO string - avoids the query
      // date (parsed as UTC midnight) landing on a different calendar day
      // than "now" once local-getter vs UTC-getter reads combine, on a
      // machine whose offset isn't UTC (see classifySubmission's comment).
      vi.setSystemTime(new Date(2026, 8, 11, 12, 0, 0)); // Fri 11 Sep 2026, 12:00 local - before 18:00 deadline
      const result = await service.getMyReport(USER_ID, { date: '2026-09-11' });
      expect(result.status).toBe('PENDING');
    });

    it('is MISSING for a required working day past the deadline+grace, with no row', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 8, 11, 18, 31, 0)); // Fri 11 Sep 2026, 18:31 local - 1 min past 18:00+30min grace
      const result = await service.getMyReport(USER_ID, { date: '2026-09-11' });
      expect(result.status).toBe('MISSING');
    });

    it('is MISSING for any past required day with no row, independent of time-of-day', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-14T00:05:00Z'));
      const result = await service.getMyReport(USER_ID, { date: '2026-09-11' }); // days ago
      expect(result.status).toBe('MISSING');
    });
  });

  describe('upsertMyReport', () => {
    it('rejects a future date', async () => {
      prisma.companySettings.findUniqueOrThrow.mockResolvedValue(OFF_SETTINGS);
      const future = new Date();
      future.setDate(future.getDate() + 5);
      await expect(
        service.upsertMyReport(USER_ID, { date: future.toISOString().slice(0, 10), tasks: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a date older than the self-edit window', async () => {
      prisma.companySettings.findUniqueOrThrow.mockResolvedValue(OFF_SETTINGS);
      await expect(
        service.upsertMyReport(USER_ID, { date: '2020-01-01', tasks: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('marks a submission SUBMITTED when made before the deadline+grace', async () => {
      prisma.companySettings.findUniqueOrThrow.mockResolvedValue(ON_SETTINGS);
      vi.useFakeTimers();
      // Local wall-clock hours, matching how the service reads "now" (see
      // its comment on local-vs-UTC getters) - not UTC hours, which would
      // land on a different local hour depending on this machine's offset.
      const today = new Date();
      today.setHours(10, 0, 0, 0);
      vi.setSystemTime(today);

      await service.upsertMyReport(USER_ID, { tasks: [] });

      expect(prisma.dailyReport.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ status: 'SUBMITTED' }) }),
      );
    });

    it('marks a submission LATE when made after the deadline+grace', async () => {
      prisma.companySettings.findUniqueOrThrow.mockResolvedValue(ON_SETTINGS);
      vi.useFakeTimers();
      const today = new Date();
      today.setHours(20, 0, 0, 0); // local wall-clock, well past 18:00 + 30min
      vi.setSystemTime(today);

      await service.upsertMyReport(USER_ID, { tasks: [] });

      expect(prisma.dailyReport.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ status: 'LATE' }) }),
      );
    });

    it('replaces task entries wholesale rather than diffing', async () => {
      prisma.companySettings.findUniqueOrThrow.mockResolvedValue(OFF_SETTINGS);
      await service.upsertMyReport(USER_ID, {
        tasks: [{ title: 'Fix bug', status: 'COMPLETED' }],
      });
      expect(prisma.dailyReportTaskEntry.deleteMany).toHaveBeenCalledWith({ where: { dailyReportId: 'dr-1' } });
      expect(prisma.dailyReportTaskEntry.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ title: 'Fix bug', status: 'COMPLETED', sortOrder: 0 })],
      });
    });
  });

  describe('template resolution', () => {
    it("falls back to GENERAL when neither the employee nor their designation has a template", async () => {
      prisma.companySettings.findUniqueOrThrow.mockResolvedValue(OFF_SETTINGS);
      const result = await service.getMyReport(USER_ID, {});
      expect(result.template).toBe('GENERAL');
    });

    it("uses the designation's template when the employee has no override", async () => {
      prisma.companySettings.findUniqueOrThrow.mockResolvedValue(OFF_SETTINGS);
      prisma.employee.findUniqueOrThrow.mockResolvedValue(
        employeeSelectResult({ designation: { dailyReportTemplate: 'SEO' } }),
      );
      const result = await service.getMyReport(USER_ID, {});
      expect(result.template).toBe('SEO');
    });

    it("the employee's own override wins over the designation's template", async () => {
      prisma.companySettings.findUniqueOrThrow.mockResolvedValue(OFF_SETTINGS);
      prisma.employee.findUniqueOrThrow.mockResolvedValue(
        employeeSelectResult({
          dailyReportTemplateOverride: 'SALES',
          designation: { dailyReportTemplate: 'SEO' },
        }),
      );
      const result = await service.getMyReport(USER_ID, {});
      expect(result.template).toBe('SALES');
    });
  });

  describe('scope checks (manager vs hr/admin)', () => {
    const manager: AuthContext = { userId: 'mgr-user', sessionId: 's', email: 'm@x.com', roles: ['manager'], permissions: ['performance:manage'] };
    const hr: AuthContext = { userId: 'hr-user', sessionId: 's', email: 'hr@x.com', roles: ['hr'], permissions: ['performance:manage'] };

    beforeEach(() => {
      prisma.companySettings.findUniqueOrThrow.mockResolvedValue(OFF_SETTINGS);
    });

    it("a manager can access their own direct report", async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({ id: 'mgr-employee' }); // requireEmployeeId(manager)
      prisma.employee.findMany.mockResolvedValueOnce([{ id: 'report-1' }]); // direct reports
      await expect(service.getEmployeeReport(manager, 'report-1', {})).resolves.toMatchObject({});
    });

    it("a manager is rejected (403) for an employee outside their team", async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({ id: 'mgr-employee' });
      prisma.employee.findMany.mockResolvedValueOnce([{ id: 'report-1' }]);
      await expect(service.getEmployeeReport(manager, 'someone-else', {})).rejects.toThrow(ForbiddenException);
    });

    it('hr is never restricted to a team and never even queries direct reports', async () => {
      await service.getEmployeeReport(hr, 'anyone', {});
      expect(prisma.employee.findMany).not.toHaveBeenCalled();
    });
  });

  describe('excuse', () => {
    const hr: AuthContext = { userId: 'hr-user', sessionId: 's', email: 'hr@x.com', roles: ['hr'], permissions: ['performance:manage'] };

    it('rejects excusing a day that is not currently MISSING', async () => {
      prisma.companySettings.findUniqueOrThrow.mockResolvedValue(OFF_SETTINGS); // -> NOT_REQUIRED, not MISSING
      await expect(
        service.excuse(hr, EMPLOYEE_ID, { date: '2026-09-11', reason: 'Confirmed present' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.dailyReport.upsert).not.toHaveBeenCalled();
    });

    it('excuses a genuinely MISSING day and audits it', async () => {
      prisma.companySettings.findUniqueOrThrow.mockResolvedValue(ON_SETTINGS);
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-14T00:00:00Z')); // well after 2026-09-11's window

      await service.excuse(hr, EMPLOYEE_ID, { date: '2026-09-11', reason: 'Confirmed present via manager' });

      expect(prisma.dailyReport.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ status: 'EXCUSED', excuseReason: 'Confirmed present via manager' }),
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'DAILY_REPORT_EXCUSED' }),
      );
    });
  });
});
