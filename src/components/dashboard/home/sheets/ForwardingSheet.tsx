'use client'

/**
 * ForwardingSheet — live transfer number + conditions quick edit.
 */

import { useState } from 'react'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'

interface Props {
  clientId: string
  isAdmin: boolean
  initialForwardingNumber: string
  markDirty: () => void
  markClean: () => void
  onSave: () => void
}

export default function ForwardingSheet({ clientId, isAdmin, initialForwardingNumber, markDirty, markClean, onSave }: Props) {
  const [number, setNumber] = useState(initialForwardingNumber)
  const { saving, saved, error, patch } = usePatchSettings(clientId, isAdmin, { onSave })

  const isDirty = number !== initialForwardingNumber

  async function save() {
    const res = await patch({ forwarding_number: number || null })
    if (res?.ok) markClean()
  }

  return (
    <div className="space-y-5">
      <p className="text-xs t3 leading-relaxed">
        When enabled, your agent can transfer live calls to this phone number when a caller asks to speak with someone.
        Requires a Pro plan.
      </p>

      <div className="space-y-2">
        <label className="block text-[11px] font-semibold tracking-[0.12em] uppercase t3">Forwarding Number</label>
        <input
          type="tel"
          value={number}
          onChange={e => { setNumber(e.target.value); markDirty() }}
          placeholder="+1 (555) 000-0000"
          className="w-full rounded-xl px-3.5 py-2.5 text-sm t1 outline-none transition-colors"
          style={{
            backgroundColor: 'var(--color-hover)',
            border: '1px solid var(--color-border)',
          }}
          onFocus={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
          onBlur={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
        />
        <p className="text-[11px] t3">Enter in E.164 format: +1XXXXXXXXXX</p>
      </div>

      {(isDirty || saved) && (
        <button
          onClick={save}
          disabled={saving || !isDirty}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Number'}
        </button>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}

      <a
        href="/dashboard/settings?tab=transfer"
        className="block text-center text-xs font-semibold"
        style={{ color: 'var(--color-text-3)' }}
      >
        Configure transfer conditions →
      </a>
    </div>
  )
}
