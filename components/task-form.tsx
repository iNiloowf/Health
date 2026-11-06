"use client";

import { useState } from "react";
import { suggestedXp } from "@/lib/model";
import { useApp } from "@/lib/store";
import type { Priority, Recurrence, ScheduleWindow, Task, TaskInput } from "@/lib/types";
import { Icon, ICON_NAMES } from "./icon";
import { readImageFile } from "@/lib/images";
import { Button, controlClass, Field } from "./ui";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function TaskForm({ initial, onClose, lock }: { initial?: Task; onClose: () => void; lock?: Partial<TaskInput> }) {
  const { data, clock, saveTask } = useApp();
  const category = data.categories.find((item) => item.id === (initial?.categoryId || lock?.categoryId)) ?? data.categories[0];
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? category?.id ?? "kitchen");
  const [icon, setIcon] = useState(initial?.icon ?? category?.icon ?? "Check");
  const [image, setImage] = useState(initial?.image);
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? "medium");
  const [duration, setDuration] = useState(initial?.durationMinutes ?? 20);
  const [xp, setXp] = useState(initial?.xpReward ?? suggestedXp(20, "medium"));
  const [recurrence, setRecurrence] = useState<Recurrence>(initial?.recurrence ?? { type: "weekly", weekday: 4 });
  const [anchorDate, setAnchorDate] = useState(initial?.anchorDate ?? clock.today);
  const [preferredTime, setPreferredTime] = useState(initial?.preferredTime ?? "");
  const [flexible, setFlexible] = useState(initial?.flexible ?? true);
  const [windowName, setWindow] = useState<ScheduleWindow>(initial?.window ?? lock?.window ?? (category?.area === "work" ? "day" : "evening"));
  const [reminder, setReminder] = useState(initial?.reminderMinutes === undefined ? "15" : initial.reminderMinutes === null ? "off" : String(initial.reminderMinutes));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [steps, setSteps] = useState(initial?.subtasks.map((step) => step.title).join("\n") ?? "");
  const [error, setError] = useState("");

  function submit() {
    const chosen = data.categories.find((item) => item.id === categoryId);
    const input: TaskInput = {
      title,
      description,
      categoryId,
      icon,
      image,
      priority,
      durationMinutes: duration,
      xpReward: xp,
      recurrence,
      anchorDate,
      preferredTime: preferredTime || null,
      flexible,
      window: windowName,
      reminderMinutes: reminder === "off" ? null : Number(reminder),
      notes,
      subtasks: steps.split("\n").map((line, index) => ({ id: initial?.subtasks[index]?.id, title: line })),
      area: lock?.area ?? chosen?.area ?? "household",
      petId: initial?.petId ?? lock?.petId,
      projectId: initial?.projectId ?? lock?.projectId,
      planKey: initial?.planKey,
    };
    const saved = saveTask(input, initial?.id);
    if (saved) onClose();
    else setError("Check the form and try again.");
  }

  const eveningWarning = windowName !== "day" && preferredTime && preferredTime < "18:00";

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Field label="Name">
        <input className={controlClass} value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={80} />
      </Field>
      <Field label="Description">
        <textarea className={`${controlClass} min-h-20 py-2`} value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <select className={controlClass} value={categoryId} onChange={(event) => {
            const next = data.categories.find((item) => item.id === event.target.value);
            setCategoryId(event.target.value);
            if (next) {
              setIcon(next.icon);
              setWindow(next.area === "work" ? "day" : "evening");
            }
          }}>
            {data.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select className={controlClass} value={priority} onChange={(event) => {
            const next = event.target.value as Priority;
            setPriority(next);
            setXp(suggestedXp(duration, next));
          }}>
            <option value="low">Low</option>
            <option value="medium">Normal</option>
            <option value="high">Important</option>
          </select>
        </Field>
      </div>
      <div>
        <p className="mb-2 text-sm text-muted">Icon</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {ICON_NAMES.map((name) => (
            <button key={name} type="button" aria-label={name} aria-pressed={icon === name} className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${icon === name ? "border-accent bg-accent-soft" : "border-line"}`} onClick={() => setIcon(name)}>
              <Icon name={name} />
            </button>
          ))}
        </div>
      </div>
      <Field label="Image">
        <input className="text-sm" type="file" accept="image/*" onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setImage(await readImageFile(file, 800));
        }} />
      </Field>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-28 w-full rounded-2xl object-cover" />
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Minutes">
          <input className={controlClass} type="number" min={1} max={240} value={duration} onChange={(event) => {
            const next = Number(event.target.value);
            setDuration(next);
            setXp(suggestedXp(next, priority));
          }} />
        </Field>
        <Field label="XP reward">
          <input className={controlClass} type="number" min={0} max={200} value={xp} onChange={(event) => setXp(Number(event.target.value))} />
        </Field>
      </div>
      <Field label="Repeats">
        <select className={controlClass} value={recurrence.type} onChange={(event) => {
          const type = event.target.value as Recurrence["type"];
          setRecurrence(type === "every_n_days" ? { type, interval: 3 } : type === "weekdays" ? { type, weekdays: [1, 3, 5] } : type === "weekly" || type === "biweekly" ? { type, weekday: 4 } : type === "monthly" ? { type, dayOfMonth: 1 } : { type });
        }}>
          <option value="once">One time</option>
          <option value="daily">Every day</option>
          <option value="weekdays">Specific weekdays</option>
          <option value="every_n_days">Every X days</option>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Every two weeks</option>
          <option value="monthly">Monthly</option>
        </select>
      </Field>
      {recurrence.type === "every_n_days" ? (
        <Field label="Interval in days">
          <input className={controlClass} type="number" min={2} max={60} value={recurrence.interval ?? 3} onChange={(event) => setRecurrence({ type: "every_n_days", interval: Number(event.target.value) })} />
        </Field>
      ) : null}
      {recurrence.type === "weekdays" ? (
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((label, index) => {
            const on = recurrence.weekdays?.includes(index);
            return (
              <button key={label} type="button" aria-pressed={on} className={`min-h-10 rounded-full px-3 text-sm ${on ? "bg-ink text-bg" : "bg-elev"}`} onClick={() => {
                const days = new Set(recurrence.weekdays ?? []);
                if (days.has(index)) days.delete(index); else days.add(index);
                setRecurrence({ type: "weekdays", weekdays: [...days] });
              }}>{label}</button>
            );
          })}
        </div>
      ) : null}
      {recurrence.type === "weekly" || recurrence.type === "biweekly" ? (
        <Field label="Day">
          <select className={controlClass} value={recurrence.weekday ?? 4} onChange={(event) => setRecurrence({ ...recurrence, weekday: Number(event.target.value) })}>
            {WEEKDAYS.map((label, index) => <option key={label} value={index}>{label}</option>)}
          </select>
        </Field>
      ) : null}
      {recurrence.type === "monthly" ? (
        <Field label="Day of month">
          <input className={controlClass} type="number" min={1} max={31} value={recurrence.dayOfMonth ?? 1} onChange={(event) => setRecurrence({ type: "monthly", dayOfMonth: Number(event.target.value) })} />
        </Field>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts">
          <input className={controlClass} type="date" value={anchorDate} onChange={(event) => setAnchorDate(event.target.value)} />
        </Field>
        <Field label="Preferred time">
          <input className={controlClass} type="time" value={preferredTime} onChange={(event) => setPreferredTime(event.target.value)} />
        </Field>
      </div>
      <Field label="When it can happen">
        <select className={controlClass} value={windowName} onChange={(event) => setWindow(event.target.value as ScheduleWindow)}>
          <option value="evening">After my available hours, usually 6 PM</option>
          <option value="day">Daytime</option>
          <option value="anytime">Either, evenings first</option>
        </select>
      </Field>
      {eveningWarning ? <p className="text-sm text-warm">Household tasks usually stay after 6 PM. This time is kept because you chose it.</p> : null}
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>Flexible timing</span>
        <input type="checkbox" checked={flexible} onChange={(event) => setFlexible(event.target.checked)} />
      </label>
      <Field label="Reminder">
        <select className={controlClass} value={reminder} onChange={(event) => setReminder(event.target.value)}>
          <option value="off">Off</option>
          <option value="5">5 minutes before</option>
          <option value="10">10 minutes before</option>
          <option value="15">15 minutes before</option>
          <option value="30">30 minutes before</option>
          <option value="60">1 hour before</option>
        </select>
      </Field>
      <Field label="Notes">
        <textarea className={`${controlClass} min-h-20 py-2`} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      <Field label="Steps, one per line">
        <textarea className={`${controlClass} min-h-24 py-2`} value={steps} onChange={(event) => setSteps(event.target.value)} placeholder={"Collect clothes\nStart the washer"} />
      </Field>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" className="w-full">{initial ? "Save changes" : "Add task"}</Button>
    </form>
  );
}
