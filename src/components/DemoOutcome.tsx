"use client"

import { motion, AnimatePresence } from "motion/react"
import { Clock } from "lucide-react"
import type { DemoNiche } from "./demo-data"

interface DemoOutcomeProps {
  demo: DemoNiche
  showOutcome: boolean
}

export default function DemoOutcome({ demo, showOutcome }: DemoOutcomeProps) {
  return (
    <div className="space-y-4">
      {/* Outcome card */}
      <AnimatePresence mode="wait">
        {!showOutcome ? (
          <OutcomeSkeleton key="waiting" />
        ) : (
          <OutcomePopulated key="outcome" demo={demo} />
        )}
      </AnimatePresence>

      {/* Telegram notification toast */}
      <AnimatePresence>
        {showOutcome && <TelegramToast demo={demo} />}
      </AnimatePresence>

      {/* Pipeline steps */}
      <AnimatePresence>
        {showOutcome && <PipelineSteps demo={demo} />}
      </AnimatePresence>
    </div>
  )
}

/* ── Skeleton state (waiting for call to end) ─────────────────────────── */

function OutcomeSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="rounded-2xl p-5"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <p
        className="text-[10px] font-mono uppercase tracking-wider mb-4"
        style={{ color: "var(--color-text-3)" }}
      >
        What you get after the call
      </p>

      <div className="space-y-3">
        {["Lead status", "Caller intent", "Next step", "Duration"].map((label, i) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--color-text-3)" }}>
              {label}
            </span>
            <motion.div
              className="h-3 rounded"
              style={{
                width: `${60 + i * 10}px`,
                backgroundColor: "var(--color-border)",
              }}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
            />
          </div>
        ))}
      </div>

      <div
        className="mt-4 pt-4 flex items-center gap-2"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        <Clock size={14} style={{ color: "var(--color-text-3)" }} />
        <p className="text-xs" style={{ color: "var(--color-text-3)" }}>
          Waiting for call to end...
        </p>
      </div>
    </motion.div>
  )
}

/* ── Populated outcome card ────────────────────────────────────────────── */

function OutcomePopulated({ demo }: { demo: DemoNiche }) {
  const { outcome } = demo

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="rounded-2xl p-5"
      style={{
        backgroundColor: `${outcome.statusColor}08`,
        border: `1px solid ${outcome.statusColor}25`,
      }}
    >
      <p
        className="text-[10px] font-mono uppercase tracking-wider mb-4"
        style={{ color: "var(--color-text-3)" }}
      >
        AI captured this lead
      </p>

      {/* Status badge */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 400, damping: 18 }}
        className="flex items-center gap-2 mb-4"
      >
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-lg"
          style={{
            backgroundColor: `${outcome.statusColor}18`,
            color: outcome.statusColor,
          }}
        >
          {outcome.status}
        </span>
        <span className="text-sm font-medium" style={{ color: "var(--color-text-1)" }}>
          {outcome.caller}
        </span>
      </motion.div>

      {/* Detail rows */}
      <div className="space-y-3">
        {[
          { label: "Intent", value: outcome.intent },
          { label: "Next step", value: outcome.nextStep, highlight: true },
          { label: "Duration", value: outcome.duration },
        ].map((row, i) => (
          <motion.div
            key={row.label}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="flex items-start justify-between gap-3"
          >
            <span className="text-xs shrink-0" style={{ color: "var(--color-text-3)" }}>
              {row.label}
            </span>
            <span
              className="text-xs text-right"
              style={{
                color: row.highlight ? outcome.statusColor : "var(--color-text-2)",
                fontWeight: row.highlight ? 600 : 400,
              }}
            >
              {row.value}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

/* ── Telegram notification toast ───────────────────────────────────────── */

function TelegramToast({ demo }: { demo: DemoNiche }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.5, type: "spring", stiffness: 320, damping: 24 }}
      className="rounded-xl px-4 py-3 flex items-center gap-3"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
        style={{ backgroundColor: "#229ED9" }}
      >
        T
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: "var(--color-text-1)" }}>
          {demo.outcome.status} lead — {demo.agentName} captured it
        </p>
        <p className="text-xs truncate" style={{ color: "var(--color-text-3)" }}>
          {demo.outcome.intent.split(" \u2014 ")[0]} · tap for details
        </p>
      </div>
    </motion.div>
  )
}

/* ── Pipeline steps ────────────────────────────────────────────────────── */

function PipelineSteps({ demo }: { demo: DemoNiche }) {
  const steps = [
    "Answered in 0.3 seconds",
    "Collected caller details",
    `Classified lead as ${demo.outcome.status}`,
    "Telegram alert sent to owner",
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 }}
      className="rounded-xl p-4"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <p
        className="text-[10px] font-mono uppercase tracking-wider mb-3"
        style={{ color: "var(--color-text-3)" }}
      >
        What happened automatically
      </p>
      {steps.map((step, i) => (
        <motion.div
          key={step}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8 + i * 0.12 }}
          className="flex items-center gap-2 py-1.5"
        >
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "rgba(16,185,129,0.12)" }}
          >
            <svg
              width="8"
              height="8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#10B981"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <span className="text-xs" style={{ color: "var(--color-text-2)" }}>
            {step}
          </span>
        </motion.div>
      ))}
    </motion.div>
  )
}
