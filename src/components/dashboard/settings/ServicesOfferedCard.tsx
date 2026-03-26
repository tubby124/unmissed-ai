'use client'

import { useState, useEffect } from 'react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import { usePatchSettings } from './usePatchSettings'

interface ServicesOfferedCardProps {
  client: ClientConfig
  clientId?: string
  isAdmin?: boolean
}

export default function ServicesOfferedCard({
  client,
  clientId,
  isAdmin = false,
}: ServicesOfferedCardProps) {
  const id = clientId ?? client.id
  const [value, setValue] = useState(client.services_offered ?? '')
  const [editing, setEditing] = useState(false)
  const { saving, patch, warnings } = usePatchSettings(id, isAdmin)
  const [patchWarning, setPatchWarning] = useState<string | null>(null)

  // Surface patcher warnings after each save
  useEffect(() => {
    const w = warnings.find(msg => msg.includes("prompt doesn't use the standard format") || msg.includes('Services saved'))
    setPatchWarning(w ?? null)
  }, [warnings])

  async function handleSave() {
    await patch({ services_offered: value.trim() })
    setEditing(false)
  }

  function handleCancel() {
    setValue(client.services_offered ?? '')
    setEditing(false)
  }

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5">
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-0.5">Services Offered</p>
      <p className="text-[11px] t3 mb-3">
        What your agent says when asked &ldquo;what services do you offer?&rdquo;
        {client.services_offered && (
          <span className="ml-1 opacity-60">· sourced from your Google Business Profile or onboarding</span>
        )}
      </p>

      {patchWarning && (
        <p className="text-[10px] text-amber-400/90 bg-amber-500/[0.06] border border-amber-500/20 rounded-lg px-3 py-2 mb-3 leading-relaxed">
          ⚠ {patchWarning}
        </p>
      )}

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={value}
            onChange={e => setValue(e.target.value)}
            rows={3}
            className="w-full bg-transparent border b-theme rounded-lg px-3 py-2 text-[12px] t1 resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            placeholder="e.g. windshield replacement, chip repair, mobile service anywhere in the city"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-[11px] font-medium t3 hover:t1 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !value.trim()}
              className="px-3 py-1.5 text-[11px] font-semibold bg-[var(--color-primary)] text-white rounded-lg hover:opacity-80 disabled:opacity-40 transition-opacity"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <p className="text-[12px] t2 flex-1 leading-relaxed">
            {client.services_offered
              ? client.services_offered
              : <span className="t3 italic">Not set — agent uses default from initial prompt</span>
            }
          </p>
          <button
            onClick={() => setEditing(true)}
            className="text-[11px] font-medium text-[var(--color-primary)] hover:opacity-75 shrink-0 transition-opacity"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  )
}
