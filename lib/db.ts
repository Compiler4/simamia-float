import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

type PrismaGlobal = typeof globalThis & {
  __simamiaPrisma?: PrismaClient;
};

type MariaDbConfig = ConstructorParameters<typeof PrismaMariaDb>[0];
type MariaDbPoolConfig = Exclude<MariaDbConfig, string>;

function isBuildOnlyPhase(): boolean {
  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build"
  );
}

function isVercelRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.VERCEL_ENV ||
      process.env.VERCEL_URL ||
      process.env.NOW_REGION,
  );
}

function isLocalDatabaseHost(host: string): boolean {
  return ["127.0.0.1", "localhost", "::1"].includes(host.trim().toLowerCase());
}

function isVercelLikeAppUrl(): boolean {
  const appUrl = cleanEnvValue(process.env.APP_URL);
  if (!appUrl) return false;

  try {
    const hostname = new URL(appUrl).hostname.toLowerCase();
    return hostname === "vercel.app" || hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

function canAllowLocalDatabaseHost(): boolean {
  return (
    cleanEnvValue(process.env.ALLOW_LOCAL_DATABASE_IN_PRODUCTION) === "1" &&
    !isVercelRuntime() &&
    !isVercelLikeAppUrl()
  );
}

function shouldBlockLocalDatabaseHost(): boolean {
  return (
    !isBuildOnlyPhase() &&
    !canAllowLocalDatabaseHost() &&
    (isVercelRuntime() || process.env.NODE_ENV === "production")
  );
}

/**
 * Hostinger hPanel values can be entered manually or imported from an .env.
 * Some flows preserve wrapping quotes. Strip only one matching pair of outer
 * quotes so a value such as "Compiler@@123" is sent to MySQL as Compiler@@123.
 */
export function cleanEnvValue(value: string | undefined): string {
  if (value === undefined) return "";

  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function normalizeHostingerHost(host: string): string {
  const normalized = host.trim().toLowerCase();
  const provider = cleanEnvValue(process.env.HOSTING_PROVIDER).toLowerCase();

  // Runtime logs showed Node resolving localhost to IPv6 ::1, while the
  // Hostinger database user is intended for a local website connection.
  // Prefer IPv4 TCP unless startup selected a Unix socket.
  if (provider === "hostinger" && (normalized === "localhost" || normalized === "::1")) {
    return "127.0.0.1";
  }

  return host;
}

function configuredSocketPath(): string {
  return cleanEnvValue(process.env.DATABASE_SOCKET);
}

function required(name: string, value: string | undefined, fallback: string): string {
  const cleaned = cleanEnvValue(value);
  if (cleaned) return cleaned;

  if (isBuildOnlyPhase()) return fallback;

  throw new Error(
    `Missing database setting ${name}. Add DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD and DATABASE_NAME to the hosting environment.`,
  );
}

function numberSetting(name: string, value: string | undefined, fallback: number): number {
  const cleaned = cleanEnvValue(value);
  if (!cleaned) return fallback;

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }

  return parsed;
}

function validateDatabaseHost(host: string): void {
  if (shouldBlockLocalDatabaseHost() && isLocalDatabaseHost(host)) {
    throw new Error(
      "DATABASE_HOST points to localhost. On Hostinger this is valid only when ALLOW_LOCAL_DATABASE_IN_PRODUCTION=1. On remote platforms use the actual hosted database hostname.",
    );
  }
}

function configFromDatabaseUrl(databaseUrl: string): MariaDbPoolConfig {
  let url: URL;

  try {
    url = new URL(cleanEnvValue(databaseUrl));
  } catch {
    throw new Error(
      "DATABASE_URL is invalid. Use mysql://USER:PASSWORD@HOST:3306/DATABASE.",
    );
  }

  if (!["mysql:", "mariadb:"].includes(url.protocol)) {
    throw new Error("DATABASE_URL must start with mysql:// or mariadb://.");
  }

  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  const socketPath = configuredSocketPath();
  const host = normalizeHostingerHost(
    required("DATABASE_HOST", url.hostname, "127.0.0.1"),
  );

  validateDatabaseHost(host);

  const common = {
    user: required("DATABASE_USER", decodeURIComponent(url.username), "root"),
    password: decodeURIComponent(url.password),
    database: required("DATABASE_NAME", database, "simamia"),
    connectionLimit: numberSetting(
      "DATABASE_CONNECTION_LIMIT",
      process.env.DATABASE_CONNECTION_LIMIT,
      5,
    ),
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
    port: numberSetting("DATABASE_PORT", url.port, 3306),
  };
}

function hasSeparateDatabaseSettings(): boolean {
  return Boolean(
    cleanEnvValue(process.env.DATABASE_HOST) &&
      cleanEnvValue(process.env.DATABASE_USER) &&
      cleanEnvValue(process.env.DATABASE_NAME),
  );
}

function configFromSeparateSettings(): MariaDbPoolConfig {
  const socketPath = configuredSocketPath();
  const host = normalizeHostingerHost(
    required("DATABASE_HOST", process.env.DATABASE_HOST, "127.0.0.1"),
  );

  validateDatabaseHost(host);

  const common = {
    user: required("DATABASE_USER", process.env.DATABASE_USER, "root"),
    password: cleanEnvValue(process.env.DATABASE_PASSWORD),
    database: required("DATABASE_NAME", process.env.DATABASE_NAME, "simamia"),
    connectionLimit: numberSetting(
      "DATABASE_CONNECTION_LIMIT",
      process.env.DATABASE_CONNECTION_LIMIT,
      5,
    ),
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
    port: numberSetting("DATABASE_PORT", process.env.DATABASE_PORT, 3306),
  };
}

/**
 * Hostinger production rule:
 *
 * 1. Prefer DATABASE_* values from hPanel.
 * 2. Use DATABASE_URL only as a fallback when the separate settings are absent.
 *
 * This prevents a stale DATABASE_URL from overriding a newly corrected
 * DATABASE_PASSWORD in hPanel.
 */
function getMariaDbConfig(): MariaDbPoolConfig {
  if (hasSeparateDatabaseSettings()) {
    return configFromSeparateSettings();
  }

  const databaseUrl = cleanEnvValue(process.env.DATABASE_URL);
  if (databaseUrl) {
    return configFromDatabaseUrl(databaseUrl);
  }

  return configFromSeparateSettings();
}

export function databaseConfigurationSummary() {
  const source = hasSeparateDatabaseSettings() ? "DATABASE_*" : "DATABASE_URL";

  try {
    const config = getMariaDbConfig();
    const record = config as MariaDbPoolConfig & { socketPath?: string; host?: string; port?: number };
    return {
      source,
      host: record.socketPath ? "localhost" : record.host,
      port: record.socketPath ? "socket" : record.port,
      socketPath: record.socketPath || null,
      transport:
        cleanEnvValue(process.env.SIMAMIA_DATABASE_TRANSPORT) ||
        (record.socketPath ? `unix:${record.socketPath}` : `tcp:${record.host}:${record.port}`),
      user: config.user,
      database: config.database,
      passwordPresent: Boolean(config.password),
      connectionLimit: config.connectionLimit,
    };
  } catch {
    return {
      source,
      host: cleanEnvValue(process.env.DATABASE_HOST) || "missing",
      port: numberSetting("DATABASE_PORT", process.env.DATABASE_PORT, 3306),
      user: cleanEnvValue(process.env.DATABASE_USER) || "missing",
      database: cleanEnvValue(process.env.DATABASE_NAME) || "missing",
      passwordPresent: Boolean(cleanEnvValue(process.env.DATABASE_PASSWORD)),
      connectionLimit: numberSetting(
        "DATABASE_CONNECTION_LIMIT",
        process.env.DATABASE_CONNECTION_LIMIT,
        10,
      ),
    };
  }
}

function createDatabaseClient(): PrismaClient {
  const adapter = new PrismaMariaDb(getMariaDbConfig());

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const prismaGlobal = globalThis as PrismaGlobal;

export const db = prismaGlobal.__simamiaPrisma ?? createDatabaseClient();

if (process.env.NODE_ENV !== "production") {
  prismaGlobal.__simamiaPrisma = db;
}

export const prisma = db;
export default db;
