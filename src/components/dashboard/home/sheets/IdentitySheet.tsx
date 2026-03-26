'use client'

/**
 * IdentitySheet — agent name + voice link inside HomeSideSheet.
 * Lets the user rename their agent. Links to full voice settings.
 */

import { useState } from 'react'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'

interface Props {
  clientId: string
  isAdmin: boolean
  agentName: string
  markDirty: () => void
  markClean: () => void
  onSave: () => void
}

export default function IdentitySheet({ clientId, isAdmin, agentName, markDirty, markClean, onSave }: Props) {
  const [name, setName] = useState(agentName)
  const { saving, saved, error, patch } = usePatchSettings(clientId, isAdmin, { onSave })

  const isDirty = name.trim() !== agentName.trim() && name.trim().length > 0

  async function save() {
    if (!isDirty) return
    const res = await patch({ agent_name: name.trim() })
    if (res?.ok) markClean()
  }

  return (
    <div className="space-y-6">
      {/* Agent name */}
      <div className="space-y-3">
        <label className="block text-[11px] font-semibold tracking-[0.12em] uppercase t3">Agent Name</label>
        <input
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); markDirty() }}
          placeholder="e.g. Alex, Sam, Max"
          className="w-full rounded-xl px-3.5 py-2.5 text-sm t1 outline-none transition-colors"
          style={{
            backgroundColor: 'var(--color-hover)',
            border: '1px solid var(--color-border)',
          }}
          onFocus={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
          onBlur={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
        />
        <p className="text-[11px] t3 leading-relaxed">
          Your agent will introduce themselves by this name on every call.
        </p>
      </div>

      {(isDirty || saved) && (
        <button
          onClick={save}
          disabled={saving || !isDirty}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Name'}
        </button>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Divider */}
      <div className="h-px" style={{ backgroundColor: 'var(--color-border)' }} />

      {/* Voice shortcut */}
      <div className="space-y-3">
        <p className="text-[11px] font-semibold tracking-[0.12em] uppercase t3">Voice & Personality</p>
        <p className="text-xs t3 leading-relaxed">
          Choose your agent&apos;s voice, speed, and communication style from the Voice settings.
        </p>
        <a
          href="/dashboard/agent"
          className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors hover:bg-hover"
          style={{ border: '1px solid var(--color-border)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="t1">Open Voice Settings</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="t3 ml-auto">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </a>
      </div>
    </div>
  )
}
