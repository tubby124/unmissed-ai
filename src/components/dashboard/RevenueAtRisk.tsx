'use client'

import Link from 'next/link'

interface CallLog {
  id: string
  call_status: string | null
  started_at: string | null
}

interface RevenueAtRiskProps {
  calls: CallLog[]
}

export default function RevenueAtRisk({ calls }: RevenueAtRiskProps) {
  const now = Date.now()
  const overdueHot = calls.filter(
    c => c.call_status === 'HOT' &&
      c.started_at != null &&
      (now - new Date(c.started_at).getTime()) > 60 * 60 * 1000
  )

  if (overdueHot.length === 0) return null

  const count = overdueHot.length
  const maxAgeHours = Math.floor(
    Math.max(...overdueHot.map(c => now - new Date(c.started_at!).getTime())) / 3600000
  )
  const value = count * 400

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-sm">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-amber-500 dark:text-amber-400 shrink-0">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
      <p className="flex-1 text-amber-700 dark:text-amber-300/90">
        {count} hot lead{count > 1 ? 's' : ''} waiting {maxAgeHours}h+ — ~${value.toLocaleString()} at risk
      </p>
      <Link
        href="/dashboard/leads"
        className="shrink-0 text-amber-600 dark:text-amber-400 font-medium hover:text-amber-700 dark:hover:text-amber-300 transition-colors flex items-center gap-1"
      >
        View queue
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </Link>
    </div>
  )
}
