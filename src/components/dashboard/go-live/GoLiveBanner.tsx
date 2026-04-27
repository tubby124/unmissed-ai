'use client'

/**
 * Sticky bottom "You're live" banner for the Go Live tab.
 *
 * Spec: docs/superpowers/specs/2026-04-26-go-live-tab-design.md
 *   - Section "Banner — You're live"
 *   - §6 (Live definition — derived state, no `is_live` column)
 *   - §10 (mobile interaction — confetti once, safe-area inset, single brand accent)
 *   - §13 (a11y)
 *
 * Renders nothing when `isLive` is false. When live: green pill with the
 * Twilio number, tap-to-copy, and "Callers reach your agent." subcopy.
 *
 * Confetti fires once per mount on the first transition into live state.
 * The page can derive `isLive` from the four conditions in §6 and pass it in.
 */

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { formatPhone } from '@/lib/format-phone'

interface GoLiveBannerProps {
  isLive: boolean
  twilioNumber: string | null
}

export default function GoLiveBanner({ isLive, twilioNumber }: GoLiveBannerProps) {
  const [copied, setCopied] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  // First-time celebration tracking — fires only on the first false→true transition
  // for the lifetime of this mounted component (per spec §10).
  const hasCelebrated = useRef(false)
  const previousIsLive = useRef(isLive)

  useEffect(() => {
    if (isLive && !previousIsLive.current && !hasCelebrated.current) {
      hasCelebrated.current = true
      setShowConfetti(true)
      const t = setTimeout(() => setShowConfetti(false), 700)
      return () => clearTimeout(t)
    }
    previousIsLive.current = isLive
  }, [isLive])

  if (!isLive) return null

  const formatted = twilioNumber ? formatPhone(twilioNumber) : ''

  async function copyNumber() {
    if (!twilioNumber) return
    try {
      await navigator.clipboard.writeText(twilioNumber)
      navigator.vibrate?.(10)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API can fail in insecure contexts — degrade silently.
    }
  }

  return (
    <div
      className="sticky bottom-0 left-0 right-0 z-30 pb-[env(safe-area-inset-bottom)] pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div className="px-4 pb-4 pt-2 pointer-events-auto">
        <div className="relative mx-auto max-w-[600px]">
          {/* Confetti — small CSS keyframe burst, pure CSS so we add no deps. */}
          <AnimatePresence>{showConfetti && <ConfettiBurst />}</AnimatePresence>

          <div className="rounded-2xl bg-emerald-500 text-white shadow-lg px-5 py-4 flex items-center gap-3">
            <span className="font-semibold text-base whitespace-nowrap">✓ You&apos;re live</span>
            {formatted && (
              <button
                type="button"
                onClick={copyNumber}
                className="ml-auto inline-flex items-center gap-2 rounded-full bg-emerald-600/40 hover:bg-emerald-600/60 px-3 py-1.5 text-sm font-mono transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label={`Copy your number ${formatted}`}
              >
                <span>{formatted}</span>
                <span className="text-xs opacity-90">{copied ? 'Copied ✓' : 'Copy'}</span>
              </button>
            )}
          </div>
          <p className="text-center text-xs text-emerald-900/80 mt-1.5">
            Callers reach your agent.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Confetti — 8 dots fanning out, 600ms, opacity fade ───────────────────────

function ConfettiBurst() {
  // 8 dots distributed around 360°. Pure CSS (transform + opacity) — no canvas.
  const dots = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2
    const dist = 60 // px
    return {
      key: i,
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      hue: ['#10b981', '#34d399', '#fbbf24', '#60a5fa'][i % 4],
    }
  })
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-center"
      aria-hidden="true"
    >
      {dots.map((d) => (
        <motion.span
          key={d.key}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
          animate={{ x: d.dx, y: d.dy, opacity: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="absolute block w-2 h-2 rounded-full"
          style={{ backgroundColor: d.hue }}
        />
      ))}
    </div>
  )
}
