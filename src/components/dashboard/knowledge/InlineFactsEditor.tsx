'use client'

import { useState, useRef, useEffect } from 'react'

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
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const editRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingIdx !== null) editRef.current?.focus()
  }, [editingIdx])

  // Clear confirm delete after 3s
  useEffect(() => {
    if (confirmDelete === null) return
    const t = setTimeout(() => setConfirmDelete(null), 3000)
    return () => clearTimeout(t)
  }, [confirmDelete])

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

  function startEdit(i: number) {
    setEditingIdx(i)
    setEditValue(facts[i])
  }

  async function saveEdit() {
    if (editingIdx === null) return
    const trimmed = editValue.trim()
    if (!trimmed) { setEditingIdx(null); return }
    const updated = facts.map((f, idx) => idx === editingIdx ? trimmed : f)
    setFacts(updated)
    setEditingIdx(null)
    await save(updated)
  }

  function cancelEdit() {
    setEditingIdx(null)
    setEditValue('')
  }

  async function remove(i: number) {
    if (confirmDelete !== i) {
      setConfirmDelete(i)
      return
    }
    const updated = facts.filter((_, idx) => idx !== i)
    setFacts(updated)
    setConfirmDelete(null)
    await save(updated)
  }

  return (
    <div className="space-y-2">
      {facts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="t3">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          <p className="text-xs t3">No facts yet. Add business details your agent should know.</p>
        </div>
      ) : (
        <ul className="space-y-1">
          {facts.map((fact, i) => (
            <li key={i} className="flex items-start gap-2 group rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-hover transition-colors">
              <span
                className="mt-[5px] shrink-0 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: 'var(--color-primary)', opacity: 0.6 }}
              />
              {editingIdx === i ? (
                <input
                  ref={editRef}
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); void saveEdit() }
                    if (e.key === 'Escape') cancelEdit()
                  }}
                  onBlur={() => void saveEdit()}
                  className="flex-1 text-[12px] px-2 py-0.5 rounded outline-none min-w-0"
                  style={{
                    backgroundColor: 'var(--color-bg)',
                    border: '1px solid var(--color-primary)',
                    color: 'var(--color-text-1)',
                  }}
                />
              ) : (
                <>
                  <span className="text-[12px] t2 leading-relaxed flex-1 min-w-0">{fact}</span>
                  <button
                    onClick={() => startEdit(i)}
                    disabled={saving}
                    className="opacity-0 group-hover:opacity-100 t3 hover:t1 transition-all shrink-0 px-1 leading-none disabled:opacity-20 cursor-pointer"
                    aria-label="Edit fact"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => remove(i)}
                    disabled={saving}
                    className={`shrink-0 px-1 leading-none transition-all cursor-pointer ${
                      confirmDelete === i
                        ? 'opacity-100 text-red-400 text-[10px] font-semibold'
                        : 'opacity-0 group-hover:opacity-100 text-[13px] t3 hover:text-red-400 disabled:opacity-20'
                    }`}
                    aria-label={confirmDelete === i ? 'Confirm delete' : 'Delete fact'}
                  >
                    {confirmDelete === i ? 'Delete?' : '×'}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 pt-1">
        <input
          value={newFact}
          onChange={e => setNewFact(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void add() } }}
          placeholder="Add a fact and press Enter..."
          className="flex-1 text-[11px] px-2.5 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-blue-500/40"
          style={{
            backgroundColor: 'var(--color-hover)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-1)',
          }}
        />
        <button
          onClick={() => void add()}
          disabled={!newFact.trim() || saving}
          className="text-[11px] px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 cursor-pointer"
          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
        >
          Add
        </button>
      </div>
    </div>
  )
}
