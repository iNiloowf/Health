"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, eachDate, formatLong, formatMedium, formatWeekday, monthStart, startOfWeek, weekday } from "@/lib/dates";
import { useApp } from "@/lib/store";
import type { Occurrence } from "@/lib/types";
import { Icon } from "../icon";
import { TaskDetail } from "../tasks";
import { Segmented } from "../ui";

export function CalendarScreen() {
  const { data, clock, move, complete } = useApp();
  const [mode, setMode] = useState("week");
  const [cursor, setCursor] = useState(clock.today);
  const [selected, setSelected] = useState<string | null>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) setCursor(clock.today);
  }, [clock.today]);
  const weekStart = data.profile?.weekStartsOn ?? 1;
  const days = mode === "day" ? [cursor] : mode === "week" ? eachDate(startOfWeek(cursor, weekStart), addDays(startOfWeek(cursor, weekStart), 6)) : monthGrid(cursor, weekStart);

  const byDate = useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    for (const item of data.occurrences) {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    return map;
  }, [data.occurrences]);

  function shift(direction: number) {
    moved.current = true;
    setCursor(addDays(cursor, mode === "month" ? direction * 30 : mode === "week" ? direction * 7 : direction));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="serif text-3xl leading-none sm:text-4xl">Calendar</h1>
        <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] gap-2 sm:flex sm:items-center">
          <button type="button" className="grid h-11 w-11 place-items-center rounded-full bg-elev" onClick={() => shift(-1)} aria-label="Previous">‹</button>
          <button type="button" className="min-h-11 rounded-full bg-elev px-3 text-sm" onClick={() => { moved.current = true; setCursor(clock.today); }}>Today</button>
          <button type="button" className="grid h-11 w-11 place-items-center rounded-full bg-elev" onClick={() => shift(1)} aria-label="Next">›</button>
        </div>
      </div>
      <Segmented value={mode} options={[{ id: "day", label: "Day" }, { id: "week", label: "Week" }, { id: "month", label: "Month" }]} onChange={setMode} />
      {mode === "month" ? (
        <div className="space-y-1">
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-muted">
            {days.slice(0, 7).map((day) => <span key={`label-${day}`}>{formatWeekday(day, "narrow")}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const items = byDate.get(day) ?? [];
              const inMonth = day.slice(0, 7) === cursor.slice(0, 7);
              return (
                <button key={day} type="button" onClick={() => { moved.current = true; setCursor(day); setMode("day"); }} className={`flex min-h-14 flex-col items-center rounded-2xl px-0.5 py-1 sm:min-h-16 ${day === clock.today ? "bg-accent-soft" : "bg-elev"} ${inMonth ? "" : "opacity-40"}`}>
                  <span className="text-xs">{Number(day.slice(8))}</span>
                  <span className="mt-1 flex h-1.5 justify-center gap-0.5">{items.slice(0, 3).map((item) => <i key={item.id} className={`h-1.5 w-1.5 rounded-full ${dot(item)}`} />)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <>
        {mode === "week" ? (
          <div className="grid grid-cols-7 gap-1 md:hidden">
            {days.map((day) => {
              const count = (byDate.get(day) ?? []).filter((item) => item.status !== "skipped").length;
              const active = day === cursor;
              return (
                <button key={day} type="button" onClick={() => { moved.current = true; setCursor(day); }} className={`flex min-h-16 flex-col items-center justify-center rounded-2xl px-0.5 text-[10px] ${active ? "bg-ink text-bg" : day === clock.today ? "bg-accent-soft text-ink" : "bg-elev text-muted"}`}>
                  <span>{formatWeekday(day, "narrow")}</span>
                  <span className="serif text-base leading-none">{Number(day.slice(8))}</span>
                  <span className={`mt-1 h-1.5 w-1.5 rounded-full ${count ? (active ? "bg-bg" : "bg-accent") : "bg-transparent"}`} />
                </button>
              );
            })}
          </div>
        ) : null}
        <div className={mode === "week" ? "flex flex-col gap-4 md:flex-row md:gap-2 md:overflow-x-auto md:pb-2" : "space-y-2"}>
          {days.map((day) => (
            <section key={day} className={mode === "week" ? `${day === cursor ? "" : "hidden"} md:block md:w-56 md:shrink-0` : ""} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
              const id = event.dataTransfer.getData("text/plain");
              const item = data.occurrences.find((occurrence) => occurrence.id === id);
              if (item) move(id, day, item.time);
            }}>
              <h2 className="mb-2 text-sm text-muted">{mode === "day" ? formatLong(day) : formatMedium(day)}</h2>
              <div className="space-y-2">
                {(byDate.get(day) ?? []).sort((a, b) => a.time.localeCompare(b.time)).map((item) => (
                  <div key={item.id} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", item.id)} className="card flex w-full items-center gap-3 px-3 py-3">
                    <button type="button" aria-label={item.status === "completed" ? `${item.titleSnapshot} completed` : `Complete ${item.titleSnapshot}`} disabled={item.status === "completed" || item.status === "skipped"} onClick={() => complete(item.id)} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 ${item.status === "completed" ? "border-accent bg-accent text-accent-ink" : "border-accent/70 text-accent"}`}>
                      <Icon name="Check" size={16} />
                    </button>
                    <button type="button" onClick={() => setSelected(item.id)} className="min-w-0 flex-1 text-left">
                      <span className={`block break-words text-sm ${item.status === "completed" ? "text-muted line-through" : ""}`}>{item.titleSnapshot}</span>
                    </button>
                  </div>
                ))}
                {data.occurrences.filter((item) => item.rescheduledFrom === day && item.date !== day).map((item) => (
                  <button key={`${item.id}-moved`} type="button" onClick={() => setSelected(item.id)} className="w-full px-2 text-left text-xs text-warm">{item.titleSnapshot} moved</button>
                ))}
                {data.projects.filter((project) => project.deadline === day).map((project) => (
                  <p key={project.id} className="rounded-2xl bg-warm-soft px-3 py-2 text-xs">Deadline · {project.name}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
        </>
      )}
      <TaskDetail key={selected ?? "none"} occurrenceId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function dot(item: Occurrence) {
  if (item.status === "completed") return "bg-accent";
  if (item.status === "missed") return "bg-danger";
  if (item.rescheduledFrom) return "bg-warm";
  if (item.status === "skipped") return "bg-muted";
  return "bg-ink";
}

function monthGrid(cursor: string, weekStartsOn: 0 | 1) {
  const start = startOfWeek(monthStart(cursor), weekStartsOn);
  const dates = eachDate(start, addDays(start, 41));
  while (weekday(dates[dates.length - 1]) !== (weekStartsOn + 6) % 7) dates.pop();
  return dates;
}
