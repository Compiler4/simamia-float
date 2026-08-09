SET NAMES utf8mb4;
USE `simamia`;
SET @company_id := (SELECT `id` FROM `companies` WHERE `code`='SIMAMIA' LIMIT 1);
SET @branch_id := (SELECT `id` FROM `branches` WHERE `companyId`=@company_id AND `code`='DODOMA' LIMIT 1);

SELECT c.`id`,c.`name`,c.`code`,c.`address`,b.`id` AS branchId,b.`name` AS branchName,
       b.`code` AS branchCode,b.`region`,b.`address` AS branchAddress,b.`status`
FROM `companies` c
LEFT JOIN `branches` b ON b.`companyId`=c.`id` AND b.`code`='DODOMA'
WHERE c.`id`=@company_id;

SELECT COUNT(*) AS totalRegisteredBrokers,
       SUM(`branchId`=@branch_id) AS inDodomaBranch,
       SUM(`region`='Dodoma') AS inDodomaRegion,
       SUM(`location`='Dodoma Branch') AS withDodomaLocation
FROM `broker_customers`
WHERE `companyId`=@company_id;

SELECT COUNT(*) AS agentAccounts
FROM `broker_agent_accounts`
WHERE `companyId`=@company_id;

SELECT COUNT(*) AS usersInDodomaBranch
FROM `users`
WHERE `companyId`=@company_id AND `branchId`=@branch_id AND `assignedRegion`='Dodoma';

SELECT `code`,`name`,`phone`,`officialAgentNo`,`branchId`,`region`,`district`,
       `location`,`address`,`status`
FROM `broker_customers`
WHERE `companyId`=@company_id
ORDER BY `sourceRowNumber`,`createdAt`
LIMIT 100;
