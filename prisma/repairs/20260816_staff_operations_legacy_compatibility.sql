-- SIMAMIA Staff operations compatibility repair.
-- Additive only: no DROP, TRUNCATE or DELETE statements.

ALTER TABLE `staff_funding_receipts` ADD COLUMN IF NOT EXISTS `receiptUrl` VARCHAR(600) NULL;
ALTER TABLE `staff_funding_receipts` ADD COLUMN IF NOT EXISTS `verifiedById` VARCHAR(191) NULL;
ALTER TABLE `staff_funding_receipts` ADD COLUMN IF NOT EXISTS `verifiedAt` DATETIME(3) NULL;

ALTER TABLE `expenses` ADD COLUMN IF NOT EXISTS `createdById` VARCHAR(191) NULL;
ALTER TABLE `expenses` ADD COLUMN IF NOT EXISTS `expenseDate` DATETIME(3) NULL;
ALTER TABLE `expenses` ADD COLUMN IF NOT EXISTS `otherCategory` VARCHAR(191) NULL;
ALTER TABLE `expenses` ADD COLUMN IF NOT EXISTS `requestMode` VARCHAR(80) NOT NULL DEFAULT 'REIMBURSEMENT';
ALTER TABLE `expenses` ADD COLUMN IF NOT EXISTS `requestedAction` TEXT NULL;
ALTER TABLE `expenses` ADD COLUMN IF NOT EXISTS `reviewNote` TEXT NULL;
UPDATE `expenses`
SET `expenseDate` = COALESCE(`createdAt`, CURRENT_TIMESTAMP(3))
WHERE `expenseDate` IS NULL;

ALTER TABLE `staff_proof_submissions` ADD COLUMN IF NOT EXISTS `documentUrl` VARCHAR(600) NULL;

ALTER TABLE `broker_service_visits` ADD COLUMN IF NOT EXISTS `serviceDay` DATETIME(3) NULL;
ALTER TABLE `broker_service_visits` ADD COLUMN IF NOT EXISTS `locationName` VARCHAR(255) NULL;
ALTER TABLE `broker_service_visits` ADD COLUMN IF NOT EXISTS `proofUrl` VARCHAR(500) NULL;
ALTER TABLE `broker_service_visits` ADD COLUMN IF NOT EXISTS `notes` TEXT NULL;
UPDATE `broker_service_visits`
SET `serviceDay` = COALESCE(`serviceProvidedAt`, `startedAt`, `createdAt`, CURRENT_TIMESTAMP(3))
WHERE `serviceDay` IS NULL;
UPDATE `broker_service_visits`
SET `serviceType` = 'GPS_VISIT_UPDATE'
WHERE `serviceType` IS NULL OR TRIM(`serviceType`) = '';

ALTER TABLE `attendance` ADD COLUMN IF NOT EXISTS `overallStatus` VARCHAR(40) NULL;

ALTER TABLE `staff_work_areas` ADD COLUMN IF NOT EXISTS `name` VARCHAR(191) NULL;
ALTER TABLE `staff_work_areas` ADD COLUMN IF NOT EXISTS `centreLatitude` DOUBLE NULL;
ALTER TABLE `staff_work_areas` ADD COLUMN IF NOT EXISTS `centreLongitude` DOUBLE NULL;
ALTER TABLE `staff_work_areas` ADD COLUMN IF NOT EXISTS `radiusMeters` INT NULL;
ALTER TABLE `staff_work_areas` ADD COLUMN IF NOT EXISTS `polygonJson` LONGTEXT NULL;
UPDATE `staff_work_areas`
SET `name` = COALESCE(NULLIF(`areaLabel`, ''), NULLIF(`region`, ''), 'Assigned work area')
WHERE `name` IS NULL OR TRIM(`name`) = '';

ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `usernameChangedAt` DATETIME(3) NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `passwordChangedAt` DATETIME(3) NULL;
