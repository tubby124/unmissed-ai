'use client'

import Link from 'next/link'

export default function ForwardingBanner({ twilioNumber }: { twilioNumber?: string | null }) {
  return (
    <div className="mx-4 sm:mx-6 mt-4 flex items-center gap-3 py-3 px-4 rounded-xl bg-amber-500/[0.07] border border-amber-500/20">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-amber-500/10">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 8.96a19.79 19.79 0 01-3.07-8.67A2 2 0 012.88 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-300">Set up call forwarding to start receiving calls</p>
        {twilioNumber && (
          <p className="text-xs text-amber-400/60 mt-0.5">Forward your business line to {twilioNumber}</p>
        )}
      </div>
      <Link
        href="/dashboard/setup"
        className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 transition-colors"
      >
        Set up now
      </Link>
    </div>
  )
}
