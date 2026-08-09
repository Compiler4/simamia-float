-- Simamia Float: safe, idempotent repair for missing User columns.
-- Intended for MySQL/MariaDB. It does not delete or replace existing data.

SET @schema_name = DATABASE();

-- profileImageUrl
SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `users` ADD COLUMN `profileImageUrl` VARCHAR(500) NULL AFTER `lastLoginAt`',
    'SELECT ''users.profileImageUrl already exists'' AS message'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'profileImageUrl'
);
PREPARE statement_to_run FROM @sql;
EXECUTE statement_to_run;
DEALLOCATE PREPARE statement_to_run;

-- assignedRegion
SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `users` ADD COLUMN `assignedRegion` VARCHAR(150) NULL AFTER `profileImageUrl`',
    'SELECT ''users.assignedRegion already exists'' AS message'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'assignedRegion'
);
PREPARE statement_to_run FROM @sql;
EXECUTE statement_to_run;
DEALLOCATE PREPARE statement_to_run;

-- nidaNumber
SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `users` ADD COLUMN `nidaNumber` VARCHAR(40) NULL AFTER `assignedRegion`',
    'SELECT ''users.nidaNumber already exists'' AS message'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'nidaNumber'
);
PREPARE statement_to_run FROM @sql;
EXECUTE statement_to_run;
DEALLOCATE PREPARE statement_to_run;

-- dateOfBirth
SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `users` ADD COLUMN `dateOfBirth` DATETIME(3) NULL AFTER `nidaNumber`',
    'SELECT ''users.dateOfBirth already exists'' AS message'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'dateOfBirth'
);
PREPARE statement_to_run FROM @sql;
EXECUTE statement_to_run;
DEALLOCATE PREPARE statement_to_run;

-- gender
SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `users` ADD COLUMN `gender` ENUM(''MALE'',''FEMALE'',''OTHER'') NULL AFTER `dateOfBirth`',
    'SELECT ''users.gender already exists'' AS message'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'gender'
);
PREPARE statement_to_run FROM @sql;
EXECUTE statement_to_run;
DEALLOCATE PREPARE statement_to_run;

-- nationality
SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `users` ADD COLUMN `nationality` VARCHAR(80) NULL AFTER `gender`',
    'SELECT ''users.nationality already exists'' AS message'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'nationality'
);
PREPARE statement_to_run FROM @sql;
EXECUTE statement_to_run;
DEALLOCATE PREPARE statement_to_run;

-- physicalAddress
SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `users` ADD COLUMN `physicalAddress` VARCHAR(255) NULL AFTER `nationality`',
    'SELECT ''users.physicalAddress already exists'' AS message'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'physicalAddress'
);
PREPARE statement_to_run FROM @sql;
EXECUTE statement_to_run;
DEALLOCATE PREPARE statement_to_run;

-- Unique index required by Prisma for nidaNumber.
SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'CREATE UNIQUE INDEX `users_nidaNumber_key` ON `users` (`nidaNumber`)',
    'SELECT ''users_nidaNumber_key already exists'' AS message'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'users_nidaNumber_key'
);
PREPARE statement_to_run FROM @sql;
EXECUTE statement_to_run;
DEALLOCATE PREPARE statement_to_run;
