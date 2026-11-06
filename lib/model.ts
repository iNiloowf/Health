import { addDays, daysBetween, dayOfMonth, fromMinutes, parseDateKey, toMinutes, weekday } from "./dates";
import type { Clock, Occurrence, Priority, Recurrence, Task, TaskInput } from "./types";

export function uid(): string {
  return crypto.randomUUID();
}

export function suggestedXp(duration: number, priority: Priority): number {
  if (priority === "high" || duration >= 45) return 30;
  if (priority === "medium" || duration >= 20) return 20;
  if (duration <= 10 && priority === "low") return 5;
  return 10;
}

export function normalizeAnchor(anchor: string, rule: Recurrence): string {
  for (let offset = 0; offset < 62; offset += 1) {
    const date = addDays(anchor, offset);
    if (dateMatches(anchor, date, rule)) return date;
  }
  return anchor;
}

function dateMatches(anchor: string, date: string, rule: Recurrence): boolean {
  if (date < anchor) return false;
  const diff = daysBetween(anchor, date);
  switch (rule.type) {
    case "once":
      return date === anchor;
    case "daily":
      return true;
    case "every_n_days":
      return diff % Math.max(1, rule.interval || 1) === 0;
    case "weekdays":
      return (rule.weekdays || []).includes(weekday(date));
    case "weekly":
      return weekday(date) === (rule.weekday ?? weekday(anchor));
    case "biweekly": {
      const target = rule.weekday ?? weekday(anchor);
      if (weekday(date) !== target) return false;
      const firstOffset = (target - weekday(anchor) + 7) % 7;
      return diff >= firstOffset && (diff - firstOffset) % 14 === 0;
    }
    case "monthly":
      return dayOfMonth(date) === Math.min(rule.dayOfMonth ?? dayOfMonth(anchor), lastDay(date));
    default:
      return false;
  }
}

function lastDay(date: string): number {
  const current = parseDateKey(date);
  return new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
}

export function matchesRecurrence(task: Task, date: string): boolean {
  if (date < task.anchorDate) return false;
  const rule = task.recurrence;
  const diff = daysBetween(task.anchorDate, date);
  switch (rule.type) {
    case "once":
      return date === task.anchorDate;
    case "daily":
      return true;
    case "every_n_days":
      return diff % Math.max(1, rule.interval || 1) === 0;
    case "weekdays":
      return (rule.weekdays || []).includes(weekday(date));
    case "weekly":
      return weekday(date) === (rule.weekday ?? weekday(task.anchorDate)) && diff % 7 === 0;
    case "biweekly":
      return weekday(date) === (rule.weekday ?? weekday(task.anchorDate)) && diff % 14 === 0;
    case "monthly":
      return dayOfMonth(date) === Math.min(rule.dayOfMonth ?? dayOfMonth(task.anchorDate), lastDay(date));
    default:
      return false;
  }
}

export function validateTaskInput(input: TaskInput) {
  const title = input.title.trim();
  if (!title) throw new Error("Give the task a name.");
  if (title.length > 80) throw new Error("Keep the task name under 80 characters.");
  if (!Number.isFinite(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 240) {
    throw new Error("Duration should be between 1 and 240 minutes.");
  }
  if (!Number.isFinite(input.xpReward) || input.xpReward < 0 || input.xpReward > 200) {
    throw new Error("XP should be between 0 and 200.");
  }
  if (input.preferredTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.preferredTime)) {
    throw new Error("Preferred time should look like 18:30.");
  }
  if (!input.categoryId) throw new Error("Choose a category.");
  if (!input.anchorDate) throw new Error("Choose a start date.");
  if (input.recurrence.type === "every_n_days") {
    const interval = input.recurrence.interval || 0;
    if (interval < 2 || interval > 60) throw new Error("Use an interval between 2 and 60 days.");
  }
  if (input.recurrence.type === "weekdays" && !(input.recurrence.weekdays || []).length) {
    throw new Error("Pick at least one weekday.");
  }
}

export function taskFromInput(input: TaskInput, clock: Clock, existing?: Task): Task {
  validateTaskInput(input);
  const recurrence = { ...input.recurrence, weekdays: input.recurrence.weekdays ? [...input.recurrence.weekdays].sort() : undefined };
  return {
    id: existing?.id ?? uid(),
    planKey: input.planKey ?? existing?.planKey,
    title: input.title.trim(),
    description: input.description.trim(),
    categoryId: input.categoryId,
    icon: input.icon || "Check",
    image: input.image,
    priority: input.priority,
    durationMinutes: Math.round(input.durationMinutes),
    xpReward: Math.round(input.xpReward),
    recurrence,
    anchorDate: normalizeAnchor(input.anchorDate, recurrence),
    preferredTime: input.preferredTime,
    flexible: input.flexible,
    window: input.window,
    reminderMinutes: input.reminderMinutes,
    notes: input.notes.trim(),
    subtasks: input.subtasks
      .map((subtask) => ({ id: subtask.id || uid(), title: subtask.title.trim() }))
      .filter((subtask) => subtask.title),
    area: input.area,
    petId: input.petId,
    projectId: input.projectId,
    active: existing?.active ?? true,
    streak: existing?.streak ?? 0,
    longestStreak: existing?.longestStreak ?? 0,
    atRisk: existing?.atRisk ?? false,
    createdAt: existing?.createdAt ?? clock.iso,
    updatedAt: clock.iso,
  };
}

export function makeOccurrence(task: Task, date: string, clock: Clock): Occurrence {
  const explicit = Boolean(task.preferredTime && !task.flexible);
  return {
    id: uid(),
    taskId: task.id,
    cycleKey: date,
    date,
    time: explicit && task.preferredTime ? task.preferredTime : "18:00",
    timeAuto: !explicit,
    overflow: false,
    status: "pending",
    subtaskDone: [],
    xpAwarded: 0,
    titleSnapshot: task.title,
    categoryId: task.categoryId,
    icon: task.icon,
    durationMinutes: task.durationMinutes,
    xpReward: task.xpReward,
    area: task.area,
    priority: task.priority,
    flexible: task.flexible,
    window: task.window,
    preferredTime: task.preferredTime,
    reminderMinutes: task.reminderMinutes,
    petId: task.petId,
    projectId: task.projectId,
    createdAt: clock.iso,
    updatedAt: clock.iso,
  };
}

const priorityRank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export function layoutWindow(items: Occurrence[], start: number, end: number): Occurrence[] {
  const fixed = items.filter((item) => !item.timeAuto);
  const flex = items
    .filter((item) => item.timeAuto)
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || a.durationMinutes - b.durationMinutes);
  const used: Array<[number, number]> = [];
  const out: Occurrence[] = [];
  let demanding = 0;

  for (const item of fixed) {
    out.push({ ...item, overflow: false });
    const at = toMinutes(item.time);
    used.push([at, at + item.durationMinutes]);
    if (item.durationMinutes >= 40 || item.priority === "high") demanding += 1;
  }

  let cursor = start;
  for (const item of flex) {
    const heavy = item.durationMinutes >= 40 || item.priority === "high";
    let slot = item.preferredTime ? toMinutes(item.preferredTime) : cursor;
    if (slot < start) slot = start;
    if (slot > end - 5) slot = Math.max(start, end - 5);
    let guard = 0;
    while (guard < 24 && used.some(([from, to]) => slot < to && slot + Math.min(item.durationMinutes, 30) > from)) {
      slot += 15;
      guard += 1;
    }
    const overflow = (heavy && demanding >= 2) || slot >= end;
    const time = fromMinutes(Math.max(start, Math.min(slot, Math.max(start, end - 5))));
    out.push({ ...item, time, overflow });
    if (!overflow) {
      const at = toMinutes(time);
      used.push([at, at + item.durationMinutes]);
      cursor = Math.max(cursor, at + item.durationMinutes + 10);
      if (heavy) demanding += 1;
    }
  }
  return out;
}

export function taskStreak(taskId: string, occurrences: Occurrence[], today: string) {
  const list = occurrences
    .filter((item) => item.taskId === taskId && item.cycleKey <= today)
    .sort((a, b) => a.cycleKey.localeCompare(b.cycleKey));
  let current = 0;
  let longest = 0;
  let pendingMiss = false;
  for (const item of list) {
    if (item.status === "pending" && item.date >= today) continue;
    if (item.status === "completed") {
      current += 1;
      pendingMiss = false;
      longest = Math.max(longest, current);
    } else if (item.status === "skipped") {
      pendingMiss = false;
    } else if (item.status === "missed" || (item.status === "pending" && item.date < today)) {
      if (pendingMiss) {
        current = 0;
        pendingMiss = false;
      } else {
        pendingMiss = true;
      }
    }
  }
  return { current, longest, atRisk: pendingMiss && current > 0 };
}

export function dayStreak(occurrences: Occurrence[], today: string) {
  const byDate = new Map<string, Occurrence[]>();
  for (const item of occurrences) {
    const list = byDate.get(item.date) ?? [];
    list.push(item);
    byDate.set(item.date, list);
  }
  const dates = [...byDate.keys()].sort();
  const kind = (date: string): "engaged" | "failed" | "neutral" => {
    const list = byDate.get(date);
    if (!list?.length) return "neutral";
    if (list.some((item) => item.status === "completed")) return "engaged";
    if (date < today && list.some((item) => item.status === "missed" || item.status === "pending")) return "failed";
    return "neutral";
  };

  let longest = 0;
  let run = 0;
  for (const date of dates) {
    if (date > today) break;
    const state = kind(date);
    if (state === "engaged") {
      run += 1;
      longest = Math.max(longest, run);
    } else if (state === "failed") run = 0;
  }

  let current = 0;
  if (dates.length) {
    let cursor = today;
    for (let step = 0; step < 400 && cursor >= dates[0]; step += 1) {
      const state = kind(cursor);
      if (cursor === today && state !== "engaged") {
        cursor = addDays(cursor, -1);
        continue;
      }
      if (state === "engaged") current += 1;
      else if (state === "failed") break;
      cursor = addDays(cursor, -1);
    }
  }
  return { current, longest: Math.max(longest, current) };
}

export function recurrenceLabel(rule: Recurrence): string {
  switch (rule.type) {
    case "once":
      return "One time";
    case "daily":
      return "Every day";
    case "every_n_days":
      return `Every ${rule.interval || 2} days`;
    case "weekdays":
      return (rule.weekdays || []).map((day) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]).join(", ") || "Custom days";
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Every 2 weeks";
    case "monthly":
      return "Monthly";
    default:
      return "Custom";
  }
}
