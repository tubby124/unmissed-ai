'use client'

import { type ReactNode } from 'react'
import { motion, AnimatePresence } from 'motion/react'

export interface SettingsSectionProps {
  id: string
  title: string
  subtitle?: string
  icon: ReactNode
  children: ReactNode
  isOpen: boolean
  onToggle: () => void
  accentColor?: 'zinc' | 'blue' | 'green' | 'indigo' | 'amber' | 'purple'
}

const palette = {
  zinc:   { iconBg: 'bg-zinc-500/10',    title: 'text-zinc-400',      chevron: 'text-zinc-500'        },
  blue:   { iconBg: 'bg-blue-500/10',    title: 'text-blue-400/80',   chevron: 'text-blue-400/50'     },
  green:  { iconBg: 'bg-emerald-500/10', title: 'text-emerald-400/80',chevron: 'text-emerald-400/50'  },
  indigo: { iconBg: 'bg-indigo-500/10',  title: 'text-indigo-400/80', chevron: 'text-indigo-400/50'   },
  amber:  { iconBg: 'bg-amber-500/10',   title: 'text-amber-400/80',  chevron: 'text-amber-400/50'    },
  purple: { iconBg: 'bg-purple-500/10',  title: 'text-purple-400/80', chevron: 'text-purple-400/50'   },
} as const

export default function SettingsSection({
  id,
  title,
  subtitle,
  icon,
  children,
  isOpen,
  onToggle,
  accentColor = 'zinc',
}: SettingsSectionProps) {
  const c = palette[accentColor]

  return (
    <div id={`settings-section-${id}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 py-3 px-1 group rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 focus-visible:ring-offset-zinc-900"
        aria-expanded={isOpen}
        aria-controls={`settings-section-content-${id}`}
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${c.iconBg} transition-colors`}>
          {icon}
        </div>
        <div className="flex-1 text-left min-w-0">
          <h3 className={`text-[11px] font-semibold tracking-[0.15em] uppercase ${c.title}`}>
            {title}
          </h3>
          {subtitle && (
            <p className="text-[10px] t3 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          className={`${c.chevron} group-hover:opacity-80 transition-all duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={`settings-section-content-${id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="space-y-4 pt-2 pb-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
