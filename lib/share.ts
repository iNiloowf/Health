import type { AppData, Occurrence, Task } from "./types";

export interface ShareMember {
  id: string;
  name: string;
  joinedAt: string;
}

export interface SharedHome {
  code: string;
  revision: number;
  updatedAt: string;
  members: ShareMember[];
  tasks: Task[];
  occurrences: Occurrence[];
  removedTaskIds: string[];
}

const STATUS_RANK: Record<Occurrence["status"], number> = {
  pending: 0,
  missed: 1,
  skipped: 2,
  completed: 3,
};

export function householdTasks(data: AppData): Task[] {
  return data.tasks.filter((task) => task.area === "household");
}

export function householdOccurrences(data: AppData, taskIds: Set<string>): Occurrence[] {
  return data.occurrences.filter((item) => taskIds.has(item.taskId));
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
  const localHousehold = householdTasks(data).filter((task) => !removed.has(task.id));
  const tasks = [
    ...data.tasks.filter((task) => task.area !== "household"),
    ...mergeById(localHousehold, remote.tasks.filter((task) => !removed.has(task.id)), pickTask),
  ];
  const sharedIds = new Set(tasks.filter((task) => task.area === "household").map((task) => task.id));
  const localShared = data.occurrences.filter((item) => sharedIds.has(item.taskId) || (item.area === "household" && !removed.has(item.taskId)));
  const occurrences = [
    ...data.occurrences.filter((item) => item.area !== "household" && !sharedIds.has(item.taskId)),
    ...mergeById(
      localShared.filter((item) => sharedIds.has(item.taskId)),
      remote.occurrences.filter((item) => sharedIds.has(item.taskId)),
      pickOccurrence,
    ),
  ];
  return {
    ...data,
    tasks,
    occurrences,
    profile: data.profile
      ? { ...data.profile, share: { code: remote.code, memberId, revision: remote.revision } }
      : data.profile,
  };
}
