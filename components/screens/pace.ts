import { suggestedXp } from "@/lib/model";
import type { ChoreTemplate } from "@/lib/templates";
import type { Pace, Recurrence, TaskInput } from "@/lib/types";

const paces: Record<Exclude<Pace, "never">, Recurrence> = {
  daily: { type: "daily" },
  every_2_3: { type: "every_n_days", interval: 3 },
  twice_week: { type: "weekdays", weekdays: [2, 6] },
  weekly: { type: "weekly", weekday: 6 },
  biweekly: { type: "biweekly", weekday: 6 },
  monthly: { type: "monthly", dayOfMonth: 1 },
  rarely: { type: "monthly", dayOfMonth: 15 },
};

export function paceToInput(chore: ChoreTemplate, anchorDate: string): TaskInput {
  const pace = chore.defaultPace === "never" ? "weekly" : chore.defaultPace;
  return {
    title: chore.title,
    description: chore.description,
    categoryId: chore.categoryId,
    icon: chore.icon,
    priority: chore.priority,
    durationMinutes: chore.durationMinutes,
    xpReward: suggestedXp(chore.durationMinutes, chore.priority),
    recurrence: paces[pace],
    anchorDate,
    preferredTime: null,
    flexible: true,
    window: "evening",
    reminderMinutes: 15,
    notes: "",
    subtasks: (chore.subtasks ?? []).map((title) => ({ title })),
    area: "household",
    planKey: `template:${chore.id}`,
  };
}
