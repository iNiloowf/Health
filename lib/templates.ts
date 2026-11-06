import type { Area, Category, Effect, Pace, Priority, Recurrence } from "./types";

export interface ChoreTemplate {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  icon: string;
  durationMinutes: number;
  priority: Priority;
  defaultPace: Pace;
  subtasks?: string[];
}

export interface CareTemplate {
  id: string;
  label: string;
  durationMinutes: number;
  priority: Priority;
  recurrence: Recurrence;
  flexible: boolean;
  preferredTime: string | null;
}

export const PACE_OPTIONS: Array<{ id: Pace; label: string }> = [
  { id: "daily", label: "Daily" },
  { id: "every_2_3", label: "Every 2–3 days" },
  { id: "twice_week", label: "Twice a week" },
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "Every 2 weeks" },
  { id: "monthly", label: "Monthly" },
  { id: "rarely", label: "Rarely" },
  { id: "never", label: "Never" },
];

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "kitchen", name: "Kitchen", icon: "UtensilsCrossed", area: "household", effect: "bubbles", builtIn: true },
  { id: "laundry", name: "Laundry", icon: "Shirt", area: "household", effect: "fold", builtIn: true },
  { id: "bathroom", name: "Bathroom", icon: "Bath", area: "household", effect: "sparkle", builtIn: true },
  { id: "bedroom", name: "Bedroom", icon: "BedDouble", area: "household", effect: "sparkle", builtIn: true },
  { id: "living", name: "Living room", icon: "Sofa", area: "household", effect: "sparkle", builtIn: true },
  { id: "cleaning", name: "General cleaning", icon: "Sparkles", area: "household", effect: "sparkle", builtIn: true },
  { id: "shopping", name: "Shopping", icon: "ShoppingBag", area: "household", effect: "glow", builtIn: true },
  { id: "maintenance", name: "Maintenance", icon: "Wrench", area: "household", effect: "glow", builtIn: true },
  { id: "habit", name: "Habits", icon: "Repeat", area: "habit", effect: "glow", builtIn: true },
  { id: "health", name: "Health", icon: "Heart", area: "health", effect: "glow", builtIn: true },
  { id: "pet", name: "Pet care", icon: "PawPrint", area: "pet", effect: "pet", builtIn: true },
  { id: "work", name: "Work", icon: "Briefcase", area: "work", effect: "glow", builtIn: true },
  { id: "personal", name: "Personal projects", icon: "FolderKanban", area: "personal", effect: "glow", builtIn: true },
  { id: "goals", name: "Goals", icon: "Flag", area: "personal", effect: "glow", builtIn: true },
];

export const CHORE_TEMPLATES: ChoreTemplate[] = [
  { id: "dishwasher-start", title: "Start dishwasher", description: "Load it if needed, then start a cycle.", categoryId: "kitchen", icon: "UtensilsCrossed", durationMinutes: 5, priority: "low", defaultPace: "daily" },
  { id: "dishwasher-empty", title: "Empty dishwasher", description: "Put clean dishes away.", categoryId: "kitchen", icon: "UtensilsCrossed", durationMinutes: 10, priority: "medium", defaultPace: "daily" },
  { id: "counters", title: "Wipe kitchen counters", description: "Clear and wipe the counters.", categoryId: "kitchen", icon: "Sparkles", durationMinutes: 10, priority: "low", defaultPace: "daily" },
  { id: "trash", title: "Take out trash", description: "Empty full bins and replace the bags.", categoryId: "kitchen", icon: "Trash2", durationMinutes: 10, priority: "medium", defaultPace: "every_2_3" },
  {
    id: "laundry",
    title: "Laundry",
    description: "Wash a load from start to folded clothes.",
    categoryId: "laundry",
    icon: "Shirt",
    durationMinutes: 30,
    priority: "medium",
    defaultPace: "weekly",
    subtasks: ["Collect clothes", "Separate colors", "Start the washer", "Move clothes to the dryer", "Fold clothes", "Put clothes away"],
  },
  { id: "fold-laundry", title: "Fold laundry", description: "Fold a finished load and put it away.", categoryId: "laundry", icon: "Shirt", durationMinutes: 20, priority: "medium", defaultPace: "weekly" },
  { id: "vacuum", title: "Vacuum", description: "Vacuum the floors that need it.", categoryId: "cleaning", icon: "Sparkles", durationMinutes: 30, priority: "medium", defaultPace: "twice_week" },
  { id: "bathroom", title: "Clean bathroom", description: "Sink, mirror, toilet, and a quick floor wipe.", categoryId: "bathroom", icon: "Bath", durationMinutes: 35, priority: "medium", defaultPace: "weekly" },
  { id: "bedsheets", title: "Change bedsheets", description: "Strip the bed and put on fresh sheets.", categoryId: "bedroom", icon: "BedDouble", durationMinutes: 20, priority: "medium", defaultPace: "biweekly" },
  { id: "bedroom-tidy", title: "Tidy bedroom", description: "Reset surfaces and make the room restful.", categoryId: "bedroom", icon: "BedDouble", durationMinutes: 15, priority: "low", defaultPace: "every_2_3" },
  { id: "living-tidy", title: "Tidy living room", description: "A short reset so the room feels calm.", categoryId: "living", icon: "Sofa", durationMinutes: 15, priority: "low", defaultPace: "every_2_3" },
  { id: "fridge", title: "Clean refrigerator", description: "Toss leftovers and wipe the shelves.", categoryId: "kitchen", icon: "UtensilsCrossed", durationMinutes: 40, priority: "high", defaultPace: "monthly" },
  { id: "groceries", title: "Grocery shopping", description: "Shop the list and put food away.", categoryId: "shopping", icon: "ShoppingBag", durationMinutes: 50, priority: "high", defaultPace: "weekly" },
  { id: "plants", title: "Water plants", description: "Check soil and water what needs it.", categoryId: "living", icon: "Leaf", durationMinutes: 10, priority: "low", defaultPace: "weekly" },
  { id: "floors", title: "Mop floors", description: "Mop the kitchen and other hard floors.", categoryId: "cleaning", icon: "Sparkles", durationMinutes: 30, priority: "medium", defaultPace: "weekly" },
];

export const HABIT_SUGGESTIONS = ["Read", "Stretch", "Skincare", "Medication", "Journal", "Prepare tomorrow", "Drink water", "Language practice"];

export const WORK_AREAS = [
  { id: "orders", label: "Orders and packaging" },
  { id: "shipping", label: "Shipping" },
  { id: "research", label: "Product research" },
  { id: "photo", label: "Product photography" },
  { id: "listings", label: "Listing creation" },
  { id: "admin", label: "Admin and finances" },
  { id: "clients", label: "Client work" },
  { id: "deep", label: "Deep work" },
];

export const PET_TYPES = ["Dog", "Cat", "Bird", "Fish", "Rabbit", "Other"];

export const PET_CARES: CareTemplate[] = [
  { id: "feed", label: "Feeding", durationMinutes: 10, priority: "high", recurrence: { type: "daily" }, flexible: true, preferredTime: "18:30" },
  { id: "water", label: "Fresh water", durationMinutes: 5, priority: "medium", recurrence: { type: "daily" }, flexible: true, preferredTime: "18:15" },
  { id: "walk", label: "Walk", durationMinutes: 30, priority: "high", recurrence: { type: "daily" }, flexible: false, preferredTime: "18:30" },
  { id: "play", label: "Playtime", durationMinutes: 15, priority: "low", recurrence: { type: "daily" }, flexible: true, preferredTime: null },
  { id: "groom", label: "Grooming", durationMinutes: 20, priority: "medium", recurrence: { type: "weekly", weekday: 6 }, flexible: true, preferredTime: null },
  { id: "bath", label: "Bath", durationMinutes: 30, priority: "medium", recurrence: { type: "monthly", dayOfMonth: 1 }, flexible: true, preferredTime: null },
  { id: "clean", label: "Habitat cleaning", durationMinutes: 20, priority: "medium", recurrence: { type: "every_n_days", interval: 2 }, flexible: true, preferredTime: null },
  { id: "meds", label: "Medication", durationMinutes: 5, priority: "high", recurrence: { type: "daily" }, flexible: false, preferredTime: "18:15" },
];

export const PROJECT_COLORS = ["#e56b93", "#c9a0e0", "#f2a3c0", "#e7b1c8", "#d989b8", "#f4c2d7"];

export const ACHIEVEMENTS: Array<{ id: string; name: string; description: string }> = [
  { id: "first-task", name: "First Task Completed", description: "Complete your first task." },
  { id: "streak-7", name: "First 7-Day Streak", description: "Keep a 7-day rhythm or a 7-cycle task streak." },
  { id: "tasks-10", name: "10 Tasks Completed", description: "Complete 10 tasks." },
  { id: "tasks-50", name: "50 Tasks Completed", description: "Complete 50 tasks." },
  { id: "laundry-master", name: "Laundry Master", description: "Finish 8 laundry tasks." },
  { id: "cleaning-champion", name: "Cleaning Champion", description: "Finish 12 cleaning tasks across the home." },
  { id: "perfect-week", name: "Perfect Week", description: "Complete every planned task in a week." },
  { id: "early-organizer", name: "Early Organizer", description: "Plan your evening before 6 PM." },
  { id: "consistency-master", name: "Consistency Master", description: "Hold a 21-day rhythm or four strong weeks." },
];

export const LEVELS: Array<{ level: number; title: string; xp: number }> = [
  { level: 1, title: "Beginner", xp: 0 },
  { level: 2, title: "Getting Started", xp: 60 },
  { level: 3, title: "Building Momentum", xp: 160 },
  { level: 4, title: "Consistent", xp: 320 },
  { level: 5, title: "Organized", xp: 520 },
  { level: 6, title: "Steady", xp: 780 },
  { level: 7, title: "Focused", xp: 1100 },
  { level: 8, title: "Reliable", xp: 1500 },
  { level: 9, title: "Harmonious", xp: 2000 },
  { level: 10, title: "Life OS", xp: 2600 },
];

export function categoryEffect(categories: Category[], categoryId: string): Effect {
  return categories.find((category) => category.id === categoryId)?.effect ?? "glow";
}

export function defaultAreaWindow(area: Area): "evening" | "day" {
  return area === "work" ? "day" : "evening";
}
