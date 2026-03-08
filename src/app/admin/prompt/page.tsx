'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'

const SLUG = 'hasan-sharif'

export default function PromptPage() {
  const [prompt, setPrompt] = useState('')
  const [original, setOriginal] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()

  useEffect(() => {
    supabase
      .from('clients')
      .select('system_prompt')
      .eq('slug', SLUG)
      .single()
      .then(({ data }) => {
        const p = data?.system_prompt || ''
        setPrompt(p)
        setOriginal(p)
        setLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save() {
    setSaving(true)
    setSaved(false)
    await supabase
      .from('clients')
      .update({ system_prompt: prompt, updated_at: new Date().toISOString() })
      .eq('slug', SLUG)
    setOriginal(prompt)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const dirty = prompt !== original
  const charCount = prompt.length

  return (
    <div className="px-6 py-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-sm font-semibold text-gray-300">System Prompt</h1>
          <p className="text-xs text-gray-600 mt-0.5">hasan-sharif · Aisha</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs tabular-nums ${charCount > 48000 ? 'text-red-400' : 'text-gray-600'}`}>
            {charCount.toLocaleString()} chars
          </span>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="text-xs px-4 py-1.5 rounded bg-white text-gray-900 font-semibold hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>

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
