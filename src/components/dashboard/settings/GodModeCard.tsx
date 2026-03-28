'use client'

import { useState, useCallback } from 'react'
import type { GodConfigEntry } from './constants'
import { TIMEZONES } from './constants'
import { usePatchSettings } from './usePatchSettings'
import { AGENT_MODE_VALUES, AGENT_MODE_LABELS, type AgentMode } from '@/lib/agent-mode-rebuild'

interface GodModeCardProps {
  clientId: string
  initialConfig: GodConfigEntry
  previewMode?: boolean
  currentAgentMode?: string | null
  currentCallHandlingMode?: string | null
}

type DeepModeStep = 'idle' | 'previewing' | 'preview_ready' | 'deploying' | 'done' | 'error'

export default function GodModeCard({ clientId, initialConfig, previewMode, currentAgentMode, currentCallHandlingMode }: GodModeCardProps) {
  const [config, setConfig] = useState<GodConfigEntry>(initialConfig)
  const { saving, saved, patch } = usePatchSettings(clientId, true)
  const [telegramTest, setTelegramTest] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')

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
  } | null>(null)
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
            {(deepModeStep === 'preview_ready' || deepModeStep === 'deploying') && previewData && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] t3 mb-1">Current ({previewData.charCountCurrent.toLocaleString()} chars)</p>
                    <div className="bg-black/30 border b-theme rounded-lg p-2 h-56 overflow-y-auto">
                      <pre className="text-[10px] t2 whitespace-pre-wrap font-mono">{previewData.currentPrompt.slice(0, 800)}{previewData.currentPrompt.length > 800 ? '\n…' : ''}</pre>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] t3 mb-1">Rebuilt ({previewData.charCountRebuilt.toLocaleString()} chars) → <span className="font-mono text-amber-400">{previewData.effectiveCallHandlingMode}</span></p>
                    <div className="bg-black/30 border border-amber-500/20 rounded-lg p-2 h-56 overflow-y-auto">
                      <pre className="text-[10px] t2 whitespace-pre-wrap font-mono">{previewData.rebuiltPrompt.slice(0, 800)}{previewData.rebuiltPrompt.length > 800 ? '\n…' : ''}</pre>
                    </div>
                  </div>
                </div>

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
            )}
          </div>
        )}
      </div>
    </div>
  )
}
