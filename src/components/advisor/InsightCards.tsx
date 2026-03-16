'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'

interface InsightCard {
  id: string
  type: string
  title: string
  value: string
  prompt: string
  priority: number
}

interface InsightCardsProps {
  onSelectPrompt: (prompt: string) => void
}

const CARD_ICONS: Record<string, string> = {
  hot_leads: '🔥',
  follow_up: '⏰',
  quality_trend: '📈',
  busiest_day: '📅',
  peak_hours: '🕐',
  sentiment: '😊',
  missed_calls: '📵',
  transcript_highlight: '💬',
}

export default function InsightCards({ onSelectPrompt }: InsightCardsProps) {
  const [cards, setCards] = useState<InsightCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchInsights() {
      try {
        const supabase = createBrowserClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token || cancelled) {
          setLoading(false)
          return
        }

        const res = await fetch('/api/advisor/insights', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        if (!res.ok || cancelled) {
          setLoading(false)
          return
        }

        const data = await res.json()
        if (!cancelled && data.cards) {
          setCards(data.cards)
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchInsights()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div
          className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: 'var(--color-border)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <p className="text-sm" style={{ color: 'var(--color-text-3)' }}>
          Ask anything about your business, calls, or agent.
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <p
        className="text-xs font-medium uppercase tracking-wider mb-3"
        style={{ color: 'var(--color-text-3)' }}
      >
        Quick insights
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelectPrompt(card.prompt)}
            className="flex items-start gap-3 rounded-xl px-3.5 py-3 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{
              backgroundColor: 'var(--color-bg-raised)',
              border: '1px solid var(--color-border)',
            }}
          >
            <span className="text-lg mt-0.5 shrink-0">
              {CARD_ICONS[card.type] || '📊'}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className="text-sm font-medium truncate"
                style={{ color: 'var(--color-text-1)' }}
              >
                {card.title}
              </p>
              <p
                className="text-xs mt-0.5 line-clamp-2"
                style={{ color: 'var(--color-text-3)' }}
              >
                {card.value}
              </p>
            </div>
            <svg
              className="h-4 w-4 mt-1 shrink-0"
              style={{ color: 'var(--color-text-3)' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}
