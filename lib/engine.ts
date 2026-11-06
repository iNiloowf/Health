import { addDays, dayOfMonth, fromMinutes, isValidDateKey, isValidTime, localTimeZone, previousWeek, toMinutes, weekday, weekKey } from "./dates";
import { layoutWindow, makeOccurrence, matchesRecurrence, taskFromInput, taskStreak, uid } from "./model";
import { unlockAchievements, workloadCap } from "./progress";
import {
  CHORE_TEMPLATES,
  DEFAULT_CATEGORIES,
  PET_CARES,
  WORK_AREAS,
} from "./templates";
import type {
  AppData,
  Category,
  Clock,
  OnboardingAnswers,
  Pace,
  Pet,
  PlanItem,
  Profile,
  Project,
  Recurrence,
  ReminderStyle,
  ScheduleWindow,
  Task,
  TaskInput,
} from "./types";

export function freshData(): AppData {
  return {
    version: 1,
    profile: null,
    categories: DEFAULT_CATEGORIES.map((category) => ({ ...category })),
    tasks: [],
    occurrences: [],
    pets: [],
    projects: [],
    petSchedules: [],
    xp: [],
    achievements: [],
    plannerAccepted: [],
    earlyOrganizer: false,
    firedReminders: [],
    activity: [],
  };
}

export function hydrate(data: AppData): AppData {
  const blank = freshData();
  return {
    ...blank,
    ...data,
    activity: data.activity ?? [],
    categories: data.categories?.length ? data.categories : blank.categories,
    petSchedules: data.petSchedules ?? [],
    achievements: data.achievements ?? [],
    xp: data.xp ?? [],
    firedReminders: data.firedReminders ?? [],
    plannerAccepted: data.plannerAccepted ?? [],
    profile: data.profile
      ? {
          ...data.profile,
          showXp: data.profile.showXp ?? true,
          share: data.profile.share ?? null,
          onboarding: data.profile.onboarding
            ? { ...defaultAnswers(), ...data.profile.onboarding, answeredSteps: data.profile.onboarding.answeredSteps ?? [] }
            : null,
        }
      : null,
  };
}

export function defaultAnswers(): OnboardingAnswers {
  return {
    name: "",
    wake: "07:30",
    sleep: "23:30",
    availabilityStart: "18:00",
    availabilityEnd: "23:00",
    workStart: "09:00",
    workEnd: "17:00",
    workWhen: "day",
    weekStartsOn: 1,
    chores: Object.fromEntries(CHORE_TEMPLATES.map((chore) => [chore.id, "never" as Pace])),
    starting: {},
    pets: [],
    habits: [],
    workAreas: [],
    goals: [],
    reminderStyle: "gentle",
    weeklyWorkload: "balanced",
    animation: "normal",
    answeredSteps: [],
  };
}

function reminderFor(style: ReminderStyle): number | null {
  if (style === "minimal") return null;
  if (style === "gentle") return 20;
  return 10;
}

function paceToRecurrence(pace: Pace, anchor: string): Recurrence {
  const day = weekday(anchor);
  switch (pace) {
    case "daily":
      return { type: "daily" };
    case "every_2_3":
      return { type: "every_n_days", interval: 3 };
    case "twice_week":
      return { type: "weekdays", weekdays: [2, 6] };
    case "weekly":
      return { type: "weekly", weekday: day };
    case "biweekly":
      return { type: "biweekly", weekday: day };
    case "monthly":
    case "rarely":
      return { type: "monthly", dayOfMonth: dayOfMonth(anchor) };
    default:
      return { type: "once" };
  }
}

function slug(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "item";
}

export interface PlanDraft {
  key: string;
  title: string;
  detail: string;
  input: TaskInput;
}

export interface PetDraft {
  key: string;
  name: string;
  type: string;
  cares: string[];
}

export interface ProjectDraft {
  key: string;
  name: string;
  description: string;
  kind: "work" | "personal";
}

export function buildPlan(answers: OnboardingAnswers, anchor: string) {
  const tasks: PlanDraft[] = [];
  const pets: PetDraft[] = [];
  const projects: ProjectDraft[] = [];
  const remind = reminderFor(answers.reminderStyle);
  const chosen = new Map<string, Pace>();
  for (const [id, pace] of Object.entries(answers.chores)) if (pace !== "never") chosen.set(id, pace);
  for (const [id, pace] of Object.entries(answers.starting)) if (pace !== "never") chosen.set(id, pace);

  for (const chore of CHORE_TEMPLATES) {
    const pace = chosen.get(chore.id);
    if (!pace) continue;
    tasks.push({
      key: `chore:${chore.id}`,
      title: chore.title,
      detail: paceLabel(pace),
      input: {
        title: chore.title,
        description: chore.description,
        categoryId: chore.categoryId,
        icon: chore.icon,
        priority: chore.priority,
        durationMinutes: chore.durationMinutes,
        xpReward: xpFor(chore.durationMinutes, chore.priority),
        recurrence: paceToRecurrence(pace, anchor),
        anchorDate: anchor,
        preferredTime: null,
        flexible: true,
        window: "evening",
        reminderMinutes: remind,
        notes: "",
        subtasks: (chore.subtasks ?? []).map((title) => ({ title })),
        area: "household",
        planKey: `chore:${chore.id}`,
      },
    });
  }

  answers.habits.forEach((habit, index) => {
    const title = habit.trim();
    if (!title) return;
    const key = `habit:${slug(title)}:${index}`;
    tasks.push({
      key,
      title,
      detail: "Daily habit",
      input: {
        title,
        description: "",
        categoryId: "habit",
        icon: "Repeat",
        priority: "medium",
        durationMinutes: 15,
        xpReward: 10,
        recurrence: { type: "daily" },
        anchorDate: anchor,
        preferredTime: null,
        flexible: true,
        window: "evening",
        reminderMinutes: remind,
        notes: "",
        subtasks: [],
        area: "habit",
        planKey: key,
      },
    });
  });

  answers.goals.forEach((goal, index) => {
    const title = goal.trim();
    if (!title) return;
    const key = `goal:${slug(title)}:${index}`;
    tasks.push({
      key,
      title: `Check in: ${title}`,
      detail: "Weekly goal",
      input: {
        title: `Check in: ${title}`,
        description: title,
        categoryId: "goals",
        icon: "Flag",
        priority: "medium",
        durationMinutes: 15,
        xpReward: 20,
        recurrence: { type: "weekly", weekday: 0 },
        anchorDate: anchor,
        preferredTime: null,
        flexible: true,
        window: "evening",
        reminderMinutes: remind,
        notes: "",
        subtasks: [],
        area: "personal",
        planKey: key,
      },
    });
  });

  const workWindow: ScheduleWindow = answers.workWhen === "evening" ? "evening" : "day";
  for (const areaId of answers.workAreas) {
    const area = WORK_AREAS.find((item) => item.id === areaId);
    if (!area) continue;
    const key = `work:${area.id}`;
    projects.push({ key, name: area.label, description: "", kind: "work" });
    tasks.push({
      key: `${key}:task`,
      title: area.label,
      detail: workWindow === "day" ? "Daytime work block" : "Evening work block",
      input: {
        title: area.label,
        description: "",
        categoryId: "work",
        icon: "Briefcase",
        priority: "high",
        durationMinutes: 45,
        xpReward: 30,
        recurrence: { type: "weekly", weekday: 1 },
        anchorDate: anchor,
        preferredTime: null,
        flexible: true,
        window: workWindow,
        reminderMinutes: remind,
        notes: "",
        subtasks: [],
        area: "work",
        planKey: `${key}:task`,
      },
    });
  }

  answers.pets.forEach((pet, index) => {
    const name = pet.name.trim();
    if (!name) return;
    const key = `pet:${slug(name)}:${index}`;
    pets.push({ key, name, type: pet.type || "Other", cares: pet.cares });
    for (const careId of pet.cares) {
      const care = PET_CARES.find((item) => item.id === careId);
      if (!care) continue;
      tasks.push({
        key: `${key}:${care.id}`,
        title: `${care.label} · ${name}`,
        detail: care.label,
        input: {
          title: `${care.label} · ${name}`,
          description: `${care.label} for ${name}.`,
          categoryId: "pet",
          icon: "PawPrint",
          priority: care.priority,
          durationMinutes: care.durationMinutes,
          xpReward: xpFor(care.durationMinutes, care.priority),
          recurrence: care.recurrence,
          anchorDate: anchor,
          preferredTime: care.preferredTime,
          flexible: care.flexible,
          window: "evening",
          reminderMinutes: remind,
          notes: "",
          subtasks: [],
          area: "pet",
          planKey: `${key}:${care.id}`,
        },
      });
    }
  });

  return { tasks, pets, projects };
}

function paceLabel(pace: Pace): string {
  const labels: Record<Pace, string> = {
    daily: "Every evening",
    every_2_3: "Every 2–3 days",
    twice_week: "Twice a week",
    weekly: "Weekly",
    biweekly: "Every 2 weeks",
    monthly: "Monthly",
    rarely: "About once a month",
    never: "Not scheduled",
  };
  return labels[pace];
}

function xpFor(duration: number, priority: Task["priority"]): number {
  if (priority === "high" || duration >= 45) return 30;
  if (priority === "medium" || duration >= 20) return 20;
  if (duration <= 10) return 5;
  return 10;
}

function profileFrom(existing: Profile | null, answers: OnboardingAnswers, clock: Clock): Profile {
  const createdAt = existing?.createdAt ?? clock.iso;
  const quietEnd = !existing || existing.quietEnd === existing.availabilityStart ? answers.availabilityStart : existing.quietEnd;
  return {
    id: existing?.id ?? "local",
    name: answers.name.trim(),
    avatar: existing?.avatar,
    timezone: existing?.timezone || localTimeZone(),
    weekStartsOn: answers.weekStartsOn,
    availabilityStart: answers.availabilityStart,
    availabilityEnd: answers.availabilityEnd,
    workStart: answers.workStart,
    workEnd: answers.workEnd,
    wake: answers.wake,
    sleep: answers.sleep,
    theme: existing?.theme ?? "system",
    reducedMotion: existing?.reducedMotion ?? false,
    animation: answers.animation,
    reminderStyle: answers.reminderStyle,
    weeklyWorkload: answers.weeklyWorkload,
    quietStart: existing?.quietStart ?? "23:00",
    quietEnd,
    notificationsEnabled: existing?.notificationsEnabled ?? false,
    showXp: existing?.showXp ?? true,
    onboarded: true,
    onboarding: answers,
    streakFreezes: existing?.streakFreezes ?? 1,
    freezesLeft: existing?.freezesLeft ?? 1,
    freezeWeek: existing?.freezeWeek || weekKey(clock.today, answers.weekStartsOn),
    share: existing?.share ?? null,
    createdAt,
    updatedAt: clock.iso,
  };
}

export function seedProfile(data: AppData, name: string, clock: Clock): AppData {
  const profile = profileFrom(data.profile, { ...defaultAnswers(), name: name.trim() || "Me" }, clock);
  return { ...data, profile: { ...profile, name: name.trim() || "Me", onboarded: false, onboarding: null } };
}

export function applyOnboarding(
  data: AppData,
  answers: OnboardingAnswers,
  selectedTaskKeys: string[],
  selectedPetKeys: string[],
  selectedProjectKeys: string[],
  clock: Clock,
  options?: { keepExisting?: boolean },
): AppData {
  if (toMinutes(answers.availabilityEnd) <= toMinutes(answers.availabilityStart)) {
    throw new Error("Availability needs an end time after the start.");
  }
  const anchor = clock.minutes < toMinutes(answers.availabilityEnd) - 15 ? clock.today : addDays(clock.today, 1);
  const plan = buildPlan(answers, anchor);
  const selected = new Set(selectedTaskKeys);
  let next: AppData = { ...data, profile: profileFrom(data.profile, answers, clock), tasks: [...data.tasks] };

  for (const draft of plan.tasks) {
    const existing = next.tasks.find((task) => task.planKey === draft.input.planKey);
    if (selected.has(draft.key)) {
      const input = {
        ...draft.input,
        petId: existing?.petId,
        projectId: existing?.projectId,
        subtasks: draft.input.subtasks.map((subtask) => {
          const match = existing?.subtasks.find((item) => item.title === subtask.title);
          return match ? { id: match.id, title: match.title } : subtask;
        }),
      };
      if (existing) next = updateTask({ ...next, tasks: next.tasks.map((task) => (task.id === existing.id ? { ...task, active: true } : task)) }, existing.id, input, clock);
      else next = createTask(next, input, clock);
    } else if (existing && !options?.keepExisting) {
      next = {
        ...next,
        tasks: next.tasks.map((task) => (task.id === existing.id ? { ...task, active: false, updatedAt: clock.iso } : task)),
        occurrences: next.occurrences.filter((item) => item.taskId !== existing.id || item.status !== "pending" || item.date < clock.today),
      };
    }
  }

  for (const pet of plan.pets) {
    if (!selectedPetKeys.includes(pet.key) && !plan.tasks.some((task) => task.key.startsWith(`${pet.key}:`) && selected.has(task.key))) continue;
    if (next.pets.some((item) => item.planKey === pet.key)) continue;
    const created = createPet(next, { name: pet.name, type: pet.type, notes: "", cares: [] }, clock, pet.key);
    next = created.data;
    const petId = created.petId;
    next = {
      ...next,
      tasks: next.tasks.map((task) => (task.planKey?.startsWith(`${pet.key}:`) ? { ...task, petId } : task)),
      petSchedules: [
        ...next.petSchedules,
        ...next.tasks
          .filter((task) => task.planKey?.startsWith(`${pet.key}:`))
          .map((task) => ({ id: uid(), petId, taskId: task.id, kind: task.planKey?.split(":").pop() || "care" })),
      ],
    };
  }

  for (const project of plan.projects) {
    if (!selectedProjectKeys.includes(project.key)) continue;
    if (next.projects.some((item) => item.planKey === project.key)) continue;
    const created = createProject(next, { name: project.name, description: project.description, kind: "work", incomeNotes: "", expenseNotes: "" }, clock, project.key);
    next = created.data;
    next = {
      ...next,
      tasks: next.tasks.map((task) => (task.planKey === `${project.key}:task` ? { ...task, projectId: created.projectId } : task)),
    };
  }

  return next;
}

export function reconcile(data: AppData, clock: Clock): AppData {
  if (!data.profile?.onboarded) return data;
  let next = refreshFreezes(data, clock);
  next = generateUpcoming(next, clock);
  next = assignTimes(next);
  next = markMissed(next, clock);
  next = writeStreaks(next, clock);
  next = applyWeekBonus(next, clock);
  next = unlockAchievements(next, clock);
  return next;
}

function refreshFreezes(data: AppData, clock: Clock): AppData {
  if (!data.profile) return data;
  const key = weekKey(clock.today, data.profile.weekStartsOn);
  if (data.profile.freezeWeek === key) return data;
  return { ...data, profile: { ...data.profile, freezeWeek: key, freezesLeft: data.profile.streakFreezes, updatedAt: clock.iso } };
}

function generateUpcoming(data: AppData, clock: Clock): AppData {
  const horizon = addDays(clock.today, 21);
  const occurrences = [...data.occurrences];
  for (const task of data.tasks) {
    if (!task.active) continue;
    for (let date = clock.today; date <= horizon; date = addDays(date, 1)) {
      if (!matchesRecurrence(task, date)) continue;
      const exists = occurrences.some((item) => item.taskId === task.id && (item.cycleKey === date || item.date === date));
      if (exists) continue;
      occurrences.push(makeOccurrence(task, date, clock));
    }
  }
  return { ...data, occurrences };
}

function assignTimes(data: AppData): AppData {
  if (!data.profile) return data;
  const groups = new Map<string, typeof data.occurrences>();
  for (const item of data.occurrences) {
    if (item.status !== "pending") continue;
    const name = item.window === "day" ? "day" : "evening";
    const key = `${item.date}:${name}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  const placed = new Map<string, (typeof data.occurrences)[number]>();
  for (const [key, list] of groups) {
    const daytime = key.endsWith(":day");
    const start = toMinutes(daytime ? data.profile.workStart : data.profile.availabilityStart);
    const end = toMinutes(daytime ? data.profile.workEnd : data.profile.availabilityEnd);
    if (end <= start) continue;
    for (const item of layoutWindow(list, start, end)) placed.set(item.id, item);
  }
  return { ...data, occurrences: data.occurrences.map((item) => placed.get(item.id) ?? item) };
}

function markMissed(data: AppData, clock: Clock): AppData {
  if (!data.profile) return data;
  const profile = data.profile;
  return {
    ...data,
    occurrences: data.occurrences.map((item) => {
      if (item.status !== "pending") return item;
      const missed = isMissed(item, clock, profile);
      return missed ? { ...item, status: "missed", updatedAt: clock.iso } : item;
    }),
  };
}

function isMissed(item: AppData["occurrences"][number], clock: Clock, profile: Profile): boolean {
  if (item.date > clock.today) return false;
  if (item.date < clock.today) return true;
  const windowEnd = toMinutes(item.window === "day" ? profile.workEnd : profile.availabilityEnd);
  if (!item.flexible) return clock.minutes >= toMinutes(item.time) + 60;
  return clock.minutes >= windowEnd;
}

function writeStreaks(data: AppData, clock: Clock): AppData {
  return {
    ...data,
    tasks: data.tasks.map((task) => {
      const streak = taskStreak(task.id, data.occurrences, clock.today);
      return { ...task, streak: streak.current, longestStreak: Math.max(task.longestStreak, streak.longest), atRisk: streak.atRisk };
    }),
  };
}

function applyWeekBonus(data: AppData, clock: Clock): AppData {
  if (!data.profile) return data;
  const prev = previousWeek(clock.today, data.profile.weekStartsOn);
  if (clock.today <= prev.end) return data;
  const reason = `week-bonus-${prev.key}`;
  if (data.xp.some((txn) => txn.reason === reason)) return data;
  const due = data.occurrences.filter((item) => item.date >= prev.start && item.date <= prev.end && item.status !== "skipped");
  if (due.length < 3) return data;
  const done = due.filter((item) => item.status === "completed").length;
  if (done / due.length < 0.8) return data;
  return { ...data, xp: [...data.xp, { id: uid(), amount: 40, reason, createdAt: clock.iso }] };
}

export function createTask(data: AppData, input: TaskInput, clock: Clock): AppData {
  const task = taskFromInput(input, clock);
  return { ...data, tasks: [...data.tasks, task] };
}

export function updateTask(data: AppData, id: string, input: TaskInput, clock: Clock): AppData {
  const existing = data.tasks.find((task) => task.id === id);
  if (!existing) throw new Error("That task is no longer here.");
  const task = { ...taskFromInput(input, clock, existing), active: existing.active };
  const occurrences = data.occurrences.filter((item) => {
    if (item.taskId !== id || item.status !== "pending") return true;
    if (item.rescheduledFrom || !item.timeAuto || item.date < clock.today) return true;
    return false;
  });
  return { ...data, tasks: data.tasks.map((item) => (item.id === id ? task : item)), occurrences };
}

export function deleteTask(data: AppData, id: string): AppData {
  return {
    ...data,
    tasks: data.tasks.filter((task) => task.id !== id),
    occurrences: data.occurrences.filter((item) => item.taskId !== id || item.status !== "pending"),
    petSchedules: data.petSchedules.filter((item) => item.taskId !== id),
  };
}

export function setTaskActive(data: AppData, id: string, active: boolean, clock: Clock): AppData {
  return { ...data, tasks: data.tasks.map((task) => (task.id === id ? { ...task, active, updatedAt: clock.iso } : task)) };
}

export function completeOccurrence(data: AppData, id: string, clock: Clock): AppData {
  const current = data.occurrences.find((item) => item.id === id);
  if (!current) throw new Error("That task is no longer here.");
  if (current.status === "completed") return data;
  const already = data.xp.some((txn) => txn.occurrenceId === id);
  const xp = already
    ? data.xp
    : [...data.xp, { id: uid(), amount: current.xpReward, reason: "task", occurrenceId: id, taskId: current.taskId, createdAt: clock.iso }];
  const name = data.profile?.name || "Me";
  return {
    ...data,
    xp,
    activity: [
      {
        id: uid(),
        at: clock.iso,
        name,
        memberId: data.profile?.share?.memberId || data.profile?.id || "local",
        title: current.titleSnapshot,
        taskId: current.taskId,
        occurrenceId: id,
      },
      ...(data.activity ?? []),
    ].slice(0, 300),
    occurrences: data.occurrences.map((item) =>
      item.id === id
        ? {
            ...item,
            status: "completed",
            completedAt: clock.iso,
            completedLate: item.status === "missed" || item.date < clock.today,
            doneBy: data.profile?.name || "Me",
            xpAwarded: current.xpReward,
            updatedAt: clock.iso,
          }
        : item,
    ),
  };
}

export function skipOccurrence(data: AppData, id: string, clock: Clock): AppData {
  const current = data.occurrences.find((item) => item.id === id);
  if (!current) throw new Error("That task is no longer here.");
  if (current.status === "completed") throw new Error("Completed tasks stay in your history.");
  if (current.status === "missed") {
    if (!data.profile || data.profile.freezesLeft <= 0) {
      throw new Error("No streak recovery left this week. You can still complete it or move it.");
    }
    return {
      ...data,
      profile: { ...data.profile, freezesLeft: data.profile.freezesLeft - 1, updatedAt: clock.iso },
      occurrences: data.occurrences.map((item) => (item.id === id ? { ...item, status: "skipped", skippedAt: clock.iso, updatedAt: clock.iso } : item)),
    };
  }
  return {
    ...data,
    occurrences: data.occurrences.map((item) => (item.id === id ? { ...item, status: "skipped", skippedAt: clock.iso, updatedAt: clock.iso } : item)),
  };
}

export function rescheduleOccurrence(data: AppData, id: string, date: string, time: string, clock: Clock): AppData {
  const current = data.occurrences.find((item) => item.id === id);
  if (!current) throw new Error("That task is no longer here.");
  if (!isValidDateKey(date) || !isValidTime(time)) throw new Error("Choose a valid date and time.");
  let target = date;
  const clashes = (candidate: string) =>
    data.occurrences.some((item) => item.id !== id && item.taskId === current.taskId && item.date === candidate && item.status !== "skipped" && item.status !== "completed");
  if (clashes(target)) {
    let found = "";
    for (let offset = 1; offset <= 21; offset += 1) {
      const candidate = addDays(date, offset);
      if (!clashes(candidate)) {
        found = candidate;
        break;
      }
    }
    if (!found) throw new Error("That task is already scheduled nearby. Pick another day.");
    target = found;
  }
  return {
    ...data,
    occurrences: data.occurrences.map((item) =>
      item.id === id
        ? {
            ...item,
            date: target,
            time,
            timeAuto: false,
            overflow: false,
            status: "pending",
            rescheduledFrom: target === current.date ? item.rescheduledFrom : item.rescheduledFrom || current.date,
            updatedAt: clock.iso,
          }
        : item,
    ),
  };
}

export function toggleSubtask(data: AppData, occurrenceId: string, subtaskId: string, clock: Clock): AppData {
  return {
    ...data,
    occurrences: data.occurrences.map((item) => {
      if (item.id !== occurrenceId) return item;
      const done = item.subtaskDone.includes(subtaskId) ? item.subtaskDone.filter((id) => id !== subtaskId) : [...item.subtaskDone, subtaskId];
      return { ...item, subtaskDone: done, updatedAt: clock.iso };
    }),
  };
}

export function setOccurrenceNote(data: AppData, id: string, note: string, clock: Clock): AppData {
  return { ...data, occurrences: data.occurrences.map((item) => (item.id === id ? { ...item, note: note.slice(0, 500), updatedAt: clock.iso } : item)) };
}

export function acceptPlan(data: AppData, items: Array<{ id: string; time: string }>, clock: Clock): AppData {
  if (!data.profile) return data;
  let next = data;
  for (const item of items) {
    if (!isValidTime(item.time)) continue;
    next = rescheduleOccurrence(next, item.id, clock.today, item.time, clock);
  }
  const early = clock.minutes < toMinutes(data.profile.availabilityStart);
  return {
    ...next,
    earlyOrganizer: data.earlyOrganizer || early,
    plannerAccepted: data.plannerAccepted.includes(clock.today) ? data.plannerAccepted : [...data.plannerAccepted, clock.today],
  };
}

export function suggestTonight(data: AppData, clock: Clock): PlanItem[] {
  if (!data.profile) return [];
  const cap = workloadCap(data.profile.weeklyWorkload);
  const start = Math.max(clock.minutes, toMinutes(data.profile.availabilityStart));
  const end = toMinutes(data.profile.availabilityEnd);
  const remaining = Math.max(20, end - start);
  const candidates = data.occurrences.filter((item) => {
    if (item.window === "day") return false;
    if (item.status === "pending" && item.date === clock.today) return true;
    return item.status === "missed";
  });
  const rank = { high: 0, medium: 1, low: 2 };
  candidates.sort((a, b) => rank[a.priority] - rank[b.priority] || a.durationMinutes - b.durationMinutes);
  const picked = [];
  let used = 0;
  let demanding = 0;
  for (const item of candidates) {
    if (picked.length >= cap.max) break;
    const heavy = item.durationMinutes >= 40 || item.priority === "high";
    if (heavy && demanding >= cap.demanding) continue;
    if (picked.length && used + item.durationMinutes > remaining) continue;
    picked.push(item);
    used += item.durationMinutes + 10;
    if (heavy) demanding += 1;
  }
  let cursor = Math.min(start, Math.max(toMinutes(data.profile.availabilityStart), end - 15));
  if (clock.minutes < toMinutes(data.profile.availabilityStart)) cursor = toMinutes(data.profile.availabilityStart);
  return picked.map((item) => {
    const time = fromMinutes(Math.min(cursor, Math.max(toMinutes(data.profile!.availabilityStart), end - 10)));
    cursor += item.durationMinutes + 10;
    return {
      occurrenceId: item.id,
      title: item.titleSnapshot,
      time,
      duration: item.durationMinutes,
      priority: item.priority,
      reason: item.status === "missed" ? "Catch up" : item.overflow ? "Keep it light" : "Fits tonight",
    };
  });
}

export function snoozeOccurrence(data: AppData, id: string, minutes: number, clock: Clock): AppData {
  const until = new Date(clock.now.getTime() + minutes * 60000).toISOString();
  return { ...data, occurrences: data.occurrences.map((item) => (item.id === id ? { ...item, snoozedUntil: until, updatedAt: clock.iso } : item)) };
}

export function ackReminder(data: AppData, key: string): AppData {
  if (data.firedReminders.includes(key)) return data;
  return { ...data, firedReminders: [...data.firedReminders, key].slice(-300) };
}

export function createCategory(data: AppData, input: { name: string; icon: string; area: Category["area"] }): AppData {
  const name = input.name.trim();
  if (!name) throw new Error("Name the category.");
  const category: Category = { id: uid(), name, icon: input.icon || "Circle", area: input.area, effect: "glow", builtIn: false };
  return { ...data, categories: [...data.categories, category] };
}

export function deleteCategory(data: AppData, id: string): AppData {
  const category = data.categories.find((item) => item.id === id);
  if (!category || category.builtIn) throw new Error("Built-in rooms stay available.");
  if (data.tasks.some((task) => task.categoryId === id)) throw new Error("Move tasks out of this category first.");
  return { ...data, categories: data.categories.filter((item) => item.id !== id) };
}

export function createPet(
  data: AppData,
  input: { name: string; type: string; photo?: string; notes: string; cares: string[] },
  clock: Clock,
  planKey?: string,
): { data: AppData; petId: string } {
  const name = input.name.trim();
  if (!name) throw new Error("Give your pet a name.");
  const pet: Pet = { id: uid(), planKey, name, type: input.type || "Other", photo: input.photo, notes: input.notes.trim(), createdAt: clock.iso, updatedAt: clock.iso };
  let next: AppData = { ...data, pets: [...data.pets, pet] };
  const remind = reminderFor(data.profile?.reminderStyle ?? "gentle");
  for (const careId of input.cares) {
    const care = PET_CARES.find((item) => item.id === careId);
    if (!care) continue;
    const before = next.tasks.length;
    next = createTask(next, {
      title: `${care.label} · ${name}`,
      description: `${care.label} for ${name}.`,
      categoryId: "pet",
      icon: "PawPrint",
      priority: care.priority,
      durationMinutes: care.durationMinutes,
      xpReward: xpFor(care.durationMinutes, care.priority),
      recurrence: care.recurrence,
      anchorDate: clock.today,
      preferredTime: care.preferredTime,
      flexible: care.flexible,
      window: "evening",
      reminderMinutes: remind,
      notes: "",
      subtasks: [],
      area: "pet",
      petId: pet.id,
      planKey: `pet-care:${pet.id}:${care.id}`,
    }, clock);
    const task = next.tasks[before];
    if (task) next = { ...next, petSchedules: [...next.petSchedules, { id: uid(), petId: pet.id, taskId: task.id, kind: care.id }] };
  }
  return { data: next, petId: pet.id };
}

export function updatePet(data: AppData, id: string, input: { name: string; type: string; photo?: string; notes: string }, clock: Clock): AppData {
  const name = input.name.trim();
  if (!name) throw new Error("Give your pet a name.");
  return {
    ...data,
    pets: data.pets.map((pet) => (pet.id === id ? { ...pet, name, type: input.type, photo: input.photo, notes: input.notes.trim(), updatedAt: clock.iso } : pet)),
  };
}

export function deletePet(data: AppData, id: string): AppData {
  const taskIds = new Set(data.petSchedules.filter((item) => item.petId === id).map((item) => item.taskId));
  return {
    ...data,
    pets: data.pets.filter((pet) => pet.id !== id),
    petSchedules: data.petSchedules.filter((item) => item.petId !== id),
    tasks: data.tasks.filter((task) => !taskIds.has(task.id) || data.occurrences.some((item) => item.taskId === task.id && item.status === "completed")).map((task) => (taskIds.has(task.id) ? { ...task, active: false } : task)),
    occurrences: data.occurrences.filter((item) => !taskIds.has(item.taskId) || item.status !== "pending"),
  };
}

export function createProject(
  data: AppData,
  input: { name: string; description: string; kind: Project["kind"]; deadline?: string; color?: string; incomeNotes: string; expenseNotes: string },
  clock: Clock,
  planKey?: string,
): { data: AppData; projectId: string } {
  const name = input.name.trim();
  if (!name) throw new Error("Name the project.");
  const project: Project = {
    id: uid(),
    planKey,
    name,
    description: input.description.trim(),
    kind: input.kind,
    deadline: input.deadline || undefined,
    color: input.color || "#e56b93",
    incomeNotes: input.incomeNotes.trim(),
    expenseNotes: input.expenseNotes.trim(),
    archived: false,
    createdAt: clock.iso,
    updatedAt: clock.iso,
  };
  return { data: { ...data, projects: [...data.projects, project] }, projectId: project.id };
}

export function updateProject(data: AppData, id: string, input: Omit<Project, "id" | "planKey" | "createdAt" | "updatedAt" | "archived"> & { archived?: boolean }, clock: Clock): AppData {
  if (!input.name.trim()) throw new Error("Name the project.");
  return {
    ...data,
    projects: data.projects.map((project) =>
      project.id === id
        ? { ...project, ...input, name: input.name.trim(), description: input.description.trim(), incomeNotes: input.incomeNotes.trim(), expenseNotes: input.expenseNotes.trim(), updatedAt: clock.iso }
        : project,
    ),
  };
}

export function deleteProject(data: AppData, id: string): AppData {
  return {
    ...data,
    projects: data.projects.filter((project) => project.id !== id),
    tasks: data.tasks.map((task) => (task.projectId === id ? { ...task, projectId: undefined } : task)),
  };
}

export function updateProfile(data: AppData, patch: Partial<Profile>, clock: Clock): AppData {
  if (!data.profile) throw new Error("Finish the introduction first.");
  const profile = { ...data.profile, ...patch, id: data.profile.id, onboarded: data.profile.onboarded, updatedAt: clock.iso };
  if (toMinutes(profile.availabilityEnd) <= toMinutes(profile.availabilityStart)) throw new Error("Availability needs an end time after the start.");
  if (toMinutes(profile.workEnd) <= toMinutes(profile.workStart)) throw new Error("Work hours need an end time after the start.");
  return { ...data, profile };
}

export function importData(raw: string): AppData {
  let parsed: AppData;
  try {
    parsed = JSON.parse(raw) as AppData;
  } catch {
    throw new Error("That file is not a Hearth backup.");
  }
  if (parsed.version !== 1 || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.occurrences)) {
    throw new Error("That backup is missing Hearth data.");
  }
  return hydrate({
    ...freshData(),
    ...parsed,
    profile: parsed.profile ? { ...parsed.profile, showXp: parsed.profile.showXp ?? true } : null,
    categories: parsed.categories?.length ? parsed.categories : freshData().categories,
    firedReminders: parsed.firedReminders ?? [],
    petSchedules: parsed.petSchedules ?? [],
    achievements: parsed.achievements ?? [],
    xp: parsed.xp ?? [],
  });
}
