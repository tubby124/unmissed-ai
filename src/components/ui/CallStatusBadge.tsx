'use client'

import { motion } from 'motion/react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

/**
 * Status colour map — resolves each status to a CSS colour value
 * that can be used in `style={{ backgroundColor: ... }}`.
 */
const STATUS_COLORS: Record<
  'idle' | 'ringing' | 'connecting' | 'active' | 'voicemail' | 'completed' | 'failed',
  string
> = {
  idle: 'var(--color-text-3)',
  ringing: '#059669', // emerald-600
  connecting: '#D97706', // amber-600
  active: '#059669', // emerald-600
  voicemail: '#3B82F6', // blue-500
  completed: 'var(--color-text-3)',
  failed: '#DC2626', // red-600
}

/**
 * Which statuses should show the pulsing ring animation.
 */
const PULSING_STATUSES: ReadonlySet<string> = new Set(['ringing', 'connecting'])

/** Dot diameter in px per size */
const DOT_SIZES: Record<'sm' | 'md' | 'lg', number> = {
  sm: 8,
  md: 10,
  lg: 12,
}

/** Label text size class per size */
const LABEL_SIZES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
}

export interface CallStatusBadgeProps {
  /** The current call status — drives both colour and animation. */
  status: 'idle' | 'ringing' | 'connecting' | 'active' | 'voicemail' | 'completed' | 'failed'
  /** Optional text label shown next to the dot. */
  label?: string
  /** Size variant. Default: 'md'. */
  size?: 'sm' | 'md' | 'lg'
  /** Additional class names forwarded to the root element. */
  className?: string
}

/**
 * Reusable call-status badge that mirrors the pulsing-ring pattern from
 * `FloatingCallOrb`. Displays a coloured dot — optionally with a pulse
 * animation for transient statuses (ringing, connecting) — alongside
 * an optional text label.
 *
 * **Colour map:**
 * - `idle` / `completed` → zinc (muted)
 * - `ringing` → emerald + pulse
 * - `connecting` → amber + pulse
 * - `active` → emerald (steady)
 * - `voicemail` → blue
 * - `failed` → red
 *
 * The pulse animation is automatically disabled when the user has
 * requested reduced motion (`prefers-reduced-motion`).
 */
export function CallStatusBadge({
  status,
  label,
  size = 'md',
  className = '',
}: CallStatusBadgeProps) {
  const { prefersReducedMotion } = usePrefersReducedMotion()
  const color = STATUS_COLORS[status]
  const dotSize = DOT_SIZES[size]
  const showPulse = !prefersReducedMotion && PULSING_STATUSES.has(status)

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      role="status"
      aria-label={label ?? status}
    >
      {/* Dot container — relative so the pulse ring can sit inside */}
      <span
        className="relative inline-flex items-center justify-center rounded-full flex-shrink-0"
        style={{ width: dotSize, height: dotSize }}
      >
        {/* Pulse ring — visible only for transient statuses */}
        {showPulse && (
          <motion.span
            animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: color }}
          />
        )}

        {/* Solid coloured dot */}
        <span
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      </span>

      {/* Optional label */}
      {label && (
        <span
          className={LABEL_SIZES[size]}
          style={{ color: 'var(--color-text-1)' }}
        >
          {label}
        </span>
      )}
    </span>
  )
}