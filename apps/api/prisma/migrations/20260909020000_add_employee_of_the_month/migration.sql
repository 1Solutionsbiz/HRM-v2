-- CreateTable
CREATE TABLE `employee_of_the_month` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `periodMonth` INTEGER NOT NULL,
    `periodYear` INTEGER NOT NULL,
    `note` TEXT NULL,
    `nominatedByUserId` VARCHAR(191) NOT NULL,
    `nominatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `employee_of_the_month_periodMonth_periodYear_key`(`periodMonth`, `periodYear`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `employee_of_the_month` ADD CONSTRAINT `employee_of_the_month_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_of_the_month` ADD CONSTRAINT `employee_of_the_month_nominatedByUserId_fkey` FOREIGN KEY (`nominatedByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

