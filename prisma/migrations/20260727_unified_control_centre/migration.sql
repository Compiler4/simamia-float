-- Simamia Float unified Company Admin control centre
-- Back up the database before applying this migration.

CREATE TABLE `staff_work_areas` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `staffId` VARCHAR(191) NOT NULL,
  `assignedById` VARCHAR(191) NULL,
  `areaKey` VARCHAR(64) NOT NULL,
  `region` VARCHAR(150) NOT NULL,
  `district` VARCHAR(150) NOT NULL DEFAULT '',
  `ward` VARCHAR(150) NOT NULL DEFAULT '',
  `street` VARCHAR(191) NOT NULL DEFAULT '',
  `areaLabel` VARCHAR(500) NOT NULL,
  `notes` TEXT NULL,
  `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `endedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `staff_work_areas_company_staff_area_key`
    (`companyId`, `staffId`, `areaKey`),
  INDEX `staff_work_areas_company_staff_status_idx`
    (`companyId`, `staffId`, `status`),
  INDEX `staff_work_areas_company_location_idx`
    (`companyId`, `region`, `district`, `ward`),
  INDEX `staff_work_areas_assigned_by_idx` (`assignedById`),
  PRIMARY KEY (`id`),
  CONSTRAINT `staff_work_areas_company_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `staff_work_areas_staff_fkey`
    FOREIGN KEY (`staffId`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `staff_work_areas_creator_fkey`
    FOREIGN KEY (`assignedById`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `company_bank_accounts` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `createdById` VARCHAR(191) NULL,
  `bankName` VARCHAR(150) NOT NULL,
  `bankCode` VARCHAR(40) NULL,
  `accountName` VARCHAR(191) NOT NULL,
  `accountNumber` VARCHAR(100) NOT NULL,
  `branchName` VARCHAR(150) NULL,
  `swiftCode` VARCHAR(40) NULL,
  `currency` VARCHAR(12) NOT NULL DEFAULT 'TZS',
  `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `company_bank_accounts_company_bank_account_key`
    (`companyId`, `bankName`, `accountNumber`),
  INDEX `company_bank_accounts_company_status_bank_idx`
    (`companyId`, `status`, `bankName`),
  INDEX `company_bank_accounts_created_by_idx` (`createdById`),
  PRIMARY KEY (`id`),
  CONSTRAINT `company_bank_accounts_company_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `staff_broker_customer_assignments`
  ADD COLUMN `workAreaId` VARCHAR(191) NULL,
  ADD INDEX `staff_broker_assignments_work_area_status_idx` (`workAreaId`, `status`),
  ADD CONSTRAINT `staff_broker_assignments_work_area_fkey`
    FOREIGN KEY (`workAreaId`) REFERENCES `staff_work_areas` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `verification_packets`
  ADD COLUMN `title` VARCHAR(191) NULL AFTER `companyId`,
  ADD COLUMN `category` VARCHAR(80) NULL AFTER `title`,
  ADD COLUMN `assignedAccountantId` VARCHAR(191) NULL AFTER `staffId`,
  ADD COLUMN `attachmentName` VARCHAR(255) NULL AFTER `attachmentUrl`,
  ADD INDEX `verification_packets_accountant_status_created_idx`
    (`assignedAccountantId`, `status`, `createdAt`);
