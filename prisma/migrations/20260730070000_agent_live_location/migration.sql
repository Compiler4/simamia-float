CREATE TABLE `broker_agent_location_devices` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `brokerCustomerId` VARCHAR(191) NOT NULL,
  `label` VARCHAR(150) NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `status` ENUM('ACTIVE','REVOKED') NOT NULL DEFAULT 'ACTIVE',
  `lastSeenAt` DATETIME(3) NULL,
  `lastLatitude` DOUBLE NULL,
  `lastLongitude` DOUBLE NULL,
  `lastAccuracy` DOUBLE NULL,
  `lastHeading` DOUBLE NULL,
  `lastSpeedKph` DOUBLE NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `broker_agent_location_devices_brokerCustomerId_key`(`brokerCustomerId`),
  UNIQUE INDEX `broker_agent_location_devices_tokenHash_key`(`tokenHash`),
  INDEX `broker_agent_location_devices_companyId_status_lastSeenAt_idx`(`companyId`, `status`, `lastSeenAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `broker_agent_location_pings` (
  `id` VARCHAR(191) NOT NULL,
  `deviceId` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `brokerCustomerId` VARCHAR(191) NOT NULL,
  `latitude` DOUBLE NOT NULL,
  `longitude` DOUBLE NOT NULL,
  `accuracy` DOUBLE NULL,
  `heading` DOUBLE NULL,
  `speedKph` DOUBLE NULL,
  `capturedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `broker_agent_location_pings_deviceId_capturedAt_idx`(`deviceId`, `capturedAt`),
  INDEX `broker_agent_location_pings_companyId_capturedAt_idx`(`companyId`, `capturedAt`),
  INDEX `broker_agent_location_pings_brokerCustomerId_capturedAt_idx`(`brokerCustomerId`, `capturedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `broker_agent_location_devices`
  ADD CONSTRAINT `broker_agent_location_devices_companyId_fkey`
  FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `broker_agent_location_devices_brokerCustomerId_fkey`
  FOREIGN KEY (`brokerCustomerId`) REFERENCES `broker_customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `broker_agent_location_pings`
  ADD CONSTRAINT `broker_agent_location_pings_deviceId_fkey`
  FOREIGN KEY (`deviceId`) REFERENCES `broker_agent_location_devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `broker_agent_location_pings_companyId_fkey`
  FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `broker_agent_location_pings_brokerCustomerId_fkey`
  FOREIGN KEY (`brokerCustomerId`) REFERENCES `broker_customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Remove the invalid 0,0 placeholder so it cannot be displayed in the Gulf of Guinea.
UPDATE `broker_customers`
SET `latitude` = NULL, `longitude` = NULL
WHERE ABS(COALESCE(`latitude`, 0)) < 0.000001
  AND ABS(COALESCE(`longitude`, 0)) < 0.000001;

UPDATE `customers`
SET `latitude` = NULL, `longitude` = NULL
WHERE ABS(COALESCE(`latitude`, 0)) < 0.000001
  AND ABS(COALESCE(`longitude`, 0)) < 0.000001;
