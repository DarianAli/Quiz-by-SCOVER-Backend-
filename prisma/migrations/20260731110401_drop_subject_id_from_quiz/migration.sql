/*
  Warnings:

  - You are about to drop the column `subjectId` on the `quizzes` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `quizzes` DROP FOREIGN KEY `quizzes_subjectId_fkey`;

-- DropIndex
ALTER TABLE `quizzes` DROP INDEX `quizzes_subjectId_idx`;

-- AlterTable
ALTER TABLE `quizzes` DROP COLUMN `subjectId`;

-- RedefineIndex
CREATE INDEX `quizzes_moduleId_idx` ON `quizzes`(`moduleId`);
