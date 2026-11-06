"use client";

import { useApp } from "@/lib/store";

export function whenDone(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function ActivityLog({ limit, empty }: { limit?: number; empty?: string }) {
  const { data } = useApp();
  const items = [...(data.activity ?? [])].sort((a, b) => b.at.localeCompare(a.at));
  const shown = typeof limit === "number" ? items.slice(0, limit) : items;
  if (!shown.length) return empty ? <p className="text-sm text-muted">{empty}</p> : null;
  return (
    <ul className="space-y-2">
      {shown.map((item) => (
        <li key={item.id} className="card flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="min-w-0"><span className="text-ink">{item.name}</span> did {item.title}</span>
          <time className="shrink-0 text-xs text-muted" dateTime={item.at}>{whenDone(item.at)}</time>
        </li>
      ))}
    </ul>
  );
}
