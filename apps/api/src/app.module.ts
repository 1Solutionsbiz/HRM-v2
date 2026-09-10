import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { validateEnv } from './config/environment.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SecurityModule } from './security/security.module.js';
import { MailModule } from './mail/mail.module.js';
import { AuditModule } from './audit/audit.module.js';
import { SequenceModule } from './sequence/sequence.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { EmployeesModule } from './employees/employees.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { AttendanceModule } from './attendance/attendance.module.js';
import { LeaveModule } from './leave/leave.module.js';
import { RequestsModule } from './requests/requests.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { ExpensesModule } from './expenses/expenses.module.js';
import { PerformanceModule } from './performance/performance.module.js';
import { AnnouncementsModule } from './announcements/announcements.module.js';
import { ResignationModule } from './resignation/resignation.module.js';
import { PayrollModule } from './payroll/payroll.module.js';
import { AdminModule } from './admin/admin.module.js';
import { HolidaysModule } from './holidays/holidays.module.js';
import { TicketModule } from './tickets/ticket.module.js';
import { OperatingExpensesModule } from './operating-expenses/operating-expenses.module.js';
import { MoodCheckInsModule } from './mood-checkins/mood-checkins.module.js';
import { PollsModule } from './polls/polls.module.js';
import { EmployeeOfTheMonthModule } from './employee-of-the-month/employee-of-the-month.module.js';
import { HandbookModule } from './handbook/handbook.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { DailyReportsModule } from './daily-reports/daily-reports.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from './common/guards/permissions.guard.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Global backstop against request floods/scraping - route-specific
    // limits (login, forgot/reset-password) are tighter, set via @Throttle
    // on those controllers. Keyed by request.ip, which resolves correctly
    // behind LiteSpeed because of `app.set('trust proxy', true)` in
    // main.ts - verified empirically against recorded Session.ipAddress
    // rows (real external IPs since that fix deployed, vs 127.0.0.1
    // before it).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    SecurityModule,
    MailModule,
    AuditModule,
    SequenceModule,
    AuthModule,
    UsersModule,
    EmployeesModule,
    NotificationsModule,
    AttendanceModule,
    LeaveModule,
    RequestsModule,
    DocumentsModule,
    ExpensesModule,
    PerformanceModule,
    AnnouncementsModule,
    ResignationModule,
    PayrollModule,
    AdminModule,
    HolidaysModule,
    TicketModule,
    OperatingExpensesModule,
    MoodCheckInsModule,
    PollsModule,
    EmployeeOfTheMonthModule,
    HandbookModule,
    ReportsModule,
    DailyReportsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Order matters: ThrottlerGuard runs first (IP-only, no auth context
    // needed) so a flood is rejected before hitting auth/DB work; then
    // JwtAuthGuard attaches `authContext`, which PermissionsGuard reads.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
