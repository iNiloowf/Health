export type Area = "household" | "habit" | "pet" | "work" | "health" | "personal";

export type Priority = "low" | "medium" | "high";

export type RecurrenceType =
  | "once"
  | "daily"
  | "weekdays"
  | "every_n_days"
  | "weekly"
  | "biweekly"
  | "monthly";

export type OccurrenceStatus = "pending" | "completed" | "missed" | "skipped";

export type ScheduleWindow = "evening" | "day" | "anytime";

export type Effect = "sparkle" | "bubbles" | "fold" | "pet" | "glow";

export type Pace =
  | "daily"
  | "every_2_3"
  | "weekly"
  | "twice_week"
  | "biweekly"
  | "monthly"
  | "rarely"
  | "never";

export type ThemeChoice = "light" | "dark" | "system";
export type AnimationLevel = "subtle" | "normal" | "rich";
export type ReminderStyle = "gentle" | "standard" | "minimal";
export type Workload = "light" | "balanced" | "full";
export type WorkWhen = "day" | "evening" | "both";

export interface Recurrence {
  type: RecurrenceType;
  interval?: number;
  weekdays?: number[];
  weekday?: number;
  dayOfMonth?: number;
}

export interface Subtask {
  id: string;
  title: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  area: Area;
  effect: Effect;
  builtIn: boolean;
}

export interface Task {
  id: string;
  planKey?: string;
  title: string;
  description: string;
  categoryId: string;
  icon: string;
  image?: string;
  priority: Priority;
  durationMinutes: number;
  xpReward: number;
  recurrence: Recurrence;
  anchorDate: string;
  preferredTime: string | null;
  flexible: boolean;
  window: ScheduleWindow;
  reminderMinutes: number | null;
  notes: string;
  subtasks: Subtask[];
  area: Area;
  petId?: string;
  projectId?: string;
  active: boolean;
  streak: number;
  longestStreak: number;
  atRisk: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Occurrence {
  id: string;
  taskId: string;
  cycleKey: string;
  date: string;
  time: string;
  timeAuto: boolean;
  overflow: boolean;
  status: OccurrenceStatus;
  completedAt?: string;
  completedLate?: boolean;
  doneBy?: string;
  skippedAt?: string;
  rescheduledFrom?: string;
  snoozedUntil?: string;
  subtaskDone: string[];
  xpAwarded: number;
  titleSnapshot: string;
  categoryId: string;
  icon: string;
  durationMinutes: number;
  xpReward: number;
  area: Area;
  priority: Priority;
  flexible: boolean;
  window: ScheduleWindow;
  preferredTime: string | null;
  reminderMinutes: number | null;
  petId?: string;
  projectId?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Pet {
  id: string;
  planKey?: string;
  name: string;
  type: string;
  photo?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PetSchedule {
  id: string;
  petId: string;
  taskId: string;
  kind: string;
}

export interface Project {
  id: string;
  planKey?: string;
  name: string;
  description: string;
  kind: "work" | "personal";
  deadline?: string;
  color: string;
  incomeNotes: string;
  expenseNotes: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface XpTxn {
  id: string;
  amount: number;
  reason: string;
  occurrenceId?: string;
  taskId?: string;
  createdAt: string;
}

export interface UnlockedAchievement {
  id: string;
  unlockedAt: string;
}

export interface OnboardingAnswers {
  name: string;
  wake: string;
  sleep: string;
  availabilityStart: string;
  availabilityEnd: string;
  workStart: string;
  workEnd: string;
  workWhen: WorkWhen;
  weekStartsOn: 0 | 1;
  chores: Record<string, Pace>;
  starting: Record<string, Pace>;
  pets: Array<{ name: string; type: string; cares: string[] }>;
  habits: string[];
  workAreas: string[];
  goals: string[];
  reminderStyle: ReminderStyle;
  weeklyWorkload: Workload;
  animation: AnimationLevel;
  answeredSteps: string[];
}

export interface Profile {
  id: string;
  name: string;
  avatar?: string;
  timezone: string;
  weekStartsOn: 0 | 1;
  availabilityStart: string;
  availabilityEnd: string;
  workStart: string;
  workEnd: string;
  wake: string;
  sleep: string;
  theme: ThemeChoice;
  reducedMotion: boolean;
  animation: AnimationLevel;
  reminderStyle: ReminderStyle;
  weeklyWorkload: Workload;
  quietStart: string;
  quietEnd: string;
  notificationsEnabled: boolean;
  showXp: boolean;
  onboarded: boolean;
  onboarding: OnboardingAnswers | null;
  streakFreezes: number;
  freezesLeft: number;
  freezeWeek: string;
  share: ShareLink | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShareLink {
  code: string;
  memberId: string;
  revision: number;
}

export interface ActivityEntry {
  id: string;
  at: string;
  name: string;
  memberId: string;
  title: string;
  taskId: string;
  occurrenceId: string;
}

export interface AppData {
  version: 1;
  profile: Profile | null;
  categories: Category[];
  tasks: Task[];
  occurrences: Occurrence[];
  pets: Pet[];
  projects: Project[];
  petSchedules: PetSchedule[];
  xp: XpTxn[];
  achievements: UnlockedAchievement[];
  plannerAccepted: string[];
  earlyOrganizer: boolean;
  firedReminders: string[];
  activity: ActivityEntry[];
}

export interface TaskInput {
  title: string;
  description: string;
  categoryId: string;
  icon: string;
  image?: string;
  priority: Priority;
  durationMinutes: number;
  xpReward: number;
  recurrence: Recurrence;
  anchorDate: string;
  preferredTime: string | null;
  flexible: boolean;
  window: ScheduleWindow;
  reminderMinutes: number | null;
  notes: string;
  subtasks: Array<{ id?: string; title: string }>;
  area: Area;
  petId?: string;
  projectId?: string;
  planKey?: string;
}

export interface Clock {
  now: Date;
  today: string;
  minutes: number;
  iso: string;
}

export interface PlanItem {
  occurrenceId: string;
  title: string;
  time: string;
  duration: number;
  priority: Priority;
  reason: string;
}
