interface StatusBadgeProps {
  status: string | null
  showDot?: boolean
}

const STATUS_CONFIG: Record<string, {
  bg: string; text: string; border: string; dot: string; label: string; glow: string
}> = {
  HOT:        { bg: 'bg-red-500/15',    text: 'text-red-400',    border: 'border-red-500/30',    dot: 'bg-red-500',    label: 'HOT',        glow: '0 0 10px rgba(239,68,68,0.35), 0 0 20px rgba(239,68,68,0.1)' },
  WARM:       { bg: 'bg-amber-500/15',  text: 'text-amber-400',  border: 'border-amber-500/30',  dot: 'bg-amber-500',  label: 'WARM',       glow: '0 0 10px rgba(245,158,11,0.35), 0 0 20px rgba(245,158,11,0.1)' },
  COLD:       { bg: 'bg-blue-400/15',   text: 'text-blue-300',   border: 'border-blue-400/30',   dot: 'bg-blue-400',   label: 'COLD',       glow: '0 0 10px rgba(96,165,250,0.25), 0 0 18px rgba(96,165,250,0.08)' },
  JUNK:       { bg: 'bg-zinc-500/15',   text: 'text-zinc-500',   border: 'border-zinc-500/25',   dot: 'bg-zinc-500',   label: 'JUNK',       glow: '' },
  live:       { bg: 'bg-green-500/15',  text: 'text-green-400',  border: 'border-green-500/30',  dot: 'bg-green-500',  label: 'LIVE',       glow: '0 0 12px rgba(34,197,94,0.5), 0 0 24px rgba(34,197,94,0.15)' },
  processing: { bg: 'bg-yellow-500/15', text: 'text-yellow-300', border: 'border-yellow-500/25', dot: 'bg-yellow-500', label: 'Processing', glow: '0 0 10px rgba(234,179,8,0.3)' },
}

const DEFAULT = { bg: 'bg-zinc-500/15', text: 'text-zinc-500', border: 'border-zinc-500/20', dot: 'bg-zinc-500', label: '—', glow: '' }

function StatusIcon({ status }: { status: string | null }) {
  if (status === 'HOT') return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
      <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 01-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (status === 'WARM') return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
  if (status === 'COLD') return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
      <line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M20 16l-8-4M4 16l8-4M20 8l-8 4M4 8l8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
  if (status === 'JUNK') return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
  return null
}

export default function StatusBadge({ status, showDot = true }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status ?? ''] ?? DEFAULT
  const isAnimated = status === 'processing' || status === 'live'

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}
      style={cfg.glow ? { boxShadow: cfg.glow } : undefined}
    >
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${isAnimated ? 'animate-pulse' : ''}`} />
      )}
      <StatusIcon status={status} />
      {cfg.label}
    </span>
  )
}
