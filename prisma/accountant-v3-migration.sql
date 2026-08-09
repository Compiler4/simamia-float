-- Optional MySQL reference migration.
-- Prefer Prisma db push/migrate after appending accountant-v3-extension.prisma.
-- No existing table is dropped or altered by this script.

CREATE TABLE IF NOT EXISTS `accountant_attendance_sessions` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `staffId` VARCHAR(191) NOT NULL,
  `attendanceDate` DATE NOT NULL,
  `session` ENUM('MORNING','EVENING') NOT NULL,
  `mark` ENUM('PRESENT','ABSENT','LATE','EXCUSED') NOT NULL DEFAULT 'PRESENT',
  `source` ENUM('ACCOUNTANT_MANUAL','FINGERPRINT','IMPORTED') NOT NULL DEFAULT 'ACCOUNTANT_MANUAL',
  `checkedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `checkedById` VARCHAR(191) NOT NULL,
  `deviceId` VARCHAR(191) NULL,
  `note` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `acc_attendance_company_staff_date_session_key` (`companyId`,`staffId`,`attendanceDate`,`session`),
  KEY `acc_attendance_company_date_idx` (`companyId`,`attendanceDate`),
  KEY `acc_attendance_company_staff_idx` (`companyId`,`staffId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `accountant_fingerprint_devices` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `serialNumber` VARCHAR(191) NOT NULL,
  `locationLabel` VARCHAR(191) NULL,
  `accessTokenHash` VARCHAR(128) NOT NULL,
  `status` ENUM('ACTIVE','INACTIVE','BLOCKED') NOT NULL DEFAULT 'ACTIVE',
  `registeredById` VARCHAR(191) NOT NULL,
  `lastSeenAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `acc_fingerprint_company_serial_key` (`companyId`,`serialNumber`),
  KEY `acc_fingerprint_company_status_idx` (`companyId`,`status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `accountant_fingerprint_enrollments` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `deviceId` VARCHAR(191) NOT NULL,
  `staffId` VARCHAR(191) NOT NULL,
  `templateKey` VARCHAR(191) NOT NULL,
  `enrolledById` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `acc_fingerprint_enrollment_staff_key` (`companyId`,`deviceId`,`staffId`),
  UNIQUE KEY `acc_fingerprint_enrollment_template_key` (`companyId`,`deviceId`,`templateKey`),
  KEY `acc_fingerprint_enrollment_company_staff_idx` (`companyId`,`staffId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `accountant_staff_money_entries` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `staffId` VARCHAR(191) NOT NULL,
  `kind` ENUM('FLOAT','CASH') NOT NULL,
  `direction` ENUM('ALLOCATE','RECEIVE','RETURN','ADJUSTMENT') NOT NULL,
  `amount` DECIMAL(18,2) NOT NULL,
  `reference` VARCHAR(191) NULL,
  `note` TEXT NULL,
  `enteredById` VARCHAR(191) NOT NULL,
  `occurredAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `acc_staff_money_company_date_idx` (`companyId`,`occurredAt`),
  KEY `acc_staff_money_company_staff_idx` (`companyId`,`staffId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `accountant_expense_decisions` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `expenseId` VARCHAR(191) NOT NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `actorRole` VARCHAR(32) NOT NULL,
  `decision` ENUM('PENDING','APPROVE','REJECT') NOT NULL DEFAULT 'PENDING',
  `reason` TEXT NULL,
  `decidedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `acc_expense_company_expense_role_key` (`companyId`,`expenseId`,`actorRole`),
  KEY `acc_expense_company_decision_idx` (`companyId`,`decision`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `accountant_verification_packets` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `staffId` VARCHAR(191) NOT NULL,
  `staffFileId` VARCHAR(191) NULL,
  `kind` ENUM('SMS','PROOF','DOCUMENT','BANK_REFERENCE') NOT NULL,
  `staffMessage` TEXT NULL,
  `staffFileUrl` TEXT NULL,
  `adminReferenceMessage` TEXT NULL,
  `adminReferenceUrl` TEXT NULL,
  `status` ENUM('WAITING_ADMIN_REFERENCE','READY_FOR_ACCOUNTANT','VERIFIED','REJECTED') NOT NULL DEFAULT 'WAITING_ADMIN_REFERENCE',
  `accountantDecisionById` VARCHAR(191) NULL,
  `decisionReason` TEXT NULL,
  `decidedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `acc_verification_staff_file_key` (`staffFileId`),
  KEY `acc_verification_company_status_idx` (`companyId`,`status`),
  KEY `acc_verification_company_staff_idx` (`companyId`,`staffId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `accountant_bank_comparisons` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `depositId` VARCHAR(191) NULL,
  `staffId` VARCHAR(191) NOT NULL,
  `staffAmount` DECIMAL(18,2) NULL,
  `staffReference` VARCHAR(191) NULL,
  `staffDate` DATETIME(3) NULL,
  `staffBankAccount` VARCHAR(191) NULL,
  `staffFileUrl` TEXT NULL,
  `adminAmount` DECIMAL(18,2) NULL,
  `adminReference` VARCHAR(191) NULL,
  `adminDate` DATETIME(3) NULL,
  `adminBankAccount` VARCHAR(191) NULL,
  `adminFileUrl` TEXT NULL,
  `accountantDecision` ENUM('PENDING','APPROVE','REJECT') NOT NULL DEFAULT 'PENDING',
  `mismatchReason` TEXT NULL,
  `reviewedById` VARCHAR(191) NULL,
  `reviewedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `acc_bank_deposit_key` (`depositId`),
  KEY `acc_bank_company_decision_idx` (`companyId`,`accountantDecision`),
  KEY `acc_bank_company_staff_idx` (`companyId`,`staffId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `accountant_report_snapshots` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `reportName` VARCHAR(191) NOT NULL,
  `periodLabel` VARCHAR(191) NOT NULL,
  `filtersJson` JSON NOT NULL,
  `payloadJson` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `acc_report_snapshot_company_date_idx` (`companyId`,`createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
