import { PortalHttpError } from "./auth";

const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

function localParts(value: Date) {
  const shifted = new Date(value.getTime() + TZ_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

export function tanzaniaDateKey(value: Date) {
  const { year, month, day } = localParts(value);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function startOfTanzaniaDay(value: Date) {
  const { year, month, day } = localParts(value);
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - TZ_OFFSET_MS);
}

export function endOfTanzaniaDay(value: Date) {
  return new Date(startOfTanzaniaDay(value).getTime() + 86_400_000 - 1);
}

export function parseDateInput(value: unknown, fallback = new Date()) {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T12:00:00+03:00`)
    : new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new PortalHttpError("Enter a valid date.", 400);
  }
  return parsed;
}

export function rangeFromSearch(params: URLSearchParams) {
  const period = String(params.get("period") ?? "DAY").toUpperCase();
  const anchor = parseDateInput(params.get("anchor"), new Date());
  const dayStart = startOfTanzaniaDay(anchor);
  let start = dayStart;
  let end = endOfTanzaniaDay(anchor);

  if (period === "WEEK") {
    const shifted = new Date(anchor.getTime() + TZ_OFFSET_MS);
    const day = shifted.getUTCDay() || 7;
    start = new Date(dayStart.getTime() - (day - 1) * 86_400_000);
    end = new Date(start.getTime() + 7 * 86_400_000 - 1);
  } else if (period === "MONTH") {
    const { year, month } = localParts(anchor);
    start = new Date(Date.UTC(year, month, 1) - TZ_OFFSET_MS);
    end = new Date(Date.UTC(year, month + 1, 1) - TZ_OFFSET_MS - 1);
  } else if (period === "YEAR") {
    const { year } = localParts(anchor);
    start = new Date(Date.UTC(year, 0, 1) - TZ_OFFSET_MS);
    end = new Date(Date.UTC(year + 1, 0, 1) - TZ_OFFSET_MS - 1);
  } else if (period === "CUSTOM") {
    start = startOfTanzaniaDay(parseDateInput(params.get("from")));
    end = endOfTanzaniaDay(parseDateInput(params.get("to")));
    if (end < start) {
      throw new PortalHttpError(
        "The custom end date must be after the start date.",
        400,
      );
    }
  } else if (period !== "DAY") {
    throw new PortalHttpError("Unsupported report period.", 400);
  }

  return {
    period,
    start,
    end,
    label: `${tanzaniaDateKey(start)} to ${tanzaniaDateKey(end)}`,
  };
}

export function timeOnDate(date: Date, time: unknown) {
  const value = String(time ?? "").trim();
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (hours > 23 || minutes > 59) return null;
  return new Date(
    startOfTanzaniaDay(date).getTime() +
      hours * 60 * 60 * 1000 +
      minutes * 60 * 1000,
  );
}
