'use client'

import { useState } from 'react'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'
import type { ClientConfig } from '@/app/dashboard/settings/page'

interface Props {
  client: ClientConfig
  isAdmin: boolean
  previewMode?: boolean
}

export default function TransferSettingsSection({ client, isAdmin, previewMode }: Props) {
  const [forwardingNumber, setForwardingNumber] = useState(client.forwarding_number ?? '')
  const [transferConditions, setTransferConditions] = useState(client.transfer_conditions ?? '')
  const { saving, saved, patch } = usePatchSettings(client.id, isAdmin)

  async function save() {
    await patch({
      forwarding_number: forwardingNumber,
      transfer_conditions: transferConditions,
    })
  }

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5">
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-1">Live Transfer</p>
      <p className="text-[11px] t3 mb-4">Transfer callers to a live person when needed.</p>

      <div className="space-y-3">
        <div>
          <label className="text-xs t2 mb-1.5 flex items-center gap-2">
            Forwarding number
            <span className="text-[9px] font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">Beta</span>
          </label>
          <input
            type="tel"
            value={forwardingNumber}
            onChange={(e) => setForwardingNumber(e.target.value)}
            placeholder="+1 (555) 555-5555"
            disabled={previewMode}
            className="w-full bg-hover border b-theme rounded-lg px-3 py-2 text-sm t1 placeholder:t3 focus:outline-none focus:border-white/20 disabled:opacity-50"
          />
          <p className="text-[11px] t3 mt-1">Your personal number. When a transfer is triggered, the caller is connected here immediately.</p>
        </div>

        <div>
          <label className="text-xs t2 mb-1.5 block">Transfer conditions</label>
          <textarea
            rows={2}
            value={transferConditions}
            onChange={(e) => setTransferConditions(e.target.value)}
            placeholder="e.g. the caller explicitly says it's an emergency or urgently insists on speaking to a human"
            disabled={previewMode}
            className="w-full bg-hover border b-theme rounded-lg px-3 py-2 text-sm t1 placeholder:t3 focus:outline-none focus:border-white/20 resize-y min-h-[72px] disabled:opacity-50"
          />
          <p className="text-[11px] t3 mt-1">Describe when your agent should offer a live transfer. Leave blank to use the default (emergency or explicit human request only).</p>
        </div>

        {!forwardingNumber && (
          <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-amber-500/[0.07] border border-amber-500/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-amber-400 shrink-0">
              <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-[11px] text-amber-400/90">No forwarding number set — live transfer is disabled until you add one.</span>
          </div>
        )}

        <button
          onClick={save}
          disabled={saving || previewMode}
          className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            saved
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-blue-500 hover:bg-blue-400 text-white'
          } disabled:opacity-40`}
        >
          {saving ? 'Saving\u2026' : saved ? '\u2713 Saved' : 'Save Transfer Settings'}
        </button>
      </div>
    </div>
  )
}
