"use client";

import { useEffect, useRef, useState } from "react";

interface Stat {
  value: string;
  label: string;
  sublabel?: string;
}

function parseNumber(val: string): { num: number; prefix: string; suffix: string } {
  const match = val.match(/^([^0-9]*)([0-9,]+)([^0-9]*)$/);
  if (!match) return { num: 0, prefix: "", suffix: val };
  return {
    prefix: match[1],
    num: parseInt(match[2].replace(/,/g, ""), 10),
    suffix: match[3],
  };
}

function AnimatedNumber({ value, sublabel }: { value: string; sublabel?: string }) {
  const { num, prefix, suffix } = parseNumber(value);
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const duration = 1400;
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      setDisplay(Math.round(easeOut(progress) * num));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [num]);

  return (
    <div>
      <p className="text-3xl md:text-4xl font-black mb-1" style={{ color: "#3B82F6" }}>
        {prefix}{display.toLocaleString()}{suffix}
      </p>
      {sublabel && (
        <p className="text-zinc-600 text-xs mt-0.5">{sublabel}</p>
      )}
    </div>
  );
}

export default function StatsSection({ stats }: { stats: Stat[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center"
    >
      {stats.map((s) => (
        <div key={s.label}>
          {visible ? (
            <AnimatedNumber value={s.value} sublabel={s.sublabel} />
          ) : (
            <p className="text-3xl md:text-4xl font-black mb-1" style={{ color: "#3B82F6" }}>
              {s.value}
            </p>
          )}
          <p className="text-zinc-500 text-sm">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
