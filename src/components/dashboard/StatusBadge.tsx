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
      {cfg.label}
    </span>
  )
}
