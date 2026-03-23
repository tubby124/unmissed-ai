"use client"

import { useEffect, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Phone, PhoneIncoming } from "lucide-react"
import { VoicePoweredOrb } from "@/components/ui/voice-powered-orb"
import type { DemoNiche } from "./demo-data"

/* ── Pre-computed waveform bar heights ──────────────────────────────────── */
const BAR_HEIGHTS = Array.from({ length: 24 }, (_, i) => 4 + ((i * 7 + 3) % 22))

interface DemoCallCardProps {
  demo: DemoNiche
  activeTab: string
  callStage: "ringing" | "live" | "ended"
  isTyping: boolean
  visibleCount: number
  elapsedSecs: number
}

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

export default function DemoCallCard({
  demo,
  activeTab,
  callStage,
  isTyping,
  visibleCount,
  elapsedSecs,
}: DemoCallCardProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [visibleCount, isTyping])

  // Orb energy mapped to call state
  const orbEnergy =
    callStage === "ringing"
      ? 0.15
      : callStage === "live"
      ? isTyping
        ? 0.75
        : 0.2
      : 0.05

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow:
          callStage === "live"
            ? "0 8px 40px rgba(99,102,241,0.12), 0 4px 16px rgba(0,0,0,0.08)"
            : "0 8px 32px rgba(0,0,0,0.08)",
        transition: "box-shadow 0.6s ease",
      }}
    >
      {/* Call header */}
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-3">
          {/* Agent avatar — VoicePoweredOrb */}
          <div className="w-10 h-10 rounded-full overflow-hidden relative flex-shrink-0">
            <VoicePoweredOrb externalEnergy={orbEnergy} />
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: "var(--color-text-1)" }}>
              {demo.agentName}
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-3)" }}>
              {demo.companyName}
            </p>
          </div>
        </div>

        {/* Call status badge + timer */}
        <div className="flex items-center gap-2">
          <AnimatePresence mode="wait">
            {callStage === "ringing" && (
              <motion.div
                key="ringing"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: "rgba(16,185,129,0.1)", color: "#10B981" }}
              >
                <motion.div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: "#10B981" }}
                  animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                />
                Ringing
              </motion.div>
            )}

            {callStage === "live" && (
              <motion.div
                key="live"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ backgroundColor: "rgba(16,185,129,0.12)", color: "#10B981" }}
              >
                <motion.div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: "#10B981" }}
                  animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                />
                LIVE
              </motion.div>
            )}

            {callStage === "ended" && (
              <motion.div
                key="ended"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ backgroundColor: "rgba(99,102,241,0.1)", color: "#818CF8" }}
              >
                Call Ended
              </motion.div>
            )}
          </AnimatePresence>

          {callStage === "live" && (
            <span
              className="text-xs font-mono tabular-nums"
              style={{ color: "var(--color-text-3)" }}
            >
              {formatTime(elapsedSecs)}
            </span>
          )}
        </div>
      </div>

      {/* Waveform — only during live call */}
      <AnimatePresence>
        {callStage === "live" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-5 py-3 flex items-end gap-[2px] h-10">
              {BAR_HEIGHTS.map((h, i) => (
                <motion.div
                  key={i}
                  className="flex-1 rounded-full"
                  animate={{
                    height: isTyping
                      ? [`${h * 0.8}px`, `${4 + ((h * 1.5) % 20)}px`, `${h * 0.8}px`]
                      : `${Math.max(2, h * 0.15)}px`,
                    backgroundColor: isTyping
                      ? "var(--color-primary)"
                      : "var(--color-border)",
                    opacity: isTyping ? 1 : 0.4,
                  }}
                  transition={{
                    height: {
                      duration: 0.38 + (i % 5) * 0.06,
                      repeat: isTyping ? Infinity : 0,
                      delay: i * 0.015,
                      ease: "easeInOut",
                    },
                    backgroundColor: { duration: 0.4 },
                    opacity: { duration: 0.3 },
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transcript area */}
      <div
        ref={scrollRef}
        className="px-5 py-4 space-y-3 overflow-y-auto"
        style={{ minHeight: 280, maxHeight: 360 }}
      >
        {/* Ringing state — centered orb */}
        {callStage === "ringing" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-8 gap-4"
          >
            <motion.div
              className="w-24 h-24 rounded-full overflow-hidden"
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            >
              <VoicePoweredOrb externalEnergy={0.2} />
            </motion.div>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: "var(--color-text-2)" }}>
                Incoming call...
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--color-text-3)" }}>
                AI picks up in under 1 second
              </p>
            </div>
          </motion.div>
        )}

        {/* Transcript bubbles */}
        <AnimatePresence mode="popLayout">
          {demo.messages.slice(0, visibleCount).map((msg, i) => {
            const isAgent = msg.role === "agent"
            return (
              <motion.div
                key={`${activeTab}-${i}`}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className={`flex flex-col ${isAgent ? "items-start" : "items-end"}`}
              >
                {/* Speaker label — show on first msg or speaker change */}
                {(i === 0 || demo.messages[i - 1].role !== msg.role) && (
                  <span
                    className="text-[10px] font-mono mb-0.5 px-1"
                    style={{ color: "var(--color-text-3)" }}
                  >
                    {isAgent ? demo.agentName : "Caller"}
                  </span>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    isAgent ? "rounded-bl-sm" : "rounded-br-sm"
                  }`}
                  style={{
                    backgroundColor: isAgent
                      ? "rgba(99,102,241,0.1)"
                      : "var(--color-bg)",
                    border: isAgent ? "none" : "1px solid var(--color-border)",
                    color: "var(--color-text-1)",
                  }}
                >
                  {msg.text}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* Typing indicator — agent speaking */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-start"
          >
            <span
              className="text-[10px] font-mono mb-0.5 px-1"
              style={{ color: "var(--color-text-3)" }}
            >
              {demo.agentName}
            </span>
            <div
              className="rounded-2xl rounded-bl-sm px-4 py-2.5"
              style={{ backgroundColor: "rgba(99,102,241,0.1)" }}
            >
              <div className="flex items-center gap-1 h-5">
                {[0, 1, 2].map((dot) => (
                  <motion.div
                    key={dot}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: "var(--color-primary)" }}
                    animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.6,
                      delay: dot * 0.15,
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Bottom bar */}
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-2">
          <Phone size={14} style={{ color: "var(--color-text-3)" }} />
          <span className="text-xs" style={{ color: "var(--color-text-3)" }}>
            {callStage === "ended"
              ? `Call completed \u00B7 ${demo.outcome.duration}`
              : callStage === "ringing"
              ? "Connecting..."
              : "Voice call in progress"}
          </span>
        </div>
        {callStage === "live" && (
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: "#10B981" }}
            />
            <span className="text-xs font-mono" style={{ color: "#10B981" }}>
              REC
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
