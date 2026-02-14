-- CreateTable
CREATE TABLE `admin` (
    `idAdmin` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL DEFAULT '',
    `username` VARCHAR(191) NOT NULL DEFAULT '',
    `password` VARCHAR(191) NOT NULL DEFAULT '',
    `email` VARCHAR(191) NOT NULL DEFAULT '',
    `role` ENUM('ADMIN', 'STUDENT', 'TENTOR') NOT NULL DEFAULT 'ADMIN',
    `phone_number` VARCHAR(191) NOT NULL DEFAULT '',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `admin_uuid_key`(`uuid`),
    PRIMARY KEY (`idAdmin`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `idUser` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL DEFAULT '',
    `userName` VARCHAR(191) NOT NULL DEFAULT '',
    `password` VARCHAR(191) NOT NULL DEFAULT '',
    `full_name` VARCHAR(191) NOT NULL DEFAULT '',
    `email` VARCHAR(191) NOT NULL DEFAULT '',
    `role` ENUM('ADMIN', 'STUDENT', 'TENTOR') NOT NULL DEFAULT 'STUDENT',
    `classId` INTEGER NOT NULL,
    `phone_number` VARCHAR(191) NOT NULL DEFAULT '',
    `parent_full_name` VARCHAR(191) NOT NULL DEFAULT '',
    `parent_phone_number` VARCHAR(191) NOT NULL DEFAULT '',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_uuid_key`(`uuid`),
    PRIMARY KEY (`idUser`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `classes` (
    `idClass` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL DEFAULT '',
    `class_name` VARCHAR(191) NOT NULL DEFAULT '',
    `class_program` ENUM('UTBK', 'SKD') NOT NULL DEFAULT 'UTBK',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `classes_uuid_key`(`uuid`),
    PRIMARY KEY (`idClass`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subject` (
    `idSubject` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL DEFAULT '',
    `subject_name` VARCHAR(191) NOT NULL DEFAULT '',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `subject_uuid_key`(`uuid`),
    PRIMARY KEY (`idSubject`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subjectClass` (
    `subjectId` INTEGER NOT NULL,
    `classId` INTEGER NOT NULL,

    PRIMARY KEY (`subjectId`, `classId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quiz` (
    `idQuiz` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL DEFAULT '',
    `quiz_title` VARCHAR(191) NOT NULL DEFAULT '',
    `quiz_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `start_time` DATETIME(3) NOT NULL,
    `finished_time` DATETIME(3) NOT NULL,
    `duration` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('INCOMPLETED', 'COMPLETED') NOT NULL DEFAULT 'INCOMPLETED',
    `difficulty` ENUM('HARD', 'MEDIUM', 'EASY') NOT NULL DEFAULT 'EASY',
    `created_by` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `subjectId` INTEGER NOT NULL,

    UNIQUE INDEX `quiz_uuid_key`(`uuid`),
    PRIMARY KEY (`idQuiz`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scores` (
    `idScore` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL DEFAULT '',
    `total_questions` INTEGER NOT NULL DEFAULT 0,
    `corret` INTEGER NOT NULL DEFAULT 0,
    `wrong` INTEGER NOT NULL DEFAULT 0,
    `score` INTEGER NOT NULL DEFAULT 0,
    `start_time` DATETIME(3) NOT NULL,
    `finished_time` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `userId` INTEGER NOT NULL,
    `quizId` INTEGER NOT NULL,

    UNIQUE INDEX `scores_uuid_key`(`uuid`),
    PRIMARY KEY (`idScore`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `answers` (
    `idAnswers` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL DEFAULT '',
    `student_answer` VARCHAR(191) NOT NULL DEFAULT '',
    `is_Correct` BOOLEAN NOT NULL DEFAULT false,
    `answered_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `quizId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `answers_uuid_key`(`uuid`),
    PRIMARY KEY (`idAnswers`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `questions` (
    `idQuestion` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL DEFAULT '',
    `question_text` VARCHAR(191) NOT NULL DEFAULT '',
    `questions_image` VARCHAR(191) NOT NULL DEFAULT '',
    `option_a` VARCHAR(191) NOT NULL DEFAULT '',
    `option_b` VARCHAR(191) NOT NULL DEFAULT '',
    `option_c` VARCHAR(191) NOT NULL DEFAULT '',
    `option_d` VARCHAR(191) NOT NULL DEFAULT '',
    `correct_answers` VARCHAR(191) NOT NULL DEFAULT '',
    `difficulty` ENUM('HARD', 'MEDIUM', 'EASY') NOT NULL DEFAULT 'EASY',
    `poin` INTEGER NOT NULL DEFAULT 0,
    `quizId` INTEGER NOT NULL,

    UNIQUE INDEX `questions_uuid_key`(`uuid`),
    PRIMARY KEY (`idQuestion`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `user_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `classes`(`idClass`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subjectClass` ADD CONSTRAINT `subjectClass_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subject`(`idSubject`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subjectClass` ADD CONSTRAINT `subjectClass_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `classes`(`idClass`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quiz` ADD CONSTRAINT `quiz_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subject`(`idSubject`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scores` ADD CONSTRAINT `scores_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`idUser`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scores` ADD CONSTRAINT `scores_quizId_fkey` FOREIGN KEY (`quizId`) REFERENCES `quiz`(`idQuiz`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `answers` ADD CONSTRAINT `answers_quizId_fkey` FOREIGN KEY (`quizId`) REFERENCES `quiz`(`idQuiz`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `answers` ADD CONSTRAINT `answers_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`idUser`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questions` ADD CONSTRAINT `questions_quizId_fkey` FOREIGN KEY (`quizId`) REFERENCES `quiz`(`idQuiz`) ON DELETE RESTRICT ON UPDATE CASCADE;
