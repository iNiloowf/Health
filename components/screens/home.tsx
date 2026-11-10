"use client";

import Link from "next/link";
import { useState } from "react";
import { formatLong, greeting } from "@/lib/dates";
import { choreRank, foldIsWaiting } from "@/lib/model";
import { dayProgress } from "@/lib/progress";
import { useApp } from "@/lib/store";
import { TaskDetail, TaskRow } from "../tasks";
import { ProgressRing } from "../ui";

export function HomeScreen() {
  const { data, clock } = useApp();
  const [selected, setSelected] = useState<string | null>(null);
  const progress = dayProgress(data, clock.today);
  const open = data.occurrences
    .filter((item) => item.date === clock.today && (item.status === "pending" || item.status === "missed") && !foldIsWaiting(data, item))
    .sort((a, b) => choreRank(data, a) - choreRank(data, b) || a.time.localeCompare(b.time));
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

      {allDone ? (
        <section className="card p-8 text-center">
          <h2 className="serif text-3xl">All done</h2>
        </section>
      ) : open.length ? (
        <section className="space-y-2">
          <h2 className="text-sm text-muted">Tonight</h2>
          {open.map((item) => <TaskRow key={item.id} occurrence={item} onOpen={() => setSelected(item.id)} />)}
        </section>
      ) : (
        <section className="card p-8 text-center">
          <h2 className="serif text-3xl">Nothing tonight</h2>
          <Link href="/tasks" className="mt-3 inline-flex min-h-11 items-center text-sm text-accent">Go to tasks</Link>
        </section>
      )}

      <TaskDetail occurrenceId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
