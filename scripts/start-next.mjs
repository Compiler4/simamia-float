import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mariadb from "mariadb";
import dotenv from "dotenv";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextCli = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");

function clean(value) {
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

function loadPackagedEnvironmentDefaults() {
  for (const fileName of [".env.production", ".env"]) {
    const envPath = path.join(projectRoot, fileName);

    if (!existsSync(envPath)) continue;

    const result = dotenv.config({
      path: envPath,
      override: false,
      quiet: true,
    });

    for (const [key, value] of Object.entries(result.parsed ?? {})) {
      if (!String(process.env[key] ?? "").trim()) {
        process.env[key] = value;
      }
    }
  }
}

function authSecretStatus() {
  let firstConfigured = null;

  for (const key of ["AUTH_SECRET", "SESSION_SECRET", "NEXTAUTH_SECRET", "JWT_SECRET"]) {
    const value = clean(process.env[key]);
    if (!value) continue;

    if (!firstConfigured) {
      firstConfigured = { configured: true, source: key, length: value.length, strongEnough: false };
    }

    if (value.length >= 32) {
      return { configured: true, source: key, length: value.length, strongEnough: true };
    }
  }

  return firstConfigured ?? { configured: false, source: null, length: 0, strongEnough: false };
}

function positiveNumber(value, fallback) {
  const parsed = Number(clean(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getRuntimeDatabaseConfig() {
  const host = clean(process.env.DATABASE_HOST) || "localhost";
  const port = positiveNumber(process.env.DATABASE_PORT, 3306);
  const user = clean(process.env.DATABASE_USER);
  const password = clean(process.env.DATABASE_PASSWORD);
  const database = clean(process.env.DATABASE_NAME);

  if (!user || !password || !database) return null;

  return {
    host,
    port,
    user,
    password,
    database,
    connectionLimit: Math.min(
      positiveNumber(process.env.DATABASE_CONNECTION_LIMIT, 5),
      20,
    ),
  };
}

function safeConfig(config) {
  if (!config) return null;
  return {
    host: config.host,
    port: config.port,
    user: config.user,
    database: config.database,
    passwordPresent: Boolean(config.password),
    connectionLimit: config.connectionLimit,
  };
}

function candidateKey(candidate) {
  return candidate.socketPath
    ? `socket:${candidate.socketPath}`
    : `tcp:${candidate.host}:${candidate.port}`;
}

function buildCandidates(config) {
  const candidates = [];
  const seen = new Set();

  const add = (candidate) => {
    const key = candidateKey(candidate);
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(candidate);
  };

  const explicitSocket = clean(process.env.DATABASE_SOCKET);
  if (explicitSocket) {
    add({ ...config, socketPath: explicitSocket, label: "explicit-unix-socket" });
  }

  const hostingerSocket = "/var/lib/mysql/mysql.sock";
  if (existsSync(hostingerSocket)) {
    add({ ...config, socketPath: hostingerSocket, label: "hostinger-unix-socket" });
  }

  const commonSocket = "/tmp/mysql.sock";
  if (existsSync(commonSocket)) {
    add({ ...config, socketPath: commonSocket, label: "unix-socket" });
  }

  // Force IPv4 before literal localhost. The Hostinger Runtime log showed
  // localhost resolving to ::1 and MySQL rejecting user@::1.
  add({ ...config, host: "127.0.0.1", label: "ipv4-loopback" });

  const configuredHost = config.host.toLowerCase() === "::1" ? "127.0.0.1" : config.host;
  add({ ...config, host: configuredHost, label: "configured-host" });

  return candidates;
}

async function testDatabase(candidate) {
  let connection;
  try {
    const options = {
      user: candidate.user,
      password: candidate.password,
      database: candidate.database,
      connectTimeout: 8000,
      socketTimeout: 10000,
    };

    if (candidate.socketPath) {
      options.socketPath = candidate.socketPath;
    } else {
      options.host = candidate.host;
      options.port = candidate.port;
    }

    connection = await mariadb.createConnection(options);

    const rows = await connection.query(
      "SELECT DATABASE() AS dbName, CURRENT_USER() AS currentUser, @@hostname AS serverHost, 1 AS ok",
    );

    return {
      ok: true,
      database: String(rows?.[0]?.dbName ?? ""),
      currentUser: String(rows?.[0]?.currentUser ?? ""),
      serverHost: String(rows?.[0]?.serverHost ?? ""),
    };
  } catch (error) {
    return {
      ok: false,
      code: String(error?.code ?? error?.errno ?? "UNKNOWN"),
      errno: error?.errno ?? null,
      sqlState: error?.sqlState ?? null,
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch {}
    }
  }
}

function activateCandidate(candidate) {
  process.env.DATABASE_HOST = candidate.socketPath ? "localhost" : candidate.host;
  process.env.DATABASE_PORT = String(candidate.port ?? 3306);
  process.env.DATABASE_CONNECTION_LIMIT = String(candidate.connectionLimit);
  process.env.ALLOW_LOCAL_DATABASE_IN_PRODUCTION = "1";

  if (candidate.socketPath) {
    process.env.DATABASE_SOCKET = candidate.socketPath;
    process.env.SIMAMIA_DATABASE_TRANSPORT = `unix:${candidate.socketPath}`;
  } else {
    delete process.env.DATABASE_SOCKET;
    process.env.SIMAMIA_DATABASE_TRANSPORT = `tcp:${candidate.host}:${candidate.port}`;
  }

  const url = new URL("mysql://127.0.0.1");
  url.hostname = candidate.socketPath ? "127.0.0.1" : candidate.host;
  url.port = String(candidate.port ?? 3306);
  url.username = candidate.user;
  url.password = candidate.password;
  url.pathname = `/${candidate.database}`;
  process.env.DATABASE_URL = url.toString();
  process.env.SIMAMIA_DATABASE_SOURCE = "HOSTINGER_DATABASE_*";
}

function failureClass(result) {
  const text = `${result.code} ${result.errno ?? ""} ${result.sqlState ?? ""} ${result.message}`.toLowerCase();
  if (result.errno === 1045 || text.includes("access denied") || text.includes("28000")) {
    return "DATABASE_AUTH_FAILED";
  }
  if (result.errno === 1049 || text.includes("unknown database")) {
    return "DATABASE_NOT_FOUND";
  }
  if (
    text.includes("econnrefused") ||
    text.includes("enotfound") ||
    text.includes("ehostunreach") ||
    text.includes("timeout") ||
    text.includes("enoent")
  ) {
    return "DATABASE_UNREACHABLE";
  }
  return "DATABASE_CONNECTION_FAILED";
}

async function prepareDatabaseEnvironment() {
  const config = getRuntimeDatabaseConfig();

  if (!config) {
    process.env.SIMAMIA_DATABASE_PREFLIGHT_CODE = "DATABASE_CONFIGURATION_INVALID";
    console.error("SIMAMIA_DATABASE_CONFIG_INCOMPLETE", {
      hostPresent: Boolean(clean(process.env.DATABASE_HOST)),
      userPresent: Boolean(clean(process.env.DATABASE_USER)),
      passwordPresent: Boolean(clean(process.env.DATABASE_PASSWORD)),
      databasePresent: Boolean(clean(process.env.DATABASE_NAME)),
    });
    return false;
  }

  const failures = [];
  for (const candidate of buildCandidates(config)) {
    const result = await testDatabase(candidate);

    if (result.ok) {
      activateCandidate(candidate);
      delete process.env.SIMAMIA_DATABASE_PREFLIGHT_FAILED;
      process.env.SIMAMIA_DATABASE_PREFLIGHT_CODE = "OK";
      console.log("SIMAMIA_DATABASE_PREFLIGHT_OK", {
        ...safeConfig(candidate),
        transport: process.env.SIMAMIA_DATABASE_TRANSPORT,
        serverDatabase: result.database,
        currentUser: result.currentUser,
        serverHost: result.serverHost,
      });
      return true;
    }

    failures.push({
      label: candidate.label,
      transport: candidate.socketPath
        ? `unix:${candidate.socketPath}`
        : `tcp:${candidate.host}:${candidate.port}`,
      failureCode: failureClass(result),
      code: result.code,
      errno: result.errno,
      sqlState: result.sqlState,
      message: result.message,
    });
  }

  process.env.SIMAMIA_DATABASE_PREFLIGHT_FAILED = "1";
  process.env.SIMAMIA_DATABASE_PREFLIGHT_CODE =
    failures.find((failure) => failure.failureCode === "DATABASE_AUTH_FAILED")?.failureCode ??
    failures.at(-1)?.failureCode ??
    "DATABASE_CONNECTION_FAILED";

  console.error("SIMAMIA_DATABASE_PREFLIGHT_ALL_FAILED", {
    ...safeConfig(config),
    failureCode: process.env.SIMAMIA_DATABASE_PREFLIGHT_CODE,
    attempts: failures,
  });
  return false;
}

loadPackagedEnvironmentDefaults();

const authStatus = authSecretStatus();
if (authStatus.configured && authStatus.strongEnough) {
  console.log("SIMAMIA_AUTH_PREFLIGHT_OK", authStatus);
} else {
  console.error("SIMAMIA_AUTH_PREFLIGHT_FAILED", authStatus);
}

const hostname = process.env.APP_BIND_HOST || "0.0.0.0";
const port = process.env.PORT || "3000";
console.log(`SIMAMIA_START host=${hostname} port=${port}`);

const databaseReady = await prepareDatabaseEnvironment();

const schemaCompatScript = path.join(projectRoot, "scripts", "ensure-hostinger-schema.mjs");
if (databaseReady) {
  const schemaResult = spawnSync(process.execPath, [schemaCompatScript], {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  });
  if (schemaResult.status && schemaResult.status !== 0) {
    console.warn(`SIMAMIA_SCHEMA_COMPAT_WARNING exit=${schemaResult.status}; continuing startup`);
  }
} else {
  console.warn("SIMAMIA_SCHEMA_COMPAT_SKIPPED database preflight did not succeed");
}

const child = spawn(
  process.execPath,
  [nextCli, "start", "--hostname", hostname, "--port", port],
  { cwd: projectRoot, env: process.env, stdio: "inherit" },
);

let shuttingDown = false;
function forwardSignal(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (!child.killed) child.kill(signal);
}

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => forwardSignal(signal));
}

child.on("error", (error) => {
  console.error("SIMAMIA_START_ERROR", error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.exit(0);
  process.exit(code ?? 1);
});
