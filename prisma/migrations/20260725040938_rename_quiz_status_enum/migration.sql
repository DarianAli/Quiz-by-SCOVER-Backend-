/*
  Warnings:

  - You are about to alter the column `status` on the `quizzes` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(3))` to `Enum(EnumId(2))`.

*/
-- DropForeignKey
ALTER TABLE `users` DROP FOREIGN KEY `users_classId_fkey`;

-- AlterTable
ALTER TABLE `quizzes` MODIFY `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE `users` MODIFY `classId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `classes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
