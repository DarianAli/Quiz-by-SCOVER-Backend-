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

SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'quizzes'
    AND INDEX_NAME = 'quizzes_moduleId_fkey'
);
SET @sql = IF(@idx_exists > 0,
  'ALTER TABLE `quizzes` DROP INDEX `quizzes_moduleId_fkey`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;