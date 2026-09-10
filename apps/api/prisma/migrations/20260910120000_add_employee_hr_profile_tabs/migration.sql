-- AlterTable: emergency contacts gain an ISD code
ALTER TABLE `employee_emergency_contacts` ADD COLUMN `isdCode` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `employee_identifications` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `panNumberEncrypted` VARCHAR(191) NULL,
    `aadhaarNumberEncrypted` VARCHAR(191) NULL,
    `passportNumberEncrypted` VARCHAR(191) NULL,
    `passportExpiryDate` DATE NULL,
    `drivingLicenseNumberEncrypted` VARCHAR(191) NULL,
    `drivingLicenseExpiryDate` DATE NULL,

    UNIQUE INDEX `employee_identifications_employeeId_key`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_family_details` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `fatherName` VARCHAR(191) NULL,
    `fatherDateOfBirth` DATE NULL,
    `motherName` VARCHAR(191) NULL,
    `motherDateOfBirth` DATE NULL,

    UNIQUE INDEX `employee_family_details_employeeId_key`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_family_members` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `kind` ENUM('CHILD', 'OTHER_DEPENDENT', 'NOMINEE') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `relationship` VARCHAR(191) NULL,
    `dateOfBirth` DATE NULL,
    `sharePercentage` INTEGER NULL,

    INDEX `employee_family_members_employeeId_idx`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_previous_employers` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `companyName` VARCHAR(191) NOT NULL,
    `designation` VARCHAR(191) NULL,
    `fromDate` DATE NULL,
    `toDate` DATE NULL,

    INDEX `employee_previous_employers_employeeId_idx`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `employee_identifications` ADD CONSTRAINT `employee_identifications_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_family_details` ADD CONSTRAINT `employee_family_details_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_family_members` ADD CONSTRAINT `employee_family_members_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_previous_employers` ADD CONSTRAINT `employee_previous_employers_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: carry over existing bank-detail PAN ciphertexts as-is (same
-- encryption key/algorithm, so the stored value is portable without
-- decrypting) into the new identification table before the column is dropped.
INSERT INTO `employee_identifications` (`id`, `employeeId`, `panNumberEncrypted`)
SELECT UUID(), `employeeId`, `panNumberEncrypted`
FROM `employee_bank_details`
WHERE `panNumberEncrypted` IS NOT NULL;

-- AlterTable: PAN now lives exclusively on employee_identifications
ALTER TABLE `employee_bank_details` DROP COLUMN `panNumberEncrypted`;
