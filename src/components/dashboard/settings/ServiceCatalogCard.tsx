'use client'

import { useState } from 'react'
import { usePatchSettings } from './usePatchSettings'

export interface ServiceCatalogItem {
  name: string
  duration_mins?: number
  price?: string
}

interface ServiceCatalogCardProps {
  clientId: string
  initialCatalog: ServiceCatalogItem[]
  isAdmin?: boolean
  previewMode?: boolean
}

export default function ServiceCatalogCard({
  clientId,
  initialCatalog,
  isAdmin = false,
  previewMode,
}: ServiceCatalogCardProps) {
  const [items, setItems] = useState<ServiceCatalogItem[]>(initialCatalog)
  const [newName, setNewName] = useState('')
  const [newDuration, setNewDuration] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const { patch, saving, saved, error } = usePatchSettings(clientId, isAdmin)

  function addItem() {
    const name = newName.trim()
    if (!name) return
    const item: ServiceCatalogItem = { name }
    const dur = parseInt(newDuration, 10)
    if (dur > 0) item.duration_mins = dur
    if (newPrice.trim()) item.price = newPrice.trim()
    setItems(prev => [...prev, item])
    setNewName('')
    setNewDuration('')
    setNewPrice('')
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    await patch({ service_catalog: items })
  }

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5">
      <div className="mb-1">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Service Catalog</p>
      </div>
      <p className="text-[11px] t3 mb-4">
        List the services your agent can book. Changes apply after your next agent rebuild.
      </p>

      {/* Existing items */}
      <div className="space-y-1.5 mb-4">
        {items.length === 0 && (
          <p className="text-[11px] t3 italic">No services added yet.</p>
        )}
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 rounded-lg border b-theme bg-black/20 px-3 py-2">
            <span className="flex-1 text-[12px] t1 font-medium">{item.name}</span>
            {item.duration_mins && (
              <span className="text-[11px] t3">{item.duration_mins} min</span>
            )}
            {item.price && (
              <span className="text-[11px] t3">{item.price}</span>
            )}
            <button
              onClick={() => removeItem(idx)}
              disabled={previewMode}
              className="text-[11px] t3 hover:text-red-400 transition-colors disabled:opacity-40"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Add new item */}
      <div className="rounded-lg border b-theme bg-black/20 p-3 mb-4 space-y-2">
        <p className="text-[10px] font-semibold tracking-[0.12em] uppercase t3">Add Service</p>
        <input
          type="text"
          placeholder="Service name (required)"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addItem()}
          disabled={previewMode}
          className="w-full bg-black/30 border b-theme rounded-lg px-3 py-1.5 text-[12px] t1 placeholder:t3 outline-none focus:border-[var(--color-primary)]/50 disabled:opacity-50"
        />
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Duration (min)"
            value={newDuration}
            onChange={e => setNewDuration(e.target.value)}
            disabled={previewMode}
            className="flex-1 bg-black/30 border b-theme rounded-lg px-3 py-1.5 text-[12px] t1 placeholder:t3 outline-none focus:border-[var(--color-primary)]/50 disabled:opacity-50"
          />
          <input
            type="text"
            placeholder="Price (e.g. $45)"
            value={newPrice}
            onChange={e => setNewPrice(e.target.value)}
            disabled={previewMode}
            className="flex-1 bg-black/30 border b-theme rounded-lg px-3 py-1.5 text-[12px] t1 placeholder:t3 outline-none focus:border-[var(--color-primary)]/50 disabled:opacity-50"
          />
        </div>
        <button
          type="button"
          onClick={addItem}
          disabled={!newName.trim() || previewMode}
          className="text-[11px] font-medium text-[var(--color-primary)] hover:opacity-80 transition-opacity disabled:opacity-30"
        >
          + Add
        </button>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || previewMode}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30 transition-all disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save Catalog'}
        </button>
        {saved && <span className="text-[11px] text-green-400">Saved</span>}
        {error && <span className="text-[11px] text-red-400">{error}</span>}
      </div>
    </div>
  )
}
