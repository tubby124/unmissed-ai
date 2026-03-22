'use client'

import { useState } from 'react'
import { motion } from 'motion/react'

interface SectionEditorCardProps {
  clientId: string
  isAdmin: boolean
  sectionId: string
  label: string
  desc: string
  rows: number
  initialContent: string
  hasMarker: boolean
  previewMode?: boolean
  onPromptChange?: (prompt: string) => void
}

export default function SectionEditorCard({
  clientId,
  isAdmin,
  sectionId,
  label,
  desc,
  rows,
  initialContent,
  hasMarker,
  previewMode,
  onPromptChange,
}: SectionEditorCardProps) {
  const [content, setContent] = useState(initialContent)
  const [collapsed, setCollapsed] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    setSaved(false)
    const body: Record<string, unknown> = { section_id: sectionId, section_content: content }
    if (isAdmin) body.client_id = clientId
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(d.error || 'Save failed')
      }
      if (typeof d.system_prompt === 'string') {
        onPromptChange?.(d.system_prompt)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      <div className="rounded-2xl border b-theme bg-surface p-5">
        <button
          className="flex items-center justify-between w-full text-left"
          onClick={() => setCollapsed(prev => !prev)}
        >
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase t3">{label}</p>
            <p className="text-[11px] t3 mt-0.5">{desc}</p>
          </div>
          <svg
            className={`w-4 h-4 t3 transition-transform ${collapsed ? '' : 'rotate-180'}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {!collapsed && (
          <div className="mt-4 space-y-3">
            {!hasMarker && (
              <p className="text-[10px] t3 italic">This section wasn&apos;t found in your prompt — saving will add it automatically.</p>
            )}
            <textarea
              rows={rows}
              className="w-full rounded-xl border b-theme bg-input px-3 py-2 text-[12px] t1 resize-y font-mono"
              placeholder={`Enter ${label.toLowerCase()} content...`}
              value={content}
              onChange={e => setContent(e.target.value)}
            />
            {error && <p className="text-[11px] text-red-500">{error}</p>}
            <div className="flex items-center gap-3">
              <button
                onClick={save}
                disabled={saving || previewMode}
                className="px-4 py-1.5 rounded-xl text-[11px] font-semibold bg-accent text-white disabled:opacity-50"
              >
                {saving ? 'Saving\u2026' : saved ? '\u2713 Saved' : 'Save'}
              </button>
              <p className="text-[10px] t3">Changes sync to your agent immediately.</p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
