'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ServiceRow {
  id: string
  client_id: string
  name: string
  description: string
  category: string
  duration_mins: number | null
  price: string
  booking_notes: string
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

interface ServiceDraft {
  name: string
  description?: string
  category?: string
  duration_mins?: number
  price?: string
  booking_notes?: string
}

// ─── ServiceCatalogEditor ──────────────────────────────────────────────────────

interface ServiceCatalogEditorProps {
  clientId: string
  isAdmin: boolean
  agentMode: string | null
  previewMode?: boolean
}

export default function ServiceCatalogEditor({
  clientId,
  isAdmin,
  agentMode,
  previewMode,
}: ServiceCatalogEditorProps) {
  const [services, setServices] = useState<ServiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const isBooking = agentMode === 'appointment_booking'

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchServices = useCallback(async () => {
    const qs = isAdmin ? `?client_id=${clientId}` : ''
    const res = await fetch(`/api/dashboard/services${qs}`)
    if (!res.ok) { setFetchError('Failed to load services'); return }
    const json = await res.json()
    setServices(json.services ?? [])
    setFetchError(null)
  }, [clientId, isAdmin])

  useEffect(() => {
    setLoading(true)
    fetchServices().finally(() => setLoading(false))
  }, [fetchServices])

  // ── Delete ────────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    await fetch(`/api/dashboard/services/${id}`, { method: 'DELETE' })
    setServices(prev => prev.filter(s => s.id !== id))
  }

  // ── Toggle active ─────────────────────────────────────────────────────────────

  async function handleToggleActive(id: string, current: boolean) {
    setServices(prev => prev.map(s => s.id === id ? { ...s, active: !current } : s))
    await fetch(`/api/dashboard/services/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !current }),
    })
  }

  // ── Add service form ──────────────────────────────────────────────────────────

  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', description: '', category: '', duration_mins: '', price: '', booking_notes: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  async function handleAdd() {
    if (!addForm.name.trim()) { setAddError('Name is required'); return }
    setAddSaving(true); setAddError(null)
    const payload: Record<string, unknown> = {
      name: addForm.name,
      description: addForm.description,
      category: addForm.category,
      price: addForm.price,
      booking_notes: addForm.booking_notes,
    }
    if (isAdmin) payload.client_id = clientId
    const dur = parseInt(addForm.duration_mins)
    if (!isNaN(dur) && dur > 0) payload.duration_mins = dur
    const res = await fetch('/api/dashboard/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) { setAddError(json.error || 'Failed to add'); setAddSaving(false); return }
    setServices(prev => [...prev, json.service])
    setAddForm({ name: '', description: '', category: '', duration_mins: '', price: '', booking_notes: '' })
    setShowAdd(false)
    setAddSaving(false)
  }

  // ── Inline edit ───────────────────────────────────────────────────────────────

  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', description: '', category: '', duration_mins: '', price: '', booking_notes: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  function startEdit(s: ServiceRow) {
    setEditId(s.id)
    setEditForm({
      name: s.name,
      description: s.description,
      category: s.category,
      duration_mins: s.duration_mins != null ? String(s.duration_mins) : '',
      price: s.price,
      booking_notes: s.booking_notes,
    })
    setEditError(null)
  }

  async function handleEditSave() {
    if (!editId) return
    if (!editForm.name.trim()) { setEditError('Name is required'); return }
    setEditSaving(true); setEditError(null)
    const payload: Record<string, unknown> = {
      name: editForm.name,
      description: editForm.description,
      category: editForm.category,
      price: editForm.price,
      booking_notes: editForm.booking_notes,
    }
    const dur = parseInt(editForm.duration_mins)
    payload.duration_mins = (!isNaN(dur) && dur > 0) ? dur : null
    const res = await fetch(`/api/dashboard/services/${editId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) { setEditError(json.error || 'Failed to save'); setEditSaving(false); return }
    setServices(prev => prev.map(s => s.id === editId ? json.service : s))
    setEditId(null)
    setEditSaving(false)
  }

  // ── AI Analyze ────────────────────────────────────────────────────────────────

  const [showAnalyze, setShowAnalyze] = useState(false)
  const [analyzeInput, setAnalyzeInput] = useState('')
  const [analyzeBusy, setAnalyzeBusy] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<ServiceDraft[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [selectedDrafts, setSelectedDrafts] = useState<Set<number>>(new Set())
  const [applyBusy, setApplyBusy] = useState(false)
  const [applyDone, setApplyDone] = useState(false)

  async function handleAnalyze() {
    if (!analyzeInput.trim()) return
    setAnalyzeBusy(true); setAnalyzeError(null); setDrafts([]); setWarnings([]); setApplyDone(false)
    const res = await fetch('/api/dashboard/services/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        raw_input: analyzeInput,
        ...(isAdmin ? { client_id: clientId } : {}),
      }),
    })
    const json = await res.json()
    if (!res.ok) { setAnalyzeError(json.error || 'Analysis failed'); setAnalyzeBusy(false); return }
    setDrafts(json.drafts ?? [])
    setWarnings(json.warnings ?? [])
    setSelectedDrafts(new Set((json.drafts ?? []).map((_: unknown, i: number) => i)))
    setAnalyzeBusy(false)
  }

  async function handleApply() {
    const approved = drafts.filter((_, i) => selectedDrafts.has(i))
    if (approved.length === 0) return
    setApplyBusy(true)
    const res = await fetch('/api/dashboard/services/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        drafts: approved,
        ...(isAdmin ? { client_id: clientId } : {}),
      }),
    })
    const json = await res.json()
    if (!res.ok) { setAnalyzeError(json.error || 'Apply failed'); setApplyBusy(false); return }
    setApplyDone(true)
    setDrafts([])
    setAnalyzeInput('')
    setShowAnalyze(false)
    await fetchServices()
    setApplyBusy(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="rounded-2xl border b-theme bg-surface px-5 py-4">
        <p className="text-[11px] t3">Loading services…</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5 space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium t1">Service Catalog</p>
          <p className="text-[11px] t3 mt-0.5">
            {isBooking
              ? 'Services shown to callers during booking. Per-service notes inject into agent context.'
              : 'List of services offered. Shown to the agent as reference.'}
          </p>
        </div>
        {!previewMode && (
          <div className="flex gap-2 shrink-0">
            {isBooking && (
              <button
                onClick={() => { setShowAnalyze(v => !v); setDrafts([]); setAnalyzeError(null) }}
                className="px-3 py-1 text-[11px] font-medium rounded-lg bg-white/5 hover:bg-white/10 t2 border b-theme transition-colors"
              >
                AI Import
              </button>
            )}
            <button
              onClick={() => setShowAdd(v => !v)}
              className="px-3 py-1 text-[11px] font-medium rounded-lg bg-white/5 hover:bg-white/10 t2 border b-theme transition-colors"
            >
              + Add
            </button>
          </div>
        )}
      </div>

      {fetchError && <p className="text-[11px] text-red-400">{fetchError}</p>}
      {applyDone && <p className="text-[11px] text-green-400">Services added successfully.</p>}

      {/* Service list */}
      {services.length === 0 && !showAdd && !showAnalyze && (
        <p className="text-[11px] t3">No services yet. Add one manually or use AI Import.</p>
      )}

      {services.map(s => (
        <div key={s.id} className="rounded-xl border b-theme p-3.5 space-y-2">
          {editId === s.id ? (
            /* Inline edit form */
            <div className="space-y-2">
              <input
                value={editForm.name}
                onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Service name *"
                className="w-full rounded-lg border b-theme bg-white/5 px-3 py-1.5 text-[13px] t1 outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={editForm.category}
                  onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))}
                  placeholder="Category"
                  className="rounded-lg border b-theme bg-white/5 px-3 py-1.5 text-[12px] t2 outline-none"
                />
                <input
                  value={editForm.price}
                  onChange={e => setEditForm(p => ({ ...p, price: e.target.value }))}
                  placeholder="Price (e.g. $45)"
                  className="rounded-lg border b-theme bg-white/5 px-3 py-1.5 text-[12px] t2 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={editForm.duration_mins}
                  onChange={e => setEditForm(p => ({ ...p, duration_mins: e.target.value }))}
                  placeholder="Duration (mins)"
                  type="number"
                  min="1"
                  className="rounded-lg border b-theme bg-white/5 px-3 py-1.5 text-[12px] t2 outline-none"
                />
                <input
                  value={editForm.description}
                  onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Description"
                  className="rounded-lg border b-theme bg-white/5 px-3 py-1.5 text-[12px] t2 outline-none"
                />
              </div>
              {isBooking && (
                <input
                  value={editForm.booking_notes}
                  onChange={e => setEditForm(p => ({ ...p, booking_notes: e.target.value }))}
                  placeholder="Booking notes (e.g. requires patch test 48h before)"
                  className="w-full rounded-lg border b-theme bg-white/5 px-3 py-1.5 text-[12px] t2 outline-none"
                />
              )}
              {editError && <p className="text-[11px] text-red-400">{editError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleEditSave}
                  disabled={editSaving}
                  className="px-3 py-1 text-[11px] font-medium rounded-lg bg-white/10 hover:bg-white/15 t1 transition-colors"
                >
                  {editSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setEditId(null)}
                  className="px-3 py-1 text-[11px] rounded-lg t3 hover:t2 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* Read mode */
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[13px] font-medium t1">{s.name}</p>
                  {s.category && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/8 t3">{s.category}</span>
                  )}
                  {s.price && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/8 t2">{s.price}</span>
                  )}
                  {s.duration_mins != null && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/8 t3">{s.duration_mins} min</span>
                  )}
                </div>
                {s.description && (
                  <p className="text-[11px] t3 mt-0.5">{s.description}</p>
                )}
                {isBooking && s.booking_notes && (
                  <p className="text-[11px] t3 mt-0.5 italic">Note: {s.booking_notes}</p>
                )}
              </div>
              {!previewMode && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Active toggle */}
                  <button
                    onClick={() => handleToggleActive(s.id, s.active)}
                    title={s.active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                    className={`w-8 h-4 rounded-full transition-colors flex items-center ${s.active ? 'bg-green-500/60' : 'bg-white/15'}`}
                  >
                    <span className={`w-3 h-3 rounded-full bg-white transition-transform mx-0.5 ${s.active ? 'translate-x-4' : ''}`} />
                  </button>
                  <button
                    onClick={() => startEdit(s)}
                    className="text-[11px] t3 hover:t2 px-1.5 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="text-[11px] text-red-400/60 hover:text-red-400 px-1.5 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Add form */}
      {showAdd && !previewMode && (
        <div className="rounded-xl border b-theme p-3.5 space-y-2">
          <p className="text-[11px] font-semibold t2 uppercase tracking-[0.12em]">New service</p>
          <input
            value={addForm.name}
            onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
            placeholder="Service name *"
            className="w-full rounded-lg border b-theme bg-white/5 px-3 py-1.5 text-[13px] t1 outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={addForm.category}
              onChange={e => setAddForm(p => ({ ...p, category: e.target.value }))}
              placeholder="Category"
              className="rounded-lg border b-theme bg-white/5 px-3 py-1.5 text-[12px] t2 outline-none"
            />
            <input
              value={addForm.price}
              onChange={e => setAddForm(p => ({ ...p, price: e.target.value }))}
              placeholder="Price (e.g. $45)"
              className="rounded-lg border b-theme bg-white/5 px-3 py-1.5 text-[12px] t2 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={addForm.duration_mins}
              onChange={e => setAddForm(p => ({ ...p, duration_mins: e.target.value }))}
              placeholder="Duration (mins)"
              type="number"
              min="1"
              className="rounded-lg border b-theme bg-white/5 px-3 py-1.5 text-[12px] t2 outline-none"
            />
            <input
              value={addForm.description}
              onChange={e => setAddForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Description"
              className="rounded-lg border b-theme bg-white/5 px-3 py-1.5 text-[12px] t2 outline-none"
            />
          </div>
          {isBooking && (
            <input
              value={addForm.booking_notes}
              onChange={e => setAddForm(p => ({ ...p, booking_notes: e.target.value }))}
              placeholder="Booking notes (e.g. requires patch test 48h before)"
              className="w-full rounded-lg border b-theme bg-white/5 px-3 py-1.5 text-[12px] t2 outline-none"
            />
          )}
          {addError && <p className="text-[11px] text-red-400">{addError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={addSaving}
              className="px-3 py-1 text-[11px] font-medium rounded-lg bg-white/10 hover:bg-white/15 t1 transition-colors"
            >
              {addSaving ? 'Adding…' : 'Add service'}
            </button>
            <button
              onClick={() => { setShowAdd(false); setAddError(null) }}
              className="px-3 py-1 text-[11px] rounded-lg t3 hover:t2 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* AI Analyze — appointment_booking only */}
      {showAnalyze && isBooking && !previewMode && (
        <div className="rounded-xl border b-theme p-3.5 space-y-3">
          <p className="text-[11px] font-semibold t2 uppercase tracking-[0.12em]">AI Import</p>
          <p className="text-[11px] t3">
            Paste a service menu, price list, or website copy. The AI extracts individual services for your review — nothing is saved until you approve.
          </p>
          <textarea
            value={analyzeInput}
            onChange={e => setAnalyzeInput(e.target.value)}
            placeholder="Paste your service list, price menu, or any text describing your services…"
            rows={5}
            className="w-full rounded-lg border b-theme bg-white/5 px-3 py-2 text-[12px] t1 outline-none resize-none"
          />
          {analyzeError && <p className="text-[11px] text-red-400">{analyzeError}</p>}
          <button
            onClick={handleAnalyze}
            disabled={analyzeBusy || !analyzeInput.trim()}
            className="px-3 py-1 text-[11px] font-medium rounded-lg bg-white/10 hover:bg-white/15 t1 disabled:opacity-40 transition-colors"
          >
            {analyzeBusy ? 'Analyzing…' : 'Analyze'}
          </button>

          {/* Draft review */}
          {drafts.length > 0 && (
            <div className="space-y-2">
              {warnings.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2 space-y-1">
                  {warnings.map((w, i) => (
                    <p key={i} className="text-[11px] text-amber-400">{w}</p>
                  ))}
                </div>
              )}
              <p className="text-[11px] t2 font-medium">Review extracted services — uncheck any you don&apos;t want:</p>
              {drafts.map((d, i) => (
                <label key={i} className="flex items-start gap-2.5 rounded-lg border b-theme p-2.5 cursor-pointer hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={selectedDrafts.has(i)}
                    onChange={() => setSelectedDrafts(prev => {
                      const next = new Set(prev)
                      if (next.has(i)) next.delete(i); else next.add(i)
                      return next
                    })}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-medium t1">{d.name}</p>
                      {d.category && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/8 t3">{d.category}</span>}
                      {d.price && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/8 t2">{d.price}</span>}
                      {d.duration_mins != null && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/8 t3">{d.duration_mins} min</span>}
                    </div>
                    {d.description && <p className="text-[11px] t3 mt-0.5">{d.description}</p>}
                    {d.booking_notes && <p className="text-[11px] t3 mt-0.5 italic">Note: {d.booking_notes}</p>}
                  </div>
                </label>
              ))}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleApply}
                  disabled={applyBusy || selectedDrafts.size === 0}
                  className="px-3 py-1 text-[11px] font-medium rounded-lg bg-white/10 hover:bg-white/15 t1 disabled:opacity-40 transition-colors"
                >
                  {applyBusy ? 'Adding…' : `Add ${selectedDrafts.size} service${selectedDrafts.size === 1 ? '' : 's'}`}
                </button>
                <button
                  onClick={() => { setDrafts([]); setAnalyzeInput('') }}
                  className="px-3 py-1 text-[11px] rounded-lg t3 hover:t2 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
