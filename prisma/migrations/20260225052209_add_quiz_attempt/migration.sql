/*
  Warnings:

  - You are about to drop the column `finished_time` on the `quiz` table. All the data in the column will be lost.
  - You are about to drop the column `start_time` on the `quiz` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `quiz` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `quiz` DROP COLUMN `finished_time`,
    DROP COLUMN `start_time`,
    DROP COLUMN `status`;

-- CreateTable
CREATE TABLE `attempt` (
    `idAttempt` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `quizId` INTEGER NOT NULL,
    `start_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finished_time` DATETIME(3) NULL,
    `isFinished` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `attempt_userId_quizId_key`(`userId`, `quizId`),
    PRIMARY KEY (`idAttempt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `attempt` ADD CONSTRAINT `attempt_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`idUser`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attempt` ADD CONSTRAINT `attempt_quizId_fkey` FOREIGN KEY (`quizId`) REFERENCES `quiz`(`idQuiz`) ON DELETE RESTRICT ON UPDATE CASCADE;
