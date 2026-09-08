-- DropIndex
DROP INDEX `operating_expenses_category_periodMonth_periodYear_key` ON `operating_expenses`;
-- AlterTable
ALTER TABLE `operating_expenses` ADD COLUMN `label` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `category` ENUM('RENT', 'ELECTRICITY', 'INTERNET', 'MISCELLANEOUS', 'CUSTOM') NOT NULL;
-- CreateIndex
CREATE UNIQUE INDEX `operating_expenses_category_label_periodMonth_periodYear_key` ON `operating_expenses`(`category`, `label`, `periodMonth`, `periodYear`);
