// lib/client-safe.ts

/**
 * Safely converts an unknown value into an array.
 *
 * This prevents runtime crashes when APIs return:
 * - undefined
 * - null
 * - objects
 * - missing optional fields
 */
export function safeArray<T = any>(
  value: unknown,
): T[] {
  return Array.isArray(value)
    ? (value as T[])
    : [];
}

/**
 * Safely converts nullable/unknown values to text.
 */
export function safeText(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value);
}

/**
 * Safely converts an unknown value to a finite number.
 */
export function safeNumber(
  value: unknown,
  fallback = 0,
): number {
  const number =
    Number(value);

  return Number.isFinite(
    number,
  )
    ? number
    : fallback;
}

/**
 * Safely converts an unknown value to an object.
 */
export function safeObject<
  T extends Record<string, any> =
    Record<string, any>,
>(
  value: unknown,
): T {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as T;
  }

  return {} as T;
}