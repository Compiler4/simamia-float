const DAR_OFFSET_MS = 3 * 60 * 60 * 1000;

export function numberValue(
  value: unknown,
  name?: string,
): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    if (name) throw new Error(`INVALID:${name}`);
    return 0;
  }

  return parsed;
}

function dateOnlyParts(value: string): {
  year: number;
  monthIndex: number;
  day: number;
} | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  const validationDate = new Date(
    Date.UTC(year, monthIndex, day),
  );

  if (
    validationDate.getUTCFullYear() !== year ||
    validationDate.getUTCMonth() !== monthIndex ||
    validationDate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, monthIndex, day };
}

/**
 * Returns the start and end of a calendar day in Africa/Dar_es_Salaam.
 *
 * Important behaviour:
 * - Missing, null or blank input means "today".
 * - YYYY-MM-DD is interpreted as a Dar es Salaam calendar date.
 * - Date/timestamp inputs are converted to their Dar es Salaam date.
 * - An explicitly supplied invalid value still throws INVALID_DATE.
 */
export function darDayBounds(
  value: unknown = new Date(),
): { start: Date; end: Date } {
  const missing =
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "");

  const resolvedValue = missing ? new Date() : value;

  if (typeof resolvedValue === "string") {
    const raw = resolvedValue.trim();
    const parts = dateOnlyParts(raw);

    if (parts) {
      const start = new Date(
        Date.UTC(
          parts.year,
          parts.monthIndex,
          parts.day,
          0,
          0,
          0,
          0,
        ) - DAR_OFFSET_MS,
      );

      const end = new Date(
        Date.UTC(
          parts.year,
          parts.monthIndex,
          parts.day,
          23,
          59,
          59,
          999,
        ) - DAR_OFFSET_MS,
      );

      return { start, end };
    }
  }

  const source =
    resolvedValue instanceof Date
      ? new Date(resolvedValue.getTime())
      : new Date(String(resolvedValue));

  if (Number.isNaN(source.getTime())) {
    throw new Error("INVALID_DATE");
  }

  const shifted = new Date(
    source.getTime() + DAR_OFFSET_MS,
  );
  const year = shifted.getUTCFullYear();
  const monthIndex = shifted.getUTCMonth();
  const day = shifted.getUTCDate();

  const start = new Date(
    Date.UTC(year, monthIndex, day, 0, 0, 0, 0) -
      DAR_OFFSET_MS,
  );

  const end = new Date(
    Date.UTC(
      year,
      monthIndex,
      day,
      23,
      59,
      59,
      999,
    ) - DAR_OFFSET_MS,
  );

  return { start, end };
}

export function distanceMetres(
  firstLatitude: number,
  firstLongitude: number,
  secondLatitude: number,
  secondLongitude: number,
): number {
  const radians = (value: number) =>
    (value * Math.PI) / 180;
  const earthRadiusMetres = 6_371_000;
  const latitudeDelta = radians(
    secondLatitude - firstLatitude,
  );
  const longitudeDelta = radians(
    secondLongitude - firstLongitude,
  );
  const firstLatitudeRadians = radians(firstLatitude);
  const secondLatitudeRadians = radians(secondLatitude);

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitudeRadians) *
      Math.cos(secondLatitudeRadians) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    earthRadiusMetres *
    2 *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  );
}
