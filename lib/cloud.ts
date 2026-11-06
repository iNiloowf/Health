import type { SupabaseClient } from "@supabase/supabase-js";
import { freshData } from "./engine";
import { mergeActivity } from "./share";
import type { AppData, Category, Occurrence, Pet, PetSchedule, Profile, Project, Subtask, Task, XpTxn } from "./types";

type Row = Record<string, unknown>;

function chunk<T>(items: T[], size = 200): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}

async function upsert(sb: SupabaseClient, table: string, rows: Row[], conflict: string) {
  for (const group of chunk(rows)) {
    const { error } = await sb.from(table).upsert(group, { onConflict: conflict });
    if (error) throw new Error(error.message);
  }
}

async function removeMissing(sb: SupabaseClient, table: string, userId: string, ids: string[], key = "id") {
  const { data, error } = await sb.from(table).select(key).eq("user_id", userId);
  if (error) throw new Error(error.message);
  const keep = new Set(ids);
  const stale = ((data ?? []) as unknown as Row[]).map((row) => String(row[key])).filter((id) => !keep.has(id));
  for (const group of chunk(stale, 100)) {
    const { error: deleteError } = await sb.from(table).delete().eq("user_id", userId).in(key, group);
    if (deleteError) throw new Error(deleteError.message);
  }
}

function profileRow(userId: string, profile: Profile, data: AppData): Row {
  return {
    id: userId,
    name: profile.name,
    avatar: profile.avatar ?? null,
    timezone: profile.timezone,
    week_starts_on: profile.weekStartsOn,
    availability_start: profile.availabilityStart,
    availability_end: profile.availabilityEnd,
    work_start: profile.workStart,
    work_end: profile.workEnd,
    wake: profile.wake,
    sleep: profile.sleep,
    theme: profile.theme,
    reduced_motion: profile.reducedMotion,
    animation: profile.animation,
    reminder_style: profile.reminderStyle,
    weekly_workload: profile.weeklyWorkload,
    quiet_start: profile.quietStart,
    quiet_end: profile.quietEnd,
    notifications_enabled: profile.notificationsEnabled,
    show_xp: profile.showXp,
    onboarded: profile.onboarded,
    onboarding: profile.onboarding,
    streak_freezes: profile.streakFreezes,
    freezes_left: profile.freezesLeft,
    freeze_week: profile.freezeWeek,
    early_organizer: data.earlyOrganizer,
    planner_accepted: data.plannerAccepted,
    fired_reminders: data.firedReminders,
    activity: data.activity ?? [],
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}

function profileFrom(row: Row, fallback: Profile["id"]): { profile: Profile; earlyOrganizer: boolean; plannerAccepted: string[]; firedReminders: string[]; activity: AppData["activity"] } {
  return {
    earlyOrganizer: Boolean(row.early_organizer),
    plannerAccepted: (row.planner_accepted as string[]) ?? [],
    firedReminders: (row.fired_reminders as string[]) ?? [],
    activity: Array.isArray(row.activity) ? (row.activity as AppData["activity"]) : [],
    profile: {
      id: fallback,
      name: String(row.name ?? ""),
      avatar: (row.avatar as string | null) ?? undefined,
      timezone: String(row.timezone ?? "UTC"),
      weekStartsOn: (row.week_starts_on === 0 ? 0 : 1) as 0 | 1,
      availabilityStart: String(row.availability_start ?? "18:00"),
      availabilityEnd: String(row.availability_end ?? "23:00"),
      workStart: String(row.work_start ?? "09:00"),
      workEnd: String(row.work_end ?? "17:00"),
      wake: String(row.wake ?? "07:30"),
      sleep: String(row.sleep ?? "23:30"),
      theme: (row.theme as Profile["theme"]) ?? "system",
      reducedMotion: Boolean(row.reduced_motion),
      animation: (row.animation as Profile["animation"]) ?? "normal",
      reminderStyle: (row.reminder_style as Profile["reminderStyle"]) ?? "gentle",
      weeklyWorkload: (row.weekly_workload as Profile["weeklyWorkload"]) ?? "balanced",
      quietStart: String(row.quiet_start ?? "23:00"),
      quietEnd: String(row.quiet_end ?? "18:00"),
      notificationsEnabled: Boolean(row.notifications_enabled),
      showXp: row.show_xp !== false,
      onboarded: Boolean(row.onboarded),
      onboarding: (row.onboarding as Profile["onboarding"]) ?? null,
      streakFreezes: Number(row.streak_freezes ?? 1),
      freezesLeft: Number(row.freezes_left ?? 1),
      freezeWeek: String(row.freeze_week ?? ""),
      share: null,
      createdAt: String(row.created_at ?? new Date().toISOString()),
      updatedAt: String(row.updated_at ?? new Date().toISOString()),
    },
  };
}

export async function pushAll(sb: SupabaseClient, userId: string, data: AppData) {
  if (!data.profile) return;
  const { error } = await sb.from("profiles").upsert(profileRow(userId, data.profile, data));
  if (error) throw new Error(error.message);

  const categories = data.categories.map((category) => ({
    user_id: userId,
    id: category.id,
    name: category.name,
    icon: category.icon,
    area: category.area,
    effect: category.effect,
    built_in: category.builtIn,
  }));
  await upsert(sb, "categories", categories, "user_id,id");
  await removeMissing(sb, "categories", userId, categories.map((row) => String(row.id)));

  const tasks = data.tasks.map((task) => ({
    user_id: userId,
    id: task.id,
    plan_key: task.planKey ?? null,
    title: task.title,
    description: task.description,
    category_id: task.categoryId,
    icon: task.icon,
    image: task.image ?? null,
    priority: task.priority,
    duration_minutes: task.durationMinutes,
    xp_reward: task.xpReward,
    anchor_date: task.anchorDate,
    preferred_time: task.preferredTime,
    flexible: task.flexible,
    schedule_window: task.window,
    reminder_minutes: task.reminderMinutes,
    notes: task.notes,
    area: task.area,
    pet_id: task.petId ?? null,
    project_id: task.projectId ?? null,
    active: task.active,
    streak: task.streak,
    longest_streak: task.longestStreak,
    at_risk: task.atRisk,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  }));
  await upsert(sb, "tasks", tasks, "user_id,id");
  await removeMissing(sb, "tasks", userId, tasks.map((row) => String(row.id)));

  const recurrence = data.tasks.map((task) => ({
    user_id: userId,
    task_id: task.id,
    type: task.recurrence.type,
    interval: task.recurrence.interval ?? null,
    weekdays: task.recurrence.weekdays ?? null,
    weekday: task.recurrence.weekday ?? null,
    day_of_month: task.recurrence.dayOfMonth ?? null,
  }));
  await upsert(sb, "task_recurrence", recurrence, "user_id,task_id");
  await removeMissing(sb, "task_recurrence", userId, recurrence.map((row) => String(row.task_id)), "task_id");

  const subtasks = data.tasks.flatMap((task) =>
    task.subtasks.map((subtask, index) => ({
      user_id: userId,
      id: subtask.id,
      task_id: task.id,
      title: subtask.title,
      position: index,
    })),
  );
  await upsert(sb, "subtasks", subtasks, "user_id,id");
  await removeMissing(sb, "subtasks", userId, subtasks.map((row) => String(row.id)));

  const occurrences = data.occurrences.map((item) => ({
    user_id: userId,
    id: item.id,
    task_id: item.taskId,
    cycle_key: item.cycleKey,
    scheduled_date: item.date,
    scheduled_time: item.time,
    time_auto: item.timeAuto,
    overflow: item.overflow,
    status: item.status,
    completed_at: item.completedAt ?? null,
    completed_late: item.completedLate ?? false,
    done_by: item.doneBy ?? null,
    skipped_at: item.skippedAt ?? null,
    rescheduled_from: item.rescheduledFrom ?? null,
    snoozed_until: item.snoozedUntil ?? null,
    subtask_done: item.subtaskDone,
    xp_awarded: item.xpAwarded,
    title_snapshot: item.titleSnapshot,
    category_id: item.categoryId,
    icon: item.icon,
    duration_minutes: item.durationMinutes,
    xp_reward: item.xpReward,
    area: item.area,
    priority: item.priority,
    flexible: item.flexible,
    schedule_window: item.window,
    preferred_time: item.preferredTime,
    reminder_minutes: item.reminderMinutes,
    pet_id: item.petId ?? null,
    project_id: item.projectId ?? null,
    note: item.note ?? null,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  }));
  await upsert(sb, "occurrences", occurrences, "user_id,id");
  await removeMissing(sb, "occurrences", userId, occurrences.map((row) => String(row.id)));

  const pets = data.pets.map((pet) => ({
    user_id: userId,
    id: pet.id,
    plan_key: pet.planKey ?? null,
    name: pet.name,
    type: pet.type,
    photo: pet.photo ?? null,
    notes: pet.notes,
    created_at: pet.createdAt,
    updated_at: pet.updatedAt,
  }));
  await upsert(sb, "pets", pets, "user_id,id");
  await removeMissing(sb, "pets", userId, pets.map((row) => String(row.id)));

  const schedules = data.petSchedules.map((item) => ({
    user_id: userId,
    id: item.id,
    pet_id: item.petId,
    task_id: item.taskId,
    kind: item.kind,
  }));
  await upsert(sb, "pet_care_schedules", schedules, "user_id,id");
  await removeMissing(sb, "pet_care_schedules", userId, schedules.map((row) => String(row.id)));

  const projects = data.projects.map((project) => ({
    user_id: userId,
    id: project.id,
    plan_key: project.planKey ?? null,
    name: project.name,
    description: project.description,
    kind: project.kind,
    deadline: project.deadline ?? null,
    color: project.color,
    income_notes: project.incomeNotes,
    expense_notes: project.expenseNotes,
    archived: project.archived,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  }));
  await upsert(sb, "projects", projects, "user_id,id");
  await removeMissing(sb, "projects", userId, projects.map((row) => String(row.id)));

  const xp = data.xp.map((txn) => ({
    user_id: userId,
    id: txn.id,
    amount: txn.amount,
    reason: txn.reason,
    occurrence_id: txn.occurrenceId ?? null,
    task_id: txn.taskId ?? null,
    created_at: txn.createdAt,
  }));
  await upsert(sb, "xp_transactions", xp, "user_id,id");
  await removeMissing(sb, "xp_transactions", userId, xp.map((row) => String(row.id)));

  const achievements = data.achievements.map((item) => ({
    user_id: userId,
    achievement_id: item.id,
    unlocked_at: item.unlockedAt,
  }));
  await upsert(sb, "user_achievements", achievements, "user_id,achievement_id");
  await removeMissing(sb, "user_achievements", userId, achievements.map((row) => String(row.achievement_id)), "achievement_id");
}

async function allRows(sb: SupabaseClient, table: string, userId: string): Promise<Row[]> {
  const { data, error } = await sb.from(table).select("*").eq(table === "profiles" ? "id" : "user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}

export async function pullAll(sb: SupabaseClient, userId: string): Promise<AppData | null> {
  const { data, error } = await sb.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const packed = profileFrom(data as Row, "local");
  const [categories, tasks, recurrence, subtasks, occurrences, pets, schedules, projects, xp, achievements] = await Promise.all([
    allRows(sb, "categories", userId),
    allRows(sb, "tasks", userId),
    allRows(sb, "task_recurrence", userId),
    allRows(sb, "subtasks", userId),
    allRows(sb, "occurrences", userId),
    allRows(sb, "pets", userId),
    allRows(sb, "pet_care_schedules", userId),
    allRows(sb, "projects", userId),
    allRows(sb, "xp_transactions", userId),
    allRows(sb, "user_achievements", userId),
  ]);
  const ruleByTask = new Map(recurrence.map((row) => [String(row.task_id), row]));
  const stepsByTask = new Map<string, Subtask[]>();
  subtasks
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
    .forEach((row) => {
      const list = stepsByTask.get(String(row.task_id)) ?? [];
      list.push({ id: String(row.id), title: String(row.title) });
      stepsByTask.set(String(row.task_id), list);
    });
  const base = freshData();
  return {
    ...base,
    profile: packed.profile,
    earlyOrganizer: packed.earlyOrganizer,
    plannerAccepted: packed.plannerAccepted,
    firedReminders: packed.firedReminders,
    activity: packed.activity,
    categories: categories.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      icon: String(row.icon),
      area: row.area as Category["area"],
      effect: row.effect as Category["effect"],
      builtIn: Boolean(row.built_in),
    })),
    tasks: tasks.map((row) => {
      const rule = ruleByTask.get(String(row.id));
      return {
        id: String(row.id),
        planKey: (row.plan_key as string | null) ?? undefined,
        title: String(row.title),
        description: String(row.description ?? ""),
        categoryId: String(row.category_id),
        icon: String(row.icon),
        image: (row.image as string | null) ?? undefined,
        priority: row.priority as Task["priority"],
        durationMinutes: Number(row.duration_minutes),
        xpReward: Number(row.xp_reward),
        recurrence: {
          type: (rule?.type as Task["recurrence"]["type"]) ?? "once",
          interval: (rule?.interval as number | null) ?? undefined,
          weekdays: (rule?.weekdays as number[] | null) ?? undefined,
          weekday: (rule?.weekday as number | null) ?? undefined,
          dayOfMonth: (rule?.day_of_month as number | null) ?? undefined,
        },
        anchorDate: String(row.anchor_date),
        preferredTime: (row.preferred_time as string | null) ?? null,
        flexible: Boolean(row.flexible),
        window: row.schedule_window as Task["window"],
        reminderMinutes: (row.reminder_minutes as number | null) ?? null,
        notes: String(row.notes ?? ""),
        subtasks: stepsByTask.get(String(row.id)) ?? [],
        area: row.area as Task["area"],
        petId: (row.pet_id as string | null) ?? undefined,
        projectId: (row.project_id as string | null) ?? undefined,
        active: Boolean(row.active),
        streak: Number(row.streak ?? 0),
        longestStreak: Number(row.longest_streak ?? 0),
        atRisk: Boolean(row.at_risk),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      };
    }),
    occurrences: occurrences.map((row) => ({
      id: String(row.id),
      taskId: String(row.task_id),
      cycleKey: String(row.cycle_key),
      date: String(row.scheduled_date),
      time: String(row.scheduled_time),
      timeAuto: Boolean(row.time_auto),
      overflow: Boolean(row.overflow),
      status: row.status as Occurrence["status"],
      completedAt: (row.completed_at as string | null) ?? undefined,
      completedLate: Boolean(row.completed_late),
      doneBy: (row.done_by as string | null) ?? undefined,
      skippedAt: (row.skipped_at as string | null) ?? undefined,
      rescheduledFrom: (row.rescheduled_from as string | null) ?? undefined,
      snoozedUntil: (row.snoozed_until as string | null) ?? undefined,
      subtaskDone: (row.subtask_done as string[]) ?? [],
      xpAwarded: Number(row.xp_awarded ?? 0),
      titleSnapshot: String(row.title_snapshot),
      categoryId: String(row.category_id),
      icon: String(row.icon),
      durationMinutes: Number(row.duration_minutes),
      xpReward: Number(row.xp_reward),
      area: row.area as Occurrence["area"],
      priority: row.priority as Occurrence["priority"],
      flexible: Boolean(row.flexible),
      window: row.schedule_window as Occurrence["window"],
      preferredTime: (row.preferred_time as string | null) ?? null,
      reminderMinutes: (row.reminder_minutes as number | null) ?? null,
      petId: (row.pet_id as string | null) ?? undefined,
      projectId: (row.project_id as string | null) ?? undefined,
      note: (row.note as string | null) ?? undefined,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    })),
    pets: pets.map((row) => ({
      id: String(row.id),
      planKey: (row.plan_key as string | null) ?? undefined,
      name: String(row.name),
      type: String(row.type),
      photo: (row.photo as string | null) ?? undefined,
      notes: String(row.notes ?? ""),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    })) as Pet[],
    petSchedules: schedules.map((row) => ({
      id: String(row.id),
      petId: String(row.pet_id),
      taskId: String(row.task_id),
      kind: String(row.kind),
    })) as PetSchedule[],
    projects: projects.map((row) => ({
      id: String(row.id),
      planKey: (row.plan_key as string | null) ?? undefined,
      name: String(row.name),
      description: String(row.description ?? ""),
      kind: row.kind as Project["kind"],
      deadline: (row.deadline as string | null) ?? undefined,
      color: String(row.color ?? "#e56b93"),
      incomeNotes: String(row.income_notes ?? ""),
      expenseNotes: String(row.expense_notes ?? ""),
      archived: Boolean(row.archived),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    })),
    xp: xp.map((row) => ({
      id: String(row.id),
      amount: Number(row.amount),
      reason: String(row.reason),
      occurrenceId: (row.occurrence_id as string | null) ?? undefined,
      taskId: (row.task_id as string | null) ?? undefined,
      createdAt: String(row.created_at),
    })) as XpTxn[],
    achievements: achievements.map((row) => ({ id: String(row.achievement_id), unlockedAt: String(row.unlocked_at) })),
  };
}

function byId<T extends { id: string; updatedAt?: string }>(local: T[], remote: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of remote) map.set(item.id, item);
  for (const item of local) {
    const other = map.get(item.id);
    if (!other || (item.updatedAt ?? "") >= (other.updatedAt ?? "")) map.set(item.id, item);
  }
  return [...map.values()];
}

export function mergeData(local: AppData, remote: AppData | null): AppData {
  if (!remote?.profile) return local;
  if (!local.profile?.onboarded) return remote;
  const newer = local.profile.updatedAt >= remote.profile.updatedAt ? local.profile : remote.profile;
  const profile = { ...newer, share: newer.share ?? local.profile.share ?? null };
  return {
    ...local,
    profile,
    categories: byId(local.categories, remote.categories),
    tasks: byId(local.tasks, remote.tasks),
    occurrences: byId(local.occurrences, remote.occurrences),
    pets: byId(local.pets, remote.pets),
    projects: byId(local.projects, remote.projects),
    petSchedules: byId(local.petSchedules, remote.petSchedules),
    xp: byId(local.xp, remote.xp),
    achievements: byId(
      local.achievements.map((item) => ({ ...item, updatedAt: item.unlockedAt })),
      remote.achievements.map((item) => ({ ...item, updatedAt: item.unlockedAt })),
    ).map((item) => ({ id: item.id, unlockedAt: item.unlockedAt })),
    earlyOrganizer: local.earlyOrganizer || remote.earlyOrganizer,
    plannerAccepted: [...new Set([...local.plannerAccepted, ...remote.plannerAccepted])],
    firedReminders: [...new Set([...local.firedReminders, ...remote.firedReminders])].slice(-300),
    activity: mergeActivity(local.activity, remote.activity),
  };
}
