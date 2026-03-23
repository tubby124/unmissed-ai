'use client'

import { motion, AnimatePresence } from 'motion/react'

interface StatusBadgeProps {
  status: string | null
  showDot?: boolean
}

const STATUS_STYLES: Record<string, {
  style: React.CSSProperties
  label: string
}> = {
  HOT: {
    style: {
      backgroundColor: 'var(--color-error-tint)',
      color: 'var(--color-error)',
      borderColor: 'var(--color-error)',
    },
    label: 'HOT',
  },
  WARM: {
    style: {
      backgroundColor: 'var(--color-warning-tint)',
      color: 'var(--color-warning)',
      borderColor: 'var(--color-warning)',
    },
    label: 'WARM',
  },
  COLD: {
    style: {
      backgroundColor: 'var(--color-info-tint)',
      color: 'var(--color-info)',
      borderColor: 'var(--color-info)',
    },
    label: 'COLD',
  },
  JUNK: {
    style: {
      backgroundColor: 'color-mix(in srgb, var(--color-text-3) 12%, transparent)',
      color: 'var(--color-text-3)',
      borderColor: 'var(--color-text-3)',
    },
    label: 'JUNK',
  },
  MISSED: {
    style: {
      backgroundColor: 'var(--color-error-tint)',
      color: 'var(--color-error)',
      borderColor: 'var(--color-error)',
    },
    label: 'MISSED',
  },
  VOICEMAIL: {
    style: {
      backgroundColor: 'var(--color-warning-tint)',
      color: 'var(--color-warning)',
      borderColor: 'var(--color-warning)',
    },
    label: 'VOICEMAIL',
  },
  BOOKED: {
    style: {
      backgroundColor: 'var(--color-success-tint)',
      color: 'var(--color-success)',
      borderColor: 'var(--color-success)',
    },
    label: 'BOOKED',
  },
  COMPLETED: {
    style: {
      backgroundColor: 'var(--color-success-tint)',
      color: 'var(--color-success)',
      borderColor: 'var(--color-success)',
    },
    label: 'COMPLETED',
  },
  UNKNOWN: {
    style: {
      backgroundColor: 'color-mix(in srgb, var(--color-text-3) 12%, transparent)',
      color: 'var(--color-text-3)',
      borderColor: 'var(--color-text-3)',
    },
    label: 'Unclassified',
  },
  trial: {
    style: {
      backgroundColor: 'color-mix(in srgb, #f59e0b 10%, transparent)',
      color: '#f59e0b',
      borderColor: 'color-mix(in srgb, #f59e0b 30%, transparent)',
    },
    label: 'Trial',
  },
  live: {
    style: {
      backgroundColor: 'var(--color-success-tint)',
      color: 'var(--color-success)',
      borderColor: 'var(--color-success)',
    },
    label: 'LIVE',
  },
  processing: {
    style: {
      backgroundColor: 'var(--color-warning-tint)',
      color: 'var(--color-warning)',
      borderColor: 'var(--color-warning)',
    },
    label: 'Processing',
  },
}

const DEFAULT_STYLE = {
  style: {
    backgroundColor: 'color-mix(in srgb, var(--color-text-3) 12%, transparent)',
    color: 'var(--color-text-3)',
    borderColor: 'var(--color-text-3)',
  } as React.CSSProperties,
  label: '—',
}

export default function StatusBadge({ status, showDot = true }: StatusBadgeProps) {
  const cfg = STATUS_STYLES[status ?? ''] ?? DEFAULT_STYLE
  const isLive = status === 'live'

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={status ?? 'none'}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 18 }}
        className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border"
        style={cfg.style}
      >
        {isLive && (
          <span className="relative flex w-1.5 h-1.5 mr-1">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: 'var(--color-success)' }}
            />
            <span
              className="relative inline-flex rounded-full w-1.5 h-1.5"
              style={{ backgroundColor: 'var(--color-success)' }}
            />
          </span>
        )}
        {cfg.label}
      </motion.span>
    </AnimatePresence>
  )
}
