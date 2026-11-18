import { makeClock } from "../lib/dates";
import {
  acceptPlan,
  applyOnboarding,
  buildPlan,
  completeOccurrence,
  createTask,
  defaultAnswers,
  freshData,
  reconcile,
  rescheduleOccurrence,
  skipOccurrence,
  suggestTonight,
} from "../lib/engine";
import { foldIsWaiting, matchesRecurrence, taskStreak } from "../lib/model";
import { levelFor, pointsByPerson, pointsFor } from "../lib/progress";
import { inQuietHours } from "../lib/reminders";
import { openSteps } from "../lib/questions";
import { mergeOnboarding, pickOccurrence } from "../lib/share";
import type { AppData, TaskInput } from "../lib/types";

let failed = 0;

function assert(condition: unknown, message: string) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${message}`);
  }
}

const evening = makeClock("2026-11-05", 16 * 60);
const answers = defaultAnswers();
answers.name = "Niloofar";
answers.chores = {
  ...answers.chores,
  "dishwasher-empty": "daily",
  laundry: "weekly",
  bedsheets: "biweekly",
  fridge: "monthly",
  vacuum: "twice_week",
  trash: "every_2_3",
};
const plan = buildPlan(answers, "2026-11-05");
const selected = plan.tasks.map((task) => task.key);
let data = applyOnboarding(freshData(), answers, selected, [], [], evening);
data = reconcile(data, evening);

const times = data.occurrences.filter((item) => item.window !== "day").map((item) => item.time);
assert(times.length > 0, "household occurrences exist");
assert(times.every((time) => time >= "18:00" && time <= "23:00"), `household times stay after 6 PM: ${times.join(", ")}`);

const laundry = data.tasks.find((task) => task.planKey === "chore:laundry");
assert(laundry?.recurrence.type === "weekly", "laundry is weekly");
assert(laundry?.subtasks.length === 6, "laundry has steps");
const laundryDates = data.occurrences.filter((item) => item.taskId === laundry?.id).map((item) => item.date);
assert(laundryDates.every((date) => matchesRecurrence(laundry!, date)), "laundry dates follow weekly recurrence");
assert(!laundryDates.includes("2026-11-10"), "weekly laundry is not generated on an off day");

const sheets = data.tasks.find((task) => task.planKey === "chore:bedsheets");
assert(sheets?.title === "Wash blankets and bedsheets" && sheets.recurrence.type === "monthly" && sheets.recurrence.dayOfMonth === 4, "blankets and sheets are monthly");
const sheetDates = data.occurrences.filter((item) => item.taskId === sheets?.id && (item.status === "pending" || item.status === "missed")).map((item) => item.date);
assert(sheetDates.length === 1 && sheetDates[0] >= "2026-11-05", `an unfinished monthly chore stays on the list, got ${sheetDates.join(", ")}`);

const fridge = data.tasks.find((task) => task.planKey === "chore:fridge");
const fridgeDates = data.occurrences.filter((item) => item.taskId === fridge?.id).map((item) => item.date);
assert(fridge?.recurrence.dayOfMonth === 26 && fridgeDates.includes("2026-11-26") && fridgeDates.includes("2026-12-26") && fridgeDates.every((date) => date.endsWith("-26")), `fridge stays on its own monthly day, got ${fridgeDates.join(", ")}`);

const trash = data.tasks.find((task) => task.planKey === "chore:trash");
const trashDates = data.occurrences.filter((item) => item.taskId === trash?.id).map((item) => item.date);
assert(trash?.recurrence.type === "daily" && trashDates.includes("2026-11-05") && trashDates.includes("2026-11-06"), "trash is emptied every day");

const bowls = data.tasks.find((task) => task.planKey === "chore:pet-bowls");
const entry = data.tasks.find((task) => task.planKey === "chore:entry");
const nails = data.tasks.find((task) => task.planKey === "chore:cat-nails");
const sink = data.tasks.find((task) => task.planKey === "chore:sink-faucets");
const stove = data.tasks.find((task) => task.planKey === "chore:stove");
assert(bowls?.recurrence.weekday === 1 && entry?.recurrence.weekday === 5, "weekly chores land on different days");
assert(nails?.recurrence.type === "biweekly" && sink?.recurrence.dayOfMonth === 16 && stove?.recurrence.dayOfMonth === 22, "new monthly and biweekly chores keep their own days");
assert(!data.tasks.some((task) => task.title.trim().toLowerCase() === "wash the toilet and bathroom"), "bathroom washing is not added twice");
const rolled = reconcile(data, makeClock("2026-11-10", 16 * 60));
const openBowls = rolled.occurrences.filter((item) => item.taskId === bowls?.id && (item.status === "pending" || item.status === "missed"));
assert(openBowls.length === 1 && openBowls[0]!.date >= "2026-11-10", `unfinished weekly pet bowls stay on the list, got ${openBowls.map((item) => item.date).join(", ")}`);
const piled = new Map<string, number>();
for (const item of rolled.occurrences) {
  if (item.date < "2026-11-10" || item.status === "completed" || item.status === "skipped") continue;
  const task = rolled.tasks.find((entry) => entry.id === item.taskId);
  if (!task || (task.recurrence.type !== "weekly" && task.recurrence.type !== "biweekly" && task.recurrence.type !== "monthly") || task.planKey === "chore:fold-laundry") continue;
  piled.set(item.date, (piled.get(item.date) ?? 0) + 1);
}
assert([...piled.values()].every((count) => count <= 2), `catch-up chores stay spread out, got ${[...piled.entries()].map(([date, count]) => `${date}:${count}`).join(", ")}`);

const before = data.occurrences.length;
data = reconcile(data, evening);
assert(data.occurrences.length === before, "reconcile does not duplicate occurrences");

const daily = data.occurrences.find((item) => item.taskId === data.tasks.find((task) => task.planKey === "chore:dishwasher-empty")?.id && item.date === "2026-11-05");
assert(daily, "daily task is scheduled today");
const xpBefore = data.xp.length;
data = completeOccurrence(data, daily!.id, evening);
data = completeOccurrence(data, daily!.id, evening);
assert(data.xp.length === xpBefore + 1, "completion awards XP once");
assert(data.occurrences.find((item) => item.id === daily!.id)?.status === "completed", "occurrence is completed");
assert(data.occurrences.find((item) => item.id === daily!.id)?.doneBy === "Niloofar", "completion records who did it");
assert(pointsFor(data, "Niloofar") === 20, "points stay with the person who did the task");
const board = pointsByPerson({ ...data, members: [{ id: "me", name: "Niloofar", joinedAt: "" }, { id: "partner", name: "Buny", joinedAt: "" }] });
assert(board.some((person) => person.name === "Buny" && person.points === 0), "a partner with no finished tasks still appears");
assert(data.activity.length === 1 && data.activity[0]?.name === "Niloofar" && data.activity[0]?.title === "Empty dishwasher", "completion is logged with the person and the task");

const input: TaskInput = {
  title: "Write listing",
  description: "",
  categoryId: "work",
  icon: "Briefcase",
  priority: "high",
  durationMinutes: 45,
  xpReward: 30,
  recurrence: { type: "once" },
  anchorDate: "2026-11-05",
  preferredTime: "10:30",
  flexible: false,
  window: "day",
  reminderMinutes: 10,
  notes: "",
  subtasks: [],
  area: "work",
};
data = reconcile(createTask(data, input, evening), evening);
const work = data.occurrences.find((item) => item.titleSnapshot === "Write listing");
assert(work?.time === "10:30" && work.window === "day", "explicit daytime work keeps its time");

const heavy = ["A", "B", "C"].map((name, index) =>
  createTask(freshData(), {
    title: name,
    description: "",
    categoryId: "cleaning",
    icon: "Sparkles",
    priority: "high",
    durationMinutes: 50,
    xpReward: 30,
    recurrence: { type: "once" },
    anchorDate: "2026-11-05",
    preferredTime: null,
    flexible: true,
    window: "evening",
    reminderMinutes: null,
    notes: "",
    subtasks: [],
    area: "household",
  }, evening),
);
let packed = freshData();
packed.profile = data.profile;
packed.categories = data.categories;
for (const chunk of heavy) packed = { ...packed, tasks: [...packed.tasks, ...chunk.tasks] };
packed = reconcile(packed, evening);
const overflow = packed.occurrences.filter((item) => item.overflow);
assert(overflow.length === 1, `a third demanding task is marked as too much for one evening (${overflow.length})`);
assert(packed.occurrences.every((item) => item.time >= "18:00"), "packed evening still starts at 6");

const streakTask = data.tasks.find((task) => task.planKey === "chore:laundry")!;
const streakData: AppData = {
  ...data,
  occurrences: [
    { ...data.occurrences[0], id: "c1", taskId: streakTask.id, cycleKey: "2026-10-22", date: "2026-10-22", status: "completed" },
    { ...data.occurrences[0], id: "c2", taskId: streakTask.id, cycleKey: "2026-10-29", date: "2026-10-29", status: "completed" },
    { ...data.occurrences[0], id: "c3", taskId: streakTask.id, cycleKey: "2026-11-05", date: "2026-11-05", status: "pending" },
  ],
};
assert(taskStreak(streakTask.id, streakData.occurrences, "2026-11-05").current === 2, "weekly streak ignores days without an occurrence");
const missed = taskStreak(streakTask.id, [{ ...streakData.occurrences[0], status: "missed", cycleKey: "2026-11-05", date: "2026-11-05" }, ...streakData.occurrences.slice(0, 2)], "2026-11-06");
assert(missed.atRisk && missed.current === 2, "one miss pauses a streak instead of erasing it");

const skipped = skipOccurrence(
  {
    ...data,
    occurrences: data.occurrences.map((item) => (item.id === data.occurrences.find((occ) => occ.status === "pending")?.id ? { ...item, status: "pending" } : item)),
  },
  data.occurrences.find((item) => item.status === "pending")!.id,
  evening,
);
assert(skipped.occurrences.some((item) => item.status === "skipped"), "skip is recorded separately");

const weeklyInput: TaskInput = {
  title: "Skip week check",
  description: "",
  categoryId: data.categories[0]?.id || "kitchen",
  icon: "Leaf",
  priority: "medium",
  durationMinutes: 15,
  xpReward: 10,
  recurrence: { type: "weekly", weekday: 4 },
  anchorDate: "2026-11-05",
  preferredTime: null,
  flexible: true,
  window: "evening",
  reminderMinutes: 15,
  notes: "",
  subtasks: [],
  area: "household",
};
let weekly = reconcile(createTask({ ...freshData(), profile: data.profile, categories: data.categories }, weeklyInput, evening), evening);
const dueNow = weekly.occurrences.find((item) => item.titleSnapshot === "Skip week check" && item.date === "2026-11-05" && item.status === "pending");
assert(dueNow, "a weekly task is due on its weekday");
weekly = reconcile(skipOccurrence(weekly, dueNow!.id, evening), evening);
const weeklyTaskId = dueNow!.taskId;
assert(!weekly.occurrences.some((item) => item.taskId === weeklyTaskId && item.date <= "2026-11-11" && (item.status === "pending" || item.status === "missed")), "skip clears the weekly task for the rest of this week");
assert(weekly.occurrences.some((item) => item.taskId === weeklyTaskId && item.date === "2026-11-12" && item.status === "pending"), "a skipped weekly task comes back next week");

const pending = data.occurrences.find((item) => item.status === "pending" && item.date === "2026-11-05" && data.tasks.find((task) => task.id === item.taskId)?.planKey === "chore:laundry");
assert(pending, "a pending task remains");
const moved = reconcile(rescheduleOccurrence(data, pending!.id, "2026-11-06", "19:00", evening), evening);
const movedItem = moved.occurrences.find((item) => item.id === pending!.id);
assert(movedItem?.date === "2026-11-06" && movedItem.status === "pending" && movedItem.rescheduledFrom === "2026-11-05", "postpone keeps one cycle and records the move");
assert(moved.occurrences.filter((item) => item.taskId === pending!.taskId && item.date === "2026-11-06").length === 1, "postpone does not create a duplicate");

const level = levelFor(0);
assert(level.level === 1 && level.title === "Beginner", "level 1 is Beginner");
assert(levelFor(60).title === "Getting Started", "level 2 title");
assert(levelFor(520).title === "Organized", "level 5 title");

const quietProfile = data.profile!;
assert(inQuietHours(makeClock("2026-11-05", 9 * 60), quietProfile, "household"), "morning is quiet for household tasks");
assert(!inQuietHours(makeClock("2026-11-05", 19 * 60), quietProfile, "household"), "evening is available");
assert(!inQuietHours(makeClock("2026-11-05", 10 * 60), quietProfile, "work"), "work can remind during work hours");

const tonight = suggestTonight(data, makeClock("2026-11-05", 17 * 60));
assert(tonight.length > 0 && tonight.length <= 5, "planner offers a realistic evening set");
const accepted = acceptPlan(data, tonight.map((item) => ({ id: item.occurrenceId, time: item.time })), makeClock("2026-11-05", 17 * 60));
assert(accepted.earlyOrganizer, "planning before 6 PM earns Early Organizer");

const pendingShare = data.occurrences.find((item) => item.status === "pending")!;
const checked = { ...pendingShare, status: "completed" as const, doneBy: "Niloofar", updatedAt: "2026-11-05T18:00:00.000Z" };
const kept = pickOccurrence({ ...pendingShare, updatedAt: "2026-11-05T19:00:00.000Z" }, checked);
assert(kept.status === "completed" && kept.doneBy === "Niloofar", "a newer pending update does not undo a check");

const answered = { ...answers, answeredSteps: ["name", "rhythm", "hours", "chores", "start", "prefs"] };
assert(openSteps(answered).includes("chores") && openSteps(answered).includes("pets") && !openSteps(answered).includes("rhythm"), "a partner is asked only what was left blank");
const everyChore = { ...answered, chores: Object.fromEntries(Object.keys(answered.chores).map((id) => [id, "weekly" as const])), starting: {} };
assert(!openSteps(everyChore).includes("chores"), "chores that already have an answer are not asked again");
const filled = mergeOnboarding(answered, { ...answered, chores: { ...answered.chores, plants: "weekly" }, answeredSteps: [...answered.answeredSteps, "chores"] });
assert(filled?.chores.plants === "weekly" && filled.chores.laundry === "weekly", "a partner can add a skipped chore without changing one already chosen");

const foldAnswers = defaultAnswers();
foldAnswers.name = "Niloofar";
foldAnswers.chores = { ...foldAnswers.chores, laundry: "weekly", "fold-laundry": "weekly" };
const foldPlan = buildPlan(foldAnswers, "2026-11-05");
let loads = applyOnboarding(freshData(), foldAnswers, foldPlan.tasks.map((task) => task.key), [], [], evening);
loads = reconcile(loads, evening);
const wash = loads.occurrences.find((item) => item.date === "2026-11-05" && loads.tasks.find((task) => task.id === item.taskId)?.planKey === "chore:laundry");
const folding = loads.occurrences.find((item) => item.date === "2026-11-05" && loads.tasks.find((task) => task.id === item.taskId)?.planKey === "chore:fold-laundry");
assert(wash && folding, "laundry and folding are scheduled together");
assert(foldIsWaiting(loads, folding!), "folding stays hidden until laundry is done");
assert(foldIsWaiting(skipOccurrence(loads, wash!.id, evening), folding!), "skipping laundry keeps folding hidden");
const folded = completeOccurrence(loads, wash!.id, evening);
assert(!foldIsWaiting(folded, folding!), "finishing laundry shows folding the same day");
const stray = { ...folding!, id: "stray-fold", date: "2026-11-06", cycleKey: "2026-11-06", rescheduledFrom: "2026-11-05" };
assert(foldIsWaiting({ ...folded, occurrences: [...folded.occurrences, stray] }, stray), "folding stays off the list on days without laundry");
const nextDay = reconcile(folded, makeClock("2026-11-06", 16 * 60));
const foldTomorrow = nextDay.occurrences.filter((item) => nextDay.tasks.find((task) => task.id === item.taskId)?.planKey === "chore:fold-laundry" && item.date === "2026-11-06" && (item.status === "pending" || item.status === "missed"));
assert(foldTomorrow.length === 0, "finishing laundry does not leave folding on the next day");
const dailyFold = { ...loads.tasks.find((task) => task.planKey === "chore:fold-laundry")!, recurrence: { type: "daily" as const } };
const retied = reconcile({ ...loads, tasks: loads.tasks.map((task) => (task.planKey === "chore:fold-laundry" ? dailyFold : task)) }, evening);
const foldDays = retied.occurrences.filter((item) => retied.tasks.find((task) => task.id === item.taskId)?.planKey === "chore:fold-laundry").map((item) => item.date);
const washDays = new Set(retied.occurrences.filter((item) => retied.tasks.find((task) => task.id === item.taskId)?.planKey === "chore:laundry").map((item) => item.date));
assert(foldDays.length > 0 && foldDays.every((date) => washDays.has(date)), "folding is only kept on laundry days");
assert(new Set(foldDays).size === foldDays.length, "folding happens once per laundry day");

if (failed) {
  console.error(`${failed} checks failed`);
  process.exit(1);
}
console.log("All scheduling checks passed");
