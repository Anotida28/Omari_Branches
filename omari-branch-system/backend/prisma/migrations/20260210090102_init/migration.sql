-- CreateTable
CREATE TABLE `Branch` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `city` VARCHAR(80) NOT NULL,
    `label` VARCHAR(80) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Branch_status_idx`(`status`),
    INDEX `Branch_city_idx`(`city`),
    UNIQUE INDEX `Branch_city_label_key`(`city`, `label`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BranchRecipient` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `branchId` BIGINT NOT NULL,
    `email` VARCHAR(190) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BranchRecipient_email_idx`(`email`),
    UNIQUE INDEX `BranchRecipient_branchId_email_key`(`branchId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BranchMetric` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `branchId` BIGINT NOT NULL,
    `metricDate` DATE NOT NULL,
    `cashBalance` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `cashInVolume` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `cashInValue` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `cashOutVolume` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `cashOutValue` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `notes` VARCHAR(500) NULL,
    `createdBy` VARCHAR(120) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BranchMetric_metricDate_idx`(`metricDate`),
    INDEX `BranchMetric_branchId_metricDate_idx`(`branchId`, `metricDate`),
    UNIQUE INDEX `BranchMetric_branchId_metricDate_key`(`branchId`, `metricDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Expense` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `branchId` BIGINT NOT NULL,
    `expenseType` ENUM('RENT', 'ZESA', 'WIFI', 'OTHER') NOT NULL,
    `period` CHAR(7) NOT NULL,
    `dueDate` DATE NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'USD',
    `status` ENUM('PENDING', 'PAID', 'OVERDUE') NOT NULL DEFAULT 'PENDING',
    `vendor` VARCHAR(120) NULL,
    `notes` VARCHAR(500) NULL,
    `createdBy` VARCHAR(120) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Expense_branchId_period_idx`(`branchId`, `period`),
    INDEX `Expense_dueDate_status_idx`(`dueDate`, `status`),
    INDEX `Expense_status_idx`(`status`),
    INDEX `Expense_expenseType_idx`(`expenseType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `expenseId` BIGINT NOT NULL,
    `paidDate` DATE NOT NULL,
    `amountPaid` DECIMAL(18, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'USD',
    `reference` VARCHAR(120) NULL,
    `notes` VARCHAR(300) NULL,
    `createdBy` VARCHAR(120) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Payment_expenseId_idx`(`expenseId`),
    INDEX `Payment_paidDate_idx`(`paidDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Document` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `docType` ENUM('INVOICE', 'RECEIPT', 'OTHER') NOT NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `filePath` VARCHAR(500) NOT NULL,
    `mimeType` VARCHAR(100) NULL,
    `fileSize` BIGINT NULL,
    `expenseId` BIGINT NULL,
    `paymentId` BIGINT NULL,
    `metricId` BIGINT NULL,
    `uploadedBy` VARCHAR(120) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Document_expenseId_idx`(`expenseId`),
    INDEX `Document_paymentId_idx`(`paymentId`),
    INDEX `Document_metricId_idx`(`metricId`),
    INDEX `Document_docType_idx`(`docType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AlertRule` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `ruleType` ENUM('DUE_REMINDER', 'OVERDUE_ESCALATION') NOT NULL,
    `dayOffset` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AlertRule_ruleType_dayOffset_key`(`ruleType`, `dayOffset`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AlertLog` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `expenseId` BIGINT NOT NULL,
    `ruleType` ENUM('DUE_REMINDER', 'OVERDUE_ESCALATION') NOT NULL,
    `dayOffset` INTEGER NOT NULL,
    `sentTo` VARCHAR(190) NOT NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('SENT', 'FAILED') NOT NULL DEFAULT 'SENT',
    `errorMessage` VARCHAR(500) NULL,

    INDEX `AlertLog_expenseId_idx`(`expenseId`),
    INDEX `AlertLog_sentAt_idx`(`sentAt`),
    UNIQUE INDEX `AlertLog_expenseId_ruleType_dayOffset_sentTo_key`(`expenseId`, `ruleType`, `dayOffset`, `sentTo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BranchRecipient` ADD CONSTRAINT `BranchRecipient_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BranchMetric` ADD CONSTRAINT `BranchMetric_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_expenseId_fkey` FOREIGN KEY (`expenseId`) REFERENCES `Expense`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `fk_document_expense` FOREIGN KEY (`expenseId`) REFERENCES `Expense`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `fk_document_payment` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `fk_document_metric` FOREIGN KEY (`metricId`) REFERENCES `BranchMetric`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AlertLog` ADD CONSTRAINT `AlertLog_expenseId_fkey` FOREIGN KEY (`expenseId`) REFERENCES `Expense`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
