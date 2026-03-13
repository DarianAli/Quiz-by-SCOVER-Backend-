/*
  Warnings:

  - You are about to drop the column `questionId` on the `answers` table. All the data in the column will be lost.
  - The primary key for the `options` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `idOptions` on the `options` table. All the data in the column will be lost.
  - You are about to drop the column `questionId` on the `options` table. All the data in the column will be lost.
  - You are about to drop the column `questions_image` on the `questions` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,quizId,questionsId]` on the table `answers` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `questionsId` to the `answers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `idOption` to the `options` table without a default value. This is not possible if the table is not empty.
  - Added the required column `questionsId` to the `options` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `answers` DROP FOREIGN KEY `answers_optionsId_fkey`;

-- DropForeignKey
ALTER TABLE `answers` DROP FOREIGN KEY `answers_questionId_fkey`;

-- DropForeignKey
ALTER TABLE `options` DROP FOREIGN KEY `options_questionId_fkey`;

-- DropIndex
DROP INDEX `answers_optionsId_fkey` ON `answers`;

-- DropIndex
DROP INDEX `answers_questionId_fkey` ON `answers`;

-- DropIndex
DROP INDEX `options_questionId_fkey` ON `options`;

-- AlterTable
ALTER TABLE `answers` DROP COLUMN `questionId`,
    ADD COLUMN `questionsId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `options` DROP PRIMARY KEY,
    DROP COLUMN `idOptions`,
    DROP COLUMN `questionId`,
    ADD COLUMN `idOption` INTEGER NOT NULL AUTO_INCREMENT,
    ADD COLUMN `questionsId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`idOption`);

-- AlterTable
ALTER TABLE `questions` DROP COLUMN `questions_image`,
    ADD COLUMN `question_image` VARCHAR(191) NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX `answers_userId_quizId_questionsId_key` ON `answers`(`userId`, `quizId`, `questionsId`);

-- AddForeignKey
ALTER TABLE `answers` ADD CONSTRAINT `answers_questionsId_fkey` FOREIGN KEY (`questionsId`) REFERENCES `questions`(`idQuestion`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `answers` ADD CONSTRAINT `answers_optionsId_fkey` FOREIGN KEY (`optionsId`) REFERENCES `options`(`idOption`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `options` ADD CONSTRAINT `options_questionsId_fkey` FOREIGN KEY (`questionsId`) REFERENCES `questions`(`idQuestion`) ON DELETE RESTRICT ON UPDATE CASCADE;
