'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createBrowserClient } from '@/lib/supabase/client'

interface UnansweredQuestion {
  question: string
  confidence: 'high' | 'medium' | 'low'
}

interface CallGapReviewProps {
  callId: string    // call_logs.id (UUID) — matches call_insights.call_id
  clientId: string
  isAdmin?: boolean
}

export default function CallGapReview({ callId, clientId, isAdmin = false }: CallGapReviewProps) {
  const [questions, setQuestions] = useState<UnansweredQuestion[]>([])
  const [loaded, setLoaded] = useState(false)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [answer, setAnswer] = useState('')
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resolvedIdxs, setResolvedIdxs] = useState<Set<number>>(new Set())

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase
      .from('call_insights')
      .select('unanswered_questions')
      .eq('call_id', callId)
      .maybeSingle()
      .then(({ data }) => {
        const raw = data?.unanswered_questions
        if (Array.isArray(raw) && raw.length > 0) {
          setQuestions(raw as UnansweredQuestion[])
        }
        setLoaded(true)
      })
  }, [callId])

  async function fetchSuggestedAnswer(question: string) {
    setSuggestLoading(true)
    setAnswer('')
    try {
      const res = await fetch('/api/dashboard/knowledge/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: question, ...(isAdmin ? { client_id: clientId } : {}) }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.suggestion?.content) {
          setAnswer(data.suggestion.content)
        }
      }
    } catch {
      // Ignore — user types manually
    } finally {
      setSuggestLoading(false)
    }
  }

  function handleExpand(idx: number) {
    if (expandedIdx === idx) {
      setExpandedIdx(null)
      setAnswer('')
      return
    }
    setExpandedIdx(idx)
    setAnswer('')
    fetchSuggestedAnswer(questions[idx].question)
  }

  async function handleSave(destination: 'faq' | 'knowledge') {
    if (!answer.trim() || expandedIdx === null || saving) return
    const q = questions[expandedIdx]
    setSaving(true)
    try {
      if (destination === 'faq') {
        const supabase = createBrowserClient()
        const { data: row, error: fetchErr } = await supabase
          .from('clients')
          .select('extra_qa')
          .eq('id', clientId)
          .single()
        if (fetchErr) throw new Error('Failed to load current FAQs')
        const currentQa = Array.isArray(row?.extra_qa)
          ? (row.extra_qa as { q: string; a: string }[])
          : []
        const newQa = [...currentQa, { q: q.question, a: answer.trim() }]
        const res = await fetch('/api/dashboard/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            extra_qa: newQa,
            ...(isAdmin ? { client_id: clientId } : {}),
          }),
        })
        if (!res.ok) throw new Error('Failed to save FAQ')
      } else {
        const res = await fetch('/api/dashboard/knowledge/chunks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId,
            content: `Q: ${q.question}\nA: ${answer.trim()}`,
            source: 'gap_answer',
            auto_approve: true,
          }),
        })
        if (!res.ok) throw new Error('Failed to add to knowledge base')
      }

      // Mark gap resolved — fire-and-forget (non-blocking for UX)
      fetch('/api/dashboard/knowledge/gaps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q.question,
          resolution_type: destination,
          ...(isAdmin ? { client_id: clientId } : {}),
        }),
      }).catch(() => { /* non-fatal */ })

      toast.success(
        destination === 'faq'
          ? 'Added as FAQ — your agent will know this on every call'
          : 'Added to knowledge base — searchable immediately'
      )
      setResolvedIdxs(prev => new Set(prev).add(expandedIdx!))
      setExpandedIdx(null)
      setAnswer('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!loaded || questions.length === 0) return null

  const allResolved = questions.every((_, i) => resolvedIdxs.has(i))

  return (
    <div
      className="rounded-2xl border p-5"
      style={{ borderColor: 'rgba(245,158,11,0.2)', backgroundColor: 'rgba(245,158,11,0.02)' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-amber-400 shrink-0">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M9 9a3 3 0 015.12 2.13c0 1.5-2.12 2-2.12 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="currentColor" strokeWidth="0.5"/>
        </svg>
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-amber-400/80">
          Agent didn&apos;t know {questions.length === 1 ? 'this' : `these ${questions.length}`}
        </p>
      </div>
      <p className="text-[11px] mb-3" style={{ color: 'var(--color-text-3)' }}>
        Teach your agent — approved answers become searchable on the next call.
      </p>

      <div className="space-y-2">
        {questions.map((q, idx) => {
          const isResolved = resolvedIdxs.has(idx)
          const isExpanded = expandedIdx === idx

          return (
            <div key={idx}>
              {isResolved ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-500/20 bg-green-500/[0.04]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-green-400 shrink-0">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-xs line-through" style={{ color: 'var(--color-text-3)' }}>{q.question}</span>
                </div>
              ) : (
                <button
                  onClick={() => handleExpand(idx)}
                  className="w-full text-left flex items-start gap-2 px-3 py-2 rounded-lg border transition-colors"
                  style={{
                    borderColor: isExpanded ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.15)',
                    backgroundColor: isExpanded ? 'rgba(245,158,11,0.05)' : 'transparent',
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-amber-400/60 shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M9 9a3 3 0 015.12 2.13c0 1.5-2.12 2-2.12 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="currentColor" strokeWidth="0.5"/>
                  </svg>
                  <span className="text-xs flex-1" style={{ color: 'var(--color-text-2)' }}>{q.question}</span>
                  <span
                    className="text-[10px] font-semibold shrink-0 px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: 'rgba(245,158,11,0.1)',
                      color: 'rgb(251,191,36)',
                      border: '1px solid rgba(245,158,11,0.2)',
                    }}
                  >
                    {isExpanded ? 'Cancel' : 'Teach'}
                  </span>
                </button>
              )}

              {isExpanded && (
                <div
                  className="mt-1.5 ml-2 p-3 rounded-xl border space-y-2"
                  style={{ borderColor: 'rgba(245,158,11,0.15)', backgroundColor: 'rgba(245,158,11,0.02)' }}
                >
                  {suggestLoading ? (
                    <p className="text-[11px] text-amber-400/60 animate-pulse">Finding best existing answer…</p>
                  ) : answer ? (
                    <p className="text-[10px] text-amber-400/60">AI-drafted from your knowledge base — edit if needed:</p>
                  ) : null}
                  <textarea
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    placeholder="Type the answer your agent should give…"
                    rows={3}
                    className="w-full border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-500/50 resize-none transition-colors"
                    style={{
                      backgroundColor: 'transparent',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-1)',
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSave('faq')}
                      disabled={saving || !answer.trim()}
                      className="flex-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/25 hover:bg-amber-500/25 disabled:opacity-40 transition-colors"
                    >
                      {saving ? 'Saving…' : 'Save as FAQ'}
                    </button>
                    <button
                      onClick={() => handleSave('knowledge')}
                      disabled={saving || !answer.trim()}
                      className="flex-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20 hover:bg-blue-500/20 disabled:opacity-40 transition-colors"
                    >
                      {saving ? 'Saving…' : 'Add to Knowledge'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {allResolved && resolvedIdxs.size > 0 && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'rgba(245,158,11,0.1)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-green-400 shrink-0">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-xs text-green-400">All gaps from this call addressed</p>
        </div>
      )}
    </div>
  )
}
