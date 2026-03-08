interface StatusBadgeProps {
  status: string | null
  showDot?: boolean
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
  HOT:        { bg: 'bg-red-500/15',    text: 'text-red-400',    border: 'border-red-500/25',    dot: 'bg-red-500',    label: 'HOT' },
  WARM:       { bg: 'bg-amber-500/15',  text: 'text-amber-400',  border: 'border-amber-500/25',  dot: 'bg-amber-500',  label: 'WARM' },
  COLD:       { bg: 'bg-blue-400/15',   text: 'text-blue-300',   border: 'border-blue-400/25',   dot: 'bg-blue-400',   label: 'COLD' },
  JUNK:       { bg: 'bg-zinc-500/15',   text: 'text-zinc-400',   border: 'border-zinc-500/25',   dot: 'bg-zinc-500',   label: 'JUNK' },
  live:       { bg: 'bg-green-500/15',  text: 'text-green-400',  border: 'border-green-500/25',  dot: 'bg-green-500',  label: 'LIVE' },
  processing: { bg: 'bg-yellow-500/15', text: 'text-yellow-300', border: 'border-yellow-500/25', dot: 'bg-yellow-500', label: 'processing' },
}

const DEFAULT = { bg: 'bg-zinc-500/15', text: 'text-zinc-400', border: 'border-zinc-500/25', dot: 'bg-zinc-500', label: '—' }

export default function StatusBadge({ status, showDot = true }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status ?? ''] ?? DEFAULT
  const isProcessing = status === 'processing'
  const isLive = status === 'live'

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${isProcessing || isLive ? 'animate-pulse' : ''}`} />
      )}
      {cfg.label}
    </span>
  )
}
