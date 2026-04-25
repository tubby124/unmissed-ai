'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'

interface Props {
  clientId: string
  isAdmin?: boolean
  agentName: string
  smsEnabled: boolean
  smsTemplate: string | null
  hasTwilioNumber: boolean
  /** Called after a save so parent can refetch HomeData if it cares. */
  onChanged?: () => void
}

/**
 * Track 1 — Overview surface for the three things end-users actually edit:
 *   1. Greeting line (GREETING_LINE prompt variable)
 *   2. After-call SMS toggle + template (sms_enabled / sms_template)
 *
 * Voice selection lives in [VoicePickerDropdown](VoicePickerDropdown.tsx) above this card
 * (kept separate because it has its own preview/play UX).
 *
 * All advanced stuff (IVR, knowledge editing, agent_name, niche routing) lives deeper in
 * /dashboard/settings — not on Overview. Per Omar's guidance 2026-04-25.
 */
export default function AgentSpeaksCard({
  clientId,
  isAdmin = false,
  agentName,
  smsEnabled,
  smsTemplate,
  hasTwilioNumber,
  onChanged,
}: Props) {
  // ─── Greeting state ────────────────────────────────────────────────────────
  const [greeting, setGreeting] = useState<string>('')
  const [greetingLoaded, setGreetingLoaded] = useState(false)
  const [greetingDraft, setGreetingDraft] = useState<string>('')
  const [editingGreeting, setEditingGreeting] = useState(false)
  const [savingGreeting, setSavingGreeting] = useState(false)

  // ─── SMS state ─────────────────────────────────────────────────────────────
  const [smsOn, setSmsOn] = useState<boolean>(smsEnabled)
  const [tpl, setTpl] = useState<string>(smsTemplate ?? '')
  const [tplDraft, setTplDraft] = useState<string>(smsTemplate ?? '')
  const [editingTpl, setEditingTpl] = useState(false)
  const [savingSms, setSavingSms] = useState(false)

  // Sync incoming props if parent refetches
  useEffect(() => { setSmsOn(smsEnabled) }, [smsEnabled])
  useEffect(() => {
    setTpl(smsTemplate ?? '')
    if (!editingTpl) setTplDraft(smsTemplate ?? '')
  }, [smsTemplate, editingTpl])

  // ─── Fetch greeting on mount ───────────────────────────────────────────────
  const fetchGreeting = useCallback(async () => {
    try {
      const url = isAdmin ? `/api/dashboard/variables?client_id=${clientId}` : '/api/dashboard/variables'
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) return
      const data = await res.json()
      const value = data?.variables?.GREETING_LINE?.value ?? ''
      setGreeting(value)
      if (!editingGreeting) setGreetingDraft(value)
      setGreetingLoaded(true)
    } catch {
      setGreetingLoaded(true)
    }
  }, [clientId, isAdmin, editingGreeting])
  useEffect(() => { fetchGreeting() }, [fetchGreeting])

  // ─── Save greeting ─────────────────────────────────────────────────────────
  async function saveGreeting() {
    if (greetingDraft === greeting) { setEditingGreeting(false); return }
    setSavingGreeting(true)
    try {
      const body: Record<string, unknown> = { variableKey: 'GREETING_LINE', value: greetingDraft }
      if (isAdmin) body.client_id = clientId
      const res = await fetch('/api/dashboard/variables', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Could not save greeting')
        return
      }
      setGreeting(greetingDraft)
      setEditingGreeting(false)
      toast.success('Greeting saved')
      onChanged?.()
    } finally {
      setSavingGreeting(false)
    }
  }

  // ─── Save SMS settings ─────────────────────────────────────────────────────
  async function patchSms(payload: { sms_enabled?: boolean; sms_template?: string }) {
    setSavingSms(true)
    try {
      const body: Record<string, unknown> = { ...payload }
      if (isAdmin) body.client_id = clientId
      const res = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Save failed')
        return false
      }
      toast.success('Saved')
      onChanged?.()
      return true
    } finally {
      setSavingSms(false)
    }
  }

  async function toggleSms(next: boolean) {
    setSmsOn(next) // optimistic
    const ok = await patchSms({ sms_enabled: next })
    if (!ok) setSmsOn(!next)
  }

  async function saveTemplate() {
    if (tplDraft === tpl) { setEditingTpl(false); return }
    const ok = await patchSms({ sms_template: tplDraft })
    if (ok) {
      setTpl(tplDraft)
      setEditingTpl(false)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center gap-2.5" style={{ borderColor: 'var(--color-border)' }}>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'rgba(99,102,241,0.1)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold t1">What {agentName || 'your agent'} says</p>
          <p className="text-[10px] t3">Greeting and after-call text. Edit anything inline.</p>
        </div>
      </div>

      {/* ── Greeting row ──────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-[11px] font-semibold t1">Greeting</p>
          {!editingGreeting && greetingLoaded && (
            <button
              onClick={() => { setGreetingDraft(greeting); setEditingGreeting(true) }}
              className="text-[10px] font-medium px-2 py-0.5 rounded-md"
              style={{ color: 'var(--color-primary)' }}
            >
              Edit
            </button>
          )}
        </div>
        {editingGreeting ? (
          <>
            <textarea
              value={greetingDraft}
              onChange={e => setGreetingDraft(e.target.value)}
              rows={Math.min(4, Math.max(2, greetingDraft.split('\n').length + 1))}
              autoFocus
              className="w-full text-[11px] t1 bg-hover px-3 py-2 rounded-lg border b-theme focus:outline-none focus:border-blue-500/50 resize-y leading-relaxed"
            />
            <div className="flex items-center justify-end gap-2 mt-1.5">
              <button
                onClick={() => { setGreetingDraft(greeting); setEditingGreeting(false) }}
                className="text-[10px] t3 hover:t2 px-2 py-1"
              >
                Cancel
              </button>
              <button
                onClick={saveGreeting}
                disabled={savingGreeting || greetingDraft === greeting}
                className="text-[10px] font-semibold px-3 py-1 rounded-md disabled:opacity-40 bg-blue-500 hover:bg-blue-400 text-white"
              >
                {savingGreeting ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        ) : !greetingLoaded ? (
          <p className="text-[11px] t3 italic bg-hover rounded-lg px-3 py-2">Loading…</p>
        ) : greeting ? (
          <p className="text-[11px] t2 bg-hover rounded-lg px-3 py-2 leading-relaxed whitespace-pre-wrap">{greeting}</p>
        ) : (
          <p className="text-[11px] t3 italic bg-hover rounded-lg px-3 py-2">Not set — click Edit to add a greeting</p>
        )}
      </div>

      {/* ── After-call SMS row ────────────────────────────────────────────────── */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div>
            <p className="text-[11px] font-semibold t1">After-call text</p>
            <p className="text-[10px] t3">Auto-send a text after every call so the caller can reach you back.</p>
          </div>
          <button
            onClick={() => toggleSms(!smsOn)}
            disabled={savingSms || !hasTwilioNumber}
            aria-pressed={smsOn}
            aria-label={smsOn ? 'Turn off after-call text' : 'Turn on after-call text'}
            className="shrink-0 relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50"
            style={{
              backgroundColor: smsOn ? 'rgb(34,197,94)' : 'var(--color-hover)',
              border: '1px solid var(--color-border)',
            }}
          >
            <span
              className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
              style={{ transform: smsOn ? 'translateX(18px)' : 'translateX(2px)' }}
            />
          </button>
        </div>

        {!hasTwilioNumber && (
          <p className="text-[10px] mt-1" style={{ color: 'rgb(245,158,11)' }}>
            Requires a phone number — upgrade to enable.
          </p>
        )}

        {smsOn && hasTwilioNumber && (
          <div className="mt-2">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[10px] font-medium t3 uppercase tracking-wider">Message</p>
              {!editingTpl && (
                <button
                  onClick={() => { setTplDraft(tpl); setEditingTpl(true) }}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-md"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Edit
                </button>
              )}
            </div>
            {editingTpl ? (
              <>
                <textarea
                  value={tplDraft}
                  onChange={e => setTplDraft(e.target.value)}
                  rows={Math.min(4, Math.max(2, tplDraft.split('\n').length + 1))}
                  autoFocus
                  className="w-full text-[11px] t1 bg-hover px-3 py-2 rounded-lg border b-theme focus:outline-none focus:border-blue-500/50 resize-y leading-relaxed"
                />
                <div className="flex items-center justify-end gap-2 mt-1.5">
                  <button
                    onClick={() => { setTplDraft(tpl); setEditingTpl(false) }}
                    className="text-[10px] t3 hover:t2 px-2 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveTemplate}
                    disabled={savingSms || tplDraft === tpl}
                    className="text-[10px] font-semibold px-3 py-1 rounded-md disabled:opacity-40 bg-blue-500 hover:bg-blue-400 text-white"
                  >
                    {savingSms ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </>
            ) : tpl ? (
              <p className="text-[11px] t2 bg-hover rounded-lg px-3 py-2 leading-relaxed whitespace-pre-wrap">{tpl}</p>
            ) : (
              <p className="text-[11px] t3 italic bg-hover rounded-lg px-3 py-2">Using default — click Edit to customize</p>
            )}
          </div>
        )}
      </div>

      {/* Footer link */}
      <div className="px-4 py-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <Link
          href="/dashboard/settings?tab=general"
          className="text-[11px] font-medium transition-colors"
          style={{ color: 'var(--color-text-3)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-1)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-3)')}
        >
          Full agent settings →
        </Link>
      </div>
    </div>
  )
}
