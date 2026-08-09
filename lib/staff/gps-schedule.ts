export type StaffGpsSchedule = {
  timeZone: string;
  startTime: string;
  stopTime: string;
  startMinute: number;
  stopMinute: number;
  currentMinute: number;
  currentLocalDate: string;
  currentLocalTime: string;
  isSharingWindow: boolean;
  mode: "DAY_WINDOW" | "OVERNIGHT_WINDOW" | "ALL_DAY";
};

const DEFAULT_TIME_ZONE = "Africa/Dar_es_Salaam";
const DEFAULT_START_TIME = "06:00";
const DEFAULT_STOP_TIME = "19:00";

function parseClock(value: unknown, fallback: string): {
  display: string;
  minutes: number;
} {
  const raw = String(value ?? "").trim();
  const candidate = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(raw);
  const source = candidate ? raw : fallback;
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(source);

  if (!match) {
    throw new Error("INVALID_GPS_SCHEDULE");
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  return {
    display: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    minutes: hour * 60 + minute,
  };
}

function localParts(date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const byType = new Map(parts.map((part) => [part.type, part.value]));
  const year = Number(byType.get("year"));
  const month = Number(byType.get("month"));
  const day = Number(byType.get("day"));
  const hour = Number(byType.get("hour"));
  const minute = Number(byType.get("minute"));

  if (![year, month, day, hour, minute].every(Number.isFinite)) {
    throw new Error("INVALID_GPS_TIME_ZONE");
  }

  return { year, month, day, hour, minute };
}

export function getStaffGpsSchedule(now = new Date()): StaffGpsSchedule {
  const timeZone =
    String(process.env.STAFF_GPS_TIME_ZONE || DEFAULT_TIME_ZONE).trim() ||
    DEFAULT_TIME_ZONE;
  const start = parseClock(
    process.env.STAFF_GPS_MORNING_START,
    DEFAULT_START_TIME,
  );
  const stop = parseClock(
    process.env.STAFF_GPS_NIGHT_STOP,
    DEFAULT_STOP_TIME,
  );
  const local = localParts(now, timeZone);
  const currentMinute = local.hour * 60 + local.minute;

  let isSharingWindow: boolean;
  let mode: StaffGpsSchedule["mode"];

  if (start.minutes === stop.minutes) {
    isSharingWindow = true;
    mode = "ALL_DAY";
  } else if (start.minutes < stop.minutes) {
    isSharingWindow =
      currentMinute >= start.minutes && currentMinute < stop.minutes;
    mode = "DAY_WINDOW";
  } else {
    isSharingWindow =
      currentMinute >= start.minutes || currentMinute < stop.minutes;
    mode = "OVERNIGHT_WINDOW";
  }

  return {
    timeZone,
    startTime: start.display,
    stopTime: stop.display,
    startMinute: start.minutes,
    stopMinute: stop.minutes,
    currentMinute,
    currentLocalDate: `${String(local.year).padStart(4, "0")}-${String(
      local.month,
    ).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`,
    currentLocalTime: `${String(local.hour).padStart(2, "0")}:${String(
      local.minute,
    ).padStart(2, "0")}`,
    isSharingWindow,
    mode,
  };
}
