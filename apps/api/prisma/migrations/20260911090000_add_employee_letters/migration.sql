-- AlterTable
ALTER TABLE `audit_logs` MODIFY `eventType` ENUM('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'ROLE_CHANGED', 'PASSWORD_CHANGED', 'DOCUMENT_UPDATED', 'SETTINGS_UPDATED', 'EMPLOYEE_CREATED', 'EMPLOYEE_UPDATED', 'USER_CREATED', 'USER_STATUS_CHANGED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'DAILY_REPORT_EXCUSED', 'LETTER_GENERATED', 'LETTER_CANCELLED', 'OTHER') NOT NULL;

-- AlterTable
ALTER TABLE `notifications` MODIFY `type` ENUM('LEAVE', 'EXPENSE', 'ATTENDANCE', 'ANNOUNCEMENT', 'SYSTEM', 'BIRTHDAY', 'DAILY_REPORT', 'LETTER') NOT NULL;

-- AlterTable
ALTER TABLE `company_settings` ADD COLUMN `logoUrl` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `letter_categories` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `letter_categories_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `letter_types` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `numberPrefix` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `letter_types_key_key`(`key`),
    UNIQUE INDEX `letter_types_numberPrefix_key`(`numberPrefix`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `letter_templates` (
    `id` VARCHAR(191) NOT NULL,
    `letterTypeId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `signatoryId` VARCHAR(191) NULL,
    `currentVersionNumber` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `letter_template_versions` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `letter_template_versions_templateId_versionNumber_key`(`templateId`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `letter_signatories` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_letters` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `letterTypeId` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `templateVersionId` VARCHAR(191) NOT NULL,
    `documentNumber` VARCHAR(191) NOT NULL,
    `status` ENUM('GENERATED', 'CANCELLED') NOT NULL DEFAULT 'GENERATED',
    `resolvedVariables` JSON NOT NULL,
    `renderedContent` TEXT NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `generatedByUserId` VARCHAR(191) NOT NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `cancelledByUserId` VARCHAR(191) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancellationReason` TEXT NULL,

    UNIQUE INDEX `employee_letters_documentNumber_key`(`documentNumber`),
    INDEX `employee_letters_employeeId_idx`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `letter_types` ADD CONSTRAINT `letter_types_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `letter_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `letter_templates` ADD CONSTRAINT `letter_templates_letterTypeId_fkey` FOREIGN KEY (`letterTypeId`) REFERENCES `letter_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `letter_templates` ADD CONSTRAINT `letter_templates_signatoryId_fkey` FOREIGN KEY (`signatoryId`) REFERENCES `letter_signatories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `letter_template_versions` ADD CONSTRAINT `letter_template_versions_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `letter_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_letters` ADD CONSTRAINT `employee_letters_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_letters` ADD CONSTRAINT `employee_letters_letterTypeId_fkey` FOREIGN KEY (`letterTypeId`) REFERENCES `letter_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_letters` ADD CONSTRAINT `employee_letters_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `letter_templates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_letters` ADD CONSTRAINT `employee_letters_templateVersionId_fkey` FOREIGN KEY (`templateVersionId`) REFERENCES `letter_template_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_letters` ADD CONSTRAINT `employee_letters_generatedByUserId_fkey` FOREIGN KEY (`generatedByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_letters` ADD CONSTRAINT `employee_letters_cancelledByUserId_fkey` FOREIGN KEY (`cancelledByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

