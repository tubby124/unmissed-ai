"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from 'motion/react';

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
      <p className="text-3xl md:text-4xl font-black mb-1 t1">
        {prefix}{display.toLocaleString()}{suffix}
      </p>
      {sublabel && (
        <p className="text-xs mt-0.5 t3">{sublabel}</p>
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

  const colClass = stats.length === 3
    ? "grid-cols-1 sm:grid-cols-3"
    : "grid-cols-2 md:grid-cols-4";

  return (
    <div
      ref={ref}
      className={`max-w-4xl mx-auto grid ${colClass} gap-6 text-center bg-transparent`}
    >
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 300, damping: 24, delay: i * 0.15 }}
        >
          {visible ? (
            <AnimatedNumber value={s.value} sublabel={s.sublabel} />
          ) : (
            <p className="text-3xl md:text-4xl font-black mb-1 t1">
              {s.value}
            </p>
          )}
          <p className="text-sm t2">{s.label}</p>
        </motion.div>
      ))}
    </div>
  );
}
