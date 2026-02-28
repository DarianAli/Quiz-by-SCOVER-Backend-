-- DropForeignKey
ALTER TABLE `quiz` DROP FOREIGN KEY `quiz_subjectId_fkey`;

-- DropIndex
DROP INDEX `quiz_subjectId_fkey` ON `quiz`;

-- AlterTable
ALTER TABLE `quiz` MODIFY `subjectId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `quiz` ADD CONSTRAINT `quiz_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subject`(`idSubject`) ON DELETE SET NULL ON UPDATE CASCADE;
