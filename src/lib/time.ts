import { DateTime, Settings } from "luxon";
import { config } from "../config/env";

export const TIME_ZONE = config.timeZone;
Settings.defaultLocale = "en-US";

export function localNow(): DateTime {
  return DateTime.now().setZone(TIME_ZONE);
}

export function toLocal(d: Date): DateTime {
  return DateTime.fromJSDate(d).setZone(TIME_ZONE);
}

export function startOfLocalDay(d: Date = new Date()): Date {
  return toLocal(d).startOf("day").toJSDate();
}

export function startOfLocalMonth(d: Date = new Date()): Date {
  return toLocal(d).startOf("month").toJSDate();
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

/** Today's calendar date in the configured zone, as YYYY-MM-DD. */
export function localToday(): string {
  return localNow().toISODate()!;
}

/**
 * Prisma maps @db.Date columns to a Date at UTC midnight; this builds that
 * representation from a YYYY-MM-DD string.
 */
export function calendarDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function calendarDateToIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isCalendarDate(d: Date): boolean {
  return (
    d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0
  );
}

/** UTC instants bounding a local calendar day: [start, end). */
export function localDayBounds(isoDate: string): { start: Date; end: Date } {
  const start = DateTime.fromISO(isoDate, { zone: TIME_ZONE }).startOf("day");
  return { start: start.toJSDate(), end: start.plus({ days: 1 }).toJSDate() };
}

export function parseIsoDate(value: unknown): string | null {
  const s = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return DateTime.fromISO(s).isValid ? s : null;
}

/** Parse an <input type="datetime-local"> value as wall-clock time in the configured zone. */
export function parseLocalDateTime(value: unknown): Date | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const dt = DateTime.fromISO(s.replace(" ", "T"), { zone: TIME_ZONE });
  return dt.isValid ? dt.toJSDate() : null;
}

/** Parse an ISO-8601 timestamp from a query string (FullCalendar start/end). */
export function parseIsoTimestamp(value: unknown): Date | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const dt = DateTime.fromISO(s.replace(" ", "+"), { zone: TIME_ZONE, setZone: false });
  return dt.isValid ? dt.toJSDate() : null;
}

export function toDatetimeLocalInput(d: Date | null | undefined): string {
  return d ? toLocal(d).toFormat("yyyy-MM-dd'T'HH:mm") : "";
}

export function formatLocal(d: Date, luxonFormat: string): string {
  return toLocal(d).toFormat(luxonFormat);
}

/** Matches Python's strftime('%d %b %Y, %I:%M %p') used in activity subjects. */
export function formatHumanDateTime(d: Date): string {
  return formatLocal(d, "dd LLL yyyy, hh:mm a");
}

const MONTH_ABBR_AP = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];

function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  return ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[day % 10] ?? "th";
}

function djangoTimeP(dt: DateTime): string {
  if (dt.minute === 0 && dt.hour === 0) return "midnight";
  if (dt.minute === 0 && dt.hour === 12) return "noon";
  const h = dt.hour % 12 || 12;
  const minutes = dt.minute ? `:${String(dt.minute).padStart(2, "0")}` : "";
  return `${h}${minutes} ${dt.hour < 12 ? "a.m." : "p.m."}`;
}

/**
 * Implements Django's `date` / `time` template filter format characters so the
 * converted templates render exactly the same strings.
 */
export function formatDjango(value: unknown, format: string): string {
  if (value === null || value === undefined || value === "") return "";
  let dt: DateTime;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    dt = isCalendarDate(value) && !/[aAfgGhHiPsu]/.test(format)
      ? DateTime.fromJSDate(value, { zone: "UTC" })
      : toLocal(value);
  } else if (typeof value === "string") {
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? DateTime.fromISO(value, { zone: "UTC" })
      : DateTime.fromISO(value).setZone(TIME_ZONE);
    if (!parsed.isValid) return "";
    dt = parsed;
  } else if (DateTime.isDateTime(value)) {
    dt = value;
  } else {
    return "";
  }

  let out = "";
  for (let i = 0; i < format.length; i++) {
    const ch = format[i]!;
    if (ch === "\\") {
      out += format[++i] ?? "";
      continue;
    }
    switch (ch) {
      case "d": out += dt.toFormat("dd"); break;
      case "j": out += String(dt.day); break;
      case "D": out += dt.toFormat("ccc"); break;
      case "l": out += dt.toFormat("cccc"); break;
      case "S": out += ordinalSuffix(dt.day); break;
      case "w": out += String(dt.weekday % 7); break;
      case "z": out += String(dt.ordinal); break;
      case "W": out += String(dt.weekNumber); break;
      case "m": out += dt.toFormat("MM"); break;
      case "n": out += String(dt.month); break;
      case "M": out += dt.toFormat("LLL"); break;
      case "b": out += dt.toFormat("LLL").toLowerCase(); break;
      case "F": case "E": out += dt.toFormat("LLLL"); break;
      case "N": out += MONTH_ABBR_AP[dt.month - 1]; break;
      case "t": out += String(dt.daysInMonth); break;
      case "L": out += dt.isInLeapYear ? "True" : "False"; break;
      case "y": out += dt.toFormat("yy"); break;
      case "Y": out += String(dt.year); break;
      case "H": out += dt.toFormat("HH"); break;
      case "G": out += String(dt.hour); break;
      case "h": out += dt.toFormat("hh"); break;
      case "g": out += String(dt.hour % 12 || 12); break;
      case "i": out += dt.toFormat("mm"); break;
      case "s": out += dt.toFormat("ss"); break;
      case "u": out += dt.toFormat("SSS") + "000"; break;
      case "a": out += dt.hour < 12 ? "a.m." : "p.m."; break;
      case "A": out += dt.hour < 12 ? "AM" : "PM"; break;
      case "P": out += djangoTimeP(dt); break;
      case "f": out += dt.minute ? `${dt.hour % 12 || 12}:${dt.toFormat("mm")}` : String(dt.hour % 12 || 12); break;
      case "e": out += dt.zoneName ?? ""; break;
      case "T": out += dt.offsetNameShort ?? ""; break;
      case "O": out += dt.toFormat("ZZZ"); break;
      case "c": out += dt.toISO() ?? ""; break;
      case "r": out += dt.toRFC2822() ?? ""; break;
      case "U": out += String(Math.floor(dt.toSeconds())); break;
      default: out += ch;
    }
  }
  return out;
}
