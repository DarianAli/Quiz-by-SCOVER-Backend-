-- AlterTable
ALTER TABLE `quiz` ADD COLUMN `creator_role` ENUM('ADMIN', 'STUDENT', 'TENTOR') NULL;
