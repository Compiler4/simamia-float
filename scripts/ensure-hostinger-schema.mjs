import "dotenv/config";
import mariadb from "mariadb";

function cleanEnvValue(value) {
  const text = String(value ?? "").trim();
  if (
    text.length >= 2 &&
    ((text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'")))
  ) {
    return text.slice(1, -1);
  }
  return text;
}

function hasSeparateDatabaseSettings() {
  return Boolean(
    cleanEnvValue(process.env.DATABASE_HOST) &&
      cleanEnvValue(process.env.DATABASE_USER) &&
      cleanEnvValue(process.env.DATABASE_NAME),
  );
}

function databaseConfig() {
  // Hostinger hPanel DATABASE_* values are the source of truth. This avoids
  // an older DATABASE_URL password taking precedence after a password reset.
  if (hasSeparateDatabaseSettings()) {
    const socketPath = cleanEnvValue(process.env.DATABASE_SOCKET);
    const configuredHost = cleanEnvValue(process.env.DATABASE_HOST) || "localhost";
    const host =
      cleanEnvValue(process.env.HOSTING_PROVIDER).toLowerCase() === "hostinger" &&
      (configuredHost.toLowerCase() === "localhost" || configuredHost === "::1")
        ? "127.0.0.1"
        : configuredHost;

    const common = {
      user: cleanEnvValue(process.env.DATABASE_USER),
      password: cleanEnvValue(process.env.DATABASE_PASSWORD),
      database: cleanEnvValue(process.env.DATABASE_NAME),
      connectTimeout: 10_000,
      acquireTimeout: 10_000,
    };

    if (socketPath) {
      return {
        ...common,
        socketPath,
      };
    }

    return {
      ...common,
      host,
      port: Number(cleanEnvValue(process.env.DATABASE_PORT) || 3306),
    };
  }

  const databaseUrl = cleanEnvValue(process.env.DATABASE_URL);
  if (databaseUrl) {
    const url = new URL(databaseUrl);
    if (!["mysql:", "mariadb:"].includes(url.protocol)) {
      throw new Error("DATABASE_URL must start with mysql:// or mariadb://.");
    }

    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.replace(/^\/+/, "")),
      connectTimeout: 10_000,
      acquireTimeout: 10_000,
    };
  }

  return {
    host: "localhost",
    port: 3306,
    user: "",
    password: "",
    database: "",
    connectTimeout: 10_000,
    acquireTimeout: 10_000,
  };
}

function assertIdentifier(value) {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }
  return value;
}

const compatibilityColumns = {
  users: {
    profileImageUrl: "VARCHAR(500) NULL",
    assignedRegion: "VARCHAR(150) NULL",
    nidaNumber: "VARCHAR(40) NULL",
    dateOfBirth: "DATETIME(3) NULL",
    gender: "VARCHAR(40) NULL",
    nationality: "VARCHAR(80) NULL",
    physicalAddress: "VARCHAR(255) NULL",
    usernameChangedAt: "DATETIME(3) NULL",
    passwordChangedAt: "DATETIME(3) NULL",
  },
  customers: {
    district: "VARCHAR(191) NULL",
    ward: "VARCHAR(191) NULL",
    locationName: "VARCHAR(191) NULL",
    latitude: "DOUBLE NULL",
    longitude: "DOUBLE NULL",
  },
  expenses: {
    createdById: "VARCHAR(191) NULL",
  },
  attendance: {
    overallStatus: "VARCHAR(40) NULL",
  },
  staff_files: {
    updatedAt: "DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)",
  },
  staff_work_areas: {
    centreLatitude: "DOUBLE NULL",
    centreLongitude: "DOUBLE NULL",
    radiusMeters: "INT NULL",
    polygonJson: "LONGTEXT NULL",
  },
  broker_service_visits: {
    locationName: "VARCHAR(255) NULL",
    proofUrl: "VARCHAR(500) NULL",
    proofDueAt: "DATETIME(3) NULL",
    proofUploadedAt: "DATETIME(3) NULL",
    notes: "TEXT NULL",
  },
  staff_funding_receipts: {
    receiptUrl: "VARCHAR(600) NULL",
    verifiedById: "VARCHAR(191) NULL",
    verifiedAt: "DATETIME(3) NULL",
  },
  staff_proof_submissions: {
    documentUrl: "VARCHAR(600) NULL",
  },
};

async function main() {
  if (process.env.HOSTINGER_SCHEMA_COMPAT === "0") {
    console.log("HOSTINGER_SCHEMA_COMPAT_SKIPPED disabled by environment.");
    return;
  }

  const config = databaseConfig();
  if (!config.host || !config.user || !config.database) {
    throw new Error(
      "Database settings are incomplete; schema compatibility check cannot run.",
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
    if (!(await tableExists(tableName))) return false;
    if (await columnExists(tableName, columnName)) return false;

    const table = assertIdentifier(tableName);
    const column = assertIdentifier(columnName);
    await connection.query(
      `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`,
    );
    applied.push(`${table}.${column}`);
    return true;
  }

  try {
    if (!(await tableExists("users"))) {
      throw new Error(
        "The users table is missing. Import the SIMAMIA database before starting the application.",
      );
    }

    for (const [tableName, columns] of Object.entries(compatibilityColumns)) {
      for (const [columnName, definition] of Object.entries(columns)) {
        await addColumn(tableName, columnName, definition);
      }
    }

    // Older schemas created CompanyStatus with only ACTIVE/SUSPENDED. Adding
    // DISABLED is non-destructive and matches the current Prisma enum.
    if (await tableExists("companies")) {
      const rows = await connection.query(
        `SELECT COLUMN_TYPE AS columnType
           FROM information_schema.columns
          WHERE table_schema = DATABASE()
            AND table_name = 'companies'
            AND column_name = 'status'
          LIMIT 1`,
      );
      const columnType = String(rows[0]?.columnType || "").toUpperCase();
      if (columnType.startsWith("ENUM(") && !columnType.includes("'DISABLED'")) {
        await connection.query(
          "ALTER TABLE `companies` MODIFY COLUMN `status` ENUM('ACTIVE','SUSPENDED','DISABLED') NOT NULL DEFAULT 'ACTIVE'",
        );
        applied.push("companies.status enum +DISABLED");
      }
    }

    console.log(
      applied.length
        ? `HOSTINGER_SCHEMA_COMPAT_OK applied=${applied.join(",")}`
        : "HOSTINGER_SCHEMA_COMPAT_OK schema already compatible",
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(
    "HOSTINGER_SCHEMA_COMPAT_FAILED",
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 2;
});
