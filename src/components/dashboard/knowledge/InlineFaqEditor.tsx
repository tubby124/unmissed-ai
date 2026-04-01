'use client'

import { useState, useRef, useEffect } from 'react'

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
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editQ, setEditQ] = useState('')
  const [editA, setEditA] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const editQRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingIdx !== null) editQRef.current?.focus()
  }, [editingIdx])

  useEffect(() => {
    if (confirmDelete === null) return
    const t = setTimeout(() => setConfirmDelete(null), 3000)
    return () => clearTimeout(t)
  }, [confirmDelete])

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

  function startEdit(i: number) {
    setEditingIdx(i)
    setEditQ(qa[i].q)
    setEditA(qa[i].a)
    setExpandedIdx(i)
  }

  async function saveEdit() {
    if (editingIdx === null) return
    const q = editQ.trim()
    const a = editA.trim()
    if (!q || !a) { setEditingIdx(null); return }
    const updated = qa.map((item, idx) => idx === editingIdx ? { q, a } : item)
    setQa(updated)
    setEditingIdx(null)
    await save(updated)
  }

  async function remove(i: number) {
    if (confirmDelete !== i) {
      setConfirmDelete(i)
      return
    }
    const updated = qa.filter((_, idx) => idx !== i)
    setQa(updated)
    setConfirmDelete(null)
    if (expandedIdx === i) setExpandedIdx(null)
    await save(updated)
  }

  function toggleExpand(i: number) {
    setExpandedIdx(prev => prev === i ? null : i)
  }

  return (
    <div className="space-y-2">
      {qa.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="t3">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="text-xs t3">No FAQs yet. Add questions your agent should be able to answer.</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {qa.map((item, i) => (
            <div
              key={i}
              className="group rounded-lg hover:bg-hover transition-colors -mx-1.5 px-1.5"
            >
              <div className="flex items-center gap-2 py-1.5">
                <button
                  onClick={() => toggleExpand(i)}
                  className="shrink-0 t3 hover:t1 transition-colors cursor-pointer"
                  aria-label={expandedIdx === i ? 'Collapse' : 'Expand'}
                >
                  <svg
                    width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: expandedIdx === i ? 'rotate(90deg)' : undefined, transition: 'transform 0.15s' }}
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
                <p
                  className="text-[11px] font-medium t1 leading-snug flex-1 min-w-0 truncate cursor-pointer"
                  onClick={() => toggleExpand(i)}
                >
                  {item.q}
                </p>
                <button
                  onClick={() => startEdit(i)}
                  disabled={saving}
                  className="opacity-0 group-hover:opacity-100 t3 hover:t1 transition-all shrink-0 px-1 cursor-pointer"
                  aria-label="Edit FAQ"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  onClick={() => remove(i)}
                  disabled={saving}
                  className={`shrink-0 px-1 transition-all cursor-pointer ${
                    confirmDelete === i
                      ? 'opacity-100 text-red-400 text-[10px] font-semibold'
                      : 'opacity-0 group-hover:opacity-100 text-[13px] t3 hover:text-red-400 disabled:opacity-20'
                  }`}
                  aria-label={confirmDelete === i ? 'Confirm delete' : 'Delete FAQ'}
                >
                  {confirmDelete === i ? 'Delete?' : '×'}
                </button>
              </div>

              {expandedIdx === i && (
                <div className="pb-2 pl-5">
                  {editingIdx === i ? (
                    <div className="space-y-2">
                      <input
                        ref={editQRef}
                        value={editQ}
                        onChange={e => setEditQ(e.target.value)}
                        placeholder="Question"
                        className="w-full text-[11px] px-2.5 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-blue-500/40"
                        style={{
                          backgroundColor: 'var(--color-bg)',
                          border: '1px solid var(--color-primary)',
                          color: 'var(--color-text-1)',
                        }}
                      />
                      <textarea
                        value={editA}
                        onChange={e => setEditA(e.target.value)}
                        rows={3}
                        className="w-full text-[11px] px-2.5 py-1.5 rounded-lg outline-none resize-none focus:ring-1 focus:ring-blue-500/40"
                        style={{
                          backgroundColor: 'var(--color-bg)',
                          border: '1px solid var(--color-primary)',
                          color: 'var(--color-text-1)',
                        }}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => void saveEdit()}
                          disabled={!editQ.trim() || !editA.trim() || saving}
                          className="text-[10px] px-2.5 py-1 rounded-lg font-medium transition-colors disabled:opacity-40 cursor-pointer"
                          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingIdx(null)}
                          className="text-[10px] px-2.5 py-1 rounded-lg t3 transition-colors cursor-pointer"
                          style={{ backgroundColor: 'var(--color-hover)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] t3 leading-relaxed">{item.a}</p>
                  )}
                </div>
              )}
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
            className="w-full text-[11px] px-2.5 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-blue-500/40"
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
            className="w-full text-[11px] px-2.5 py-1.5 rounded-lg outline-none resize-none focus:ring-1 focus:ring-blue-500/40"
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
              className="text-[11px] px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 cursor-pointer"
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
            >
              Add
            </button>
            <button
              onClick={() => { setAdding(false); setNewQ(''); setNewA('') }}
              className="text-[11px] px-3 py-1.5 rounded-lg t3 transition-colors cursor-pointer"
              style={{ backgroundColor: 'var(--color-hover)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-[11px] t3 hover:t2 transition-colors flex items-center gap-1 pt-0.5 cursor-pointer"
        >
          <span style={{ color: 'var(--color-primary)' }}>+</span> Add FAQ
        </button>
      )}
    </div>
  )
}
