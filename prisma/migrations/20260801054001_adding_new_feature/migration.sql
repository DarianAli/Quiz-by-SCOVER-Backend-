-- DropForeignKey
ALTER TABLE `answers` DROP FOREIGN KEY `answers_optionsId_fkey`;

-- DropIndex
DROP INDEX `answers_optionsId_fkey` ON `answers`;

-- AlterTable
ALTER TABLE `answers` ADD COLUMN `answer_text` TEXT NULL,
    ADD COLUMN `feedback` TEXT NULL,
    ADD COLUMN `score` INTEGER NULL,
    MODIFY `optionsId` INTEGER NULL;

-- AlterTable
ALTER TABLE `questions` ADD COLUMN `question_type` ENUM('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'ESSAY', 'MATCHING', 'FILL_BLANK') NOT NULL DEFAULT 'MULTIPLE_CHOICE';

-- AlterTable
ALTER TABLE `scores` ADD COLUMN `review_status` ENUM('WAITING_REVIEW', 'REVIEWED', 'AUTO_GRADED') NOT NULL DEFAULT 'AUTO_GRADED';

-- AddForeignKey
ALTER TABLE `answers` ADD CONSTRAINT `answers_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `attempts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `answers` ADD CONSTRAINT `answers_optionsId_fkey` FOREIGN KEY (`optionsId`) REFERENCES `options`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
