'use client'

import { useState, useEffect, useCallback } from 'react'

interface Suggestion {
  id: string
  section_id: string
  trigger_type: string
  suggestion_text: string
  evidence_count: number
  created_at: string
}

interface PromptSuggestionsCardProps {
  clientId?: string
  isAdmin?: boolean
  onScrollTo?: (section: string) => void
}

const SECTION_LABELS: Record<string, string> = {
  identity:    'Agent Identity',
  hours:       'Business Hours',
  knowledge:   'Knowledge Base',
  after_hours: 'After-Hours',
  tone:        'Tone & Style',
  flow:        'Conversation Flow',
  technical:   'Technical',
}

const TRIGGER_LABELS: Record<string, { label: string; color: string }> = {
  unanswered_question: { label: 'Unanswered Q', color: '#f59e0b' },
  frustration:         { label: 'Frustration',  color: '#ef4444' },
  feature_gap:         { label: 'Feature Gap',  color: '#60a5fa' },
  low_confidence:      { label: 'Low Conf.',    color: '#a855f7' },
}

export default function PromptSuggestionsCard({ clientId, isAdmin, onScrollTo }: PromptSuggestionsCardProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissing, setDismissing] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    const params = isAdmin && clientId ? `?client_id=${clientId}` : ''
    try {
      const res = await fetch(`/api/dashboard/prompt-suggestions${params}`)
      if (!res.ok) return
      const data = await res.json()
      setSuggestions(data.suggestions ?? [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [clientId, isAdmin])

  // Initial load
  useEffect(() => { load() }, [load])

  // Poll every 60s
  useEffect(() => {
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [load])

  const dismiss = useCallback(async (id: string) => {
    setDismissing(prev => new Set([...prev, id]))
    try {
      await fetch('/api/dashboard/prompt-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'dismiss' }),
      })
      setSuggestions(prev => prev?.filter(s => s.id !== id) ?? null)
    } catch { /* silent */ }
    finally {
      setDismissing(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }, [])

  if (loading) {
    return (
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-4 t3">Improvement Suggestions</p>
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--color-raised)' }} />
          ))}
        </div>
      </div>
    )
  }

  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-4 t3">Improvement Suggestions</p>
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
          <span className="text-2xl select-none">✨</span>
          <p className="text-[12px] font-medium" style={{ color: 'var(--color-text-2)' }}>No suggestions yet</p>
          <p className="text-[11px] max-w-[280px]" style={{ color: 'var(--color-text-3)' }}>
            Suggestions appear automatically after repeated failure patterns across 3+ calls.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Improvement Suggestions</p>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
          style={{ borderColor: '#a5b4fc55', background: '#a5b4fc15', color: '#a5b4fc' }}>
          {suggestions.length}
        </span>
      </div>

      <div className="space-y-3">
        {suggestions.map(s => {
          const trigger = TRIGGER_LABELS[s.trigger_type] ?? { label: s.trigger_type, color: '#71717a' }
          const section = SECTION_LABELS[s.section_id] ?? s.section_id
          const isDismissing = dismissing.has(s.id)

          return (
            <div key={s.id} className="rounded-xl border b-theme p-4 space-y-2.5 transition-opacity"
              style={{ opacity: isDismissing ? 0.4 : 1, background: 'var(--color-raised)' }}>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-semibold tracking-[0.15em] uppercase px-2 py-0.5 rounded-full border"
                    style={{ borderColor: `${trigger.color}44`, background: `${trigger.color}18`, color: trigger.color }}>
                    {trigger.label}
                  </span>
                  <span className="text-[9px] font-medium px-2 py-0.5 rounded-full border b-theme t3">
                    {section}
                  </span>
                  {s.evidence_count > 1 && (
                    <span className="text-[9px] font-mono t3">{s.evidence_count} calls</span>
                  )}
                </div>
                <button
                  onClick={() => dismiss(s.id)}
                  disabled={isDismissing}
                  className="shrink-0 text-[10px] px-2.5 py-1 rounded-lg border b-theme t3 hover:text-[color:var(--color-text-2)] transition-colors disabled:cursor-not-allowed"
                >
                  Dismiss
                </button>
              </div>

              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-1)' }}>
                {s.suggestion_text}
              </p>

              <button
                onClick={() => onScrollTo?.('prompt-editor')}
                className="text-[10px] font-medium text-left hover:opacity-75 transition-opacity"
                style={{ color: '#a5b4fc' }}
              >
                Apply in Prompt Editor →
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
