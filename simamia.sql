-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jul 14, 2026 at 07:12 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `simamia`
--

-- --------------------------------------------------------

--
-- Table structure for table `accounting_periods`
--

CREATE TABLE `accounting_periods` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `periodKey` varchar(191) NOT NULL,
  `label` varchar(191) NOT NULL,
  `startsAt` datetime(3) NOT NULL,
  `endsAt` datetime(3) NOT NULL,
  `status` enum('OPEN','LOCKED') NOT NULL DEFAULT 'OPEN',
  `lockedById` varchar(191) DEFAULT NULL,
  `lockedAt` datetime(3) DEFAULT NULL,
  `unlockedAt` datetime(3) DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `attendance`
--

CREATE TABLE `attendance` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) DEFAULT NULL,
  `userId` varchar(191) NOT NULL,
  `date` datetime(3) NOT NULL,
  `status` enum('PRESENT','LATE','ABSENT','ON_LEAVE','HOLIDAY','SUSPENDED') NOT NULL DEFAULT 'PRESENT',
  `checkInAt` datetime(3) DEFAULT NULL,
  `checkOutAt` datetime(3) DEFAULT NULL,
  `source` varchar(191) NOT NULL DEFAULT 'SYSTEM_ACTIVITY',
  `notes` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `attendance`
--

INSERT INTO `attendance` (`id`, `companyId`, `userId`, `date`, `status`, `checkInAt`, `checkOutAt`, `source`, `notes`, `createdAt`, `updatedAt`) VALUES
('cmrer8fes000bdgjb4lcwwo45', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8djy0006dgjbeb04qa89', '2026-07-09 21:00:00.000', 'PRESENT', '2026-07-10 13:13:03.270', NULL, 'SEED_ACTIVITY', 'Generated from seed data', '2026-07-10 09:50:02.501', '2026-07-10 13:13:03.274'),
('cmrer8fg1000cdgjbqj4ynks4', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8e4r0007dgjb3qztentf', '2026-07-09 21:00:00.000', 'PRESENT', '2026-07-10 13:13:03.341', NULL, 'SEED_ACTIVITY', 'Generated from seed data', '2026-07-10 09:50:02.545', '2026-07-10 13:13:03.344'),
('cmrer8fhr000edgjbx9799wyq', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8f950009dgjbgxut6myd', '2026-07-09 21:00:00.000', 'PRESENT', '2026-07-10 13:13:03.553', NULL, 'SEED_ACTIVITY', 'Generated from seed data', '2026-07-10 09:50:02.607', '2026-07-10 13:13:03.555'),
('cmri0vwc90000e0jbuqxk90sk', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8e4r0007dgjb3qztentf', '2026-07-11 21:00:00.000', 'ABSENT', NULL, NULL, 'AUTOMATIC_NO_ACTIVITY', NULL, '2026-07-12 16:43:32.601', '2026-07-12 17:16:51.923'),
('cmri0vwms0004e0jb4juas32v', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8f950009dgjbgxut6myd', '2026-07-11 21:00:00.000', 'ABSENT', NULL, NULL, 'AUTOMATIC_NO_ACTIVITY', NULL, '2026-07-12 16:43:32.980', '2026-07-12 17:16:52.266'),
('cmrjmencp0000mwjby1r25bx3', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8e4r0007dgjb3qztentf', '2026-07-13 09:00:00.000', 'PRESENT', '2026-07-13 19:33:45.511', NULL, 'OPERATIONAL_ACTIVITY', 'FLOAT_RECEIVED | FLOAT_RECEIVED', '2026-07-13 19:33:45.529', '2026-07-13 19:33:58.752'),
('cmrkpk7dt0001xgjb0y5ict36', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8e4r0007dgjb3qztentf', '2026-07-14 09:00:00.000', 'PRESENT', '2026-07-14 13:49:49.762', NULL, 'OPERATIONAL_ACTIVITY', 'FLOAT_ISSUED', '2026-07-14 13:49:49.793', '2026-07-14 13:49:49.793');

-- --------------------------------------------------------

--
-- Table structure for table `audit_logs`
--

CREATE TABLE `audit_logs` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) DEFAULT NULL,
  `userId` varchar(191) DEFAULT NULL,
  `action` varchar(191) NOT NULL,
  `module` varchar(191) NOT NULL,
  `details` text DEFAULT NULL,
  `ipAddress` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `audit_logs`
--

INSERT INTO `audit_logs` (`id`, `companyId`, `userId`, `action`, `module`, `details`, `ipAddress`, `createdAt`) VALUES
('cmrer8fxi000mdgjbulshyjnn', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8bcg0003dgjbe1lhfyrh', 'DATABASE_SEEDED', 'SYSTEM', 'Initial Simamia Float ERP seed data created successfully.', NULL, '2026-07-10 09:50:03.174'),
('cmrf03znq000074jbgsnfvbei', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8c9w0004dgjbu49viwux', 'COMPANY_UPDATED', 'COMPANY', 'Super Admin updated company Simamia Float Company.', NULL, '2026-07-10 13:58:32.007'),
('cmrf06r6b000174jbbvmppzan', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8c9w0004dgjbu49viwux', 'COMPANY_UPDATED', 'COMPANY', 'Super Admin updated company Simamia Float Company.', NULL, '2026-07-10 14:00:40.979'),
('cmrhqbgp100005sjbr3zp16wn', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8cyz0005dgjbo12u9z84', 'USER_UPDATED', 'COMPANY_ADMIN', 'Company Admin updated user Company Admin.', NULL, '2026-07-12 11:47:43.045'),
('cmri0vwqn0006e0jb022jea2w', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8djy0006dgjbeb04qa89', 'SYNC_AUTOMATIC_ATTENDANCE', 'ATTENDANCE', '3 users evaluated for 2026-07-12.', NULL, '2026-07-12 16:43:33.119'),
('cmri1sgzi000ae0jb0gmx447b', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8djy0006dgjbeb04qa89', 'SYNC_AUTOMATIC_ATTENDANCE', 'ATTENDANCE', '3 users evaluated for 2026-07-12.', NULL, '2026-07-12 17:08:52.350'),
('cmri22rej000ee0jb5p974exn', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8djy0006dgjbeb04qa89', 'SYNC_AUTOMATIC_ATTENDANCE', 'ATTENDANCE', '3 users evaluated for 2026-07-12.', NULL, '2026-07-12 17:16:52.411'),
('cmrjmeo9h0005mwjb2i29w0p5', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8e4r0007dgjb3qztentf', 'CONFIRM_FLOAT_RECEIVED', 'STAFF_FLOAT_PORTAL', 'Confirmed float seed-float-001', NULL, '2026-07-13 19:33:46.709'),
('cmrjmexyk000amwjb14peedqx', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8e4r0007dgjb3qztentf', 'CONFIRM_FLOAT_RECEIVED', 'STAFF_FLOAT_PORTAL', 'Confirmed float cmrer8fii000fdgjb3cfjb32f', NULL, '2026-07-13 19:33:59.276'),
('cmrjn0uzi000emwjbe36w6p3r', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8c9w0004dgjbu49viwux', 'COMPANY_UPDATED', 'COMPANY', 'Super Admin updated company Simamia Float Company.', NULL, '2026-07-13 19:51:01.854'),
('cmrjn10ex000fmwjba8w8s2m1', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8c9w0004dgjbu49viwux', 'COMPANY_UPDATED', 'COMPANY', 'Super Admin updated company Simamia Float Company.', NULL, '2026-07-13 19:51:08.889'),
('cmrkowwwa00019wjbmwp05b0w', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8e4r0007dgjb3qztentf', 'UPDATE_PROFILE_IMAGE', 'STAFF_PROFILE', 'Profile image changed to StaffFile cmrkowwgc00009wjbnqmp86gl.', NULL, '2026-07-14 13:31:43.114'),
('cmrkpk834000axgjbwjr12nzf', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8e4r0007dgjb3qztentf', 'ISSUE_FLOAT_TO_BROKER', 'STAFF_PORTAL', 'Issued 789 to BrokerCustomer cmrkn26410000j8jbn2f5kaxw using SFB-MRKPK75R-S0OGN0.', NULL, '2026-07-14 13:49:50.704'),
('cmrkpq7o1000cxgjb4msz56gm', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8djy0006dgjbeb04qa89', 'OPEN_FINANCIAL_DAY', 'ACCOUNTING', 'Opened 2026-07-14 with TZS 5900000.00.', NULL, '2026-07-14 13:54:30.097'),
('cmrkqrydw0001acjbcd1nxykf', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8djy0006dgjbeb04qa89', 'ASSIGN_STAFF_FLOAT', 'MANUAL_CASHFLOW', 'Assigned TZS 500000.00 to Staff Float Officer (cmrer8e4r0007dgjb3qztentf) using reference A2S-MRKQRXZY-E4LJX5.', NULL, '2026-07-14 14:23:50.997'),
('seed-audit-log-001', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8bcg0003dgjbe1lhfyrh', 'DATABASE_SEEDED', 'SYSTEM', 'Initial Simamia Float ERP seed data created successfully.', NULL, '2026-07-10 10:08:12.338'),
('seed-audit-log-super-admin-001', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8c9w0004dgjbu49viwux', 'SUPER_ADMIN_DASHBOARD_READY', 'SUPER_ADMIN', 'Super Admin dashboard seed data, notifications and messages created.', NULL, '2026-07-10 13:13:05.308');

-- --------------------------------------------------------

--
-- Table structure for table `bank_deposits`
--

CREATE TABLE `bank_deposits` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `staffId` varchar(191) NOT NULL,
  `accountantId` varchar(191) DEFAULT NULL,
  `amount` decimal(18,2) NOT NULL,
  `referenceNo` varchar(191) DEFAULT NULL,
  `bankAccount` varchar(191) DEFAULT NULL,
  `depositDate` datetime(3) NOT NULL,
  `depositSlipUrl` varchar(191) DEFAULT NULL,
  `bankReceiptUrl` varchar(191) DEFAULT NULL,
  `status` enum('PENDING','VERIFIED','AMOUNT_MISMATCH','MISSING_RECEIPT','DUPLICATE_DEPOSIT','MISSING_BANK_RECORD') NOT NULL DEFAULT 'PENDING',
  `mismatchReason` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `bankStatementUrl` varchar(191) DEFAULT NULL,
  `holdClearedAt` datetime(3) DEFAULT NULL,
  `holdClearedById` varchar(191) DEFAULT NULL,
  `reviewedAt` datetime(3) DEFAULT NULL,
  `comparedAt` datetime(3) DEFAULT NULL,
  `comparisonJson` longtext DEFAULT NULL,
  `holdActive` tinyint(1) NOT NULL DEFAULT 0,
  `statementAmount` decimal(18,2) DEFAULT NULL,
  `statementBankAccount` varchar(191) DEFAULT NULL,
  `statementDate` datetime(3) DEFAULT NULL,
  `statementReference` varchar(191) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `bank_deposits`
--

INSERT INTO `bank_deposits` (`id`, `companyId`, `staffId`, `accountantId`, `amount`, `referenceNo`, `bankAccount`, `depositDate`, `depositSlipUrl`, `bankReceiptUrl`, `status`, `mismatchReason`, `createdAt`, `updatedAt`, `bankStatementUrl`, `holdClearedAt`, `holdClearedById`, `reviewedAt`, `comparedAt`, `comparisonJson`, `holdActive`, `statementAmount`, `statementBankAccount`, `statementDate`, `statementReference`) VALUES
('cmrer8fn5000gdgjbiairgvrq', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8e4r0007dgjb3qztentf', 'cmrer8djy0006dgjbeb04qa89', 750000.00, 'SIM-DEP-001', 'CRDB 015000000001', '2026-07-09 21:00:00.000', NULL, NULL, 'VERIFIED', NULL, '2026-07-10 09:50:02.801', '2026-07-10 09:50:02.801', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL),
('seed-bank-deposit-001', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8e4r0007dgjb3qztentf', 'cmrer8djy0006dgjbeb04qa89', 750000.00, 'SIM-DEP-001', 'CRDB 015000000001', '2026-07-09 21:00:00.000', NULL, NULL, 'VERIFIED', NULL, '2026-07-10 10:08:11.494', '2026-07-10 13:13:03.944', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `branches`
--

CREATE TABLE `branches` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `code` varchar(191) NOT NULL,
  `region` varchar(191) DEFAULT NULL,
  `address` varchar(191) DEFAULT NULL,
  `status` enum('ACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `branches`
--

INSERT INTO `branches` (`id`, `companyId`, `name`, `code`, `region`, `address`, `status`, `createdAt`, `updatedAt`) VALUES
('cmrer8aj00001dgjbc0giqrmj', 'cmrer8af80000dgjb9r9uq1sj', 'Dar es Salaam HQ', 'DSM-HQ', 'Dar es Salaam', 'Dar es Salaam', 'ACTIVE', '2026-07-10 09:49:56.172', '2026-07-10 13:12:59.653'),
('cmrer8akr0002dgjbwhy5ngmh', 'cmrer8af80000dgjb9r9uq1sj', 'Zanzibar Branch', 'ZNZ-01', 'Zanzibar', 'Zanzibar', 'ACTIVE', '2026-07-10 09:49:56.235', '2026-07-10 13:12:59.699');

-- --------------------------------------------------------

--
-- Table structure for table `broker_customers`
--

CREATE TABLE `broker_customers` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `code` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `businessName` varchar(191) DEFAULT NULL,
  `phone` varchar(191) NOT NULL,
  `alternatePhone` varchar(191) DEFAULT NULL,
  `email` varchar(191) DEFAULT NULL,
  `location` varchar(191) NOT NULL,
  `region` varchar(191) DEFAULT NULL,
  `district` varchar(191) DEFAULT NULL,
  `ward` varchar(191) DEFAULT NULL,
  `address` varchar(191) DEFAULT NULL,
  `latitude` double DEFAULT NULL,
  `longitude` double DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  `notes` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `broker_customers`
--

INSERT INTO `broker_customers` (`id`, `companyId`, `code`, `name`, `businessName`, `phone`, `alternatePhone`, `email`, `location`, `region`, `district`, `ward`, `address`, `latitude`, `longitude`, `status`, `notes`, `createdAt`, `updatedAt`) VALUES
('cmrkn26410000j8jbn2f5kaxw', 'cmrer8af80000dgjb9r9uq1sj', 'BRK-32788984-EISX', 'Baraka Nicolaus', 'bpower', '0678543245', '0765434656', 'barakanicolaus4@gmail.com', 'dodoma', 'dodoma', 'nkuhungu', 'chama', 'chama', NULL, NULL, 'ACTIVE', NULL, '2026-07-14 12:39:49.105', '2026-07-14 12:39:49.105');

-- --------------------------------------------------------

--
-- Table structure for table `companies`
--

CREATE TABLE `companies` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `code` varchar(191) NOT NULL,
  `email` varchar(191) DEFAULT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `address` varchar(191) DEFAULT NULL,
  `status` enum('ACTIVE','SUSPENDED','DISABLED') NOT NULL DEFAULT 'ACTIVE',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `companies`
--

INSERT INTO `companies` (`id`, `name`, `code`, `email`, `phone`, `address`, `status`, `createdAt`, `updatedAt`) VALUES
('cmrer8af80000dgjb9r9uq1sj', 'Simamia Float Company', 'SIMAMIA', 'info@simamiafloat.com', '+255700000000', 'Dar es Salaam, Tanzania', 'ACTIVE', '2026-07-10 09:49:56.036', '2026-07-13 19:51:08.828');

-- --------------------------------------------------------

--
-- Table structure for table `company_admin_expenses`
--

CREATE TABLE `company_admin_expenses` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `createdById` varchar(191) NOT NULL,
  `createdByName` varchar(191) NOT NULL,
  `createdByRole` varchar(191) NOT NULL,
  `category` varchar(191) NOT NULL,
  `amount` decimal(18,2) NOT NULL,
  `description` text DEFAULT NULL,
  `expenseDate` datetime(3) NOT NULL,
  `receiptUrl` varchar(191) DEFAULT NULL,
  `status` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `reviewedById` varchar(191) DEFAULT NULL,
  `reviewedByName` varchar(191) DEFAULT NULL,
  `reviewNote` text DEFAULT NULL,
  `reviewedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `company_admin_settings`
--

CREATE TABLE `company_admin_settings` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `sms` tinyint(1) NOT NULL DEFAULT 1,
  `email` tinyint(1) NOT NULL DEFAULT 1,
  `inApp` tinyint(1) NOT NULL DEFAULT 1,
  `gpsAlerts` tinyint(1) NOT NULL DEFAULT 1,
  `dayClosingLock` tinyint(1) NOT NULL DEFAULT 1,
  `attendanceApproval` tinyint(1) NOT NULL DEFAULT 1,
  `bankMismatchHold` tinyint(1) NOT NULL DEFAULT 1,
  `lowCashAlert` tinyint(1) NOT NULL DEFAULT 1,
  `accent` varchar(191) NOT NULL DEFAULT 'TEAL',
  `currency` varchar(191) NOT NULL DEFAULT 'TZS',
  `timezone` varchar(191) NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `company_attendance_journal`
--

CREATE TABLE `company_attendance_journal` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `userId` varchar(191) NOT NULL,
  `userName` varchar(191) NOT NULL,
  `userRole` varchar(191) NOT NULL,
  `attendanceDate` datetime(3) NOT NULL,
  `mark` enum('PRESENT','LATE','ABSENT','LEAVE','HOLIDAY') NOT NULL,
  `checkInAt` datetime(3) DEFAULT NULL,
  `checkOutAt` datetime(3) DEFAULT NULL,
  `source` varchar(191) NOT NULL DEFAULT 'MANUAL',
  `note` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `company_audit_events`
--

CREATE TABLE `company_audit_events` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `actorId` varchar(191) DEFAULT NULL,
  `actorName` varchar(191) NOT NULL,
  `actorRole` varchar(191) NOT NULL,
  `action` varchar(191) NOT NULL,
  `module` varchar(191) NOT NULL,
  `details` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `company_audit_events`
--

INSERT INTO `company_audit_events` (`id`, `companyId`, `actorId`, `actorName`, `actorRole`, `action`, `module`, `details`, `createdAt`) VALUES
('cmrjpbh1j000gmwjbwz5u3eub', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8cyz0005dgjbo12u9z84', 'Company Admin', 'COMPANY_ADMIN', 'DELETE_USER', 'USERS', 'Removed Broker (cmrer8eog0008dgjb6s0uvda0).', '2026-07-13 20:55:16.231'),
('cmrjpbh2b000hmwjbwvz5irlk', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8cyz0005dgjbo12u9z84', 'Company Admin', 'COMPANY_ADMIN', 'DELETE_USER', 'USERS', 'Removed Broker (cmrer8eog0008dgjb6s0uvda0).', '2026-07-13 20:55:16.259');

-- --------------------------------------------------------

--
-- Table structure for table `company_bank_messages`
--

CREATE TABLE `company_bank_messages` (
  `id` varchar(191) NOT NULL,
  `verificationId` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `senderId` varchar(191) NOT NULL,
  `senderName` varchar(191) NOT NULL,
  `senderRole` varchar(191) NOT NULL,
  `message` text NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `company_bank_verifications`
--

CREATE TABLE `company_bank_verifications` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `uploadedById` varchar(191) NOT NULL,
  `uploadedByName` varchar(191) NOT NULL,
  `uploadedByRole` varchar(191) NOT NULL,
  `amount` decimal(18,2) NOT NULL,
  `referenceNumber` varchar(191) NOT NULL,
  `depositDate` datetime(3) NOT NULL,
  `bankAccount` varchar(191) NOT NULL,
  `depositSlipUrl` varchar(191) DEFAULT NULL,
  `bankReceiptUrl` varchar(191) DEFAULT NULL,
  `bankStatementUrl` varchar(191) DEFAULT NULL,
  `status` enum('PENDING','VERIFIED','AMOUNT_MISMATCH','MISSING_RECEIPT','DUPLICATE_DEPOSIT','MISSING_BANK_RECORD','REJECTED') NOT NULL DEFAULT 'PENDING',
  `isSeenByAdmin` tinyint(1) NOT NULL DEFAULT 0,
  `verifiedById` varchar(191) DEFAULT NULL,
  `verifiedByName` varchar(191) DEFAULT NULL,
  `verifiedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `company_gps_devices`
--

CREATE TABLE `company_gps_devices` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `deviceType` varchar(191) NOT NULL,
  `ownerUserId` varchar(191) DEFAULT NULL,
  `ownerName` varchar(191) DEFAULT NULL,
  `deviceToken` varchar(191) NOT NULL,
  `status` enum('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `lastSeenAt` datetime(3) DEFAULT NULL,
  `lastLatitude` double DEFAULT NULL,
  `lastLongitude` double DEFAULT NULL,
  `batteryLevel` int(11) DEFAULT NULL,
  `gpsAccuracy` double DEFAULT NULL,
  `speedKph` double DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `company_gps_devices`
--

INSERT INTO `company_gps_devices` (`id`, `companyId`, `name`, `deviceType`, `ownerUserId`, `ownerName`, `deviceToken`, `status`, `lastSeenAt`, `lastLatitude`, `lastLongitude`, `batteryLevel`, `gpsAccuracy`, `speedKph`, `createdAt`, `updatedAt`) VALUES
('cmrjmmbz1000bmwjbmwig2iat', 'cmrer8af80000dgjb9r9uq1sj', 'Staff browser device', 'WEB_GEOLOCATION', 'cmrer8e4r0007dgjb3qztentf', 'Staff Float Officer', 'a1756877-4258-474c-b262-a8c0cbeb4670', 'ACTIVE', '2026-07-13 19:39:43.259', -6.843656090371535, 39.201894680956684, NULL, 98, NULL, '2026-07-13 19:39:44.029', '2026-07-13 19:39:44.029');

-- --------------------------------------------------------

--
-- Table structure for table `company_gps_pings`
--

CREATE TABLE `company_gps_pings` (
  `id` varchar(191) NOT NULL,
  `deviceId` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `latitude` double NOT NULL,
  `longitude` double NOT NULL,
  `accuracy` double DEFAULT NULL,
  `batteryLevel` int(11) DEFAULT NULL,
  `speedKph` double DEFAULT NULL,
  `capturedAt` datetime(3) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `company_gps_pings`
--

INSERT INTO `company_gps_pings` (`id`, `deviceId`, `companyId`, `latitude`, `longitude`, `accuracy`, `batteryLevel`, `speedKph`, `capturedAt`, `createdAt`) VALUES
('cmrjmmc1e000cmwjbfah464k7', 'cmrjmmbz1000bmwjbmwig2iat', 'cmrer8af80000dgjb9r9uq1sj', -6.843656090371535, 39.201894680956684, 98, NULL, NULL, '2026-07-13 19:39:43.259', '2026-07-13 19:39:44.114');

-- --------------------------------------------------------

--
-- Table structure for table `company_notifications`
--

CREATE TABLE `company_notifications` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `targetUserId` varchar(191) DEFAULT NULL,
  `targetRole` enum('SYSTEM_DEVELOPER','SUPER_ADMIN','COMPANY_ADMIN','ACCOUNTANT','STAFF','BROKER','GPS_MANAGER') DEFAULT NULL,
  `title` varchar(191) NOT NULL,
  `message` text NOT NULL,
  `type` varchar(191) NOT NULL DEFAULT 'INFO',
  `link` varchar(191) DEFAULT NULL,
  `isRead` tinyint(1) NOT NULL DEFAULT 0,
  `readAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `company_settings`
--

CREATE TABLE `company_settings` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `key` varchar(191) NOT NULL,
  `value` text NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `email` varchar(191) DEFAULT NULL,
  `region` varchar(191) DEFAULT NULL,
  `address` varchar(191) DEFAULT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'ACTIVE',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `expenses`
--

CREATE TABLE `expenses` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `employeeId` varchar(191) NOT NULL,
  `reviewedById` varchar(191) DEFAULT NULL,
  `category` varchar(191) NOT NULL,
  `amount` decimal(18,2) NOT NULL,
  `description` text DEFAULT NULL,
  `receiptUrl` varchar(191) DEFAULT NULL,
  `status` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `reviewedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `reviewNote` text DEFAULT NULL,
  `expenseDate` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `expenses`
--

INSERT INTO `expenses` (`id`, `companyId`, `employeeId`, `reviewedById`, `category`, `amount`, `description`, `receiptUrl`, `status`, `reviewedAt`, `createdAt`, `updatedAt`, `reviewNote`, `expenseDate`) VALUES
('cmrer8fre000hdgjbzlzseq0u', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8e4r0007dgjb3qztentf', 'cmrer8djy0006dgjbeb04qa89', 'Transport', 25000.00, 'Transport expense for field float collection', NULL, 'APPROVED', '2026-07-10 09:50:02.951', '2026-07-10 09:50:02.954', '2026-07-10 09:50:02.954', NULL, '2026-07-13 15:06:27.934'),
('seed-expense-001', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8e4r0007dgjb3qztentf', 'cmrer8djy0006dgjbeb04qa89', 'Transport', 25000.00, 'Transport expense for field float collection', NULL, 'APPROVED', '2026-07-10 13:13:04.015', '2026-07-10 10:08:11.812', '2026-07-10 13:13:04.018', NULL, '2026-07-13 15:06:27.934');

-- --------------------------------------------------------

--
-- Table structure for table `financial_days`
--

CREATE TABLE `financial_days` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `date` datetime(3) NOT NULL,
  `openingBalance` decimal(18,2) NOT NULL DEFAULT 0.00,
  `cashIn` decimal(18,2) NOT NULL DEFAULT 0.00,
  `cashOut` decimal(18,2) NOT NULL DEFAULT 0.00,
  `closingBalance` decimal(18,2) NOT NULL DEFAULT 0.00,
  `status` enum('OPEN','CLOSED','BLOCKED') NOT NULL DEFAULT 'OPEN',
  `blockedReason` text DEFAULT NULL,
  `openedById` varchar(191) DEFAULT NULL,
  `closedById` varchar(191) DEFAULT NULL,
  `openedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `closedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `financial_days`
--

INSERT INTO `financial_days` (`id`, `companyId`, `date`, `openingBalance`, `cashIn`, `cashOut`, `closingBalance`, `status`, `blockedReason`, `openedById`, `closedById`, `openedAt`, `closedAt`, `createdAt`, `updatedAt`) VALUES
('cmrer8fdd000adgjbd4r4r6ti', 'cmrer8af80000dgjb9r9uq1sj', '2026-07-09 21:00:00.000', 5000000.00, 1250000.00, 350000.00, 5900000.00, 'OPEN', NULL, 'cmrer8djy0006dgjbeb04qa89', NULL, '2026-07-10 09:50:02.449', NULL, '2026-07-10 09:50:02.449', '2026-07-10 13:13:03.203'),
('cmrkpq7i6000bxgjbdok63ife', 'cmrer8af80000dgjb9r9uq1sj', '2026-07-13 21:00:00.000', 5900000.00, 0.00, 0.00, 5900000.00, 'OPEN', NULL, 'cmrer8djy0006dgjbeb04qa89', NULL, '2026-07-14 13:54:29.882', NULL, '2026-07-14 13:54:29.886', '2026-07-14 13:54:29.886');

-- --------------------------------------------------------

--
-- Table structure for table `float_transactions`
--

CREATE TABLE `float_transactions` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `fromUserId` varchar(191) DEFAULT NULL,
  `toUserId` varchar(191) DEFAULT NULL,
  `amount` decimal(18,2) NOT NULL,
  `purpose` text DEFAULT NULL,
  `status` enum('PENDING','ISSUED','CONFIRMED','RETURNED','DEPOSITED','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `confirmedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `approvedAt` datetime(3) DEFAULT NULL,
  `approvedById` varchar(191) DEFAULT NULL,
  `issuedAt` datetime(3) DEFAULT NULL,
  `lockedAt` datetime(3) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `receiptUrl` varchar(500) DEFAULT NULL,
  `referenceNo` varchar(191) DEFAULT NULL,
  `returnedAmount` decimal(18,2) DEFAULT NULL,
  `returnedAt` datetime(3) DEFAULT NULL,
  `transactionType` enum('ACCOUNTANT_TO_STAFF','STAFF_TO_BROKER','BROKER_RETURN_TO_STAFF','STAFF_RETURN_TO_ACCOUNTANT') NOT NULL DEFAULT 'ACCOUNTANT_TO_STAFF',
  `brokerCustomerId` varchar(191) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `float_transactions`
--

INSERT INTO `float_transactions` (`id`, `companyId`, `fromUserId`, `toUserId`, `amount`, `purpose`, `status`, `confirmedAt`, `createdAt`, `updatedAt`, `approvedAt`, `approvedById`, `issuedAt`, `lockedAt`, `notes`, `receiptUrl`, `referenceNo`, `returnedAmount`, `returnedAt`, `transactionType`, `brokerCustomerId`) VALUES
('cmrer8fii000fdgjb3cfjb32f', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8djy0006dgjbeb04qa89', 'cmrer8e4r0007dgjb3qztentf', 1500000.00, 'Daily staff float issue', 'CONFIRMED', '2026-07-13 19:33:58.113', '2026-07-10 09:50:02.634', '2026-07-13 19:33:58.115', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'ACCOUNTANT_TO_STAFF', NULL),
('cmrkpk76c0000xgjbzupzkvat', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8e4r0007dgjb3qztentf', NULL, 789.00, 'Morning float supply', 'ISSUED', NULL, '2026-07-14 13:49:49.524', '2026-07-14 13:49:49.524', NULL, NULL, '2026-07-14 13:49:49.505', NULL, NULL, NULL, 'SFB-MRKPK75R-S0OGN0', NULL, NULL, 'STAFF_TO_BROKER', 'cmrkn26410000j8jbn2f5kaxw'),
('cmrkqry0t0000acjbd0dhm9jn', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8djy0006dgjbeb04qa89', 'cmrer8e4r0007dgjb3qztentf', 500000.00, 'Morning operational float', 'ISSUED', NULL, '2026-07-14 14:23:50.525', '2026-07-14 14:23:50.525', '2026-07-14 14:23:50.497', 'cmrer8djy0006dgjbeb04qa89', '2026-07-14 06:00:00.000', NULL, 'float', NULL, 'A2S-MRKQRXZY-E4LJX5', NULL, NULL, 'ACCOUNTANT_TO_STAFF', NULL),
('seed-float-001', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8djy0006dgjbeb04qa89', 'cmrer8e4r0007dgjb3qztentf', 1500000.00, 'Daily staff float issue', 'CONFIRMED', '2026-07-13 19:33:45.246', '2026-07-10 10:08:11.311', '2026-07-13 19:33:45.251', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'ACCOUNTANT_TO_STAFF', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `gps_alerts`
--

CREATE TABLE `gps_alerts` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `userId` varchar(191) NOT NULL,
  `deviceId` varchar(191) DEFAULT NULL,
  `type` enum('GPS_DISABLED','EMPLOYEE_OFFLINE','LEFT_ASSIGNED_REGION','OVERSPEED','LONG_IDLE_TIME') NOT NULL,
  `status` enum('OPEN','RESOLVED') NOT NULL DEFAULT 'OPEN',
  `title` varchar(191) NOT NULL,
  `message` text NOT NULL,
  `latitude` double DEFAULT NULL,
  `longitude` double DEFAULT NULL,
  `speedKph` double DEFAULT NULL,
  `dedupeKey` varchar(191) NOT NULL,
  `resolvedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `gps_tracking`
--

CREATE TABLE `gps_tracking` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `userId` varchar(191) DEFAULT NULL,
  `assetType` varchar(191) NOT NULL,
  `assetName` varchar(191) NOT NULL,
  `liveLocation` longtext DEFAULT NULL,
  `speed` decimal(10,2) DEFAULT NULL,
  `stops` int(11) NOT NULL DEFAULT 0,
  `routeHistory` text DEFAULT NULL,
  `distanceTraveled` decimal(10,2) DEFAULT NULL,
  `batteryStatus` varchar(191) DEFAULT NULL,
  `gpsSignal` varchar(191) DEFAULT NULL,
  `geofenceViolations` int(11) NOT NULL DEFAULT 0,
  `alert` varchar(191) DEFAULT NULL,
  `recordedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `accuracy` double DEFAULT NULL,
  `heading` double DEFAULT NULL,
  `latitude` double DEFAULT NULL,
  `longitude` double DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `gps_tracking`
--

INSERT INTO `gps_tracking` (`id`, `companyId`, `userId`, `assetType`, `assetName`, `liveLocation`, `speed`, `stops`, `routeHistory`, `distanceTraveled`, `batteryStatus`, `gpsSignal`, `geofenceViolations`, `alert`, `recordedAt`, `createdAt`, `updatedAt`, `accuracy`, `heading`, `latitude`, `longitude`) VALUES
('cmrjmmc1f000dmwjbdv7yi3cs', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8e4r0007dgjb3qztentf', 'STAFF_DEVICE', 'Staff browser device', '{\"latitude\":-6.843656090371535,\"longitude\":39.201894680956684,\"accuracy\":98,\"heading\":null}', NULL, 0, NULL, NULL, NULL, 'WEAK', 0, NULL, '2026-07-13 19:39:43.259', '2026-07-13 19:39:44.115', '2026-07-13 19:39:44.115', 98, NULL, -6.843656090371535, 39.201894680956684);

-- --------------------------------------------------------

--
-- Table structure for table `messages`
--

CREATE TABLE `messages` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) DEFAULT NULL,
  `senderId` varchar(191) NOT NULL,
  `receiverId` varchar(191) NOT NULL,
  `subject` varchar(191) NOT NULL,
  `body` text NOT NULL,
  `isRead` tinyint(1) NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `messages`
--

INSERT INTO `messages` (`id`, `companyId`, `senderId`, `receiverId`, `subject`, `body`, `isRead`, `createdAt`) VALUES
('seed-message-super-admin-001', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8cyz0005dgjbo12u9z84', 'cmrer8c9w0004dgjbu49viwux', 'Company activation request', 'Please review Simamia Float Company subscription and confirm activation.', 1, '2026-07-10 13:13:04.983'),
('seed-message-super-admin-002', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8djy0006dgjbeb04qa89', 'cmrer8c9w0004dgjbu49viwux', 'Financial report ready', 'Today financial summary is available for global review.', 1, '2026-07-10 13:13:05.135');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) DEFAULT NULL,
  `userId` varchar(191) NOT NULL,
  `title` varchar(191) NOT NULL,
  `message` text NOT NULL,
  `type` enum('INFO','SUCCESS','WARNING','ERROR') NOT NULL DEFAULT 'INFO',
  `isRead` tinyint(1) NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `companyId`, `userId`, `title`, `message`, `type`, `isRead`, `createdAt`) VALUES
('cmrer8fvv000jdgjbtz9i38ck', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8cyz0005dgjbo12u9z84', 'Company setup completed', 'Simamia Float Company has been created and activated.', 'SUCCESS', 0, '2026-07-10 09:50:03.115'),
('cmrer8fvv000kdgjbaqgti10l', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8djy0006dgjbeb04qa89', 'Financial day opened', 'Today financial day is open and ready for transactions.', 'INFO', 1, '2026-07-10 09:50:03.115'),
('cmrer8fvv000ldgjbae43nwpl', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8e4r0007dgjb3qztentf', 'Float issued', 'Daily staff float has been issued by Accountant.', 'SUCCESS', 1, '2026-07-10 09:50:03.115'),
('cmri0vwh30001e0jbeea2rn6u', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8e4r0007dgjb3qztentf', 'Attendance warning', 'Automatic attendance marked you absent for 2026-07-12.', 'WARNING', 1, '2026-07-12 16:43:32.775'),
('cmri0vwo90005e0jb5c0621vr', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8f950009dgjbgxut6myd', 'Attendance warning', 'Automatic attendance marked you absent for 2026-07-12.', 'WARNING', 0, '2026-07-12 16:43:33.033'),
('cmri1sgsb0007e0jbyuap4xqe', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8e4r0007dgjb3qztentf', 'Attendance warning', 'Automatic attendance marked you absent for 2026-07-12.', 'WARNING', 1, '2026-07-12 17:08:52.091'),
('cmri1sgx20009e0jbzto1m1eq', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8f950009dgjbgxut6myd', 'Attendance warning', 'Automatic attendance marked you absent for 2026-07-12.', 'WARNING', 0, '2026-07-12 17:08:52.262'),
('cmri22r2x000be0jbmtetzgud', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8e4r0007dgjb3qztentf', 'Attendance warning', 'Automatic attendance marked you absent for 2026-07-12.', 'WARNING', 1, '2026-07-12 17:16:51.993'),
('cmri22rbp000de0jbyrz23mhm', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8f950009dgjbgxut6myd', 'Attendance warning', 'Automatic attendance marked you absent for 2026-07-12.', 'WARNING', 0, '2026-07-12 17:16:52.309'),
('cmrjmensf0001mwjb9c5coaxg', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8djy0006dgjbeb04qa89', 'Float confirmed', 'Staff Float Officer confirmed receipt of TZS 1,500,000.', 'SUCCESS', 1, '2026-07-13 19:33:46.095'),
('cmrjmexn60006mwjbru1k4cql', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8djy0006dgjbeb04qa89', 'Float confirmed', 'Staff Float Officer confirmed receipt of TZS 1,500,000.', 'SUCCESS', 1, '2026-07-13 19:33:58.866'),
('cmrkpk7fw0002xgjbs4jd5tb0', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8cyz0005dgjbo12u9z84', 'Float issued to registered broker', 'Staff Float Officer issued TZS 789 to Baraka Nicolaus.', 'INFO', 0, '2026-07-14 13:49:49.868'),
('cmrkpk7fy0003xgjbnuyq7z9e', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8djy0006dgjbeb04qa89', 'Float issued to registered broker', 'Staff Float Officer issued TZS 789 to Baraka Nicolaus.', 'INFO', 1, '2026-07-14 13:49:49.870'),
('cmrkpq7qg000dxgjbmopsofkj', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8cyz0005dgjbo12u9z84', 'Financial day opened', 'Accountant opened the financial day for 2026-07-14.', 'SUCCESS', 0, '2026-07-14 13:54:30.184'),
('cmrkqrye20002acjb83v4pzyl', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8e4r0007dgjb3qztentf', 'Operational float assigned', 'Accountant assigned TZS 500,000 to you. Reference: A2S-MRKQRXZY-E4LJX5. Confirm receipt from the Staff Portal.', 'INFO', 1, '2026-07-14 14:23:51.003'),
('seed-notification-accountant-001', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8djy0006dgjbeb04qa89', 'Financial day opened', 'Today financial day is open and ready for transactions.', 'INFO', 1, '2026-07-10 10:08:12.132'),
('seed-notification-company-admin-001', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8cyz0005dgjbo12u9z84', 'Company setup completed', 'Simamia Float Company has been created and activated.', 'SUCCESS', 0, '2026-07-10 10:08:12.067'),
('seed-notification-staff-001', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8e4r0007dgjb3qztentf', 'Float issued', 'Daily staff float has been issued by Accountant.', 'SUCCESS', 1, '2026-07-10 10:08:12.257'),
('seed-notification-super-admin-001', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8c9w0004dgjbu49viwux', 'New company activated', 'Simamia Float Company is active and ready for management.', 'SUCCESS', 1, '2026-07-10 13:13:04.187'),
('seed-notification-super-admin-002', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8c9w0004dgjbu49viwux', 'Subscription created', 'Enterprise subscription has been created for Simamia Float Company.', 'INFO', 1, '2026-07-10 13:13:04.631');

-- --------------------------------------------------------

--
-- Table structure for table `notification_deliveries`
--

CREATE TABLE `notification_deliveries` (
  `id` varchar(191) NOT NULL,
  `notificationId` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `userId` varchar(191) NOT NULL,
  `channel` enum('IN_APP','EMAIL','SMS') NOT NULL,
  `status` enum('QUEUED','SENT','FAILED') NOT NULL DEFAULT 'QUEUED',
  `endpoint` varchar(255) DEFAULT NULL,
  `providerResponse` text DEFAULT NULL,
  `attempts` int(11) NOT NULL DEFAULT 0,
  `sentAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `notification_deliveries`
--

INSERT INTO `notification_deliveries` (`id`, `notificationId`, `companyId`, `userId`, `channel`, `status`, `endpoint`, `providerResponse`, `attempts`, `sentAt`, `createdAt`, `updatedAt`) VALUES
('cmrjmenxi0002mwjb45bj07lr', 'cmrjmensf0001mwjb9c5coaxg', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8djy0006dgjbeb04qa89', 'IN_APP', 'SENT', NULL, NULL, 0, '2026-07-13 19:33:46.275', '2026-07-13 19:33:46.278', '2026-07-13 19:33:46.278'),
('cmrjmeo3m0003mwjbg8yzto5p', 'cmrjmensf0001mwjb9c5coaxg', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8djy0006dgjbeb04qa89', 'EMAIL', 'QUEUED', NULL, NULL, 0, NULL, '2026-07-13 19:33:46.498', '2026-07-13 19:33:46.498'),
('cmrjmeo7x0004mwjb1kucce22', 'cmrjmensf0001mwjb9c5coaxg', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8djy0006dgjbeb04qa89', 'SMS', 'QUEUED', NULL, NULL, 0, NULL, '2026-07-13 19:33:46.653', '2026-07-13 19:33:46.653'),
('cmrjmexpc0007mwjbhfjno8uf', 'cmrjmexn60006mwjbru1k4cql', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8djy0006dgjbeb04qa89', 'IN_APP', 'SENT', NULL, NULL, 0, '2026-07-13 19:33:58.942', '2026-07-13 19:33:58.944', '2026-07-13 19:33:58.944'),
('cmrjmexvs0008mwjby0li6xns', 'cmrjmexn60006mwjbru1k4cql', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8djy0006dgjbeb04qa89', 'EMAIL', 'QUEUED', NULL, NULL, 0, NULL, '2026-07-13 19:33:59.176', '2026-07-13 19:33:59.176'),
('cmrjmexxz0009mwjbtmmnjis4', 'cmrjmexn60006mwjbru1k4cql', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8djy0006dgjbeb04qa89', 'SMS', 'QUEUED', NULL, NULL, 0, NULL, '2026-07-13 19:33:59.255', '2026-07-13 19:33:59.255'),
('cmrkpk7il0004xgjbxkivo8fd', 'cmrkpk7fw0002xgjbs4jd5tb0', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8cyz0005dgjbo12u9z84', 'IN_APP', 'SENT', NULL, NULL, 0, '2026-07-14 13:49:49.960', '2026-07-14 13:49:49.965', '2026-07-14 13:49:49.965'),
('cmrkpk7j00005xgjb2he1hza2', 'cmrkpk7fy0003xgjbnuyq7z9e', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8djy0006dgjbeb04qa89', 'IN_APP', 'SENT', NULL, NULL, 0, '2026-07-14 13:49:49.978', '2026-07-14 13:49:49.980', '2026-07-14 13:49:49.980'),
('cmrkpk7v20006xgjbdzz4fqxj', 'cmrkpk7fw0002xgjbs4jd5tb0', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8cyz0005dgjbo12u9z84', 'EMAIL', 'QUEUED', NULL, NULL, 0, NULL, '2026-07-14 13:49:50.414', '2026-07-14 13:49:50.414'),
('cmrkpk7x70007xgjb666t3xde', 'cmrkpk7fy0003xgjbnuyq7z9e', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8djy0006dgjbeb04qa89', 'EMAIL', 'QUEUED', NULL, NULL, 0, NULL, '2026-07-14 13:49:50.491', '2026-07-14 13:49:50.491'),
('cmrkpk80b0008xgjbkb652l6c', 'cmrkpk7fy0003xgjbnuyq7z9e', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8djy0006dgjbeb04qa89', 'SMS', 'QUEUED', NULL, NULL, 0, NULL, '2026-07-14 13:49:50.604', '2026-07-14 13:49:50.604'),
('cmrkpk81i0009xgjbkzm3jcvo', 'cmrkpk7fw0002xgjbs4jd5tb0', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8cyz0005dgjbo12u9z84', 'SMS', 'QUEUED', NULL, NULL, 0, NULL, '2026-07-14 13:49:50.646', '2026-07-14 13:49:50.646');

-- --------------------------------------------------------

--
-- Table structure for table `performance_records`
--

CREATE TABLE `performance_records` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `userId` varchar(191) NOT NULL,
  `month` int(11) NOT NULL,
  `year` int(11) NOT NULL,
  `totalFloatIssued` decimal(18,2) NOT NULL DEFAULT 0.00,
  `totalCollections` decimal(18,2) NOT NULL DEFAULT 0.00,
  `outstandingBalance` decimal(18,2) NOT NULL DEFAULT 0.00,
  `attendanceRate` decimal(5,2) NOT NULL DEFAULT 0.00,
  `depositAccuracyRate` decimal(5,2) NOT NULL DEFAULT 0.00,
  `gpsComplianceRate` decimal(5,2) NOT NULL DEFAULT 0.00,
  `score` int(11) NOT NULL DEFAULT 0,
  `rating` varchar(191) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `approvalComplianceRate` decimal(5,2) NOT NULL DEFAULT 0.00,
  `averageReturnMinutes` decimal(10,2) NOT NULL DEFAULT 0.00,
  `bankMismatches` int(11) NOT NULL DEFAULT 0,
  `brokerVisits` int(11) NOT NULL DEFAULT 0,
  `customerVisits` int(11) NOT NULL DEFAULT 0,
  `transactionsCompleted` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `performance_records`
--

INSERT INTO `performance_records` (`id`, `companyId`, `userId`, `month`, `year`, `totalFloatIssued`, `totalCollections`, `outstandingBalance`, `attendanceRate`, `depositAccuracyRate`, `gpsComplianceRate`, `score`, `rating`, `createdAt`, `updatedAt`, `approvalComplianceRate`, `averageReturnMinutes`, `bankMismatches`, `brokerVisits`, `customerVisits`, `transactionsCompleted`) VALUES
('cmrer8fug000idgjbn4g7a2rz', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8e4r0007dgjb3qztentf', 7, 2026, 1500000.00, 1250000.00, 250000.00, 96.50, 98.00, 95.00, 88, 'Very Good', '2026-07-10 09:50:03.064', '2026-07-10 13:13:04.096', 0.00, 0.00, 0, 0, 0, 0);

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `sku` varchar(191) DEFAULT NULL,
  `category` varchar(191) DEFAULT NULL,
  `price` decimal(18,2) NOT NULL DEFAULT 0.00,
  `stock` int(11) NOT NULL DEFAULT 0,
  `status` varchar(191) NOT NULL DEFAULT 'ACTIVE',
  `description` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `service_activities`
--

CREATE TABLE `service_activities` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `staffId` varchar(191) NOT NULL,
  `brokerId` varchar(191) DEFAULT NULL,
  `customerId` varchar(191) DEFAULT NULL,
  `serviceType` varchar(191) NOT NULL,
  `amount` decimal(18,2) NOT NULL DEFAULT 0.00,
  `status` varchar(191) NOT NULL DEFAULT 'COMPLETED',
  `servedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `notes` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `latitude` double DEFAULT NULL,
  `locationName` varchar(191) DEFAULT NULL,
  `longitude` double DEFAULT NULL,
  `brokerCustomerId` varchar(191) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `staff_broker_assignments`
--

CREATE TABLE `staff_broker_assignments` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `staffId` varchar(191) NOT NULL,
  `brokerId` varchar(191) NOT NULL,
  `assignedById` varchar(191) DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `startedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `endedAt` datetime(3) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `staff_collections`
--

CREATE TABLE `staff_collections` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `staffId` varchar(191) NOT NULL,
  `brokerId` varchar(191) DEFAULT NULL,
  `reviewedById` varchar(191) DEFAULT NULL,
  `referenceNo` varchar(191) NOT NULL,
  `amount` decimal(18,2) NOT NULL,
  `collectionDate` datetime(3) NOT NULL,
  `description` text DEFAULT NULL,
  `receiptUrl` varchar(500) DEFAULT NULL,
  `status` enum('PENDING','VERIFIED','REJECTED','DEPOSITED') NOT NULL DEFAULT 'PENDING',
  `reviewNote` text DEFAULT NULL,
  `reviewedAt` datetime(3) DEFAULT NULL,
  `depositedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `brokerCustomerId` varchar(191) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `staff_customer_assignments`
--

CREATE TABLE `staff_customer_assignments` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `staffId` varchar(191) NOT NULL,
  `customerId` varchar(191) NOT NULL,
  `assignedById` varchar(191) DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `startedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `endedAt` datetime(3) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `staff_files`
--

CREATE TABLE `staff_files` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `ownerUserId` varchar(191) NOT NULL,
  `kind` enum('PROFILE','RECEIPT','PROOF','EXPENSE','BANK','OTHER') NOT NULL DEFAULT 'OTHER',
  `originalName` varchar(255) NOT NULL,
  `storedName` varchar(255) NOT NULL,
  `mimeType` varchar(120) NOT NULL,
  `sizeBytes` int(11) NOT NULL,
  `storagePath` varchar(600) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `checksumSha256` varchar(64) DEFAULT NULL,
  `compressed` tinyint(1) NOT NULL DEFAULT 0,
  `compressionRatio` double DEFAULT NULL,
  `originalSizeBytes` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `staff_files`
--

INSERT INTO `staff_files` (`id`, `companyId`, `ownerUserId`, `kind`, `originalName`, `storedName`, `mimeType`, `sizeBytes`, `storagePath`, `createdAt`, `checksumSha256`, `compressed`, `compressionRatio`, `originalSizeBytes`) VALUES
('cmrkowwgc00009wjbnqmp86gl', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8e4r0007dgjb3qztentf', 'PROFILE', 'Screenshot 2026-07-14 120154.png', '1784035902478-b6a38d91-a2ba-412c-a3d6-e024f062a5bc.webp', 'image/webp', 4300, 'storage/private/staff/cmrer8af80000dgjb9r9uq1sj/cmrer8e4r0007dgjb3qztentf/1784035902478-b6a38d91-a2ba-412c-a3d6-e024f062a5bc.webp', '2026-07-14 13:31:42.540', '579508b66e7f0ccc8569d4b780bfa892fb59c3c30a36aa965ca8f0a913b6fbcc', 1, 87.88, 35472);

-- --------------------------------------------------------

--
-- Table structure for table `subscriptions`
--

CREATE TABLE `subscriptions` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) NOT NULL,
  `plan` varchar(191) NOT NULL,
  `amount` decimal(18,2) NOT NULL DEFAULT 0.00,
  `startsAt` datetime(3) NOT NULL,
  `endsAt` datetime(3) NOT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `subscriptions`
--

INSERT INTO `subscriptions` (`id`, `companyId`, `plan`, `amount`, `startsAt`, `endsAt`, `isActive`, `createdAt`, `updatedAt`) VALUES
('seed-subscription-simamia', 'cmrer8af80000dgjb9r9uq1sj', 'Enterprise', 2500000.00, '2026-07-10 13:13:03.092', '2027-07-10 13:13:03.092', 1, '2026-07-10 09:50:02.378', '2026-07-10 13:13:03.097');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` varchar(191) NOT NULL,
  `companyId` varchar(191) DEFAULT NULL,
  `branchId` varchar(191) DEFAULT NULL,
  `name` varchar(191) NOT NULL,
  `username` varchar(191) NOT NULL,
  `email` varchar(191) NOT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `passwordHash` text NOT NULL,
  `role` enum('SYSTEM_DEVELOPER','SUPER_ADMIN','COMPANY_ADMIN','ACCOUNTANT','STAFF','BROKER','GPS_MANAGER') NOT NULL,
  `status` enum('ACTIVE','SUSPENDED','REMOVED') NOT NULL DEFAULT 'ACTIVE',
  `lastLoginAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `assignedRegion` varchar(150) DEFAULT NULL,
  `profileImageUrl` varchar(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `companyId`, `branchId`, `name`, `username`, `email`, `phone`, `passwordHash`, `role`, `status`, `lastLoginAt`, `createdAt`, `updatedAt`, `assignedRegion`, `profileImageUrl`) VALUES
('cmrer8bcg0003dgjbe1lhfyrh', NULL, NULL, 'System Developer', 'system_developer', 'developer@simamiafloat.com', NULL, '$2b$12$lM3b/XkrpPiNf6vHT.V0WuagTozB.IVgoJFM2VX2Qbtsa.OAYhIXW', 'SYSTEM_DEVELOPER', 'ACTIVE', '2026-07-10 10:09:23.206', '2026-07-10 09:49:57.233', '2026-07-10 13:13:00.134', NULL, NULL),
('cmrer8c9w0004dgjbu49viwux', NULL, NULL, 'Super Admin', 'super_admin', 'superadmin@simamiafloat.com', NULL, '$2b$12$GwucBWPtrLQiQOBsrUf7ZewJyEPCnFwj6gF90Rq5SFYQvljVdTcfW', 'SUPER_ADMIN', 'ACTIVE', '2026-07-13 20:13:34.363', '2026-07-10 09:49:58.436', '2026-07-13 20:13:34.366', NULL, NULL),
('cmrer8cyz0005dgjbo12u9z84', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8aj00001dgjbc0giqrmj', 'Company Admin', 'company_admin', 'admin@simamiafloat.com', NULL, '$2b$12$nmL4NGUkOn.ZCNiURFYPvOc1CPugR0CIrENnNKgw1JGx9mQvaVmmG', 'COMPANY_ADMIN', 'ACTIVE', '2026-07-14 11:00:23.001', '2026-07-10 09:49:59.339', '2026-07-14 11:00:23.022', NULL, NULL),
('cmrer8djy0006dgjbeb04qa89', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8aj00001dgjbc0giqrmj', 'Accountant', 'accountant', 'accountant@simamiafloat.com', NULL, '$2b$12$q7iHb2VGpam3PWIFVNDgre4yKatBkQfVk7Bpea2FD.knupAJRLeOi', 'ACCOUNTANT', 'ACTIVE', '2026-07-14 13:53:27.623', '2026-07-10 09:50:00.094', '2026-07-14 13:53:27.628', NULL, NULL),
('cmrer8e4r0007dgjb3qztentf', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8aj00001dgjbc0giqrmj', 'Staff Float Officer', 'staff', 'staff@simamiafloat.com', NULL, '$2b$12$cy3jhn1SyinbOKaeftqOgudJp3SQJ0ARo.jv0LNesdjc8SUAM9mOK', 'STAFF', 'ACTIVE', '2026-07-14 14:24:35.574', '2026-07-10 09:50:00.843', '2026-07-14 14:24:35.583', NULL, '/api/staff/files/cmrkowwgc00009wjbnqmp86gl'),
('cmrer8f950009dgjbgxut6myd', 'cmrer8af80000dgjb9r9uq1sj', 'cmrer8aj00001dgjbc0giqrmj', 'GPS Manager', 'gps_manager', 'gps@simamiafloat.com', NULL, '$2b$12$fT2ER1H3X1W..4u5YZ/MSuzqio6EGGMyXMEqDlv/PcdzMjZzW40Ni', 'GPS_MANAGER', 'ACTIVE', NULL, '2026-07-10 09:50:02.297', '2026-07-10 13:13:03.055', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `_prisma_migrations`
--

CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) NOT NULL,
  `checksum` varchar(64) NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) NOT NULL,
  `logs` text DEFAULT NULL,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `applied_steps_count` int(10) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `_prisma_migrations`
--

INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES
('0130f6b2-e0e2-4019-95e2-99720c2efe9f', 'dd28527ef335195a719b190c4756e6a9896c1cc740e34901fb7cfc56c83a9cf3', '2026-07-10 11:07:21.401', '20260710110714_add_messages', NULL, NULL, '2026-07-10 11:07:14.927', 1),
('735c1a1e-8ba8-415d-89dd-de617db977ce', '1853c630b44e6acb701aa52f80097d36a6f41e27e954f7289f34f1d8064a42ef', '2026-07-10 09:44:24.431', '20260710094358_init', NULL, NULL, '2026-07-10 09:43:58.816', 1);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `accounting_periods`
--
ALTER TABLE `accounting_periods`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `accounting_periods_companyId_periodKey_key` (`companyId`,`periodKey`),
  ADD KEY `accounting_periods_companyId_status_idx` (`companyId`,`status`),
  ADD KEY `accounting_periods_lockedById_idx` (`lockedById`);

--
-- Indexes for table `attendance`
--
ALTER TABLE `attendance`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `attendance_userId_date_key` (`userId`,`date`),
  ADD KEY `attendance_companyId_idx` (`companyId`),
  ADD KEY `attendance_status_idx` (`status`);

--
-- Indexes for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `audit_logs_companyId_idx` (`companyId`),
  ADD KEY `audit_logs_userId_idx` (`userId`),
  ADD KEY `audit_logs_module_idx` (`module`);

--
-- Indexes for table `bank_deposits`
--
ALTER TABLE `bank_deposits`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bank_deposits_companyId_idx` (`companyId`),
  ADD KEY `bank_deposits_staffId_idx` (`staffId`),
  ADD KEY `bank_deposits_status_idx` (`status`),
  ADD KEY `bank_deposits_accountantId_fkey` (`accountantId`),
  ADD KEY `bank_deposits_holdClearedById_idx` (`holdClearedById`);

--
-- Indexes for table `branches`
--
ALTER TABLE `branches`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `branches_companyId_code_key` (`companyId`,`code`),
  ADD KEY `branches_companyId_idx` (`companyId`);

--
-- Indexes for table `broker_customers`
--
ALTER TABLE `broker_customers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `broker_customers_companyId_code_key` (`companyId`,`code`),
  ADD KEY `broker_customers_companyId_idx` (`companyId`),
  ADD KEY `broker_customers_companyId_location_idx` (`companyId`,`location`),
  ADD KEY `broker_customers_companyId_status_idx` (`companyId`,`status`),
  ADD KEY `broker_customers_companyId_phone_idx` (`companyId`,`phone`);

--
-- Indexes for table `companies`
--
ALTER TABLE `companies`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `companies_code_key` (`code`);

--
-- Indexes for table `company_admin_expenses`
--
ALTER TABLE `company_admin_expenses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `company_admin_expenses_companyId_expenseDate_idx` (`companyId`,`expenseDate`),
  ADD KEY `company_admin_expenses_companyId_status_idx` (`companyId`,`status`),
  ADD KEY `company_admin_expenses_createdById_idx` (`createdById`),
  ADD KEY `company_admin_expenses_reviewedById_idx` (`reviewedById`);

--
-- Indexes for table `company_admin_settings`
--
ALTER TABLE `company_admin_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `company_admin_settings_companyId_key` (`companyId`);

--
-- Indexes for table `company_attendance_journal`
--
ALTER TABLE `company_attendance_journal`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `company_attendance_journal_companyId_userId_attendanceDate_key` (`companyId`,`userId`,`attendanceDate`),
  ADD KEY `company_attendance_journal_companyId_attendanceDate_idx` (`companyId`,`attendanceDate`),
  ADD KEY `company_attendance_journal_userId_idx` (`userId`),
  ADD KEY `company_attendance_journal_mark_idx` (`mark`);

--
-- Indexes for table `company_audit_events`
--
ALTER TABLE `company_audit_events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `company_audit_events_companyId_createdAt_idx` (`companyId`,`createdAt`),
  ADD KEY `company_audit_events_actorId_idx` (`actorId`),
  ADD KEY `company_audit_events_module_idx` (`module`);

--
-- Indexes for table `company_bank_messages`
--
ALTER TABLE `company_bank_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `company_bank_messages_verificationId_createdAt_idx` (`verificationId`,`createdAt`),
  ADD KEY `company_bank_messages_companyId_idx` (`companyId`),
  ADD KEY `company_bank_messages_senderId_idx` (`senderId`);

--
-- Indexes for table `company_bank_verifications`
--
ALTER TABLE `company_bank_verifications`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `company_bank_verifications_companyId_referenceNumber_key` (`companyId`,`referenceNumber`),
  ADD KEY `company_bank_verifications_companyId_depositDate_idx` (`companyId`,`depositDate`),
  ADD KEY `company_bank_verifications_companyId_status_idx` (`companyId`,`status`),
  ADD KEY `company_bank_verifications_uploadedById_idx` (`uploadedById`),
  ADD KEY `company_bank_verifications_verifiedById_idx` (`verifiedById`);

--
-- Indexes for table `company_gps_devices`
--
ALTER TABLE `company_gps_devices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `company_gps_devices_deviceToken_key` (`deviceToken`),
  ADD KEY `company_gps_devices_companyId_status_idx` (`companyId`,`status`),
  ADD KEY `company_gps_devices_ownerUserId_idx` (`ownerUserId`),
  ADD KEY `company_gps_devices_lastSeenAt_idx` (`lastSeenAt`);

--
-- Indexes for table `company_gps_pings`
--
ALTER TABLE `company_gps_pings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `company_gps_pings_deviceId_capturedAt_idx` (`deviceId`,`capturedAt`),
  ADD KEY `company_gps_pings_companyId_capturedAt_idx` (`companyId`,`capturedAt`);

--
-- Indexes for table `company_notifications`
--
ALTER TABLE `company_notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `company_notifications_companyId_createdAt_idx` (`companyId`,`createdAt`),
  ADD KEY `company_notifications_targetUserId_isRead_idx` (`targetUserId`,`isRead`),
  ADD KEY `company_notifications_targetRole_isRead_idx` (`targetRole`,`isRead`);

--
-- Indexes for table `company_settings`
--
ALTER TABLE `company_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `company_settings_companyId_key_key` (`companyId`,`key`),
  ADD KEY `company_settings_companyId_idx` (`companyId`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `customers_companyId_idx` (`companyId`);

--
-- Indexes for table `expenses`
--
ALTER TABLE `expenses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `expenses_companyId_idx` (`companyId`),
  ADD KEY `expenses_employeeId_idx` (`employeeId`),
  ADD KEY `expenses_status_idx` (`status`),
  ADD KEY `expenses_reviewedById_fkey` (`reviewedById`),
  ADD KEY `expenses_companyId_expenseDate_idx` (`companyId`,`expenseDate`);

--
-- Indexes for table `financial_days`
--
ALTER TABLE `financial_days`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `financial_days_companyId_date_key` (`companyId`,`date`),
  ADD KEY `financial_days_companyId_idx` (`companyId`),
  ADD KEY `financial_days_openedById_fkey` (`openedById`),
  ADD KEY `financial_days_closedById_fkey` (`closedById`);

--
-- Indexes for table `float_transactions`
--
ALTER TABLE `float_transactions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `float_transactions_companyId_referenceNo_key` (`companyId`,`referenceNo`),
  ADD KEY `float_transactions_companyId_idx` (`companyId`),
  ADD KEY `float_transactions_fromUserId_idx` (`fromUserId`),
  ADD KEY `float_transactions_toUserId_idx` (`toUserId`),
  ADD KEY `float_transactions_companyId_transactionType_status_idx` (`companyId`,`transactionType`,`status`),
  ADD KEY `float_transactions_approvedById_idx` (`approvedById`),
  ADD KEY `float_transactions_createdAt_idx` (`createdAt`),
  ADD KEY `float_transactions_brokerCustomerId_idx` (`brokerCustomerId`);

--
-- Indexes for table `gps_alerts`
--
ALTER TABLE `gps_alerts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `gps_alerts_companyId_dedupeKey_key` (`companyId`,`dedupeKey`),
  ADD KEY `gps_alerts_companyId_status_createdAt_idx` (`companyId`,`status`,`createdAt`),
  ADD KEY `gps_alerts_userId_status_idx` (`userId`,`status`),
  ADD KEY `gps_alerts_deviceId_idx` (`deviceId`);

--
-- Indexes for table `gps_tracking`
--
ALTER TABLE `gps_tracking`
  ADD PRIMARY KEY (`id`),
  ADD KEY `gps_tracking_companyId_idx` (`companyId`),
  ADD KEY `gps_tracking_userId_idx` (`userId`);

--
-- Indexes for table `messages`
--
ALTER TABLE `messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `messages_companyId_idx` (`companyId`),
  ADD KEY `messages_senderId_idx` (`senderId`),
  ADD KEY `messages_receiverId_idx` (`receiverId`),
  ADD KEY `messages_isRead_idx` (`isRead`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `notifications_companyId_idx` (`companyId`),
  ADD KEY `notifications_userId_idx` (`userId`),
  ADD KEY `notifications_isRead_idx` (`isRead`);

--
-- Indexes for table `notification_deliveries`
--
ALTER TABLE `notification_deliveries`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `notification_deliveries_notificationId_channel_key` (`notificationId`,`channel`),
  ADD KEY `notification_deliveries_companyId_status_createdAt_idx` (`companyId`,`status`,`createdAt`),
  ADD KEY `notification_deliveries_userId_status_idx` (`userId`,`status`);

--
-- Indexes for table `performance_records`
--
ALTER TABLE `performance_records`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `performance_records_userId_month_year_key` (`userId`,`month`,`year`),
  ADD KEY `performance_records_companyId_idx` (`companyId`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`),
  ADD KEY `products_companyId_idx` (`companyId`);

--
-- Indexes for table `service_activities`
--
ALTER TABLE `service_activities`
  ADD PRIMARY KEY (`id`),
  ADD KEY `service_activities_companyId_idx` (`companyId`),
  ADD KEY `service_activities_staffId_idx` (`staffId`),
  ADD KEY `service_activities_brokerId_idx` (`brokerId`),
  ADD KEY `service_activities_customerId_idx` (`customerId`),
  ADD KEY `service_activities_brokerCustomerId_idx` (`brokerCustomerId`);

--
-- Indexes for table `staff_broker_assignments`
--
ALTER TABLE `staff_broker_assignments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `staff_broker_assignments_companyId_brokerId_key` (`companyId`,`brokerId`),
  ADD KEY `staff_broker_assignments_companyId_staffId_status_idx` (`companyId`,`staffId`,`status`),
  ADD KEY `staff_broker_assignments_companyId_brokerId_status_idx` (`companyId`,`brokerId`,`status`),
  ADD KEY `staff_broker_assignments_staffId_fkey` (`staffId`),
  ADD KEY `staff_broker_assignments_brokerId_fkey` (`brokerId`),
  ADD KEY `staff_broker_assignments_assignedById_fkey` (`assignedById`);

--
-- Indexes for table `staff_collections`
--
ALTER TABLE `staff_collections`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `staff_collections_companyId_referenceNo_key` (`companyId`,`referenceNo`),
  ADD KEY `staff_collections_companyId_collectionDate_idx` (`companyId`,`collectionDate`),
  ADD KEY `staff_collections_staffId_status_idx` (`staffId`,`status`),
  ADD KEY `staff_collections_brokerId_idx` (`brokerId`),
  ADD KEY `staff_collections_reviewedById_idx` (`reviewedById`),
  ADD KEY `staff_collections_brokerCustomerId_idx` (`brokerCustomerId`);

--
-- Indexes for table `staff_customer_assignments`
--
ALTER TABLE `staff_customer_assignments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `staff_customer_assignments_companyId_customerId_key` (`companyId`,`customerId`),
  ADD KEY `staff_customer_assignments_companyId_staffId_status_idx` (`companyId`,`staffId`,`status`),
  ADD KEY `staff_customer_assignments_companyId_customerId_status_idx` (`companyId`,`customerId`,`status`),
  ADD KEY `staff_customer_assignments_staffId_fkey` (`staffId`),
  ADD KEY `staff_customer_assignments_customerId_fkey` (`customerId`),
  ADD KEY `staff_customer_assignments_assignedById_fkey` (`assignedById`);

--
-- Indexes for table `staff_files`
--
ALTER TABLE `staff_files`
  ADD PRIMARY KEY (`id`),
  ADD KEY `staff_files_companyId_ownerUserId_createdAt_idx` (`companyId`,`ownerUserId`,`createdAt`),
  ADD KEY `staff_files_ownerUserId_kind_createdAt_idx` (`ownerUserId`,`kind`,`createdAt`);

--
-- Indexes for table `subscriptions`
--
ALTER TABLE `subscriptions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `subscriptions_companyId_idx` (`companyId`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `users_username_key` (`username`),
  ADD UNIQUE KEY `users_email_key` (`email`),
  ADD KEY `users_companyId_idx` (`companyId`),
  ADD KEY `users_branchId_idx` (`branchId`),
  ADD KEY `users_role_idx` (`role`),
  ADD KEY `users_status_idx` (`status`);

--
-- Indexes for table `_prisma_migrations`
--
ALTER TABLE `_prisma_migrations`
  ADD PRIMARY KEY (`id`);

--
-- Constraints for dumped tables
--

--
-- Constraints for table `accounting_periods`
--
ALTER TABLE `accounting_periods`
  ADD CONSTRAINT `accounting_periods_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `accounting_periods_lockedById_fkey` FOREIGN KEY (`lockedById`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `attendance`
--
ALTER TABLE `attendance`
  ADD CONSTRAINT `attendance_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `attendance_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `audit_logs_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `audit_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `bank_deposits`
--
ALTER TABLE `bank_deposits`
  ADD CONSTRAINT `bank_deposits_accountantId_fkey` FOREIGN KEY (`accountantId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `bank_deposits_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `bank_deposits_holdClearedById_fkey` FOREIGN KEY (`holdClearedById`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `bank_deposits_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `branches`
--
ALTER TABLE `branches`
  ADD CONSTRAINT `branches_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `broker_customers`
--
ALTER TABLE `broker_customers`
  ADD CONSTRAINT `broker_customers_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `company_admin_expenses`
--
ALTER TABLE `company_admin_expenses`
  ADD CONSTRAINT `company_admin_expenses_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `company_admin_expenses_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `company_admin_expenses_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `company_admin_settings`
--
ALTER TABLE `company_admin_settings`
  ADD CONSTRAINT `company_admin_settings_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `company_attendance_journal`
--
ALTER TABLE `company_attendance_journal`
  ADD CONSTRAINT `company_attendance_journal_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `company_attendance_journal_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `company_audit_events`
--
ALTER TABLE `company_audit_events`
  ADD CONSTRAINT `company_audit_events_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `company_audit_events_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `company_bank_messages`
--
ALTER TABLE `company_bank_messages`
  ADD CONSTRAINT `company_bank_messages_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `company_bank_messages_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `company_bank_messages_verificationId_fkey` FOREIGN KEY (`verificationId`) REFERENCES `company_bank_verifications` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `company_bank_verifications`
--
ALTER TABLE `company_bank_verifications`
  ADD CONSTRAINT `company_bank_verifications_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `company_bank_verifications_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `company_bank_verifications_verifiedById_fkey` FOREIGN KEY (`verifiedById`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `company_gps_devices`
--
ALTER TABLE `company_gps_devices`
  ADD CONSTRAINT `company_gps_devices_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `company_gps_devices_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `company_gps_pings`
--
ALTER TABLE `company_gps_pings`
  ADD CONSTRAINT `company_gps_pings_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `company_gps_pings_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `company_gps_devices` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `company_notifications`
--
ALTER TABLE `company_notifications`
  ADD CONSTRAINT `company_notifications_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `company_notifications_targetUserId_fkey` FOREIGN KEY (`targetUserId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `company_settings`
--
ALTER TABLE `company_settings`
  ADD CONSTRAINT `company_settings_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `customers`
--
ALTER TABLE `customers`
  ADD CONSTRAINT `customers_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `expenses`
--
ALTER TABLE `expenses`
  ADD CONSTRAINT `expenses_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `expenses_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `expenses_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `financial_days`
--
ALTER TABLE `financial_days`
  ADD CONSTRAINT `financial_days_closedById_fkey` FOREIGN KEY (`closedById`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `financial_days_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `financial_days_openedById_fkey` FOREIGN KEY (`openedById`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `float_transactions`
--
ALTER TABLE `float_transactions`
  ADD CONSTRAINT `float_transactions_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `float_transactions_brokerCustomerId_fkey` FOREIGN KEY (`brokerCustomerId`) REFERENCES `broker_customers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `float_transactions_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `float_transactions_fromUserId_fkey` FOREIGN KEY (`fromUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `float_transactions_toUserId_fkey` FOREIGN KEY (`toUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `gps_alerts`
--
ALTER TABLE `gps_alerts`
  ADD CONSTRAINT `gps_alerts_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `gps_alerts_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `company_gps_devices` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `gps_alerts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `gps_tracking`
--
ALTER TABLE `gps_tracking`
  ADD CONSTRAINT `gps_tracking_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `gps_tracking_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `messages`
--
ALTER TABLE `messages`
  ADD CONSTRAINT `messages_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `messages_receiverId_fkey` FOREIGN KEY (`receiverId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `messages_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `notification_deliveries`
--
ALTER TABLE `notification_deliveries`
  ADD CONSTRAINT `notification_deliveries_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `notification_deliveries_notificationId_fkey` FOREIGN KEY (`notificationId`) REFERENCES `notifications` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `notification_deliveries_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `performance_records`
--
ALTER TABLE `performance_records`
  ADD CONSTRAINT `performance_records_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `performance_records_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `products`
--
ALTER TABLE `products`
  ADD CONSTRAINT `products_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `service_activities`
--
ALTER TABLE `service_activities`
  ADD CONSTRAINT `service_activities_brokerCustomerId_fkey` FOREIGN KEY (`brokerCustomerId`) REFERENCES `broker_customers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `service_activities_brokerId_fkey` FOREIGN KEY (`brokerId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `service_activities_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `service_activities_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `service_activities_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `staff_broker_assignments`
--
ALTER TABLE `staff_broker_assignments`
  ADD CONSTRAINT `staff_broker_assignments_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `staff_broker_assignments_brokerId_fkey` FOREIGN KEY (`brokerId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `staff_broker_assignments_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `staff_broker_assignments_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `staff_collections`
--
ALTER TABLE `staff_collections`
  ADD CONSTRAINT `staff_collections_brokerCustomerId_fkey` FOREIGN KEY (`brokerCustomerId`) REFERENCES `broker_customers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `staff_collections_brokerId_fkey` FOREIGN KEY (`brokerId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `staff_collections_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `staff_collections_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `staff_collections_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `staff_customer_assignments`
--
ALTER TABLE `staff_customer_assignments`
  ADD CONSTRAINT `staff_customer_assignments_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `staff_customer_assignments_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `staff_customer_assignments_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `staff_customer_assignments_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `staff_files`
--
ALTER TABLE `staff_files`
  ADD CONSTRAINT `staff_files_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `staff_files_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `subscriptions`
--
ALTER TABLE `subscriptions`
  ADD CONSTRAINT `subscriptions_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `users_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
