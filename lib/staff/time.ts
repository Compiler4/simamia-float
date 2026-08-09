const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

export function tzDateKey(value: Date | string | number = new Date()): string {
  const date = new Date(value);
  return new Date(date.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

export function dateAtNoon(dateKey: string): Date {
  const value = new Date(`${dateKey}T12:00:00+03:00`);
  if (Number.isNaN(value.getTime())) throw new Error("INVALID_DATE");
  return value;
}

export function dayBounds(dateKey = tzDateKey()): { start: Date; end: Date } {
  return {
    start: new Date(`${dateKey}T00:00:00+03:00`),
    end: new Date(`${dateKey}T23:59:59.999+03:00`),
  };
}

export function reportBounds(
  period: string,
  anchor = tzDateKey(),
): { start: Date; end: Date; label: string } {
  const base = new Date(`${anchor}T12:00:00+03:00`);
  if (Number.isNaN(base.getTime())) throw new Error("INVALID_DATE");

  const key = period.toUpperCase();
  let start: Date;
  let end: Date;
  let label: string;

  if (key === "WEEK") {
    const weekday = (base.getUTCDay() + 6) % 7;
    start = new Date(base);
    start.setUTCDate(start.getUTCDate() - weekday);
    start = new Date(`${tzDateKey(start)}T00:00:00+03:00`);
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    end = new Date(`${tzDateKey(end)}T23:59:59.999+03:00`);
    label = "This week";
  } else if (key === "MONTH") {
    const shifted = new Date(base.getTime() + TZ_OFFSET_MS);
    const year = shifted.getUTCFullYear();
    const month = shifted.getUTCMonth();
    start = new Date(Date.UTC(year, month, 1) - TZ_OFFSET_MS);
    end = new Date(Date.UTC(year, month + 1, 1) - TZ_OFFSET_MS - 1);
    label = new Intl.DateTimeFormat("en-TZ", {
      month: "long",
      year: "numeric",
      timeZone: "Africa/Dar_es_Salaam",
    }).format(base);
  } else if (key === "YEAR") {
    const shifted = new Date(base.getTime() + TZ_OFFSET_MS);
    const year = shifted.getUTCFullYear();
    start = new Date(Date.UTC(year, 0, 1) - TZ_OFFSET_MS);
    end = new Date(Date.UTC(year + 1, 0, 1) - TZ_OFFSET_MS - 1);
    label = String(year);
  } else {
    ({ start, end } = dayBounds(anchor));
    label = new Intl.DateTimeFormat("en-TZ", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "Africa/Dar_es_Salaam",
    }).format(base);
  }

  return { start, end, label };
}

export function currentMinutesTz(value = new Date()): number {
  const shifted = new Date(value.getTime() + TZ_OFFSET_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

export function settingTimeToMinutes(value: string | null | undefined, fallback = "17:00"): number {
  const raw = (value || fallback).trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!match) return 17 * 60;
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return hour * 60 + minute;
}
