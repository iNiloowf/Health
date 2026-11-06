"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { AddTaskButton, TaskDetail, TaskRow } from "../tasks";
import { Empty, Segmented } from "../ui";

const FILTERS = [
  { id: "today", label: "Tonight" },
  { id: "upcoming", label: "Upcoming" },
  { id: "catchup", label: "Catch up" },
  { id: "done", label: "Done" },
  { id: "all", label: "All" },
];

export function TasksScreen() {
  const { data, clock } = useApp();
  const [filter, setFilter] = useState("today");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.occurrences
      .filter((item) => {
        if (needle && !item.titleSnapshot.toLowerCase().includes(needle)) return false;
        if (filter === "today") return item.date === clock.today && item.status !== "skipped";
        if (filter === "upcoming") return item.status === "pending" && item.date >= clock.today;
        if (filter === "catchup") return item.status === "missed";
        if (filter === "done") return item.status === "completed";
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  }, [data.occurrences, filter, query, clock.today]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="serif text-4xl">Tasks</h1>
        </div>
        <AddTaskButton />
      </div>
      <input className="min-h-11 w-full rounded-full border border-line bg-elev px-4" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search tasks" />
      <Segmented value={filter} options={FILTERS} onChange={setFilter} />
      <div className="space-y-2">
        {items.map((item) => <TaskRow key={item.id} occurrence={item} onOpen={() => setSelected(item.id)} />)}
      </div>
      {!items.length ? <Empty title="Nothing here" body="" action={<AddTaskButton />} /> : null}
      <TaskDetail key={selected ?? "none"} occurrenceId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
