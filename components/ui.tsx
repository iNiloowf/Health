"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useApp } from "@/lib/store";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function useCalm() {
  const system = useReducedMotion();
  const { data } = useApp();
  return Boolean(system || data.profile?.reducedMotion || data.profile?.animation === "subtle");
}

export function Button({
  children,
  variant = "primary",
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "quiet" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-accent text-accent-ink shadow-sm",
    quiet: "bg-accent-soft text-ink",
    ghost: "bg-transparent text-ink",
    danger: "bg-danger/10 text-danger",
  }[variant];
  return (
    <button
      type={type}
      className={cx("inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition active:scale-[0.98] disabled:opacity-50", styles, className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

export const controlClass = "min-h-11 w-full rounded-3xl border border-line bg-bg/70 px-3 outline-none";

export function ProgressRing({ value, size = 92, label }: { value: number; size?: number; label?: string }) {
  const calm = useCalm();
  const radius = 38;
  const length = 2 * Math.PI * radius;
  const offset = length - (Math.max(0, Math.min(100, value)) / 100) * length;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--line)" strokeWidth="8" />
        <motion.circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={offset}
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={calm ? { duration: 0 } : { type: "spring", stiffness: 80, damping: 18 }}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="absolute text-center">
        <div className="serif text-xl leading-none">{label ?? `${Math.round(value)}%`}</div>
      </div>
    </div>
  );
}

export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const calm = useCalm();
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50">
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-ink/30"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className="absolute inset-x-0 bottom-0 max-h-[min(92dvh,860px)] overflow-y-auto rounded-t-[28px] border border-line bg-bg p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl md:inset-auto md:left-1/2 md:top-1/2 md:w-[min(560px,calc(100%-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[28px]"
            initial={calm ? { opacity: 0 } : { y: 40, opacity: 0 }}
            animate={calm ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={calm ? { opacity: 0 } : { y: 24, opacity: 0 }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="serif text-2xl">{title}</h2>
              <button type="button" className="grid h-10 w-10 place-items-center rounded-full bg-elev" onClick={onClose} aria-label="Close dialog">
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card px-5 py-8 text-center">
      <h3 className="serif text-2xl">{title}</h3>
      {body ? <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Segmented({ value, options, onChange }: { value: string; options: Array<{ id: string; label: string }>; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-full bg-elev p-1" role="tablist">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={value === option.id}
          onClick={() => onChange(option.id)}
          className={cx("min-h-10 shrink-0 rounded-full px-3 text-sm", value === option.id ? "bg-ink text-bg" : "text-muted")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
