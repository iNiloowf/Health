import { addDays, eachDate, startOfWeek, toMinutes, weekKey } from "./dates";
import { dayStreak, foldIsWaiting } from "./model";
import { ACHIEVEMENTS, LEVELS, categoryEffect } from "./templates";
import type { AppData, Clock, Effect, Workload } from "./types";

export interface LevelInfo {
  level: number;
  title: string;
  floor: number;
  next: number;
  into: number;
  span: number;
}

export interface Stats {
  totalCompleted: number;
  totalXp: number;
  dayStreak: number;
  longestDayStreak: number;
  bestTaskStreak: number;
  byCategory: Record<string, number>;
  perfectWeek: boolean;
  strongWeeks: number;
}

export interface Insight {
  id: string;
  text: string;
  taskId?: string;
  time?: string;
}

export interface Celebration {
  id: string;
  type: "xp" | "level" | "achievement" | "done";
  amount?: number;
  effect?: Effect;
  level?: number;
  title?: string;
  achievementId?: string;
}

export function totalXp(data: AppData): number {
  return data.xp.reduce((sum, txn) => sum + txn.amount, 0);
}

export function taskPoints(item: { xpAwarded: number; xpReward: number }): number {
  return item.xpAwarded > 0 ? item.xpAwarded : item.xpReward;
}

export function pointsByPerson(data: AppData): Array<{ name: string; points: number }> {
  const totals = new Map<string, number>();
  const shownAs = new Map<string, string>();
  const me = data.profile?.name?.trim();
  const myId = data.profile?.share?.memberId;
  for (const member of data.members ?? []) {
    const name = member.id === myId && me ? me : member.name.trim();
    if (!name) continue;
    totals.set(name, totals.get(name) ?? 0);
    if (member.name.trim()) shownAs.set(member.name.trim(), name);
  }
  if (me) {
    totals.set(me, totals.get(me) ?? 0);
    shownAs.set(me, me);
  }
  for (const item of data.occurrences) {
    if (item.status !== "completed") continue;
    const raw = item.doneBy?.trim() || me || "Me";
    const name = shownAs.get(raw) || raw;
    totals.set(name, (totals.get(name) ?? 0) + taskPoints(item));
  }
  return [...totals.entries()]
    .map(([name, points]) => ({ name, points }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

export function pointsFor(data: AppData, name: string): number {
  return pointsByPerson(data).find((item) => item.name === name)?.points ?? 0;
}

export function levelFor(xp: number): LevelInfo {
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (xp >= level.xp) current = level;
  }
  if (xp >= 2600) {
    const extra = Math.floor((xp - 2600) / 700);
    const floor = 2600 + extra * 700;
    const level = 10 + extra;
    return {
      level,
      title: level === 10 ? "Life OS" : `Master ${level - 9}`,
      floor,
      next: floor + 700,
      into: xp - floor,
      span: 700,
    };
  }
  const index = LEVELS.findIndex((level) => level.level === current.level);
  const upcoming = LEVELS[index + 1];
  const next = upcoming?.xp ?? current.xp;
  return {
    level: current.level,
    title: current.title,
    floor: current.xp,
    next,
    into: xp - current.xp,
    span: Math.max(1, next - current.xp),
  };
}

function weekRanges(today: string, weekStartsOn: 0 | 1, count: number) {
  const current = startOfWeek(today, weekStartsOn);
  const ranges = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const start = addDays(current, -7 * index);
    ranges.push({ start, end: addDays(start, 6), key: start });
  }
  return ranges;
}

export function deriveStats(data: AppData, today: string): Stats {
  const completed = data.occurrences.filter((item) => item.status === "completed");
  const byCategory: Record<string, number> = {};
  for (const item of completed) byCategory[item.categoryId] = (byCategory[item.categoryId] ?? 0) + 1;
  const streak = dayStreak(data.occurrences, today);
  const weekStartsOn = data.profile?.weekStartsOn ?? 1;
  let perfectWeek = false;
  let strongWeeks = 0;
  for (const range of weekRanges(today, weekStartsOn, 16)) {
    if (range.end >= today) continue;
    const due = data.occurrences.filter((item) => item.date >= range.start && item.date <= range.end && item.status !== "skipped");
    if (due.length < 3) continue;
    const done = due.filter((item) => item.status === "completed").length;
    if (done === due.length) perfectWeek = true;
    if (done / due.length >= 0.8) strongWeeks += 1;
  }
  return {
    totalCompleted: completed.length,
    totalXp: totalXp(data),
    dayStreak: streak.current,
    longestDayStreak: streak.longest,
    bestTaskStreak: Math.max(0, ...data.tasks.map((task) => task.longestStreak), 0),
    byCategory,
    perfectWeek,
    strongWeeks,
  };
}

export function unlockAchievements(data: AppData, clock: Clock): AppData {
  const stats = deriveStats(data, clock.today);
  const cleaning =
    (stats.byCategory.cleaning ?? 0) +
    (stats.byCategory.bathroom ?? 0) +
    (stats.byCategory.bedroom ?? 0) +
    (stats.byCategory.living ?? 0);
  const owned = new Set(data.achievements.map((item) => item.id));
  const checks: Record<string, boolean> = {
    "first-task": stats.totalCompleted >= 1,
    "streak-7": stats.longestDayStreak >= 7 || stats.bestTaskStreak >= 7,
    "tasks-10": stats.totalCompleted >= 10,
    "tasks-50": stats.totalCompleted >= 50,
    "laundry-master": (stats.byCategory.laundry ?? 0) >= 8,
    "cleaning-champion": cleaning >= 12,
    "perfect-week": stats.perfectWeek,
    "early-organizer": data.earlyOrganizer,
    "consistency-master": stats.longestDayStreak >= 21 || stats.strongWeeks >= 4,
  };
  const additions = Object.entries(checks)
    .filter(([id, ok]) => ok && !owned.has(id))
    .map(([id]) => ({ id, unlockedAt: clock.iso }));
  if (!additions.length) return data;
  return { ...data, achievements: [...data.achievements, ...additions] };
}

export function dayProgress(data: AppData, day: string) {
  const items = data.occurrences.filter((item) => item.date === day && item.status !== "skipped" && !foldIsWaiting(data, item));
  const done = items.filter((item) => item.status === "completed").length;
  return { total: items.length, done, percent: items.length ? Math.round((done / items.length) * 100) : 0 };
}

export function celebrationsFor(prev: AppData, next: AppData, today: string): Celebration[] {
  const events: Celebration[] = [];
  const seen = new Set(prev.xp.map((txn) => txn.id));
  for (const txn of next.xp) {
    if (seen.has(txn.id) || txn.amount <= 0 || txn.reason !== "task") continue;
    const occurrence = next.occurrences.find((item) => item.id === txn.occurrenceId);
    events.push({
      id: `xp-${txn.id}`,
      type: "xp",
      amount: txn.amount,
      effect: categoryEffect(next.categories, occurrence?.categoryId || ""),
    });
  }
  const name = next.profile?.name?.trim() || "";
  const before = levelFor(pointsFor(prev, name));
  const after = levelFor(pointsFor(next, name));
  if (after.level > before.level) {
    events.push({ id: `level-${after.level}-${today}`, type: "level", level: after.level, title: after.title });
  }
  const owned = new Set(prev.achievements.map((item) => item.id));
  for (const achievement of next.achievements) {
    if (!owned.has(achievement.id)) {
      events.push({ id: `ach-${achievement.id}`, type: "achievement", achievementId: achievement.id });
    }
  }
  const was = dayProgress(prev, today);
  const now = dayProgress(next, today);
  if (now.total > 0 && now.done === now.total && was.done < was.total) {
    events.push({ id: `done-${today}`, type: "done" });
  }
  return events;
}

export function achievementName(id: string): string {
  return ACHIEVEMENTS.find((item) => item.id === id)?.name ?? "Achievement";
}

export function buildInsights(data: AppData, today: string): Insight[] {
  const insights: Insight[] = [];
  const weekStartsOn = data.profile?.weekStartsOn ?? 1;
  const start = startOfWeek(today, weekStartsOn);
  const weekItems = data.occurrences.filter((item) => item.date >= start && item.date <= today && item.status !== "skipped");
  if (weekItems.length) {
    const done = weekItems.filter((item) => item.status === "completed").length;
    const percent = Math.round((done / weekItems.length) * 100);
    insights.push({ id: "week", text: `You completed ${percent}% of your planned tasks so far this week.` });
  }

  const rates = new Map<string, { done: number; total: number }>();
  for (const item of data.occurrences) {
    if (item.date > today || item.status === "skipped") continue;
    if (item.status !== "completed" && item.status !== "missed") continue;
    const bucket = rates.get(item.categoryId) ?? { done: 0, total: 0 };
    bucket.total += 1;
    if (item.status === "completed") bucket.done += 1;
    rates.set(item.categoryId, bucket);
  }
  let bestName = "";
  let bestRate = 0;
  for (const [categoryId, bucket] of rates) {
    if (bucket.total < 3) continue;
    const rate = bucket.done / bucket.total;
    if (rate > bestRate) {
      bestRate = rate;
      bestName = data.categories.find((category) => category.id === categoryId)?.name ?? "this routine";
    }
  }
  if (bestName && bestRate >= 0.6) {
    insights.push({ id: "consistent", text: `You are most consistent with ${bestName.toLowerCase()}.` });
  }

  const moved = new Map<string, number>();
  for (const item of data.occurrences) {
    if (!item.rescheduledFrom) continue;
    moved.set(item.taskId, (moved.get(item.taskId) ?? 0) + 1);
  }
  const frequent = [...moved.entries()].sort((a, b) => b[1] - a[1])[0];
  if (frequent && frequent[1] >= 2) {
    const task = data.tasks.find((item) => item.id === frequent[0]);
    if (task) {
      insights.push({
        id: `move-${task.id}`,
        text: `${task.title} is often moved. A different day or a shorter version may fit better.`,
        taskId: task.id,
      });
    }
  }

  if (!insights.length) {
    insights.push({ id: "start", text: "Your evening plan will get sharper as you complete a few real tasks." });
  }
  return insights.slice(0, 3);
}

export function routineSuggestions(data: AppData): Array<{ taskId: string; title: string; time: string }> {
  const suggestions = [];
  for (const task of data.tasks) {
    if (!task.active) continue;
    const hours = new Map<number, number>();
    for (const item of data.occurrences) {
      if (item.taskId !== task.id || item.status !== "completed" || !item.completedAt) continue;
      const hour = new Date(item.completedAt).getHours();
      hours.set(hour, (hours.get(hour) ?? 0) + 1);
    }
    const total = [...hours.values()].reduce((sum, count) => sum + count, 0);
    if (total < 3) continue;
    const [hour, count] = [...hours.entries()].sort((a, b) => b[1] - a[1])[0];
    if (count / total < 0.6) continue;
    const time = `${String(hour).padStart(2, "0")}:00`;
    if (task.preferredTime && Math.abs(toMinutes(task.preferredTime) - toMinutes(time)) < 45) continue;
    suggestions.push({ taskId: task.id, title: task.title, time });
  }
  return suggestions.slice(0, 3);
}

export function weekSeries(data: AppData, today: string) {
  const start = startOfWeek(today, data.profile?.weekStartsOn ?? 1);
  return eachDate(start, addDays(start, 6)).map((date) => {
    const items = data.occurrences.filter((item) => item.date === date && item.status !== "skipped");
    const done = items.filter((item) => item.status === "completed").length;
    return { date, done, total: items.length, future: date > today };
  });
}

export function monthSeries(data: AppData, today: string) {
  const weekStartsOn = data.profile?.weekStartsOn ?? 1;
  return weekRanges(today, weekStartsOn, 8).map((range) => {
    const items = data.occurrences.filter((item) => item.date >= range.start && item.date <= range.end && item.date <= today && item.status !== "skipped");
    const done = items.filter((item) => item.status === "completed").length;
    return { start: range.start, percent: items.length ? Math.round((done / items.length) * 100) : 0, total: items.length };
  });
}

export function categoryBreakdown(data: AppData) {
  const counts = new Map<string, number>();
  for (const item of data.occurrences) {
    if (item.status !== "completed") continue;
    counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count, name: data.categories.find((category) => category.id === id)?.name ?? "Other" }))
    .sort((a, b) => b.count - a.count);
}

export function postponedTasks(data: AppData) {
  const counts = new Map<string, number>();
  for (const item of data.occurrences) {
    if (!item.rescheduledFrom) continue;
    counts.set(item.taskId, (counts.get(item.taskId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([taskId, count]) => ({ taskId, count, title: data.tasks.find((task) => task.id === taskId)?.title ?? "Task" }))
    .filter((item) => item.count >= 2)
    .sort((a, b) => b.count - a.count);
}

export function rangePercent(data: AppData, start: string, end: string) {
  const items = data.occurrences.filter((item) => item.date >= start && item.date <= end && item.status !== "skipped");
  const done = items.filter((item) => item.status === "completed").length;
  return { done, total: items.length, percent: items.length ? Math.round((done / items.length) * 100) : 0 };
}

export function freezeWeek(today: string, weekStartsOn: 0 | 1): string {
  return weekKey(today, weekStartsOn);
}

export function workloadCap(workload: Workload) {
  if (workload === "light") return { max: 3, demanding: 1 };
  if (workload === "full") return { max: 8, demanding: 3 };
  return { max: 5, demanding: 2 };
}
