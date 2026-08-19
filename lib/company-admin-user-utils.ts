export const COMPANY_USER_ROLES = new Set([
  "COMPANY_ADMIN",
  "ACCOUNTANT",
  "STAFF",
  "GPS_MANAGER",
]);

export const USER_GENDERS = new Set([
  "MALE",
  "FEMALE",
  "OTHER",
]);

export const EDITABLE_USER_STATUSES = new Set([
  "ACTIVE",
  "SUSPENDED",
]);

export function text(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

export function cleanText(value: unknown): string {
  return text(value).trim();
}

export function cleanEmail(value: unknown): string {
  return text(value).trim().toLowerCase();
}

export function cleanNida(value: unknown): string {
  return text(value).replace(/\s+/g, "").trim();
}

export function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validNida(value: string): boolean {
  return /^\d{20}$/.test(value);
}

export function normalizeRole(value: unknown): string {
  return cleanText(value).toUpperCase();
}

export function normalizeStatus(value: unknown): string {
  return cleanText(value).toUpperCase();
}

export function normalizeGender(value: unknown): string {
  return cleanText(value).toUpperCase();
}

export function safeUser<T extends Record<string, any>>(user: T) {
  if (!user) {
    return user;
  }

  const {
    passwordHash: _passwordHash,
    password: _legacyPassword,
    resetPasswordToken: _resetPasswordToken,
    passwordResetToken: _passwordResetToken,
    ...result
  } = user;

  return result;
}

export function safeUsers<T extends Record<string, any>>(users: T[]) {
  return users.map(safeUser);
}