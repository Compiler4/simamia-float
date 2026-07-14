-- These statements are a manual reference only.
-- Prefer: npx prisma db push

ALTER TABLE staff_collections
  MODIFY brokerId VARCHAR(191) NULL,
  ADD COLUMN brokerCustomerId VARCHAR(191) NULL;

ALTER TABLE float_transactions
  ADD COLUMN brokerCustomerId VARCHAR(191) NULL;

ALTER TABLE staff_files
  ADD COLUMN originalSizeBytes INT NULL,
  ADD COLUMN compressionRatio DOUBLE NULL,
  ADD COLUMN compressed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN checksumSha256 VARCHAR(64) NULL;
