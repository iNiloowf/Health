import { addDays, weekday } from "./dates";
import { isFoldTask, isLaundryTask, makeOccurrence, matchesRecurrence, suggestedXp, taskFromInput } from "./model";
import type { AppData, Area, Clock, Occurrence, Priority, Recurrence, Task } from "./types";

interface HomeChore {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  icon: string;
  area: Area;
  duration: number;
  priority: Priority;
  recurrence: Recurrence;
  anchorDate: string;
  aliases: string[];
}

const SUNDAY = "2026-11-01";

function weekly(day: number): Pick<HomeChore, "recurrence" | "anchorDate"> {
  return { recurrence: { type: "weekly", weekday: day }, anchorDate: addDays(SUNDAY, day) };
}

function monthly(day: number): Pick<HomeChore, "recurrence" | "anchorDate"> {
  return { recurrence: { type: "monthly", dayOfMonth: day }, anchorDate: SUNDAY };
}

const HOME_CHORES: HomeChore[] = [
  {
    id: "pet-bowls",
    title: "Wash pet water bowls",
    description: "Wash the cats' water bowls.",
    categoryId: "pet",
    icon: "PawPrint",
    area: "pet",
    duration: 15,
    priority: "medium",
    ...weekly(1),
    aliases: ["wash pet water bowls"],
  },
  {
    id: "entry",
    title: "Clean the entry and shoes",
    description: "Clean the front door and the shoe spot.",
    categoryId: "cleaning",
    icon: "House",
    area: "household",
    duration: 15,
    priority: "low",
    ...weekly(5),
    aliases: ["clean the entry and shoes", "clean the entry and shoe spot"],
  },
  {
    id: "bedsheets",
    title: "Wash blankets and bedsheets",
    description: "Wash the blankets and bedsheets.",
    categoryId: "bedroom",
    icon: "BedDouble",
    area: "household",
    duration: 30,
    priority: "medium",
    ...monthly(4),
    aliases: ["wash blankets and bedsheets", "change bedsheets", "wash blanket and bedsheet"],
  },
  {
    id: "bathroom",
    title: "Deep clean bathroom and toilet",
    description: "Clean the bathroom, toilet, and shower.",
    categoryId: "bathroom",
    icon: "Bath",
    area: "household",
    duration: 40,
    priority: "medium",
    ...monthly(11),
    aliases: ["deep clean bathroom and toilet", "clean bathroom", "wash the toilet and bathroom", "wash toilet and bathroom"],
  },
  {
    id: "sink-faucets",
    title: "Clean sink and faucets",
    description: "Clean the sink and faucets.",
    categoryId: "bathroom",
    icon: "Bath",
    area: "household",
    duration: 20,
    priority: "medium",
    ...monthly(16),
    aliases: ["clean sink and faucets"],
  },
  {
    id: "stove",
    title: "Clean stove and microwave",
    description: "Clean the stove and the microwave.",
    categoryId: "kitchen",
    icon: "UtensilsCrossed",
    area: "household",
    duration: 25,
    priority: "medium",
    ...monthly(22),
    aliases: ["clean stove and microwave"],
  },
  {
    id: "fridge",
    title: "Deep clean the fridge",
    description: "Empty, wipe, and restock the fridge.",
    categoryId: "kitchen",
    icon: "UtensilsCrossed",
    area: "household",
    duration: 40,
    priority: "high",
    ...monthly(26),
    aliases: ["deep clean the fridge", "clean refrigerator"],
  },
  {
    id: "trash",
    title: "Empty the trash",
    description: "Empty the bins and replace the bags.",
    categoryId: "kitchen",
    icon: "Trash2",
    area: "household",
    duration: 10,
    priority: "medium",
    recurrence: { type: "daily" },
    anchorDate: SUNDAY,
    aliases: ["empty the trash", "take out trash"],
  },
  {
    id: "cat-nails",
    title: "Trim the cats' nails",
    description: "Trim the cats' nails.",
    categoryId: "pet",
    icon: "PawPrint",
    area: "pet",
    duration: 15,
    priority: "medium",
    recurrence: { type: "biweekly", weekday: 2 },
    anchorDate: addDays(SUNDAY, 2),
    aliases: ["trim the cats' nails", "trim cat nails"],
  },
];

const SPREAD_WEEKDAYS: Record<string, number> = {
  "chore:plants": 0,
  "chore:floors": 3,
  "chore:groceries": 6,
};

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function matchesChore(task: Task, chore: HomeChore): boolean {
  if (task.planKey === `chore:${chore.id}`) return true;
  const title = norm(task.title);
  return chore.aliases.some((alias) => alias === title);
}

export function choreRollsForward(task: Task): boolean {
  if (!task.active) return false;
  return task.recurrence.type === "weekly" || task.recurrence.type === "biweekly" || task.recurrence.type === "monthly";
}

function freeWeekday(preferred: number, used: Set<number>): number {
  for (let offset = 0; offset < 7; offset += 1) {
    const day = (preferred + offset) % 7;
    if (!used.has(day)) return day;
  }
  return preferred;
}

function sameSchedule(task: Task, recurrence: Recurrence, anchorDate: string): boolean {
  return JSON.stringify(task.recurrence) === JSON.stringify(recurrence) && task.anchorDate === anchorDate;
}

function lastDue(task: Task, today: string): string | null {
  for (let date = today, guard = 0; guard < 70; date = addDays(date, -1), guard += 1) {
    if (date < task.anchorDate) return null;
    if (matchesRecurrence(task, date)) return date;
  }
  return null;
}

function cycleDone(occurrences: Occurrence[], taskId: string, due: string): boolean {
  return occurrences.some((item) => item.taskId === taskId && (item.status === "completed" || item.status === "skipped") && (item.cycleKey === due || item.date === due || item.rescheduledFrom === due));
}

export function ensureHomeChores(data: AppData, clock: Clock): AppData {
  let tasks = [...data.tasks];
  let occurrences = [...data.occurrences];
  const removed = new Set<string>();
  const used = new Set<number>();
  const laundry = tasks.find((task) => task.active && isLaundryTask(task));
  if (laundry?.recurrence.type === "weekly" && laundry.recurrence.weekday != null) used.add(laundry.recurrence.weekday);

  for (const chore of HOME_CHORES) {
    const matches = tasks.filter((task) => !removed.has(task.id) && matchesChore(task, chore)).sort((a, b) => a.id.localeCompare(b.id));
    const keeper = matches[0];
    for (const extra of matches.slice(1)) {
      removed.add(extra.id);
      if (!keeper) continue;
      occurrences = occurrences.map((item) => (item.taskId === extra.id ? { ...item, taskId: keeper.id } : item));
    }
    let recurrence = chore.recurrence;
    let anchorDate = chore.anchorDate;
    if (recurrence.type === "weekly") {
      const day = freeWeekday(recurrence.weekday ?? weekday(anchorDate), used);
      recurrence = { type: "weekly", weekday: day };
      anchorDate = addDays(SUNDAY, day);
      used.add(day);
    }
    if (chore.id === "trash" && keeper && keeper.anchorDate <= clock.today) anchorDate = keeper.anchorDate;
    const planKey = `chore:${chore.id}`;
    if (!keeper) {
      tasks.push(taskFromInput({
        title: chore.title,
        description: chore.description,
        categoryId: chore.categoryId,
        icon: chore.icon,
        priority: chore.priority,
        durationMinutes: chore.duration,
        xpReward: suggestedXp(chore.duration, chore.priority),
        recurrence,
        anchorDate,
        preferredTime: null,
        flexible: true,
        window: "evening",
        reminderMinutes: 15,
        notes: "",
        subtasks: [],
        area: chore.area,
        planKey,
      }, clock));
      continue;
    }
    const changed = keeper.title !== chore.title || keeper.description !== chore.description || keeper.categoryId !== chore.categoryId || keeper.icon !== chore.icon || keeper.area !== chore.area || keeper.planKey !== planKey || !keeper.active || !sameSchedule(keeper, recurrence, anchorDate);
    if (!changed) continue;
    const scheduleChanged = !sameSchedule(keeper, recurrence, anchorDate);
    tasks = tasks.map((task) => task.id === keeper.id ? {
      ...task,
      title: chore.title,
      description: chore.description,
      categoryId: chore.categoryId,
      icon: chore.icon,
      area: chore.area,
      planKey,
      priority: chore.priority,
      durationMinutes: chore.duration,
      xpReward: suggestedXp(chore.duration, chore.priority),
      recurrence,
      anchorDate,
      active: true,
      updatedAt: clock.iso,
    } : task);
    if (scheduleChanged) {
      occurrences = occurrences.filter((item) => item.taskId !== keeper.id || (item.status !== "pending" && item.status !== "missed"));
    } else {
      occurrences = occurrences.map((item) => item.taskId === keeper.id && (item.status === "pending" || item.status === "missed") ? { ...item, titleSnapshot: chore.title, categoryId: chore.categoryId, icon: chore.icon, updatedAt: clock.iso } : item);
    }
  }

  for (const [planKey, preferred] of Object.entries(SPREAD_WEEKDAYS)) {
    const task = tasks.find((item) => item.planKey === planKey && item.active && item.recurrence.type === "weekly");
    if (!task) continue;
    const day = freeWeekday(task.recurrence.weekday != null && !used.has(task.recurrence.weekday) ? task.recurrence.weekday : preferred, used);
    used.add(day);
    const recurrence: Recurrence = { type: "weekly", weekday: day };
    const anchorDate = addDays(SUNDAY, day);
    if (sameSchedule(task, recurrence, anchorDate)) continue;
    tasks = tasks.map((item) => item.id === task.id ? { ...item, recurrence, anchorDate, updatedAt: clock.iso } : item);
    occurrences = occurrences.filter((item) => item.taskId !== task.id || (item.status !== "pending" && item.status !== "missed"));
  }

  if (removed.size) tasks = tasks.filter((task) => !removed.has(task.id));
  return tasks === data.tasks && occurrences === data.occurrences ? data : { ...data, tasks, occurrences };
}

function placeOpen(occurrences: Occurrence[], task: Task, due: string, target: string, clock: Clock): { occurrences: Occurrence[]; changed: boolean } {
  const opens = occurrences.filter((item) => item.taskId === task.id && (item.status === "pending" || item.status === "missed"));
  const keeper = opens.find((item) => item.date === target) ?? opens[0];
  const drop = new Set(opens.filter((item) => item !== keeper).map((item) => item.id));
  let next = drop.size ? occurrences.filter((item) => !drop.has(item.id)) : occurrences;
  let changed = drop.size > 0;
  if (!keeper) {
    const created = makeOccurrence(task, target, clock);
    created.cycleKey = due;
    if (target !== due) created.rescheduledFrom = due;
    next = [...next, created];
    return { occurrences: next, changed: true };
  }
  if (keeper.date === target && keeper.status === "pending" && (keeper.cycleKey === due || target === due)) return { occurrences: next, changed };
  next = next.map((item) => item.id === keeper.id ? {
    ...item,
    date: target,
    status: "pending" as const,
    cycleKey: due,
    rescheduledFrom: target === due ? item.rescheduledFrom : item.rescheduledFrom || due,
    titleSnapshot: task.title,
    updatedAt: clock.iso,
  } : item);
  return { occurrences: next, changed: true };
}

export function bringChoresForward(data: AppData, clock: Clock): AppData {
  let occurrences = [...data.occurrences];
  let changed = false;
  const load = new Map<string, number>();
  const occupy = (date: string) => load.set(date, (load.get(date) ?? 0) + 1);
  const overdue: Array<{ task: Task; due: string }> = [];

  for (const task of data.tasks) {
    if (!choreRollsForward(task) || isFoldTask(task)) continue;
    const due = lastDue(task, clock.today);
    if (!due || cycleDone(occurrences, task.id, due)) continue;
    const opens = occurrences.filter((item) => item.taskId === task.id && (item.status === "pending" || item.status === "missed"));
    const postponed = opens.find((item) => item.rescheduledFrom && item.date > clock.today);
    if (postponed) {
      const placed = placeOpen(occurrences, task, due, postponed.date, clock);
      occurrences = placed.occurrences;
      changed = changed || placed.changed;
      continue;
    }
    if (due >= clock.today) {
      const placed = placeOpen(occurrences, task, due, due, clock);
      occurrences = placed.occurrences;
      changed = changed || placed.changed;
      continue;
    }
    overdue.push({ task, due });
  }

  const moving = new Set(overdue.map((item) => item.task.id));
  for (const task of data.tasks) {
    if (!choreRollsForward(task) || isFoldTask(task) || moving.has(task.id)) continue;
    for (const item of occurrences) {
      if (item.taskId === task.id && item.date >= clock.today && (item.status === "pending" || item.status === "missed")) occupy(item.date);
    }
  }

  overdue.sort((a, b) => a.due.localeCompare(b.due) || a.task.id.localeCompare(b.task.id));
  for (const item of overdue) {
    let target = clock.today;
    while ((load.get(target) ?? 0) >= 2) target = addDays(target, 1);
    const placed = placeOpen(occurrences, item.task, item.due, target, clock);
    occurrences = placed.occurrences;
    changed = changed || placed.changed;
    occupy(target);
  }

  const laundry = data.tasks.find((task) => task.active && isLaundryTask(task));
  const fold = data.tasks.find((task) => task.active && isFoldTask(task));
  if (laundry && fold) {
    const due = lastDue(fold, clock.today);
    const wash = occurrences.find((item) => item.taskId === laundry.id && (item.status === "pending" || item.status === "missed"));
    if (due && !cycleDone(occurrences, fold.id, due)) {
      const target = wash?.date && wash.date >= clock.today ? wash.date : clock.today;
      const placed = placeOpen(occurrences, fold, due, target, clock);
      occurrences = placed.occurrences;
      changed = changed || placed.changed;
    }
  }

  return changed ? { ...data, occurrences } : data;
}
