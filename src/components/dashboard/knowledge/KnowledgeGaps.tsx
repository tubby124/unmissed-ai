'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Gap {
  query: string
  count: number
  first_seen: string
  last_seen: string
}

interface AISuggestion {
  content: string
  chunk_type: string
  similarity: number
  trust_tier: string
}

interface KnowledgeGapsProps {
  clientId: string
  isAdmin: boolean
  onAnswered?: () => void
  onGapCountChange?: (count: number) => void
}

export default function KnowledgeGaps({ clientId, isAdmin, onAnswered, onGapCountChange }: KnowledgeGapsProps) {
  const [gaps, setGaps] = useState<Gap[]>([])
  const [totalUnanswered, setTotalUnanswered] = useState(0)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [open, setOpen] = useState(false)

  const [expandedGap, setExpandedGap] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [saving, setSaving] = useState(false)
  const [successGap, setSuccessGap] = useState<string | null>(null)
  const [fadingGap, setFadingGap] = useState<string | null>(null)

  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null)
  const [suggestionLoading, setSuggestionLoading] = useState(false)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)

  const [dismissing, setDismissing] = useState<string | null>(null)
  const [dismissingAll, setDismissingAll] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [cascadeInfo, setCascadeInfo] = useState<{ count: number; queries: string[] } | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    async function fetchGaps() {
      setLoading(true)
      try {
        const params = new URLSearchParams({ client_id: clientId, days: String(days) })
        const res = await fetch(`/api/dashboard/knowledge/gaps?${params}`)
        if (!res.ok) throw new Error('Failed to load gaps')
        const data = await res.json()
        setGaps(data.gaps ?? [])
        setTotalUnanswered(data.total_unanswered_queries ?? 0)
        onGapCountChange?.(data.total ?? 0)
        if ((data.gaps ?? []).length > 0) setOpen(true)
      } catch {
        setGaps([])
      } finally {
        setLoading(false)
      }
    }
    fetchGaps()
  }, [clientId, days, onGapCountChange])

  const fetchSuggestion = useCallback(async (query: string) => {
    setSuggestionLoading(true)
    setSuggestion(null)
    setSuggestionDismissed(false)
    try {
      const res = await fetch('/api/dashboard/knowledge/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, query }),
      })
      if (res.ok) {
        const data = await res.json()
        setSuggestion(data.suggestion ?? null)
      }
    } catch {
      // Silent — suggestion is optional
    } finally {
      setSuggestionLoading(false)
    }
  }, [clientId])

  function handleExpand(query: string) {
    if (expandedGap === query) {
      setExpandedGap(null)
      setAnswerText('')
      setSuggestion(null)
      setSuggestionDismissed(false)
      return
    }
    setExpandedGap(query)
    setAnswerText(`Q: ${query}\nA: `)
    setSaveError(null)
    fetchSuggestion(query)
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length)
      }
    }, 250)
  }

  function handleUseSuggestion() {
    if (!suggestion) return
    const aMatch = suggestion.content.match(/A:\s*([\s\S]+)/)
    const answer = aMatch ? aMatch[1].trim() : suggestion.content.trim()
    setAnswerText(`Q: ${expandedGap}\nA: ${answer}`)
    setSuggestionDismissed(true)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  async function handleSave() {
    if (!answerText.trim() || !expandedGap) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/dashboard/knowledge/chunks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          content: answerText.trim(),
          chunk_type: 'qa',
          trust_tier: 'medium',
          auto_approve: true,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save')
      }

      const resolveRes = await fetch('/api/dashboard/knowledge/gaps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, query: expandedGap, resolution_type: 'faq' }),
      })
      const resolveData = resolveRes.ok ? await resolveRes.json() : null
      const cascadeCount = resolveData?.auto_cascade_count ?? 0
      const cascadeQueries: string[] = resolveData?.auto_cascade_queries ?? []

      const answeredQuery = expandedGap
      setSuccessGap(answeredQuery)
      setExpandedGap(null)
      setAnswerText('')
      setSuggestion(null)
      if (cascadeCount > 0) setCascadeInfo({ count: cascadeCount, queries: cascadeQueries })

      setTimeout(() => {
        setFadingGap(answeredQuery)
        setTimeout(() => {
          const cascadeNorm = new Set(cascadeQueries.map(q => q.toLowerCase().trim().replace(/\s+/g, ' ')))
          setGaps(prev => prev.filter(g => {
            if (g.query === answeredQuery) return false
            return !cascadeNorm.has(g.query.toLowerCase().trim().replace(/\s+/g, ' '))
          }))
          const totalRemoved = 1 + cascadeCount
          setTotalUnanswered(prev => Math.max(0, prev - totalRemoved))
          setSuccessGap(null)
          setFadingGap(null)
          onAnswered?.()
          onGapCountChange?.(Math.max(0, gaps.length - totalRemoved))
          setTimeout(() => setCascadeInfo(null), 3000)
        }, 300)
      }, 1500)
    } catch {
      setSaveError('Failed to save — try again')
    } finally {
      setSaving(false)
    }
  }

  async function handleDismiss(query: string) {
    setDismissing(query)
    try {
      await fetch('/api/dashboard/knowledge/gaps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, query, resolution_type: 'dismissed' }),
      })
      setFadingGap(query)
      setTimeout(() => {
        setGaps(prev => prev.filter(g => g.query !== query))
        setTotalUnanswered(prev => Math.max(0, prev - 1))
        setFadingGap(null)
        if (expandedGap === query) { setExpandedGap(null); setAnswerText('') }
        onGapCountChange?.(gaps.length - 1)
      }, 300)
    } catch {
      // Silent
    } finally {
      setDismissing(null)
    }
  }

  async function handleDismissAll() {
    setDismissingAll(true)
    try {
      for (const gap of gaps) {
        await fetch('/api/dashboard/knowledge/gaps', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: clientId, query: gap.query, resolution_type: 'dismissed' }),
        })
      }
      setGaps([])
      setTotalUnanswered(0)
      setExpandedGap(null)
      setAnswerText('')
      onGapCountChange?.(0)
    } catch {
      // Silent
    } finally {
      setDismissingAll(false)
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setAnswerText(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  return (
    <div className="rounded-2xl border b-theme bg-surface overflow-hidden">

      {/* ── Header (always visible, clickable) ─────────────────────────────── */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3 shrink-0">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="17" r=".5" fill="currentColor" stroke="currentColor"/>
          </svg>
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Unanswered Questions</p>
          {loading ? (
            <span className="w-3 h-3 rounded-full border-[1.5px] border-current border-t-transparent animate-spin t3" />
          ) : gaps.length > 0 ? (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full tabular-nums bg-amber-500/15 text-amber-400 border border-amber-500/25">
              {gaps.length}
            </span>
          ) : null}
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          className="t3 transition-transform duration-200 shrink-0"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* ── Collapsible body ────────────────────────────────────────────────── */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">

          {/* Cascade success banner */}
          {cascadeInfo && cascadeInfo.count > 0 && (
            <div className="px-5 py-2.5 border-t b-theme bg-emerald-500/[0.05]">
              <div className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-emerald-400 shrink-0">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p className="text-[11px] text-emerald-400">
                  Auto-resolved {cascadeInfo.count} similar question{cascadeInfo.count > 1 ? 's' : ''} with the same answer
                </p>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && gaps.length === 0 && (
            <div className="border-t b-theme px-5 py-5 text-center">
              <p className="text-xs t3">
                No unanswered questions in the last {days} days — your knowledge base is covering callers well.
              </p>
            </div>
          )}

          {/* Filter bar + list */}
          {gaps.length > 0 && (
            <>
              <div className="flex items-center justify-between px-5 py-2.5 border-t b-theme">
                <p className="text-[10px] t3">
                  {totalUnanswered > gaps.length
                    ? `${totalUnanswered} total · top ${gaps.length} shown`
                    : `${gaps.length} question${gaps.length !== 1 ? 's' : ''} from callers`}
                </p>
                <div className="flex items-center gap-3">
                  {gaps.length >= 3 && (
                    <button
                      onClick={handleDismissAll}
                      disabled={dismissingAll}
                      className="text-[10px] t3 hover:t1 transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      {dismissingAll ? 'Clearing...' : 'Clear all'}
                    </button>
                  )}
                  <select
                    value={days}
                    onChange={e => setDays(Number(e.target.value))}
                    className="bg-hover border b-theme rounded-lg px-2 py-1 text-[11px] t2 focus:outline-none cursor-pointer"
                  >
                    <option value={7}>7 days</option>
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </div>
              </div>

              <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {gaps.map((gap) => {
                  const isExpanded = expandedGap === gap.query
                  const isSuccess = successGap === gap.query
                  const isFading = fadingGap === gap.query
                  const isDismissing = dismissing === gap.query
                  const isHot = gap.count >= 3

                  return (
                    <div
                      key={gap.query}
                      className="transition-all duration-300"
                      style={{ opacity: isFading ? 0 : 1, overflow: isFading ? 'hidden' : undefined }}
                    >
                      {/* Gap row */}
                      <div className="px-5 py-3.5 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-1.5 mb-1">
                            {isHot && (
                              <span className="shrink-0 mt-[1px] text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                                HOT
                              </span>
                            )}
                            <p className="text-xs t1 leading-relaxed">&ldquo;{gap.query}&rdquo;</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-mono tabular-nums ${isHot ? 'text-red-400' : gap.count >= 2 ? 'text-amber-400' : 't3'}`}>
                              Asked {gap.count}×
                            </span>
                            <span className="text-[10px] t3">
                              {new Date(gap.last_seen).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                          <button
                            onClick={() => handleDismiss(gap.query)}
                            disabled={isDismissing}
                            className="px-2.5 py-1.5 rounded-lg text-[10px] t3 hover:t1 border b-theme hover:bg-hover transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            {isDismissing ? '...' : 'Skip'}
                          </button>
                          <button
                            onClick={() => handleExpand(gap.query)}
                            className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium cursor-pointer transition-all"
                            style={isExpanded
                              ? { backgroundColor: 'var(--color-accent-tint)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }
                              : { backgroundColor: 'var(--color-accent-tint)', color: 'var(--color-primary)', border: '1px solid transparent' }
                            }
                          >
                            {isExpanded ? 'Cancel' : 'Answer'}
                          </button>
                        </div>
                      </div>

                      {/* Success banner */}
                      {isSuccess && (
                        <div className="px-5 pb-3">
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-emerald-400 shrink-0">
                              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <span className="text-[11px] font-medium text-emerald-400">Your agent knows this now</span>
                          </div>
                        </div>
                      )}

                      {/* Inline answer panel */}
                      <div
                        className="grid transition-[grid-template-rows] duration-200 ease-out"
                        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
                      >
                        <div className="overflow-hidden">
                          <div className="px-5 pb-4 space-y-2.5 pt-1">

                            {/* AI suggestion loading */}
                            {suggestionLoading && (
                              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-hover border b-theme">
                                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-primary)' }} />
                                <span className="text-[10px] t3">Finding related knowledge...</span>
                              </div>
                            )}

                            {/* AI suggestion */}
                            {suggestion && !suggestionDismissed && !suggestionLoading && (
                              <div className="px-3 py-2.5 rounded-xl bg-hover border-l-2 space-y-2"
                                style={{ border: '1px solid var(--color-border)', borderLeftColor: 'var(--color-primary)', borderLeftWidth: '2px' }}>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[9px] font-semibold uppercase tracking-wider t3">Suggested from knowledge base</span>
                                  <button onClick={() => setSuggestionDismissed(true)} className="t3 hover:t1 cursor-pointer transition-colors">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                                      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                    </svg>
                                  </button>
                                </div>
                                <p className="text-[11px] t2 leading-relaxed line-clamp-3">{suggestion.content}</p>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={handleUseSuggestion}
                                    className="px-2.5 py-1 rounded-lg text-[10px] font-medium text-white cursor-pointer transition-opacity hover:opacity-90"
                                    style={{ backgroundColor: 'var(--color-primary)' }}
                                  >
                                    Use this answer
                                  </button>
                                  <span className="text-[9px] t3">{(suggestion.similarity * 100).toFixed(0)}% match</span>
                                </div>
                              </div>
                            )}

                            {/* No suggestion */}
                            {!suggestion && !suggestionLoading && isExpanded && !suggestionDismissed && (
                              <p className="text-[10px] t3 px-1">No existing knowledge matches — write a fresh answer below.</p>
                            )}

                            {/* Textarea */}
                            <textarea
                              ref={textareaRef}
                              value={answerText}
                              onChange={handleTextareaChange}
                              disabled={saving}
                              rows={2}
                              className="w-full bg-hover border b-theme rounded-xl px-3 py-2.5 text-xs t1 placeholder:t3 focus:outline-none resize-none transition-colors disabled:opacity-50"
                              style={{ minHeight: '3.5rem', maxHeight: '10rem', focusBorderColor: 'var(--color-primary)' } as React.CSSProperties}
                              placeholder="Type your answer..."
                              maxLength={5000}
                            />

                            {saveError && (
                              <p className="text-[11px] px-1 text-red-400">{saveError}</p>
                            )}

                            <div className="flex items-center justify-between">
                              <span className="text-[9px] t3">{answerText.length}/5000</span>
                              <button
                                onClick={handleSave}
                                disabled={saving || !answerText.trim()}
                                className="px-4 py-1.5 rounded-xl text-[11px] font-semibold text-white disabled:opacity-40 transition-opacity hover:opacity-90 cursor-pointer"
                                style={{ backgroundColor: 'var(--color-primary)' }}
                              >
                                {saving ? 'Saving...' : 'Save Answer'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
