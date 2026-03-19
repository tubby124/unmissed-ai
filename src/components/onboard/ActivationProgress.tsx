"use client";

import { useState, useEffect, useRef } from "react";

export const ACTIVATION_STEPS = [
  "Creating your AI agent...",
  "Setting up your phone number...",
  "Configuring your account...",
  "Almost done...",
];

export function ActivationProgress({ active, done }: { active: boolean; done: boolean }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!active) {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      if (!done) setVisibleCount(0);
      return;
    }
    setVisibleCount(1);
    const delays = [1500, 3000, 5500];
    const timers = delays.map((delay, i) =>
      setTimeout(() => setVisibleCount(i + 2), delay)
    );
    timersRef.current = timers;
    return () => timers.forEach(clearTimeout);
  }, [active, done]);

  useEffect(() => {
    if (done) setVisibleCount(ACTIVATION_STEPS.length);
  }, [done]);

  if (visibleCount === 0) return null;

  return (
    <div className="space-y-2 mt-3">
      {ACTIVATION_STEPS.slice(0, visibleCount).map((step, i) => {
        const isLast = i === visibleCount - 1;
        const completed = done || !isLast;
        return (
          <div
            key={i}
            className="flex items-center gap-2.5 text-xs animate-in fade-in slide-in-from-bottom-1 duration-300"
          >
            {completed ? (
              <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="animate-spin w-4 h-4 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            <span className={completed ? "text-emerald-700" : "text-muted-foreground"}>
              {step}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Dark-themed variant for the success screen
export function ActivationProgressDark({ active, done }: { active: boolean; done: boolean }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!active) {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      if (!done) setVisibleCount(0);
      return;
    }
    setVisibleCount(1);
    const delays = [1500, 3500, 6000];
    const timers = delays.map((delay, i) =>
      setTimeout(() => setVisibleCount(i + 2), delay)
    );
    timersRef.current = timers;
    return () => timers.forEach(clearTimeout);
  }, [active, done]);

  useEffect(() => {
    if (done) setVisibleCount(ACTIVATION_STEPS.length);
  }, [done]);

  if (visibleCount === 0) return null;

  return (
    <div className="space-y-2.5">
      {ACTIVATION_STEPS.slice(0, visibleCount).map((step, i) => {
        const isLast = i === visibleCount - 1;
        const completed = done || !isLast;
        return (
          <div key={i} className="flex items-center gap-2.5 text-sm">
            {completed ? (
              <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="animate-spin w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            <span className={completed ? "text-emerald-400/80" : "text-slate-400"}>
              {step}
            </span>
          </div>
        );
      })}
    </div>
  );
}
