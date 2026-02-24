-- Drop old unique index name used by earlier migrations
SET @idx_name_legacy = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'AlertLog'
        AND index_name = 'AlertLog_expenseId_ruleType_dayOffset_sentTo_key'
    ),
    'AlertLog_expenseId_ruleType_dayOffset_sentTo_key',
    NULL
  )
);
SET @drop_legacy_sql = IF(
  @idx_name_legacy IS NOT NULL,
  'DROP INDEX `AlertLog_expenseId_ruleType_dayOffset_sentTo_key` ON `AlertLog`',
  'SELECT 1'
);
PREPARE stmt_drop_legacy FROM @drop_legacy_sql;
EXECUTE stmt_drop_legacy;
DEALLOCATE PREPARE stmt_drop_legacy;

-- Drop old unique index name used by current schema naming
SET @idx_name_named = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'AlertLog'
        AND index_name = 'uq_alert_dedup'
    ),
    'uq_alert_dedup',
    NULL
  )
);
SET @drop_named_sql = IF(
  @idx_name_named IS NOT NULL,
  'DROP INDEX `uq_alert_dedup` ON `AlertLog`',
  'SELECT 1'
);
PREPARE stmt_drop_named FROM @drop_named_sql;
EXECUTE stmt_drop_named;
DEALLOCATE PREPARE stmt_drop_named;

-- AlterTable
ALTER TABLE `AlertLog`
    ADD COLUMN `ruleId` BIGINT NULL,
    ADD COLUMN `triggerLocalDate` DATE NULL;

-- Ensure every historical (ruleType, dayOffset) has a corresponding AlertRule row
INSERT INTO `AlertRule` (`ruleType`, `dayOffset`, `isActive`, `createdAt`)
SELECT DISTINCT `al`.`ruleType`, `al`.`dayOffset`, false, NOW(3)
FROM `AlertLog` AS `al`
LEFT JOIN `AlertRule` AS `ar`
    ON `ar`.`ruleType` = `al`.`ruleType`
   AND `ar`.`dayOffset` = `al`.`dayOffset`
WHERE `ar`.`id` IS NULL;

-- Backfill ruleId from AlertRule(ruleType, dayOffset)
UPDATE `AlertLog` AS `al`
INNER JOIN `AlertRule` AS `ar`
    ON `ar`.`ruleType` = `al`.`ruleType`
   AND `ar`.`dayOffset` = `al`.`dayOffset`
SET `al`.`ruleId` = `ar`.`id`
WHERE `al`.`ruleId` IS NULL;

-- Backfill trigger local date using Africa/Harare day (UTC+2)
UPDATE `AlertLog`
SET `triggerLocalDate` = DATE(DATE_ADD(`sentAt`, INTERVAL 2 HOUR))
WHERE `triggerLocalDate` IS NULL;

-- Enforce required columns
ALTER TABLE `AlertLog`
    MODIFY COLUMN `ruleId` BIGINT NOT NULL,
    MODIFY COLUMN `triggerLocalDate` DATE NOT NULL;

-- CreateIndex
CREATE INDEX `AlertLog_ruleId_idx` ON `AlertLog`(`ruleId`);
CREATE INDEX `idx_alert_dedupe_lookup` ON `AlertLog`(`expenseId`, `ruleId`, `triggerLocalDate`, `status`);

-- AddForeignKey
ALTER TABLE `AlertLog`
ADD CONSTRAINT `AlertLog_ruleId_fkey`
FOREIGN KEY (`ruleId`) REFERENCES `AlertRule`(`id`)
ON DELETE RESTRICT ON UPDATE CASCADE;
