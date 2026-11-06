import { householdOccurrences, householdTasks, type SharedHome } from "./share";
import type { AppData } from "./types";

async function send<T>(body: unknown): Promise<T> {
  const response = await fetch("/api/share", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Could not reach the shared home.");
  return payload;
}

export function pullHome(code: string): Promise<SharedHome> {
  return fetch(`/api/share?code=${encodeURIComponent(code)}`, { cache: "no-store" }).then(async (response) => {
    const payload = (await response.json()) as SharedHome & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Could not reach the shared home.");
    return payload;
  });
}

export function createSharedHome(data: AppData, memberId: string) {
  const tasks = householdTasks(data);
  return send<SharedHome>({
    action: "create",
    name: data.profile?.name || "Me",
    memberId,
    tasks,
    occurrences: householdOccurrences(data, new Set(tasks.map((task) => task.id))),
  });
}

export function joinSharedHome(code: string, name: string, memberId: string) {
  return send<SharedHome>({ action: "join", code, name, memberId });
}

export function pushSharedHome(data: AppData, memberId: string, droppedTaskIds: string[]) {
  const share = data.profile?.share;
  if (!share) throw new Error("No shared home.");
  const tasks = householdTasks(data);
  return send<SharedHome>({
    action: "push",
    code: share.code,
    name: data.profile?.name || "Me",
    memberId,
    tasks,
    occurrences: householdOccurrences(data, new Set(tasks.map((task) => task.id))),
    droppedTaskIds,
  });
}

export function leaveSharedHome(code: string, memberId: string) {
  return send<{ ok: boolean }>({ action: "leave", code, memberId });
}
