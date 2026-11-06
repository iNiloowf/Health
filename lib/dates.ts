import type { Clock } from "./types";

export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDateKey(to).getTime() - parseDateKey(from).getTime()) / 86400000);
}

export function weekday(key: string): number {
  return parseDateKey(key).getDay();
}

export function dayOfMonth(key: string): number {
  return parseDateKey(key).getDate();
}

export function toMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 18 * 60;
  return hour * 60 + minute;
}

export function fromMinutes(mins: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(mins)));
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseDateKey(value);
  return dateKey(date) === value;
}

export function startOfWeek(key: string, weekStartsOn: 0 | 1): string {
  const diff = (weekday(key) - weekStartsOn + 7) % 7;
  return addDays(key, -diff);
}

export function weekKey(key: string, weekStartsOn: 0 | 1): string {
  return startOfWeek(key, weekStartsOn);
}

export function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to && dates.length < 400) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function formatLong(key: string): string {
  return parseDateKey(key).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatMedium(key: string): string {
  return parseDateKey(key).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatWeekday(key: string, width: "short" | "narrow" = "short"): string {
  return parseDateKey(key).toLocaleDateString(undefined, { weekday: width });
}

export function formatTime(time: string): string {
  const date = parseDateKey("2026-01-01");
  const mins = toMinutes(time);
  date.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function previousWeek(today: string, weekStartsOn: 0 | 1) {
  const start = addDays(startOfWeek(today, weekStartsOn), -7);
  return { start, end: addDays(start, 6), key: start };
}

export function monthStart(key: string): string {
  const date = parseDateKey(key);
  date.setDate(1);
  return dateKey(date);
}

export function zonedParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: hour * 60 + Number(parts.minute),
  };
}

export function clockFrom(now: Date, timeZone: string): Clock {
  try {
    const zoned = zonedParts(now, timeZone || "UTC");
    return { now, today: zoned.dateKey, minutes: zoned.minutes, iso: now.toISOString() };
  } catch {
    return {
      now,
      today: dateKey(now),
      minutes: now.getHours() * 60 + now.getMinutes(),
      iso: now.toISOString(),
    };
  }
}

export function makeClock(today: string, minutes: number): Clock {
  const date = parseDateKey(today);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return { now: date, today, minutes, iso: date.toISOString() };
}

export function greeting(name: string, minutes: number): string {
  const hello =
    minutes < 12 * 60 ? "Good morning" : minutes < 17 * 60 ? "Good afternoon" : minutes < 22 * 60 ? "Good evening" : "Good night";
  const trimmed = name.trim();
  return trimmed ? `${hello}, ${trimmed}` : hello;
}

export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
