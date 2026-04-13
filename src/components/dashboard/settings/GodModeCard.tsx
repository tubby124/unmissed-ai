'use client'

import { useState, useCallback } from 'react'
import type { GodConfigEntry } from './constants'
import { TIMEZONES } from './constants'
import { usePatchSettings } from './usePatchSettings'
import { AGENT_MODE_VALUES, AGENT_MODE_LABELS, type AgentMode } from '@/lib/agent-mode-rebuild'

interface NicheOverride {
  industry: string
  triage_deep: string
  classification_rule: string
}

interface GodModeCardProps {
  clientId: string
  initialConfig: GodConfigEntry
  previewMode?: boolean
  currentAgentMode?: string | null
  currentCallHandlingMode?: string | null
  niche?: string
  customNicheConfig?: Record<string, unknown> | null
}

type DeepModeStep = 'idle' | 'previewing' | 'preview_ready' | 'deploying' | 'done' | 'error'

export default function GodModeCard({ clientId, initialConfig, previewMode, currentAgentMode, currentCallHandlingMode, niche, customNicheConfig }: GodModeCardProps) {
  const [config, setConfig] = useState<GodConfigEntry>(initialConfig)
  const { saving, saved, patch } = usePatchSettings(clientId, true)
  const [telegramTest, setTelegramTest] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')

  // Niche override state
  const detectedIndustry = (customNicheConfig?.industry as string | undefined) || niche || 'other'
  const [showNicheOverride, setShowNicheOverride] = useState(false)
  const [nicheOverride, setNicheOverride] = useState<NicheOverride>({
    industry: (customNicheConfig?.industry as string) || '',
    triage_deep: (customNicheConfig?.triage_deep as string) || '',
    classification_rule: (customNicheConfig?.classification_rule as string) || '',
  })
  const [nicheSaving, setNicheSaving] = useState(false)
  const [nicheRebuildState, setNicheRebuildState] = useState<'idle' | 'rebuilding' | 'done' | 'fail'>('idle')

  // ── Deep Mode Activation state ─────────────────────────────────────────────
  const [deepModeStep, setDeepModeStep] = useState<DeepModeStep>('idle')
  const [selectedMode, setSelectedMode] = useState<AgentMode>(
    (AGENT_MODE_VALUES.includes(currentAgentMode as AgentMode) ? currentAgentMode as AgentMode : 'lead_capture')
  )
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
  const [deepModeError, setDeepModeError] = useState<string | null>(null)

  async function handleDeepModePreview() {
    setDeepModeStep('previewing')
    setDeepModeError(null)
    setPreviewData(null)
    try {
      const res = await fetch('/api/dashboard/regenerate-prompt/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, agentModeOverride: selectedMode }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setDeepModeError(data.error ?? 'Preview failed')
        setDeepModeStep('error')
        return
      }
      setPreviewData(data)
      setDeepModeStep('preview_ready')
    } catch {
      setDeepModeError('Network error during preview')
      setDeepModeStep('error')
    }
  }

  async function handleDeepModeDeploy() {
    setDeepModeStep('deploying')
    setDeepModeError(null)
    try {
      const res = await fetch('/api/dashboard/regenerate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, agentModeOverride: selectedMode }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setDeepModeError(data.error ?? 'Deploy failed')
        setDeepModeStep('error')
        return
      }
      setDeepModeStep('done')
    } catch {
      setDeepModeError('Network error during deploy')
      setDeepModeStep('error')
    }
  }

  function resetDeepMode() {
    setDeepModeStep('idle')
    setPreviewData(null)
    setDeepModeError(null)
    setShowFullPrompts(false)
  }

  const update = useCallback((field: keyof GodConfigEntry, value: string | number) => {
    setConfig(prev => ({ ...prev, [field]: value }))
  }, [])

  async function saveConfig() {
    const body: Record<string, unknown> = {}
    if (config.telegram_bot_token) body.telegram_bot_token = config.telegram_bot_token
    if (config.telegram_chat_id) body.telegram_chat_id = config.telegram_chat_id
    if (config.timezone) body.timezone = config.timezone
    if (config.twilio_number) body.twilio_number = config.twilio_number
    if (config.monthly_minute_limit) body.monthly_minute_limit = config.monthly_minute_limit
    const res = await patch(body)
    if (res?.ok) {
      setConfig(prev => ({ ...prev, telegram_bot_token: '' }))
    }
  }

  async function handleTestTelegram() {
    setTelegramTest('testing')
    const res = await fetch('/api/dashboard/settings/test-telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId }),
    })
    const data = await res.json().catch(() => ({ ok: false }))
    setTelegramTest(data.ok ? 'ok' : 'fail')
    setTimeout(() => setTelegramTest('idle'), 3000)
  }

  async function saveNicheOverride() {
    setNicheSaving(true)
    const merged = {
      ...(customNicheConfig as Record<string, unknown> || {}),
      industry: nicheOverride.industry.trim(),
      triage_deep: nicheOverride.triage_deep.trim(),
      classification_rule: nicheOverride.classification_rule.trim(),
    }
    await patch({ custom_niche_config: merged })
    setNicheSaving(false)
  }

  async function rebuildPrompt() {
    setNicheRebuildState('rebuilding')
    try {
      const res = await fetch('/api/dashboard/regenerate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })
      setNicheRebuildState(res.ok ? 'done' : 'fail')
    } catch {
      setNicheRebuildState('fail')
    }
    setTimeout(() => setNicheRebuildState('idle'), 4000)
  }

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-amber-500">Advanced Config</p>
          <p className="text-[11px] t3 mt-0.5">Editable infrastructure settings</p>
        </div>
        <button
          onClick={saveConfig}
          disabled={saving || previewMode}
          className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            saved
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30'
          }`}
        >
          {saving ? 'Saving\u2026' : saved ? '\u2713 Saved' : 'Save Config'}
        </button>
      </div>

      <div className="space-y-3">
        {/* Telegram Bot Token */}
        <div>
          <label className="text-[11px] t3 block mb-1">Telegram Bot Token <span className="t3">(write-only &mdash; current value masked)</span></label>
          <input
            type="password"
            value={config.telegram_bot_token}
            onChange={e => update('telegram_bot_token', e.target.value)}
            placeholder="Enter new token to update\u2026"
            autoComplete="off"
            className="w-full bg-black/30 border b-theme rounded-lg px-3 py-2 text-xs t1 font-mono focus:outline-none focus:border-amber-500/40 transition-colors"
          />
        </div>

        {/* Telegram Chat ID */}
        <div>
          <label className="text-[11px] t3 block mb-1">Telegram Chat ID</label>
          <input
            type="text"
            value={config.telegram_chat_id}
            onChange={e => update('telegram_chat_id', e.target.value)}
            placeholder="e.g. 7278536150"
            className="w-full bg-black/30 border b-theme rounded-lg px-3 py-2 text-xs t1 font-mono focus:outline-none focus:border-amber-500/40 transition-colors"
          />
          <button
            type="button"
            onClick={handleTestTelegram}
            disabled={telegramTest !== 'idle'}
            className={`mt-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 ${
              telegramTest === 'ok'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : telegramTest === 'fail'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-hover t2 border b-theme hover:bg-hover'
            }`}
          >
            {telegramTest === 'testing' ? 'Sending\u2026'
              : telegramTest === 'ok' ? '\u2713 Delivered'
              : telegramTest === 'fail' ? '\u2717 Failed'
              : 'Send Test Message'}
          </button>
        </div>

        {/* Twilio Number */}
        <div>
          <label className="text-[11px] t3 block mb-1">Twilio Number</label>
          <input
            type="text"
            value={config.twilio_number}
            onChange={e => update('twilio_number', e.target.value)}
            placeholder="+15871234567"
            className="w-full bg-black/30 border b-theme rounded-lg px-3 py-2 text-xs t1 font-mono focus:outline-none focus:border-amber-500/40 transition-colors"
          />
        </div>

        {/* Timezone + Monthly Limit */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] t3 block mb-1">Timezone</label>
            <select
              value={config.timezone}
              onChange={e => update('timezone', e.target.value)}
              className="w-full bg-black/30 border b-theme rounded-lg px-3 py-2 text-xs t1 focus:outline-none focus:border-amber-500/40 transition-colors"
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] t3 block mb-1">Monthly Minute Limit</label>
            <input
              type="number"
              value={config.monthly_minute_limit}
              onChange={e => update('monthly_minute_limit', Number(e.target.value))}
              min={0}
              step={50}
              className="w-full bg-black/30 border b-theme rounded-lg px-3 py-2 text-xs t1 font-mono focus:outline-none focus:border-amber-500/40 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* ── Deep Mode Activation ── */}
      <div className="mt-5 pt-4 border-t border-amber-500/20">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-amber-500 mb-1">
          Deep Mode Activation
        </p>
        <p className="text-[11px] t3 mb-3">
          Rebuild prompt with full Phase 2b behavior for the selected agent mode.
          Current: <span className="font-mono text-amber-400">{currentAgentMode ?? 'lead_capture'}</span>
          {currentCallHandlingMode && (
            <> / <span className="font-mono text-amber-400">{currentCallHandlingMode}</span></>
          )}
        </p>

        {deepModeStep === 'done' ? (
          <div className="rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-2 text-xs text-green-400">
            ✓ Deep mode activated. Prompt rebuilt, agent synced. Reload to see updated config.
            <button onClick={resetDeepMode} className="ml-3 underline opacity-70 hover:opacity-100">Reset</button>
          </div>
        ) : deepModeStep === 'error' ? (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400">
            ✗ {deepModeError}
            <button onClick={resetDeepMode} className="ml-3 underline opacity-70 hover:opacity-100">Retry</button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Mode picker */}
            <div>
              <label className="text-[11px] t3 block mb-1">New Agent Mode</label>
              <select
                value={selectedMode}
                onChange={e => { setSelectedMode(e.target.value as AgentMode); resetDeepMode() }}
                disabled={deepModeStep === 'previewing' || deepModeStep === 'deploying'}
                className="w-full bg-black/30 border b-theme rounded-lg px-3 py-2 text-xs t1 focus:outline-none focus:border-amber-500/40 transition-colors disabled:opacity-50"
              >
                {AGENT_MODE_VALUES.map(m => (
                  <option key={m} value={m}>{AGENT_MODE_LABELS[m]}</option>
                ))}
              </select>
            </div>

            {/* Preview button */}
            {deepModeStep !== 'preview_ready' && (
              <button
                type="button"
                onClick={handleDeepModePreview}
                disabled={deepModeStep === 'previewing' || previewMode}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all disabled:opacity-40"
              >
                {deepModeStep === 'previewing' ? 'Generating preview…' : 'Preview Rebuild'}
              </button>
            )}

            {/* Preview result */}
            {(deepModeStep === 'preview_ready' || deepModeStep === 'deploying') && previewData && (() => {
              const delta = previewData.charCountRebuilt - previewData.charCountCurrent
              return (
                <div className="space-y-2">
                  {/* Change summary */}
                  <div className="rounded-lg bg-black/30 border b-theme p-3">
                    <p className="text-[10px] font-semibold tracking-[0.12em] uppercase t3 mb-2">What&apos;s Changing</p>
                    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[11px]">
                      <span className="t3">Mode</span>
                      <span className="font-mono">
                        <span className="text-red-400/80">{previewData.currentAgentMode ?? 'lead_capture'}</span>
                        <span className="t3 mx-1">→</span>
                        <span className="text-green-400">{selectedMode}</span>
                      </span>
                      <span className="t3">Call handling</span>
                      <span className="font-mono">
                        <span className="text-red-400/80">{currentCallHandlingMode ?? 'triage'}</span>
                        <span className="t3 mx-1">→</span>
                        <span className="text-green-400">{previewData.effectiveCallHandlingMode}</span>
                      </span>
                      <span className="t3">Prompt size</span>
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
                            <span key={s} className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-300 font-mono border border-amber-500/20">
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
                    {showFullPrompts ? 'Hide full prompts' : 'Show full prompts'}
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
                        <div className="bg-black/30 border border-amber-500/20 rounded-lg p-2 h-56 overflow-y-auto">
                          <pre className="text-[10px] t2 whitespace-pre-wrap font-mono">{previewData.rebuiltPrompt.slice(0, 1200)}{previewData.rebuiltPrompt.length > 1200 ? '\n…' : ''}</pre>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Warning */}
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-[11px] text-amber-300">
                    <strong>Warning:</strong> This will overwrite the current system prompt with a full rebuild.
                    Manual edits made after the last regen will be lost.
                    A backup is saved to prompt history for rollback.
                  </div>

                  {/* Action row */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDeepModeDeploy}
                      disabled={deepModeStep === 'deploying' || previewMode}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 transition-all disabled:opacity-40"
                    >
                      {deepModeStep === 'deploying' ? 'Deploying…' : 'Confirm & Deploy'}
                    </button>
                    <button
                      type="button"
                      onClick={resetDeepMode}
                      className="px-3 py-1.5 rounded-lg text-xs t3 border b-theme hover:bg-hover transition-all"
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

      {/* ── Niche Correction ── */}
      <div className="mt-5 pt-4 border-t border-amber-500/20">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-[11px] t3">Detected niche: </span>
            <span className="text-[11px] font-mono text-amber-400">{detectedIndustry}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowNicheOverride(v => !v)}
            className="text-[10px] px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
          >
            {showNicheOverride ? 'Hide Override' : 'Override Niche Config'}
          </button>
        </div>

        {showNicheOverride && (
          <div className="space-y-2 mt-2">
            <div>
              <label className="text-[11px] t3 block mb-1">Industry label</label>
              <input
                type="text"
                value={nicheOverride.industry}
                onChange={e => setNicheOverride(v => ({ ...v, industry: e.target.value }))}
                placeholder="e.g. daycare, tattoo studio, dog groomer"
                className="w-full bg-black/30 border b-theme rounded-lg px-3 py-2 text-xs t1 font-mono focus:outline-none focus:border-amber-500/40 transition-colors"
              />
            </div>
            <div>
              <label className="text-[11px] t3 block mb-1">Triage rules (HOT/WARM/COLD/JUNK)</label>
              <textarea
                value={nicheOverride.triage_deep}
                onChange={e => setNicheOverride(v => ({ ...v, triage_deep: e.target.value }))}
                rows={3}
                placeholder="HOT = urgent immediate need. WARM = wants callback. COLD = info only. JUNK = spam."
                className="w-full bg-black/30 border b-theme rounded-lg px-3 py-2 text-xs t1 font-mono focus:outline-none focus:border-amber-500/40 transition-colors resize-none"
              />
            </div>
            <div>
              <label className="text-[11px] t3 block mb-1">Classification rule (one sentence)</label>
              <input
                type="text"
                value={nicheOverride.classification_rule}
                onChange={e => setNicheOverride(v => ({ ...v, classification_rule: e.target.value }))}
                placeholder="HOT = ..., WARM = ..., COLD = ..., JUNK = ..."
                className="w-full bg-black/30 border b-theme rounded-lg px-3 py-2 text-xs t1 font-mono focus:outline-none focus:border-amber-500/40 transition-colors"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={saveNicheOverride}
                disabled={nicheSaving || previewMode}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 disabled:opacity-40 transition-all"
              >
                {nicheSaving ? 'Saving\u2026' : 'Save Override'}
              </button>
              <button
                type="button"
                onClick={rebuildPrompt}
                disabled={nicheRebuildState !== 'idle' || previewMode}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-40 ${
                  nicheRebuildState === 'done'
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : nicheRebuildState === 'fail'
                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                    : 'bg-hover t2 b-theme hover:bg-hover'
                }`}
              >
                {nicheRebuildState === 'rebuilding' ? 'Rebuilding\u2026'
                  : nicheRebuildState === 'done' ? '\u2713 Rebuilt'
                  : nicheRebuildState === 'fail' ? '\u2717 Failed'
                  : 'Rebuild Prompt'}
              </button>
            </div>
            <p className="text-[10px] t3">Save Override first, then Rebuild Prompt to apply changes to the live agent.</p>
          </div>
        )}
      </div>
    </div>
  )
}
