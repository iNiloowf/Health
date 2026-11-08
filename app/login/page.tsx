"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui";

export default function LoginPage() {
  const { createAccount, enterAccount, joinShare } = useApp();
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
    <div className="flex min-h-[calc(100dvh-1.5rem)] flex-col">
      <p className="serif text-2xl text-ink">Hearth</p>
      <h1 className="serif mt-6 text-4xl leading-none">Sign in</h1>
      <form className="mt-6 space-y-3" onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          await enterAccount(name, password);
          router.replace("/");
        });
      }}>
        <input className="min-h-12 w-full rounded-full border border-line bg-elev px-4" required placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <input className="min-h-12 w-full rounded-full border border-line bg-elev px-4" required minLength={6} type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <div className="flex gap-2">
          <Button className="flex-1" type="submit" disabled={busy}>Sign in</Button>
          <Button type="button" variant="quiet" disabled={busy} onClick={() => void run(async () => {
            await createAccount(name, password);
            router.replace("/onboarding");
          })}>Create</Button>
        </div>
      </form>
      <form className="mt-8 space-y-3" onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          try {
            await enterAccount(name, password);
          } catch (err) {
            const message = err instanceof Error ? err.message : "";
            if (message !== "No account with that name.") throw err;
            await createAccount(name, password);
          }
          const result = await joinShare(code, name);
          router.replace(result === "questions" ? "/onboarding" : "/");
        });
      }}>
        <h2 className="serif text-2xl">Join</h2>
        <input className="min-h-12 w-full rounded-full border border-line bg-elev px-4" required placeholder="Their code" value={code} onChange={(event) => setCode(event.target.value)} />
        <Button className="w-full" type="submit" disabled={busy || code.trim().length < 4}>Join</Button>
      </form>
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
