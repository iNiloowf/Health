"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { taskPoints } from "@/lib/progress";
import { useApp } from "@/lib/store";
import type { Occurrence, Task } from "@/lib/types";
import { Icon } from "./icon";
import { TaskForm } from "./task-form";
import { Button, Sheet, useCalm } from "./ui";

export function TaskRow({ occurrence, onOpen }: { occurrence: Occurrence; onOpen: () => void }) {
  const { complete } = useApp();
  const calm = useCalm();
  const done = occurrence.status === "completed";
  return (
    <article dir="ltr" className="card flex flex-row items-center gap-2 py-2 pl-3 pr-1">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Icon name={occurrence.icon} size={18} />
        </span>
        <span className="min-w-0">
          <span className={`block truncate ${done ? "text-muted line-through" : ""}`}>{occurrence.titleSnapshot}</span>
          {done ? <span className="mt-0.5 block truncate text-xs text-muted">{occurrence.doneBy || "Me"} · +{taskPoints(occurrence)}</span> : null}
        </span>
      </button>
      <motion.button
        type="button"
        aria-label={done ? `${occurrence.titleSnapshot} completed` : `Complete ${occurrence.titleSnapshot}`}
        disabled={done || occurrence.status === "skipped"}
        onClick={() => complete(occurrence.id)}
        className="grid h-14 w-14 shrink-0 place-items-center"
        animate={calm ? undefined : { scale: done ? [1, 1.06, 1] : 1 }}
      >
        <span className={`grid h-12 w-12 place-items-center rounded-full border-[3px] ${done ? "border-accent bg-accent text-accent-ink" : "border-accent bg-bg text-accent"}`}>
          <Icon name="Check" size={22} />
        </span>
      </motion.button>
    </article>
  );
}

export function TaskDetail({ occurrenceId, onClose }: { occurrenceId: string | null; onClose: () => void }) {
  const { data, complete, toggleStep, saveNote, removeTask, setActive } = useApp();
  const occurrence = data.occurrences.find((item) => item.id === occurrenceId);
  const task = data.tasks.find((item) => item.id === occurrence?.taskId);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);

  if (!occurrence) return null;
  const steps = task?.subtasks ?? [];
  return (
    <>
    <Sheet open={Boolean(occurrenceId) && !editing} title={occurrence.titleSnapshot} onClose={onClose}>
      {task?.image ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={task.image} alt="" className="mb-4 h-36 w-full rounded-2xl object-cover" />
    ) : null}
      <div dir="ltr" className="mb-4 flex flex-row items-center gap-3">
        {task?.description ? <p className="min-w-0 flex-1 text-sm leading-6 text-muted">{task.description}</p> : <span className="flex-1" />}
        <button type="button" aria-label={occurrence.status === "completed" ? "Completed" : "Complete"} disabled={occurrence.status === "completed" || occurrence.status === "skipped"} onClick={() => complete(occurrence.id)} className="grid h-14 w-14 shrink-0 place-items-center">
          <span className={`grid h-12 w-12 place-items-center rounded-full border-[3px] ${occurrence.status === "completed" ? "border-accent bg-accent text-accent-ink" : "border-accent bg-bg text-accent"}`}>
            <Icon name="Check" size={22} />
          </span>
        </button>
      </div>
      {occurrence.status === "completed" ? <p className="text-sm text-muted">{occurrence.doneBy || "Me"} · +{taskPoints(occurrence)}</p> : null}
      {task?.notes ? <p className="mt-4 text-sm leading-6">{task.notes}</p> : null}
      {steps.length ? (
        <ul className="mt-4 space-y-2">
          {steps.map((step) => {
            const checked = occurrence.subtaskDone.includes(step.id);
            return (
              <li key={step.id}>
                <label className="flex min-h-12 items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1">{step.title}</span>
                  <input type="checkbox" className="h-6 w-6 shrink-0" checked={checked} onChange={() => toggleStep(occurrence.id, step.id)} />
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}
      <label className="mt-4 block text-sm">
        <span className="text-muted">Note</span>
        <textarea className="mt-1 min-h-20 w-full rounded-2xl border border-line bg-bg/70 px-3 py-2" defaultValue={occurrence.note ?? ""} onBlur={(event) => saveNote(occurrence.id, event.target.value)} />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
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
