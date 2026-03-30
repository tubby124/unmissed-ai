'use client'

import { useState } from 'react'

interface FaqItem { q: string; a: string }

export default function InlineFaqEditor({
  qa: initial,
  clientId,
}: {
  qa: FaqItem[]
  clientId: string
}) {
  const [qa, setQa] = useState(initial)
  const [newQ, setNewQ] = useState('')
  const [newA, setNewA] = useState('')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save(updated: FaqItem[]) {
    setSaving(true)
    try {
      await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extra_qa: updated }),
        signal: AbortSignal.timeout(10000),
      })
    } finally {
      setSaving(false)
    }
  }

  async function add() {
    const q = newQ.trim()
    const a = newA.trim()
    if (!q || !a) return
    const updated = [...qa, { q, a }]
    setQa(updated)
    setNewQ('')
    setNewA('')
    setAdding(false)
    await save(updated)
  }

  async function remove(i: number) {
    const updated = qa.filter((_, idx) => idx !== i)
    setQa(updated)
    await save(updated)
  }

  return (
    <div className="space-y-3">
      {qa.length === 0 ? (
        <p className="text-xs t3">No FAQs yet.</p>
      ) : (
        <div className="space-y-2.5">
          {qa.map((item, i) => (
            <div key={i} className="group">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-medium t1 leading-snug flex-1">{item.q}</p>
                <button
                  onClick={() => remove(i)}
                  disabled={saving}
                  className="opacity-0 group-hover:opacity-100 text-[13px] t3 hover:text-red-400 transition-all shrink-0 px-1 leading-none disabled:opacity-20"
                  aria-label="Remove FAQ"
                >
                  ×
                </button>
              </div>
              <p className="text-[11px] t3 leading-relaxed mt-0.5 line-clamp-2 pr-4">{item.a}</p>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="space-y-2 pt-1">
          <input
            value={newQ}
            onChange={e => setNewQ(e.target.value)}
            placeholder="Question"
            className="w-full text-[11px] px-2.5 py-1.5 rounded-lg outline-none"
            style={{
              backgroundColor: 'var(--color-hover)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-1)',
            }}
          />
          <textarea
            value={newA}
            onChange={e => setNewA(e.target.value)}
            placeholder="Answer"
            rows={2}
            className="w-full text-[11px] px-2.5 py-1.5 rounded-lg outline-none resize-none"
            style={{
              backgroundColor: 'var(--color-hover)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-1)',
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={() => void add()}
              disabled={!newQ.trim() || !newA.trim() || saving}
              className="text-[11px] px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40"
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
            >
              Add
            </button>
            <button
              onClick={() => { setAdding(false); setNewQ(''); setNewA('') }}
              className="text-[11px] px-3 py-1.5 rounded-lg t3 transition-colors"
              style={{ backgroundColor: 'var(--color-hover)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-[11px] t3 hover:t2 transition-colors flex items-center gap-1 pt-0.5"
        >
          <span style={{ color: 'var(--color-primary)' }}>+</span> Add FAQ
        </button>
      )}
    </div>
  )
}
