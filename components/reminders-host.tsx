"use client";

import { useEffect, useState } from "react";
import { dueReminders, type DueReminder } from "@/lib/reminders";
import { useApp } from "@/lib/store";
import { Button } from "./ui";

const seen = new Set<string>();

export function ReminderHost() {
  const { ready, data, clock, ack, snooze } = useApp();
  const [items, setItems] = useState<DueReminder[]>([]);

  useEffect(() => {
    if (!ready || !data.profile?.notificationsEnabled) return;
    const due = dueReminders(data, clock).filter((item) => !seen.has(item.key));
    if (!due.length) return;
    due.forEach((item) => seen.add(item.key));
    // The minute clock is outside React. Keep the reminder on screen after it is marked sent.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- capture a due reminder when the clock crosses it
    setItems((current) => [...due, ...current].slice(0, 3));
    due.forEach((item) => ack(item.key));
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      due.forEach((item) => {
        try {
          new Notification(item.title, { body: `${item.body}. Quiet hours stay off in the morning.`, icon: "/icons/icon-192.png" });
        } catch {
          /* Some browsers block the constructor without a user gesture. The in-app card still shows. */
        }
      });
    }
  }, [ready, clock, data, ack]);

  if (!items.length) return null;
  const current = items[0];
  return (
    <div className="fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-[65] mx-auto max-w-md rounded-[24px] border border-line bg-elev p-4 shadow-xl md:right-6 md:left-auto">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">Reminder</p>
      <h2 className="serif mt-1 text-2xl">{current.title}</h2>
      <p className="mt-1 text-sm text-muted">{current.body}</p>
      <div className="mt-3 flex gap-2">
        <Button onClick={() => snooze(current.occurrenceId, 15)}>Snooze 15 min</Button>
        <Button variant="quiet" onClick={() => setItems((list) => list.slice(1))}>Dismiss</Button>
      </div>
    </div>
  );
}
