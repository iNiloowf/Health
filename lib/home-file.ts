import { readDoc, removeDoc, writeDoc } from "./doc-store";
import type { ActivityEntry, Occurrence, OnboardingAnswers, Task } from "./types";
import { mergeActivity, mergeById, mergeOnboarding, pickOccurrence, pickTask, type SharedHome, type ShareMember } from "./share";
const WORDS = ["peach", "blush", "lily", "rose", "honey", "pearl", "daisy", "coco", "petal", "sugar", "cherry", "bunny"];

let chain: Promise<unknown> = Promise.resolve();

function lock<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(job, job);
  chain = run.then(() => undefined, () => undefined);
  return run;
}

function cleanCode(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function homeKey(code: string): string {
  return `homes/${code}.json`;
}

async function load(code: string): Promise<{ home: SharedHome; etag: string | null } | null> {
  const doc = await readDoc<SharedHome>(homeKey(code));
  if (!doc) return null;
  const home = doc.value;
  home.removedTaskIds ??= [];
  home.members ??= [];
  home.tasks ??= [];
  home.occurrences ??= [];
  home.onboarding ??= null;
  home.activity ??= [];
  return { home, etag: doc.etag };
}

async function save(home: SharedHome, etag: string | null): Promise<SharedHome | null> {
  const saved = await writeDoc(homeKey(home.code), home, etag);
  return saved ? home : null;
}

async function commitHome(code: string, change: (home: SharedHome) => SharedHome): Promise<SharedHome> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const loaded = await load(code);
    if (!loaded) throw new Error("This home is no longer here.");
    const next = change(loaded.home);
    const saved = await save(next, attempt === 4 ? null : loaded.etag);
    if (saved) return saved;
  }
  throw new Error("This home changed while saving. Try again.");
}

function stamp(
  home: SharedHome,
  tasks: Task[],
  occurrences: Occurrence[],
  members: ShareMember[],
  removed: string[],
  onboarding: OnboardingAnswers | null,
  activity: ActivityEntry[],
): SharedHome {
  const next = { ...home, tasks, occurrences, members, removedTaskIds: removed, onboarding, activity, updatedAt: new Date().toISOString() };
  const changed = JSON.stringify({ tasks, occurrences, members, removed, onboarding, activity }) !== JSON.stringify({
    tasks: home.tasks,
    occurrences: home.occurrences,
    members: home.members,
    removed: home.removedTaskIds,
    onboarding: home.onboarding ?? null,
    activity: home.activity ?? [],
  });
  if (changed) next.revision += 1;
  return next;
}

export function readHome(code: string): Promise<SharedHome | null> {
  return lock(async () => (await load(cleanCode(code)))?.home ?? null);
}

export function createHome(input: {
  name: string;
  memberId: string;
  tasks: Task[];
  occurrences: Occurrence[];
  onboarding?: OnboardingAnswers | null;
  activity?: ActivityEntry[];
}): Promise<SharedHome> {
  return lock(async () => {
    let code = "";
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const word = WORDS[Math.floor(Math.random() * WORDS.length)];
      code = `${word}${Math.floor(10 + Math.random() * 90)}`;
      if (!(await load(code))) break;
    }
    const tasks = input.tasks;
    const ids = new Set(tasks.map((task) => task.id));
    const now = new Date().toISOString();
    const created = await save({
      code,
      revision: 1,
      updatedAt: now,
      members: [{ id: input.memberId, name: input.name.trim() || "Me", joinedAt: now }],
      tasks,
      occurrences: input.occurrences.filter((item) => ids.has(item.taskId)),
      removedTaskIds: [],
      onboarding: input.onboarding ?? null,
      activity: input.activity ?? [],
    }, null);
    if (!created) throw new Error("Could not make a code. Try again.");
    return created;
  });
}

export function joinHome(input: { code: string; name: string; memberId: string }): Promise<SharedHome> {
  return lock(async () => {
    const loaded = await load(cleanCode(input.code));
    if (!loaded) throw new Error("No home with that code.");
    return commitHome(cleanCode(input.code), (home) => {
      const name = input.name.trim() || "Me";
      const members = home.members.some((member) => member.id === input.memberId)
        ? home.members.map((member) => (member.id === input.memberId ? { ...member, name } : member))
        : [...home.members, { id: input.memberId, name, joinedAt: new Date().toISOString() }];
      return stamp(home, home.tasks, home.occurrences, members, home.removedTaskIds, home.onboarding ?? null, home.activity ?? []);
    });
  });
}

export function pushHome(input: {
  code: string;
  memberId: string;
  name: string;
  tasks: Task[];
  occurrences: Occurrence[];
  droppedTaskIds: string[];
  onboarding?: OnboardingAnswers | null;
  activity?: ActivityEntry[];
}): Promise<SharedHome> {
  return lock(async () => {
    return commitHome(cleanCode(input.code), (home) => {
      if (!home.members.some((member) => member.id === input.memberId)) throw new Error("Join this home first.");
      const removed = [...new Set([...home.removedTaskIds, ...input.droppedTaskIds.filter(Boolean)])];
      const removedSet = new Set(removed);
      const incomingTasks = input.tasks.filter((task) => !removedSet.has(task.id));
      const tasks = mergeById(home.tasks.filter((task) => !removedSet.has(task.id)), incomingTasks, pickTask);
      const ids = new Set(tasks.map((task) => task.id));
      const incomingOccurrences = input.occurrences.filter((item) => ids.has(item.taskId));
      const occurrences = mergeById(
        home.occurrences.filter((item) => ids.has(item.taskId)),
        incomingOccurrences,
        pickOccurrence,
      );
      const members = home.members.map((member) => (member.id === input.memberId ? { ...member, name: input.name.trim() || member.name } : member));
      const onboarding = mergeOnboarding(home.onboarding ?? null, input.onboarding ?? null);
      const activity = mergeActivity(home.activity ?? [], input.activity ?? []);
      return stamp(home, tasks, occurrences, members, removed, onboarding, activity);
    });
  });
}

export function leaveHome(input: { code: string; memberId: string }): Promise<void> {
  return lock(async () => {
    const code = cleanCode(input.code);
    const loaded = await load(code);
    if (!loaded) return;
    const members = loaded.home.members.filter((member) => member.id !== input.memberId);
    if (!members.length) {
      await removeDoc(homeKey(code));
      return;
    }
    await commitHome(code, (home) => {
      const nextMembers = home.members.filter((member) => member.id !== input.memberId);
      return stamp(home, home.tasks, home.occurrences, nextMembers, home.removedTaskIds, home.onboarding ?? null, home.activity ?? []);
    });
  });
}
