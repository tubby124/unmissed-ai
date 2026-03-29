'use client'

import { useState } from 'react'
import { AGENT_MODE_VALUES, AGENT_MODE_LABELS, type AgentMode } from '@/lib/agent-mode-rebuild'

const CALL_HANDLING_DISPLAY: Record<string, string> = {
  message_only: 'Message Taking',
  triage: 'AI Receptionist',
  full_service: 'Receptionist + Booking',
}

const MODE_TAGLINES: Record<AgentMode, string> = {
  lead_capture: 'Collect name, problem, and callback info on every call.',
  voicemail_replacement: 'Take a message and hang up — no triage, no service discussion.',
  info_hub: 'Answer questions about your business and hours, no lead form.',
  appointment_booking: 'Check availability and book appointments directly on the call.',
}

interface AgentModeCardProps {
  clientId: string
  currentAgentMode: string | null
  currentCallHandlingMode?: string | null
  previewMode?: boolean
}

type ModeStep = 'idle' | 'previewing' | 'preview_ready' | 'deploying' | 'done' | 'saved_not_synced' | 'error'

export default function AgentModeCard({
  clientId,
  currentAgentMode,
  currentCallHandlingMode,
  previewMode,
}: AgentModeCardProps) {
  const initialMode: AgentMode = AGENT_MODE_VALUES.includes(currentAgentMode as AgentMode)
    ? (currentAgentMode as AgentMode)
    : 'lead_capture'

  const [selectedMode, setSelectedMode] = useState<AgentMode>(initialMode)
  const [step, setStep] = useState<ModeStep>('idle')
  const [previewData, setPreviewData] = useState<{
    currentPrompt: string
    rebuiltPrompt: string
    charCountCurrent: number
    charCountRebuilt: number
    effectiveCallHandlingMode: string
    currentAgentMode: string | null
    changedSections: string[]
  } | null>(null)
  const [showFullPrompts, setShowFullPrompts] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [cooldownSeconds, setCooldownSeconds] = useState<number | null>(null)

  function selectMode(m: AgentMode) {
    if (step === 'previewing' || step === 'deploying') return
    setSelectedMode(m)
    // Reset preview if user changes selection after preview
    if (step === 'preview_ready') {
      setStep('idle')
      setPreviewData(null)
      setShowFullPrompts(false)
      setErrorMsg(null)
    }
  }

  async function handlePreview() {
    setStep('previewing')
    setErrorMsg(null)
    setPreviewData(null)
    setCooldownSeconds(null)
    try {
      const res = await fetch('/api/dashboard/regenerate-prompt/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, agentModeOverride: selectedMode }),
      })
      const data = await res.json()
      if (res.status === 429) {
        setCooldownSeconds(data.cooldown_seconds ?? null)
        setErrorMsg(data.error ?? 'Too many requests. Please wait before previewing.')
        setStep('error')
        return
      }
      if (!res.ok || data.error) {
        if (data.error?.includes('No intake submission')) {
          setErrorMsg('no_intake')
        } else {
          setErrorMsg(data.error ?? 'Preview failed')
        }
        setStep('error')
        return
      }
      setPreviewData(data)
      setStep('preview_ready')
    } catch {
      setErrorMsg('Network error. Please try again.')
      setStep('error')
    }
  }

  async function handleDeploy() {
    setStep('deploying')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/dashboard/regenerate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, agentModeOverride: selectedMode }),
      })
      const data = await res.json()
      if (res.status === 429) {
        setCooldownSeconds(data.cooldown_seconds ?? null)
        setErrorMsg(data.error ?? 'Too many requests. Please wait before applying.')
        setStep('error')
        return
      }
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error ?? 'Apply failed')
        setStep('error')
        return
      }
      if (!data.synced) {
        setStep('saved_not_synced')
        return
      }
      setStep('done')
    } catch {
      setErrorMsg('Network error. Please try again.')
      setStep('error')
    }
  }

  function reset() {
    setStep('idle')
    setPreviewData(null)
    setShowFullPrompts(false)
    setErrorMsg(null)
    setCooldownSeconds(null)
  }

  const isBusy = step === 'previewing' || step === 'deploying'
  const modeChanged = selectedMode !== initialMode

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5">
      <div className="mb-1">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Agent Personality</p>
      </div>
      <p className="text-[11px] t3 mb-2">
        Choose what your agent focuses on. Switching modes rebuilds your agent&apos;s full script — a backup is saved automatically.
      </p>
      {currentCallHandlingMode && (
        <p className="text-[10px] t3 mb-4">
          Active call mode: <span className="font-medium t1">{CALL_HANDLING_DISPLAY[currentCallHandlingMode] ?? currentCallHandlingMode}</span> — switching also updates it to match.
        </p>
      )}

      {/* Mode selector */}
      <div className="space-y-2 mb-4">
        {AGENT_MODE_VALUES.map(m => {
          const isActive = m === initialMode
          const isSelected = m === selectedMode
          return (
            <button
              key={m}
              onClick={() => selectMode(m)}
              disabled={isBusy || previewMode}
              className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
                isSelected
                  ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/[0.06]'
                  : 'border-[var(--color-border)] bg-[var(--color-bg-hover)] hover:border-zinc-500/40'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-semibold t1">{AGENT_MODE_LABELS[m]}</span>
                {isActive && (
                  <span className="ml-auto text-[10px] font-medium text-[var(--color-primary)]">Current</span>
                )}
              </div>
              <p className="text-[11px] t3">{MODE_TAGLINES[m]}</p>
            </button>
          )
        })}
      </div>

      {/* Done state */}
      {step === 'done' && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-2 text-xs text-green-400">
          ✓ Agent mode updated to <strong>{AGENT_MODE_LABELS[selectedMode]}</strong>
          {previewData && (
            <span className="opacity-80"> — call mode synced to <strong>{CALL_HANDLING_DISPLAY[previewData.effectiveCallHandlingMode] ?? previewData.effectiveCallHandlingMode}</strong></span>
          )}
          . Reload to see updated config.
          <button onClick={reset} className="ml-3 underline opacity-70 hover:opacity-100">Reset</button>
        </div>
      )}

      {/* Saved but not synced to live agent */}
      {step === 'saved_not_synced' && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-[11px] text-amber-300">
          Mode saved, but the live agent could not be updated. Your next call may still use the old mode.
          <button onClick={reset} className="ml-3 underline opacity-70 hover:opacity-100">Retry</button>
        </div>
      )}

      {/* Error state */}
      {step === 'error' && errorMsg === 'no_intake' && (
        <div className="rounded-lg bg-zinc-800/60 border b-theme px-3 py-2 text-[11px] t3">
          Mode switching requires your original onboarding answers on file. Contact support if you need help switching modes.
        </div>
      )}
      {step === 'error' && errorMsg !== 'no_intake' && errorMsg && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400">
          {errorMsg}
          {cooldownSeconds && (
            <span className="t3 ml-1">(retry in {cooldownSeconds}s)</span>
          )}
          <button onClick={reset} className="ml-3 underline opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {/* Preview + confirm flow — only when mode has changed and not in done/error state */}
      {step !== 'done' && step !== 'error' && modeChanged && (
        <div className="space-y-3">
          {/* Preview button */}
          {step !== 'preview_ready' && (
            <button
              type="button"
              onClick={handlePreview}
              disabled={isBusy || previewMode}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30 transition-all disabled:opacity-40"
            >
              {step === 'previewing' ? 'Generating preview…' : 'Preview Changes'}
            </button>
          )}

          {/* Preview result */}
          {(step === 'preview_ready' || step === 'deploying') && previewData && (() => {
            const delta = previewData.charCountRebuilt - previewData.charCountCurrent
            return (
              <div className="space-y-2">
                {/* Change summary */}
                <div className="rounded-lg bg-black/30 border b-theme p-3">
                  <p className="text-[10px] font-semibold tracking-[0.12em] uppercase t3 mb-2">What&apos;s Changing</p>
                  <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[11px]">
                    <span className="t3">Mode</span>
                    <span className="font-mono">
                      <span className="text-red-400/80">{AGENT_MODE_LABELS[previewData.currentAgentMode as AgentMode] ?? previewData.currentAgentMode ?? 'lead_capture'}</span>
                      <span className="t3 mx-1">→</span>
                      <span className="text-green-400">{AGENT_MODE_LABELS[selectedMode]}</span>
                    </span>
                    <span className="t3">Call handling</span>
                    <span className="font-mono">
                      <span className="text-red-400/80">{currentCallHandlingMode ?? 'triage'}</span>
                      <span className="t3 mx-1">→</span>
                      <span className="text-green-400">{previewData.effectiveCallHandlingMode}</span>
                    </span>
                    <span className="t3">Script size</span>
                    <span className="font-mono t1">
                      {previewData.charCountCurrent.toLocaleString()} → {previewData.charCountRebuilt.toLocaleString()} chars
                      {' '}
                      <span className={delta > 0 ? 'text-amber-400' : delta < 0 ? 'text-green-400' : 't3'}>
                        ({delta > 0 ? '+' : ''}{delta.toLocaleString()})
                      </span>
                    </span>
                  </div>
                  {previewData.changedSections.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/5">
                      <p className="text-[10px] t3 mb-1.5">Sections modified</p>
                      <div className="flex flex-wrap gap-1">
                        {previewData.changedSections.map(s => (
                          <span key={s} className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-mono border border-[var(--color-primary)]/20">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {previewData.changedSections.length === 0 && (
                    <p className="text-[10px] t3 mt-2">No section-level differences detected.</p>
                  )}
                </div>

                {/* Toggle full prompts */}
                <button
                  type="button"
                  onClick={() => setShowFullPrompts(p => !p)}
                  className="text-[11px] t3 underline underline-offset-2 hover:opacity-100 opacity-60 transition-opacity"
                >
                  {showFullPrompts ? 'Hide full script' : 'Show full script'}
                </button>

                {showFullPrompts && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] t3 mb-1">Current ({previewData.charCountCurrent.toLocaleString()} chars)</p>
                      <div className="bg-black/30 border b-theme rounded-lg p-2 h-56 overflow-y-auto">
                        <pre className="text-[10px] t2 whitespace-pre-wrap font-mono">{previewData.currentPrompt.slice(0, 1200)}{previewData.currentPrompt.length > 1200 ? '\n…' : ''}</pre>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] t3 mb-1">Rebuilt ({previewData.charCountRebuilt.toLocaleString()} chars)</p>
                      <div className="bg-black/30 border border-[var(--color-primary)]/20 rounded-lg p-2 h-56 overflow-y-auto">
                        <pre className="text-[10px] t2 whitespace-pre-wrap font-mono">{previewData.rebuiltPrompt.slice(0, 1200)}{previewData.rebuiltPrompt.length > 1200 ? '\n…' : ''}</pre>
                      </div>
                    </div>
                  </div>
                )}

                {/* Warning */}
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-[11px] text-amber-300">
                  <strong>Heads up:</strong> This rebuilds your agent&apos;s full script from scratch.
                  Any manual tweaks made after your last rebuild will be replaced.
                  A backup is saved to your prompt history — you can roll back from Settings.
                </div>

                {/* Action row */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDeploy}
                    disabled={step === 'deploying' || previewMode}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-primary)]/20 hover:bg-[var(--color-primary)]/30 text-[var(--color-primary)] border border-[var(--color-primary)]/40 transition-all disabled:opacity-40"
                  >
                    {step === 'deploying' ? 'Applying…' : 'Apply New Mode'}
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    disabled={step === 'deploying'}
                    className="px-3 py-1.5 rounded-lg text-xs t3 border b-theme hover:bg-hover transition-all disabled:opacity-40"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
