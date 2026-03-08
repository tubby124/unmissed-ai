'use client'

import { useState } from 'react'
import type { ClientConfig } from './page'

const NICHE_CONFIG: Record<string, { label: string; color: string; border: string }> = {
  'auto-glass':          { label: 'Auto Glass',       color: 'text-blue-400',   border: 'border-blue-500/30' },
  'auto':                { label: 'Automotive',        color: 'text-blue-400',   border: 'border-blue-500/30' },
  'real-estate':         { label: 'Real Estate',       color: 'text-amber-400',  border: 'border-amber-500/30' },
  'isa':                 { label: 'ISA / Real Estate',  color: 'text-amber-400',  border: 'border-amber-500/30' },
  'property-management': { label: 'Property Mgmt',     color: 'text-purple-400', border: 'border-purple-500/30' },
  'dental':              { label: 'Dental',             color: 'text-teal-400',   border: 'border-teal-500/30' },
  'hvac':                { label: 'HVAC',               color: 'text-orange-400', border: 'border-orange-500/30' },
  'plumbing':            { label: 'Plumbing',           color: 'text-cyan-400',   border: 'border-cyan-500/30' },
  'legal':               { label: 'Legal',              color: 'text-rose-400',   border: 'border-rose-500/30' },
  'voicemail':           { label: 'Voicemail',          color: 'text-zinc-400',   border: 'border-zinc-500/30' },
}

const KNOWN_VOICES: Record<string, string> = {
  'aa601962-1cbd-4bbd-9d96-3c7a93c3414a': 'Jacqueline',
  'd766b9e3-69df-4727-b62f-cd0b6772c2ad': 'Nour',
  '3bde8dc5-67c8-4e3f-82e1-b4f8e5c5db1c': 'Mark',
  'b9de4a89-7971-4ac8-aeea-d86fd8543a1a': 'Emily',
}

function fmtPhone(p: string | null) {
  if (!p) return '—'
  const d = p.replace(/\D/g, '')
  if (d.length === 11 && d[0] === '1') {
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  }
  return p
}

function timeAgo(iso: string | null) {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  const hrs = Math.floor(diff / 3600000)
  if (days > 30) return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
  if (days > 0) return `${days}d ago`
  if (hrs > 0) return `${hrs}h ago`
  return 'Just now'
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }}
      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-zinc-500 border border-white/[0.07] hover:text-zinc-200 hover:border-white/[0.15] transition-all shrink-0"
    >
      {copied ? (
        <>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Copied
        </>
      ) : (
        <>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.5"/></svg>
          {label ?? 'Copy'}
        </>
      )}
    </button>
  )
}

function UrlRow({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
      <span className="text-xs text-zinc-500 w-24 shrink-0">{label}</span>
      <span className="flex-1 text-xs font-mono text-zinc-400 truncate">{url}</span>
      <CopyButton value={url} />
    </div>
  )
}

function ConfigRow({ label, value, copyValue }: { label: string; value: string; copyValue?: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
      <span className="text-xs text-zinc-500 w-32 shrink-0">{label}</span>
      <span className="flex-1 text-xs font-mono text-zinc-300 truncate">{value}</span>
      {copyValue && <CopyButton value={copyValue} />}
    </div>
  )
}

interface SettingsViewProps {
  clients: ClientConfig[]
  isAdmin: boolean
  appUrl: string
}

export default function SettingsView({ clients, isAdmin, appUrl }: SettingsViewProps) {
  const [selectedId, setSelectedId] = useState(clients[0]?.id ?? '')
  const [prompt, setPrompt] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.system_prompt ?? '']))
  )
  const [status, setStatus] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.map(c => [c.id, c.status ?? 'active']))
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const client = clients.find(c => c.id === selectedId) ?? clients[0]
  if (!client) return null

  const niche = client.niche ?? ''
  const nicheConfig = NICHE_CONFIG[niche] ?? { label: niche || 'General', color: 'text-zinc-400', border: 'border-zinc-500/30' }
  const voiceName = client.agent_voice_id ? (KNOWN_VOICES[client.agent_voice_id] ?? null) : null
  const minutesUsed = client.minutes_used_this_month ?? 0
  const minuteLimit = client.monthly_minute_limit ?? 500
  const usagePct = Math.min((minutesUsed / minuteLimit) * 100, 100)

  const currentPrompt = prompt[client.id] ?? ''
  const originalPrompt = client.system_prompt ?? ''
  const dirty = currentPrompt !== originalPrompt
  const charCount = currentPrompt.length

  const inboundUrl = `${appUrl}/api/webhook/${client.slug}/inbound`
  const completedUrl = `${appUrl}/api/webhook/${client.slug}/completed`

  async function save() {
    setSaving(true)
    setSaved(false)
    const body: Record<string, unknown> = { system_prompt: currentPrompt }
    if (isAdmin) body.client_id = client.id
    const res = await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  async function toggleStatus() {
    const next = status[client.id] === 'active' ? 'paused' : 'active'
    const body: Record<string, unknown> = { status: next }
    if (isAdmin) body.client_id = client.id
    const res = await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) setStatus(prev => ({ ...prev, [client.id]: next }))
  }

  const isActive = status[client.id] === 'active'

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">

      {/* Admin — client switcher */}
      {isAdmin && clients.length > 1 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06]">
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500">
              All Clients — {clients.length} agents
            </p>
          </div>
          <div className="flex flex-wrap gap-1 p-3">
            {clients.map(c => {
              const n = c.niche ?? ''
              const nc = NICHE_CONFIG[n] ?? { label: n || 'General', color: 'text-zinc-400', border: 'border-zinc-500/30' }
              const isSelected = c.id === selectedId
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedId(c.id)
                    if (!prompt[c.id]) setPrompt(prev => ({ ...prev, [c.id]: c.system_prompt ?? '' }))
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                    isSelected
                      ? `bg-blue-500/10 text-blue-300 border-blue-500/30`
                      : 'text-zinc-400 border-white/[0.07] hover:text-zinc-200 hover:bg-white/[0.04]'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${(c.status ?? 'active') === 'active' ? 'bg-green-500' : 'bg-zinc-600'}`} />
                  {c.business_name}
                  {n && (
                    <span className={`text-[9px] font-semibold uppercase tracking-wider ${isSelected ? 'text-blue-400/70' : nc.color + '/60'}`}>
                      {nc.label}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 1 — Agent Overview */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-4">Agent Overview</p>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-zinc-100">{client.business_name}</h2>
              {niche && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${nicheConfig.color} ${nicheConfig.border} bg-transparent`}>
                  {nicheConfig.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Slug</span>
                <span className="text-xs font-mono text-zinc-400 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.07]">
                  {client.slug}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Last updated</span>
                <span className="text-xs text-zinc-500 font-mono">{timeAgo(client.updated_at)}</span>
              </div>
            </div>
          </div>

          {/* Status toggle */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <button
              onClick={toggleStatus}
              className={`relative w-11 h-6 rounded-full transition-colors ${isActive ? 'bg-blue-500' : 'bg-zinc-700'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${isActive ? 'left-5' : 'left-0.5'}`} />
            </button>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`} />
              <span className={`text-[11px] font-medium ${isActive ? 'text-green-400' : 'text-zinc-500'}`}>
                {isActive ? 'Answering calls' : 'Paused'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2 — Webhooks + Phone */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-1">Webhooks & Phone</p>
        <p className="text-[11px] text-zinc-600 mb-4">Configure these in your Twilio console for this number</p>
        <UrlRow label="Inbound" url={inboundUrl} />
        <UrlRow label="Completed" url={completedUrl} />
        <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
          <span className="text-xs text-zinc-500 w-24 shrink-0">Twilio Number</span>
          <span className="flex-1 text-sm font-mono font-medium text-zinc-200">
            {fmtPhone(client.twilio_number)}
          </span>
          {client.twilio_number && <CopyButton value={client.twilio_number} />}
        </div>
      </div>

      {/* 3 — Agent Configuration */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-1">Agent Configuration</p>
        <p className="text-[11px] text-zinc-600 mb-4">Voice and AI model settings</p>
        {client.agent_voice_id ? (
          <ConfigRow
            label="Voice"
            value={voiceName ? `${voiceName}  ·  ${client.agent_voice_id}` : client.agent_voice_id}
            copyValue={client.agent_voice_id}
          />
        ) : (
          <ConfigRow label="Voice" value="Not configured" />
        )}
        <ConfigRow label="AI Model" value="Ultravox v0.7 (fixie-ai)" />
        <ConfigRow label="Client ID" value={client.id} copyValue={client.id} />
        {client.telegram_chat_id && (
          <ConfigRow label="Telegram Chat" value={client.telegram_chat_id} copyValue={client.telegram_chat_id} />
        )}
      </div>

      {/* 4 — Usage */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500">Minutes This Month</p>
          <span className="text-xs font-mono text-zinc-400 tabular-nums">
            {minutesUsed} / {minuteLimit} min
          </span>
        </div>
        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              usagePct > 90 ? 'bg-red-500' : usagePct > 70 ? 'bg-amber-500' : 'bg-blue-500'
            }`}
            style={{ width: `${usagePct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-[11px] text-zinc-600">Resets 1st of each month</p>
          <p className="text-[11px] text-zinc-600 tabular-nums font-mono">
            {minuteLimit - minutesUsed} min remaining
          </p>
        </div>
      </div>

      {/* 5 — System Prompt */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500">System Prompt</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">
              {nicheConfig.label} agent instructions
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs tabular-nums font-mono ${charCount > 48000 ? 'text-red-400' : charCount > 40000 ? 'text-amber-400' : 'text-zinc-600'}`}>
              {charCount.toLocaleString()} chars
            </span>
            <button
              onClick={save}
              disabled={!dirty || saving}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                saved
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : dirty
                  ? 'bg-blue-500 hover:bg-blue-400 text-white'
                  : 'bg-white/[0.04] text-zinc-600 cursor-not-allowed border border-white/[0.06]'
              }`}
            >
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
            </button>
          </div>
        </div>

        {dirty && (
          <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/[0.07] border border-amber-500/20">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-amber-400 shrink-0">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-[11px] text-amber-400/90">Unsaved changes — deploy to update the live agent</span>
          </div>
        )}

        <textarea
          value={currentPrompt}
          onChange={e => setPrompt(prev => ({ ...prev, [client.id]: e.target.value }))}
          className="w-full h-[480px] bg-black/20 border border-white/[0.06] rounded-xl p-4 text-sm text-zinc-200 font-mono resize-none focus:outline-none focus:border-blue-500/40 transition-colors leading-relaxed"
          spellCheck={false}
          placeholder={`Enter your ${nicheConfig.label} agent's system prompt…`}
        />
      </div>
    </div>
  )
}
