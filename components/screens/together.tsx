"use client";

import { useEffect, useState } from "react";
import { pullHome } from "@/lib/share-client";
import type { SharedHome } from "@/lib/share";
import { useApp } from "@/lib/store";
import { TaskDetail, TaskRow } from "../tasks";
import { Button } from "../ui";

export function TogetherScreen() {
  const { data, clock, openShare, joinShare, leaveShare, saveProfile } = useApp();
  const share = data.profile?.share ?? null;
  const [code, setCode] = useState("");
  const [name, setName] = useState(data.profile?.name ?? "");
  const [remote, setRemote] = useState<SharedHome | null>(null);
  const home = share ? remote : null;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const code = share?.code;
    if (!code) return;
    let stop = false;
    const tick = () => {
      void pullHome(code).then((next) => {
        if (!stop) setRemote(next);
      }).catch(() => undefined);
    };
    const start = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 2000);
    return () => {
      stop = true;
      window.clearTimeout(start);
      window.clearInterval(timer);
    };
  }, [share?.code]);

  const today = data.occurrences
    .filter((item) => item.area === "household" && item.date === clock.today && item.status !== "skipped")
    .sort((a, b) => a.time.localeCompare(b.time));

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="serif text-4xl">Together</h1>
      {share && home ? (
        <>
          <button
            type="button"
            className="card w-full px-5 py-6 text-center"
            onClick={() => void navigator.clipboard?.writeText(home.code)}
          >
            <p className="text-xs text-muted">Our code</p>
            <p className="serif mt-1 text-5xl tracking-wide">{home.code}</p>
          </button>
          <div className="flex flex-wrap gap-2">
            {home.members.map((member) => (
              <span key={member.id} className="rounded-full bg-accent-soft px-3 py-2 text-sm">{member.name}</span>
            ))}
          </div>
          <div className="space-y-2">
            {today.map((item) => <TaskRow key={item.id} occurrence={item} onOpen={() => setSelected(item.id)} />)}
          </div>
          <Button variant="quiet" disabled={busy} onClick={() => void run(leaveShare)}>Leave</Button>
        </>
      ) : (
        <div className="space-y-3">
          <input className="min-h-12 w-full rounded-full border border-line bg-elev px-4" value={name} placeholder="Your name" onChange={(event) => setName(event.target.value)} />
          <Button className="w-full" disabled={busy} onClick={() => void run(async () => {
            if (name.trim()) saveProfile({ name: name.trim() });
            await openShare();
          })}>Make our code</Button>
          <div className="flex gap-2">
            <input className="min-h-12 flex-1 rounded-full border border-line bg-elev px-4" value={code} placeholder="Code" onChange={(event) => setCode(event.target.value)} />
            <Button disabled={busy || code.trim().length < 4} onClick={() => void run(() => joinShare(code, name))}>Join</Button>
          </div>
        </div>
      )}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <TaskDetail occurrenceId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
