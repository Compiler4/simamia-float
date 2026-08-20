import "server-only";

function primitiveText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return "";
}

/**
 * Prisma driver-adapter errors often keep the useful MySQL message inside
 * `cause`, `meta`, or a nested object instead of the top-level Error.message.
 * Collect a bounded, server-only diagnostic string so Runtime logs show the
 * real failure while API responses expose only safe error codes.
 */
export function databaseErrorDetails(error: unknown): string {
  const seen = new Set<unknown>();
  const parts: string[] = [];

  function visit(value: unknown, depth: number) {
    if (depth > 5 || value === null || value === undefined || seen.has(value)) return;

    const simple = primitiveText(value);
    if (simple) {
      parts.push(simple);
      return;
    }

    if (typeof value !== "object") return;
    seen.add(value);

    if (value instanceof Error) {
      if (value.name) parts.push(value.name);
      if (value.message) parts.push(value.message);
    }

    const record = value as Record<string, unknown>;
    for (const key of ["code", "errno", "sqlState", "sqlMessage", "message", "name"]) {
      const text = primitiveText(record[key]);
      if (text) parts.push(`${key}:${text}`);
    }

    for (const key of ["cause", "meta", "error", "originalError", "driverError"]) {
      if (record[key] !== undefined) visit(record[key], depth + 1);
    }
  }

  visit(error, 0);

  return Array.from(new Set(parts.map((part) => part.trim()).filter(Boolean))).join(" | ");
}

export type DatabaseFailureCode =
  | "DATABASE_AUTH_FAILED"
  | "DATABASE_NOT_FOUND"
  | "DATABASE_UNREACHABLE"
  | "DATABASE_SCHEMA_MISMATCH"
  | "DATABASE_CONFIGURATION_INVALID"
  | "PRISMA_RUNTIME_MISMATCH"
  | "DATABASE_QUERY_FAILED";

export function classifyDatabaseError(error: unknown): DatabaseFailureCode {
  const message = databaseErrorDetails(error).toLowerCase();

  if (
    message.includes("access denied") ||
    message.includes("authentication") ||
    message.includes("p1000") ||
    message.includes("1045")
  ) {
    return "DATABASE_AUTH_FAILED";
  }

  if (message.includes("unknown database") || message.includes("1049")) {
    return "DATABASE_NOT_FOUND";
  }

  if (
    message.includes("econnrefused") ||
    message.includes("can't reach") ||
    message.includes("cannot reach") ||
    message.includes("connection refused") ||
    message.includes("connection timeout") ||
    message.includes("connect timeout") ||
    message.includes("pool timeout") ||
    message.includes("p1001") ||
    message.includes("p1017") ||
    message.includes("enotfound") ||
    message.includes("ehostunreach")
  ) {
    return "DATABASE_UNREACHABLE";
  }

  if (
    message.includes("unknown column") ||
    message.includes("doesn't exist") ||
    message.includes("does not exist") ||
    message.includes("no such table") ||
    message.includes("table") && message.includes("not found") ||
    message.includes("column") && message.includes("not found") ||
    message.includes("1054") ||
    message.includes("1146")
  ) {
    return "DATABASE_SCHEMA_MISMATCH";
  }

  if (
    message.includes("database_url") ||
    message.includes("database_host") ||
    message.includes("must start with mysql") ||
    message.includes("missing database setting")
  ) {
    return "DATABASE_CONFIGURATION_INVALID";
  }

  if (
    message.includes("driver adapter") ||
    message.includes("adapter") && message.includes("prisma") ||
    message.includes("clientversion") ||
    message.includes("query interpreter") ||
    message.includes("cannot read properties of undefined")
  ) {
    return "PRISMA_RUNTIME_MISMATCH";
  }

  return "DATABASE_QUERY_FAILED";
}
