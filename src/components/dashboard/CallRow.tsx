import Link from 'next/link'
import StatusBadge from './StatusBadge'

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

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (days > 0) return `${days}d ago`
  if (hrs > 0) return `${hrs}h ago`
  if (mins > 0) return `${mins}m ago`
  return 'just now'
}

function fmtDur(secs: number | null) {
  if (!secs) return null
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

const STATUS_DOT: Record<string, string> = {
  HOT:        'bg-red-500',
  WARM:       'bg-amber-500',
  COLD:       'bg-blue-400',
  JUNK:       'bg-zinc-600',
  live:       'bg-green-500 animate-pulse',
  processing: 'bg-yellow-500 animate-pulse',
}

export default function CallRow({ call, showBusiness }: { call: CallLog; showBusiness?: boolean }) {
  const dur = fmtDur(call.duration_seconds)
  const dot = STATUS_DOT[call.call_status ?? ''] ?? 'bg-zinc-600'

  return (
    <Link
      href={`/dashboard/calls/${call.ultravox_call_id}`}
      className="flex items-center gap-4 px-5 py-3.5 border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors cursor-pointer group"
    >
      {/* Status dot */}
      <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />

      {/* Phone + status badge */}
      <div className="flex flex-col gap-0.5 min-w-0 w-40 shrink-0">
        <span className="font-mono text-[13px] text-zinc-100 font-medium truncate tracking-tight">
          {call.caller_phone || 'Unknown'}
        </span>
        <div className="flex items-center gap-1.5">
          <StatusBadge status={call.call_status} showDot={false} />
          {call.service_type && (
            <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider hidden sm:inline">
              {call.service_type.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      </div>

      {/* Business name (admin all-clients view) */}
      {showBusiness && (
        <span className="text-xs text-zinc-500 shrink-0 w-32 truncate hidden md:block">
          {call.business_name || '—'}
        </span>
      )}

      {/* Summary */}
      <p className="flex-1 text-sm text-zinc-600 truncate hidden sm:block leading-snug">
        {call.ai_summary || (call.call_status === 'processing' ? 'Analyzing call…' : '—')}
      </p>

      {/* Time + duration */}
      <div className="text-right shrink-0 space-y-0.5">
        <p className="text-xs font-mono text-zinc-500 tabular-nums">{timeAgo(call.started_at)}</p>
        {dur && <p className="text-xs font-mono text-zinc-700 tabular-nums">{dur}</p>}
      </div>

      {/* Chevron */}
      <svg
        width="14" height="14" viewBox="0 0 24 24" fill="none"
        className="shrink-0 text-zinc-700 group-hover:text-zinc-400 transition-colors"
      >
        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </Link>
  )
}
