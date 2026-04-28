'use client'

/**
 * InlineModalsV2 — modal content registry for /dashboard/v2.
 *
 * One <ModalRouter> consumed by UnifiedHomeSectionV2. Switches on the
 * useInlineEdit `openModalId` and renders the matching form. Save handlers
 * live inside each modal so the InlineEditModal primitive stays presentational.
 *
 * Modal IDs map 1:1 to chips on AgentIdentityCardCompact + readiness rows on
 * UnifiedHomeSectionV2 + the call list. Field reference: dashboard-mockup.html
 * `modalContent` block at lines 1425-1620.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import InlineEditModal, { Field, ModalActions } from './InlineEditModal'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'
import type { HomeData } from '@/components/dashboard/ClientHomeV2'
import type { InlineEditState, ModalId } from '@/hooks/useInlineEdit'

// ── Shared types ──────────────────────────────────────────────────────────────

type CommonProps = {
  clientId: string
  isAdmin: boolean
  data: HomeData
  edit: InlineEditState
  fetchData: () => void
  openUpgrade: () => void
  planSupportsBooking: boolean
}

type RowSnapshot = {
  id: string
  ultravox_call_id: string | null
  caller_phone: string | null
  call_status: string
  duration_seconds: number | null
  started_at: string
  ai_summary: string | null
  sentiment: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPhone(phone: string | null): string {
  if (!phone) return 'Unknown'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  return phone
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function syncedHint(data: HomeData): string {
  const at = data.agentSync?.last_agent_sync_at
  if (!at) return 'Changes auto-sync to your live agent.'
  const m = Math.floor((Date.now() - new Date(at).getTime()) / 60000)
  if (m < 1) return 'Changes auto-sync · Last synced just now'
  if (m < 60) return `Changes auto-sync · Last synced ${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `Changes auto-sync · Last synced ${h}h ago`
  return `Changes auto-sync · Last synced ${Math.floor(h / 24)}d ago`
}

// ── Variable PATCH (greeting / agent name / business / callback) ─────────────

async function patchVariable(opts: {
  clientId: string
  isAdmin: boolean
  variableKey: string
  value: string
}): Promise<{ ok: boolean; error?: string }> {
  const payload: Record<string, unknown> = { variableKey: opts.variableKey, value: opts.value }
  if (opts.isAdmin) payload.client_id = opts.clientId
  try {
    const res = await fetch('/api/dashboard/variables', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { ok: false, error: data.error || `Save failed (${res.status})` }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Network error' }
  }
}

// ── Greeting modal ────────────────────────────────────────────────────────────

function GreetingModal(p: CommonProps) {
  const [initial, setInitial] = useState<string | null>(null)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/dashboard/variables', { signal: AbortSignal.timeout(10000) })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (cancelled) return
        const greeting = (json?.variables?.GREETING_LINE?.value as string | undefined) ?? ''
        setInitial(greeting)
        setValue(greeting)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const dirty = initial !== null && value.trim() !== initial.trim() && value.trim().length > 0

  async function save() {
    if (!dirty || saving) return
    setSaving(true)
    const res = await patchVariable({
      clientId: p.clientId,
      isAdmin: p.isAdmin,
      variableKey: 'GREETING_LINE',
      value: value.trim(),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      toast.success('Greeting saved')
      p.edit.markClean()
      p.fetchData()
      setTimeout(() => p.edit.forceClose(), 700)
    } else {
      toast.error(res.error ?? 'Save failed')
    }
  }

  return (
    <>
      <Field label="Greeting" hint="First sentence the agent says when the call connects.">
        {loading ? (
          <p className="text-[12px] t3 py-2">Loading current greeting…</p>
        ) : (
          <textarea
            value={value}
            onChange={e => { setValue(e.target.value); p.edit.markDirty() }}
            rows={3}
            className="w-full rounded-lg px-3 py-2.5 text-[13px] t1 outline-none resize-y leading-relaxed"
            style={{
              backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              minHeight: 70,
            }}
          />
        )}
      </Field>
      <ModalActions
        onCancel={p.edit.closeModal}
        onSave={save}
        saving={saving}
        saved={saved}
        dirty={dirty}
        syncedHint={syncedHint(p.data)}
      />
    </>
  )
}

// ── After-call SMS modal ─────────────────────────────────────────────────────

function AfterCallModal(p: CommonProps) {
  const initialEnabled = p.data.editableFields.smsEnabled
  const initialTemplate = p.data.editableFields.smsTemplate ?? ''
  const [enabled, setEnabled] = useState(initialEnabled)
  const [template, setTemplate] = useState(initialTemplate)
  const { saving, saved, patch } = usePatchSettings(p.clientId, p.isAdmin, { onSave: p.fetchData })
  const dirty = enabled !== initialEnabled || template !== initialTemplate
  const noTwilio = !p.data.activation.twilio_number_present

  async function save() {
    if (!dirty || saving) return
    const res = await patch({ sms_enabled: enabled, sms_template: template })
    if (res?.ok) { p.edit.markClean(); setTimeout(() => p.edit.forceClose(), 700) }
  }

  return (
    <>
      {noTwilio && (
        <div
          className="rounded-lg p-3 text-[11px] mb-3"
          style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: 'rgb(217,119,6)' }}
        >
          SMS follow-up requires a phone number. Upgrade to enable.
        </div>
      )}
      <label className="flex items-center gap-2 text-[12px] t1 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          disabled={noTwilio}
          onChange={e => { setEnabled(e.target.checked); p.edit.markDirty() }}
        />
        Send after-call SMS
      </label>
      <div className="mt-4">
        <Field label="Template (caller name + business auto-injected)" hint="Sent to the caller within ~60s of hangup.">
          <textarea
            value={template}
            onChange={e => { setTemplate(e.target.value); p.edit.markDirty() }}
            rows={3}
            className="w-full rounded-lg px-3 py-2.5 text-[13px] t1 outline-none resize-y leading-relaxed"
            style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', minHeight: 70 }}
          />
        </Field>
      </div>
      <ModalActions
        onCancel={p.edit.closeModal}
        onSave={save}
        saving={saving}
        saved={saved}
        dirty={dirty}
        syncedHint={syncedHint(p.data)}
      />
    </>
  )
}

// ── Telegram modal ───────────────────────────────────────────────────────────

function TelegramModal(p: CommonProps) {
  const connected = p.data.onboarding.telegramConnected
  const initialUrl = p.data.onboarding.telegramBotUrl
  const [url, setUrl] = useState<string | null>(initialUrl ?? null)
  const [loading, setLoading] = useState(false)

  async function generate() {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/telegram-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: p.clientId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.alreadyConnected) {
        toast.success('Telegram already connected')
        p.fetchData()
      } else if (res.ok && data.deepLink) {
        setUrl(data.deepLink)
        window.open(data.deepLink, '_blank', 'noopener')
      } else {
        toast.error(data.error || 'Could not generate link')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <p className="text-[12px] t2 leading-relaxed">
        {connected
          ? 'Telegram is connected. Open the bot to test or change which chat receives alerts.'
          : 'Click below to open Telegram and link your account. The bot will then send HOT lead alerts, missed call notifications, and daily digests.'}
      </p>
      <div className="mt-4 text-center">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener"
            className="inline-block px-5 py-3 rounded-lg text-[13px] font-semibold text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Open Telegram → @unmissedaibot
          </a>
        ) : (
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="inline-block px-5 py-3 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {loading ? 'Generating link…' : 'Open Telegram → @unmissedaibot'}
          </button>
        )}
      </div>
      <ModalActions onCancel={p.edit.closeModal} dirty={false} syncedHint={syncedHint(p.data)} />
    </>
  )
}

// ── IVR modal ────────────────────────────────────────────────────────────────

function IvrModal(p: CommonProps) {
  const initialEnabled = p.data.editableFields.ivrEnabled
  const initialPrompt = p.data.editableFields.ivrPrompt ?? ''
  const [enabled, setEnabled] = useState(initialEnabled)
  const [prompt, setPrompt] = useState(initialPrompt)
  const { saving, saved, patch } = usePatchSettings(p.clientId, p.isAdmin, { onSave: p.fetchData })
  const dirty = enabled !== initialEnabled || prompt !== initialPrompt

  async function save() {
    const res = await patch({ ivr_enabled: enabled, ivr_prompt: prompt })
    if (res?.ok) { p.edit.markClean(); setTimeout(() => p.edit.forceClose(), 700) }
  }

  return (
    <>
      <label className="flex items-center gap-2 text-[12px] t1 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => { setEnabled(e.target.checked); p.edit.markDirty() }}
        />
        Enable IVR pre-filter
      </label>
      <div className="mt-4">
        <Field label="IVR prompt" hint="Played before connecting to the agent. Phone calls only — WebRTC has no DTMF.">
          <textarea
            value={prompt}
            onChange={e => { setPrompt(e.target.value); p.edit.markDirty() }}
            rows={3}
            placeholder="Press 1 to leave a message, or hold to speak with our agent."
            className="w-full rounded-lg px-3 py-2.5 text-[13px] t1 outline-none resize-y leading-relaxed"
            style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', minHeight: 70 }}
          />
        </Field>
      </div>
      <ModalActions
        onCancel={p.edit.closeModal}
        onSave={save}
        saving={saving}
        saved={saved}
        dirty={dirty}
        syncedHint={syncedHint(p.data)}
      />
    </>
  )
}

// ── Voicemail modal ──────────────────────────────────────────────────────────

function VoicemailModal(p: CommonProps) {
  const initial = p.data.editableFields.voicemailGreetingText ?? ''
  const [greeting, setGreeting] = useState(initial)
  const { saving, saved, patch } = usePatchSettings(p.clientId, p.isAdmin, { onSave: p.fetchData })
  const dirty = greeting !== initial

  async function save() {
    const res = await patch({ voicemail_greeting_text: greeting })
    if (res?.ok) { p.edit.markClean(); setTimeout(() => p.edit.forceClose(), 700) }
  }

  return (
    <>
      <Field label="Greeting text" hint="Played when the caller chooses to leave a message or when the agent is unreachable.">
        <textarea
          value={greeting}
          onChange={e => { setGreeting(e.target.value); p.edit.markDirty() }}
          rows={4}
          placeholder="You've reached our team. Please leave your name and number — we'll call you back within 24 hours."
          className="w-full rounded-lg px-3 py-2.5 text-[13px] t1 outline-none resize-y leading-relaxed"
          style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', minHeight: 90 }}
        />
      </Field>
      <p className="text-[11px] t3 mt-3">
        Audio file upload coming soon — for now, the greeting is text-to-speech using your selected voice.
      </p>
      <ModalActions
        onCancel={p.edit.closeModal}
        onSave={save}
        saving={saving}
        saved={saved}
        dirty={dirty}
        syncedHint={syncedHint(p.data)}
      />
    </>
  )
}

// ── GBP modal ────────────────────────────────────────────────────────────────

function GbpModal(p: CommonProps) {
  const gbp = p.data.gbpData
  const connected = !!gbp?.placeId
  const ef = p.data.editableFields
  // Rows reflect what's currently stored on the client from the Google Places import.
  const rows: { label: string; value: string | null }[] = [
    { label: 'Business name', value: p.data.onboarding.businessName || null },
    { label: 'Hours (weekday)', value: ef.hoursWeekday || null },
    { label: 'Hours (weekend)', value: ef.hoursWeekend || null },
    { label: 'Website', value: ef.websiteUrl || null },
    { label: 'Rating', value: gbp?.rating != null ? `${gbp.rating.toFixed(1)} ★ (${gbp.reviewCount ?? 0} reviews)` : null },
  ]
  return (
    <>
      {connected ? (
        <>
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
            style={{ backgroundColor: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}
          >
            <span style={{ color: 'rgb(52,211,153)' }}>✓</span>
            <span className="text-[12px] t1">
              Imported from Google
            </span>
          </div>

          {/* Wave 2.1 — surface the actual extracted fields, not just "connected" */}
          <div className="mt-3 space-y-1.5">
            {rows.map(r => (
              <div key={r.label} className="grid grid-cols-[110px_1fr] gap-2 text-[11px] leading-relaxed">
                <span className="t3">{r.label}</span>
                <span className="t1 break-words">
                  {r.value ? (
                    r.label === 'Website' && r.value.startsWith('http') ? (
                      <a href={r.value} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--color-primary)' }}>
                        {r.value.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </a>
                    ) : r.value
                  ) : (
                    <span className="t3 italic">not set</span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {gbp?.summary && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-hover">
              <p className="text-[10px] font-semibold tracking-[0.12em] uppercase t3 mb-1">Summary</p>
              <p className="text-[11px] t2 leading-relaxed italic">{gbp.summary}</p>
            </div>
          )}

          <p className="text-[10px] t3 mt-3 leading-snug">
            Auto-imported via Google Places at onboarding. Edit any field by clicking its chip on the overview.
          </p>
        </>
      ) : (
        <>
          <p className="text-[12px] t2 leading-relaxed">
            Connect your Google Business Profile to auto-populate your agent with your business name, phone, hours, and reviews.
          </p>
          <Link
            href="/dashboard/setup#gbp"
            className="block mt-4 text-center px-5 py-3 rounded-lg text-[13px] font-semibold text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Connect Google Business Profile →
          </Link>
        </>
      )}
      <ModalActions onCancel={p.edit.closeModal} dirty={false} syncedHint={syncedHint(p.data)} />
    </>
  )
}

// ── Today's update modal ─────────────────────────────────────────────────────

function TodayModal(p: CommonProps) {
  const initial = p.data.editableFields.injectedNote ?? ''
  const [note, setNote] = useState(initial)
  const [autoClear, setAutoClear] = useState<'today' | 'tomorrow' | 'week' | 'never'>('today')
  const { saving, saved, patch } = usePatchSettings(p.clientId, p.isAdmin, { onSave: p.fetchData })
  const dirty = note.trim() !== initial.trim()

  async function save() {
    const res = await patch({ injected_note: note.trim() || null })
    if (res?.ok) { p.edit.markClean(); setTimeout(() => p.edit.forceClose(), 700) }
  }

  return (
    <>
      <Field label="What should the agent know about today?" hint="Injected as RIGHT NOW: … in every call's context.">
        <textarea
          value={note}
          onChange={e => { setNote(e.target.value); p.edit.markDirty() }}
          rows={3}
          placeholder="e.g. We're closing at 3pm today for a private event."
          className="w-full rounded-lg px-3 py-2.5 text-[13px] t1 outline-none resize-y leading-relaxed"
          style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', minHeight: 70 }}
        />
      </Field>
      <div className="mt-4">
        <Field label="Auto-clear after" hint="Notes auto-clear after 24 hours. Custom expiry coming soon.">
          <select
            value={autoClear}
            onChange={e => { setAutoClear(e.target.value as typeof autoClear); p.edit.markDirty() }}
            className="w-full rounded-lg px-3 py-2.5 text-[13px] t1 outline-none"
            style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
          >
            <option value="today">End of today</option>
            <option value="tomorrow">End of tomorrow</option>
            <option value="week">End of week</option>
            <option value="never">Never (manual clear)</option>
          </select>
        </Field>
      </div>
      <ModalActions
        onCancel={p.edit.closeModal}
        onSave={save}
        saving={saving}
        saved={saved}
        dirty={dirty}
        syncedHint={syncedHint(p.data)}
      />
    </>
  )
}

// ── Hours modal ──────────────────────────────────────────────────────────────

function HoursModal(p: CommonProps) {
  const e = p.data.editableFields
  const [weekday, setWeekday] = useState(e.hoursWeekday ?? '')
  const [weekend, setWeekend] = useState(e.hoursWeekend ?? '')
  const [behavior, setBehavior] = useState(e.afterHoursBehavior ?? 'take_message')
  const [emergencyPhone, setEmergencyPhone] = useState(e.afterHoursPhone ?? '')

  const { saving, saved, patch } = usePatchSettings(p.clientId, p.isAdmin, { onSave: p.fetchData })
  const dirty =
    weekday !== (e.hoursWeekday ?? '') ||
    weekend !== (e.hoursWeekend ?? '') ||
    behavior !== (e.afterHoursBehavior ?? 'take_message') ||
    emergencyPhone !== (e.afterHoursPhone ?? '')

  async function save() {
    const res = await patch({
      business_hours_weekday: weekday,
      business_hours_weekend: weekend,
      after_hours_behavior: behavior,
      after_hours_emergency_phone: emergencyPhone,
    })
    if (res?.ok) { p.edit.markClean(); setTimeout(() => p.edit.forceClose(), 700) }
  }

  return (
    <>
      <Field label="Weekday hours">
        <input
          type="text"
          value={weekday}
          onChange={ev => { setWeekday(ev.target.value); p.edit.markDirty() }}
          placeholder="Monday–Friday 9:00 AM – 5:00 PM"
          className="w-full rounded-lg px-3 py-2.5 text-[13px] t1 outline-none"
          style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
        />
      </Field>
      <div className="mt-3">
        <Field label="Weekend hours">
          <input
            type="text"
            value={weekend}
            onChange={ev => { setWeekend(ev.target.value); p.edit.markDirty() }}
            placeholder="Closed"
            className="w-full rounded-lg px-3 py-2.5 text-[13px] t1 outline-none"
            style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
          />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="After-hours behavior">
          <select
            value={behavior}
            onChange={ev => { setBehavior(ev.target.value); p.edit.markDirty() }}
            className="w-full rounded-lg px-3 py-2.5 text-[13px] t1 outline-none"
            style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
          >
            <option value="take_message">Take a message</option>
            <option value="route_emergency">Route emergencies to phone</option>
          </select>
        </Field>
      </div>
      {behavior === 'route_emergency' && (
        <div className="mt-3">
          <Field label="Emergency phone">
            <input
              type="tel"
              value={emergencyPhone}
              onChange={ev => { setEmergencyPhone(ev.target.value); p.edit.markDirty() }}
              placeholder="+1 (555) 000-0000"
              className="w-full rounded-lg px-3 py-2.5 text-[13px] t1 outline-none"
              style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
            />
          </Field>
        </div>
      )}
      <ModalActions
        onCancel={p.edit.closeModal}
        onSave={save}
        saving={saving}
        saved={saved}
        dirty={dirty}
        syncedHint={syncedHint(p.data)}
      />
    </>
  )
}

// ── Forwarding (transfer) modal ──────────────────────────────────────────────

function ForwardingModal(p: CommonProps) {
  const initialNumber = p.data.editableFields.forwardingNumber ?? ''
  const [number, setNumber] = useState(initialNumber)
  const [enabled, setEnabled] = useState(!!p.data.editableFields.forwardingNumber)
  const { saving, saved, patch } = usePatchSettings(p.clientId, p.isAdmin, { onSave: p.fetchData })
  const dirty = (enabled ? number : '') !== initialNumber || enabled !== !!initialNumber

  async function save() {
    const res = await patch({ forwarding_number: enabled ? number : null })
    if (res?.ok) { p.edit.markClean(); setTimeout(() => p.edit.forceClose(), 700) }
  }

  return (
    <>
      <label className="flex items-center gap-2 text-[12px] t1 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => { setEnabled(e.target.checked); p.edit.markDirty() }}
        />
        Enable live transfer
      </label>
      <p className="text-[11px] t3 mt-1.5">
        Phone calls only — WebRTC has no Twilio Call SID. Requires plan with transfer entitlement.
      </p>
      <div className="mt-4">
        <Field label="Forward to" hint="Use E.164 format: +1XXXXXXXXXX">
          <input
            type="tel"
            value={number}
            disabled={!enabled}
            onChange={e => { setNumber(e.target.value); p.edit.markDirty() }}
            placeholder="+1 (306) 850-7687"
            className="w-full rounded-lg px-3 py-2.5 text-[13px] t1 outline-none disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
          />
        </Field>
      </div>
      <ModalActions
        onCancel={p.edit.closeModal}
        onSave={save}
        saving={saving}
        saved={saved}
        dirty={dirty}
        syncedHint={syncedHint(p.data)}
      />
    </>
  )
}

// ── Calendar / Booking modal ─────────────────────────────────────────────────

function CalendarModal(p: CommonProps) {
  if (!p.planSupportsBooking) {
    return (
      <>
        <p className="text-[12px] t2 leading-relaxed">
          Calendar booking is part of the AI Receptionist plan. Upgrade to let your agent check availability and book appointments directly.
        </p>
        <button
          type="button"
          onClick={() => { p.edit.forceClose(); p.openUpgrade() }}
          className="block w-full mt-4 text-center px-5 py-3 rounded-lg text-[13px] font-semibold text-white"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          See plans →
        </button>
        <ModalActions onCancel={p.edit.closeModal} dirty={false} syncedHint={syncedHint(p.data)} />
      </>
    )
  }
  if (p.data.calendarConnected) {
    return (
      <>
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
          style={{ backgroundColor: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}
        >
          <span style={{ color: 'rgb(52,211,153)' }}>✓</span>
          <span className="text-[12px] t1">Google Calendar connected</span>
        </div>
        <p className="text-[11px] t3 mt-3 leading-relaxed">
          Your agent uses <code>checkCalendarAvailability</code> + <code>bookAppointment</code> tools to schedule callers directly into your calendar.
        </p>
        <Link
          href="/dashboard/calendar"
          className="block mt-4 text-center px-5 py-3 rounded-lg text-[13px] font-semibold"
          style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-1)', border: '1px solid var(--color-border)' }}
        >
          Manage calendar settings →
        </Link>
        <ModalActions onCancel={p.edit.closeModal} dirty={false} syncedHint={syncedHint(p.data)} />
      </>
    )
  }
  const oauthUrl = p.isAdmin
    ? `/api/auth/google?client_id=${p.clientId}`
    : '/api/auth/google'
  return (
    <>
      <p className="text-[12px] t2 leading-relaxed">
        Once connected, callers can book appointments directly via{' '}
        <code>checkCalendarAvailability</code> + <code>bookAppointment</code> tools at call time.
      </p>
      <a
        href={oauthUrl}
        className="block mt-4 text-center px-5 py-3 rounded-lg text-[13px] font-semibold text-white"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        Connect Google Calendar →
      </a>
      <ModalActions onCancel={p.edit.closeModal} dirty={false} syncedHint={syncedHint(p.data)} />
    </>
  )
}

// ── Voice modal ──────────────────────────────────────────────────────────────

interface UltravoxVoice {
  voiceId: string
  name: string
  description: string
  provider: string
  previewUrl?: string
}

function VoiceModal(p: CommonProps) {
  const [voices, setVoices] = useState<UltravoxVoice[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(p.data.onboarding.agentVoiceId)
  const [saving, setSaving] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { patch } = usePatchSettings(p.clientId, p.isAdmin, { onSave: p.fetchData })

  useEffect(() => {
    let cancelled = false
    fetch('/api/dashboard/voices', { signal: AbortSignal.timeout(10000) })
      .then(r => r.ok ? r.json() : null)
      .then(json => { if (!cancelled && json?.voices) setVoices(json.voices) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true; audioRef.current?.pause() }
  }, [])

  const filtered = useMemo(() => {
    if (!filter.trim()) return voices
    const q = filter.toLowerCase()
    return voices.filter(v =>
      v.name.toLowerCase().includes(q) ||
      (v.description || '').toLowerCase().includes(q) ||
      v.provider.toLowerCase().includes(q),
    )
  }, [voices, filter])

  function play(v: UltravoxVoice) {
    if (audioRef.current) { audioRef.current.onended = null; audioRef.current.pause(); audioRef.current.src = '' }
    if (playingId === v.voiceId) { setPlayingId(null); return }
    // Always proxy through /api/dashboard/voices/[id]/preview for cookie auth + ID3 sniff fix
    const url = `/api/dashboard/voices/${v.voiceId}/preview`
    const audio = new Audio(url)
    audio.onended = () => setPlayingId(null)
    audio.onerror = () => setPlayingId(null)
    audioRef.current = audio
    setPlayingId(v.voiceId)
    audio.play().catch(() => setPlayingId(null))
  }

  async function selectVoice(v: UltravoxVoice) {
    if (v.voiceId === selectedId || saving) return
    setSelectedId(v.voiceId)
    setSaving(true)
    p.edit.markDirty()
    const res = await patch({ agent_voice_id: v.voiceId })
    setSaving(false)
    if (res?.ok) { p.edit.markClean() }
  }

  const currentName = voices.find(v => v.voiceId === selectedId)?.name ?? null

  return (
    <>
      <input
        type="text"
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder="Filter by gender, accent, vibe…"
        className="w-full rounded-lg px-3 py-2 text-[12px] t1 outline-none mb-3"
        style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
      />
      <div className="space-y-1.5 max-h-[44vh] overflow-y-auto -mx-1 px-1">
        {loading && <p className="text-[12px] t3 text-center py-6">Loading voices…</p>}
        {!loading && filtered.length === 0 && (
          <p className="text-[12px] t3 text-center py-6">No voices match that filter.</p>
        )}
        {filtered.map(v => {
          const isSelected = v.voiceId === selectedId
          const isPlaying = playingId === v.voiceId
          return (
            <button
              key={v.voiceId}
              type="button"
              onClick={() => selectVoice(v)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
              style={{
                backgroundColor: isSelected ? 'rgba(99,102,241,0.08)' : 'var(--color-hover)',
                border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
              }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-semibold t1">{v.name}</span>
                  {isSelected && (
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: 'var(--color-primary)' }}
                    >
                      SELECTED
                    </span>
                  )}
                </div>
                <p className="text-[11px] t3 truncate">{v.provider} · {v.description}</p>
              </div>
              <span
                onClick={(e) => { e.stopPropagation(); play(v) }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(v) } }}
                className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer"
                style={{
                  backgroundColor: isPlaying ? 'var(--color-primary)' : 'rgba(99,102,241,0.12)',
                  color: isPlaying ? '#fff' : 'var(--color-primary)',
                  border: '1px solid rgba(99,102,241,0.25)',
                }}
              >
                {isPlaying ? '◼ Playing' : '▶ Play'}
              </span>
            </button>
          )
        })}
      </div>
      <p className="text-[11px] t3 mt-3 leading-relaxed">
        Preview audio uses the proxy at <code>/api/dashboard/voices/[id]/preview</code> for cookie auth.
        {currentName && <> Currently selected: <strong className="t1">{currentName}</strong>.</>}
      </p>
      <ModalActions onCancel={p.edit.closeModal} dirty={false} syncedHint={syncedHint(p.data)} />
    </>
  )
}

// ── Callback contact modal ───────────────────────────────────────────────────

function CallbackModal(p: CommonProps) {
  const [variables, setVariables] = useState<Record<string, { value: string }>>({})
  const [loading, setLoading] = useState(true)
  const [closePerson, setClosePerson] = useState('')
  const [callbackPhone, setCallbackPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/dashboard/variables', { signal: AbortSignal.timeout(10000) })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (cancelled) return
        const vars = (json?.variables ?? {}) as Record<string, { value: string }>
        setVariables(vars)
        setClosePerson(vars.CLOSE_PERSON?.value ?? '')
        setCallbackPhone(vars.CALLBACK_PHONE?.value ?? '')
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const initialPerson = variables.CLOSE_PERSON?.value ?? ''
  const initialPhone = variables.CALLBACK_PHONE?.value ?? ''
  // CLOSE_PERSON is rendered inline as "${closePerson} will call ya back" — must be a
  // single word (resolver derives owner_name.split(' ')[0] in prompt-slots.ts:1101).
  // We trim multi-word input to first token before sending to keep DB/prompt aligned.
  const submittedPerson = closePerson.trim().split(/\s+/)[0] ?? ''
  const isMultiWord = closePerson.trim().split(/\s+/).length > 1
  const dirty = submittedPerson !== initialPerson || callbackPhone.trim() !== initialPhone

  async function save() {
    if (!dirty || saving) return
    setSaving(true)
    const writes: Promise<{ ok: boolean; error?: string }>[] = []
    if (submittedPerson !== initialPerson) {
      writes.push(patchVariable({ clientId: p.clientId, isAdmin: p.isAdmin, variableKey: 'CLOSE_PERSON', value: submittedPerson }))
    }
    if (callbackPhone.trim() !== initialPhone && variables.CALLBACK_PHONE) {
      writes.push(patchVariable({ clientId: p.clientId, isAdmin: p.isAdmin, variableKey: 'CALLBACK_PHONE', value: callbackPhone.trim() }))
    }
    const results = await Promise.all(writes)
    setSaving(false)
    const failed = results.find(r => !r.ok)
    if (failed) { toast.error(failed.error ?? 'Save failed'); return }
    setSaved(true)
    p.edit.markClean()
    p.fetchData()
    toast.success('Callback contact saved')
    setTimeout(() => p.edit.forceClose(), 700)
  }

  return (
    <>
      {loading ? (
        <p className="text-[12px] t3 text-center py-4">Loading…</p>
      ) : (
        <>
          <Field label="Person who calls back" hint="First name only — used as &ldquo;Mike will call you back&rdquo; in the agent&rsquo;s closing line. Multi-word entries are trimmed to the first word.">
            <input
              type="text"
              value={closePerson}
              onChange={e => { setClosePerson(e.target.value); p.edit.markDirty() }}
              className="w-full rounded-lg px-3 py-2.5 text-[13px] t1 outline-none"
              style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
            />
            {isMultiWord && (
              <p className="text-[11px] mt-1.5" style={{ color: 'rgb(217,119,6)' }}>
                Will save as &ldquo;{submittedPerson}&rdquo; — only the first word is used.
              </p>
            )}
          </Field>
          {variables.CALLBACK_PHONE && (
            <div className="mt-3">
              <Field label="Callback phone" hint="Number forwarded to the transfer tool.">
                <input
                  type="tel"
                  value={callbackPhone}
                  onChange={e => { setCallbackPhone(e.target.value); p.edit.markDirty() }}
                  className="w-full rounded-lg px-3 py-2.5 text-[13px] t1 outline-none"
                  style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                />
              </Field>
            </div>
          )}
        </>
      )}
      <ModalActions
        onCancel={p.edit.closeModal}
        onSave={save}
        saving={saving}
        saved={saved}
        dirty={dirty}
        syncedHint={syncedHint(p.data)}
      />
    </>
  )
}

// ── Services modal ───────────────────────────────────────────────────────────

function ServicesModal(p: CommonProps) {
  const count = p.data.activeServicesCount ?? 0
  return (
    <>
      {count === 0 ? (
        <div
          className="rounded-lg p-3 text-[12px] mb-3"
          style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: 'rgb(217,119,6)' }}
        >
          ⚠️ No services added yet — agent currently can&apos;t describe what you sell.
        </div>
      ) : (
        <p className="text-[12px] t2">
          {count} active service{count === 1 ? '' : 's'} configured.
        </p>
      )}
      <p className="text-[11px] t3 mt-3 leading-relaxed">
        Services are managed in the dedicated Knowledge surface where you can add, edit, and reorder them.
      </p>
      <Link
        href="/dashboard/knowledge?tab=services"
        className="block mt-4 text-center px-5 py-3 rounded-lg text-[13px] font-semibold text-white"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        {count === 0 ? 'Add your first service →' : 'Manage services →'}
      </Link>
      <ModalActions onCancel={p.edit.closeModal} dirty={false} syncedHint={syncedHint(p.data)} />
    </>
  )
}

// ── FAQs modal ───────────────────────────────────────────────────────────────

function FaqsModal(p: CommonProps) {
  const initial = p.data.editableFields.faqs ?? []
  const [faqs, setFaqs] = useState(initial)
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [newQ, setNewQ] = useState('')
  const [newA, setNewA] = useState('')
  const { saving, saved, patch } = usePatchSettings(p.clientId, p.isAdmin, { onSave: p.fetchData })
  const dirty = JSON.stringify(faqs) !== JSON.stringify(initial)

  async function save() {
    const res = await patch({ extra_qa: faqs })
    if (res?.ok) { p.edit.markClean(); setTimeout(() => p.edit.forceClose(), 700) }
  }

  function updateAnswer(i: number, a: string) {
    const next = faqs.map((f, idx) => idx === i ? { ...f, a } : f)
    setFaqs(next); p.edit.markDirty()
  }
  function remove(i: number) {
    const next = faqs.filter((_, idx) => idx !== i)
    setFaqs(next); p.edit.markDirty()
  }
  function add() {
    if (!newQ.trim() || !newA.trim()) return
    setFaqs([...faqs, { q: newQ.trim(), a: newA.trim() }])
    setNewQ(''); setNewA(''); p.edit.markDirty()
  }

  return (
    <>
      <div className="space-y-1.5">
        {faqs.length === 0 && (
          <p className="text-[12px] t3 italic">No FAQs yet. Add your first below.</p>
        )}
        {faqs.map((faq, i) => {
          const isOpen = openIdx === i
          return (
            <div
              key={i}
              className="rounded-lg overflow-hidden"
              style={{
                backgroundColor: isOpen ? 'rgba(99,102,241,0.04)' : 'var(--color-hover)',
                border: `1px solid ${isOpen ? 'rgba(99,102,241,0.25)' : 'var(--color-border)'}`,
              }}
            >
              <button
                type="button"
                onClick={() => setOpenIdx(isOpen ? null : i)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left cursor-pointer"
              >
                <span className="text-[12px] t1 truncate">{faq.q}</span>
                <span className="text-[11px] t3 shrink-0">{isOpen ? '▴' : '▾'}</span>
              </button>
              {isOpen && (
                <div className="px-3 pb-3 space-y-2">
                  <Field label="Answer the agent gives">
                    <textarea
                      value={faq.a}
                      onChange={e => updateAnswer(i, e.target.value)}
                      rows={3}
                      className="w-full rounded-lg px-3 py-2 text-[12px] t1 outline-none resize-y leading-relaxed"
                      style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', minHeight: 60 }}
                    />
                  </Field>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="text-[11px] font-semibold text-red-400 hover:opacity-75"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-4 space-y-2 rounded-lg p-3" style={{ border: '1px dashed var(--color-border)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] t3">Add new FAQ</p>
        <input
          type="text"
          value={newQ}
          onChange={e => setNewQ(e.target.value)}
          placeholder="Question"
          className="w-full rounded-lg px-3 py-2 text-[12px] t1 outline-none"
          style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
        />
        <input
          type="text"
          value={newA}
          onChange={e => setNewA(e.target.value)}
          placeholder="Answer"
          className="w-full rounded-lg px-3 py-2 text-[12px] t1 outline-none"
          style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        />
        <button
          type="button"
          onClick={add}
          disabled={!newQ.trim() || !newA.trim()}
          className="w-full py-1.5 rounded-lg text-[12px] font-semibold text-white disabled:opacity-40"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          + Add FAQ
        </button>
      </div>
      <ModalActions
        onCancel={p.edit.closeModal}
        onSave={save}
        saving={saving}
        saved={saved}
        dirty={dirty}
        syncedHint={syncedHint(p.data)}
      />
    </>
  )
}

// ── Knowledge modal ──────────────────────────────────────────────────────────

function KnowledgeModal(p: CommonProps) {
  const k = p.data.knowledge
  const counts = k.source_counts ?? {}
  const total = k.approved_chunk_count ?? 0
  const sources = [
    { key: 'all', label: `All (${total})`, n: total },
    { key: 'website_scrape', label: '🔗 Website', n: counts.website_scrape ?? 0 },
    { key: 'pdf', label: '📄 PDF', n: counts.pdf ?? 0 },
    { key: 'manual', label: '⭐ Manual', n: counts.manual ?? 0 },
    { key: 'compiled_import', label: '🤖 AI Compiled', n: counts.compiled_import ?? 0 },
  ]
  const [active, setActive] = useState('all')
  return (
    <>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {sources.filter(s => s.key === 'all' || s.n > 0).map(s => {
          const isActive = active === s.key
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActive(s.key)}
              className="text-[11px] px-2.5 py-1 rounded-full transition-colors cursor-pointer"
              style={{
                backgroundColor: isActive ? 'rgba(99,102,241,0.12)' : 'var(--color-hover)',
                border: `1px solid ${isActive ? 'rgba(99,102,241,0.3)' : 'var(--color-border)'}`,
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-2)',
              }}
            >
              {s.label}{s.key !== 'all' && ` (${s.n})`}
            </button>
          )
        })}
      </div>
      {total === 0 ? (
        <p className="text-[12px] t3 text-center py-4">
          No knowledge chunks yet. Add a website, PDF, or manual fact to teach your agent.
        </p>
      ) : (
        <p className="text-[12px] t2">
          {total} approved chunk{total === 1 ? '' : 's'} · {k.pending_review_count} pending review.
          When a caller asks a question, the agent calls <code>queryKnowledge</code> → hybrid pgvector search → speaks the top match.
        </p>
      )}
      <Link
        href={active === 'all' ? '/dashboard/knowledge' : `/dashboard/knowledge?source=${encodeURIComponent(active)}`}
        className="block mt-4 text-center px-5 py-3 rounded-lg text-[13px] font-semibold text-white"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        {active === 'all'
          ? 'Open Knowledge to browse / edit chunks →'
          : `Open ${active === 'website_scrape' ? 'website' : active === 'compiled_import' ? 'AI compiled' : active} chunks →`}
      </Link>
      <ModalActions onCancel={p.edit.closeModal} dirty={false} syncedHint={syncedHint(p.data)} />
    </>
  )
}

// ── Gaps modal ───────────────────────────────────────────────────────────────

function GapsModal(p: CommonProps) {
  const gaps = p.data.insights?.topGaps ?? []
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [savingIdx, setSavingIdx] = useState<number | null>(null)
  const [savedIdx, setSavedIdx] = useState<number | null>(null)
  const { patch } = usePatchSettings(p.clientId, p.isAdmin, { onSave: p.fetchData })

  async function answerGap(i: number, question: string) {
    const answer = (answers[i] ?? '').trim()
    if (!answer || savingIdx !== null) return
    setSavingIdx(i)
    const nextFaqs = [...(p.data.editableFields.faqs ?? []), { q: question, a: answer }]
    const res = await patch({ extra_qa: nextFaqs })
    setSavingIdx(null)
    if (res?.ok) {
      setSavedIdx(i)
      setAnswers(prev => { const n = { ...prev }; delete n[i]; return n })
      setOpenIdx(null)
      toast.success('Promoted to FAQ — agent will use this answer next time')
      p.fetchData()
    }
  }

  return (
    <>
      {gaps.length === 0 ? (
        <p className="text-[12px] t3 text-center py-4">
          No unanswered questions this week — your knowledge base covers what callers are asking.
        </p>
      ) : (
        <div className="space-y-1.5">
          {gaps.map((g, i) => {
            const isOpen = openIdx === i
            const isSaved = savedIdx === i
            return (
              <div
                key={i}
                className="rounded-lg overflow-hidden"
                style={{
                  backgroundColor: isOpen ? 'rgba(99,102,241,0.04)' : 'var(--color-hover)',
                  border: `1px solid ${isOpen ? 'rgba(99,102,241,0.25)' : 'var(--color-border)'}`,
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left cursor-pointer"
                >
                  <span className="text-[12px] t1 min-w-0 truncate">{g.query_text}</span>
                  <span className="text-[11px] t3 shrink-0">
                    {isSaved ? '✓ answered' : `${g.count} caller${g.count === 1 ? '' : 's'}`}
                  </span>
                </button>
                {isOpen && !isSaved && (
                  <div className="px-3 pb-3 space-y-2">
                    <Field label="Answer the agent will give next time">
                      <textarea
                        value={answers[i] ?? ''}
                        onChange={e => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                        rows={3}
                        placeholder="e.g. Yes, our rent guarantee program covers up to 90 days of missed rent…"
                        className="w-full rounded-lg px-3 py-2 text-[12px] t1 outline-none resize-y leading-relaxed"
                        style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', minHeight: 60 }}
                      />
                    </Field>
                    <button
                      type="button"
                      onClick={() => answerGap(i, g.query_text)}
                      disabled={savingIdx === i || !(answers[i]?.trim())}
                      className="w-full py-1.5 rounded-lg text-[12px] font-semibold text-white disabled:opacity-40"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      {savingIdx === i ? 'Saving…' : 'Promote to FAQ + sync to agent'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <ModalActions onCancel={p.edit.closeModal} dirty={false} syncedHint={syncedHint(p.data)} />
    </>
  )
}

// ── Call detail modal ────────────────────────────────────────────────────────

function CallDetailModal(p: CommonProps) {
  const call = (p.edit.payload as RowSnapshot | null) ?? null
  if (!call) {
    return (
      <>
        <p className="text-[12px] t3 text-center py-4">No call selected.</p>
        <ModalActions onCancel={p.edit.closeModal} dirty={false} />
      </>
    )
  }
  const status = call.call_status
  const statusLabel =
    status === 'live'    ? '🔴 Live now' :
    status === 'HOT'     ? '🔥 Classified HOT' :
    status === 'WARM'    ? '🌤 Classified WARM' :
    status === 'COLD'    ? '❄️ Classified COLD' :
    status === 'JUNK'    ? '🚫 Classified JUNK' :
    status === 'MISSED'  ? '☎️ Missed' :
    status === 'test'    ? '🧪 Test call' :
    status
  const statusColor =
    status === 'HOT' ? 'rgb(239,68,68)' :
    status === 'WARM' ? 'rgb(245,158,11)' :
    status === 'live' ? 'rgb(34,197,94)' :
    'var(--color-text-3)'
  const phoneOrLabel = status === 'test' ? 'Browser test call' : formatPhone(call.caller_phone)
  const dur = formatDuration(call.duration_seconds)

  return (
    <>
      <p className="text-[13px] font-semibold t1">
        {phoneOrLabel} · {timeAgo(call.started_at)} · {dur}
      </p>
      <p className="text-[11px] mt-1" style={{ color: statusColor, fontWeight: 600 }}>{statusLabel}</p>

      {call.ai_summary ? (
        <div
          className="mt-4 px-3 py-3 rounded-lg text-[12px] t2 leading-relaxed"
          style={{ backgroundColor: 'var(--color-hover)' }}
        >
          <strong className="t1">Summary:</strong> {call.ai_summary}
        </div>
      ) : (
        <p className="mt-4 text-[12px] t3 italic">Summary not yet available.</p>
      )}

      {call.ultravox_call_id && (
        <Link
          href={`/dashboard/calls/${call.ultravox_call_id}`}
          className="block mt-4 text-center px-5 py-2.5 rounded-lg text-[13px] font-semibold"
          style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-1)', border: '1px solid var(--color-border)' }}
        >
          View full transcript →
        </Link>
      )}
      <ModalActions onCancel={p.edit.closeModal} dirty={false} syncedHint={syncedHint(p.data)} />
    </>
  )
}

// ── Router ────────────────────────────────────────────────────────────────────

const TITLES: Record<Exclude<ModalId, null>, { title: string; sub?: string }> = {
  greeting:   { title: 'Greeting line',          sub: 'Variable: GREETING_LINE — first sentence agent says when the call connects.' },
  aftercall:  { title: 'After-call SMS',         sub: 'sms_enabled + sms_template — sent within ~60s of hangup. Requires plan SMS entitlement + Twilio number.' },
  telegram:   { title: 'Connect Telegram alerts', sub: 'Get instant notifications when calls finish. One-tap deep link via @unmissedaibot.' },
  ivr:        { title: 'IVR pre-filter',         sub: 'ivr_enabled + ivr_prompt — plays a digit menu before connecting to the agent. Phone calls only.' },
  voicemail:  { title: 'Voicemail greeting',     sub: 'voicemail_greeting_text — played when caller leaves a message or agent is unreachable.' },
  booking:    { title: 'Calendar booking',       sub: 'Connect Google Calendar so the agent can check availability and book directly.' },
  transfer:   { title: 'Live call transfer',     sub: 'forwarding_number + transfer_conditions — agent uses transferCall when caller meets criteria.' },
  website:    { title: 'Website knowledge',      sub: 'Pages scraped from your website, embedded into pgvector for the queryKnowledge tool.' },
  gbp:        { title: 'Google Business Profile', sub: 'Auto-imported via Google Places at onboarding.' },
  today:      { title: "Today's update",          sub: 'injected_note — live agent context (RIGHT NOW: …). Cleared automatically after expiry.' },
  calendar:   { title: 'Connect Google Calendar', sub: 'Required for the booking tool. Agent uses checkCalendarAvailability + bookAppointment.' },
  voice:      { title: 'Choose voice',            sub: 'Click ▶ Play to hear each voice. Selection auto-syncs to your live agent.' },
  callback:   { title: 'Callback contact',        sub: 'Variable: CLOSE_PERSON. Who the agent says will call back; phone is for the transfer tool.' },
  hours:      { title: 'Business hours',          sub: 'business_hours_weekday + weekend — injected as OFFICE HOURS at call time.' },
  services:   { title: 'Services your business offers', sub: 'Active services count surfaced as service catalog. Agent uses these to describe what you sell.' },
  faqs:       { title: 'FAQs',                    sub: 'extra_qa — what your agent says. Click any question to view + edit the answer.' },
  knowledge:  { title: 'Knowledge base',          sub: 'pgvector embedded chunks searched by the queryKnowledge tool.' },
  gaps:       { title: 'Unanswered questions',    sub: 'Caller asked something the agent could not answer. Promote to FAQ to fix the gap.' },
  call:       { title: 'Call detail',             sub: 'Summary + classification. Open the full transcript for the entire conversation.' },
}

interface RouterProps {
  clientId: string | null
  isAdmin: boolean
  data: HomeData
  edit: InlineEditState
  fetchData: () => void
  openUpgrade: () => void
  planSupportsBooking: boolean
}

export default function InlineModalsV2({
  clientId,
  isAdmin,
  data,
  edit,
  fetchData,
  openUpgrade,
  planSupportsBooking,
}: RouterProps) {
  const { openModalId } = edit
  if (!openModalId || !clientId) return null

  const meta = TITLES[openModalId]
  const common: CommonProps = {
    clientId,
    isAdmin,
    data,
    edit,
    fetchData,
    openUpgrade,
    planSupportsBooking,
  }

  let body: React.ReactNode = null
  switch (openModalId) {
    case 'greeting':   body = <GreetingModal {...common} />; break
    case 'aftercall':  body = <AfterCallModal {...common} />; break
    case 'telegram':   body = <TelegramModal {...common} />; break
    case 'ivr':        body = <IvrModal {...common} />; break
    case 'voicemail':  body = <VoicemailModal {...common} />; break
    case 'booking':    body = <CalendarModal {...common} />; break
    case 'transfer':   body = <ForwardingModal {...common} />; break
    case 'website':    body = <KnowledgeModal {...common} />; break
    case 'gbp':        body = <GbpModal {...common} />; break
    case 'today':      body = <TodayModal {...common} />; break
    case 'calendar':   body = <CalendarModal {...common} />; break
    case 'voice':      body = <VoiceModal {...common} />; break
    case 'callback':   body = <CallbackModal {...common} />; break
    case 'hours':      body = <HoursModal {...common} />; break
    case 'services':   body = <ServicesModal {...common} />; break
    case 'faqs':       body = <FaqsModal {...common} />; break
    case 'knowledge':  body = <KnowledgeModal {...common} />; break
    case 'gaps':       body = <GapsModal {...common} />; break
    case 'call':       body = <CallDetailModal {...common} />; break
  }

  return (
    <InlineEditModal
      open
      title={meta.title}
      subtitle={meta.sub}
      onRequestClose={edit.closeModal}
    >
      {body}
    </InlineEditModal>
  )
}
