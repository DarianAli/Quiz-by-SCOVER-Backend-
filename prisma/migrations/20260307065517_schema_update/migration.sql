/*
  Warnings:

  - You are about to drop the column `is_Correct` on the `answers` table. All the data in the column will be lost.
  - You are about to drop the column `correct_answers` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `option_a` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `option_b` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `option_c` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `option_d` on the `questions` table. All the data in the column will be lost.
  - Added the required column `optionsId` to the `answers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `questionId` to the `answers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `answers` DROP COLUMN `is_Correct`,
    ADD COLUMN `optionsId` INTEGER NOT NULL,
    ADD COLUMN `questionId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `questions` DROP COLUMN `correct_answers`,
    DROP COLUMN `option_a`,
    DROP COLUMN `option_b`,
    DROP COLUMN `option_c`,
    DROP COLUMN `option_d`;

-- CreateTable
CREATE TABLE `options` (
    `idOptions` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL DEFAULT '',
    `option_text` VARCHAR(191) NOT NULL DEFAULT '',
    `option_image` VARCHAR(191) NOT NULL DEFAULT '',
    `is_correct` BOOLEAN NOT NULL DEFAULT false,
    `questionId` INTEGER NOT NULL,

    UNIQUE INDEX `options_uuid_key`(`uuid`),
    PRIMARY KEY (`idOptions`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `answers` ADD CONSTRAINT `answers_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `questions`(`idQuestion`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `answers` ADD CONSTRAINT `answers_optionsId_fkey` FOREIGN KEY (`optionsId`) REFERENCES `options`(`idOptions`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `options` ADD CONSTRAINT `options_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `questions`(`idQuestion`) ON DELETE RESTRICT ON UPDATE CASCADE;
