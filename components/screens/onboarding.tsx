"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { addDays, toMinutes } from "@/lib/dates";
import { buildPlan, defaultAnswers } from "@/lib/engine";
import { useApp } from "@/lib/store";
import { CHORE_TEMPLATES, HABIT_SUGGESTIONS, PACE_OPTIONS, PET_CARES, PET_TYPES, WORK_AREAS } from "@/lib/templates";
import type { OnboardingAnswers, Pace } from "@/lib/types";
import { Button, useCalm } from "../ui";

export function OnboardingScreen({ mode }: { mode: "create" | "edit" }) {
  const { data, clock, finishOnboarding } = useApp();
  const router = useRouter();
  const calm = useCalm();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>(data.profile?.onboarding ?? defaultAnswers());
  const [error, setError] = useState("");
  const anchor = clock.minutes < toMinutes(answers.availabilityEnd) - 15 ? clock.today : addDays(clock.today, 1);
  const plan = useMemo(() => buildPlan(answers, anchor), [answers, anchor]);
  const [tasksOn, setTasksOn] = useState<Record<string, boolean>>(() => Object.fromEntries(plan.tasks.map((task) => [task.key, mode === "create" || data.tasks.some((item) => item.planKey === task.key && item.active)])));
  const [petsOn, setPetsOn] = useState<Record<string, boolean>>(() => Object.fromEntries(plan.pets.map((pet) => [pet.key, true])));
  const [projectsOn, setProjectsOn] = useState<Record<string, boolean>>(() => Object.fromEntries(plan.projects.map((project) => [project.key, true])));

  function patch(partial: Partial<OnboardingAnswers>) {
    setAnswers((current) => ({ ...current, ...partial }));
  }

  const steps = [
    <NameStep key="name" name={answers.name} onChange={(name) => patch({ name })} />,
    <TimeStep key="rhythm" title="Sleep" a={answers.wake} b={answers.sleep} aLabel="Wake" bLabel="Sleep" onA={(wake) => patch({ wake })} onB={(sleep) => patch({ sleep })} />,
    <AvailabilityStep key="hours" answers={answers} onChange={patch} />,
    <ChoreStep key="chores" title="Chores" paces={answers.chores} onChange={(chores) => patch({ chores })} />,
    <StartStep key="start" chores={answers.chores} starting={answers.starting} onChange={(starting) => patch({ starting })} />,
    <PetStep key="pets" pets={answers.pets} onChange={(pets) => patch({ pets })} />,
    <HabitStep key="habits" habits={answers.habits} onChange={(habits) => patch({ habits })} />,
    <WorkStep key="work" answers={answers} onChange={patch} />,
    <GoalStep key="goals" goals={answers.goals} onChange={(goals) => patch({ goals })} />,
    <PreferenceStep key="prefs" answers={answers} onChange={patch} />,
    <ReviewStep key="review" plan={plan} tasksOn={tasksOn} petsOn={petsOn} projectsOn={projectsOn} setTasksOn={setTasksOn} setPetsOn={setPetsOn} setProjectsOn={setProjectsOn} />,
  ];

  function next() {
    if (step === 2 && toMinutes(answers.availabilityEnd) <= toMinutes(answers.availabilityStart)) {
      setError("The end has to be later.");
      return;
    }
    setError("");
    if (step < steps.length - 1) setStep(step + 1);
    else {
      const ok = finishOnboarding(
        answers,
        plan.tasks.filter((task) => tasksOn[task.key] !== false).map((task) => task.key),
        plan.pets.filter((pet) => petsOn[pet.key] !== false).map((pet) => pet.key),
        plan.projects.filter((project) => projectsOn[project.key] !== false).map((project) => project.key),
      );
      if (ok) router.replace("/");
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-1.5rem)] flex-col">
      <div className="mb-6 flex items-center justify-between text-sm text-muted">
        <span className="serif text-2xl text-ink">Hearth</span>
        <span>{step + 1} / {steps.length}</span>
      </div>
      <div className="mb-6 h-1 overflow-hidden rounded-full bg-line">
        <div className="h-full bg-accent" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>
      {calm ? (
        <div className="flex-1 pb-6">{steps[step]}</div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={step} className="flex-1 pb-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {steps[step]}
          </motion.div>
        </AnimatePresence>
      )}
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      <div className="sticky bottom-0 z-10 -mx-4 mt-auto flex gap-2 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur-xl" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
        {step > 0 ? <Button variant="quiet" onClick={() => setStep(step - 1)}>Back</Button> : null}
        {step > 0 && step < steps.length - 1 ? <Button variant="ghost" onClick={() => setStep(step + 1)}>Skip</Button> : null}
        <Button className="min-w-0 flex-1" onClick={next}>{step === steps.length - 1 ? "Done" : "Continue"}</Button>
      </div>
    </div>
  );
}

function NameStep({ name, onChange }: { name: string; onChange: (name: string) => void }) {
  return (
    <div>
      <h2 className="serif text-3xl leading-tight sm:text-4xl">Name</h2>
      <input className="mt-6 min-h-14 w-full rounded-3xl border border-line bg-elev px-4 text-lg" value={name} onChange={(event) => onChange(event.target.value)} placeholder="Your name" />
    </div>
  );
}

function TimeStep({ title, a, b, aLabel, bLabel, onA, onB }: { title: string; a: string; b: string; aLabel: string; bLabel: string; onA: (value: string) => void; onB: (value: string) => void }) {
  return (
    <div>
      {title ? <h2 className="serif text-3xl leading-tight sm:text-4xl">{title}</h2> : null}
      <div className={`${title ? "mt-6" : ""} grid grid-cols-1 gap-3 sm:grid-cols-2`}>
        <label className="text-sm text-muted">{aLabel}<input className="mt-1 min-h-12 w-full rounded-2xl border border-line bg-elev px-3 text-ink" type="time" value={a} onChange={(event) => onA(event.target.value)} /></label>
        <label className="text-sm text-muted">{bLabel}<input className="mt-1 min-h-12 w-full rounded-2xl border border-line bg-elev px-3 text-ink" type="time" value={b} onChange={(event) => onB(event.target.value)} /></label>
      </div>
    </div>
  );
}

function AvailabilityStep({ answers, onChange }: { answers: OnboardingAnswers; onChange: (patch: Partial<OnboardingAnswers>) => void }) {
  return (
    <div className="space-y-4">
      <h2 className="serif text-3xl leading-tight sm:text-4xl">Free time</h2>
      <TimeStep title="" a={answers.availabilityStart} b={answers.availabilityEnd} aLabel="From" bLabel="Until" onA={(availabilityStart) => onChange({ availabilityStart })} onB={(availabilityEnd) => onChange({ availabilityEnd })} />
      <label className="block text-sm text-muted">Week starts
        <select className="mt-1 min-h-12 w-full rounded-2xl border border-line bg-elev px-3 text-ink" value={answers.weekStartsOn} onChange={(event) => onChange({ weekStartsOn: Number(event.target.value) as 0 | 1 })}>
          <option value={1}>Monday</option>
          <option value={0}>Sunday</option>
        </select>
      </label>
    </div>
  );
}

function ChoreStep({ title, paces, onChange }: { title: string; paces: Record<string, Pace>; onChange: (paces: Record<string, Pace>) => void }) {
  return (
    <div>
      <h2 className="serif text-3xl leading-tight sm:text-4xl">{title}</h2>
      <ul className="mt-4 space-y-3">
        {CHORE_TEMPLATES.map((chore) => (
          <li key={chore.id} className="card p-3">
            <p>{chore.title}</p>
            <div className="mt-2 flex gap-1 overflow-x-auto">
              {PACE_OPTIONS.map((pace) => (
                <button key={pace.id} type="button" aria-pressed={(paces[chore.id] ?? "never") === pace.id} className={`min-h-9 shrink-0 rounded-full px-3 text-xs ${(paces[chore.id] ?? "never") === pace.id ? "bg-ink text-bg" : "bg-bg"}`} onClick={() => onChange({ ...paces, [chore.id]: pace.id })}>{pace.label}</button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StartStep({ chores, starting, onChange }: { chores: Record<string, Pace>; starting: Record<string, Pace>; onChange: (starting: Record<string, Pace>) => void }) {
  const left = CHORE_TEMPLATES.filter((chore) => (chores[chore.id] ?? "never") === "never");
  return (
    <div>
      <h2 className="serif text-3xl leading-tight sm:text-4xl">Start any?</h2>
      <ul className="mt-4 space-y-3">
        {left.map((chore) => (
          <li key={chore.id} className="card p-3">
            <p>{chore.title}</p>
            <div className="mt-2 flex gap-1 overflow-x-auto">
              {PACE_OPTIONS.map((pace) => (
                <button key={pace.id} type="button" className={`min-h-9 shrink-0 rounded-full px-3 text-xs ${(starting[chore.id] ?? "never") === pace.id ? "bg-ink text-bg" : "bg-bg"}`} onClick={() => onChange({ ...starting, [chore.id]: pace.id })}>{pace.label}</button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PetStep({ pets, onChange }: { pets: OnboardingAnswers["pets"]; onChange: (pets: OnboardingAnswers["pets"]) => void }) {
  const list = pets.length ? pets : [];
  return (
    <div>
      <h2 className="serif text-3xl leading-tight sm:text-4xl">Pets</h2>
      {list.map((pet, index) => (
        <div key={index} className="card mt-3 space-y-2 p-3">
          <input className="min-h-11 w-full rounded-2xl border border-line bg-bg px-3" placeholder="Name" value={pet.name} onChange={(event) => onChange(list.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} />
          <select className="min-h-11 w-full rounded-2xl border border-line bg-bg px-3" value={pet.type} onChange={(event) => onChange(list.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value } : item))}>
            {PET_TYPES.map((type) => <option key={type}>{type}</option>)}
          </select>
          <div className="flex flex-wrap gap-2">
            {PET_CARES.map((care) => {
              const on = pet.cares.includes(care.id);
              return <button key={care.id} type="button" aria-pressed={on} className={`min-h-9 rounded-full px-3 text-xs ${on ? "bg-ink text-bg" : "bg-bg"}`} onClick={() => onChange(list.map((item, itemIndex) => itemIndex === index ? { ...item, cares: on ? item.cares.filter((id) => id !== care.id) : [...item.cares, care.id] } : item))}>{care.label}</button>;
            })}
          </div>
        </div>
      ))}
      <Button className="mt-3" variant="quiet" onClick={() => onChange([...list, { name: "", type: "Dog", cares: ["feed", "water"] }])}>Add a pet</Button>
    </div>
  );
}

function HabitStep({ habits, onChange }: { habits: string[]; onChange: (habits: string[]) => void }) {
  const [custom, setCustom] = useState("");
  return (
    <div>
      <h2 className="serif text-3xl leading-tight sm:text-4xl">Personal habits</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {HABIT_SUGGESTIONS.map((habit) => {
          const on = habits.includes(habit);
          return <button key={habit} type="button" aria-pressed={on} className={`min-h-10 rounded-full px-3 text-sm ${on ? "bg-ink text-bg" : "bg-elev"}`} onClick={() => onChange(on ? habits.filter((item) => item !== habit) : [...habits, habit])}>{habit}</button>;
        })}
      </div>
      <div className="mt-4 flex gap-2">
        <input className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-elev px-4" value={custom} placeholder="Your own" onChange={(event) => setCustom(event.target.value)} />
        <Button className="shrink-0" variant="quiet" onClick={() => { if (custom.trim()) { onChange([...habits, custom.trim()]); setCustom(""); } }}>Add</Button>
      </div>
    </div>
  );
}

function WorkStep({ answers, onChange }: { answers: OnboardingAnswers; onChange: (patch: Partial<OnboardingAnswers>) => void }) {
  return (
    <div>
      <h2 className="serif text-3xl leading-tight sm:text-4xl">Work and projects</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {WORK_AREAS.map((area) => {
          const on = answers.workAreas.includes(area.id);
          return <button key={area.id} type="button" aria-pressed={on} className={`min-h-10 rounded-full px-3 text-sm ${on ? "bg-ink text-bg" : "bg-elev"}`} onClick={() => onChange({ workAreas: on ? answers.workAreas.filter((id) => id !== area.id) : [...answers.workAreas, area.id] })}>{area.label}</button>;
        })}
      </div>
      <label className="mt-4 block text-sm text-muted">When does work usually happen?
        <select className="mt-1 min-h-12 w-full rounded-2xl border border-line bg-elev px-3 text-ink" value={answers.workWhen} onChange={(event) => onChange({ workWhen: event.target.value as OnboardingAnswers["workWhen"] })}>
          <option value="day">Daytime</option>
          <option value="evening">Evenings</option>
          <option value="both">Both</option>
        </select>
      </label>
    </div>
  );
}

function GoalStep({ goals, onChange }: { goals: string[]; onChange: (goals: string[]) => void }) {
  return (
    <div>
      <h2 className="serif text-3xl leading-tight sm:text-4xl">Goals</h2>
      <textarea className="mt-4 min-h-40 w-full rounded-3xl border border-line bg-elev p-4" value={goals.join("\n")} onChange={(event) => onChange(event.target.value.split("\n"))} />
    </div>
  );
}

function PreferenceStep({ answers, onChange }: { answers: OnboardingAnswers; onChange: (patch: Partial<OnboardingAnswers>) => void }) {
  return (
    <div className="space-y-4">
      <h2 className="serif text-3xl leading-tight sm:text-4xl">Feel</h2>
      <label className="block text-sm text-muted">Reminders
        <select className="mt-1 min-h-12 w-full rounded-2xl border border-line bg-elev px-3 text-ink" value={answers.reminderStyle} onChange={(event) => onChange({ reminderStyle: event.target.value as OnboardingAnswers["reminderStyle"] })}>
          <option value="gentle">Gentle</option>
          <option value="standard">Standard</option>
          <option value="minimal">Minimal</option>
        </select>
      </label>
      <label className="block text-sm text-muted">Weekly pace
        <select className="mt-1 min-h-12 w-full rounded-2xl border border-line bg-elev px-3 text-ink" value={answers.weeklyWorkload} onChange={(event) => onChange({ weeklyWorkload: event.target.value as OnboardingAnswers["weeklyWorkload"] })}>
          <option value="light">Light</option>
          <option value="balanced">Balanced</option>
          <option value="full">Full</option>
        </select>
      </label>
      <label className="block text-sm text-muted">Animation
        <select className="mt-1 min-h-12 w-full rounded-2xl border border-line bg-elev px-3 text-ink" value={answers.animation} onChange={(event) => onChange({ animation: event.target.value as OnboardingAnswers["animation"] })}>
          <option value="subtle">Subtle</option>
          <option value="normal">Normal</option>
          <option value="rich">Rich</option>
        </select>
      </label>
    </div>
  );
}

function ReviewStep({ plan, tasksOn, petsOn, projectsOn, setTasksOn, setPetsOn, setProjectsOn }: { plan: ReturnType<typeof buildPlan>; tasksOn: Record<string, boolean>; petsOn: Record<string, boolean>; projectsOn: Record<string, boolean>; setTasksOn: (value: Record<string, boolean>) => void; setPetsOn: (value: Record<string, boolean>) => void; setProjectsOn: (value: Record<string, boolean>) => void }) {
  return (
    <div>
      <h2 className="serif text-3xl leading-tight sm:text-4xl">Start with</h2>
      <ul className="mt-4 space-y-2">
        {plan.pets.map((pet) => (
          <li key={pet.key}><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={petsOn[pet.key] !== false} onChange={(event) => setPetsOn({ ...petsOn, [pet.key]: event.target.checked })} />Pet · {pet.name}</label></li>
        ))}
        {plan.projects.map((project) => (
          <li key={project.key}><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={projectsOn[project.key] !== false} onChange={(event) => setProjectsOn({ ...projectsOn, [project.key]: event.target.checked })} />Project · {project.name}</label></li>
        ))}
        {plan.tasks.map((task) => (
          <li key={task.key}><label className="flex min-h-11 items-start gap-3 py-2 text-sm"><input className="mt-1 shrink-0" type="checkbox" checked={tasksOn[task.key] !== false} onChange={(event) => setTasksOn({ ...tasksOn, [task.key]: event.target.checked })} /><span className="min-w-0">{task.title} <span className="text-muted">{task.detail}</span></span></label></li>
        ))}
      </ul>
    </div>
  );
}
