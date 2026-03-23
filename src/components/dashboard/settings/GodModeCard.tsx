'use client'

import { useState, useCallback } from 'react'
import type { GodConfigEntry } from './constants'
import { TIMEZONES } from './constants'

interface GodModeCardProps {
  clientId: string
  initialConfig: GodConfigEntry
  previewMode?: boolean
}

export default function GodModeCard({ clientId, initialConfig, previewMode }: GodModeCardProps) {
  const [config, setConfig] = useState<GodConfigEntry>(initialConfig)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [telegramTest, setTelegramTest] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')

  const update = useCallback((field: keyof GodConfigEntry, value: string | number) => {
    setConfig(prev => ({ ...prev, [field]: value }))
  }, [])

  async function saveConfig() {
    setSaving(true)
    setSaved(false)
    const body: Record<string, unknown> = { client_id: clientId }
    if (config.telegram_bot_token) body.telegram_bot_token = config.telegram_bot_token
    if (config.telegram_chat_id) body.telegram_chat_id = config.telegram_chat_id
    if (config.timezone) body.timezone = config.timezone
    if (config.twilio_number) body.twilio_number = config.twilio_number
    if (config.monthly_minute_limit) body.monthly_minute_limit = config.monthly_minute_limit
    const res = await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setSaved(true)
      setConfig(prev => ({ ...prev, telegram_bot_token: '' }))
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
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
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-amber-500">Advanced Config</p>
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
    </div>
  )
}
