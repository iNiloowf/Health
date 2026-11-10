import { toMinutes } from "./dates";
import { foldIsWaiting } from "./model";
import type { AppData, Area, Clock, Profile } from "./types";

export interface DueReminder {
  key: string;
  occurrenceId: string;
  title: string;
  body: string;
}

export function inQuietHours(clock: Clock, profile: Profile, area: Area): boolean {
  const start = toMinutes(profile.quietStart);
  const end = toMinutes(profile.quietEnd);
  const quiet = start === end ? false : start < end ? clock.minutes >= start && clock.minutes < end : clock.minutes >= start || clock.minutes < end;
  if (!quiet) return false;
  if (area === "work") {
    const workStart = toMinutes(profile.workStart);
    const workEnd = toMinutes(profile.workEnd);
    if (clock.minutes >= workStart && clock.minutes < workEnd) return false;
  }
  return true;
}

export function dueReminders(data: AppData, clock: Clock): DueReminder[] {
  if (!data.profile?.notificationsEnabled) return [];
  const reminders: DueReminder[] = [];
  for (const item of data.occurrences) {
    if (item.status !== "pending" || item.reminderMinutes == null || item.date !== clock.today || foldIsWaiting(data, item)) continue;
    if (item.snoozedUntil && item.snoozedUntil > clock.iso) continue;
    if (inQuietHours(clock, data.profile, item.area)) continue;
    const scheduled = toMinutes(item.time);
    const due = scheduled - item.reminderMinutes;
    const snoozed = Boolean(item.snoozedUntil && item.snoozedUntil <= clock.iso);
    if (!snoozed && (clock.minutes < due || clock.minutes > scheduled + 45)) continue;
    const key = `${item.id}:${item.snoozedUntil || `${item.date}-${item.time}`}`;
    if (data.firedReminders.includes(key)) continue;
    reminders.push({
      key,
      occurrenceId: item.id,
      title: item.titleSnapshot,
      body: snoozed ? "Snoozed reminder" : `Around ${item.time}`,
    });
  }
  return reminders;
}

export function upcomingReminders(data: AppData, clock: Clock) {
  return data.occurrences
    .filter((item) => item.status === "pending" && (item.date > clock.today || (item.date === clock.today && toMinutes(item.time) >= clock.minutes - 30)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .slice(0, 3);
}
