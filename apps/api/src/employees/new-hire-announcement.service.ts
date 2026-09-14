import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { addDays, toDateOnly } from '../common/date-only.js';

const EMPLOYEE_INCLUDE = {
  department: true,
  designation: true,
  user: { select: { email: true, isActive: true } },
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
 *
 * No @Cron here on purpose - see MissingCheckoutReminderService's comment
 * for why: Hostinger runs more than one copy of this process, so an
 * in-process cron fires once per live copy at the same instant. Here that's
 * not just noisy - two copies could both read welcomeEmailSentAt: null for
 * the same employee before either writes it, sending the real welcome
 * announcement twice. The trigger is the external cron-job.org hit to
 * POST /employees/cron/new-hire-announcements (EmployeesController,
 * guarded by CronAuthGuard) - exactly one call, one process handles it.
 */
@Injectable()
export class NewHireAnnouncementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async announceTodaysNewHires(): Promise<void> {
    const today = toDateOnly(new Date());
    const windowStart = addDays(today, -CATCH_UP_WINDOW_DAYS);
    const newHires = await this.prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        user: { isActive: true },
        dateOfJoining: { gte: windowStart, lte: today },
        welcomeEmailSentAt: null,
      },
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
    if (!employee.user.isActive) {
      throw new BadRequestException('Cannot announce an employee whose login has been deactivated');
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
      avatarUrl: string | null;
      department: { name: string } | null;
      designation: { title: string } | null;
      user: { email: string };
    },
  ): Promise<string[]> {
    const recipients = await this.findAnnouncementRecipients(employee.id);
    await this.mailService.sendNewHireAnnouncement(recipients.map((r) => r.email), {
      firstName: employee.firstName,
      lastName: employee.lastName,
      designation: employee.designation?.title ?? null,
      department: employee.department?.name ?? null,
      workEmail: employee.user.email,
      phone: employee.phone,
      avatarUrl: employee.avatarUrl,
    });
    await this.prisma.employee.update({
      where: { id: employee.id },
      data: { welcomeEmailSentAt: new Date() },
    });
    await this.postToFeed(employee, recipients.map((r) => r.userId));
    return recipients.map((r) => r.email);
  }

  /**
   * Same event, also as a feed post — so it shows up on the Announcements
   * page (with the new hire's photo, if they have one) instead of only
   * landing as an email. System-generated: publishedByUserId is left null
   * (see the schema comment on Announcement.publishedByUserId).
   */
  private async postToFeed(
    employee: {
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
      department: { name: string } | null;
      designation: { title: string } | null;
    },
    recipientUserIds: string[],
  ): Promise<void> {
    const fullName = `${employee.firstName} ${employee.lastName}`.trim();
    const roleLine = [employee.designation?.title, employee.department?.name]
      .filter(Boolean)
      .join(', ');
    const body = `Please join us in welcoming ${employee.firstName} to the team${roleLine ? ` as ${roleLine}` : ''}. Say hello! 🎉`;

    const announcement = await this.prisma.announcement.create({
      data: {
        title: `Welcome ${fullName}!`,
        body,
        imageUrl: employee.avatarUrl,
        category: 'NEW_HIRE',
        publishedByUserId: null,
      },
    });

    await this.notificationsService.createForUsers(recipientUserIds, {
      type: 'ANNOUNCEMENT',
      title: announcement.title,
      description: body,
      linkUrl: '/announcements',
    });
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
          where: { status: 'ACTIVE', user: { isActive: true } },
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
      avatarUrl: employee.avatarUrl,
      isTest: true,
    });

    return { employeeName: `${employee.firstName} ${employee.lastName}`, recipientCount: recipients.length };
  }

  /** Every active employee with an active login, except the new hire being announced. */
  private async findAnnouncementRecipients(
    excludeEmployeeId: string,
  ): Promise<{ userId: string; email: string }[]> {
    const employees = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE', id: { not: excludeEmployeeId }, user: { isActive: true } },
      select: { user: { select: { id: true, email: true } } },
    });
    return employees.map((e) => ({ userId: e.user.id, email: e.user.email }));
  }
}
