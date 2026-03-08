'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'

export default function SettingsPage() {
  const [prompt, setPrompt] = useState('')
  const [original, setOriginal] = useState('')
  const [status, setStatus] = useState<'active' | 'paused'>('active')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [clientName, setClientName] = useState('')
  const [minutesUsed, setMinutesUsed] = useState(0)
  const [minuteLimit, setMinuteLimit] = useState(500)
  const supabase = createBrowserClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: cu } = await supabase
        .from('client_users')
        .select('client_id, clients(system_prompt, status, business_name, minutes_used_this_month, monthly_minute_limit)')
        .eq('user_id', user.id)
        .single()

      if (cu?.clients) {
        const c = cu.clients as {
          system_prompt?: string
          status?: string
          business_name?: string
          minutes_used_this_month?: number
          monthly_minute_limit?: number
        }
        const p = c.system_prompt || ''
        setPrompt(p)
        setOriginal(p)
        setStatus((c.status === 'paused' ? 'paused' : 'active') as 'active' | 'paused')
        setClientName(c.business_name || '')
        setMinutesUsed(c.minutes_used_this_month ?? 0)
        setMinuteLimit(c.monthly_minute_limit ?? 500)
      }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save() {
    setSaving(true)
    setSaved(false)
    const res = await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system_prompt: prompt }),
    })
    if (res.ok) {
      setOriginal(prompt)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  async function toggleStatus() {
    const next = status === 'active' ? 'paused' : 'active'
    const res = await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    if (res.ok) setStatus(next)
  }

  const dirty = prompt !== original
  const charCount = prompt.length

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-white font-semibold text-lg">Settings</h1>
        {clientName && <p className="text-zinc-500 text-sm mt-0.5">{clientName}</p>}
      </div>

      {/* Agent status toggle */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500 mb-4">Agent Status</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`} />
            <div>
              <p className="text-sm text-zinc-200 font-medium">
                {status === 'active' ? 'Agent is answering calls' : 'Agent is paused'}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {status === 'active' ? 'All incoming calls will be answered' : 'Calls will go to voicemail'}
              </p>
            </div>
          </div>
          <button
            onClick={toggleStatus}
            className={`relative w-11 h-6 rounded-full transition-colors ${status === 'active' ? 'bg-blue-500' : 'bg-zinc-700'}`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${status === 'active' ? 'left-5' : 'left-0.5'}`}
            />
          </button>
        </div>
      </div>

      {/* Minute usage meter */}
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
              minutesUsed / minuteLimit > 0.9 ? 'bg-red-500' :
              minutesUsed / minuteLimit > 0.7 ? 'bg-amber-500' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min((minutesUsed / minuteLimit) * 100, 100)}%` }}
          />
        </div>
        <p className="text-xs text-zinc-600 mt-2">Resets on the 1st of each month</p>
      </div>

      {/* System prompt editor */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500">System Prompt</p>
          <div className="flex items-center gap-3">
            <span className={`text-xs tabular-nums font-mono ${charCount > 48000 ? 'text-red-400' : 'text-zinc-600'}`}>
              {charCount.toLocaleString()} chars
            </span>
            <button
              onClick={save}
              disabled={!dirty || saving}
              className="px-4 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
            >
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="h-96 animate-pulse bg-white/[0.04] rounded-xl" />
        ) : (
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            className="w-full h-96 bg-black/20 border border-white/[0.06] rounded-xl p-4 text-sm text-zinc-200 font-mono resize-none focus:outline-none focus:border-blue-500/40 transition-colors leading-relaxed"
            spellCheck={false}
            placeholder="Enter your agent's system prompt…"
          />
        )}
      </div>
    </div>
  )
}
