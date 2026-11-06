"use client";

import Link from "next/link";
import { useState } from "react";
import { readImageFile } from "@/lib/images";
import { useApp } from "@/lib/store";
import type { Profile } from "@/lib/types";
import { Button, controlClass, Field } from "../ui";

export function ProfileScreen() {
  const { data, saveProfile, exportBackup, importBackup, resetAll, cloud, signIn, signUp, signOut, addCategory, removeCategory, accountName, createAccount, enterAccount, leaveAccount } = useApp();
  const profile = data.profile;
  if (!profile) return null;
  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <Avatar profile={profile} onChange={(avatar) => saveProfile({ avatar })} />
        <div className="min-w-0">
          <h1 className="serif break-words text-3xl leading-none sm:text-4xl">{profile.name || "Your profile"}</h1>
          <p className="mt-1 truncate text-sm text-muted">{profile.timezone}</p>
        </div>
      </header>
      <section className="card space-y-3 p-4">
        <Field label="Name"><input className={controlClass} defaultValue={profile.name} onBlur={(event) => saveProfile({ name: event.target.value })} /></Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
          <Field label="Wake"><input className={controlClass} type="time" defaultValue={profile.wake} onBlur={(event) => saveProfile({ wake: event.target.value })} /></Field>
          <Field label="Sleep"><input className={controlClass} type="time" defaultValue={profile.sleep} onBlur={(event) => saveProfile({ sleep: event.target.value })} /></Field>
          <Field label="Available from"><input className={controlClass} type="time" defaultValue={profile.availabilityStart} onBlur={(event) => saveProfile({ availabilityStart: event.target.value })} /></Field>
          <Field label="Available until"><input className={controlClass} type="time" defaultValue={profile.availabilityEnd} onBlur={(event) => saveProfile({ availabilityEnd: event.target.value })} /></Field>
          <Field label="Work from"><input className={controlClass} type="time" defaultValue={profile.workStart} onBlur={(event) => saveProfile({ workStart: event.target.value })} /></Field>
          <Field label="Work until"><input className={controlClass} type="time" defaultValue={profile.workEnd} onBlur={(event) => saveProfile({ workEnd: event.target.value })} /></Field>
          <Field label="Quiet from"><input className={controlClass} type="time" defaultValue={profile.quietStart} onBlur={(event) => saveProfile({ quietStart: event.target.value })} /></Field>
          <Field label="Quiet until"><input className={controlClass} type="time" defaultValue={profile.quietEnd} onBlur={(event) => saveProfile({ quietEnd: event.target.value })} /></Field>
        </div>
        <Field label="Week starts">
          <select className={controlClass} value={profile.weekStartsOn} onChange={(event) => saveProfile({ weekStartsOn: Number(event.target.value) as 0 | 1 })}>
            <option value={1}>Monday</option>
            <option value={0}>Sunday</option>
          </select>
        </Field>
        <TimeZone value={profile.timezone} onChange={(timezone) => saveProfile({ timezone })} />
        <Link href="/onboarding/edit" className="inline-flex min-h-11 items-center text-sm text-accent">Edit onboarding answers</Link>
      </section>
      <section className="card space-y-3 p-4">
        <h2 className="serif text-2xl">Appearance</h2>
        <Field label="Theme">
          <select className={controlClass} value={profile.theme} onChange={(event) => saveProfile({ theme: event.target.value as Profile["theme"] })}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </Field>
        <Field label="Animation">
          <select className={controlClass} value={profile.animation} onChange={(event) => saveProfile({ animation: event.target.value as Profile["animation"] })}>
            <option value="subtle">Subtle</option>
            <option value="normal">Normal</option>
            <option value="rich">Rich</option>
          </select>
        </Field>
        <label className="flex items-center justify-between text-sm"><span>Reduced motion</span><input type="checkbox" checked={profile.reducedMotion} onChange={(event) => saveProfile({ reducedMotion: event.target.checked })} /></label>
        <label className="flex items-center justify-between text-sm"><span>Show XP</span><input type="checkbox" checked={profile.showXp} onChange={(event) => saveProfile({ showXp: event.target.checked })} /></label>
        <Field label="Streak recoveries each week">
          <input className={controlClass} type="number" min={0} max={3} value={profile.streakFreezes} onChange={(event) => saveProfile({ streakFreezes: Number(event.target.value), freezesLeft: Number(event.target.value) })} />
        </Field>
      </section>
      <section className="card space-y-3 p-4">
        <h2 className="serif text-2xl">Account</h2>
        <p className="text-sm leading-6 text-muted">Sign in on another phone and the questions stay answered.</p>
        {accountName ? <p className="text-sm">Signed in as {accountName}</p> : <AccountForm onIn={enterAccount} onUp={createAccount} />}
        {accountName ? <Button variant="quiet" onClick={() => void leaveAccount()}>Sign out</Button> : null}
      </section>
      <Notifications profile={profile} onChange={saveProfile} />
      <Categories dataCategories={data.categories} onAdd={addCategory} onRemove={removeCategory} />
      <section className="card space-y-3 p-4">
        <h2 className="serif text-2xl">Your data</h2>
        {cloud.email ? <p className="text-sm">Signed in as {cloud.email}</p> : null}
        {cloud.error ? <p className="text-sm text-danger">{cloud.error}</p> : null}
        {cloud.configured && !cloud.email ? <Auth onIn={signIn} onUp={signUp} /> : null}
        {cloud.email ? <Button variant="quiet" onClick={() => void signOut()}>Sign out</Button> : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="quiet" onClick={exportBackup}>Export</Button>
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full bg-accent-soft px-4 text-sm">
            Import
            <input className="sr-only" type="file" accept="application/json" onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) importBackup(await file.text());
            }} />
          </label>
        </div>
        <Reset onReset={resetAll} />
      </section>
    </div>
  );
}

function Avatar({ profile, onChange }: { profile: Profile; onChange: (avatar: string) => void }) {
  return (
    <label className="grid h-16 w-16 cursor-pointer place-items-center overflow-hidden rounded-full bg-accent-soft text-xl">
      {profile.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
      ) : (profile.name || "H").slice(0, 1)}
      <input className="sr-only" type="file" accept="image/*" onChange={async (event) => {
        const file = event.target.files?.[0];
        if (file) onChange(await readImageFile(file, 480));
      }} />
    </label>
  );
}

function TimeZone({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const zones = typeof Intl !== "undefined" && "supportedValuesOf" in Intl ? Intl.supportedValuesOf("timeZone") : [value];
  return (
    <Field label="Time zone">
      <input className={controlClass} list="zones" value={value} onChange={(event) => onChange(event.target.value)} />
      <datalist id="zones">{zones.map((zone) => <option key={zone} value={zone} />)}</datalist>
    </Field>
  );
}

function Notifications({ profile, onChange }: { profile: Profile; onChange: (patch: Partial<Profile>) => void }) {
  const [message, setMessage] = useState("");
  return (
    <section className="card space-y-3 p-4">
      <h2 className="serif text-2xl">Reminders</h2>
      <Field label="Style">
        <select className={controlClass} value={profile.reminderStyle} onChange={(event) => onChange({ reminderStyle: event.target.value as Profile["reminderStyle"] })}>
          <option value="gentle">Gentle</option>
          <option value="standard">Standard</option>
          <option value="minimal">Minimal</option>
        </select>
      </Field>
      <Button onClick={async () => {
        if (!("Notification" in window)) {
          setMessage("This browser does not offer notifications. In-app reminders still work.");
          return;
        }
        const permission = await Notification.requestPermission();
        onChange({ notificationsEnabled: permission === "granted" });
        setMessage(permission === "granted" ? "Notifications are on for this device." : "Permission was not granted. In-app reminders still work.");
      }}>{profile.notificationsEnabled ? "Notifications on" : "Turn on notifications"}</Button>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </section>
  );
}

function Categories({ dataCategories, onAdd, onRemove }: { dataCategories: { id: string; name: string; builtIn: boolean; area: Profile["theme"] extends never ? never : import("@/lib/types").Category["area"] }[]; onAdd: (input: { name: string; icon: string; area: import("@/lib/types").Category["area"] }) => void; onRemove: (id: string) => void }) {
  const [name, setName] = useState("");
  const [area, setArea] = useState<import("@/lib/types").Area>("household");
  return (
    <section className="card space-y-3 p-4">
      <h2 className="serif text-2xl">Categories</h2>
      <ul className="space-y-2 text-sm">
        {dataCategories.map((category) => (
          <li key={category.id} className="flex items-center justify-between">
            <span>{category.name}</span>
            {category.builtIn ? null : <button type="button" className="text-danger" onClick={() => onRemove(category.id)}>Remove</button>}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className={controlClass} placeholder="New category" value={name} onChange={(event) => setName(event.target.value)} />
        <select className={`${controlClass} sm:max-w-40`} value={area} onChange={(event) => setArea(event.target.value as import("@/lib/types").Area)}>
          <option value="household">Household</option>
          <option value="habit">Habit</option>
          <option value="health">Health</option>
          <option value="personal">Personal</option>
          <option value="work">Work</option>
        </select>
      </div>
      <Button variant="quiet" onClick={() => { onAdd({ name, icon: "Circle", area }); setName(""); }}>Add category</Button>
    </section>
  );
}

function AccountForm({ onIn, onUp }: { onIn: (name: string, password: string) => Promise<void>; onUp: (name: string, password: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  return (
    <form className="space-y-2" onSubmit={async (event) => {
      event.preventDefault();
      try {
        await onIn(name, password);
      } catch (err) {
        setNote(err instanceof Error ? err.message : "Could not sign in.");
      }
    }}>
      <input className={controlClass} required placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
      <input className={controlClass} type="password" required minLength={6} placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
      <div className="flex gap-2">
        <Button type="submit">Sign in</Button>
        <Button type="button" variant="quiet" onClick={async () => {
          try {
            await onUp(name, password);
            setNote("Account ready. Sign in with this name on another phone.");
          } catch (err) {
            setNote(err instanceof Error ? err.message : "Could not create the account.");
          }
        }}>Create account</Button>
      </div>
      {note ? <p className="text-sm text-muted">{note}</p> : null}
    </form>
  );
}

function Auth({ onIn, onUp }: { onIn: (email: string, password: string) => Promise<void>; onUp: (email: string, password: string) => Promise<string> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  return (
    <form className="space-y-2" onSubmit={async (event) => { event.preventDefault(); await onIn(email, password); }}>
      <input className={controlClass} type="email" required placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
      <input className={controlClass} type="password" required minLength={6} placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit">Sign in</Button>
        <Button type="button" variant="quiet" onClick={async () => setNote(await onUp(email, password))}>Create account</Button>
      </div>
      {note ? <p className="text-sm text-muted">{note}</p> : null}
    </form>
  );
}

function Reset({ onReset }: { onReset: () => void }) {
  const [armed, setArmed] = useState(false);
  return armed ? <Button variant="danger" onClick={onReset}>Clear everything on this device</Button> : <Button variant="danger" onClick={() => setArmed(true)}>Reset local data</Button>;
}
