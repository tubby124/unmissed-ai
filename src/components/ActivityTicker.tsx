"use client";

import { useState, useEffect } from "react";
import { tickerEvents } from "@/lib/ticker-data";

export default function ActivityTicker() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % tickerEvents.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const current = tickerEvents[index];

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
      style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
        style={{ backgroundColor: "#22C55E" }}
      />
      <span className="ticker-item text-gray-400" key={index}>
        {current.message} — {current.location} · {current.time}
      </span>
    </div>
  );
}
