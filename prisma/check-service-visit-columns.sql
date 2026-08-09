SELECT
  TABLE_NAME,
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'broker_service_visits',
    'broker_customers',
    'service_activities'
  )
ORDER BY TABLE_NAME, ORDINAL_POSITION;
