"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { pullHome } from "@/lib/share-client";
import type { SharedHome } from "@/lib/share";
import { useApp } from "@/lib/store";
import { Button, PageHeader } from "../ui";

function Nickname({ current, onSave }: { current: string; onSave: (name: string) => void }) {
  const [value, setValue] = useState(current);
  useEffect(() => setValue(current), [current]);
  const next = value.trim();
  return (
    <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); if (next && next !== current) onSave(next); }}>
      <label className="block text-sm text-muted">
        Your nickname
        <input className="mt-1 min-h-12 w-full rounded-full border border-line bg-elev px-4 text-ink" value={value} onChange={(event) => setValue(event.target.value)} />
      </label>
      <Button className="w-full" type="submit" disabled={!next || next === current}>Save nickname</Button>
    </form>
  );
}

export function TogetherScreen() {
  const { data, openShare, joinShare, leaveShare, saveProfile } = useApp();
  const router = useRouter();
  const share = data.profile?.share ?? null;
  const [code, setCode] = useState("");
  const [name, setName] = useState(data.profile?.name ?? "");
  const [remote, setRemote] = useState<SharedHome | null>(null);
  const home = share ? remote : null;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const shared = share?.code;
    if (!shared) return;
    let stop = false;
    const tick = () => {
      void pullHome(shared).then((next) => {
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
      <PageHeader title="Together" />
      {share && home ? (
        <div className="space-y-4">
          <button
            type="button"
            className="card w-full px-5 py-8 text-center"
            onClick={() => {
              void navigator.clipboard?.writeText(home.code).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            <p className="serif break-all text-5xl tracking-wide">{home.code}</p>
            <p className="mt-3 text-sm text-muted">{copied ? "Copied" : "Tap to copy"}</p>
          </button>
          <div className="flex flex-wrap justify-center gap-2">
            {home.members.map((member) => (
              <span key={member.id} className="rounded-full bg-accent-soft px-3 py-2 text-sm">{member.id === share.memberId ? data.profile?.name || member.name : member.name}</span>
            ))}
          </div>
          <Nickname current={data.profile?.name ?? ""} onSave={(next) => saveProfile({ name: next })} />
          <Button variant="quiet" className="w-full" disabled={busy} onClick={() => void run(leaveShare)}>Leave</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <input className="min-h-12 w-full rounded-full border border-line bg-elev px-4" value={name} placeholder="Your name" onChange={(event) => setName(event.target.value)} />
          <Button className="w-full" disabled={busy} onClick={() => void run(async () => {
            if (name.trim()) saveProfile({ name: name.trim() });
            await openShare();
          })}>Make our code</Button>
          <div className="flex gap-2">
            <input className="min-h-12 min-w-0 flex-1 rounded-full border border-line bg-elev px-4" value={code} placeholder="Their code" onChange={(event) => setCode(event.target.value)} />
            <Button className="shrink-0" disabled={busy || code.trim().length < 4} onClick={() => void run(async () => {
              const result = await joinShare(code, name);
              if (result === "questions") router.push("/onboarding");
            })}>Join</Button>
          </div>
        </div>
      )}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
