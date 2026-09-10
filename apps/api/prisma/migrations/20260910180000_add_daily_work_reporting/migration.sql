-- AlterTable
ALTER TABLE `audit_logs` MODIFY `eventType` ENUM('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'ROLE_CHANGED', 'PASSWORD_CHANGED', 'DOCUMENT_UPDATED', 'SETTINGS_UPDATED', 'EMPLOYEE_CREATED', 'EMPLOYEE_UPDATED', 'USER_CREATED', 'USER_STATUS_CHANGED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'DAILY_REPORT_EXCUSED', 'OTHER') NOT NULL;

-- AlterTable
ALTER TABLE `company_settings` ADD COLUMN `dailyReportDeadline` TIME NULL,
    ADD COLUMN `dailyReportGraceMinutes` INTEGER NULL,
    ADD COLUMN `dailyReportRequired` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `designations` ADD COLUMN `dailyReportTemplate` ENUM('DEVELOPMENT', 'SEO', 'SOCIAL_MEDIA', 'SALES', 'HR', 'GENERAL') NULL;

-- AlterTable
ALTER TABLE `employees` ADD COLUMN `dailyReportExempt` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `dailyReportTemplateOverride` ENUM('DEVELOPMENT', 'SEO', 'SOCIAL_MEDIA', 'SALES', 'HR', 'GENERAL') NULL;

-- AlterTable
ALTER TABLE `notifications` MODIFY `type` ENUM('LEAVE', 'EXPENSE', 'ATTENDANCE', 'ANNOUNCEMENT', 'SYSTEM', 'BIRTHDAY', 'DAILY_REPORT') NOT NULL;

-- CreateTable
CREATE TABLE `daily_reports` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `status` ENUM('SUBMITTED', 'LATE', 'EXCUSED', 'MISSING', 'NOT_REQUIRED', 'PENDING') NOT NULL,
    `summary` TEXT NULL,
    `blockers` TEXT NULL,
    `tomorrowPlan` TEXT NULL,
    `submittedAt` DATETIME(3) NULL,
    `excusedByUserId` VARCHAR(191) NULL,
    `excusedAt` DATETIME(3) NULL,
    `excuseReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `daily_reports_date_idx`(`date`),
    UNIQUE INDEX `daily_reports_employeeId_date_key`(`employeeId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_report_task_entries` (
    `id` VARCHAR(191) NOT NULL,
    `dailyReportId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `projectOrClient` VARCHAR(191) NULL,
    `status` ENUM('IN_PROGRESS', 'COMPLETED', 'BLOCKED') NOT NULL DEFAULT 'IN_PROGRESS',
    `expectedMinutes` INTEGER NULL,
    `actualMinutes` INTEGER NULL,
    `output` TEXT NULL,
    `blockerCategory` ENUM('REQUIREMENT_UNCLEAR', 'TECHNICAL_COMPLEXITY', 'BUG', 'DEPENDENCY', 'WAITING_DESIGN', 'WAITING_APPROVAL', 'WAITING_CLIENT', 'ENVIRONMENT', 'REWORK', 'OTHER') NULL,
    `blockerNote` TEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `daily_reports` ADD CONSTRAINT `daily_reports_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_reports` ADD CONSTRAINT `daily_reports_excusedByUserId_fkey` FOREIGN KEY (`excusedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_report_task_entries` ADD CONSTRAINT `daily_report_task_entries_dailyReportId_fkey` FOREIGN KEY (`dailyReportId`) REFERENCES `daily_reports`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

