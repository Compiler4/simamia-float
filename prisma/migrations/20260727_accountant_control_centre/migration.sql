ALTER TABLE `attendance`
  ADD COLUMN `morningStatus` ENUM('PRESENT','LATE','ABSENT','ON_LEAVE','HOLIDAY','SUSPENDED') NULL,
  ADD COLUMN `eveningStatus` ENUM('PRESENT','LATE','ABSENT','ON_LEAVE','HOLIDAY','SUSPENDED') NULL,
  ADD COLUMN `morningSource` VARCHAR(80) NULL,
  ADD COLUMN `eveningSource` VARCHAR(80) NULL,
  ADD COLUMN `markedById` VARCHAR(191) NULL,
  ADD COLUMN `verifiedById` VARCHAR(191) NULL,
  ADD COLUMN `verifiedAt` DATETIME(3) NULL,
  ADD COLUMN `deviceId` VARCHAR(191) NULL,
  ADD INDEX `attendance_companyId_date_idx` (`companyId`, `date`);

CREATE TABLE `attendance_devices` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `serialNumber` VARCHAR(191) NOT NULL,
  `location` VARCHAR(191) NULL,
  `vendor` VARCHAR(120) NULL,
  `apiKeyHash` VARCHAR(64) NOT NULL,
  `status` ENUM('ACTIVE','INACTIVE','REVOKED') NOT NULL DEFAULT 'ACTIVE',
  `registeredById` VARCHAR(191) NOT NULL,
  `lastSeenAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `attendance_devices_companyId_serialNumber_key` (`companyId`, `serialNumber`),
  INDEX `attendance_devices_companyId_status_idx` (`companyId`, `status`),
  INDEX `attendance_devices_apiKeyHash_idx` (`apiKeyHash`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `attendance_device_enrollments` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `deviceId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `externalUserCode` VARCHAR(191) NOT NULL,
  `fingerLabel` VARCHAR(80) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `enrolledById` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `attendance_device_enrollments_deviceId_externalUserCode_key` (`deviceId`, `externalUserCode`),
  UNIQUE INDEX `attendance_device_enrollments_deviceId_userId_key` (`deviceId`, `userId`),
  INDEX `attendance_device_enrollments_companyId_userId_isActive_idx` (`companyId`, `userId`, `isActive`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `attendance_punches` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `deviceId` VARCHAR(191) NOT NULL,
  `enrollmentId` VARCHAR(191) NULL,
  `userId` VARCHAR(191) NULL,
  `externalUserCode` VARCHAR(191) NOT NULL,
  `session` ENUM('MORNING','EVENING') NOT NULL,
  `occurredAt` DATETIME(3) NOT NULL,
  `status` ENUM('ACCEPTED','REJECTED','REVIEW_REQUIRED') NOT NULL DEFAULT 'ACCEPTED',
  `message` TEXT NULL,
  `rawPayloadJson` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `attendance_punches_companyId_occurredAt_idx` (`companyId`, `occurredAt`),
  INDEX `attendance_punches_deviceId_occurredAt_idx` (`deviceId`, `occurredAt`),
  INDEX `attendance_punches_userId_occurredAt_idx` (`userId`, `occurredAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `verification_packets` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `targetType` ENUM('STAFF_PROOF','BANK_DEPOSIT','EXPENSE','OTHER') NOT NULL,
  `targetId` VARCHAR(191) NOT NULL,
  `staffId` VARCHAR(191) NULL,
  `sentByAdminId` VARCHAR(191) NOT NULL,
  `sentByAdminName` VARCHAR(191) NOT NULL,
  `message` TEXT NOT NULL,
  `attachmentUrl` VARCHAR(600) NULL,
  `status` ENUM('PENDING','VERIFIED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `reviewedByAccountantId` VARCHAR(191) NULL,
  `reviewReason` TEXT NULL,
  `reviewedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `verification_packets_companyId_targetType_targetId_idx` (`companyId`, `targetType`, `targetId`),
  INDEX `verification_packets_companyId_status_createdAt_idx` (`companyId`, `status`, `createdAt`),
  INDEX `verification_packets_staffId_createdAt_idx` (`staffId`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
