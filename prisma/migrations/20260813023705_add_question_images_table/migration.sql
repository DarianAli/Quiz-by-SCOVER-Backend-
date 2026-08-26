-- CreateTable
CREATE TABLE `question_images` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `questionsId` INTEGER NOT NULL,

    UNIQUE INDEX `question_images_uuid_key`(`uuid`),
    INDEX `question_images_questionsId_idx`(`questionsId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `question_images` ADD CONSTRAINT `question_images_questionsId_fkey` FOREIGN KEY (`questionsId`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
