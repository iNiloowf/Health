"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { achievementName } from "@/lib/progress";
import { useApp } from "@/lib/store";
import type { Effect } from "@/lib/types";
import { useCalm } from "./ui";

export function CelebrationHost() {
  const { celebrations, dismissCelebration, data } = useApp();
  const calm = useCalm();
  const current = celebrations[0];
  useEffect(() => {
    if (current && calm) dismissCelebration(current.id);
  }, [current, calm, dismissCelebration]);
  if (!current || calm) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {current.type === "xp" ? <Burst effect={current.effect ?? "glow"} rich={data.profile?.animation === "rich"} amount={current.amount ?? 0} onDone={() => dismissCelebration(current.id)} /> : null}
      {current.type === "done" ? <Confetti onDone={() => dismissCelebration(current.id)} /> : null}
      {current.type === "level" || current.type === "achievement" ? (
        <motion.div className="pointer-events-auto absolute inset-0 grid place-items-center bg-ink/35 p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {current.type === "level" ? <Confetti onDone={() => undefined} /> : null}
          <div className="card w-full max-w-sm p-6 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">{current.type === "level" ? "Level up" : "Achievement"}</p>
            <h3 className="serif mt-2 break-words text-3xl leading-tight sm:text-4xl">{current.type === "level" ? current.title : achievementName(current.achievementId || "")}</h3>
            <p className="mt-2 text-sm text-muted">{current.type === "level" ? `You reached level ${current.level}.` : "A quiet milestone, saved."}</p>
            <button type="button" className="mt-5 min-h-11 rounded-full bg-accent px-5 text-sm text-accent-ink" onClick={() => dismissCelebration(current.id)}>
              Continue
            </button>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}

function Burst({ effect, rich, amount, onDone }: { effect: Effect; rich: boolean; amount: number; onDone: () => void }) {
  const count = rich ? 16 : 9;
  const color = effect === "bubbles" ? "var(--accent)" : effect === "pet" ? "var(--warm)" : effect === "fold" ? "var(--muted)" : "var(--warm)";
  return (
    <div className="absolute left-1/2 top-24 -translate-x-1/2">
      <motion.div className="serif text-center text-3xl text-accent" initial={{ y: 8, opacity: 0 }} animate={{ y: -20, opacity: [0, 1, 0] }} transition={{ duration: 1.1 }} onAnimationComplete={onDone}>
        +{amount} XP
      </motion.div>
      {Array.from({ length: count }, (_, index) => (
        <motion.span
          key={index}
          className="absolute left-1/2 top-4 block"
          style={{ width: effect === "fold" ? 18 : 8, height: effect === "bubbles" ? 8 : 8, borderRadius: 99, background: color }}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{ x: Math.cos((index / count) * Math.PI * 2) * (40 + (index % 4) * 12), y: Math.sin((index / count) * Math.PI * 2) * 36 - 10, opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

function Confetti({ onDone }: { onDone: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 28 }, (_, index) => (
        <motion.span
          key={index}
          className="absolute top-0 block h-2 w-3 rounded-sm"
          style={{ left: `${(index * 37) % 100}%`, background: index % 2 ? "var(--accent)" : "var(--warm)" }}
          initial={{ y: -20, rotate: 0, opacity: 1 }}
          animate={{ y: 680, rotate: 180 + index * 12, opacity: 0 }}
          transition={{ duration: 1.3 + (index % 5) * 0.08, ease: "easeIn" }}
          onAnimationComplete={index === 0 ? onDone : undefined}
        />
      ))}
    </div>
  );
}

export function ToastHost() {
  const { toast, canUndo, undo, clearToast } = useApp();
  const clearRef = useRef(clearToast);
  clearRef.current = clearToast;
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => clearRef.current(), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);
  return (
    <AnimatePresence>
      {toast ? (
        <motion.div
          role="status"
          className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-1/2 z-[70] flex max-w-[calc(100%-2rem)] min-h-12 -translate-x-1/2 items-center gap-3 rounded-full border border-line bg-ink px-4 text-center text-sm text-bg shadow-lg md:bottom-6"
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <span>{toast}</span>
          {canUndo ? (
            <button type="button" className="font-medium text-accent" onClick={undo}>
              Undo
            </button>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
