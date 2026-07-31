/*
  Warnings:

  - You are about to drop the column `subjectId` on the `quizzes` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `quizzes` DROP FOREIGN KEY `quizzes_subjectId_fkey`;

-- DropIndex
DROP INDEX `quizzes_subjectId_idx` ON `quizzes`;

-- AlterTable
ALTER TABLE `quizzes` DROP COLUMN `subjectId`;

-- RedefineIndex
CREATE INDEX `quizzes_moduleId_idx` ON `quizzes`(`moduleId`);
DROP INDEX `quizzes_moduleId_fkey` ON `quizzes`;
