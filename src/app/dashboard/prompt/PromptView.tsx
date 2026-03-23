'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'

type Client = { id: string; slug: string; business_name: string }

export default function PromptView() {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedSlug, setSelectedSlug] = useState('')
  const [agentId, setAgentId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [original, setOriginal] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const supabase = createBrowserClient()

  // Load clients on mount
  useEffect(() => {
    fetch('/api/dashboard/clients').then(r => r.json()).then(d => {
      const list: Client[] = d.clients || []
      setClients(list)
      if (list.length > 0) setSelectedSlug(list[0].slug)
    })
  }, [])

  // Load prompt + agentId when slug changes
  useEffect(() => {
    if (!selectedSlug) return
    setLoading(true)
    setSaved(false)
    setSaveError(null)
    supabase
      .from('clients')
      .select('system_prompt, ultravox_agent_id')
      .eq('slug', selectedSlug)
      .single()
      .then(({ data }) => {
        const p = data?.system_prompt || ''
        setPrompt(p)
        setOriginal(p)
        setAgentId(data?.ultravox_agent_id || '')
        setLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlug])

  async function save() {
    if (!selectedSlug || !agentId) return
    setSaving(true)
    setSaved(false)
    setSaveError(null)
    try {
      const res = await fetch('/api/admin/save-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientSlug: selectedSlug, agentId, prompt }),
      })
      const json = await res.json()
      if (!res.ok) {
        setSaveError(json.error || 'Save failed')
      } else {
        setOriginal(prompt)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {
      setSaveError('Network error')
    } finally {
      setSaving(false)
    }
  }

  const dirty = prompt !== original
  const charCount = prompt.length
  const selectedClient = clients.find(c => c.slug === selectedSlug)

  return (
    <div className="px-6 py-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-sm font-semibold text-gray-300">System Prompt</h1>
          {selectedClient && (
            <p className="text-xs text-gray-600 mt-0.5">{selectedClient.slug}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {clients.length > 1 && (
            <select
              value={selectedSlug}
              onChange={e => setSelectedSlug(e.target.value)}
              className="bg-gray-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {clients.map(c => (
                <option key={c.id} value={c.slug}>{c.business_name}</option>
              ))}
            </select>
          )}
          <span className={`text-xs tabular-nums ${charCount > 48000 ? 'text-red-400' : 'text-gray-600'}`}>
            {charCount.toLocaleString()} chars
          </span>
          <button
            onClick={save}
            disabled={!dirty || saving || !agentId}
            className="text-xs px-4 py-1.5 rounded bg-white text-gray-900 font-semibold hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>

      {saveError && <p className="text-xs text-red-400 mb-2">{saveError}</p>}
      {saved && <p className="text-xs text-emerald-400 mb-2">Saved to Supabase + Ultravox agent updated.</p>}

      {loading ? (
        <div className="h-[70vh] flex items-center justify-center text-gray-600 text-sm">Loading...</div>
      ) : (
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          className="w-full h-[70vh] bg-gray-900 border border-white/10 rounded-lg p-4 text-sm text-gray-200 font-mono resize-none focus:outline-none focus:border-white/30"
          spellCheck={false}
        />
      )}
    </div>
  )
}
