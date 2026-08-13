import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mariadb from "mariadb";

dotenv.config();

const DEFAULT_PASSWORD = "Simamia@2026";
const DEFAULT_USERNAMES = [
  "system-admin",
  "super-admin",
  "company-admin",
  "kelvin",
  "meda",
  "enjoy",
  "baraka",
];

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

function targetUsernames() {
  return (process.env.LOCAL_RESET_USERS || DEFAULT_USERNAMES.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

const config = databaseConfig();

if (!isLocalHost(config.host) && process.env.ALLOW_NON_LOCAL_PASSWORD_RESET !== "1") {
  throw new Error(
    `Refusing to reset passwords on non-local database host "${config.host}". Set ALLOW_NON_LOCAL_PASSWORD_RESET=1 only if you intentionally want that.`,
  );
}

const password = process.env.LOCAL_DEV_PASSWORD || DEFAULT_PASSWORD;
const usernames = targetUsernames();
const passwordHash = await bcrypt.hash(password, 12);
const connection = await mariadb.createConnection(config);

try {
  const placeholders = usernames.map(() => "?").join(",");
  const before = await connection.query(
    `SELECT username, email, role, status FROM users WHERE username IN (${placeholders}) ORDER BY username`,
    usernames,
  );

  if (before.length === 0) {
    throw new Error(
      "No matching local users were found. Import the SQL dump or seed the database first.",
    );
  }

  await connection.query(
    `UPDATE users SET passwordHash = ?, updatedAt = NOW(3) WHERE username IN (${placeholders})`,
    [passwordHash, ...usernames],
  );

  console.log("Local development passwords were reset.");
  console.table(
    before.map((user) => ({
      role: user.role,
      username: user.username,
      email: user.email,
      status: user.status,
    })),
  );
  console.log(`Password: ${password}`);
} finally {
  await connection.end();
}
