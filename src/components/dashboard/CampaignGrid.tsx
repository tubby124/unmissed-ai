'use client'

import { useState } from 'react'
import CampaignCard from './CampaignCard'

interface Campaign {
  id: string
  business_name: string
  slug: string
  niche: string | null
  status: string | null
  twilio_number: string | null
  total_calls: number
  hot_leads: number
  last_call_at: string | null
  daily_counts: number[]
}

const PROTECTED_SLUGS = ['hasan-sharif', 'windshield-hub', 'urban-vibe', 'manzil-isa']

function isTestClient(c: Campaign): boolean {
  if (PROTECTED_SLUGS.includes(c.slug)) return false
  if (c.slug.startsWith('e2e-test-')) return true
  if (c.slug.startsWith('test-')) return true
  if (c.status === 'setup') return true
  return false
}

type Filter = 'all' | 'real' | 'test'

export default function CampaignGrid({ campaigns }: { campaigns: Campaign[] }) {
  const [filter, setFilter] = useState<Filter>('all')

  const realCount = campaigns.filter(c => !isTestClient(c)).length
  const testCount = campaigns.filter(c => isTestClient(c)).length

  const filtered = filter === 'all'
    ? campaigns
    : filter === 'real'
      ? campaigns.filter(c => !isTestClient(c))
      : campaigns.filter(c => isTestClient(c))

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: campaigns.length },
    { key: 'real', label: 'Real', count: realCount },
    { key: 'test', label: 'Test', count: testCount },
  ]

  return (
    <>
      {/* Filter tabs */}
      {testCount > 0 && (
        <div className="flex items-center gap-1">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                filter === f.key
                  ? 'bg-[var(--color-hover)] border-[var(--color-border)]'
                  : 'border-transparent hover:bg-[var(--color-hover)]'
              }`}
              style={{ color: filter === f.key ? 'var(--color-text-1)' : 'var(--color-text-3)' }}
            >
              {f.label} <span className="font-mono ml-0.5">{f.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 t3">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="opacity-25">
            <rect x="18" y="3" width="4" height="18" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="10" y="8" width="4" height="13" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="2" y="13" width="4" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <p className="text-sm">No clients provisioned yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(campaign => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}
    </>
  )
}
