import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import type { Occurrence, Task } from "./types";
import { mergeById, pickOccurrence, pickTask, type SharedHome, type ShareMember } from "./share";

const DIRECTORY = path.join(process.cwd(), "data", "homes");
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

async function load(code: string): Promise<SharedHome | null> {
  try {
    const text = await readFile(path.join(DIRECTORY, `${code}.json`), "utf8");
    const home = JSON.parse(text) as SharedHome;
    home.removedTaskIds ??= [];
    home.members ??= [];
    home.tasks ??= [];
    home.occurrences ??= [];
    return home;
  } catch {
    return null;
  }
}

async function save(home: SharedHome): Promise<SharedHome> {
  await mkdir(DIRECTORY, { recursive: true });
  await writeFile(path.join(DIRECTORY, `${home.code}.json`), JSON.stringify(home), "utf8");
  return home;
}

function stamp(home: SharedHome, tasks: Task[], occurrences: Occurrence[], members: ShareMember[], removed: string[]): SharedHome {
  const next = { ...home, tasks, occurrences, members, removedTaskIds: removed, updatedAt: new Date().toISOString() };
  const changed = JSON.stringify({ tasks, occurrences, members, removed }) !== JSON.stringify({
    tasks: home.tasks,
    occurrences: home.occurrences,
    members: home.members,
    removed: home.removedTaskIds,
  });
  if (changed) next.revision += 1;
  return next;
}

export function readHome(code: string): Promise<SharedHome | null> {
  return lock(() => load(cleanCode(code)));
}

export function createHome(input: { name: string; memberId: string; tasks: Task[]; occurrences: Occurrence[] }): Promise<SharedHome> {
  return lock(async () => {
    await mkdir(DIRECTORY, { recursive: true });
    let code = "";
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const word = WORDS[Math.floor(Math.random() * WORDS.length)];
      code = `${word}${Math.floor(10 + Math.random() * 90)}`;
      if (!(await load(code))) break;
    }
    const tasks = input.tasks.filter((task) => task.area === "household");
    const ids = new Set(tasks.map((task) => task.id));
    const now = new Date().toISOString();
    return save({
      code,
      revision: 1,
      updatedAt: now,
      members: [{ id: input.memberId, name: input.name.trim() || "Me", joinedAt: now }],
      tasks,
      occurrences: input.occurrences.filter((item) => ids.has(item.taskId)),
      removedTaskIds: [],
    });
  });
}

export function joinHome(input: { code: string; name: string; memberId: string }): Promise<SharedHome> {
  return lock(async () => {
    const home = await load(cleanCode(input.code));
    if (!home) throw new Error("No home with that code.");
    const name = input.name.trim() || "Me";
    const members = home.members.some((member) => member.id === input.memberId)
      ? home.members.map((member) => (member.id === input.memberId ? { ...member, name } : member))
      : [...home.members, { id: input.memberId, name, joinedAt: new Date().toISOString() }];
    return save(stamp(home, home.tasks, home.occurrences, members, home.removedTaskIds));
  });
}

export function pushHome(input: {
  code: string;
  memberId: string;
  name: string;
  tasks: Task[];
  occurrences: Occurrence[];
  droppedTaskIds: string[];
}): Promise<SharedHome> {
  return lock(async () => {
    const home = await load(cleanCode(input.code));
    if (!home) throw new Error("This home is no longer here.");
    if (!home.members.some((member) => member.id === input.memberId)) throw new Error("Join this home first.");
    const removed = [...new Set([...home.removedTaskIds, ...input.droppedTaskIds.filter(Boolean)])];
    const removedSet = new Set(removed);
    const incomingTasks = input.tasks.filter((task) => task.area === "household" && !removedSet.has(task.id));
    const tasks = mergeById(home.tasks.filter((task) => !removedSet.has(task.id)), incomingTasks, pickTask);
    const ids = new Set(tasks.map((task) => task.id));
    const incomingOccurrences = input.occurrences.filter((item) => ids.has(item.taskId));
    const occurrences = mergeById(
      home.occurrences.filter((item) => ids.has(item.taskId)),
      incomingOccurrences,
      pickOccurrence,
    );
    const members = home.members.map((member) => (member.id === input.memberId ? { ...member, name: input.name.trim() || member.name } : member));
    return save(stamp(home, tasks, occurrences, members, removed));
  });
}

export function leaveHome(input: { code: string; memberId: string }): Promise<void> {
  return lock(async () => {
    const code = cleanCode(input.code);
    const home = await load(code);
    if (!home) return;
    const members = home.members.filter((member) => member.id !== input.memberId);
    if (!members.length) {
      await rm(path.join(DIRECTORY, `${code}.json`), { force: true });
      return;
    }
    await save(stamp(home, home.tasks, home.occurrences, members, home.removedTaskIds));
  });
}
