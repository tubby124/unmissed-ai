'use client'

import { useState } from 'react'
import Link from 'next/link'
import { trackEvent } from '@/lib/analytics'

export default function TeachAgentCard({ clientId, agentName }: { clientId: string; agentName: string }) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!text.trim() || saving) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_facts: text.trim() }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Failed to save')
      }
      setSaved(true)
      trackEvent('teach_agent_saved', { client_id: clientId, char_count: text.trim().length })
      setTimeout(() => setSaved(false), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl p-4 card-surface space-y-3">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.15em] uppercase t3 mb-1">
          Teach {agentName} more
        </p>
        <p className="text-xs t3 leading-relaxed">
          Paste anything — services, pricing, team bios, policies, FAQs. {agentName} will learn it and use it on calls.
        </p>
        <p className="text-[10px] t3 leading-relaxed mt-1">
          This text goes directly to your agent&apos;s knowledge — no AI review.{' '}
          <Link href="/dashboard/knowledge?tab=add&source=text" className="underline underline-offset-2 hover:opacity-75">
            Use AI Compiler →
          </Link>{' '}
          for structured extraction and approval.
        </p>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`e.g. "We offer free estimates on all jobs. Our lead technician is Mike, he's been with us 12 years. We serve the entire metro area but charge a $25 trip fee outside city limits. We're closed on statutory holidays."`}
        rows={4}
        maxLength={5000}
        className="w-full rounded-xl px-3 py-2.5 text-sm t1 bg-[var(--color-bg-hover)] border transition-all placeholder:t3 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25 resize-none"
        style={{ borderColor: 'var(--color-border)' }}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !text.trim()}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {saving ? 'Saving...' : 'Save to agent'}
        </button>
        {saved && (
          <span className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>
            Saved — {agentName} will use this on the next call
          </span>
        )}
        {text.trim() && (
          <span className="text-[11px] t3 ml-auto">{text.length}/5,000</span>
        )}
      </div>
    </div>
  )
}
