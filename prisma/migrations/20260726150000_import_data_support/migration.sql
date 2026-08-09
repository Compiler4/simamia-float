-- Simamia Float - import data support for MariaDB/XAMPP.
-- This migration is additive. It does not delete existing records.
-- The Prisma schema remains the source of truth; `prisma db push` runs after deploy.

CREATE TABLE IF NOT EXISTS `data_import_batches` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `sourceType` ENUM('EXCEL_AGENT_MASTER', 'BANK_STATEMENT_PDF') NOT NULL,
  `sourceFileName` VARCHAR(255) NOT NULL,
  `sourceSheetName` VARCHAR(100) NULL,
  `sourceChecksum` VARCHAR(64) NOT NULL,
  `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED') NOT NULL DEFAULT 'COMPLETED',
  `totalRows` INTEGER NOT NULL DEFAULT 0,
  `importedRows` INTEGER NOT NULL DEFAULT 0,
  `skippedRows` INTEGER NOT NULL DEFAULT 0,
  `failedRows` INTEGER NOT NULL DEFAULT 0,
  `notes` TEXT NULL,
  `importedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `data_import_batches_companyId_sourceChecksum_key` (`companyId`, `sourceChecksum`),
  INDEX `data_import_batches_companyId_sourceType_importedAt_idx` (`companyId`, `sourceType`, `importedAt`),
  INDEX `data_import_batches_status_idx` (`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `broker_customers`
  ADD COLUMN IF NOT EXISTS `importBatchId` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `sourceRowNumber` INTEGER NULL,
  ADD COLUMN IF NOT EXISTS `sourceSheetName` VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS `sourceAgentName` VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS `sourceMsisdn` VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS `sourceAliasCode` VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS `normalizedName` VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS `isImported` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS `importedAt` DATETIME(3) NULL;

CREATE TABLE IF NOT EXISTS `broker_agent_accounts` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `brokerCustomerId` VARCHAR(191) NOT NULL,
  `network` ENUM('VODACOM', 'YAS_MIX', 'AIRTEL', 'HALOTEL', 'OTHER') NOT NULL,
  `simPhoneNumber` VARCHAR(32) NOT NULL,
  `agentNumber` VARCHAR(80) NOT NULL,
  `accountName` VARCHAR(191) NULL,
  `isPrimary` BOOLEAN NOT NULL DEFAULT false,
  `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `broker_agent_accounts_companyId_network_agentNumber_key` (`companyId`, `network`, `agentNumber`),
  INDEX `broker_agent_accounts_companyId_network_idx` (`companyId`, `network`),
  INDEX `broker_agent_accounts_brokerCustomerId_status_idx` (`brokerCustomerId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `imported_bank_statements` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `importBatchId` VARCHAR(191) NULL,
  `statementKey` VARCHAR(191) NOT NULL,
  `bankName` VARCHAR(120) NOT NULL,
  `accountName` VARCHAR(191) NOT NULL,
  `branchName` VARCHAR(120) NULL,
  `accountNumber` VARCHAR(64) NOT NULL,
  `currency` VARCHAR(12) NOT NULL DEFAULT 'TZS',
  `periodStart` DATETIME(3) NOT NULL,
  `periodEnd` DATETIME(3) NOT NULL,
  `generatedAt` DATETIME(3) NULL,
  `availableBalance` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `totalCredit` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `totalDebit` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `bookBalance` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `clearedBalance` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `sourceFileName` VARCHAR(255) NOT NULL,
  `sourceChecksum` VARCHAR(64) NULL,
  `importedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `imported_bank_statements_companyId_statementKey_key` (`companyId`, `statementKey`),
  INDEX `imported_bank_statements_companyId_accountNumber_periodStart_idx` (`companyId`, `accountNumber`, `periodStart`),
  INDEX `imported_bank_statements_importBatchId_idx` (`importBatchId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `imported_bank_transactions` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `statementId` VARCHAR(191) NOT NULL,
  `matchedBrokerCustomerId` VARCHAR(191) NULL,
  `reference` VARCHAR(191) NOT NULL,
  `postingDate` DATETIME(3) NOT NULL,
  `valueDate` DATETIME(3) NOT NULL,
  `details` LONGTEXT NOT NULL,
  `direction` ENUM('CREDIT', 'DEBIT') NOT NULL,
  `debit` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `credit` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `bookBalance` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `transactionType` VARCHAR(80) NULL,
  `senderName` VARCHAR(255) NULL,
  `receiverName` VARCHAR(255) NULL,
  `externalAccountReference` VARCHAR(191) NULL,
  `narration` TEXT NULL,
  `matchStatus` ENUM('MATCHED', 'REVIEW_REQUIRED', 'UNMATCHED', 'NOT_APPLICABLE') NOT NULL DEFAULT 'UNMATCHED',
  `matchConfidence` DECIMAL(5,2) NULL,
  `matchNote` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `imported_bank_transactions_companyId_reference_key` (`companyId`, `reference`),
  INDEX `imported_bank_transactions_statementId_postingDate_idx` (`statementId`, `postingDate`),
  INDEX `imported_bank_transactions_companyId_direction_postingDate_idx` (`companyId`, `direction`, `postingDate`),
  INDEX `imported_bank_transactions_companyId_matchStatus_idx` (`companyId`, `matchStatus`),
  INDEX `imported_bank_transactions_matchedBrokerCustomerId_idx` (`matchedBrokerCustomerId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
