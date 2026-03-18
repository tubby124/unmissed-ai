"use client";

import { useState } from "react";
import Link from "next/link";

export default function TalkToAgentWidget() {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <Link
        href="/try"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="flex items-center gap-2.5 rounded-full shadow-lg transition-all duration-200 cursor-pointer text-white text-sm font-semibold"
        style={{
          backgroundColor: "var(--color-primary)",
          padding: hovered ? "10px 18px 10px 14px" : "10px 14px",
          boxShadow: "0 4px 20px rgba(79,70,229,0.4)",
        }}
        aria-label="Talk to an AI agent demo"
      >
        {/* Phone icon */}
        <span
          className="flex items-center justify-center w-7 h-7 rounded-full bg-white/20 shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.01 2.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z" />
          </svg>
        </span>

        {/* Label — expands on hover */}
        <span
          className="overflow-hidden whitespace-nowrap transition-all duration-200"
          style={{
            maxWidth: hovered ? "140px" : "0px",
            opacity: hovered ? 1 : 0,
          }}
        >
          Talk to an Agent
        </span>
      </Link>
    </div>
  );
}
