-- Add many extra Dodoma agents manually.
-- Replace the sample rows in tmp_dodoma_agents with your real data.
SET NAMES utf8mb4;
USE `simamia`;
START TRANSACTION;

SET @company_id := (SELECT `id` FROM `companies` WHERE `code`='SIMAMIA' LIMIT 1);
SET @branch_id := (SELECT `id` FROM `branches` WHERE `companyId`=@company_id AND `code`='DODOMA' LIMIT 1);

DROP TEMPORARY TABLE IF EXISTS `tmp_dodoma_agents`;
CREATE TEMPORARY TABLE `tmp_dodoma_agents` (
  `agentName` VARCHAR(191) NOT NULL,
  `agentMsisdn` VARCHAR(32) NOT NULL,
  `aliasCode` VARCHAR(80) NOT NULL,
  PRIMARY KEY (`aliasCode`),
  UNIQUE KEY `tmp_dodoma_agents_msisdn_key` (`agentMsisdn`)
);

-- Insert as many rows as needed here.
INSERT INTO `tmp_dodoma_agents` (`agentName`,`agentMsisdn`,`aliasCode`) VALUES
('FIRST DODOMA AGENT','255700000101','DOD001'),
('SECOND DODOMA AGENT','255700000102','DOD002'),
('THIRD DODOMA AGENT','255700000103','DOD003');

INSERT INTO `broker_customers`
(`id`,`companyId`,`branchId`,`code`,`name`,`officialAgentNo`,`phone`,`location`,
 `region`,`district`,`ward`,`address`,`city`,`country`,`nationality`,`status`,
 `notes`,`isImported`,`registrationDate`,`attendedLocation`,`createdAt`,`updatedAt`)
SELECT
  CONCAT('brk_',LEFT(SHA2(CONCAT(@company_id,'|',t.`aliasCode`,'|',t.`agentMsisdn`),256),30)),
  @company_id,@branch_id,CONCAT('AGT-',t.`aliasCode`),t.`agentName`,t.`aliasCode`,
  t.`agentMsisdn`,'Dodoma Branch','Dodoma','Dodoma City',NULL,
  'Dodoma Branch, Dodoma, Tanzania','Dodoma','Tanzania','Tanzania','ACTIVE',
  'Manually registered in Dodoma Region under Dodoma Branch.',0,CURRENT_TIMESTAMP(3),
  'Dodoma Branch',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
FROM `tmp_dodoma_agents` t
ON DUPLICATE KEY UPDATE
  `branchId`=VALUES(`branchId`),`name`=VALUES(`name`),
  `officialAgentNo`=VALUES(`officialAgentNo`),`phone`=VALUES(`phone`),
  `location`='Dodoma Branch',`region`='Dodoma',`district`='Dodoma City',
  `ward`=NULL,`address`='Dodoma Branch, Dodoma, Tanzania',`city`='Dodoma',
  `status`='ACTIVE',`notes`=VALUES(`notes`),`updatedAt`=CURRENT_TIMESTAMP(3);

INSERT INTO `broker_agent_accounts`
(`id`,`companyId`,`brokerCustomerId`,`network`,`simPhoneNumber`,`agentNumber`,
 `accountName`,`isPrimary`,`status`,`createdAt`,`updatedAt`)
SELECT
  CONCAT('baa_',LEFT(SHA2(CONCAT(@company_id,'|OTHER|',t.`aliasCode`),256),30)),
  @company_id,b.`id`,'OTHER',t.`agentMsisdn`,t.`aliasCode`,t.`agentName`,1,'ACTIVE',
  CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3)
FROM `tmp_dodoma_agents` t
INNER JOIN `broker_customers` b
  ON b.`companyId`=@company_id AND b.`code`=CONCAT('AGT-',t.`aliasCode`)
ON DUPLICATE KEY UPDATE
  `brokerCustomerId`=VALUES(`brokerCustomerId`),
  `simPhoneNumber`=VALUES(`simPhoneNumber`),
  `accountName`=VALUES(`accountName`),`isPrimary`=1,`status`='ACTIVE',
  `updatedAt`=CURRENT_TIMESTAMP(3);

COMMIT;
SELECT COUNT(*) AS insertedOrUpdatedRows FROM `tmp_dodoma_agents`;
