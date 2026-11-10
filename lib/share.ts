import { stampCovered } from "./questions";
import type { ActivityEntry, AppData, HouseholdMember, Occurrence, OnboardingAnswers, Task } from "./types";

export type ShareMember = HouseholdMember;

export interface SharedHome {
  code: string;
  revision: number;
  updatedAt: string;
  members: ShareMember[];
  tasks: Task[];
  occurrences: Occurrence[];
  removedTaskIds: string[];
  onboarding: OnboardingAnswers | null;
  activity: ActivityEntry[];
}

export function mergeActivity(left: ActivityEntry[] = [], right: ActivityEntry[] = []): ActivityEntry[] {
  const map = new Map<string, ActivityEntry>();
  for (const item of [...left, ...right]) map.set(item.id, item);
  return [...map.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 300);
}

export function mergeOnboarding(current: OnboardingAnswers | null, incoming: OnboardingAnswers | null): OnboardingAnswers | null {
  if (!incoming) return current;
  if (!current) return stampCovered(incoming);
  const base = stampCovered(current);
  const next = stampCovered(incoming);
  const chores = { ...base.chores };
  for (const [id, pace] of Object.entries(next.chores ?? {})) {
    if (pace && pace !== "never" && (!chores[id] || chores[id] === "never")) chores[id] = pace;
  }
  const starting = { ...base.starting };
  for (const [id, pace] of Object.entries(next.starting ?? {})) {
    if (pace && pace !== "never" && (!starting[id] || starting[id] === "never")) starting[id] = pace;
  }
  const petKey = (pet: { name: string; type: string }) => `${pet.name.trim().toLowerCase()}|${pet.type}`;
  const pets = [...base.pets];
  for (const pet of next.pets) {
    if (pet.name.trim() && !pets.some((item) => petKey(item) === petKey(pet))) pets.push(pet);
  }
  const goals = [...base.goals];
  for (const goal of next.goals) {
    const text = goal.trim();
    if (text && !goals.some((item) => item.trim() === text)) goals.push(text);
  }
  const steps = new Set(next.answeredSteps ?? []);
  return {
    ...base,
    wake: steps.has("rhythm") ? next.wake : base.wake,
    sleep: steps.has("rhythm") ? next.sleep : base.sleep,
    availabilityStart: steps.has("hours") ? next.availabilityStart : base.availabilityStart,
    availabilityEnd: steps.has("hours") ? next.availabilityEnd : base.availabilityEnd,
    weekStartsOn: steps.has("hours") ? next.weekStartsOn : base.weekStartsOn,
    workStart: steps.has("hours") ? next.workStart : base.workStart,
    workEnd: steps.has("hours") ? next.workEnd : base.workEnd,
    workWhen: steps.has("hours") ? next.workWhen : base.workWhen,
    reminderStyle: steps.has("prefs") ? next.reminderStyle : base.reminderStyle,
    weeklyWorkload: steps.has("prefs") ? next.weeklyWorkload : base.weeklyWorkload,
    animation: steps.has("prefs") ? next.animation : base.animation,
    chores,
    starting,
    pets,
    habits: [...new Set([...base.habits, ...next.habits].map((item) => item.trim()).filter(Boolean))],
    workAreas: [...new Set([...base.workAreas, ...next.workAreas])],
    goals,
    name: base.name.trim() ? base.name : next.name,
    answeredSteps: [...new Set([...(base.answeredSteps ?? []), ...(next.answeredSteps ?? [])])],
  };
}

const STATUS_RANK: Record<Occurrence["status"], number> = {
  pending: 0,
  missed: 1,
  skipped: 2,
  completed: 3,
};

export function householdTasks(data: AppData): Task[] {
  return data.tasks;
}

export function householdOccurrences(data: AppData, taskIds: Set<string>): Occurrence[] {
  return data.occurrences.filter((item) => taskIds.has(item.taskId));
}

export function memberSignature(members: HouseholdMember[] | undefined): string {
  return [...(members ?? [])].map((member) => `${member.id}:${member.name}`).sort().join("|");
}

export function householdSignature(tasks: Task[], occurrences: Occurrence[]): string {
  return JSON.stringify({
    tasks: [...tasks].sort((a, b) => a.id.localeCompare(b.id)),
    occurrences: [...occurrences].sort((a, b) => a.id.localeCompare(b.id)),
  });
}

export function pickTask(left: Task, right: Task): Task {
  return left.updatedAt >= right.updatedAt ? left : right;
}

export function pickOccurrence(left: Occurrence, right: Occurrence): Occurrence {
  const winner = STATUS_RANK[left.status] === STATUS_RANK[right.status]
    ? (left.updatedAt >= right.updatedAt ? left : right)
    : (STATUS_RANK[left.status] > STATUS_RANK[right.status] ? left : right);
  const other = winner === left ? right : left;
  return {
    ...winner,
    doneBy: winner.doneBy || other.doneBy,
    xpAwarded: winner.xpAwarded || other.xpAwarded,
    subtaskDone: [...new Set([...left.subtaskDone, ...right.subtaskDone])].sort(),
  };
}

export function mergeById<T extends { id: string }>(left: T[], right: T[], pick: (a: T, b: T) => T): T[] {
  const map = new Map<string, T>();
  for (const item of left) map.set(item.id, item);
  for (const item of right) {
    const previous = map.get(item.id);
    map.set(item.id, previous ? pick(previous, item) : item);
  }
  return [...map.values()];
}

export function applyShared(data: AppData, remote: SharedHome, memberId: string): AppData {
  const removed = new Set(remote.removedTaskIds);
  const tasks = mergeById(
    data.tasks.filter((task) => !removed.has(task.id)),
    remote.tasks.filter((task) => !removed.has(task.id)),
    pickTask,
  );
  const ids = new Set(tasks.map((task) => task.id));
  const occurrences = mergeById(
    data.occurrences.filter((item) => ids.has(item.taskId)),
    remote.occurrences.filter((item) => ids.has(item.taskId)),
    pickOccurrence,
  );
  return {
    ...data,
    tasks,
    occurrences,
    activity: mergeActivity(data.activity, remote.activity),
    members: remote.members ?? [],
    profile: data.profile
      ? { ...data.profile, share: { code: remote.code, memberId, revision: remote.revision } }
      : data.profile,
  };
}
