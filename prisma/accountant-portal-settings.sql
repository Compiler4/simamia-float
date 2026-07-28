-- Replace YOUR_COMPANY_ID with the company id shown by:
-- SELECT id, name, code FROM companies;

INSERT INTO company_settings (
  id,
  companyId,
  `key`,
  `value`,
  createdAt,
  updatedAt
)
VALUES (
  CONCAT('setting_', REPLACE(UUID(), '-', '')),
  'YOUR_COMPANY_ID',
  'accountantExpenseApprovalLimit',
  '1000000',
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE
  `value` = VALUES(`value`),
  updatedAt = NOW();
