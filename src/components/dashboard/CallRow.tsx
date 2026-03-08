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

export default function CallRow({ call, showBusiness }: { call: CallLog; showBusiness?: boolean }) {
  const dur = fmtDur(call.duration_seconds)

  return (
    <Link
      href={`/dashboard/calls/${call.ultravox_call_id}`}
      className="flex items-center gap-4 px-5 py-4 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer group"
    >
      {/* Status dot */}
      <span className={`w-2 h-2 rounded-full shrink-0 ${
        call.call_status === 'HOT' ? 'bg-red-500' :
        call.call_status === 'WARM' ? 'bg-amber-500' :
        call.call_status === 'COLD' ? 'bg-blue-400' :
        call.call_status === 'live' ? 'bg-green-500 animate-pulse' :
        call.call_status === 'processing' ? 'bg-yellow-500 animate-pulse' :
        'bg-zinc-500'
      }`} />

      {/* Phone + badge */}
      <div className="flex items-center gap-2 min-w-0 w-44 shrink-0">
        <span className="font-mono text-sm text-zinc-200 truncate">
          {call.caller_phone || 'Unknown'}
        </span>
        <StatusBadge status={call.call_status} showDot={false} />
      </div>

      {/* Business name (admin all-clients view) */}
      {showBusiness && (
        <span className="text-xs text-zinc-500 shrink-0 w-36 truncate hidden md:block">
          {call.business_name || '—'}
        </span>
      )}

      {/* Summary */}
      <p className="flex-1 text-sm text-zinc-500 truncate hidden sm:block">
        {call.ai_summary || (call.call_status === 'processing' ? 'Processing…' : '—')}
      </p>

      {/* Time + duration */}
      <div className="text-right shrink-0 space-y-0.5">
        <p className="text-xs font-mono text-zinc-500">{timeAgo(call.started_at)}</p>
        {dur && <p className="text-xs font-mono text-zinc-600">{dur}</p>}
      </div>

      {/* Chevron */}
      <svg
        width="16" height="16" viewBox="0 0 24 24" fill="none"
        className="shrink-0 text-zinc-700 group-hover:text-zinc-400 transition-colors"
      >
        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </Link>
  )
}
