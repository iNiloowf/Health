"use client";

import Link from "next/link";
import { useState } from "react";
import { formatLong, formatMedium, formatTime, formatWeekday, greeting } from "@/lib/dates";
import { dayStreak } from "@/lib/model";
import { dayProgress, totalXp, weekSeries } from "@/lib/progress";
import { suggestTonight } from "@/lib/engine";
import { useApp } from "@/lib/store";
import { Icon } from "../icon";
import { TaskDetail, TaskRow } from "../tasks";
import { upcomingReminders } from "@/lib/reminders";
import { Button, ProgressRing, Sheet } from "../ui";

export function HomeScreen() {
  const { data, clock, level } = useApp();
  const [selected, setSelected] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const progress = dayProgress(data, clock.today);
  const today = data.occurrences.filter((item) => item.date === clock.today && item.status !== "skipped").sort((a, b) => a.time.localeCompare(b.time));
  const next = today.find((item) => item.status === "pending" || item.status === "missed") ?? data.occurrences.find((item) => item.status === "pending" && item.date > clock.today);
  const missed = data.occurrences.filter((item) => item.status === "missed").length;
  const done = progress.done;
  const left = today.filter((item) => item.status === "pending" || item.status === "missed").length;
  const week = weekSeries(data, clock.today);
  const reminders = upcomingReminders(data, clock);
  const plan = suggestTonight(data, clock);
  const showXp = data.profile?.showXp !== false;
  const allDone = progress.total > 0 && progress.percent === 100;

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

      <section className="grid grid-cols-3 gap-2 text-center text-sm">
        <Stat label="Done" value={String(done)} />
        <Stat label="Left" value={String(left)} />
        <Stat label={showXp ? "XP" : "Level"} value={showXp ? String(totalXp(data)) : String(level.level)} />
      </section>

      <section className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
        <p className="flex items-center gap-2 text-muted"><Icon name="Flame" size={16} /> {dayStreak(data.occurrences, clock.today).current} day rhythm</p>
        <p className="text-muted">{level.title}</p>
      </section>

      {missed ? (
        <div className="card flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">{missed} task{missed === 1 ? "" : "s"} can move to a better time.</p>
          <Button variant="quiet" className="shrink-0" onClick={() => setPlanning(true)}>Reschedule</Button>
        </div>
      ) : null}

      {allDone ? (
        <section className="card p-6 text-center">
          <h2 className="serif text-3xl sm:text-4xl">All done</h2>
        </section>
      ) : next ? (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm text-muted">Next up</h2>
            <button type="button" className="text-sm text-accent" onClick={() => setPlanning(true)}>Plan tonight</button>
          </div>
          <TaskRow occurrence={next} onOpen={() => setSelected(next.id)} />
        </section>
      ) : (
        <section className="card p-5">
          <h2 className="serif text-2xl">Nothing tonight</h2>
          <Link href="/tasks" className="mt-3 inline-flex min-h-11 items-center text-sm text-accent">Go to tasks</Link>
        </section>
      )}

      {today.length ? (
        <section className="space-y-2">
          <h2 className="text-sm text-muted">Tonight</h2>
          {today.slice(0, 5).map((item) => <TaskRow key={item.id} occurrence={item} onOpen={() => setSelected(item.id)} />)}
          {today.length > 5 ? <Link href="/tasks" className="block py-2 text-sm text-accent">See all {today.length}</Link> : null}
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm text-muted">This week</h2>
        <div className="grid grid-cols-7 gap-1">
          {week.map((day) => (
            <div key={day.date} className="min-w-0 text-center">
              <div className={`mx-auto grid aspect-square w-full max-w-10 place-items-center rounded-full text-[11px] sm:text-xs ${day.date === clock.today ? "bg-ink text-bg" : day.total && day.done === day.total ? "bg-accent-soft" : "bg-elev"}`}>
                {day.total ? Math.round((day.done / day.total) * 100) : "·"}
              </div>
              <p className="mt-1 truncate text-[10px] text-muted sm:text-[11px]">{formatWeekday(day.date, "narrow")}</p>
            </div>
          ))}
        </div>
      </section>

      {reminders.length ? (
        <section className="space-y-2">
          <h2 className="text-sm text-muted">Upcoming reminders</h2>
          {reminders.map((item) => (
            <button key={item.id} type="button" onClick={() => setSelected(item.id)} className="card flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm">
              <span className="min-w-0 truncate">{item.titleSnapshot}</span>
              <span className="shrink-0 text-muted">{item.date === clock.today ? formatTime(item.time) : formatMedium(item.date)}</span>
            </button>
          ))}
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-2">
        {[
          ["/together", "Together", "Heart"],
          ["/household", "Household", "Sofa"],
          ["/habits", "Habits", "Repeat"],
          ["/pets", "Pets", "PawPrint"],
          ["/work", "Work", "Briefcase"],
          ["/achievements", "Awards", "Trophy"],
          ["/progress", "Insights", "TrendingUp"],
        ].map(([href, label, icon]) => (
          <Link key={href} href={href} className="card flex min-h-16 items-center gap-3 px-4 text-sm last:col-span-2">
            <Icon name={icon} size={18} /> {label}
          </Link>
        ))}
      </section>

      <TaskDetail occurrenceId={selected} onClose={() => setSelected(null)} />
      <PlanSheet open={planning} plan={plan} onClose={() => setPlanning(false)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card min-w-0 px-2 py-3">
      <div className="serif truncate text-xl sm:text-2xl">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function PlanSheet({ open, plan, onClose }: { open: boolean; plan: ReturnType<typeof suggestTonight>; onClose: () => void }) {
  const { acceptTonight } = useApp();
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const active = plan.filter((item) => picked[item.occurrenceId] !== false);
  return (
    <Sheet open={open} title="Tonight" onClose={onClose}>
      <ul className="space-y-2">
        {plan.map((item) => (
          <li key={item.occurrenceId} className="flex items-center gap-3 rounded-2xl bg-elev px-3 py-3">
            <input type="checkbox" checked={picked[item.occurrenceId] !== false} onChange={(event) => setPicked((current) => ({ ...current, [item.occurrenceId]: event.target.checked }))} aria-label={item.title} />
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
