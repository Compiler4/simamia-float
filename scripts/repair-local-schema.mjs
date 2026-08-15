import dotenv from "dotenv";
import mariadb from "mariadb";

dotenv.config();

function databaseConfig() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (databaseUrl) {
    const url = new URL(databaseUrl);

    return {
      host: url.hostname || "127.0.0.1",
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username || "root"),
      password: decodeURIComponent(url.password || ""),
      database:
        decodeURIComponent(url.pathname.replace(/^\/+/, "")) ||
        process.env.DATABASE_NAME ||
        "simamia",
    };
  }

  return {
    host: process.env.DATABASE_HOST || "127.0.0.1",
    port: Number(process.env.DATABASE_PORT || 3306),
    user: process.env.DATABASE_USER || "root",
    password: process.env.DATABASE_PASSWORD || "",
    database: process.env.DATABASE_NAME || "simamia",
  };
}

function isLocalHost(host) {
  return ["127.0.0.1", "localhost", "::1"].includes(
    String(host).trim().toLowerCase(),
  );
}

const config = databaseConfig();

if (!isLocalHost(config.host) && process.env.ALLOW_NON_LOCAL_SCHEMA_REPAIR !== "1") {
  throw new Error(
    `Refusing to repair schema on non-local database host "${config.host}". Set ALLOW_NON_LOCAL_SCHEMA_REPAIR=1 only if you intentionally want that.`,
  );
}

const connection = await mariadb.createConnection(config);
const applied = [];

async function tableExists(tableName) {
  const rows = await connection.query(
    `SELECT COUNT(*) AS count
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?`,
    [tableName],
  );

  return Number(rows[0]?.count || 0) > 0;
}

async function columnExists(tableName, columnName) {
  const rows = await connection.query(
    `SELECT COUNT(*) AS count
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?`,
    [tableName, columnName],
  );

  return Number(rows[0]?.count || 0) > 0;
}

async function addColumn(tableName, columnName, definition) {
  if (!(await tableExists(tableName))) {
    console.log(`Skipping ${tableName}.${columnName}; table does not exist.`);
    return false;
  }

  if (await columnExists(tableName, columnName)) {
    return false;
  }

  await connection.query(
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`,
  );
  applied.push(`${tableName}.${columnName}`);
  return true;
}

try {
  await addColumn("users", "usernameChangedAt", "DATETIME(3) NULL");
  await addColumn("users", "passwordChangedAt", "DATETIME(3) NULL");

  await addColumn("customers", "district", "VARCHAR(191) NULL");
  await addColumn("customers", "ward", "VARCHAR(191) NULL");
  await addColumn("customers", "locationName", "VARCHAR(191) NULL");
  await addColumn("customers", "latitude", "DOUBLE NULL");
  await addColumn("customers", "longitude", "DOUBLE NULL");

  await addColumn("expenses", "createdById", "VARCHAR(191) NULL");

  await addColumn("attendance", "overallStatus", "VARCHAR(40) NULL");

  await addColumn(
    "staff_files",
    "updatedAt",
    "DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)",
  );

  if (await addColumn("staff_work_areas", "name", "VARCHAR(191) NULL")) {
    await connection.query(
      `UPDATE staff_work_areas
          SET name = COALESCE(
            NULLIF(areaLabel, ''),
            NULLIF(CONCAT_WS(', ', NULLIF(region, ''), NULLIF(district, ''), NULLIF(ward, '')), ''),
            'Assigned work area'
          )
        WHERE name IS NULL OR name = ''`,
    );
    await connection.query(
      "ALTER TABLE `staff_work_areas` MODIFY COLUMN `name` VARCHAR(191) NOT NULL",
    );
  }

  await addColumn("staff_work_areas", "centreLatitude", "DOUBLE NULL");
  await addColumn("staff_work_areas", "centreLongitude", "DOUBLE NULL");
  await addColumn("staff_work_areas", "radiusMeters", "INT NULL");
  await addColumn("staff_work_areas", "polygonJson", "LONGTEXT NULL");

  if (await addColumn("broker_service_visits", "serviceDay", "DATETIME(3) NULL")) {
    await connection.query(
      `UPDATE broker_service_visits
          SET serviceDay = DATE(COALESCE(serviceProvidedAt, startedAt, createdAt, NOW(3)))
        WHERE serviceDay IS NULL`,
    );
    await connection.query(
      "ALTER TABLE `broker_service_visits` MODIFY COLUMN `serviceDay` DATETIME(3) NOT NULL",
    );
  }

  await addColumn("broker_service_visits", "locationName", "VARCHAR(255) NULL");
  await addColumn("broker_service_visits", "proofUrl", "VARCHAR(500) NULL");
  await addColumn("broker_service_visits", "proofDueAt", "DATETIME(3) NULL");
  await addColumn("broker_service_visits", "proofUploadedAt", "DATETIME(3) NULL");
  await addColumn("broker_service_visits", "notes", "TEXT NULL");

  await addColumn("staff_funding_receipts", "receiptUrl", "VARCHAR(600) NULL");
  await addColumn("staff_funding_receipts", "verifiedById", "VARCHAR(191) NULL");
  await addColumn("staff_funding_receipts", "verifiedAt", "DATETIME(3) NULL");

  await addColumn("staff_proof_submissions", "documentUrl", "VARCHAR(600) NULL");

  if (applied.length === 0) {
    console.log("Local schema already has the required compatibility columns.");
  } else {
    console.log("Applied local schema compatibility columns:");
    for (const item of applied) {
      console.log(`- ${item}`);
    }
  }
} finally {
  await connection.end();
}
