'use client'

import { AnimatePresence, motion } from 'motion/react'

export interface CapabilityRowProps {
  label: string
  description: string
  flavorText?: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
  badge?: string
}

/**
 * Shared checkbox-style capability toggle row.
 * Used in step3-capabilities (onboarding) and any future
 * dashboard surface that needs a plan-gated feature toggle.
 */
export function CapabilityRow({
  label,
  description,
  flavorText,
  checked,
  disabled = false,
  onChange,
  badge,
}: CapabilityRowProps) {
  return (
    <div
      className={`rounded-xl border-2 p-4 transition-all ${
        checked
          ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20'
          : 'border-border bg-card'
      } ${disabled ? 'opacity-75' : ''}`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => !disabled && onChange(!checked)}
          className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border-2 transition-colors shrink-0 ${
            checked ? 'bg-indigo-600 border-indigo-600' : 'border-border bg-background'
          } ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
        >
          {checked && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground">{label}</p>
            {badge && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          <AnimatePresence>
            {checked && flavorText && (
              <motion.p
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 6 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.2 }}
                className="text-xs text-indigo-700 dark:text-indigo-300 italic border-l-2 border-indigo-300 dark:border-indigo-700 pl-2"
              >
                {flavorText}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
