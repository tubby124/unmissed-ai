'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createBrowserClient } from '@/lib/supabase/client'

export interface FaqSuggestion {
  q: string
  a: string
}

interface AutoFaqSuggestionsProps {
  clientId: string
  suggestions: FaqSuggestion[]
}

type FaqItem = { q: string; a: string }

async function addFaqToClient(clientId: string, suggestion: FaqSuggestion): Promise<void> {
  const supabase = createBrowserClient()
  const { data: row, error: fetchErr } = await supabase
    .from('clients')
    .select('extra_qa')
    .eq('id', clientId)
    .single()

  if (fetchErr) throw new Error('Failed to load current FAQs')

  const current: FaqItem[] = Array.isArray(row?.extra_qa) ? (row.extra_qa as FaqItem[]) : []
  const updated = [...current, { q: suggestion.q.trim(), a: suggestion.a.trim() }]

  const res = await fetch('/api/dashboard/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, extra_qa: updated }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Failed to save' }))
    throw new Error((data as { error?: string }).error ?? 'Failed to save FAQ')
  }
}

export default function AutoFaqSuggestions({ clientId, suggestions }: AutoFaqSuggestionsProps) {
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set())
  const [savingIndex, setSavingIndex] = useState<number | null>(null)
  const [addingAll, setAddingAll] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [dismissing, setDismissing] = useState(false)

  const remaining = suggestions.filter((_, i) => !addedIndices.has(i))

  async function handleDismiss() {
    if (dismissing) return
    setDismissing(true)
    try {
      await fetch('/api/dashboard/faq-suggestions', { method: 'DELETE' })
      setDismissed(true)
    } catch {
      // silent — dismiss is best-effort
      setDismissed(true)
    } finally {
      setDismissing(false)
    }
  }

  async function handleAdd(suggestion: FaqSuggestion, index: number) {
    if (savingIndex !== null || addedIndices.has(index)) return
    setSavingIndex(index)
    try {
      await addFaqToClient(clientId, suggestion)
      setAddedIndices(prev => new Set(prev).add(index))
      toast.success('FAQ added — your agent will know this on every call')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save FAQ')
    } finally {
      setSavingIndex(null)
    }
  }

  async function handleAddAll() {
    if (addingAll) return
    setAddingAll(true)
    try {
      const supabase = createBrowserClient()
      const { data: row, error: fetchErr } = await supabase
        .from('clients')
        .select('extra_qa')
        .eq('id', clientId)
        .single()
      if (fetchErr) throw new Error('Failed to load current FAQs')

      const current: FaqItem[] = Array.isArray(row?.extra_qa) ? (row.extra_qa as FaqItem[]) : []
      const toAdd = suggestions.filter((_, i) => !addedIndices.has(i))
      const updated = [...current, ...toAdd.map(s => ({ q: s.q.trim(), a: s.a.trim() }))]

      const res = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, extra_qa: updated }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to save' }))
        throw new Error((data as { error?: string }).error ?? 'Failed to save FAQs')
      }

      const allIndices = new Set(suggestions.map((_, i) => i))
      setAddedIndices(allIndices)
      toast.success(`${toAdd.length} FAQ${toAdd.length > 1 ? 's' : ''} added — your agent will know these on every call`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save FAQs')
    } finally {
      setAddingAll(false)
    }
  }

  if (dismissed) return null

  if (remaining.length === 0 && addedIndices.size > 0) {
    return (
      <div
        className="rounded-2xl border p-5"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-2 t3">
          Auto-suggested FAQs
        </p>
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-green-400 shrink-0">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-xs text-green-400">All suggestions added to your agent</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl border p-5 space-y-3"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">
            Auto-suggested FAQs
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-3)' }}>
            Questions your agent struggled to answer. Add them so it knows next time.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {remaining.length > 1 && (
            <button
              onClick={handleAddAll}
              disabled={addingAll || dismissing}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
              style={{
                backgroundColor: 'rgba(99,102,241,0.1)',
                color: 'rgb(129,140,248)',
                border: '1px solid rgba(99,102,241,0.2)',
              }}
            >
              {addingAll ? 'Adding…' : `Add all ${remaining.length}`}
            </button>
          )}
          <button
            onClick={handleDismiss}
            disabled={dismissing || addingAll}
            className="text-[11px] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
            style={{ color: 'var(--color-text-3)', border: '1px solid var(--color-border)' }}
          >
            {dismissing ? '…' : 'Dismiss'}
          </button>
        </div>
      </div>

      {/* Suggestion cards */}
      <div className="space-y-2">
        {suggestions.map((s, i) => {
          const isAdded = addedIndices.has(i)
          const isSaving = savingIndex === i
          const hasPlaceholder = s.a.includes('[YOUR ANSWER HERE]')

          if (isAdded) {
            return (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 rounded-xl opacity-50"
                style={{ border: '1px solid var(--color-border)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-green-400 shrink-0">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-[11px]" style={{ color: 'var(--color-text-3)' }}>{s.q}</p>
              </div>
            )
          }

          return (
            <div
              key={i}
              className="p-3 rounded-xl space-y-1.5"
              style={{ border: '1px solid rgba(99,102,241,0.12)', backgroundColor: 'rgba(99,102,241,0.02)' }}
            >
              {/* Question */}
              <p className="text-[12px] font-medium" style={{ color: 'var(--color-text-1)' }}>
                {s.q}
              </p>

              {/* Answer */}
              <p
                className="text-[11px] leading-relaxed"
                style={{ color: hasPlaceholder ? 'rgb(251,191,36)' : 'var(--color-text-2)' }}
              >
                {s.a}
              </p>

              {hasPlaceholder && (
                <p className="text-[10px]" style={{ color: 'rgb(251,191,36,0.8)' }}>
                  Has a placeholder — fill it in after adding via Settings → FAQs
                </p>
              )}

              <div className="flex justify-end pt-0.5">
                <button
                  onClick={() => handleAdd(s, i)}
                  disabled={isSaving || savingIndex !== null || addingAll}
                  className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {isSaving ? 'Adding…' : 'Add as FAQ'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
