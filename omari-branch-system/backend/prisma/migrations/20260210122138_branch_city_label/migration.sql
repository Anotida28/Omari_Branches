/*
  Warnings:

  - You are about to drop the column `status` on the `Branch` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `Branch_status_idx` ON `Branch`;

-- AlterTable
ALTER TABLE `Branch` DROP COLUMN `status`,
    ADD COLUMN `address` VARCHAR(255) NULL,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX `Branch_label_idx` ON `Branch`(`label`);
