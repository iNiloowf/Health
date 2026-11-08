"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { loginAccount, logoutAccount, registerAccount, saveAccount, sessionAccount } from "./account-client";
import { mergeData, pullAll, pushAll } from "./cloud";
import { loadState, saveState } from "./db";
import { clockFrom, localTimeZone } from "./dates";
import { uid } from "./model";
import { openSteps, stampCovered } from "./questions";
import { applyShared, householdOccurrences, householdSignature, householdTasks } from "./share";
import { createSharedHome, joinSharedHome, leaveSharedHome, pullHome, pushSharedHome } from "./share-client";
import {
  acceptPlan,
  ackReminder,
  applyOnboarding,
  completeOccurrence,
  createCategory,
  createPet,
  createProject,
  createTask,
  deleteCategory,
  deletePet,
  deleteProject,
  deleteTask,
  freshData,
  hydrate,
  importData,
  reconcile,
  seedProfile,
  rescheduleOccurrence,
  setOccurrenceNote,
  setTaskActive,
  skipOccurrence,
  snoozeOccurrence,
  toggleSubtask,
  updatePet,
  updateProfile,
  updateProject,
  updateTask,
} from "./engine";
import { celebrationsFor, levelFor, pointsFor, type Celebration } from "./progress";
import { getSupabase, supabaseConfigured } from "./supabase";
import type { AppData, Category, Clock, OnboardingAnswers, Profile, Project, TaskInput } from "./types";

const idleClock: Clock = {
  now: new Date(1767225600000),
  today: "2026-01-01",
  minutes: 12 * 60,
  iso: "2026-01-01T12:00:00.000Z",
};

interface CloudState {
  configured: boolean;
  email: string | null;
  syncing: boolean;
  error: string | null;
}

interface AppApi {
  ready: boolean;
  error: string | null;
  data: AppData;
  clock: Clock;
  level: ReturnType<typeof levelFor>;
  celebrations: Celebration[];
  toast: string | null;
  canUndo: boolean;
  cloud: CloudState;
  dismissCelebration: (id: string) => void;
  clearToast: () => void;
  undo: () => void;
  finishOnboarding: (answers: OnboardingAnswers, taskKeys: string[], petKeys: string[], projectKeys: string[]) => boolean;
  saveProfile: (patch: Partial<Profile>) => boolean;
  saveTask: (input: TaskInput, id?: string) => boolean;
  removeTask: (id: string) => void;
  setActive: (id: string, active: boolean) => void;
  complete: (id: string) => void;
  skip: (id: string) => void;
  move: (id: string, date: string, time: string) => void;
  toggleStep: (occurrenceId: string, subtaskId: string) => void;
  saveNote: (id: string, note: string) => void;
  acceptTonight: (items: Array<{ id: string; time: string }>) => void;
  snooze: (id: string, minutes: number) => void;
  ack: (key: string) => void;
  addCategory: (input: { name: string; icon: string; area: Category["area"] }) => void;
  removeCategory: (id: string) => void;
  savePet: (input: { name: string; type: string; photo?: string; notes: string; cares: string[] }, id?: string) => boolean;
  removePet: (id: string) => void;
  saveProject: (input: { name: string; description: string; kind: Project["kind"]; deadline?: string; color?: string; incomeNotes: string; expenseNotes: string; archived?: boolean }, id?: string) => boolean;
  removeProject: (id: string) => void;
  preferTime: (taskId: string, time: string) => void;
  openShare: () => Promise<void>;
  joinShare: (code: string, name: string) => Promise<"ready" | "questions">;
  leaveShare: () => Promise<void>;
  exportBackup: () => void;
  importBackup: (text: string) => void;
  resetAll: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<string>;
  signOut: () => Promise<void>;
  accountName: string | null;
  pendingJoin: { code: string; answers: OnboardingAnswers | null } | null;
  createAccount: (name: string, password: string) => Promise<void>;
  enterAccount: (name: string, password: string) => Promise<void>;
  leaveAccount: () => Promise<void>;
}

const TOKEN_KEY = "hearth-token";

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function resumeJoin(data: AppData): { code: string; answers: OnboardingAnswers | null } | null {
  const profile = data.profile;
  if (!profile || profile.onboarded || !profile.share) return null;
  if (!profile.onboarding) return { code: profile.share.code, answers: null };
  const answers = stampCovered({ ...profile.onboarding, name: profile.name || profile.onboarding.name });
  if (!openSteps(answers).length) return null;
  return { code: profile.share.code, answers };
}

const AppContext = createContext<AppApi | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(freshData());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const [clock, setClock] = useState<Clock>(idleClock);
  const [canUndo, setCanUndo] = useState(false);
  const [cloud, setCloud] = useState<CloudState>({ configured: supabaseConfigured(), email: null, syncing: false, error: null });
  const [accountName, setAccountName] = useState<string | null>(null);
  const [pendingJoin, setPendingJoin] = useState<{ code: string; answers: OnboardingAnswers | null } | null>(null);
  const dataRef = useRef(data);
  const tokenRef = useRef<string | null>(null);
  const pendingJoinRef = useRef(pendingJoin);
  pendingJoinRef.current = pendingJoin;
  const undoRef = useRef<AppData | null>(null);
  const queue = useRef(Promise.resolve());
  const knownRemote = useRef<Set<string>>(new Set());
  const shareBusy = useRef(false);
  const shareTimer = useRef<number | null>(null);
  const scheduleShareRef = useRef<() => void>(() => undefined);

  function rememberHome(tasks: { id: string }[]) {
    knownRemote.current = new Set(tasks.map((task) => task.id));
  }

  function adoptHome(home: Parameters<typeof applyShared>[1], memberId: string) {
    const next = applyShared(dataRef.current, home, memberId);
    dataRef.current = next;
    setData(next);
    persist(next);
    rememberHome(home.tasks);
    return next;
  }

  async function pushShareNow() {
    const current = dataRef.current;
    const share = current.profile?.share;
    if (!share || shareBusy.current) return;
    shareBusy.current = true;
    try {
      const dropped = [...knownRemote.current].filter((id) => !current.tasks.some((task) => task.id === id));
      const home = await pushSharedHome(current, share.memberId, dropped);
      adoptHome(home, share.memberId);
    } finally {
      shareBusy.current = false;
    }
  }

  function scheduleShare() {
    if (shareTimer.current) window.clearTimeout(shareTimer.current);
    shareTimer.current = window.setTimeout(() => {
      void pushShareNow().catch(() => undefined);
    }, 350);
  }
  scheduleShareRef.current = scheduleShare;

  async function pullShareNow() {
    const share = dataRef.current.profile?.share;
    if (!share || shareBusy.current) return;
    const localTasks = householdTasks(dataRef.current);
    const dropped = [...knownRemote.current].filter((id) => !localTasks.some((task) => task.id === id));
    if (dropped.length) {
      await pushShareNow();
      return;
    }
    shareBusy.current = true;
    try {
      const remote = await pullHome(share.code);
      const localOccurrences = householdOccurrences(dataRef.current, new Set(localTasks.map((task) => task.id)));
      const remoteSig = householdSignature(remote.tasks, remote.occurrences);
      if (householdSignature(localTasks, localOccurrences) === remoteSig && remote.revision === share.revision) {
        rememberHome(remote.tasks);
        return;
      }
      adoptHome(remote, share.memberId);
      const mergedTasks = householdTasks(dataRef.current);
      const mergedOccurrences = householdOccurrences(dataRef.current, new Set(mergedTasks.map((task) => task.id)));
      if (householdSignature(mergedTasks, mergedOccurrences) !== remoteSig) scheduleShare();
    } finally {
      shareBusy.current = false;
    }
  }

  function persist(next: AppData) {
    const token = tokenRef.current;
    queue.current = queue.current
      .then(async () => {
        await saveState(next);
        if (token) await saveAccount(token, next);
        const sb = getSupabase();
        if (!sb) return;
        const { data: session } = await sb.auth.getSession();
        if (!session.session) return;
        await pushAll(sb, session.session.user.id, next);
      })
      .catch((err: unknown) => {
        setCloud((current) => ({ ...current, error: err instanceof Error ? err.message : "Saved on this device. Cloud sync failed." }));
      });
  }

  function commit(recipe: (current: AppData) => AppData, options?: { celebrate?: boolean; undo?: boolean; message?: string }) {
    try {
      const prev = dataRef.current;
      const now = clockFrom(new Date(), prev.profile?.timezone || localTimeZone());
      setClock(now);
      const drafted = recipe(prev);
      const next = drafted.profile?.onboarded ? reconcile(drafted, now) : drafted;
      if (options?.undo !== false) {
        undoRef.current = prev;
        setCanUndo(true);
      }
      if (options?.celebrate !== false) {
        const events = celebrationsFor(prev, next, now.today);
        if (events.length) {
          setCelebrations((current) => [...current, ...events]);
          const reduced = next.profile?.reducedMotion || next.profile?.animation === "subtle";
          if (!reduced && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(12);
        }
      }
      dataRef.current = next;
      setData(next);
      if (options?.message) setToast(options.message);
      persist(next);
      if (next.profile?.share && householdSignature(householdTasks(prev), householdOccurrences(prev, new Set(householdTasks(prev).map((task) => task.id)))) !== householdSignature(householdTasks(next), householdOccurrences(next, new Set(householdTasks(next).map((task) => task.id))))) {
        scheduleShare();
      }
      return true;
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Something went wrong.");
      return false;
    }
  }

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const loaded = hydrate((await loadState()) ?? freshData());
        const now = clockFrom(new Date(), loaded.profile?.timezone || localTimeZone());
        let next = loaded.profile?.onboarded ? reconcile(loaded, now) : loaded;
        const token = readToken();
        tokenRef.current = token;
        if (token) {
          try {
            const session = await sessionAccount(token);
            if (cancel) return;
            setAccountName(session.name);
            const merged = mergeData(hydrate(next), hydrate(session.data));
            const clock = clockFrom(new Date(), merged.profile?.timezone || localTimeZone());
            next = merged.profile?.onboarded ? reconcile(merged, clock) : merged;
          } catch {
            tokenRef.current = null;
            try {
              window.localStorage.removeItem(TOKEN_KEY);
            } catch {
              /* the device can keep working locally */
            }
          }
        }
        const resume = resumeJoin(next);
        if (resume) {
          pendingJoinRef.current = resume;
          setPendingJoin(resume);
        } else if (next.profile && !next.profile.onboarded && next.profile.share && next.profile.onboarding && !openSteps(stampCovered(next.profile.onboarding)).length) {
          next = reconcile({ ...next, profile: { ...next.profile, onboarded: true } }, clockFrom(new Date(), next.profile.timezone));
        }
        if (cancel) return;
        dataRef.current = next;
        setClock(clockFrom(new Date(), next.profile?.timezone || localTimeZone()));
        setData(next);
        if (JSON.stringify(next) !== JSON.stringify(loaded)) await saveState(next);
        const sb = getSupabase();
        if (sb) {
          const { data: session } = await sb.auth.getSession();
          if (session.session) {
            setCloud((current) => ({ ...current, email: session.session?.user.email ?? null, syncing: true }));
            const remote = await pullAll(sb, session.session.user.id);
            const merged = remote ? mergeData(next, remote) : next;
            const synced = merged.profile?.onboarded ? reconcile(merged, clockFrom(new Date(), merged.profile.timezone)) : merged;
            if (!cancel) {
              dataRef.current = synced;
              setClock(clockFrom(new Date(), synced.profile?.timezone || localTimeZone()));
              setData(synced);
              await saveState(synced);
              await pushAll(sb, session.session.user.id, synced);
            }
          }
        }
      } catch (err) {
        if (!cancel) setError(err instanceof Error ? err.message : "Could not load your data.");
      } finally {
        if (!cancel) {
          setCloud((current) => ({ ...current, syncing: false }));
          setReady(true);
        }
      }
    })();
    const timer = window.setInterval(() => {
      const current = dataRef.current;
      const now = clockFrom(new Date(), current.profile?.timezone || localTimeZone());
      setClock(now);
      if (!current.profile?.onboarded) return;
      const next = reconcile(current, now);
      if (JSON.stringify(next) === JSON.stringify(current)) return;
      dataRef.current = next;
      setData(next);
      persist(next);
      if (next.profile?.share) scheduleShareRef.current();
    }, 30000);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, []);

  const pullRef = useRef(pullShareNow);
  pullRef.current = pullShareNow;

  useEffect(() => {
    if (!ready || !data.profile?.share?.code) return;
    const tick = () => {
      void pullRef.current().catch(() => undefined);
    };
    const timer = window.setInterval(tick, 2000);
    const start = window.setTimeout(tick, 400);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(start);
    };
  }, [ready, data.profile?.share?.code]);

  const api = useMemo<AppApi>(() => {
    const currentClock = clock;
    return {
      ready,
      error,
      data,
      clock: currentClock,
      level: levelFor(pointsFor(data, data.profile?.name?.trim() || "")),
      celebrations,
      toast,
      canUndo,
      cloud,
      accountName,
      pendingJoin,
      dismissCelebration: (id) => setCelebrations((current) => current.filter((item) => item.id !== id)),
      clearToast: () => setToast(null),
      undo: () => {
        if (!undoRef.current) return;
        dataRef.current = undoRef.current;
        undoRef.current = null;
        setCanUndo(false);
        setCelebrations([]);
        setData(dataRef.current);
        setToast("Undone");
        persist(dataRef.current);
      },
      finishOnboarding: (answers, taskKeys, petKeys, projectKeys) => {
        const keepExisting = Boolean(pendingJoinRef.current);
        const ok = commit(
          (current) => applyOnboarding(current, answers, taskKeys, petKeys, projectKeys, clockFrom(new Date(), current.profile?.timezone || localTimeZone()), { keepExisting }),
          { message: "Your evening is ready" },
        );
        if (ok) {
          pendingJoinRef.current = null;
          setPendingJoin(null);
        }
        return ok;
      },
      saveProfile: (patch) => commit((current) => updateProfile(current, patch, clockFrom(new Date(), current.profile?.timezone || localTimeZone())), { message: "Saved" }),
      saveTask: (input, id) =>
        commit((current) => (id ? updateTask(current, id, input, currentClock) : createTask(current, input, currentClock)), { message: id ? "Task updated" : "Task added" }),
      removeTask: (id) => commit((current) => deleteTask(current, id), { message: "Task deleted" }),
      setActive: (id, active) => commit((current) => setTaskActive(current, id, active, currentClock), { message: active ? "Task resumed" : "Task paused" }),
      complete: (id) => commit((current) => completeOccurrence(current, id, currentClock), { message: "Completed" }),
      skip: (id) => commit((current) => skipOccurrence(current, id, currentClock), { message: "Skipped" }),
      move: (id, date, time) => commit((current) => rescheduleOccurrence(current, id, date, time, currentClock), { message: "Moved" }),
      toggleStep: (occurrenceId, subtaskId) => commit((current) => toggleSubtask(current, occurrenceId, subtaskId, currentClock), { undo: false, celebrate: false }),
      saveNote: (id, note) => commit((current) => setOccurrenceNote(current, id, note, currentClock), { undo: false, celebrate: false }),
      acceptTonight: (items) => commit((current) => acceptPlan(current, items, currentClock), { message: "Tonight is planned" }),
      snooze: (id, minutes) => commit((current) => snoozeOccurrence(current, id, minutes, currentClock), { celebrate: false, message: `Snoozed ${minutes} min` }),
      ack: (key) => commit((current) => ackReminder(current, key), { undo: false, celebrate: false }),
      addCategory: (input) => commit((current) => createCategory(current, input), { message: "Category added" }),
      removeCategory: (id) => commit((current) => deleteCategory(current, id), { message: "Category removed" }),
      savePet: (input, id) =>
        commit((current) => (id ? updatePet(current, id, input, currentClock) : createPet(current, input, currentClock).data), { message: id ? "Pet updated" : "Pet added" }),
      removePet: (id) => commit((current) => deletePet(current, id), { message: "Pet removed" }),
      saveProject: (input, id) =>
        commit(
          (current) => (id ? updateProject(current, id, { name: input.name, description: input.description, kind: input.kind, deadline: input.deadline, color: input.color || "#e56b93", incomeNotes: input.incomeNotes, expenseNotes: input.expenseNotes, archived: input.archived ?? false }, currentClock) : createProject(current, { ...input, color: input.color || "#e56b93" }, currentClock).data),
          { message: id ? "Project updated" : "Project added" },
        ),
      removeProject: (id) => commit((current) => deleteProject(current, id), { message: "Project removed" }),
      preferTime: (taskId, time) =>
        commit((current) => {
          const task = current.tasks.find((item) => item.id === taskId);
          if (!task) return current;
          return updateTask(current, taskId, { ...task, preferredTime: time, subtasks: task.subtasks }, currentClock);
        }, { message: "Preferred time saved" }),
      openShare: async () => {
        if (!dataRef.current.profile?.onboarded) throw new Error("Finish the introduction first.");
        const memberId = dataRef.current.profile.share?.memberId || uid();
        const home = await createSharedHome(dataRef.current, memberId);
        adoptHome(home, memberId);
        setToast("Ready");
      },
      joinShare: async (code, name) => {
        const trimmed = name.trim() || dataRef.current.profile?.name || "Me";
        const cleaned = code.trim().toLowerCase().replace(/\s+/g, "");
        if (!cleaned) throw new Error("Enter the code.");
        const memberId = dataRef.current.profile?.share?.code === cleaned ? dataRef.current.profile.share.memberId : uid();
        const home = await joinSharedHome(cleaned, trimmed, memberId);
        const clock = clockFrom(new Date(), dataRef.current.profile?.timezone || localTimeZone());
        let current = dataRef.current.profile ? dataRef.current : seedProfile(dataRef.current, trimmed, clock);
        if (current.profile && current.profile.name !== trimmed && !current.profile.onboarded) {
          current = { ...current, profile: { ...current.profile, name: trimmed } };
        }
        if (current.profile?.onboarded && current.profile.name !== trimmed && trimmed) {
          current = updateProfile(current, { name: trimmed }, clock);
        }
        let next = applyShared(current, home, memberId);
        const partner = home.onboarding ? stampCovered({ ...home.onboarding, name: trimmed }) : null;
        const needsQuestions = !next.profile?.onboarded && (!partner || openSteps(partner).length > 0);
        if (!needsQuestions && next.profile?.onboarded) next = reconcile(next, clock);
        if (!needsQuestions && next.profile && !next.profile.onboarded) {
          const answers = partner ?? next.profile.onboarding;
          next = reconcile({
            ...next,
            profile: {
              ...next.profile,
              onboarded: true,
              name: trimmed,
              onboarding: answers,
              wake: answers?.wake ?? next.profile.wake,
              sleep: answers?.sleep ?? next.profile.sleep,
              availabilityStart: answers?.availabilityStart ?? next.profile.availabilityStart,
              availabilityEnd: answers?.availabilityEnd ?? next.profile.availabilityEnd,
              weekStartsOn: answers?.weekStartsOn ?? next.profile.weekStartsOn,
              workStart: answers?.workStart ?? next.profile.workStart,
              workEnd: answers?.workEnd ?? next.profile.workEnd,
              reminderStyle: answers?.reminderStyle ?? next.profile.reminderStyle,
              weeklyWorkload: answers?.weeklyWorkload ?? next.profile.weeklyWorkload,
              animation: answers?.animation ?? next.profile.animation,
            },
          }, clock);
        }
        if (needsQuestions && partner && next.profile) {
          next = { ...next, profile: { ...next.profile, onboarded: false, name: trimmed, onboarding: partner } };
        }
        const pending = needsQuestions ? { code: home.code, answers: partner } : null;
        pendingJoinRef.current = pending;
        setPendingJoin(pending);
        dataRef.current = next;
        setData(next);
        setClock(clock);
        persist(next);
        rememberHome(home.tasks);
        setToast(needsQuestions && partner ? "Add anything they left open" : "Joined");
        return needsQuestions ? "questions" : "ready";
      },
      leaveShare: async () => {
        const share = dataRef.current.profile?.share;
        if (!share || !dataRef.current.profile) return;
        await leaveSharedHome(share.code, share.memberId);
        const next = { ...dataRef.current, profile: { ...dataRef.current.profile, share: null } };
        dataRef.current = next;
        setData(next);
        persist(next);
        knownRemote.current = new Set();
        setToast("Left");
      },
      exportBackup: () => {
        const blob = new Blob([JSON.stringify(dataRef.current, null, 2)], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `hearth-backup-${currentClock.today}.json`;
        link.click();
        URL.revokeObjectURL(link.href);
        setToast("Backup downloaded");
      },
      importBackup: (text) => {
        const next = importData(text);
        const now = clockFrom(new Date(), next.profile?.timezone || localTimeZone());
        const reconciled = next.profile?.onboarded ? reconcile(next, now) : next;
        undoRef.current = dataRef.current;
        setCanUndo(true);
        dataRef.current = reconciled;
        setData(reconciled);
        setToast("Backup restored");
        persist(reconciled);
      },
      resetAll: () => {
        const next = freshData();
        undoRef.current = dataRef.current;
        setCanUndo(true);
        dataRef.current = next;
        setData(next);
        setCelebrations([]);
        setToast("Local data cleared");
        persist(next);
      },
      signIn: async (email, password) => {
        const sb = getSupabase();
        if (!sb) throw new Error("Add Supabase keys to enable cloud sync.");
        setCloud((current) => ({ ...current, syncing: true, error: null }));
        const { data: auth, error: authError } = await sb.auth.signInWithPassword({ email, password });
        if (authError || !auth.user) {
          setCloud((current) => ({ ...current, syncing: false, error: authError?.message ?? "Could not sign in." }));
          throw new Error(authError?.message ?? "Could not sign in.");
        }
        const remote = await pullAll(sb, auth.user.id);
        const merged = mergeData(dataRef.current, remote);
        const now = clockFrom(new Date(), merged.profile?.timezone || localTimeZone());
        const next = merged.profile?.onboarded ? reconcile(merged, now) : merged;
        dataRef.current = next;
        setData(next);
        await saveState(next);
        await pushAll(sb, auth.user.id, next);
        setCloud({ configured: true, email: auth.user.email ?? email, syncing: false, error: null });
        setToast("Signed in");
      },
      signUp: async (email, password) => {
        const sb = getSupabase();
        if (!sb) throw new Error("Add Supabase keys to enable cloud sync.");
        const { data: auth, error: authError } = await sb.auth.signUp({ email, password });
        if (authError) throw new Error(authError.message);
        if (auth.session && auth.user) {
          await pushAll(sb, auth.user.id, dataRef.current);
          setCloud({ configured: true, email: auth.user.email ?? email, syncing: false, error: null });
          return "Account ready. Your data is syncing.";
        }
        return "Check your email to confirm the account, then sign in.";
      },
      signOut: async () => {
        const sb = getSupabase();
        if (sb) await sb.auth.signOut();
        setCloud((current) => ({ ...current, email: null }));
        setToast("Signed out on this device");
      },
      createAccount: async (name, password) => {
        const result = await registerAccount({ name, password, data: dataRef.current });
        tokenRef.current = result.token;
        window.localStorage.setItem(TOKEN_KEY, result.token);
        setAccountName(result.name);
        setToast("Account ready");
      },
      enterAccount: async (name, password) => {
        const result = await loginAccount({ name, password });
        tokenRef.current = result.token;
        window.localStorage.setItem(TOKEN_KEY, result.token);
        const merged = mergeData(hydrate(dataRef.current), hydrate(result.data));
        const now = clockFrom(new Date(), merged.profile?.timezone || localTimeZone());
        const next = merged.profile?.onboarded ? reconcile(merged, now) : merged;
        const resume = resumeJoin(next);
        pendingJoinRef.current = resume;
        setPendingJoin(resume);
        dataRef.current = next;
        setData(next);
        setClock(now);
        setAccountName(result.name);
        await saveState(next);
        setToast("Signed in");
      },
      leaveAccount: async () => {
        const token = tokenRef.current;
        tokenRef.current = null;
        try {
          window.localStorage.removeItem(TOKEN_KEY);
        } catch {
          /* signing out still clears this device */
        }
        const next = freshData();
        pendingJoinRef.current = null;
        setPendingJoin(null);
        dataRef.current = next;
        setData(next);
        setAccountName(null);
        queue.current = queue.current.then(async () => {
          await saveState(next);
          if (token) await logoutAccount(token).catch(() => undefined);
        });
        setToast("Signed out on this device");
      },
    };
    // The API closes over the latest screen state. Actions read dataRef at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, error, data, clock, celebrations, toast, canUndo, cloud, accountName, pendingJoin]);

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("The app store is missing.");
  return value;
}
