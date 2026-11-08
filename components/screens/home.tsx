"use client";

import Link from "next/link";
import { useState } from "react";
import { formatLong, formatTime, greeting } from "@/lib/dates";
import { dayProgress } from "@/lib/progress";
import { suggestTonight } from "@/lib/engine";
import { useApp } from "@/lib/store";
import { Icon } from "../icon";
import { TaskDetail, TaskRow } from "../tasks";
import { Button, ProgressRing, Sheet } from "../ui";

export function HomeScreen() {
  const { data, clock } = useApp();
  const [selected, setSelected] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const progress = dayProgress(data, clock.today);
  const open = data.occurrences
    .filter((item) => item.date === clock.today && (item.status === "pending" || item.status === "missed"))
    .sort((a, b) => a.time.localeCompare(b.time));
  const missed = data.occurrences.filter((item) => item.status === "missed").length;
  const plan = suggestTonight(data, clock);
  const allDone = progress.total > 0 && open.length === 0;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">{formatLong(clock.today)}</p>
          <h1 className="serif mt-1 text-[1.7rem] leading-[1.05] sm:text-4xl">{greeting(data.profile?.name || "", clock.minutes)}</h1>
        </div>
        <div className="shrink-0 origin-top scale-90 sm:scale-100">
          <ProgressRing value={progress.percent} label={progress.total ? `${progress.percent}%` : "–"} />
        </div>
      </header>

      {missed ? (
        <div className="card flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">{missed} task{missed === 1 ? "" : "s"} can move to a better time.</p>
          <Button variant="quiet" className="shrink-0" onClick={() => setPlanning(true)}>Reschedule</Button>
        </div>
      ) : null}

      {allDone ? (
        <section className="card p-8 text-center">
          <h2 className="serif text-3xl">All done</h2>
        </section>
      ) : open.length ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-muted">Tonight</h2>
            <button type="button" className="text-sm text-accent" onClick={() => setPlanning(true)}>Plan tonight</button>
          </div>
          {open.map((item) => <TaskRow key={item.id} occurrence={item} onOpen={() => setSelected(item.id)} />)}
        </section>
      ) : (
        <section className="card p-8 text-center">
          <h2 className="serif text-3xl">Nothing tonight</h2>
          <Link href="/tasks" className="mt-3 inline-flex min-h-11 items-center text-sm text-accent">Go to tasks</Link>
        </section>
      )}

      <TaskDetail occurrenceId={selected} onClose={() => setSelected(null)} />
      <PlanSheet open={planning} plan={plan} onClose={() => setPlanning(false)} />
    </div>
  );
}

function PlanSheet({ open, plan, onClose }: { open: boolean; plan: ReturnType<typeof suggestTonight>; onClose: () => void }) {
  const { acceptTonight, data } = useApp();
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const active = plan.filter((item) => picked[item.occurrenceId] !== false);
  return (
    <Sheet open={open} title="Tonight" onClose={onClose}>
      <ul className="space-y-2">
        {plan.map((item) => (
          <li key={item.occurrenceId} className="flex items-center gap-3 rounded-2xl bg-elev px-3 py-3">
            <input type="checkbox" checked={picked[item.occurrenceId] !== false} onChange={(event) => setPicked((current) => ({ ...current, [item.occurrenceId]: event.target.checked }))} aria-label={item.title} />
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
              <Icon name={data.occurrences.find((occurrence) => occurrence.id === item.occurrenceId)?.icon || "Circle"} size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate">{item.title}</p>
              <p className="text-xs text-muted">{formatTime(item.time)} · {item.duration} min · {item.reason}</p>
            </div>
          </li>
        ))}
      </ul>
      {!plan.length ? <p className="mt-4 text-sm text-muted">Nothing needs a new time.</p> : null}
      <Button className="mt-4 w-full" disabled={!active.length} onClick={() => { acceptTonight(active.map((item) => ({ id: item.occurrenceId, time: item.time }))); onClose(); }}>
        Use this plan
      </Button>
    </Sheet>
  );
}
