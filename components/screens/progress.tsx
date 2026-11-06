"use client";

import { formatWeekday, monthStart, startOfWeek } from "@/lib/dates";
import { dayStreak } from "@/lib/model";
import { buildInsights, categoryBreakdown, monthSeries, postponedTasks, rangePercent, routineSuggestions, totalXp, weekSeries } from "@/lib/progress";
import { LEVELS } from "@/lib/templates";
import { useApp } from "@/lib/store";
import { Button, PageHeader } from "../ui";

export function ProgressScreen() {
  const { data, clock, level, preferTime } = useApp();
  const week = weekSeries(data, clock.today);
  const month = monthSeries(data, clock.today);
  const insights = buildInsights(data, clock.today);
  const categories = categoryBreakdown(data);
  const postponed = postponedTasks(data);
  const routines = routineSuggestions(data);
  const maxWeek = Math.max(1, ...week.map((day) => day.done));
  const daily = rangePercent(data, clock.today, clock.today);
  const weekly = rangePercent(data, startOfWeek(clock.today, data.profile?.weekStartsOn ?? 1), clock.today);
  const monthly = rangePercent(data, monthStart(clock.today), clock.today);
  const rhythm = dayStreak(data.occurrences, clock.today);
  const xp = totalXp(data);

  return (
    <div className="space-y-6">
      <PageHeader title="Progress" />
      <section className="grid grid-cols-3 gap-2">
        <Tile label="Today" value={`${daily.percent}%`} />
        <Tile label="This week" value={`${weekly.percent}%`} />
        <Tile label="This month" value={`${monthly.percent}%`} />
      </section>
      <section className="card p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Level {level.level}</p>
            <h2 className="serif text-3xl">{level.title}</h2>
            <p className="mt-1 text-sm text-muted">{rhythm.current} day rhythm</p>
          </div>
          <p className="text-sm text-warm">{xp} XP</p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (level.into / level.span) * 100)}%` }} />
        </div>
        <ol className="mt-4 space-y-2">
          {LEVELS.map((item) => (
            <li key={item.level} className="flex items-center justify-between text-sm">
              <span className={xp >= item.xp ? "" : "text-muted"}>{item.level}. {item.title}</span>
              <span className="text-muted">{item.xp} XP</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="grid grid-cols-2 gap-2">
        <Tile label="Tasks completed" value={String(data.occurrences.filter((item) => item.status === "completed").length)} />
        <Tile label="Longest rhythm" value={`${rhythm.longest} days`} />
      </section>
      <Chart title="This week" bars={week.map((day) => ({ label: formatWeekday(day.date, "narrow"), value: day.done, max: maxWeek }))} />
      <Chart title="Recent weeks" bars={month.map((item) => ({ label: item.start.slice(5), value: item.percent, max: 100 }))} />
      <section className="space-y-2">
        {insights.map((insight) => <p key={insight.id} className="card px-4 py-3 text-sm leading-6">{insight.text}</p>)}
      </section>
      {routines.map((routine) => (
        <div key={routine.taskId} className="card flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">You often finish {routine.title} around {routine.time}.</p>
          <Button variant="quiet" className="shrink-0" onClick={() => preferTime(routine.taskId, routine.time)}>Use it</Button>
        </div>
      ))}
      {categories.length ? (
        <section>
          <h2 className="mb-2 text-sm text-muted">By category</h2>
          <ul className="space-y-2">
            {categories.map((item) => (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <span>{item.name}</span><span className="text-muted">{item.count}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {postponed.length ? (
        <section>
          <h2 className="mb-2 text-sm text-muted">Often moved</h2>
          {postponed.map((item) => <p key={item.taskId} className="text-sm text-muted">{item.title} · {item.count} times</p>)}
        </section>
      ) : null}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return <div className="card min-w-0 px-3 py-4"><div className="serif text-2xl leading-none sm:text-3xl">{value}</div><div className="mt-1 text-xs text-muted">{label}</div></div>;
}

function Chart({ title, bars }: { title: string; bars: Array<{ label: string; value: number; max: number }> }) {
  return (
    <section>
      <h2 className="mb-3 text-sm text-muted">{title}</h2>
      <div className="flex h-32 items-end gap-2">
        {bars.map((bar, index) => (
          <div key={`${bar.label}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex h-24 w-full items-end rounded-full bg-elev">
              <div className="w-full rounded-full bg-accent" style={{ height: `${Math.max(6, (bar.value / bar.max) * 100)}%` }} />
            </div>
            <span className="w-full truncate text-center text-[10px] text-muted">{bar.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
