'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

// ── Helpers ───────────────────────────────────────────────────────────────────

export function stripToDigits(num: string | null): string {
  if (!num) return ''
  const digits = num.replace(/\D/g, '')
  return digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits
}

export function fmtPhone(num: string | null): string {
  if (!num) return '—'
  const d = num.replace(/\D/g, '')
  if (d.length === 11 && d[0] === '1') {
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  }
  if (d.length === 10) {
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  }
  return num
}

// ── UI primitives ─────────────────────────────────────────────────────────────

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }}
      aria-label={label ? `Copy ${label}` : 'Copy to clipboard'}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 shrink-0 cursor-pointer ${
        copied
          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
          : 't3 b-theme hover:t1 hover:b-theme hover:bg-hover'
      }`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="copied"
            className="flex items-center gap-1.5"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {label ? 'Copied!' : 'Copied'}
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            className="flex items-center gap-1.5"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            {label ?? 'Copy'}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}

export function CodeRow({ label, code }: { label: string; code: string }) {
  return (
    <motion.div
      className="flex items-center gap-3 py-2.5 border-b b-theme last:border-0"
      whileHover={{ scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      <span className="text-xs t3 w-48 shrink-0">{label}</span>
      <span className="flex-1 font-mono text-sm t1">{code}</span>
      <CopyButton value={code} />
    </motion.div>
  )
}

export function SectionLabel({ num, label }: { num: string; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-6 h-6 rounded-md bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
        <span className="text-[9px] font-black font-mono text-blue-400 tracking-wider">{num}</span>
      </div>
      <span className="text-xs font-semibold t2 uppercase tracking-[0.1em]">{label}</span>
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, var(--color-border), transparent)' }} />
    </div>
  )
}

export function InlineNotes({ notes }: { notes: string[] }) {
  if (!notes.length) return null
  return (
    <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] px-4 py-3 space-y-2">
      {notes.map((note, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <svg className="text-amber-500/60 shrink-0 mt-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p className="text-[11px] text-amber-400 leading-relaxed">{note}</p>
        </div>
      ))}
    </div>
  )
}

export function ActiveBadge() {
  return (
    <div className="flex items-center justify-center gap-3 py-4 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/20">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
      </span>
      <span className="text-emerald-400 font-semibold text-sm">Agent Active — Forwarding is On</span>
    </div>
  )
}

export function MarkActiveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3.5 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/20 text-emerald-400 font-semibold text-sm hover:bg-emerald-500/[0.12] hover:border-emerald-500/35 transition-all duration-150 cursor-pointer flex items-center justify-center gap-2"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Done dialing — Mark Agent Active
    </button>
  )
}

export function ConfirmActivation({ onConfirmed }: { onConfirmed: () => void }) {
  const [step, setStep] = useState<'idle' | 'confirm'>('idle')
  const CheckIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (step === 'idle') {
    return (
      <button
        onClick={() => setStep('confirm')}
        className="w-full py-3.5 rounded-xl bg-input border b-theme t2 font-semibold text-sm hover:bg-hover hover:t1 transition-all duration-150 cursor-pointer flex items-center justify-center gap-2"
      >
        {CheckIcon}
        I&apos;ve dialed all the codes
      </button>
    )
  }
  return (
    <div className="space-y-3">
      <p className="text-[11px] t3 text-center">
        Call your business number from another phone. If your AI agent answers, forwarding is live.
      </p>
      <button
        onClick={onConfirmed}
        className="w-full py-3.5 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/20 text-emerald-400 font-semibold text-sm hover:bg-emerald-500/[0.12] hover:border-emerald-500/35 transition-all duration-150 cursor-pointer flex items-center justify-center gap-2"
      >
        {CheckIcon}
        Yes, it worked — agent is live
      </button>
    </div>
  )
}

export function StarCard({ stepNum, label, desc, code, icon }: {
  stepNum: string; label: string; desc: string; code: string; icon: React.ReactNode
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border b-theme bg-input transition-all duration-200 hover:border-blue-500/20 hover:shadow-[0_0_24px_rgba(59,130,246,0.06)]">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-5 py-4 border-b b-theme bg-surface">
        <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center shrink-0 text-blue-400">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold t1">{label}</p>
          <p className="text-[11px] t3 mt-0.5">{desc}</p>
        </div>
        <span className="text-[9px] font-black font-mono t1 tracking-[0.15em] shrink-0">{stepNum}</span>
      </div>
      {/* Code block */}
      <div className="px-5 py-5 flex items-center gap-3">
        <div className="flex-1 font-mono text-2xl font-bold t1 tracking-wider text-center py-3.5 rounded-xl bg-black/80 border b-theme group-hover:border-blue-500/[0.08] transition-colors">
          {code}
        </div>
        <CopyButton value={code} />
      </div>
      <p className="pb-4 text-[10px] t1 text-center">Dial this code, then press the green Call button</p>
    </div>
  )
}
