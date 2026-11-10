"use client";

import { useMemo, useState } from "react";
import { addDays, zonedParts } from "@/lib/dates";
import { choreRank, foldIsWaiting } from "@/lib/model";
import { pointsByPerson } from "@/lib/progress";
import { useApp } from "@/lib/store";
import { AddTaskButton, TaskDetail, TaskRow } from "../tasks";
import { Empty, PageHeader, Segmented } from "../ui";

const FILTERS = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "done", label: "Done" },
];

export function TasksScreen() {
  const { data, clock } = useApp();
  const [filter, setFilter] = useState("today");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const scores = useMemo(() => pointsByPerson(data), [data]);
  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const tomorrow = addDays(clock.today, 1);
    const zone = data.profile?.timezone || "UTC";
    return data.occurrences
      .filter((item) => {
        if (needle && !item.titleSnapshot.toLowerCase().includes(needle)) return false;
        if (foldIsWaiting(data, item)) return false;
        if (filter === "today") return item.date === clock.today && item.status !== "completed" && item.status !== "skipped";
        if (filter === "tomorrow") return item.date === tomorrow && item.status !== "completed" && item.status !== "skipped";
        if (item.status !== "completed") return false;
        if (!item.completedAt) return item.date === clock.today;
        return zonedParts(new Date(item.completedAt), zone).dateKey === clock.today;
      })
      .sort((a, b) => choreRank(data, a) - choreRank(data, b) || a.time.localeCompare(b.time) || a.titleSnapshot.localeCompare(b.titleSnapshot));
  }, [data, filter, query, clock.today]);

  return (
    <div className="space-y-4">
      <PageHeader title="Tasks" action={<AddTaskButton />} />
      <input className="min-h-11 w-full rounded-full border border-line bg-elev px-4" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search tasks" />
      <Segmented value={filter} options={FILTERS} onChange={setFilter} />
      {scores.length ? (
        <ul className="grid grid-cols-2 gap-2">
          {scores.map((person) => (
            <li key={person.name} className="card px-4 py-3">
              <p className="truncate text-sm text-muted">{person.name}</p>
              <p className="serif text-2xl">{person.points}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="space-y-2">
        {items.map((item) => <TaskRow key={item.id} occurrence={item} onOpen={() => setSelected(item.id)} />)}
      </div>
      {!items.length ? <Empty title={filter === "done" ? "Nothing finished today" : filter === "tomorrow" ? "Nothing tomorrow" : "Nothing today"} body="" action={filter === "done" ? undefined : <AddTaskButton />} /> : null}
      <TaskDetail key={selected ?? "none"} occurrenceId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
