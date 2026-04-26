'use client'

import Link from 'next/link'

const ACTIONS: { id: string; label: string; icon: React.ReactNode }[] = [
  {
    id: 'upload',
    label: 'Upload',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'scrape',
    label: 'Scrape',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.75" />
        <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'compile',
    label: 'AI Compile',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'chunks',
    label: 'Browse',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.75" />
        <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    ),
  },
]

export default function KnowledgeQuickAddCard() {
  return (
    <div
      className="rounded-2xl border p-5 space-y-4 h-full flex flex-col"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div>
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Quick Add</p>
        <p className="text-[11px] t3 mt-1">Teach your agent something new in one tap.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 flex-1">
        {ACTIONS.map(action => (
          <Link
            key={action.id}
            href={`/dashboard/knowledge?quickAdd=${action.id}`}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors duration-200 hover:border-[var(--color-primary)] cursor-pointer"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-2)',
              backgroundColor: 'transparent',
            }}
          >
            <span className="t3 shrink-0">{action.icon}</span>
            <span className="text-[11px] font-medium">{action.label}</span>
          </Link>
        ))}
      </div>

      <p className="text-[10px] t3">Each opens the right drawer on Knowledge.</p>
    </div>
  )
}
