-- CreateTable
CREATE TABLE `operating_expenses` (
    `id` VARCHAR(191) NOT NULL,
    `category` ENUM('RENT', 'ELECTRICITY', 'INTERNET', 'MISCELLANEOUS') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `periodMonth` INTEGER NOT NULL,
    `periodYear` INTEGER NOT NULL,
    `note` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `operating_expenses_category_periodMonth_periodYear_key`(`category`, `periodMonth`, `periodYear`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
