'use client'

import { useState } from 'react'
import { AGENT_MODES, type AgentMode } from '@/lib/capabilities'
import { usePatchSettings } from './usePatchSettings'
import FieldSyncStatusChip from './FieldSyncStatusChip'

interface CallHandlingModeCardProps {
  clientId: string
  isAdmin: boolean
  initialMode: AgentMode
  selectedPlan: string | null
  subscriptionStatus: string | null
  previewMode?: boolean
  onPromptChange?: (prompt: string) => void
}

export default function CallHandlingModeCard({
  clientId,
  isAdmin,
  initialMode,
  selectedPlan,
  subscriptionStatus,
  previewMode,
  onPromptChange,
}: CallHandlingModeCardProps) {
  const [mode, setMode] = useState<AgentMode>(initialMode)
  const { saving, saved, error, patch, retryFieldSync } = usePatchSettings(clientId, isAdmin, { onPromptChange })

  // Trial and null plans get full access (same gate as step3-capabilities)
  const isTrial = subscriptionStatus === 'trialing' || !subscriptionStatus
  const canSelectFullService = selectedPlan === 'pro' || isTrial

  async function selectMode(newMode: AgentMode) {
    if (newMode === mode) return
    if (saving || previewMode) return
    // Plan gate: full_service requires Pro (unless trial)
    if (newMode === 'full_service' && !canSelectFullService) return

    const prevMode = mode
    setMode(newMode)
    const res = await patch({ call_handling_mode: newMode })
    if (!res?.ok) setMode(prevMode)
  }

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5">
      <div className="mb-1">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Agent Mode</p>
      </div>
      <p className="text-[11px] t3 mb-4">How your agent handles calls. Applies to new calls only.</p>

      <div className="space-y-2">
        {AGENT_MODES.map((m) => {
          const isSelected = mode === m.id
          const isLocked = m.id === 'full_service' && !canSelectFullService

          return (
            <button
              key={m.id}
              onClick={() => selectMode(m.id)}
              disabled={saving || previewMode || isLocked}
              className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
                isSelected
                  ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/[0.06]'
                  : isLocked
                  ? 'border-zinc-700/30 bg-zinc-800/20 opacity-60 cursor-not-allowed'
                  : 'border-[var(--color-border)] bg-[var(--color-bg-hover)] hover:border-zinc-500/40'
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-semibold t1">{m.label}</span>
                {isSelected && (
                  <span className="ml-auto text-[10px] font-medium text-[var(--color-primary)]">Active</span>
                )}
                {isLocked && (
                  <span className="ml-auto text-[10px] font-medium text-amber-400">Pro plan</span>
                )}
              </div>
              <p className="text-[11px] t3 pl-6">{m.tagline}</p>
            </button>
          )
        })}
      </div>

      <FieldSyncStatusChip
        clientId={clientId}
        fieldKey="call_handling_mode"
        currentValue={mode}
        onRetry={retryFieldSync}
      />

      {/* Plan gate message for full_service on non-Pro */}
      {mode === 'full_service' && !canSelectFullService && (
        <p className="text-[11px] text-amber-400/80 mt-3">
          Calendar booking requires the Pro plan. Your agent runs as AI Receptionist until you upgrade.
        </p>
      )}

      {saving && <p className="text-[11px] t3 mt-2">Saving...</p>}
      {saved && <p className="text-[11px] text-emerald-400 mt-2">Mode updated</p>}
      {error && <p className="text-[11px] text-red-400 mt-2">{error}</p>}
    </div>
  )
}
