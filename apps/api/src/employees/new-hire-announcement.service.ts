import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { addDays, toDateOnly } from '../common/date-only.js';

const EMPLOYEE_INCLUDE = {
  department: true,
  designation: true,
  user: { select: { email: true } },
} as const;

/** How far back the daily catch-up looks for a still-unannounced recent hire - see announceTodaysNewHires. */
const CATCH_UP_WINDOW_DAYS = 7;

/**
 * Once a day (not tied to when HR actually creates the Employee record -
 * that can be well before someone's real start date), finds anyone whose
 * dateOfJoining is within the last CATCH_UP_WINDOW_DAYS and who hasn't
 * had this sent yet (welcomeEmailSentAt), and emails every other active
 * employee with an active login to welcome them.
 *
 * Not a same-day-only match (dateOfJoining === today) - confirmed as a
 * real gap the first time this ran live: an employee created after that
 * day's 9 AM cron tick (or added on a day the deploy/feature simply
 * didn't exist yet) would never be caught, since "today" only equals
 * their join date once, ever. A bounded catch-up window is self-healing
 * for exactly that miss without retroactively announcing someone who
 * joined years ago (welcomeEmailSentAt is null for every legacy-imported
 * employee too, not just recent ones).
 */
@Injectable()
export class NewHireAnnouncementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  @Cron('0 11 * * *', { timeZone: 'Asia/Kolkata' })
  async announceTodaysNewHires(): Promise<void> {
    const today = toDateOnly(new Date());
    const windowStart = addDays(today, -CATCH_UP_WINDOW_DAYS);
    const newHires = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE', dateOfJoining: { gte: windowStart, lte: today }, welcomeEmailSentAt: null },
      include: EMPLOYEE_INCLUDE,
    });

    for (const employee of newHires) {
      await this.announceEmployee(employee);
    }
  }

  /**
   * Manually fires the real announcement for one employee right now -
   * the deliberate-action counterpart to sendTest, for exactly the case
   * the catch-up window doesn't (or shouldn't) reach: someone who joined
   * longer ago than CATCH_UP_WINDOW_DAYS but was never announced. Refuses
   * to re-send once welcomeEmailSentAt is already set, so this can't
   * double-announce someone by mistake.
   */
  async sendNow(employeeId: string): Promise<{ employeeName: string; recipientCount: number }> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: EMPLOYEE_INCLUDE,
    });
    if (!employee) throw new NotFoundException('Employee not found');
    if (employee.status !== 'ACTIVE') {
      throw new BadRequestException('Can only announce a currently active employee');
    }
    if (employee.welcomeEmailSentAt) {
      throw new BadRequestException(
        `${employee.firstName} ${employee.lastName} was already announced on ${employee.welcomeEmailSentAt.toISOString().slice(0, 10)}`,
      );
    }

    const recipients = await this.announceEmployee(employee);
    return { employeeName: `${employee.firstName} ${employee.lastName}`, recipientCount: recipients.length };
  }

  private async announceEmployee(
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      phone: string | null;
      department: { name: string } | null;
      designation: { title: string } | null;
      user: { email: string };
    },
  ): Promise<string[]> {
    const recipients = await this.findAnnouncementRecipients(employee.id);
    await this.mailService.sendNewHireAnnouncement(recipients, {
      firstName: employee.firstName,
      lastName: employee.lastName,
      designation: employee.designation?.title ?? null,
      department: employee.department?.name ?? null,
      workEmail: employee.user.email,
      phone: employee.phone,
    });
    await this.prisma.employee.update({
      where: { id: employee.id },
      data: { welcomeEmailSentAt: new Date() },
    });
    return recipients;
  }

  /**
   * Sends a [TEST]-labelled preview to the caller only (real recipient
   * list is computed but never mailed) - mirrors every other reminder
   * job's sendTest. Defaults to the most recently joined active employee
   * when no employeeId is given, since Employee has no createdAt to pick
   * "most recently added" by.
   */
  async sendTest(actorEmail: string, employeeId?: string): Promise<{ employeeName: string; recipientCount: number }> {
    const employee = employeeId
      ? await this.prisma.employee.findUnique({ where: { id: employeeId }, include: EMPLOYEE_INCLUDE })
      : await this.prisma.employee.findFirst({
          where: { status: 'ACTIVE' },
          orderBy: { dateOfJoining: 'desc' },
          include: EMPLOYEE_INCLUDE,
        });
    if (!employee) throw new NotFoundException('No employee found to preview');

    const recipients = await this.findAnnouncementRecipients(employee.id);
    await this.mailService.sendNewHireAnnouncement([actorEmail], {
      firstName: employee.firstName,
      lastName: employee.lastName,
      designation: employee.designation?.title ?? null,
      department: employee.department?.name ?? null,
      workEmail: employee.user.email,
      phone: employee.phone,
      isTest: true,
    });

    return { employeeName: `${employee.firstName} ${employee.lastName}`, recipientCount: recipients.length };
  }

  /** Every active employee with an active login, except the new hire being announced. */
  private async findAnnouncementRecipients(excludeEmployeeId: string): Promise<string[]> {
    const employees = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE', id: { not: excludeEmployeeId }, user: { isActive: true } },
      select: { user: { select: { email: true } } },
    });
    return employees.map((e) => e.user.email);
  }
}
