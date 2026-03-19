import { motion } from "motion/react"

// ── Classification badge ──────────────────────────────────────────────────────

export function ClassBadge({ label }: { label: string | null }) {
  if (!label) return null

  const config: Record<string, { bg: string; text: string; icon: string }> = {
    HOT: {
      bg: "#fef2f2",
      text: "#b91c1c",
      icon: "M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z",
    },
    WARM: {
      bg: "#fffbeb",
      text: "#92400e",
      icon: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z",
    },
    COLD: {
      bg: "#eff6ff",
      text: "#1e40af",
      icon: "M13 10V3L4 14h7v7l9-11h-7z",
    },
    JUNK: {
      bg: "var(--color-bg)",
      text: "var(--color-text-3)",
      icon: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
    },
  }

  const c = config[label] ?? config.JUNK
  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold"
      style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.text}22` }}
    >
      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={c.icon} />
      </svg>
      {label}
    </motion.span>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────

export function Spinner({ size = 3 }: { size?: number }) {
  return (
    <svg
      className={`animate-spin w-${size} h-${size} shrink-0`}
      fill="none" viewBox="0 0 24 24" aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
