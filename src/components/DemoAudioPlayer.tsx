"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";

/* ── Scripted demo conversations (100% fictional) ─────────────────────────── */

interface Message {
  role: "agent" | "caller";
  text: string;
}

interface DemoNiche {
  id: string;
  label: string;
  agentName: string;
  contactSubtitle: string;
  messages: Message[];
  outcome: {
    status: "HOT" | "WARM";
    statusColor: string;
    caller: string;
    intent: string;
    nextStep: string;
    duration: string;
  };
}

const DEMOS: DemoNiche[] = [
  {
    id: "auto-glass",
    label: "Auto Glass",
    agentName: "Tyler",
    contactSubtitle: "Crystal Clear Auto Glass",
    messages: [
      { role: "agent", text: "Crystal Clear Auto Glass, this is Tyler \u2014 how can I help ya?" },
      { role: "caller", text: "Hey, I\u2019ve got a big crack running across my windshield" },
      { role: "agent", text: "Oof, sounds like a full replacement. What year and make is your vehicle?" },
      { role: "caller", text: "2021 Honda CR-V" },
      { role: "agent", text: "Got it \u2014 2021 CR-V. Does it have that lane assist camera near the mirror?" },
      { role: "caller", text: "Yeah I think so" },
      { role: "agent", text: "Alright, I\u2019ll get the boss to call ya back with a quote. Talk soon!" },
    ],
    outcome: {
      status: "WARM",
      statusColor: "#F59E0B",
      caller: "Customer",
      intent: "Windshield replacement \u2014 2021 Honda CR-V + ADAS calibration",
      nextStep: "Boss calling back with quote",
      duration: "1:38",
    },
  },
  {
    id: "property-mgmt",
    label: "Property Mgmt",
    agentName: "Nicole",
    contactSubtitle: "Maple Ridge Properties",
    messages: [
      { role: "agent", text: "Maple Ridge Properties, this is Nicole \u2014 how can I help you?" },
      { role: "caller", text: "Hi, I\u2019m in unit 204 and there\u2019s water leaking from the ceiling" },
      { role: "agent", text: "Oh no, sorry to hear that. Is it actively dripping right now?" },
      { role: "caller", text: "Yeah it\u2019s coming through pretty fast" },
      { role: "agent", text: "That sounds urgent \u2014 I\u2019m flagging this for Sarah right now. Can I get your name?" },
      { role: "caller", text: "It\u2019s Mike Chen" },
      { role: "agent", text: "Got it Mike. Sarah\u2019ll get someone over right away. Hang tight!" },
    ],
    outcome: {
      status: "HOT",
      statusColor: "#EF4444",
      caller: "Mike Chen",
      intent: "Active water leak \u2014 Unit 204, ceiling dripping",
      nextStep: "Manager dispatched immediately",
      duration: "1:24",
    },
  },
];

/* ── Typing indicator ─────────────────────────────────────────────────────── */

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <div
        className="w-2 h-2 rounded-full bg-gray-400"
        style={{ animation: "imsg-dot 1.4s infinite", animationDelay: "0s" }}
      />
      <div
        className="w-2 h-2 rounded-full bg-gray-400"
        style={{ animation: "imsg-dot 1.4s infinite", animationDelay: "0.2s" }}
      />
      <div
        className="w-2 h-2 rounded-full bg-gray-400"
        style={{ animation: "imsg-dot 1.4s infinite", animationDelay: "0.4s" }}
      />
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────────────────── */

export default function DemoAudioPlayer() {
  const [activeTab, setActiveTab] = useState("auto-glass");
  const [visibleCount, setVisibleCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [showOutcome, setShowOutcome] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const demo = DEMOS.find((d) => d.id === activeTab)!;

  // Auto-scroll to bottom as messages appear
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleCount, isTyping]);

  // Animate messages one by one
  const animate = useCallback(() => {
    const msgs = demo.messages;
    let idx = 0;

    const showNext = () => {
      if (idx >= msgs.length) {
        setIsTyping(false);
        // Show outcome after last message
        timerRef.current = setTimeout(() => setShowOutcome(true), 600);
        return;
      }

      const msg = msgs[idx];
      // Show typing indicator before agent messages
      if (msg.role === "agent") {
        setIsTyping(true);
        timerRef.current = setTimeout(() => {
          setIsTyping(false);
          idx++;
          setVisibleCount(idx);
          timerRef.current = setTimeout(showNext, 400);
        }, 800 + Math.random() * 400);
      } else {
        idx++;
        setVisibleCount(idx);
        timerRef.current = setTimeout(showNext, 500 + Math.random() * 300);
      }
    };

    // Start after a short delay
    timerRef.current = setTimeout(showNext, 600);
  }, [demo.messages]);

  // Start animation on mount or tab switch
  useEffect(() => {
    setVisibleCount(0);
    setIsTyping(false);
    setShowOutcome(false);

    // Clear any running timers
    if (timerRef.current) clearTimeout(timerRef.current);

    // Small delay then start
    const startTimer = setTimeout(() => {
      setHasPlayed(true);
      animate();
    }, 300);

    return () => {
      clearTimeout(startTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeTab, animate]);

  const switchTab = (id: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setActiveTab(id);
  };

  return (
    <section id="demo" className="py-20 px-4" style={{ backgroundColor: "var(--color-bg)" }}>
      {/* Keyframes */}
      <style>{`
        @keyframes imsg-dot {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
          30% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <p
            className="text-xs font-mono uppercase tracking-widest mb-2"
            style={{ color: "var(--color-primary)" }}
          >
            Live Demo
          </p>
          <h2
            className="text-3xl md:text-4xl font-bold mb-3"
            style={{ color: "var(--color-text-1)" }}
          >
            See it in action.
          </h2>
          <p className="text-lg" style={{ color: "var(--color-text-2)" }}>
            Real conversations your AI receptionist handles — every call captured, every lead saved.
          </p>
        </div>

        {/* Niche tabs */}
        <div className="flex justify-center gap-2 mb-8">
          {DEMOS.map((d) => (
            <button
              key={d.id}
              onClick={() => switchTab(d.id)}
              className="px-5 py-2 rounded-full text-sm font-medium transition-all"
              style={
                activeTab === d.id
                  ? {
                      backgroundColor: "rgba(59,130,246,0.15)",
                      color: "#93C5FD",
                      border: "1px solid rgba(59,130,246,0.3)",
                    }
                  : {
                      backgroundColor: "transparent",
                      color: "#71717A",
                      border: "1px solid #27272A",
                    }
              }
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* iPhone + outcome */}
        <div className="flex flex-col items-center">
          {/* iPhone 15 Pro frame */}
          <div
            className="relative mx-auto"
            style={{
              width: "min(320px, 90vw)",
              background: "#1C1C1E",
              borderRadius: 52,
              padding: 10,
              boxShadow:
                "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.04)",
            }}
          >
            {/* Screen */}
            <div
              style={{
                background: "#000",
                borderRadius: 42,
                overflow: "hidden",
                position: "relative",
              }}
            >
              {/* Dynamic Island */}
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 120,
                  height: 34,
                  background: "#000",
                  borderRadius: 20,
                  zIndex: 10,
                }}
              />

              {/* Status bar */}
              <div
                style={{
                  padding: "14px 24px 0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  height: 52,
                }}
              >
                <span style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>9:41</span>
                <div className="flex items-center gap-1">
                  {/* Signal bars */}
                  <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
                    <rect x="0" y="9" width="3" height="3" rx="0.5" fill="#fff" />
                    <rect x="4.5" y="6" width="3" height="6" rx="0.5" fill="#fff" />
                    <rect x="9" y="3" width="3" height="9" rx="0.5" fill="#fff" />
                    <rect x="13.5" y="0" width="3" height="12" rx="0.5" fill="#fff" />
                  </svg>
                  {/* WiFi */}
                  <svg width="16" height="12" viewBox="0 0 16 12" fill="#fff">
                    <path d="M8 10.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM4.05 8.46a5.5 5.5 0 017.9 0l-1.06 1.06a4 4 0 00-5.78 0L4.05 8.46zM1.22 5.64a9 9 0 0113.56 0L13.72 6.7a7.5 7.5 0 00-11.44 0L1.22 5.64z" />
                  </svg>
                  {/* Battery */}
                  <svg width="27" height="12" viewBox="0 0 27 12" fill="none">
                    <rect x="0" y="0.5" width="23" height="11" rx="2.5" stroke="#fff" strokeWidth="1" />
                    <rect x="1.5" y="2" width="19" height="8" rx="1.5" fill="#fff" />
                    <path d="M24 4v4a2 2 0 000-4z" fill="#fff" opacity="0.4" />
                  </svg>
                </div>
              </div>

              {/* iMessage header */}
              <div
                style={{
                  padding: "8px 16px 12px",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  textAlign: "center",
                }}
              >
                {/* Avatar circle */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    background: "linear-gradient(135deg, #5856D6, #AF52DE)",
                    margin: "0 auto 6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  {demo.agentName[0]}
                </div>
                <p style={{ color: "#fff", fontSize: 15, fontWeight: 600, lineHeight: 1.2 }}>
                  {demo.agentName}
                </p>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 1 }}>
                  {demo.contactSubtitle}
                </p>
              </div>

              {/* Message area */}
              <div
                ref={scrollRef}
                style={{
                  padding: "12px 10px 6px",
                  minHeight: 300,
                  maxHeight: 340,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  background: "#000",
                }}
              >
                {/* Timestamp */}
                <p
                  style={{
                    textAlign: "center",
                    color: "rgba(255,255,255,0.3)",
                    fontSize: 11,
                    marginBottom: 6,
                  }}
                >
                  Today 2:34 PM
                </p>

                <AnimatePresence mode="popLayout">
                  {demo.messages.slice(0, visibleCount).map((msg, i) => {
                    const isAgent = msg.role === "agent";
                    const isLast =
                      i === visibleCount - 1 ||
                      demo.messages[i + 1]?.role !== msg.role;

                    return (
                      <motion.div
                        key={`${activeTab}-${i}`}
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.2 }}
                        style={{
                          display: "flex",
                          justifyContent: isAgent ? "flex-start" : "flex-end",
                          paddingLeft: isAgent ? 0 : 40,
                          paddingRight: isAgent ? 40 : 0,
                        }}
                      >
                        <div
                          style={{
                            maxWidth: "85%",
                            padding: "8px 14px",
                            borderRadius: 20,
                            // Tail on last message in a group
                            ...(isLast && isAgent
                              ? { borderBottomLeftRadius: 4 }
                              : {}),
                            ...(isLast && !isAgent
                              ? { borderBottomRightRadius: 4 }
                              : {}),
                            background: isAgent
                              ? "#3A3A3C"
                              : "#007AFF",
                            color: "#fff",
                            fontSize: 15,
                            lineHeight: 1.4,
                            letterSpacing: "-0.01em",
                          }}
                        >
                          {msg.text}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* Typing indicator */}
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ display: "flex", justifyContent: "flex-start" }}
                  >
                    <div
                      style={{
                        background: "#3A3A3C",
                        borderRadius: 20,
                        borderBottomLeftRadius: 4,
                        padding: "4px 6px",
                      }}
                    >
                      <TypingIndicator />
                    </div>
                  </motion.div>
                )}
              </div>

              {/* iMessage input bar */}
              <div
                style={{
                  padding: "8px 10px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {/* Plus button */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    background: "#3A3A3C",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#8E8E93">
                    <path d="M12 4v16m8-8H4" stroke="#8E8E93" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
                {/* Input field */}
                <div
                  style={{
                    flex: 1,
                    height: 36,
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.12)",
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: 14,
                  }}
                >
                  <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 15 }}>
                    iMessage
                  </span>
                </div>
              </div>

              {/* Home indicator */}
              <div
                style={{
                  padding: "0 0 8px",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: 134,
                    height: 5,
                    background: "rgba(255,255,255,0.2)",
                    borderRadius: 3,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Delivered text */}
          {visibleCount > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                color: "rgba(255,255,255,0.25)",
                fontSize: 11,
                textAlign: "center",
                marginTop: 8,
              }}
            >
              Delivered
            </motion.p>
          )}

          {/* Outcome card */}
          <AnimatePresence>
            {showOutcome && (
              <motion.div
                initial={{ opacity: 0, y: 10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full overflow-hidden mt-4"
                style={{ maxWidth: 320 }}
              >
                <div
                  className="rounded-xl p-4"
                  style={{
                    backgroundColor: `${demo.outcome.statusColor}10`,
                    border: `1px solid ${demo.outcome.statusColor}35`,
                    borderLeft: `3px solid ${demo.outcome.statusColor}`,
                  }}
                >
                  <p
                    className="text-xs font-mono uppercase tracking-wider mb-2"
                    style={{ color: "#64748B" }}
                  >
                    AI captured this lead:
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-md"
                      style={{
                        backgroundColor: `${demo.outcome.statusColor}20`,
                        color: demo.outcome.statusColor,
                      }}
                    >
                      {demo.outcome.status}
                    </span>
                    <span className="text-sm font-medium" style={{ color: "#94A3B8" }}>
                      {demo.outcome.caller}
                    </span>
                    <span className="text-xs" style={{ color: "#64748B" }}>
                      &middot; {demo.outcome.duration}
                    </span>
                  </div>
                  <p className="text-sm mb-1" style={{ color: "#94A3B8" }}>
                    {demo.outcome.intent}
                  </p>
                  <p
                    className="text-xs flex items-center gap-1"
                    style={{ color: "#94A3B8" }}
                  >
                    <span style={{ color: demo.outcome.statusColor }}>&rarr;</span>
                    {demo.outcome.nextStep}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CTA */}
        <div className="text-center mt-8">
          <Link
            href="/try"
            className="inline-block px-8 py-3.5 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 active:scale-95"
            style={{ backgroundColor: "var(--color-cta)" }}
          >
            Talk to an AI Agent Right Now &rarr;
          </Link>
          <p className="text-xs mt-2" style={{ color: "var(--color-text-3)" }}>
            No sign-up needed &middot; Uses your microphone &middot; 2-minute demo
          </p>
        </div>
      </div>
    </section>
  );
}
