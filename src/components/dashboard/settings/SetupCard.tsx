'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { fmtPhone } from '@/lib/settings-utils'
import { CopyButton } from './shared'
import { usePatchSettings } from './usePatchSettings'

interface SetupCardProps {
  clientId: string
  isAdmin: boolean
  twilioNumber: string | null
  initialForwardingNumber: string
  initialTransferConditions: string
  initialSetupComplete: boolean
  previewMode?: boolean
  onSetupCompleteChange?: (complete: boolean) => void
}

export default function SetupCard({
  clientId,
  isAdmin,
  twilioNumber,
  initialForwardingNumber,
  initialTransferConditions,
  initialSetupComplete,
  previewMode,
  onSetupCompleteChange,
}: SetupCardProps) {
  const [collapsed, setCollapsed] = useState(() => !!(initialSetupComplete || twilioNumber))
  const [editing, setEditing] = useState(false)
  const [forwardingNumber, setForwardingNumber] = useState(initialForwardingNumber)
  const [transferConditions, setTransferConditions] = useState(initialTransferConditions)
  const [setupComplete, setSetupComplete] = useState(initialSetupComplete)

  const { saving, saved, patch } = usePatchSettings(clientId, isAdmin)

  async function saveSetup() {
    await patch({
      forwarding_number: forwardingNumber,
      transfer_conditions: transferConditions,
      setup_complete: setupComplete,
    })
    if (setupComplete) setEditing(false)
  }

  async function handleMarkComplete() {
    setSetupComplete(true)
    onSetupCompleteChange?.(true)
    await patch({ setup_complete: true })
  }

  async function handleActivate() {
    setSetupComplete(true)
    onSetupCompleteChange?.(true)
    await patch({
      forwarding_number: forwardingNumber,
      transfer_conditions: transferConditions,
      setup_complete: true,
    })
  }

  async function handleReset() {
    setSetupComplete(false)
    onSetupCompleteChange?.(false)
    await patch({
      forwarding_number: forwardingNumber,
      transfer_conditions: transferConditions,
      setup_complete: false,
    })
  }

  // Admin compact view
  if (isAdmin && !setupComplete) {
    return (
      <div className="mt-3 flex justify-end">
        <button
          onClick={handleMarkComplete}
          className="text-xs px-3 py-1.5 rounded-lg border"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-3)' }}
        >
          Setup incomplete &middot; Mark as done &rarr;
        </button>
      </div>
    )
  }

  // Setup complete — compact display
  if (setupComplete && !editing) {
    return (
      <div className="rounded-2xl border b-theme bg-surface px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span className="text-xs t2">Setup complete</span>
          {twilioNumber && (
            <span className="text-xs font-mono t3">{fmtPhone(twilioNumber)}</span>
          )}
        </div>
        <button onClick={() => setEditing(true)} className="text-xs t3 hover:t1 transition-colors">Edit</button>
      </div>
    )
  }

  // Full setup form
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] overflow-hidden">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full px-5 py-3 border-b border-amber-500/20 flex items-center gap-2 hover:bg-amber-500/[0.04] transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-amber-400 shrink-0"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-amber-400 flex-1 text-left">Start here &mdash; complete your setup</p>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          className="text-amber-400/60 shrink-0 transition-transform duration-200"
          style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="setup-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="p-5 space-y-4">
              {/* AI phone number */}
              <div>
                <p className="text-xs t3 mb-1.5">Your AI phone number</p>
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm font-mono t1">{fmtPhone(twilioNumber) || 'Not yet assigned'}</span>
                  {twilioNumber && <CopyButton value={twilioNumber} label="Copy" />}
                </div>
                <p className="text-[11px] t3 mt-1">Share this number &mdash; callers will reach your AI agent here.</p>
              </div>

              {/* Forwarding number */}
              <div>
                <label className="text-xs t2 mb-1.5 flex items-center gap-2">
                  Call forwarding number
                  <span className="text-[9px] font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">Beta</span>
                </label>
                <input
                  type="tel"
                  value={forwardingNumber}
                  onChange={(e) => setForwardingNumber(e.target.value)}
                  placeholder="+1 (555) 555-5555"
                  className="w-full bg-hover border b-theme rounded-lg px-3 py-2 text-sm t1 placeholder:t3 focus:outline-none focus:border-white/20"
                />
                <p className="text-[11px] t3 mt-1">Your personal number. When a live transfer is triggered, the caller is connected here immediately.</p>
              </div>

              {/* Transfer conditions */}
              <div>
                <label className="text-xs t2 mb-1.5 block">Transfer conditions</label>
                <textarea
                  rows={2}
                  value={transferConditions}
                  onChange={(e) => setTransferConditions(e.target.value)}
                  placeholder="e.g. the caller explicitly says it's an emergency or urgently insists on speaking to a human"
                  className="w-full bg-hover border b-theme rounded-lg px-3 py-2 text-sm t1 placeholder:t3 focus:outline-none focus:border-white/20 resize-none"
                />
                <p className="text-[11px] t3 mt-1">Describe when your agent should offer a live transfer. Leave blank to use the default (emergency or explicit human request only).</p>
              </div>

              {/* Checklist */}
              <div className="rounded-2xl bg-surface border b-theme p-4 space-y-3">
                <p className="text-xs font-medium t2">Setup Checklist</p>
                <div className="space-y-2">
                  <ChecklistItem done={!!twilioNumber} label="AI phone number assigned" />
                  <ChecklistItem done={!!forwardingNumber} label="Call forwarding configured" />
                  <ChecklistItem done={setupComplete} label="Setup marked complete" amber={!setupComplete} />
                </div>

                {twilioNumber && forwardingNumber && !setupComplete && (
                  <button
                    onClick={handleActivate}
                    disabled={saving || previewMode}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-green-500 hover:bg-green-400 text-black transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Activating\u2026' : 'Activate Agent'}
                  </button>
                )}

                {setupComplete && (
                  <button
                    onClick={handleReset}
                    disabled={saving || previewMode}
                    className="text-[11px] t3 hover:t2 transition-colors"
                  >
                    Reset setup status
                  </button>
                )}

                {!twilioNumber && (
                  <button
                    onClick={saveSetup}
                    disabled={saving || previewMode}
                    className="px-4 py-1.5 text-xs font-medium rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Saving\u2026' : 'Save setup'}
                  </button>
                )}

                {saved && <span className="text-xs text-green-400 block">Saved</span>}

                {editing && (
                  <button onClick={() => setEditing(false)} className="text-xs t3 hover:t1 transition-colors block">Cancel</button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ChecklistItem({ done, label, amber }: { done: boolean; label: string; amber?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      {done ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-green-400 shrink-0">
          <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.15"/>
          <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${amber ? 'border-amber-500/60' : 'border-zinc-600'}`} />
      )}
      <span className={`text-xs ${done ? 't2' : 't3'}`}>{label}</span>
    </div>
  )
}
