-- Link registered brokers/customers to a branch.
ALTER TABLE `broker_customers`
  ADD COLUMN `branchId` VARCHAR(191) NULL AFTER `companyId`;

CREATE INDEX `broker_customers_branchId_idx`
  ON `broker_customers`(`branchId`);

ALTER TABLE `broker_customers`
  ADD CONSTRAINT `broker_customers_branchId_fkey`
  FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

SET @company_id := (SELECT `id` FROM `companies` WHERE `code`='SIMAMIA' LIMIT 1);

INSERT INTO `branches`
(`id`,`companyId`,`name`,`code`,`region`,`address`,`status`,`createdAt`,`updatedAt`)
VALUES
('branch_simamia_dodoma_001',@company_id,'Dodoma Branch','DODOMA','Dodoma',
 'Dodoma Branch, Dodoma, Tanzania','ACTIVE',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE
  `name`='Dodoma Branch',`region`='Dodoma',
  `address`='Dodoma Branch, Dodoma, Tanzania',`status`='ACTIVE',
  `updatedAt`=CURRENT_TIMESTAMP(3);

SET @dodoma_branch_id := (
  SELECT `id` FROM `branches`
  WHERE `companyId`=@company_id AND `code`='DODOMA' LIMIT 1
);

UPDATE `companies`
SET `address`='Dodoma, Tanzania',`updatedAt`=CURRENT_TIMESTAMP(3)
WHERE `id`=@company_id;

UPDATE `broker_customers`
SET `branchId`=@dodoma_branch_id,`location`='Dodoma Branch',`region`='Dodoma',
    `district`='Dodoma City',`ward`=NULL,
    `address`='Dodoma Branch, Dodoma, Tanzania',`city`='Dodoma',
    `attendedLocation`='Dodoma Branch',`updatedAt`=CURRENT_TIMESTAMP(3)
WHERE `companyId`=@company_id;

UPDATE `users`
SET `branchId`=@dodoma_branch_id,`assignedRegion`='Dodoma',
    `physicalAddress`=COALESCE(NULLIF(`physicalAddress`,''),'Dodoma, Tanzania'),
    `updatedAt`=CURRENT_TIMESTAMP(3)
WHERE `companyId`=@company_id;
