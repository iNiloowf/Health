"use client";

import { useState } from "react";
import { readImageFile } from "@/lib/images";
import { useApp } from "@/lib/store";
import { ACHIEVEMENTS, CHORE_TEMPLATES, PET_CARES, PET_TYPES, PROJECT_COLORS } from "@/lib/templates";
import { paceToInput } from "./pace";
import { AddTaskButton, TaskDetail, TaskRow } from "../tasks";
import { Button, controlClass, Empty, Field, Sheet } from "../ui";

export function HouseholdScreen() {
  const { data, clock, saveTask } = useApp();
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const rooms = data.categories.filter((category) => category.area === "household");
  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="serif text-4xl">Household</h1>
        </div>
        <AddTaskButton lock={{ area: "household", window: "evening" }} />
      </header>
      {rooms.map((room) => {
        const tasks = data.tasks.filter((task) => task.categoryId === room.id && task.active);
        const items = data.occurrences.filter((item) => item.categoryId === room.id && item.date === clock.today && item.status !== "skipped");
        return (
          <section key={room.id} className="space-y-2">
            <h2 className="text-sm text-muted">{room.name}</h2>
            {items.map((item) => <TaskRow key={item.id} occurrence={item} onOpen={() => setSelected(item.id)} />)}
            {!items.length && tasks.length ? <p className="text-sm text-muted">Nothing from {room.name.toLowerCase()} is due tonight.</p> : null}
            {!tasks.length ? <p className="text-sm text-muted">No active tasks in this room.</p> : null}
          </section>
        );
      })}
      <section>
        <h2 className="mb-2 text-sm text-muted">Templates</h2>
        <div className="grid grid-cols-2 gap-2">
          {CHORE_TEMPLATES.map((chore) => (
            <button key={chore.id} type="button" className="card px-3 py-3 text-left text-sm" onClick={() => { if (data.tasks.some((task) => task.planKey === `template:${chore.id}` && task.active)) return; saveTask(paceToInput(chore, clock.today)); }}>
              {chore.title}
              <span className="mt-1 block text-xs text-muted">{chore.defaultPace.replaceAll("_", " ")}</span>
            </button>
          ))}
        </div>
      </section>
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (!name.trim()) return; saveTask({ title: name, description: "", categoryId: "maintenance", icon: "Wrench", priority: "medium", durationMinutes: 30, xpReward: 20, recurrence: { type: "monthly", dayOfMonth: 1 }, anchorDate: clock.today, preferredTime: null, flexible: true, window: "evening", reminderMinutes: 15, notes: "", subtasks: [], area: "household" }); setName(""); }}>
        <input className={controlClass} placeholder="Custom household task" value={name} onChange={(event) => setName(event.target.value)} />
        <Button type="submit">Add</Button>
      </form>
      <TaskDetail key={selected ?? "none"} occurrenceId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

export function HabitsScreen() {
  const { data, clock } = useApp();
  const [selected, setSelected] = useState<string | null>(null);
  const habits = data.tasks.filter((task) => task.area === "habit" && task.active);
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="serif text-4xl">Habits</h1>
        <AddTaskButton label="Add habit" lock={{ area: "habit", categoryId: "habit", window: "evening", icon: "Repeat" }} />
      </div>
      {habits.map((habit) => {
        const today = data.occurrences.find((item) => item.taskId === habit.id && item.date === clock.today);
        return (
          <article key={habit.id} className="card p-4">
            <div className="flex items-center justify-between">
              <h2>{habit.title}</h2>
              <span className="text-sm text-warm">{habit.streak} streak{habit.atRisk ? " · at risk" : ""}</span>
            </div>
            <p className="text-xs text-muted">Longest {habit.longestStreak}</p>
            {today ? <div className="mt-3"><TaskRow occurrence={today} onOpen={() => setSelected(today.id)} /></div> : <p className="mt-2 text-sm text-muted">Not scheduled today.</p>}
          </article>
        );
      })}
      {!habits.length ? <Empty title="No habits yet" body="A habit can repeat daily, a few times a week, or whenever you choose." /> : null}
      <TaskDetail key={selected ?? "none"} occurrenceId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

export function PetsScreen() {
  const app = useApp();
  const { data, clock, savePet, removePet } = app;
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", type: "Dog", notes: "", photo: "", cares: ["feed", "water"] as string[] });
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="serif text-4xl">Pets</h1>
        <Button onClick={() => setOpen(true)}>Add pet</Button>
      </div>
      {data.pets.map((pet) => {
        const care = data.occurrences.filter((item) => item.petId === pet.id && item.date === clock.today && item.status !== "skipped");
        return (
          <article key={pet.id} className="card p-4">
            <div className="flex gap-3">
              {pet.photo ? (
              // User photos are local data URLs, which the image optimizer cannot fetch.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pet.photo} alt="" className="h-16 w-16 rounded-2xl object-cover" />
            ) : <div className="grid h-16 w-16 place-items-center rounded-2xl bg-warm-soft">{pet.name.slice(0, 1)}</div>}
              <div>
                <h2 className="text-xl">{pet.name}</h2>
                <p className="text-sm text-muted">{pet.type}</p>
              </div>
            </div>
            {pet.notes ? <p className="mt-3 text-sm leading-6">{pet.notes}</p> : null}
            <div className="mt-3 space-y-2">{care.map((item) => <TaskRow key={item.id} occurrence={item} onOpen={() => setSelected(item.id)} />)}</div>
            <Button className="mt-3" variant="danger" onClick={() => removePet(pet.id)}>Remove</Button>
          </article>
        );
      })}
      {!data.pets.length ? <Empty title="No pets yet" body="" /> : null}
      <Sheet open={open} title="New pet" onClose={() => setOpen(false)}>
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); const ok = savePet({ ...draft, photo: draft.photo || undefined, cares: draft.cares }); if (ok) setOpen(false); }}>
          <Field label="Name"><input className={controlClass} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></Field>
          <Field label="Type"><select className={controlClass} value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>{PET_TYPES.map((type) => <option key={type}>{type}</option>)}</select></Field>
          <Field label="Photo"><input type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) setDraft({ ...draft, photo: await readImageFile(file, 800) }); }} /></Field>
          <Field label="Notes"><textarea className={`${controlClass} min-h-20 py-2`} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></Field>
          <div className="flex flex-wrap gap-2">
            {PET_CARES.map((care) => {
              const on = draft.cares.includes(care.id);
              return <button key={care.id} type="button" className={`min-h-9 rounded-full px-3 text-xs ${on ? "bg-ink text-bg" : "bg-elev"}`} onClick={() => setDraft({ ...draft, cares: on ? draft.cares.filter((id) => id !== care.id) : [...draft.cares, care.id] })}>{care.label}</button>;
            })}
          </div>
          <Button type="submit" className="w-full">Save pet</Button>
        </form>
      </Sheet>
      <TaskDetail key={selected ?? "none"} occurrenceId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

export function WorkScreen() {
  const { data, clock, saveProject, removeProject, saveTask } = useApp();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", description: "", kind: "work" as "work" | "personal", deadline: "", color: PROJECT_COLORS[0], incomeNotes: "", expenseNotes: "" });
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="serif text-4xl">Work</h1>
        </div>
        <Button onClick={() => setOpen(true)}>Add project</Button>
      </div>
      {data.projects.filter((project) => !project.archived).map((project) => {
        const tasks = data.tasks.filter((task) => task.projectId === project.id);
        const done = tasks.filter((task) => data.occurrences.some((item) => item.taskId === task.id && item.status === "completed")).length;
        const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
        return (
          <article key={project.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl">{project.name}</h2>
                <p className="text-sm text-muted">{project.kind}{project.deadline ? ` · due ${project.deadline}` : ""}</p>
              </div>
              <span className="text-sm">{percent}%</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full bg-accent" style={{ width: `${percent}%`, background: project.color }} /></div>
            {project.description ? <p className="mt-3 text-sm leading-6">{project.description}</p> : null}
            <div className="mt-3 space-y-2">
              {data.occurrences.filter((item) => item.projectId === project.id && item.status !== "completed").slice(0, 4).map((item) => <TaskRow key={item.id} occurrence={item} onOpen={() => setSelected(item.id)} />)}
            </div>
            <div className="mt-3 grid gap-2">
              <textarea className={`${controlClass} min-h-16 py-2`} placeholder="Income notes" defaultValue={project.incomeNotes} onBlur={(event) => saveProject({ ...project, incomeNotes: event.target.value }, project.id)} />
              <textarea className={`${controlClass} min-h-16 py-2`} placeholder="Expense notes" defaultValue={project.expenseNotes} onBlur={(event) => saveProject({ ...project, expenseNotes: event.target.value }, project.id)} />
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="quiet" onClick={() => saveTask({ title: "Project task", description: "", categoryId: "work", icon: "Briefcase", priority: "medium", durationMinutes: 30, xpReward: 20, recurrence: { type: "once" }, anchorDate: clock.today, preferredTime: null, flexible: true, window: "day", reminderMinutes: 10, notes: "", subtasks: [], area: "work", projectId: project.id })}>Add task</Button>
              <Button variant="danger" onClick={() => removeProject(project.id)}>Delete</Button>
            </div>
          </article>
        );
      })}
      {!data.projects.length ? <Empty title="No projects yet" body="" /> : null}
      <Sheet open={open} title="New project" onClose={() => setOpen(false)}>
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); const ok = saveProject({ ...draft, deadline: draft.deadline || undefined }); if (ok) setOpen(false); }}>
          <Field label="Name"><input className={controlClass} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></Field>
          <Field label="Description"><textarea className={`${controlClass} min-h-20 py-2`} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></Field>
          <Field label="Kind"><select className={controlClass} value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as "work" | "personal" })}><option value="work">Work</option><option value="personal">Personal</option></select></Field>
          <Field label="Deadline"><input className={controlClass} type="date" value={draft.deadline} onChange={(event) => setDraft({ ...draft, deadline: event.target.value })} /></Field>
          <div className="flex gap-2">{PROJECT_COLORS.map((color) => <button key={color} type="button" aria-label={color} className="h-9 w-9 rounded-full" style={{ background: color, outline: draft.color === color ? "2px solid var(--ink)" : undefined }} onClick={() => setDraft({ ...draft, color })} />)}</div>
          <Button type="submit" className="w-full">Create project</Button>
        </form>
      </Sheet>
      <TaskDetail key={selected ?? "none"} occurrenceId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

export function AchievementsScreen() {
  const { data } = useApp();
  const owned = new Set(data.achievements.map((item) => item.id));
  return (
    <div className="space-y-4">
      <h1 className="serif text-4xl">Achievements</h1>
      <div className="grid grid-cols-2 gap-3">
        {ACHIEVEMENTS.map((item) => {
          const unlocked = owned.has(item.id);
          return (
            <article key={item.id} className={`card p-4 ${unlocked ? "" : "opacity-60"}`}>
              <p className="text-xs uppercase tracking-[0.14em] text-muted">{unlocked ? "Unlocked" : "Locked"}</p>
              <h2 className="serif mt-2 text-2xl">{item.name}</h2>
              <p className="mt-1 text-sm text-muted">{item.description}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
