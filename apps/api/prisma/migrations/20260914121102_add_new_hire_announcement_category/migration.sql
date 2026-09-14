-- DropForeignKey
ALTER TABLE `announcements` DROP FOREIGN KEY `announcements_publishedByUserId_fkey`;

-- DropIndex
DROP INDEX `announcements_publishedByUserId_fkey` ON `announcements`;

-- AlterTable
ALTER TABLE `announcements` MODIFY `category` ENUM('HOLIDAY', 'POLICY', 'EVENT', 'GENERAL', 'NEW_HIRE') NOT NULL,
    MODIFY `publishedByUserId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_publishedByUserId_fkey` FOREIGN KEY (`publishedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

