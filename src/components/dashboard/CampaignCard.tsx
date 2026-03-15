'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import NumberTicker from '@/components/ui/number-ticker'

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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, boxShadow: '0 8px 25px rgba(0,0,0,0.12)' }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
    <Link
      href={`/dashboard/calls?client=${campaign.id}`}
      className="block relative rounded-2xl border p-5 hover:bg-[var(--color-hover)] transition-all group hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
      style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate transition-colors" style={{ color: "var(--color-text-1)" }}>
            {campaign.business_name}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-3)" }}>
            {campaign.last_call_at ? `Last call ${timeAgo(campaign.last_call_at)}` : 'No calls yet'}
          </p>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          className="shrink-0 transition-all mt-0.5 group-hover:translate-x-0.5"
          style={{ color: "var(--color-text-3)" }}
        >
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--color-text-3)" }}>Calls</p>
          <p className="text-xl font-bold font-mono" style={{ color: "var(--color-text-1)" }}>
            <NumberTicker value={campaign.total_calls} delay={0.1} />
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--color-text-3)" }}>Hot</p>
          <p className="text-xl font-bold font-mono text-red-600 dark:text-red-300">
            <NumberTicker value={campaign.hot_leads} delay={0.2} />
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--color-text-3)" }}>Hot %</p>
          <p className={`text-xl font-bold font-mono ${hotRate >= 20 ? 'text-green-600 dark:text-green-300' : hotRate >= 10 ? 'text-amber-600 dark:text-amber-300' : 't3'}`}>
            <NumberTicker value={hotRate} delay={0.3} format={(n) => `${n}%`} />
          </p>
        </div>
      </div>

      {/* Sparkline */}
      <MiniSparkline counts={campaign.daily_counts} />
      <p className="text-[9px] mt-1 font-mono" style={{ color: "var(--color-text-3)" }}>7-day volume</p>
    </Link>
    </motion.div>
  )
}
