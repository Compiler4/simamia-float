import "server-only";

export type ReportPeriod = "DAY" | "WEEK" | "MONTH" | "YEAR" | "CUSTOM";

const TZ_OFFSET = "+03:00";

function dateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dar_es_Salaam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parseDateKey(value: string, end = false) {
  const suffix = end ? "T23:59:59.999" : "T00:00:00.000";
  const parsed = new Date(`${value}${suffix}${TZ_OFFSET}`);
  if (Number.isNaN(parsed.getTime())) throw new Error("The selected date is invalid.");
  return parsed;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function localParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dar_es_Salaam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: String(parts.weekday),
  };
}

export function resolveRange(params: URLSearchParams) {
  const period = String(params.get("period") ?? "MONTH").toUpperCase() as ReportPeriod;
  const safePeriod: ReportPeriod = ["DAY", "WEEK", "MONTH", "YEAR", "CUSTOM"].includes(period)
    ? period
    : "MONTH";
  const anchorKey = params.get("anchor") || dateKey(new Date());
  const anchor = parseDateKey(anchorKey);
  const parts = localParts(anchor);

  let start: Date;
  let end: Date;

  if (safePeriod === "CUSTOM") {
    const from = params.get("from") || anchorKey;
    const to = params.get("to") || from;
    start = parseDateKey(from);
    end = parseDateKey(to, true);
  } else if (safePeriod === "DAY") {
    start = parseDateKey(anchorKey);
    end = parseDateKey(anchorKey, true);
  } else if (safePeriod === "WEEK") {
    const weekIndex: Record<string, number> = {
      Mon: 0,
      Tue: 1,
      Wed: 2,
      Thu: 3,
      Fri: 4,
      Sat: 5,
      Sun: 6,
    };
    const monday = addDays(anchor, -(weekIndex[parts.weekday] ?? 0));
    start = parseDateKey(dateKey(monday));
    end = parseDateKey(dateKey(addDays(monday, 6)), true);
  } else if (safePeriod === "YEAR") {
    start = parseDateKey(`${parts.year}-01-01`);
    end = parseDateKey(`${parts.year}-12-31`, true);
  } else {
    const month = String(parts.month).padStart(2, "0");
    const first = `${parts.year}-${month}-01`;
    const lastDate = new Date(Date.UTC(parts.year, parts.month, 0));
    const last = `${parts.year}-${month}-${String(lastDate.getUTCDate()).padStart(2, "0")}`;
    start = parseDateKey(first);
    end = parseDateKey(last, true);
  }

  if (start > end) throw new Error("The start date cannot be after the end date.");

  const label = `${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "Africa/Dar_es_Salaam",
  }).format(start)} – ${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "Africa/Dar_es_Salaam",
  }).format(end)}`;

  return {
    period: safePeriod,
    anchor: anchorKey,
    start,
    end,
    startKey: dateKey(start),
    endKey: dateKey(end),
    label,
  };
}

export function isWithin(value: unknown, start: Date, end: Date) {
  if (!value) return false;
  const parsed = new Date(String(value));
  return !Number.isNaN(parsed.getTime()) && parsed >= start && parsed <= end;
}
