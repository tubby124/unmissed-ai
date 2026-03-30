'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { ExternalLink } from 'lucide-react'

interface Gap {
  query: string
  count: number
  first_seen: string
  last_seen: string
}

interface Props {
  clientId: string
}

export default function UnansweredQuestionsTile({ clientId }: Props) {
  const [gaps, setGaps] = useState<Gap[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expandedGap, setExpandedGap] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)

  const fetchGaps = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/dashboard/knowledge/gaps?client_id=${clientId}&days=30&limit=5`
      )
      if (!res.ok) return
      const data = await res.json()
      setGaps(data.gaps ?? [])
      setTotal(data.total ?? data.gaps?.length ?? 0)
    } catch {
      // silently fail — tile is non-critical
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { fetchGaps() }, [fetchGaps])

  const handleExpand = useCallback(async (query: string) => {
    if (expandedGap === query) {
      setExpandedGap(null)
      return
    }
    setExpandedGap(query)
    setAnswerText('')
    setSuggesting(true)
    try {
      const res = await fetch('/api/dashboard/knowledge/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, query }),
      })
      if (res.ok) {
        const data = await res.json()
        setAnswerText(data.answer ?? '')
      }
    } finally {
      setSuggesting(false)
    }
  }, [expandedGap, clientId])

  async function handleSave(query: string) {
    if (!answerText.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/dashboard/knowledge/gaps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          query,
          resolution_type: 'faq',
          answer: answerText.trim(),
        }),
      })
      if (res.ok) {
        setSavedCount(c => c + 1)
        setGaps(prev => prev.filter(g => g.query !== query))
        setExpandedGap(null)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSkip(query: string) {
    await fetch('/api/dashboard/knowledge/gaps', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, query, resolution_type: 'dismissed' }),
    })
    setGaps(prev => prev.filter(g => g.query !== query))
    if (expandedGap === query) setExpandedGap(null)
  }

  // hide tile when empty and no saves happened this session
  if (!loading && gaps.length === 0 && savedCount === 0) return null

  return (
    <motion.div
      className="rounded-2xl border b-theme bg-surface overflow-hidden"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.12 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b b-theme">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className="text-[12px] font-semibold t1">Unanswered Questions</span>
          {(gaps.length > 0 || total > 0) && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'rgb(239,68,68)' }}
            >
              {total > gaps.length ? total : gaps.length}
            </span>
          )}
        </div>
        <Link
          href="/dashboard/knowledge"
          className="flex items-center gap-1 text-[11px] t3 hover:t2 transition-colors"
        >
          View all
          <ExternalLink width={10} height={10} />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div
            className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : gaps.length === 0 && savedCount > 0 ? (
        <div className="px-5 py-6 text-center space-y-1.5">
          <p className="text-[12px] font-semibold t1">
            ✅ {savedCount} answer{savedCount !== 1 ? 's' : ''} saved
          </p>
          <p className="text-[11px] t3">Your agent now knows how to answer these</p>
          <Link
            href="/dashboard"
            className="inline-block mt-1 text-[11px] font-semibold hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-primary)' }}
          >
            Talk to your agent →
          </Link>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--color-hover)' }}>
          {gaps.map(gap => (
            <div key={gap.query}>
              {/* Row */}
              <div className="px-5 py-3 flex items-center gap-2">
                {gap.count >= 3 && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 uppercase tracking-wide"
                    style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'rgb(239,68,68)' }}
                  >
                    HOT
                  </span>
                )}
                <p className="flex-1 text-[12px] t1 leading-snug line-clamp-1 min-w-0">
                  {gap.query}
                </p>
                <span className="text-[10px] t3 font-mono shrink-0">{gap.count}×</span>
                <button
                  onClick={() => handleExpand(gap.query)}
                  className="text-[11px] font-semibold shrink-0 hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {expandedGap === gap.query ? 'Close' : 'Answer'}
                </button>
                <button
                  onClick={() => handleSkip(gap.query)}
                  className="text-[11px] t3 hover:t2 transition-colors shrink-0"
                >
                  Skip
                </button>
              </div>

              {/* Inline answer panel */}
              <AnimatePresence initial={false}>
                {expandedGap === gap.query && (
                  <motion.div
                    key="panel"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="px-5 pb-4 pt-1 space-y-2">
                      {suggesting ? (
                        <div className="flex items-center gap-2 py-1.5">
                          <div
                            className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                            style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
                          />
                          <span className="text-[11px] t3">Getting AI suggestion…</span>
                        </div>
                      ) : answerText ? (
                        <div
                          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] t3"
                          style={{ backgroundColor: 'var(--color-hover)' }}
                        >
                          <span>✨</span>
                          <span>AI suggested — edit as needed before saving</span>
                        </div>
                      ) : null}
                      <textarea
                        value={answerText}
                        onChange={e => setAnswerText(e.target.value)}
                        placeholder="Write your answer…"
                        rows={3}
                        className="w-full text-[12px] t1 rounded-lg px-3 py-2 resize-none outline-none"
                        style={{
                          backgroundColor: 'var(--color-hover)',
                          border: '1px solid var(--color-border)',
                        }}
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setExpandedGap(null); setAnswerText('') }}
                          className="text-[11px] t3 hover:t2 transition-colors px-2 py-1"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSave(gap.query)}
                          disabled={saving || !answerText.trim()}
                          className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-opacity disabled:opacity-40"
                          style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                        >
                          {saving ? 'Saving…' : 'Save as FAQ'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
