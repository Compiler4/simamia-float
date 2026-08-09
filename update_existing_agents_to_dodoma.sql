-- Update an existing Simamia database so all registered data uses Dodoma Region and Dodoma Branch.
SET NAMES utf8mb4;
USE `simamia`;

-- ---------------------------------------------------------------------------
-- Broker/customer branch relation migration
-- This block is safe to run repeatedly on MariaDB/MySQL.
-- ---------------------------------------------------------------------------
SET @schema_name := DATABASE();

SET @has_branch_column := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=@schema_name
    AND TABLE_NAME='broker_customers'
    AND COLUMN_NAME='branchId'
);
SET @ddl := IF(
  @has_branch_column=0,
  'ALTER TABLE `broker_customers` ADD COLUMN `branchId` varchar(191) NULL AFTER `companyId`',
  'SELECT 1'
);
PREPARE simamia_stmt FROM @ddl;
EXECUTE simamia_stmt;
DEALLOCATE PREPARE simamia_stmt;

SET @has_branch_index := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=@schema_name
    AND TABLE_NAME='broker_customers'
    AND INDEX_NAME='broker_customers_branchId_idx'
);
SET @ddl := IF(
  @has_branch_index=0,
  'ALTER TABLE `broker_customers` ADD INDEX `broker_customers_branchId_idx` (`branchId`)',
  'SELECT 1'
);
PREPARE simamia_stmt FROM @ddl;
EXECUTE simamia_stmt;
DEALLOCATE PREPARE simamia_stmt;

SET @has_branch_fk := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=@schema_name
    AND TABLE_NAME='broker_customers'
    AND CONSTRAINT_NAME='broker_customers_branchId_fkey'
    AND CONSTRAINT_TYPE='FOREIGN KEY'
);
SET @ddl := IF(
  @has_branch_fk=0,
  'ALTER TABLE `broker_customers` ADD CONSTRAINT `broker_customers_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches` (`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE simamia_stmt FROM @ddl;
EXECUTE simamia_stmt;
DEALLOCATE PREPARE simamia_stmt;


START TRANSACTION;

SET @company_id := (SELECT `id` FROM `companies` WHERE `code`='SIMAMIA' LIMIT 1);


-- Make the Simamia company and its active registration branch Dodoma-based.
UPDATE `companies`
SET
  `address`='Dodoma, Tanzania',
  `updatedAt`=CURRENT_TIMESTAMP(3)
WHERE `id`=@company_id;

INSERT INTO `branches`
(`id`,`companyId`,`name`,`code`,`region`,`address`,`status`,`createdAt`,`updatedAt`)
VALUES
(
  'branch_simamia_dodoma_001',
  @company_id,
  'Dodoma Branch',
  'DODOMA',
  'Dodoma',
  'Dodoma Branch, Dodoma, Tanzania',
  'ACTIVE',
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
)
ON DUPLICATE KEY UPDATE
  `name`='Dodoma Branch',
  `region`='Dodoma',
  `address`='Dodoma Branch, Dodoma, Tanzania',
  `status`='ACTIVE',
  `updatedAt`=CURRENT_TIMESTAMP(3);

SET @dodoma_branch_id := (
  SELECT `id`
  FROM `branches`
  WHERE `companyId`=@company_id AND `code`='DODOMA'
  LIMIT 1
);



-- Assign every registered Simamia broker/agent to Dodoma Region and Dodoma Branch.
UPDATE `broker_customers`
SET
  `branchId`=@dodoma_branch_id,
  `location`='Dodoma Branch',
  `region`='Dodoma',
  `district`='Dodoma City',
  `ward`=NULL,
  `address`='Dodoma Branch, Dodoma, Tanzania',
  `city`='Dodoma',
  `country`='Tanzania',
  `nationality`=COALESCE(NULLIF(`nationality`,''),'Tanzania'),
  `attendedLocation`='Dodoma Branch',
  `notes`=CASE
    WHEN COALESCE(`notes`,'') LIKE '%Dodoma Branch%' THEN `notes`
    WHEN COALESCE(`notes`,'')='' THEN 'Registered in Dodoma Region under Dodoma Branch.'
    ELSE CONCAT(`notes`, ' Registered in Dodoma Region under Dodoma Branch.')
  END,
  `updatedAt`=CURRENT_TIMESTAMP(3)
WHERE `companyId`=@company_id;

-- Put all registered Simamia portal users under the same branch and region.
UPDATE `users`
SET
  `branchId`=@dodoma_branch_id,
  `assignedRegion`='Dodoma',
  `physicalAddress`=COALESCE(NULLIF(`physicalAddress`,''),'Dodoma, Tanzania'),
  `updatedAt`=CURRENT_TIMESTAMP(3)
WHERE `companyId`=@company_id;

UPDATE `data_import_batches`
SET
  `notes`=CONCAT(
    'Imported 2,273 broker/agent rows. All records are registered in Dodoma Region under Dodoma Branch. '
  ),
  `updatedAt`=CURRENT_TIMESTAMP(3)
WHERE `companyId`=@company_id AND `sourceType`='EXCEL_AGENT_MASTER';


COMMIT;

SELECT @company_id AS companyId, @dodoma_branch_id AS dodomaBranchId;
SELECT COUNT(*) AS dodomaBrokers FROM `broker_customers` WHERE `companyId`=@company_id AND `branchId`=@dodoma_branch_id AND `region`='Dodoma';
SELECT COUNT(*) AS dodomaUsers FROM `users` WHERE `companyId`=@company_id AND `branchId`=@dodoma_branch_id AND `assignedRegion`='Dodoma';
