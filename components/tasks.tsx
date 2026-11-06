"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { formatMedium, formatTime } from "@/lib/dates";
import { recurrenceLabel } from "@/lib/model";
import { useApp } from "@/lib/store";
import type { Occurrence, Task } from "@/lib/types";
import { Icon } from "./icon";
import { TaskForm } from "./task-form";
import { Button, Sheet, useCalm } from "./ui";

export function TaskRow({ occurrence, onOpen }: { occurrence: Occurrence; onOpen: () => void }) {
  const { complete, data } = useApp();
  const calm = useCalm();
  const done = occurrence.status === "completed";
  return (
    <article className="card flex items-center gap-3 p-3">
      <motion.button
        type="button"
        aria-label={done ? `${occurrence.titleSnapshot} completed` : `Complete ${occurrence.titleSnapshot}`}
        disabled={done || occurrence.status === "skipped"}
        onClick={() => complete(occurrence.id)}
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border ${done ? "border-accent bg-accent text-accent-ink" : "border-line bg-bg"}`}
        animate={calm ? undefined : { scale: done ? [1, 1.08, 1] : 1 }}
      >
        {done ? <Icon name="Check" size={18} /> : null}
      </motion.button>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 py-1 text-left">
        <span className={`block truncate ${done ? "text-muted line-through" : ""}`}>{occurrence.titleSnapshot}</span>
        <span className="mt-0.5 block text-xs text-muted">
          {formatTime(occurrence.time)} · {occurrence.durationMinutes} min
          {occurrence.status === "missed" ? " · needs a new time" : ""}
          {occurrence.rescheduledFrom ? " · moved" : ""}
          {occurrence.overflow ? " · full evening" : ""}
          {occurrence.status === "skipped" ? " · skipped" : ""}
          {done && occurrence.doneBy ? ` · ${occurrence.doneBy}` : ""}
        </span>
      </button>
      {data.profile?.showXp !== false && !done ? <span className="pr-1 text-xs text-warm">+{occurrence.xpReward}</span> : null}
    </article>
  );
}

export function TaskDetail({ occurrenceId, onClose }: { occurrenceId: string | null; onClose: () => void }) {
  const { data, complete, skip, move, toggleStep, saveNote, removeTask, setActive } = useApp();
  const occurrence = data.occurrences.find((item) => item.id === occurrenceId);
  const task = data.tasks.find((item) => item.id === occurrence?.taskId);
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(occurrence?.date ?? "");
  const [time, setTime] = useState(occurrence?.time ?? "19:00");
  const [confirm, setConfirm] = useState(false);

  if (!occurrence) return null;
  const steps = task?.subtasks ?? [];
  return (
    <>
    <Sheet open={Boolean(occurrenceId) && !editing} title={occurrence.titleSnapshot} onClose={onClose}>
      {occurrence.note || task?.image ? null : null}
      {task?.image ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={task.image} alt="" className="mb-4 h-36 w-full rounded-2xl object-cover" />
    ) : null}
      <p className="text-sm leading-6 text-muted">{task?.description || "No description yet."}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Info label="When" value={`${formatMedium(occurrence.date)} · ${formatTime(occurrence.time)}`} />
        <Info label="Status" value={occurrence.status} />
        <Info label="Repeats" value={task ? recurrenceLabel(task.recurrence) : "One time"} />
        <Info label="Streak" value={task ? `${task.streak}${task.atRisk ? " at risk" : ""}` : "0"} />
      </dl>
      {task?.notes ? <p className="mt-4 text-sm leading-6">{task.notes}</p> : null}
      {steps.length ? (
        <ul className="mt-4 space-y-2">
          {steps.map((step) => {
            const checked = occurrence.subtaskDone.includes(step.id);
            return (
              <li key={step.id}>
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <input type="checkbox" checked={checked} onChange={() => toggleStep(occurrence.id, step.id)} />
                  {step.title}
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}
      <label className="mt-4 block text-sm">
        <span className="text-muted">Note for this time</span>
        <textarea className="mt-1 min-h-20 w-full rounded-2xl border border-line bg-bg/70 px-3 py-2" defaultValue={occurrence.note ?? ""} onBlur={(event) => saveNote(occurrence.id, event.target.value)} />
      </label>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <input className="min-h-11 rounded-2xl border border-line bg-bg/70 px-3" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <input className="min-h-11 rounded-2xl border border-line bg-bg/70 px-3" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {occurrence.status !== "completed" ? <Button onClick={() => complete(occurrence.id)}>Complete</Button> : null}
        <Button variant="quiet" onClick={() => move(occurrence.id, date, time)}>Move</Button>
        {occurrence.status !== "completed" ? <Button variant="ghost" onClick={() => skip(occurrence.id)}>{occurrence.status === "missed" ? "Protect streak" : "Skip"}</Button> : null}
        {task ? <Button variant="quiet" onClick={() => setEditing(true)}>Edit</Button> : null}
        {task ? <Button variant="ghost" onClick={() => setActive(task.id, !task.active)}>{task.active ? "Pause" : "Resume"}</Button> : null}
        {task && !confirm ? <Button variant="danger" onClick={() => setConfirm(true)}>Delete</Button> : null}
        {confirm && task ? <Button variant="danger" onClick={() => { removeTask(task.id); onClose(); }}>Delete forever</Button> : null}
      </div>
      </Sheet>
    {editing && task ? <Editor task={task} onClose={() => setEditing(false)} /> : null}
    </>
  );
}

function Editor({ task, onClose }: { task: Task; onClose: () => void }) {
  return (
    <Sheet open title="Edit task" onClose={onClose}>
      <TaskForm initial={task} onClose={onClose} />
    </Sheet>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-bg/70 px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="capitalize">{value}</dd>
    </div>
  );
}

export function AddTaskButton({ lock, label = "Add task" }: { lock?: Parameters<typeof TaskForm>[0]["lock"]; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>{label}</Button>
      <Sheet open={open} title="New task" onClose={() => setOpen(false)}>
        <TaskForm lock={lock} onClose={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
