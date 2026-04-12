'use client'

import { useState, useCallback } from 'react'
import type { GodConfigEntry } from './constants'
import { TIMEZONES } from './constants'
import { usePatchSettings } from './usePatchSettings'

interface NicheOverride {
  industry: string
  triage_deep: string
  classification_rule: string
}

interface GodModeCardProps {
  clientId: string
  initialConfig: GodConfigEntry
  niche?: string
  customNicheConfig?: Record<string, unknown> | null
  previewMode?: boolean
}

export default function GodModeCard({ clientId, initialConfig, niche, customNicheConfig, previewMode }: GodModeCardProps) {
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

        {/* Niche Correction */}
        <div className="pt-1 border-t border-amber-500/10">
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
    </div>
  )
}
