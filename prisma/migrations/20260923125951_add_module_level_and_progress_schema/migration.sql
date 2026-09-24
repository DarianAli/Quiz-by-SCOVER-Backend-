-- AlterTable
ALTER TABLE `modules` ADD COLUMN `subjectLevelId` INTEGER NULL;

-- AlterTable
ALTER TABLE `questions` ADD COLUMN `allow_multiple_answers` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `is_strict` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `parentId` INTEGER NULL,
    MODIFY `question_type` ENUM('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'ESSAY', 'MATCHING', 'FILL_BLANK', 'STORY_GROUP', 'MULTIPLE_COMPLEX') NOT NULL DEFAULT 'MULTIPLE_CHOICE';

-- CreateTable
CREATE TABLE `subject_levels` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `level_name` VARCHAR(191) NOT NULL,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `subjectId` INTEGER NOT NULL,

    UNIQUE INDEX `subject_levels_uuid_key`(`uuid`),
    INDEX `subject_levels_subjectId_idx`(`subjectId`),
    INDEX `subject_levels_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tentor_subject` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `subjectId` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tentor_subject_userId_idx`(`userId`),
    INDEX `tentor_subject_subjectId_idx`(`subjectId`),
    UNIQUE INDEX `tentor_subject_userId_subjectId_key`(`userId`, `subjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_module_progres` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `moduleId` INTEGER NOT NULL,
    `completed_quiz` INTEGER NOT NULL DEFAULT 0,
    `totalQuiz` INTEGER NOT NULL DEFAULT 0,
    `score_presentage` DOUBLE NOT NULL DEFAULT 0,
    `isCompleted` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `student_module_progres_userId_idx`(`userId`),
    INDEX `student_module_progres_moduleId_idx`(`moduleId`),
    UNIQUE INDEX `student_module_progres_userId_moduleId_key`(`userId`, `moduleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `modules_subjectLevelId_idx` ON `modules`(`subjectLevelId`);

-- CreateIndex
CREATE INDEX `questions_parentId_idx` ON `questions`(`parentId`);

-- AddForeignKey
ALTER TABLE `subject_levels` ADD CONSTRAINT `subject_levels_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tentor_subject` ADD CONSTRAINT `tentor_subject_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tentor_subject` ADD CONSTRAINT `tentor_subject_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `modules` ADD CONSTRAINT `modules_subjectLevelId_fkey` FOREIGN KEY (`subjectLevelId`) REFERENCES `subject_levels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_module_progres` ADD CONSTRAINT `student_module_progres_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_module_progres` ADD CONSTRAINT `student_module_progres_moduleId_fkey` FOREIGN KEY (`moduleId`) REFERENCES `modules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questions` ADD CONSTRAINT `questions_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
