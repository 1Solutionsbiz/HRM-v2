import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { validateEnv } from './config/environment.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SecurityModule } from './security/security.module.js';
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
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from './common/guards/permissions.guard.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    SecurityModule,
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Order matters: JwtAuthGuard runs first and attaches `authContext`,
    // which PermissionsGuard then reads.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
