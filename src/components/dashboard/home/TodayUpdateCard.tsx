'use client'

import { useState } from 'react'

interface TodayUpdateCardProps {
  clientId: string
  currentNote: string | null
  currentNoteExpiresAt?: string | null
}

export default function TodayUpdateCard({ clientId: _clientId, currentNote, currentNoteExpiresAt }: TodayUpdateCardProps) {
  const [note, setNote] = useState(currentNote ?? '')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(currentNote ? new Date() : null)
  const [expiresAt, setExpiresAt] = useState<Date | null>(currentNoteExpiresAt ? new Date(currentNoteExpiresAt) : null)
  const [error, setError] = useState<string | null>(null)

  const isDirty = note.trim() !== (currentNote ?? '')
  const isEmpty = !note.trim()

  function savedAgoText(): string {
    if (!savedAt) return ''
    const diff = Math.round((Date.now() - savedAt.getTime()) / 60000)
    if (diff < 1) return 'just now'
    if (diff < 60) return `${diff}m ago`
    const h = Math.floor(diff / 60)
    return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
  }

  function expiresText(): string {
    if (!expiresAt) return ''
    const diff = Math.round((expiresAt.getTime() - Date.now()) / 60000)
    if (diff <= 0) return 'expired'
    if (diff < 60) return `expires in ${diff}m`
    const h = Math.floor(diff / 60)
    return h < 24 ? `expires in ${h}h` : `expires ${expiresAt.toLocaleDateString()}`
  }

  async function handleSave(value: string | null) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ injected_note: value }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error || 'Failed to save')
      }
      if (value === null) {
        setNote('')
        setExpiresAt(null)
      } else {
        setExpiresAt(new Date(Date.now() + 24 * 60 * 60 * 1000))
      }
      setSavedAt(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="rounded-2xl border p-4 space-y-3"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--color-text-3)' }}>
            TODAY&apos;S UPDATE
          </p>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--color-text-3)' }}>
          Quick context for your agent — injected on every call
        </p>
      </div>

      {/* Textarea */}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="e.g. Closed Monday, boss is traveling, special hours this week..."
        className="w-full rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 placeholder:opacity-40"
        style={{
          backgroundColor: 'var(--color-hover)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text-1)',
          border: '1px solid var(--color-border)',
          // @ts-expect-error custom property
          '--tw-ring-color': 'var(--color-primary)',
        }}
      />

      {/* Persistent sync state */}
      <div className="flex items-center gap-2 min-h-[20px]">
        {savedAt && !isDirty && !saving && (
          <p className="text-[11px]" style={{ color: 'var(--color-text-3)' }}>
            {isEmpty ? 'No active update' : `Synced · ${savedAgoText()}${expiresAt ? ` · ${expiresText()}` : ''}`}
          </p>
        )}
        {error && (
          <p className="text-[11px] text-red-400">{error}</p>
        )}
        {!note.trim() && !savedAt && (
          <p className="text-[11px]" style={{ color: 'var(--color-text-3)' }}>
            Nothing set — agent uses default greeting
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleSave(note.trim() || null)}
          disabled={saving || !isDirty}
          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {saving ? 'Saving…' : 'Update agent'}
        </button>

        {!isEmpty && !isDirty && (
          <button
            onClick={() => handleSave(note.trim())}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-opacity hover:opacity-75 disabled:opacity-40 cursor-pointer"
            style={{ color: 'var(--color-text-3)', border: '1px solid var(--color-border)' }}
          >
            Extend 24h
          </button>
        )}

        {!isEmpty && (
          <button
            onClick={() => handleSave(null)}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-opacity hover:opacity-75 disabled:opacity-40 cursor-pointer"
            style={{ color: 'var(--color-text-3)', border: '1px solid var(--color-border)' }}
          >
            Clear
          </button>
        )}

        {note.trim() && (
          <span className="ml-auto text-[10px]" style={{ color: 'var(--color-text-3)' }}>
            {note.length}/500
          </span>
        )}
      </div>
    </div>
  )
}
