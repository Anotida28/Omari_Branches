-- CreateTable
CREATE TABLE `BranchAgentLine` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `branchId` BIGINT NOT NULL,
    `lineNumber` VARCHAR(60) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_branch_line_number`(`branchId`, `lineNumber`),
    INDEX `BranchAgentLine_lineNumber_idx`(`lineNumber`),
    INDEX `BranchAgentLine_branchId_isActive_idx`(`branchId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgentLineMetric` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `agentLineId` BIGINT NOT NULL,
    `metricDate` DATE NOT NULL,
    `cashBalance` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `eFloatBalance` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `cashInVault` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `cashInVolume` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `cashInValue` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `cashOutVolume` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `cashOutValue` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `notes` VARCHAR(500) NULL,
    `createdBy` VARCHAR(120) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_agent_line_date`(`agentLineId`, `metricDate`),
    INDEX `AgentLineMetric_metricDate_idx`(`metricDate`),
    INDEX `AgentLineMetric_agentLineId_metricDate_idx`(`agentLineId`, `metricDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BranchAgentLine` ADD CONSTRAINT `BranchAgentLine_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentLineMetric` ADD CONSTRAINT `AgentLineMetric_agentLineId_fkey` FOREIGN KEY (`agentLineId`) REFERENCES `BranchAgentLine`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
