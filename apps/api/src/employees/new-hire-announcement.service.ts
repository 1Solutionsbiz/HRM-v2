import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { toDateOnly } from '../common/date-only.js';

/**
 * Once a day (not tied to when HR actually creates the Employee record -
 * that can be well before someone's real start date), finds anyone whose
 * dateOfJoining is today and who hasn't had this sent yet
 * (welcomeEmailSentAt), and emails every other active employee with an
 * active login to welcome them. Deliberately excludes the new hire
 * themselves, and anyone deactivated or no longer employed - see
 * findAnnouncementRecipients.
 */
@Injectable()
export class NewHireAnnouncementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  @Cron('0 9 * * *', { timeZone: 'Asia/Kolkata' })
  async announceTodaysNewHires(): Promise<void> {
    const today = toDateOnly(new Date());
    const newHires = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE', dateOfJoining: today, welcomeEmailSentAt: null },
      include: { department: true, designation: true, user: { select: { email: true } } },
    });

    for (const employee of newHires) {
      const recipients = await this.findAnnouncementRecipients(employee.id);
      await this.mailService.sendNewHireAnnouncement(recipients, {
        employeeName: `${employee.firstName} ${employee.lastName}`,
        designation: employee.designation?.title ?? null,
        department: employee.department?.name ?? null,
        workEmail: employee.user.email,
        phone: employee.phone,
      });
      await this.prisma.employee.update({
        where: { id: employee.id },
        data: { welcomeEmailSentAt: new Date() },
      });
    }
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
      ? await this.prisma.employee.findUnique({
          where: { id: employeeId },
          include: { department: true, designation: true, user: { select: { email: true } } },
        })
      : await this.prisma.employee.findFirst({
          where: { status: 'ACTIVE' },
          orderBy: { dateOfJoining: 'desc' },
          include: { department: true, designation: true, user: { select: { email: true } } },
        });
    if (!employee) throw new NotFoundException('No employee found to preview');

    const recipients = await this.findAnnouncementRecipients(employee.id);
    await this.mailService.sendNewHireAnnouncement([actorEmail], {
      employeeName: `[TEST] ${employee.firstName} ${employee.lastName}`,
      designation: employee.designation?.title ?? null,
      department: employee.department?.name ?? null,
      workEmail: employee.user.email,
      phone: employee.phone,
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
