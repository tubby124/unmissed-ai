import Link from 'next/link'

interface CampaignStat {
  id: string
  business_name: string
  slug: string
  total_calls: number
  hot_leads: number
  last_call_at: string | null
  daily_counts: number[]  // last 7 days, oldest first
}

function MiniSparkline({ counts }: { counts: number[] }) {
  const max = Math.max(...counts, 1)
  return (
    <div className="flex items-end gap-0.5 h-8">
      {counts.map((count, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-blue-500/35 transition-all"
          style={{ height: `${Math.max(2, (count / max) * 28)}px` }}
        />
      ))}
    </div>
  )
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

export default function CampaignCard({ campaign }: { campaign: CampaignStat }) {
  const hotRate = campaign.total_calls > 0
    ? Math.round((campaign.hot_leads / campaign.total_calls) * 100)
    : 0

  return (
    <Link
      href={`/dashboard/calls?client=${campaign.id}`}
      className="block rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 hover:bg-white/[0.03] hover:border-white/[0.10] transition-all group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-100 truncate group-hover:text-white transition-colors">
            {campaign.business_name}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {campaign.last_call_at ? `Last call ${timeAgo(campaign.last_call_at)}` : 'No calls yet'}
          </p>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          className="shrink-0 text-zinc-700 group-hover:text-zinc-400 transition-colors mt-0.5"
        >
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mb-4">
        <div>
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Calls</p>
          <p className="text-xl font-bold font-mono text-zinc-100 tabular-nums">{campaign.total_calls}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Hot</p>
          <p className="text-xl font-bold font-mono text-red-300 tabular-nums">{campaign.hot_leads}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Hot %</p>
          <p className={`text-xl font-bold font-mono tabular-nums ${hotRate >= 20 ? 'text-green-300' : hotRate >= 10 ? 'text-amber-300' : 'text-zinc-400'}`}>
            {hotRate}%
          </p>
        </div>
      </div>

      {/* Sparkline */}
      <MiniSparkline counts={campaign.daily_counts} />
      <p className="text-[9px] text-zinc-700 mt-1 font-mono">7-day volume</p>
    </Link>
  )
}
