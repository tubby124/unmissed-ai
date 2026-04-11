'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import AgentIdentityHeader from '@/components/dashboard/settings/AgentIdentityHeader'
import VoiceStyleCard from '@/components/dashboard/settings/VoiceStyleCard'
import VoicePicker from '@/components/dashboard/settings/VoicePicker'
import CapabilitiesCard from '@/components/dashboard/CapabilitiesCard'
import { buildCapabilityFlags } from '@/lib/capability-flags'
import ActivityLog from '@/components/dashboard/settings/ActivityLog'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'
import AdminDropdown from '@/components/dashboard/AdminDropdown'
import AgentTestCard from '@/components/dashboard/AgentTestCard'
import QuickInject from '@/components/dashboard/settings/QuickInject'
import AgentAnswerabilityCard from '@/components/dashboard/agent/AgentAnswerabilityCard'
import { DEFAULT_MINUTE_LIMIT } from '@/lib/niche-config'
import { VOICE_TONE_PRESETS } from '@/lib/prompt-config/voice-tone-presets'

// ─── Bot animation keyframes (required by AgentIdentityHeader CSS classes) ────

const BOT_KEYFRAMES = `
  @keyframes antennaBlink {
    0%, 90%, 100% { opacity: 1; }
    95% { opacity: 0.2; }
  }
  @keyframes armWave {
    0%, 100% { transform: rotate(-12deg); }
    50% { transform: rotate(12deg); }
  }
  .bot-antenna { animation: antennaBlink 2.4s ease-in-out infinite; }
  .bot-arm-l { animation: armWave 1.8s ease-in-out infinite; transform-origin: 80% 20%; }
  .bot-arm-r { animation: armWave 1.8s ease-in-out infinite reverse; transform-origin: 20% 20%; }
`

// ─── Chevron icon ─────────────────────────────────────────────────────────────

function ChevronRight({ className = '' }: { className?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Agent name inline edit ───────────────────────────────────────────────────

function AgentNameField({
  clientId,
  isAdmin,
  initialName,
}: {
  clientId: string
  isAdmin: boolean
  initialName: string
}) {
  const [name, setName] = useState(initialName)
  const savedName = useRef(initialName)
  const { saving, saved, patch } = usePatchSettings(clientId, isAdmin)

  return (
    <div className="pt-4 border-t b-theme">
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-2">Agent persona name</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="flex-1 min-w-0 bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors"
          placeholder="e.g. Aisha, Max, Riley"
          maxLength={40}
        />
        <button
          onClick={() => { patch({ agent_name: name }); savedName.current = name }}
          disabled={saving || name === savedName.current}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            saved
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20'
          } disabled:opacity-40`}
        >
          {saving ? 'Saving…' : saved ? '✓' : 'Save'}
        </button>
      </div>
      <p className="text-[10px] t3 mt-1.5">The name your agent uses when introducing itself to callers.</p>
    </div>
  )
}

// ─── Business Profile card (P1 — edits for business_name, owner_name, callback_phone, city, website_url) ──

function BusinessProfileCard({ client, isAdmin }: { client: ClientConfig; isAdmin: boolean }) {
  const [fields, setFields] = useState({
    business_name: client.business_name ?? '',
    owner_name: client.owner_name ?? '',
    callback_phone: client.callback_phone ?? '',
    city: client.city ?? '',
    website_url: client.website_url ?? '',
  })
  const saved = useRef({ ...fields })
  const { saving, saved: justSaved, patch } = usePatchSettings(client.id, isAdmin)

  useEffect(() => {
    const next = {
      business_name: client.business_name ?? '',
      owner_name: client.owner_name ?? '',
      callback_phone: client.callback_phone ?? '',
      city: client.city ?? '',
      website_url: client.website_url ?? '',
    }
    setFields(next)
    saved.current = next
  }, [client.id, client.business_name, client.owner_name, client.callback_phone, client.city, client.website_url])

  const hasChanges = Object.keys(fields).some(
    k => fields[k as keyof typeof fields] !== saved.current[k as keyof typeof fields],
  )

  const handleSave = () => {
    const updates: Record<string, string> = {}
    for (const [k, v] of Object.entries(fields)) {
      if (v !== saved.current[k as keyof typeof saved.current]) updates[k] = v
    }
    patch(updates)
    saved.current = { ...fields }
  }

  const rows: { key: keyof typeof fields; label: string; placeholder: string; type?: string }[] = [
    { key: 'business_name', label: 'Business name', placeholder: 'e.g. Acme Plumbing' },
    { key: 'owner_name', label: 'Owner / contact name', placeholder: 'e.g. Sarah Johnson' },
    { key: 'callback_phone', label: 'Callback phone', placeholder: '+1 (306) 555-1234', type: 'tel' },
    { key: 'city', label: 'City / service area', placeholder: 'e.g. Calgary, AB' },
    { key: 'website_url', label: 'Website', placeholder: 'https://example.com', type: 'url' },
  ]

  return (
    <div className="pt-4 border-t b-theme">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">Business Profile</p>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            justSaved
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20'
          } disabled:opacity-40`}
        >
          {saving ? 'Saving…' : justSaved ? '✓' : 'Save Changes'}
        </button>
      </div>
      <div className="space-y-2.5">
        {rows.map(({ key, label, placeholder, type }) => (
          <div key={key}>
            <label className="text-[11px] t3 mb-0.5 block">{label}</label>
            <input
              type={type || 'text'}
              value={fields[key]}
              onChange={e => setFields(prev => ({ ...prev, [key]: e.target.value }))}
              className="w-full bg-black/20 border b-theme rounded-xl px-3 py-1.5 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors"
              placeholder={placeholder}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.18em] font-semibold mb-3" style={{ color: 'var(--color-text-3)' }}>
      {children}
    </p>
  )
}

// ─── Phase E Wave 3 — Day-1 Edit Panel ────────────────────────────────────────
// Customer-facing Day-1 editables land here (per unmissed-onboarding-field-schema).
// Save chain: PATCH /api/dashboard/settings → POST /api/dashboard/regenerate-prompt.
// If regenerate returns 409 + handTuned, we show a confirm dialog before forcing.

const VOICE_PRESETS_LEGACY = [
  { id: 'casual_friendly',    label: 'Casual & Friendly' },
  { id: 'professional_warm',  label: 'Professional & Warm' },
  { id: 'direct_efficient',   label: 'Direct & Efficient' },
  { id: 'empathetic_care',    label: 'Empathetic & Patient' },
] as const

// Phase E.5 Wave 5 — expose the 4 Wave B.6 founding-4 presets alongside legacy.
// Sourced from src/lib/prompt-config/voice-tone-presets.ts (labels live there).
const VOICE_PRESETS_NEW = [
  { id: 'casual_confident',     label: VOICE_TONE_PRESETS.casual_confident.label },
  { id: 'polished_professional', label: VOICE_TONE_PRESETS.polished_professional.label },
  { id: 'alert_relaxed',        label: VOICE_TONE_PRESETS.alert_relaxed.label },
  { id: 'upbeat_confident',     label: VOICE_TONE_PRESETS.upbeat_confident.label },
] as const

const PRICING_POLICY_OPTIONS = [
  { value: 'quote_range',       label: 'Quote a range' },
  { value: 'no_quote_callback', label: 'No quote — call back' },
  { value: 'website_pricing',   label: 'Point to website' },
  { value: 'collect_first',     label: 'Collect details first' },
] as const

const UNKNOWN_ANSWER_OPTIONS = [
  { value: 'take_message',       label: 'Take a message' },
  { value: 'transfer',           label: 'Transfer to me' },
  { value: 'find_out_callback',  label: "Find out & call back" },
] as const

const CALENDAR_MODE_OPTIONS = [
  { value: 'none',              label: 'No calendar' },
  { value: 'request_callback',  label: 'Request callback' },
  { value: 'book_direct',       label: 'Book directly' },
] as const

type ChipOption = { value: string; label: string }

function DarkChipGroup({ options, value, onChange, disabled }: {
  options: readonly ChipOption[]
  value: string | null
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            aria-pressed={selected}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all disabled:opacity-40 ${
              selected
                ? 'border-blue-500/60 bg-blue-500/15 text-blue-300'
                : 'b-theme bg-hover t2 hover:border-[var(--color-text-3)]'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

type HandTunedConfirm = { pending: Record<string, unknown> } | null

function Day1EditPanel({ client, isAdmin }: { client: ClientConfig; isAdmin: boolean }) {
  // Phase E.5 Wave 3 — today_update textarea was removed from this panel to
  // resolve overlap with <QuickInject> (rendered in AgentCards), which already
  // writes to clients.injected_note. buildSlotContext now falls back to
  // injected_note when today_update is empty, so both surfaces keep working
  // without shipping two editors for the same slot.
  const [voicePreset, setVoicePreset] = useState<string>(client.voice_style_preset ?? 'casual_friendly')
  const [pricingPolicy, setPricingPolicy] = useState<string | null>(client.pricing_policy ?? null)
  const [unknownAnswer, setUnknownAnswer] = useState<string | null>(client.unknown_answer_behavior ?? null)
  const [calendarMode, setCalendarMode] = useState<string | null>(client.calendar_mode ?? null)
  const [fieldsToCollectText, setFieldsToCollectText] = useState<string>(
    Array.isArray(client.fields_to_collect) ? client.fields_to_collect.join(', ') : '',
  )
  // Phase E.7 — business_notes editor (closes E.2+E.9 phantom-data gap)
  const [businessNotes, setBusinessNotes] = useState<string>(client.business_notes ?? '')
  const [savedBusinessNotes, setSavedBusinessNotes] = useState<string>(client.business_notes ?? '')
  const [saving, setSaving] = useState<string | null>(null) // holds the field key currently being saved
  const [handTunedConfirm, setHandTunedConfirm] = useState<HandTunedConfirm>(null)

  // Phase I fix (B2): debounced regen — chip clicks batch into ONE regen instead
  // of each firing independently (which 429s all but the first).
  const regenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Cleanup on unmount
  useEffect(() => () => { if (regenTimerRef.current) clearTimeout(regenTimerRef.current) }, [])

  // Reset state when client changes (e.g. admin dropdown switch)
  useEffect(() => {
    setVoicePreset(client.voice_style_preset ?? 'casual_friendly')
    setPricingPolicy(client.pricing_policy ?? null)
    setUnknownAnswer(client.unknown_answer_behavior ?? null)
    setCalendarMode(client.calendar_mode ?? null)
    setFieldsToCollectText(Array.isArray(client.fields_to_collect) ? client.fields_to_collect.join(', ') : '')
    setBusinessNotes(client.business_notes ?? '')
    setSavedBusinessNotes(client.business_notes ?? '')
  }, [client.id, client.voice_style_preset, client.pricing_policy, client.unknown_answer_behavior, client.calendar_mode, client.fields_to_collect, client.business_notes])

  // ── Regen helper (called immediately or via debounce) ───────────────────────
  const fireRegen = useCallback(async (
    opts?: { force?: boolean; patchBody?: Record<string, unknown> },
  ): Promise<{ ok: boolean; handTuned?: boolean }> => {
    const regenRes = await fetch('/api/dashboard/regenerate-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client.id, ...(opts?.force ? { force: true } : {}) }),
    })

    if (regenRes.status === 409) {
      const body = await regenRes.json().catch(() => ({})) as { handTuned?: boolean; error?: string }
      if (body.handTuned && opts?.patchBody) {
        setHandTunedConfirm({ pending: opts.patchBody })
        return { ok: false, handTuned: true }
      }
      toast.error(body.error || 'Regeneration blocked')
      return { ok: false }
    }
    if (regenRes.status === 429) {
      const body = await regenRes.json().catch(() => ({})) as { error?: string; cooldown_seconds?: number }
      toast.warning(body.error || `Slow down — wait ${body.cooldown_seconds ?? 60}s before saving again`)
      return { ok: true }
    }
    if (!regenRes.ok) {
      const body = await regenRes.json().catch(() => ({})) as { error?: string }
      toast.warning(body.error || 'Saved — but agent sync failed')
      return { ok: true }
    }
    toast.success('Saved — agent updated')
    return { ok: true }
  }, [client.id])

  // ── Schedule a debounced regen (2s after last call) ────────────────────────
  // Phase I fix (B2): chip clicks each fire PATCH immediately but batch the
  // regen into one call. Prevents 429 cascade when user clicks 3 chips fast.
  const scheduleRegen = useCallback(() => {
    if (regenTimerRef.current) clearTimeout(regenTimerRef.current)
    regenTimerRef.current = setTimeout(() => {
      regenTimerRef.current = null
      fireRegen()
    }, 2000)
  }, [fireRegen])

  // ── PATCH-only helper (saves to DB, schedules debounced regen) ─────────────
  // For voicemail clients, the PATCH route does a full rebuild (prompt_rebuilt=true),
  // so the separate regen call is skipped to avoid a redundant 429 cooldown hit.
  const patchAndScheduleRegen = useCallback(async (
    fieldKey: string,
    patchBody: Record<string, unknown>,
  ): Promise<{ ok: boolean }> => {
    setSaving(fieldKey)
    try {
      const patchPayload = { ...patchBody, ...(isAdmin ? { client_id: client.id } : {}) }
      const patchRes = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchPayload),
      })
      const patchData = await patchRes.json().catch(() => ({})) as { ok?: boolean; error?: string; prompt_rebuilt?: boolean }
      if (!patchRes.ok) {
        toast.error(patchData.error || `Save failed (${patchRes.status})`)
        return { ok: false }
      }
      if (!patchData.prompt_rebuilt) scheduleRegen()
      return { ok: true }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Network error')
      return { ok: false }
    } finally {
      setSaving(null)
    }
  }, [client.id, isAdmin, scheduleRegen])

  // ── Full save chain (PATCH + immediate regen) — for explicit Save buttons ──
  // For voicemail clients, the PATCH route does a full rebuild (prompt_rebuilt=true),
  // so the separate regen call is skipped.
  const runSaveChain = useCallback(async (
    fieldKey: string,
    patchBody: Record<string, unknown>,
    opts?: { force?: boolean },
  ): Promise<{ ok: boolean; handTuned?: boolean }> => {
    // Cancel any pending debounced regen — this explicit save supersedes it
    if (regenTimerRef.current) { clearTimeout(regenTimerRef.current); regenTimerRef.current = null }
    setSaving(fieldKey)
    try {
      const patchPayload = { ...patchBody, ...(isAdmin ? { client_id: client.id } : {}) }
      const patchRes = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchPayload),
      })
      const patchData = await patchRes.json().catch(() => ({})) as { ok?: boolean; error?: string; prompt_rebuilt?: boolean }
      if (!patchRes.ok) {
        toast.error(patchData.error || `Save failed (${patchRes.status})`)
        return { ok: false }
      }
      if (patchData.prompt_rebuilt) return { ok: true }
      return await fireRegen({ force: opts?.force, patchBody })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Network error')
      return { ok: false }
    } finally {
      setSaving(null)
    }
  }, [client.id, isAdmin, fireRegen])

  // ── Per-field save handlers ────────────────────────────────────────────────
  const handleVoicePresetChange = async (next: string) => {
    setVoicePreset(next)
    await patchAndScheduleRegen('voice_style_preset', { voice_style_preset: next })
  }

  const handleFieldsToCollectSave = async () => {
    const list = fieldsToCollectText
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .slice(0, 20)
    await patchAndScheduleRegen('fields_to_collect', { fields_to_collect: list })
  }

  // Phase E.7 — business_notes save handler. Server-side cap enforcement
  // mirrors the 3000-char limit from Plan E.9 and the BUSINESS_NOTES slot
  // ceiling (3400 chars wrapped) in slot-ceilings.test.ts.
  const handleBusinessNotesSave = async () => {
    const trimmed = businessNotes.trim().slice(0, 3000)
    const result = await runSaveChain('business_notes', { business_notes: trimmed || null })
    if (result.ok) setSavedBusinessNotes(trimmed)
  }

  const handlePricingChange = async (next: string) => {
    setPricingPolicy(next)
    await patchAndScheduleRegen('pricing_policy', { pricing_policy: next })
  }
  const handleUnknownChange = async (next: string) => {
    setUnknownAnswer(next)
    await patchAndScheduleRegen('unknown_answer_behavior', { unknown_answer_behavior: next })
  }
  const handleCalendarChange = async (next: string) => {
    setCalendarMode(next)
    await patchAndScheduleRegen('calendar_mode', { calendar_mode: next })
  }

  // ── Hand-tuned confirm modal handlers ──────────────────────────────────────
  const confirmForceRegen = async () => {
    if (!handTunedConfirm) return
    const pending = handTunedConfirm.pending
    setHandTunedConfirm(null)
    // Re-run the chain with force:true — PATCH already committed, but re-sending
    // the same body is idempotent and avoids a separate regen-only endpoint.
    await runSaveChain('__force__', pending, { force: true })
  }
  const cancelForceRegen = () => {
    setHandTunedConfirm(null)
    toast('Hand-tuned prompt preserved — settings saved to DB but agent not rebuilt')
  }

  const isSaving = saving !== null
  const businessNotesDirty = businessNotes !== savedBusinessNotes

  return (
    <div className="sm:col-span-2">
      <SectionLabel>Day-1 Edits</SectionLabel>
      <div className="rounded-2xl border b-theme bg-surface p-5 space-y-5">
        {/* Phase E.7 Wave 2 — Lego Block Contract Rule #2 surfaced in UI. */}
        <p className="text-[10px] t3 italic">Changes apply to new calls, not calls already in progress.</p>
        {client.hand_tuned && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] px-3 py-2">
            <p className="text-[11px] text-amber-400/90 leading-relaxed">
              This agent has a <span className="font-semibold">hand-tuned prompt</span>. Saving here
              will ask before rebuilding it from your latest settings.
            </p>
          </div>
        )}

        {/* ── 1. Voice tone preset ────────────────────────────────────────── */}
        <div>
          <label className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 block mb-2">
            Voice tone
          </label>
          <select
            value={voicePreset}
            onChange={e => handleVoicePresetChange(e.target.value)}
            disabled={isSaving}
            className="w-full bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors disabled:opacity-40"
          >
            <optgroup label="New (B.6)">
              {VOICE_PRESETS_NEW.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
            <optgroup label="Legacy">
              {VOICE_PRESETS_LEGACY.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
          </select>
          <p className="text-[10px] t3 mt-1.5">Changes the personality and pacing on every call.</p>
        </div>

        {/* ── 3. Fields to collect ────────────────────────────────────────── */}
        <div>
          <label className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 block mb-2">
            Fields to collect on every call
          </label>
          <input
            type="text"
            value={fieldsToCollectText}
            onChange={e => setFieldsToCollectText(e.target.value)}
            onBlur={handleFieldsToCollectSave}
            disabled={isSaving}
            placeholder="name, phone, address, reason for calling"
            className="w-full bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors disabled:opacity-40"
          />
          <p className="text-[10px] t3 mt-1.5">Comma-separated. Max 20. Saves when you tab away.</p>
        </div>

        {/* ── 4. Pricing policy chips (D408) ──────────────────────────────── */}
        <div>
          <label className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 block mb-2">
            When callers ask about price
          </label>
          <DarkChipGroup
            options={PRICING_POLICY_OPTIONS}
            value={pricingPolicy}
            onChange={handlePricingChange}
            disabled={isSaving}
          />
        </div>

        {/* ── 5. Unknown answer behavior chips (D408) ─────────────────────── */}
        <div>
          <label className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 block mb-2">
            When agent doesn&apos;t know the answer
          </label>
          <DarkChipGroup
            options={UNKNOWN_ANSWER_OPTIONS}
            value={unknownAnswer}
            onChange={handleUnknownChange}
            disabled={isSaving}
          />
        </div>

        {/* ── 6. Calendar mode chips (D408) ───────────────────────────────── */}
        <div>
          <label className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 block mb-2">
            Scheduling
          </label>
          <DarkChipGroup
            options={CALENDAR_MODE_OPTIONS}
            value={calendarMode}
            onChange={handleCalendarChange}
            disabled={isSaving}
          />
        </div>

        {/* ── 7. About your business (Phase E.7 — closes business_notes phantom gap) ── */}
        <div>
          <label className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 block mb-2">
            About your business
          </label>
          <div className="relative">
            <textarea
              value={businessNotes}
              onChange={e => setBusinessNotes(e.target.value.slice(0, 3000))}
              rows={5}
              maxLength={3000}
              disabled={isSaving}
              placeholder="Free-form context the agent should know — specialties, unusual hours, recent changes, how you're different from competitors, anything a new caller should hear. Max 3000 chars."
              className="w-full bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 resize-y focus:outline-none focus:border-blue-500/40 transition-colors disabled:opacity-40"
            />
            <span className="absolute bottom-2 right-3 text-[10px] t3 tabular-nums pointer-events-none bg-surface/80 px-1 rounded">
              {businessNotes.length}/3000
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] t3">Injected into the prompt as business context. Wrapped as &lt;business_notes&gt; for safety.</p>
            <button
              onClick={handleBusinessNotesSave}
              disabled={isSaving || !businessNotesDirty}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all disabled:opacity-40 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"
            >
              {saving === 'business_notes' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Hand-tuned confirm modal ──────────────────────────────────────── */}
      {handTunedConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={cancelForceRegen}
        >
          <div
            className="rounded-2xl border b-theme bg-surface max-w-md w-full p-5 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-semibold t1">Overwrite hand-tuned prompt?</p>
            <p className="text-xs t2 leading-relaxed">
              This client has a hand-tuned system prompt. Regenerating will overwrite the custom text
              with a fresh build from your current settings. Continue?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={cancelForceRegen}
                className="text-xs px-3 py-1.5 rounded-lg border b-theme t2 hover:bg-hover transition-colors"
              >
                Keep custom prompt
              </button>
              <button
                onClick={confirmForceRegen}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-500/15 text-red-300 border border-red-500/40 hover:bg-red-500/25 transition-colors font-semibold"
              >
                Overwrite &amp; regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Inner card group — keyed on client.id so state resets on client switch ──

function AgentCards({
  client,
  isAdmin,
  previewMode,
}: {
  client: ClientConfig
  isAdmin: boolean
  previewMode?: boolean
}) {
  const [statusLocal, setStatusLocal] = useState(client.status ?? 'active')
  const { patch } = usePatchSettings(client.id, isAdmin)
  const router = useRouter()

  const isActive = statusLocal === 'active'

  function toggleStatus() {
    if (previewMode) return
    const newStatus = isActive ? 'paused' : 'active'
    setStatusLocal(newStatus)
    patch({ status: newStatus })
  }

  // All capability configure clicks now route to dedicated pages — no inline drawers
  const handleConfigure = useCallback((section: string) => {
    const dest: Record<string, string> = {
      knowledge: '/dashboard/knowledge',
      'advanced-context': '/dashboard/knowledge',
      hours: '/dashboard/actions#hours',
      booking: '/dashboard/actions#scheduling',
      ivr: '/dashboard/actions#call-menu',
      voicemail: '/dashboard/actions#voicemail',
      'agent-config': '/dashboard/actions#call-handoff',
      sms: '/dashboard/actions#after-call',
    }
    router.push(dest[section] ?? '/dashboard/actions')
  }, [router])

  // ── Usage ────────────────────────────────────────────────────────────────────
  const minutesUsed = client.seconds_used_this_month != null
    ? Math.ceil(client.seconds_used_this_month / 60)
    : (client.minutes_used_this_month ?? 0)
  const minuteLimit = (client.monthly_minute_limit ?? DEFAULT_MINUTE_LIMIT) + (client.bonus_minutes ?? 0)
  const usagePct = minuteLimit > 0 ? (minutesUsed / minuteLimit) * 100 : 0

  // ── Trial days remaining ──────────────────────────────────────────────────────
  const daysRemaining = client.trial_expires_at
    ? Math.max(0, Math.ceil((new Date(client.trial_expires_at).getTime() - Date.now()) / 86400000))
    : undefined

  // ── Needs Attention ──────────────────────────────────────────────────────────
  const factLines = Array.isArray(client.business_facts) ? client.business_facts.filter(l => l.trim()).length : ((client.business_facts as string | null)?.split('\n').filter(l => l.trim()).length ?? 0)
  const faqCount = client.extra_qa?.filter(p => p.q?.trim() && p.a?.trim()).length ?? 0

  type AttentionItem = { label: string; href: string; urgency: 'high' | 'medium' | 'low' }
  const attentionItems: AttentionItem[] = []

  if (client.calendar_auth_status === 'expired') {
    attentionItems.push({
      label: 'Google Calendar authorization expired — reconnect to restore appointment booking',
      href: '/dashboard/actions#scheduling',
      urgency: 'high',
    })
  }
  if (usagePct >= 80) {
    attentionItems.push({
      label: `${Math.round(usagePct)}% of monthly minutes used`,
      href: '/dashboard/settings',
      urgency: usagePct >= 95 ? 'high' : 'medium',
    })
  }
  if (factLines === 0 && faqCount === 0 && client.website_scrape_status !== 'approved') {
    attentionItems.push({
      label: 'Agent has no business knowledge — add facts, Q&A, or a website',
      href: '/dashboard/knowledge',
      urgency: 'medium',
    })
  }
  if (client.website_url && client.website_scrape_status === 'extracted') {
    attentionItems.push({
      label: 'Website scraped and ready — review and approve your knowledge',
      href: '/dashboard/knowledge',
      urgency: 'medium',
    })
  }
  if (!client.business_hours_weekday) {
    attentionItems.push({
      label: 'Business hours not set — callers can\'t be told when you\'re available',
      href: '/dashboard/actions#hours',
      urgency: 'low',
    })
  }
  if (client.subscription_status === 'trialing' && daysRemaining !== undefined && daysRemaining <= 7) {
    const keepWhat = client.twilio_number ? 'your number' : 'your agent'
    attentionItems.push({
      label: daysRemaining === 0
        ? `Trial expired — upgrade now to keep ${keepWhat}`
        : `Trial ends in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} — upgrade to keep ${keepWhat}`,
      href: '/dashboard/settings',
      urgency: daysRemaining <= 1 ? 'high' : daysRemaining <= 3 ? 'medium' : 'low',
    })
  }

  const hasHighUrgency = attentionItems.some(i => i.urgency === 'high')
  const hasMediumUrgency = attentionItems.some(i => i.urgency === 'medium')

  // Reset date for minutes bar
  const minuteResetDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
    .toLocaleDateString('en', { month: 'short', day: 'numeric' })

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <style>{BOT_KEYFRAMES}</style>

      {/* ── 1. Needs Attention — elevated above test card when active ── */}
      {attentionItems.length > 0 && (
        <div className="sm:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold" style={{
              color: hasHighUrgency ? '#f87171' : hasMediumUrgency ? '#fbbf24' : 'var(--color-text-3)'
            }}>
              Needs Attention
            </p>
            <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full ${
              hasHighUrgency ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'
            }`}>{attentionItems.length}</span>
          </div>
          <div className={`rounded-2xl border bg-surface overflow-hidden divide-y ${
            hasHighUrgency ? 'border-red-500/40' :
            hasMediumUrgency ? 'border-amber-500/30' :
            'b-theme'
          }`} style={!hasHighUrgency && !hasMediumUrgency ? { borderColor: 'var(--color-border)' } : undefined}>
            {attentionItems.map((item, i) => (
              <Link
                key={i}
                href={item.href}
                className="flex items-start gap-3 px-4 py-3 hover:bg-hover transition-colors group relative"
              >
                <span className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-r-full ${
                  item.urgency === 'high' ? 'bg-red-500' :
                  item.urgency === 'medium' ? 'bg-amber-400' :
                  'bg-zinc-600'
                }`} />
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1 ${
                  item.urgency === 'high' ? 'bg-red-400' :
                  item.urgency === 'medium' ? 'bg-amber-400' :
                  'bg-zinc-500'
                }`} />
                <span className={`text-xs flex-1 leading-relaxed ${
                  item.urgency === 'high' ? 't1' : 't2'
                }`}>{item.label}</span>
                <ChevronRight className="t3 shrink-0 mt-0.5 group-hover:t1 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── 2. Test Your Agent ─────────────────────────────── */}
      <div className="sm:col-span-2">
        <AgentTestCard
          agentName={client.agent_name ?? client.business_name ?? 'your agent'}
          businessName={client.business_name}
          clientStatus={client.status ?? null}
          isTrial={!isAdmin && client.subscription_status === 'trialing'}
          clientId={isAdmin ? client.id : undefined}
          daysRemaining={daysRemaining}
        />
      </div>

      {/* ── 2.25. Phase E Wave 3 — Day-1 Edit Panel ────────── */}
      <Day1EditPanel client={client} isAdmin={isAdmin} />

      {/* ── 2.5. Today's Update ────────────────────────────── */}
      <div>
        <SectionLabel>Today&apos;s Update</SectionLabel>
        <div className="rounded-2xl border b-theme bg-surface px-5 pb-4">
          <QuickInject client={client} isAdmin={isAdmin} />
        </div>
      </div>

      {/* ── 3. Agent Identity ──────────────────────────────── */}
      <div>
        <SectionLabel>Identity &amp; Status</SectionLabel>
        <div className="rounded-2xl border b-theme bg-surface p-5">
          <AgentIdentityHeader
            client={client}
            isActive={isActive}
            onToggleStatus={toggleStatus}
          />
          {/* Usage bar */}
          <div className="pt-4 border-t b-theme">
            <div className="flex items-center justify-between mb-2">
              <p className={`text-[10px] font-semibold tracking-[0.15em] uppercase transition-colors ${
                usagePct >= 95 ? 'text-amber-400' : 't3'
              }`}>Minutes This Month</p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono t2 tabular-nums">{minutesUsed} / {minuteLimit} min</span>
                {(client.bonus_minutes ?? 0) > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border text-indigo-400 border-indigo-500/30 bg-indigo-500/10">
                    +{client.bonus_minutes}
                  </span>
                )}
              </div>
            </div>
            <div className="h-1.5 bg-hover rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usagePct > 100 ? 'bg-pink-500' :
                  usagePct >= 95 ? 'bg-red-500' :
                  usagePct >= 80 ? 'bg-amber-500' :
                  'bg-blue-500'
                }`}
                style={{ width: `${Math.min(usagePct, 100)}%` }}
              />
            </div>
            <p className={`text-[11px] mt-1.5 tabular-nums font-mono transition-colors ${
              usagePct >= 95 ? 'text-red-400' : 't3'
            }`}>
              {Math.max(minuteLimit - minutesUsed, 0)} min remaining · resets {minuteResetDate}
            </p>
          </div>
          <AgentNameField
            clientId={client.id}
            isAdmin={isAdmin}
            initialName={client.agent_name ?? ''}
          />
          <BusinessProfileCard client={client} isAdmin={isAdmin} />
        </div>
      </div>

      {/* ── 4. What It Knows ───────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>What It Knows</SectionLabel>
          <Link
            href="/dashboard/knowledge"
            className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 -mt-3"
          >
            Manage <ChevronRight />
          </Link>
        </div>
        <div className="rounded-2xl border b-theme bg-surface px-5 py-4">
          <div className={`grid grid-cols-3 gap-3 text-center ${
            factLines === 0 && faqCount === 0 && client.website_scrape_status !== 'approved' ? 'opacity-60' : ''
          }`}>
            <div>
              <p className={`text-xl font-bold tabular-nums ${factLines > 0 ? 't1' : 't3'}`}>{factLines}</p>
              <p className="text-[10px] t3 mt-0.5">Business facts</p>
            </div>
            <div>
              <p className={`text-xl font-bold tabular-nums ${faqCount > 0 ? 't1' : 't3'}`}>{faqCount}</p>
              <p className="text-[10px] t3 mt-0.5">Q&amp;A pairs</p>
            </div>
            <div>
              {client.website_scrape_status === 'approved' ? (
                <>
                  <p className="text-xl font-bold text-green-400">✓</p>
                  <p className="text-[10px] t3 mt-0.5">Website</p>
                </>
              ) : client.website_scrape_status === 'extracted' ? (
                <>
                  <p className="text-xl font-bold text-amber-400">!</p>
                  <p className="text-[10px] text-amber-400/70 mt-0.5">Review ready</p>
                </>
              ) : (
                <>
                  <p className="text-xl font-bold t3">—</p>
                  <p className="text-[10px] t3 mt-0.5">Website</p>
                </>
              )}
            </div>
          </div>
          {factLines === 0 && faqCount === 0 && client.website_scrape_status !== 'approved' && (
            <p className="text-[11px] text-amber-400/80 mt-3 pt-3 border-t b-theme">
              Your agent answers calls but knows nothing specific about your business yet.{' '}
              <Link href="/dashboard/knowledge" className="underline hover:text-amber-300 transition-colors">
                Add knowledge →
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* ── 5. Voice & Style ───────────────────────────────── */}
      <div>
        <SectionLabel>Voice &amp; Style</SectionLabel>
        <div className="space-y-3">
          {/* Speaker voice — controls agent_voice_id, syncs live agent */}
          <div className="rounded-2xl border b-theme bg-surface p-5">
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-3">Speaker</p>
            <VoicePicker client={client} isAdmin={isAdmin} />
          </div>
          {/* Personality — controls voice_style_preset (prompt patch) */}
          <VoiceStyleCard
            clientId={client.id}
            isAdmin={isAdmin}
            initialPreset={client.voice_style_preset ?? 'casual_friendly'}
            previewMode={previewMode}
          />
        </div>
      </div>

      {/* ── 5.5. What Your Agent Can Answer ────────────────── */}
      <div className="sm:col-span-2">
        <SectionLabel>What It Can Answer</SectionLabel>
        <AgentAnswerabilityCard
          businessFacts={Array.isArray(client.business_facts) ? client.business_facts.join('\n') : (client.business_facts ?? null)}
          extraQa={client.extra_qa ?? []}
          businessHoursWeekday={client.business_hours_weekday ?? null}
          city={client.city ?? null}
          state={client.state ?? null}
          bookingEnabled={!!client.booking_enabled}
        />
      </div>

      {/* ── 6. What It Can Do ──────────────────────────────── */}
      <div className="sm:col-span-2">
        <SectionLabel>What It Can Do</SectionLabel>
        <CapabilitiesCard
          capabilities={buildCapabilityFlags(client)}
          agentName={client.agent_name ?? client.business_name}
          voiceStylePreset={client.voice_style_preset ?? null}
          isTrial={client.subscription_status === 'trialing'}
          clientId={client.id}
          hasPhoneNumber={!!client.twilio_number}
          hasIvr={!!client.ivr_enabled}
          hasContextData={!!(client.context_data?.trim())}
        />
      </div>

      {/* ── 7. Recent Changes ──────────────────────────────── */}
      <div className="sm:col-span-2">
        <SectionLabel>Recent Changes</SectionLabel>
        <ActivityLog clientId={client.id} isAdmin={isAdmin} />
      </div>
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

interface AgentPageViewProps {
  clients: ClientConfig[]
  isAdmin: boolean
  previewMode?: boolean
  initialClientId?: string
}

export default function AgentPageView({ clients, isAdmin, previewMode, initialClientId }: AgentPageViewProps) {
  const [selectedId, setSelectedId] = useState(
    initialClientId && clients.find(c => c.id === initialClientId)
      ? initialClientId
      : clients[0]?.id ?? ''
  )

  const client = clients.find(c => c.id === selectedId) ?? clients[0]
  if (!client) return null

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-4xl">
      {isAdmin && clients.length > 1 && (
        <AdminDropdown clients={clients} selectedId={selectedId} onSelect={setSelectedId} />
      )}

      <AgentCards key={client.id} client={client} isAdmin={isAdmin} previewMode={previewMode} />
    </div>
  )
}
