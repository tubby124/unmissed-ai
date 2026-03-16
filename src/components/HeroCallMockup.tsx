"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"

// Pre-computed bar heights — deterministic, avoids hydration mismatch
const BAR_HEIGHTS = Array.from({ length: 20 }, (_, i) => 4 + ((i * 7 + 3) % 22))

const STAGES = ["ringing", "live", "classifying", "hot", "summary"] as const
type Stage = typeof STAGES[number]

const STAGE_DURATIONS: Record<Stage, number> = {
  ringing: 1400,
  live: 2600,
  classifying: 900,
  hot: 2200,
  summary: 3200,
}

const SUMMARY_ROWS = [
  { label: "Duration", value: "2m 14s" },
  { label: "Intent", value: "Windshield chip repair" },
  { label: "Outcome", value: "Appointment booked" },
  { label: "SMS sent", value: "Confirmation sent" },
]

export default function HeroCallMockup() {
  const [stage, setStage] = useState<Stage>("ringing")
  const [showToast, setShowToast] = useState(false)

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>

    function advance(current: Stage) {
      timeout = setTimeout(() => {
        const next = STAGES[(STAGES.indexOf(current) + 1) % STAGES.length]
        setStage(next)
        if (next === "hot") {
          setTimeout(() => setShowToast(true), 500)
        } else {
          setShowToast(false)
        }
        advance(next)
      }, STAGE_DURATIONS[current])
    }

    advance(stage)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const waveColor: Record<Stage, string> = {
    ringing: "var(--color-border)",
    live: "var(--color-primary)",
    classifying: "var(--color-primary)",
    hot: "#EF4444",
    summary: "rgba(99,102,241,0.35)",
  }

  return (
    <div className="relative w-full max-w-xs mx-auto select-none">
      {/* Call card */}
      <motion.div
        className="rounded-2xl p-5"
        animate={{
          boxShadow:
            stage === "hot"
              ? "0 0 40px rgba(16,185,129,0.18), 0 4px 24px rgba(0,0,0,0.08)"
              : stage === "summary"
              ? "0 0 28px rgba(99,102,241,0.12), 0 4px 24px rgba(0,0,0,0.06)"
              : "0 4px 24px rgba(0,0,0,0.06)",
        }}
        transition={{ duration: 0.6 }}
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-mono" style={{ color: "var(--color-text-3)" }}>
              {stage === "summary" ? "Call ended" : "Incoming Call"}
            </p>
            <p className="font-semibold text-sm" style={{ color: "var(--color-text-1)" }}>
              Crystal Clear Auto Glass
            </p>
          </div>

          <AnimatePresence mode="wait">
            {stage === "ringing" && (
              <motion.div
                key="ringing"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(16,185,129,0.1)" }}
              >
                <motion.div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: "var(--color-cta)" }}
                  animate={{ scale: [1, 1.35, 1] }}
                  transition={{ repeat: Infinity, duration: 0.7 }}
                />
              </motion.div>
            )}

            {stage === "live" && (
              <motion.div
                key="live"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="px-2 py-1 rounded-full text-xs font-semibold"
                style={{ backgroundColor: "rgba(16,185,129,0.12)", color: "var(--color-cta)" }}
              >
                LIVE
              </motion.div>
            )}

            {stage === "classifying" && (
              <motion.div
                key="classifying"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="px-2 py-1 rounded-full text-xs font-mono"
                style={{
                  backgroundColor: "var(--color-bg)",
                  color: "var(--color-text-3)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <motion.span
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                >
                  analyzing...
                </motion.span>
              </motion.div>
            )}

            {stage === "hot" && (
              <motion.div
                key="hot"
                initial={{ scale: 0.5, opacity: 0, rotate: -12 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 18 }}
                className="px-2 py-1 rounded-full text-xs font-bold"
                style={{ backgroundColor: "rgba(239,68,68,0.12)", color: "#EF4444" }}
              >
                HOT
              </motion.div>
            )}

            {stage === "summary" && (
              <motion.div
                key="summary"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                className="px-2 py-1 rounded-full text-xs font-semibold"
                style={{ backgroundColor: "rgba(99,102,241,0.1)", color: "#818CF8" }}
              >
                AI Summary
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Waveform */}
        <div className="flex items-end gap-[3px] h-12 mb-4">
          {BAR_HEIGHTS.map((h, i) => (
            <motion.div
              key={i}
              className="flex-1 rounded-full"
              animate={{
                height:
                  stage === "live"
                    ? [`${h}px`, `${4 + ((h * 1.9) % 30)}px`, `${h}px`]
                    : stage === "ringing"
                    ? `${Math.max(3, Math.round(h * 0.14))}px`
                    : `${h}px`,
                backgroundColor: waveColor[stage],
                opacity: stage === "ringing" ? 0.25 : stage === "summary" ? 0.6 : 1,
              }}
              transition={{
                height: {
                  duration: 0.38 + (i % 5) * 0.07,
                  repeat: stage === "live" ? Infinity : 0,
                  delay: i * 0.018,
                  ease: "easeInOut",
                },
                backgroundColor: { duration: 0.5 },
                opacity: { duration: 0.4 },
              }}
            />
          ))}
        </div>

        {/* Detail area — fixed min-height prevents card height jumps */}
        <div className="min-h-[64px] space-y-2">
          <AnimatePresence mode="wait">
            {/* classifying + hot rows */}
            {(stage === "classifying" || stage === "hot") && (
              <motion.div
                key="hot-rows"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: "var(--color-text-3)" }}>Caller intent</span>
                  <span style={{ color: "var(--color-text-2)" }}>Windshield chip repair</span>
                </div>
                {stage === "hot" && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="flex items-center justify-between text-xs"
                  >
                    <span style={{ color: "var(--color-text-3)" }}>Lead score</span>
                    <span className="font-semibold" style={{ color: "#EF4444" }}>
                      HOT — ready to book
                    </span>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* summary stage */}
            {stage === "summary" && (
              <motion.div
                key="summary-rows"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-1.5"
              >
                {/* AI sentence block */}
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="rounded-lg px-2.5 py-2 mb-2 text-xs leading-relaxed"
                  style={{
                    backgroundColor: "rgba(99,102,241,0.06)",
                    border: "1px solid rgba(99,102,241,0.14)",
                    color: "var(--color-text-2)",
                  }}
                >
                  Chip repair booked for Tuesday. Caller confirmed availability and SMS confirmation sent.
                </motion.div>

                {SUMMARY_ROWS.map((row, i) => (
                  <motion.div
                    key={row.label}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.07 }}
                    className="flex items-center justify-between text-xs"
                  >
                    <span style={{ color: "var(--color-text-3)" }}>{row.label}</span>
                    <span
                      className="truncate ml-3 text-right"
                      style={{
                        color: row.label === "Outcome" ? "#34D399" : "var(--color-text-2)",
                        fontWeight: row.label === "Outcome" ? 600 : 400,
                        maxWidth: "60%",
                      }}
                    >
                      {row.value}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Always-visible agent row */}
          <div className="flex items-center justify-between text-xs pt-0.5">
            <span style={{ color: "var(--color-text-3)" }}>Agent</span>
            <span style={{ color: "var(--color-text-2)" }}>Tyler · Auto Glass</span>
          </div>
        </div>
      </motion.div>

      {/* Telegram toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className="absolute -bottom-14 left-0 right-0 mx-2 rounded-xl px-4 py-3 flex items-center gap-3"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
              style={{ backgroundColor: "#229ED9" }}
            >
              T
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: "var(--color-text-1)" }}>
                HOT lead — Tyler captured it
              </p>
              <p className="text-xs truncate" style={{ color: "var(--color-text-3)" }}>
                Windshield chip · ready to book
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
