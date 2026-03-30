'use client'

import { useState } from 'react'

export default function InlineFactsEditor({
  facts: initial,
  clientId,
}: {
  facts: string[]
  clientId: string
}) {
  const [facts, setFacts] = useState(initial)
  const [newFact, setNewFact] = useState('')
  const [saving, setSaving] = useState(false)

  async function save(updated: string[]) {
    setSaving(true)
    try {
      await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_facts: updated }),
        signal: AbortSignal.timeout(10000),
      })
    } finally {
      setSaving(false)
    }
  }

  async function add() {
    const trimmed = newFact.trim()
    if (!trimmed) return
    const updated = [...facts, trimmed]
    setFacts(updated)
    setNewFact('')
    await save(updated)
  }

  async function remove(i: number) {
    const updated = facts.filter((_, idx) => idx !== i)
    setFacts(updated)
    await save(updated)
  }

  return (
    <div className="space-y-2">
      {facts.length === 0 ? (
        <p className="text-xs t3">No facts yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {facts.map((fact, i) => (
            <li key={i} className="flex items-start gap-2 group">
              <span
                className="mt-[5px] shrink-0 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: 'var(--color-primary)', opacity: 0.6 }}
              />
              <span className="text-[12px] t2 leading-relaxed flex-1 min-w-0">{fact}</span>
              <button
                onClick={() => remove(i)}
                disabled={saving}
                className="opacity-0 group-hover:opacity-100 text-[13px] t3 hover:text-red-400 transition-all shrink-0 px-1 leading-none disabled:opacity-20"
                aria-label="Remove fact"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 pt-1">
        <input
          value={newFact}
          onChange={e => setNewFact(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void add() } }}
          placeholder="Add a fact and press Enter…"
          className="flex-1 text-[11px] px-2.5 py-1.5 rounded-lg outline-none"
          style={{
            backgroundColor: 'var(--color-hover)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-1)',
          }}
        />
        <button
          onClick={() => void add()}
          disabled={!newFact.trim() || saving}
          className="text-[11px] px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40"
          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
        >
          Add
        </button>
      </div>
    </div>
  )
}
