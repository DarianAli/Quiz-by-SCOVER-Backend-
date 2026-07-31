-- AlterTable
ALTER TABLE `quizzes` ADD COLUMN `moduleId` INTEGER NULL;

-- CreateTable
CREATE TABLE `modules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `module_name` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL DEFAULT '',
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `subjectId` INTEGER NOT NULL,

    UNIQUE INDEX `modules_uuid_key`(`uuid`),
    INDEX `modules_subjectId_idx`(`subjectId`),
    INDEX `modules_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `modules` ADD CONSTRAINT `modules_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quizzes` ADD CONSTRAINT `quizzes_moduleId_fkey` FOREIGN KEY (`moduleId`) REFERENCES `modules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
