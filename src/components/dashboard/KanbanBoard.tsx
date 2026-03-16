'use client'

import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'

interface CallLog {
  id: string
  ultravox_call_id: string
  caller_phone: string | null
  call_status: string | null
  ai_summary: string | null
  service_type: string | null
  duration_seconds: number | null
  started_at: string
  business_name?: string | null
}

function fmtDur(secs: number | null) {
  if (!secs) return null
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (days > 0) return `${days}d`
  if (hrs > 0) return `${hrs}h`
  if (mins > 0) return `${mins}m`
  return 'now'
}

const COLUMNS: { status: string; label: string; dotClass: string; emptyLabel: string; isPulse?: boolean }[] = [
  { status: 'live', label: 'Live', dotClass: 'bg-emerald-500', emptyLabel: 'No active calls', isPulse: true },
  { status: 'HOT', label: 'Hot', dotClass: 'bg-red-500', emptyLabel: 'No hot leads' },
  { status: 'WARM', label: 'Warm', dotClass: 'bg-amber-500', emptyLabel: 'No warm leads' },
  { status: 'COLD', label: 'Cold', dotClass: 'bg-blue-500', emptyLabel: 'No cold leads' },
  { status: 'JUNK', label: 'Junk', dotClass: 'bg-gray-400', emptyLabel: 'No junk calls' },
]

function KanbanCard({ call }: { call: CallLog }) {
  const dur = fmtDur(call.duration_seconds)
  const snippet = call.ai_summary
    ? `${call.ai_summary.slice(0, 80)}${call.ai_summary.length > 80 ? '…' : ''}`
    : null

  return (
    <Link
      href={`/dashboard/calls/${call.ultravox_call_id}`}
      className="block rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow duration-150 p-3 cursor-pointer dark:bg-[var(--color-surface)] dark:border-[var(--color-border)]"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="font-mono text-xs font-medium text-gray-800 dark:text-gray-200 flex-1 truncate">
          {call.caller_phone || 'Unknown'}
        </span>
        {dur && (
          <span className="text-[10px] font-mono tabular-nums text-gray-400 shrink-0">{dur}</span>
        )}
        <span className="text-[10px] font-mono tabular-nums text-gray-400 shrink-0">{timeAgo(call.started_at)}</span>
      </div>
      {snippet && (
        <p className="text-[11px] italic text-gray-400 leading-snug line-clamp-2">{snippet}</p>
      )}
      {call.business_name && (
        <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-1 truncate">{call.business_name}</p>
      )}
    </Link>
  )
}

export default function KanbanBoard({ calls, showBusiness }: { calls: CallLog[]; showBusiness?: boolean }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px] -mx-1 px-1">
      {COLUMNS.map(col => {
        const colCalls = calls.filter(c => c.call_status === col.status)
        return (
          <div key={col.status} className="flex-shrink-0 w-64">
            {/* Column header */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="relative flex w-2 h-2 shrink-0">
                {col.isPulse && (
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${col.dotClass} opacity-75`} />
                )}
                <span className={`relative inline-flex rounded-full w-2 h-2 ${col.dotClass}`} />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {col.label}
              </span>
              <span className="ml-auto text-[10px] font-bold bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400 rounded-full px-2 py-0.5 tabular-nums">
                {colCalls.length}
              </span>
            </div>

            {/* Cards */}
            <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
              {colCalls.length > 0
                ? (
                  <AnimatePresence mode="popLayout">
                    {colCalls.map(call => (
                      <motion.div
                        key={call.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ y: -2, boxShadow: '0 8px 25px rgba(0,0,0,0.15)' }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        style={col.status === 'live' ? { boxShadow: '0 0 0 1px rgba(16,185,129,0.3), 0 0 12px rgba(16,185,129,0.15)' } : col.status === 'HOT' ? { borderLeft: '3px solid #ef4444' } : undefined}
                      >
                        <KanbanCard call={call} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )
                : (
                  <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-zinc-700 p-4 text-center">
                    <p className="text-xs text-gray-400 dark:text-gray-600">{col.emptyLabel}</p>
                  </div>
                )
              }
            </div>
          </div>
        )
      })}
    </div>
  )
}
