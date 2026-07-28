const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type Period = "DAY" | "WEEK" | "MONTH" | "YEAR" | "CUSTOM";

function parseCalendarDate(value: string | null | undefined) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = Date.UTC(year, month - 1, day);
  const test = new Date(utc);
  if (
    test.getUTCFullYear() !== year ||
    test.getUTCMonth() !== month - 1 ||
    test.getUTCDate() !== day
  ) return null;
  return { year, month, day, localEpoch: utc };
}

function localEpochToInstant(localEpoch: number) {
  return new Date(localEpoch - TZ_OFFSET_MS);
}

function formatCalendar(localEpoch: number) {
  const date = new Date(localEpoch);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function currentDarCalendarDate() {
  const shifted = new Date(Date.now() + TZ_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    localEpoch: Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ),
  };
}

export function resolveRange(searchParams: URLSearchParams) {
  const period = (String(searchParams.get("period") || "DAY").toUpperCase() as Period);
  const safePeriod: Period = ["DAY", "WEEK", "MONTH", "YEAR", "CUSTOM"].includes(period)
    ? period
    : "DAY";
  const anchor = parseCalendarDate(searchParams.get("anchor")) ?? currentDarCalendarDate();

  let startLocal = anchor.localEpoch;
  let endLocal = anchor.localEpoch + DAY_MS;

  if (safePeriod === "WEEK") {
    const weekday = new Date(anchor.localEpoch).getUTCDay();
    const fromMonday = (weekday + 6) % 7;
    startLocal = anchor.localEpoch - fromMonday * DAY_MS;
    endLocal = startLocal + 7 * DAY_MS;
  } else if (safePeriod === "MONTH") {
    startLocal = Date.UTC(anchor.year, anchor.month - 1, 1);
    endLocal = Date.UTC(anchor.year, anchor.month, 1);
  } else if (safePeriod === "YEAR") {
    startLocal = Date.UTC(anchor.year, 0, 1);
    endLocal = Date.UTC(anchor.year + 1, 0, 1);
  } else if (safePeriod === "CUSTOM") {
    const from = parseCalendarDate(searchParams.get("from")) ?? anchor;
    const to = parseCalendarDate(searchParams.get("to")) ?? from;
    startLocal = Math.min(from.localEpoch, to.localEpoch);
    endLocal = Math.max(from.localEpoch, to.localEpoch) + DAY_MS;
  }

  const fromCalendar = formatCalendar(startLocal);
  const toCalendar = formatCalendar(endLocal - DAY_MS);

  return {
    period: safePeriod,
    from: localEpochToInstant(startLocal),
    toExclusive: localEpochToInstant(endLocal),
    fromCalendar,
    toCalendar,
    label: fromCalendar === toCalendar ? fromCalendar : `${fromCalendar} to ${toCalendar}`,
  };
}

export function darDate(value: string) {
  const parsed = parseCalendarDate(value);
  if (!parsed) throw new Error("A valid date in YYYY-MM-DD format is required.");
  return localEpochToInstant(parsed.localEpoch);
}

export function darDateTime(date: string, time: string | null | undefined) {
  const parsed = parseCalendarDate(date);
  if (!parsed) return null;
  const match = String(time ?? "").match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return new Date(parsed.localEpoch + hour * 60 * 60 * 1000 + minute * 60 * 1000 - TZ_OFFSET_MS);
}

export function calendarDateInDar(value: Date) {
  const shifted = new Date(value.getTime() + TZ_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

export function currentHourInDar(value = new Date()) {
  return new Date(value.getTime() + TZ_OFFSET_MS).getUTCHours();
}
