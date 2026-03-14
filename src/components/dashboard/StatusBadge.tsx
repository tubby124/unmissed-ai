interface StatusBadgeProps {
  status: string | null
  showDot?: boolean
}

const STATUS_CONFIG: Record<string, { className: string; label: string }> = {
  HOT:        { className: 'bg-red-500 text-white',                                                                             label: 'HOT' },
  WARM:       { className: 'bg-amber-500 text-white',                                                                           label: 'WARM' },
  COLD:       { className: 'bg-blue-500 text-white',                                                                            label: 'COLD' },
  JUNK:       { className: 'bg-gray-100 text-gray-500 dark:bg-zinc-700 dark:text-zinc-300',                                    label: 'JUNK' },
  MISSED:     { className: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',                         label: 'MISSED' },
  live:       { className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',                     label: 'LIVE' },
  processing: { className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',                             label: 'Processing' },
}

const DEFAULT = { className: 'bg-gray-100 text-gray-500 dark:bg-zinc-700 dark:text-zinc-300', label: '—' }

export default function StatusBadge({ status, showDot = true }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status ?? ''] ?? DEFAULT
  const isLive = status === 'live'

  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.className}`}>
      {isLive && (
        <span className="relative flex w-1.5 h-1.5 mr-1">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-emerald-500" />
        </span>
      )}
      {cfg.label}
    </span>
  )
}
