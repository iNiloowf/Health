import { CHORE_TEMPLATES } from "./templates";
import type { OnboardingAnswers, Pace } from "./types";

export const QUESTION_STEPS = ["rhythm", "hours", "chores", "start", "pets", "habits", "work", "goals", "prefs"] as const;

export type QuestionStep = (typeof QUESTION_STEPS)[number];

function pacesChosen(paces: Record<string, Pace> | undefined): boolean {
  return Object.values(paces ?? {}).some((pace) => pace && pace !== "never");
}

export function coveredSteps(answers: OnboardingAnswers): Set<string> {
  const saved = answers.answeredSteps ?? [];
  if (saved.length) return new Set(saved);
  const covered = new Set<string>();
  if (!answers.name.trim()) return covered;
  covered.add("name");
  covered.add("rhythm");
  covered.add("hours");
  covered.add("prefs");
  if (pacesChosen(answers.chores)) covered.add("chores");
  if (pacesChosen(answers.starting)) covered.add("start");
  if (answers.pets.some((pet) => pet.name.trim())) covered.add("pets");
  if (answers.habits.some((habit) => habit.trim())) covered.add("habits");
  if (answers.workAreas.length) covered.add("work");
  if (answers.goals.some((goal) => goal.trim())) covered.add("goals");
  return covered;
}

export function stampCovered(answers: OnboardingAnswers): OnboardingAnswers {
  return { ...answers, answeredSteps: [...coveredSteps(answers)] };
}

export function openChoreIds(answers: OnboardingAnswers): string[] {
  return CHORE_TEMPLATES.filter((chore) => (answers.chores[chore.id] ?? "never") === "never" && (answers.starting?.[chore.id] ?? "never") === "never").map((chore) => chore.id);
}

export function openSteps(answers: OnboardingAnswers): QuestionStep[] {
  const covered = coveredSteps(answers);
  const steps: QuestionStep[] = [];
  if (!covered.has("rhythm")) steps.push("rhythm");
  if (!covered.has("hours")) steps.push("hours");
  if (openChoreIds(answers).length) steps.push("chores");
  if (!answers.pets.some((pet) => pet.name.trim())) steps.push("pets");
  if (!answers.habits.some((habit) => habit.trim())) steps.push("habits");
  if (!answers.workAreas.length) steps.push("work");
  if (!answers.goals.some((goal) => goal.trim())) steps.push("goals");
  if (!covered.has("prefs")) steps.push("prefs");
  return steps;
}
