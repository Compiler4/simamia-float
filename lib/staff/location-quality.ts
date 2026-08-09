export function usableCoordinatePair(
  latitude: unknown,
  longitude: unknown,
): boolean {
  const lat = Number(latitude);
  const lng = Number(longitude);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001)
  );
}

export function usableAccuracy(
  value: unknown,
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : null;
}

export function locationFresh(
  value: unknown,
  maximumAgeMs = 2 * 60 * 1000,
): boolean {
  if (!value) return false;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return false;
  return Date.now() - parsed.getTime() <= maximumAgeMs;
}
