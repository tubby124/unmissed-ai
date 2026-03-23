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

  // Inline answer state — keyed by gap query
  const [expandedGap, setExpandedGap] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [saving, setSaving] = useState(false)
  const [successGap, setSuccessGap] = useState<string | null>(null)
  const [fadingGap, setFadingGap] = useState<string | null>(null)

  // AI suggestion state
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null)
  const [suggestionLoading, setSuggestionLoading] = useState(false)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)

  // Dismiss (not relevant) state
  const [dismissing, setDismissing] = useState<string | null>(null)
  const [dismissingAll, setDismissingAll] = useState(false)

  // Error state for save failures
  const [saveError, setSaveError] = useState<string | null>(null)

  // Auto-cascade feedback
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
      } catch {
        setGaps([])
      } finally {
        setLoading(false)
      }
    }
    fetchGaps()
  }, [clientId, days, onGapCountChange])

  // Fetch AI suggestion when a gap is expanded
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
      // Collapse
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
    // Focus textarea after expand transition
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length)
      }
    }, 250)
  }

  function handleUseSuggestion() {
    if (!suggestion) return
    // Extract just the answer part from the suggestion content
    const content = suggestion.content
    // If the suggestion is Q&A format, extract the answer
    const aMatch = content.match(/A:\s*([\s\S]+)/)
    const answer = aMatch ? aMatch[1].trim() : content.trim()
    setAnswerText(`Q: ${expandedGap}\nA: ${answer}`)
    setSuggestionDismissed(true)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  async function handleSave() {
    if (!answerText.trim() || !expandedGap) return
    setSaving(true)
    setSaveError(null)
    try {
      // Add as Q&A chunk — auto-approve for admin or gap answers
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
      if (!res.ok) throw new Error('Failed to save')

      // Resolve the gap + auto-cascade similar ones
      const resolveRes = await fetch('/api/dashboard/knowledge/gaps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          query: expandedGap,
          resolution_type: 'faq',
        }),
      })
      const resolveData = resolveRes.ok ? await resolveRes.json() : null
      const cascadeCount = resolveData?.auto_cascade_count ?? 0
      const cascadeQueries: string[] = resolveData?.auto_cascade_queries ?? []

      // Show success, then fade out the gap card + any auto-cascaded siblings
      const answeredQuery = expandedGap
      setSuccessGap(answeredQuery)
      setExpandedGap(null)
      setAnswerText('')
      setSuggestion(null)

      if (cascadeCount > 0) {
        setCascadeInfo({ count: cascadeCount, queries: cascadeQueries })
      }

      setTimeout(() => {
        setFadingGap(answeredQuery)
        setTimeout(() => {
          // Remove the answered gap + any auto-cascaded gaps from the UI
          const cascadeNormalized = new Set(
            cascadeQueries.map(q => q.toLowerCase().trim().replace(/\s+/g, ' '))
          )
          setGaps(prev => prev.filter(g => {
            if (g.query === answeredQuery) return false
            const gNorm = g.query.toLowerCase().trim().replace(/\s+/g, ' ')
            return !cascadeNormalized.has(gNorm)
          }))
          const totalRemoved = 1 + cascadeCount
          setTotalUnanswered(prev => Math.max(0, prev - totalRemoved))
          setSuccessGap(null)
          setFadingGap(null)
          onAnswered?.()
          onGapCountChange?.(Math.max(0, gaps.length - totalRemoved))

          // Clear cascade info after a delay
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
        body: JSON.stringify({
          client_id: clientId,
          query,
          resolution_type: 'dismissed',
        }),
      })
      setFadingGap(query)
      setTimeout(() => {
        setGaps(prev => prev.filter(g => g.query !== query))
        setTotalUnanswered(prev => Math.max(0, prev - 1))
        setFadingGap(null)
        if (expandedGap === query) {
          setExpandedGap(null)
          setAnswerText('')
        }
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
      // Dismiss each gap sequentially to avoid race conditions
      for (const gap of gaps) {
        await fetch('/api/dashboard/knowledge/gaps', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId,
            query: gap.query,
            resolution_type: 'dismissed',
          }),
        })
      }
      setGaps([])
      setTotalUnanswered(0)
      setExpandedGap(null)
      setAnswerText('')
      onGapCountChange?.(0)
    } catch {
      // Silent — partial dismiss is fine
    } finally {
      setDismissingAll(false)
    }
  }

  // Auto-grow textarea
  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setAnswerText(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-700/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-700/50">
          <p className="text-xs font-semibold text-zinc-200">Knowledge Gaps</p>
        </div>
        <div className="p-6 text-center">
          <svg className="animate-spin h-4 w-4 mx-auto text-zinc-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-700/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-700/50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-zinc-200">Knowledge Gaps</p>
          {totalUnanswered > 0 && (
            <span className="text-[10px] font-mono text-amber-400/80">
              {totalUnanswered} unanswered
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {gaps.length >= 3 && (
            <button
              onClick={handleDismissAll}
              disabled={dismissingAll}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40"
            >
              {dismissingAll ? 'Dismissing...' : 'Dismiss all'}
            </button>
          )}
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-[11px] text-zinc-300 focus:outline-none focus:border-blue-500/50"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Auto-cascade success banner */}
      {cascadeInfo && cascadeInfo.count > 0 && (
        <div className="px-4 py-2.5 border-b border-zinc-700/50 bg-emerald-500/[0.06]">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-emerald-400 shrink-0">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-[11px] text-emerald-400">
              Auto-resolved {cascadeInfo.count} similar question{cascadeInfo.count > 1 ? 's' : ''} with the same answer
            </p>
          </div>
        </div>
      )}

      {gaps.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-xs text-zinc-500">
            No unanswered questions in the last {days} days. Your knowledge base is covering caller questions well.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800">
          {gaps.map((gap) => {
            const isExpanded = expandedGap === gap.query
            const isSuccess = successGap === gap.query
            const isFading = fadingGap === gap.query
            const isDismissing = dismissing === gap.query

            return (
              <div
                key={gap.query}
                className={`transition-all duration-300 ${
                  isFading ? 'opacity-0 max-h-0 overflow-hidden' : 'opacity-100'
                }`}
              >
                {/* Gap card header */}
                <div className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-200 leading-relaxed">&ldquo;{gap.query}&rdquo;</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-[10px] font-mono ${gap.count >= 3 ? 'text-red-400' : gap.count >= 2 ? 'text-amber-400' : 'text-zinc-500'}`}>
                        {gap.count}x
                      </span>
                      {gap.count >= 3 && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                          Recommended: Add as FAQ
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-600">
                        {gap.count > 1
                          ? `${new Date(gap.first_seen).toLocaleDateString()} — ${new Date(gap.last_seen).toLocaleDateString()}`
                          : new Date(gap.last_seen).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Dismiss button */}
                    <button
                      onClick={() => handleDismiss(gap.query)}
                      disabled={isDismissing}
                      className="px-2 py-1 rounded-lg text-[10px] font-medium text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-40"
                      title="Not relevant"
                    >
                      {isDismissing ? '...' : 'Dismiss'}
                    </button>
                    {/* Answer toggle */}
                    <button
                      onClick={() => handleExpand(gap.query)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                        isExpanded
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20'
                      }`}
                    >
                      {isExpanded ? 'Cancel' : 'Answer'}
                    </button>
                  </div>
                </div>

                {/* Success message */}
                {isSuccess && (
                  <div className="px-4 pb-3">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-green-400 shrink-0">
                        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-[11px] text-green-400 font-medium">Your agent knows this now</span>
                    </div>
                  </div>
                )}

                {/* Inline answer panel — CSS grid-rows transition */}
                <div
                  className="grid transition-[grid-template-rows] duration-200 ease-out"
                  style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <div className="px-4 pb-3 space-y-2.5">
                      {/* AI suggestion */}
                      {suggestionLoading && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50">
                          <div className="h-2 w-2 rounded-full bg-blue-400/60 animate-pulse" />
                          <span className="text-[10px] text-zinc-500">Finding related knowledge...</span>
                        </div>
                      )}

                      {suggestion && !suggestionDismissed && !suggestionLoading && (
                        <div className="px-3 py-2 rounded-lg bg-blue-500/[0.06] border border-blue-500/15 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-semibold text-blue-400/70 uppercase tracking-wider">Suggested from knowledge base</span>
                            <button
                              onClick={() => setSuggestionDismissed(true)}
                              className="text-zinc-600 hover:text-zinc-400 transition-colors"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                              </svg>
                            </button>
                          </div>
                          <p className="text-[11px] text-zinc-300 leading-relaxed line-clamp-3">{suggestion.content}</p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleUseSuggestion}
                              className="px-2.5 py-1 rounded-md text-[10px] font-medium bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors"
                            >
                              Use this answer
                            </button>
                            <span className="text-[9px] text-zinc-600">
                              {(suggestion.similarity * 100).toFixed(0)}% match
                            </span>
                          </div>
                        </div>
                      )}

                      {/* No suggestion found */}
                      {!suggestion && !suggestionLoading && isExpanded && !suggestionDismissed && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/40">
                          <span className="text-[10px] text-zinc-600">No existing knowledge matches this question</span>
                        </div>
                      )}

                      {/* Textarea */}
                      <textarea
                        ref={textareaRef}
                        value={answerText}
                        onChange={handleTextareaChange}
                        disabled={saving}
                        rows={2}
                        className="w-full bg-transparent border-0 border-b border-zinc-700/50 px-1 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 resize-none transition-colors disabled:opacity-50"
                        style={{ minHeight: '3rem', maxHeight: '10rem' }}
                        placeholder="Type your answer..."
                        maxLength={5000}
                      />

                      {/* Error message */}
                      {saveError && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                          <span className="text-[10px] text-red-400">{saveError}</span>
                        </div>
                      )}

                      {/* Save / char count row */}
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-zinc-600">{answerText.length}/5000</span>
                        <button
                          onClick={handleSave}
                          disabled={saving || !answerText.trim()}
                          className="px-3.5 py-1.5 rounded-lg text-[11px] font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 transition-colors flex items-center gap-1.5"
                        >
                          {saving ? (
                            <>
                              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Saving
                            </>
                          ) : 'Save Answer'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
