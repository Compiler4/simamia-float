-- CreateTable
CREATE TABLE `companies` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `companies_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branches` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `region` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `branches_companyId_idx`(`companyId`),
    UNIQUE INDEX `branches_companyId_code_key`(`companyId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `branchId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `passwordHash` TEXT NOT NULL,
    `role` ENUM('SYSTEM_DEVELOPER', 'SUPER_ADMIN', 'COMPANY_ADMIN', 'ACCOUNTANT', 'STAFF', 'BROKER', 'GPS_MANAGER') NOT NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED', 'REMOVED') NOT NULL DEFAULT 'ACTIVE',
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_companyId_idx`(`companyId`),
    INDEX `users_branchId_idx`(`branchId`),
    INDEX `users_role_idx`(`role`),
    INDEX `users_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `plan` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `subscriptions_companyId_idx`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `financial_days` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `openingBalance` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `cashIn` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `cashOut` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `closingBalance` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `status` ENUM('OPEN', 'CLOSED', 'BLOCKED') NOT NULL DEFAULT 'OPEN',
    `blockedReason` TEXT NULL,
    `openedById` VARCHAR(191) NULL,
    `closedById` VARCHAR(191) NULL,
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `financial_days_companyId_idx`(`companyId`),
    UNIQUE INDEX `financial_days_companyId_date_key`(`companyId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `status` ENUM('PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE', 'HOLIDAY', 'SUSPENDED') NOT NULL DEFAULT 'PRESENT',
    `checkInAt` DATETIME(3) NULL,
    `checkOutAt` DATETIME(3) NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'SYSTEM_ACTIVITY',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `attendance_companyId_idx`(`companyId`),
    INDEX `attendance_status_idx`(`status`),
    UNIQUE INDEX `attendance_userId_date_key`(`userId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expenses` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `reviewedById` VARCHAR(191) NULL,
    `category` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `description` TEXT NULL,
    `receiptUrl` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `expenses_companyId_idx`(`companyId`),
    INDEX `expenses_employeeId_idx`(`employeeId`),
    INDEX `expenses_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bank_deposits` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `staffId` VARCHAR(191) NOT NULL,
    `accountantId` VARCHAR(191) NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `referenceNo` VARCHAR(191) NULL,
    `bankAccount` VARCHAR(191) NULL,
    `depositDate` DATETIME(3) NOT NULL,
    `depositSlipUrl` VARCHAR(191) NULL,
    `bankReceiptUrl` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'VERIFIED', 'AMOUNT_MISMATCH', 'MISSING_RECEIPT', 'DUPLICATE_DEPOSIT', 'MISSING_BANK_RECORD') NOT NULL DEFAULT 'PENDING',
    `mismatchReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `bank_deposits_companyId_idx`(`companyId`),
    INDEX `bank_deposits_staffId_idx`(`staffId`),
    INDEX `bank_deposits_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `float_transactions` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `fromUserId` VARCHAR(191) NULL,
    `toUserId` VARCHAR(191) NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `purpose` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'ISSUED', 'CONFIRMED', 'RETURNED', 'DEPOSITED', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `confirmedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `float_transactions_companyId_idx`(`companyId`),
    INDEX `float_transactions_fromUserId_idx`(`fromUserId`),
    INDEX `float_transactions_toUserId_idx`(`toUserId`),
    INDEX `float_transactions_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_records` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `month` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `totalFloatIssued` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `totalCollections` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `outstandingBalance` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `attendanceRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `depositAccuracyRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `gpsComplianceRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `score` INTEGER NOT NULL DEFAULT 0,
    `rating` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `performance_records_companyId_idx`(`companyId`),
    UNIQUE INDEX `performance_records_userId_month_year_key`(`userId`, `month`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `type` ENUM('INFO', 'SUCCESS', 'WARNING', 'ERROR') NOT NULL DEFAULT 'INFO',
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_companyId_idx`(`companyId`),
    INDEX `notifications_userId_idx`(`userId`),
    INDEX `notifications_isRead_idx`(`isRead`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `details` TEXT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_companyId_idx`(`companyId`),
    INDEX `audit_logs_userId_idx`(`userId`),
    INDEX `audit_logs_module_idx`(`module`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `branches` ADD CONSTRAINT `branches_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_days` ADD CONSTRAINT `financial_days_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_days` ADD CONSTRAINT `financial_days_openedById_fkey` FOREIGN KEY (`openedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_days` ADD CONSTRAINT `financial_days_closedById_fkey` FOREIGN KEY (`closedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance` ADD CONSTRAINT `attendance_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance` ADD CONSTRAINT `attendance_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_deposits` ADD CONSTRAINT `bank_deposits_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_deposits` ADD CONSTRAINT `bank_deposits_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_deposits` ADD CONSTRAINT `bank_deposits_accountantId_fkey` FOREIGN KEY (`accountantId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `float_transactions` ADD CONSTRAINT `float_transactions_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `float_transactions` ADD CONSTRAINT `float_transactions_fromUserId_fkey` FOREIGN KEY (`fromUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `float_transactions` ADD CONSTRAINT `float_transactions_toUserId_fkey` FOREIGN KEY (`toUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_records` ADD CONSTRAINT `performance_records_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_records` ADD CONSTRAINT `performance_records_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
