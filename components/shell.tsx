"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Icon } from "./icon";
import { CelebrationHost, ToastHost } from "./fx";
import { ReminderHost } from "./reminders-host";
import { useApp } from "@/lib/store";

const PRIMARY = [
  { href: "/", label: "Home", icon: "House" },
  { href: "/tasks", label: "Tasks", icon: "ListTodo" },
  { href: "/calendar", label: "Calendar", icon: "CalendarDays" },
  { href: "/progress", label: "Progress", icon: "TrendingUp" },
  { href: "/profile", label: "Profile", icon: "UserRound" },
];

const MORE = [
  { href: "/together", label: "Together", icon: "Heart" },
  { href: "/household", label: "Household", icon: "Sofa" },
  { href: "/habits", label: "Habits", icon: "Repeat" },
  { href: "/pets", label: "Pets", icon: "PawPrint" },
  { href: "/work", label: "Work", icon: "Briefcase" },
  { href: "/achievements", label: "Achievements", icon: "Trophy" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, error, data } = useApp();
  const onboarding = pathname === "/onboarding" || pathname === "/onboarding/edit";

  useEffect(() => {
    const theme = data.profile?.theme ?? window.localStorage.getItem("hearth-theme") ?? "system";
    const dark = theme === "dark" || (theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    if (data.profile) window.localStorage.setItem("hearth-theme", data.profile.theme);
  }, [data.profile]);

  useEffect(() => {
    if (!ready) return;
    if (!data.profile?.onboarded && !onboarding) router.replace("/onboarding");
    if (data.profile?.onboarded && pathname === "/onboarding") router.replace("/");
  }, [ready, data.profile?.onboarded, onboarding, pathname, router]);

  useEffect(() => {
    if (process.env.NODE_ENV === "test") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  const waiting = !ready || Boolean(ready && !data.profile?.onboarded && !onboarding) || Boolean(data.profile?.onboarded && pathname === "/onboarding");
  const frame = onboarding ? (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-4 py-6">{children}</main>
  ) : (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl">
          <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 px-4 py-6 md:flex">
            <Link href="/" className="serif px-3 text-3xl">Hearth</Link>
            <nav className="space-y-1" aria-label="Primary">
              {PRIMARY.map((item) => (
                <NavLink key={item.href} {...item} active={pathname === item.href} />
              ))}
            </nav>
            <nav className="space-y-1" aria-label="More">
              <p className="px-3 pb-1 text-xs uppercase tracking-[0.16em] text-muted">Life</p>
              {MORE.map((item) => (
                <NavLink key={item.href} {...item} active={pathname === item.href} />
              ))}
            </nav>
          </aside>
          <div className="min-w-0 flex-1">
            <main className="safe-bottom mx-auto w-full max-w-3xl px-4 pt-6 md:px-8 md:pb-12">{children}</main>
          </div>
          <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-elev/95 backdrop-blur-xl md:hidden" aria-label="Primary" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            <ul className="mx-auto grid max-w-lg grid-cols-5">
              {PRIMARY.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link href={item.href} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] ${active ? "text-accent" : "text-muted"}`} aria-current={active ? "page" : undefined}>
                      <Icon name={item.icon} size={20} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
    </div>
  );

  return (
    <>
      {error ? (
        <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-6 text-center">
          <div>
            <h1 className="serif text-4xl">Hearth</h1>
            <p className="mt-3 text-sm leading-6 text-muted">{error}</p>
          </div>
        </main>
      ) : null}
      {waiting && !error ? <Boot /> : null}
      <div hidden={waiting || Boolean(error)}>{frame}</div>
      <ReminderHost />
      <CelebrationHost />
      <ToastHost />
    </>
  );
}

function NavLink({ href, label, icon, active }: { href: string; label: string; icon: string; active: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm ${active ? "bg-accent-soft text-ink" : "text-muted"}`}>
      <Icon name={icon} size={18} />
      {label}
    </Link>
  );
}

function Boot() {
  return (
    <main className="grid min-h-dvh place-items-center">
      <div className="text-center">
        <p className="serif text-5xl">Hearth</p>
      </div>
    </main>
  );
}
