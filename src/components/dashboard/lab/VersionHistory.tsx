"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Spinner } from "./ClassBadge"
import { fmtDate } from "./constants"
import type { PromptVersion } from "./constants"

// ── Version History ───────────────────────────────────────────────────────────

interface VersionHistoryProps {
  versions: PromptVersion[]
  restoring: string | null
  onRestore: (id: string, content: string) => void
}

export function VersionHistory({ versions, restoring, onRestore }: VersionHistoryProps) {
  const [versionsOpen, setVersionsOpen] = useState(false)

  if (versions.length === 0) return null

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      <button
        className="w-full flex items-center justify-between px-4 min-h-[44px] text-xs font-bold uppercase tracking-wider cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
        style={{ color: "var(--color-text-2)" }}
        onClick={() => setVersionsOpen(v => !v)}
        aria-expanded={versionsOpen}
      >
        Revision History ({versions.length})
        <svg
          className={`w-4 h-4 transition-transform ${versionsOpen ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {versionsOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ overflow: "hidden" }}
          >
            <div className="border-t" style={{ borderColor: "var(--color-border)" }}>
              {versions.map(v => (
                <div
                  key={v.id}
                  className="flex items-start justify-between gap-3 px-4 py-3 text-xs border-b last:border-b-0"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold" style={{ color: "var(--color-text-1)" }}>v{v.version}</span>
                      {v.is_active && (
                        <span className="px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: "#d1fae5", color: "#065f46" }}>live</span>
                      )}
                      <span style={{ color: "var(--color-text-3)" }}>{fmtDate(v.created_at)}</span>
                    </div>
                    {v.change_description && (
                      <p className="mt-0.5 truncate" style={{ color: "var(--color-text-3)" }}>{v.change_description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => onRestore(v.id, v.content)}
                    disabled={!!restoring || v.is_active}
                    className="shrink-0 inline-flex items-center gap-1 text-xs font-medium min-h-[32px] px-2 rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-75 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ color: "var(--color-accent)" }}
                  >
                    {restoring === v.id && <Spinner size={3} />}
                    {restoring === v.id ? "Loading..." : "Load into Draft"}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
