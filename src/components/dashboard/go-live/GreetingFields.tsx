'use client'

/**
 * GreetingFields — Go Live tab Section 1: How they're greeted.
 *
 * Spec: docs/superpowers/specs/2026-04-26-go-live-tab-design.md §5.1
 *
 * Four stacked text inputs (debounced autosave, green ✓ chip on success):
 *   - business_name        → DB column (slot pipeline patcher: patchBusinessName)
 *   - agent_name           → DB column (slot pipeline patcher: patchAgentName)
 *   - opening_line         → niche_custom_variables.GREETING_LINE  (slot regen)
 *   - agent's-job (goal)   → niche_custom_variables.PRIMARY_GOAL   (slot regen)
 *
 * Plus an inline "Voicemail + missed-call text" accordion wrapping
 * voicemail_greeting_text + sms_enabled + sms_template.
 *
 * Save behavior: 800ms debounce per field — uses the existing
 * `usePatchSettings` hook so all serialization, prompt sync, and warnings
 * paths match the legacy settings cards.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'

export interface GreetingFieldsClient {
  id: string
  business_name: string | null
  agent_name: string | null
  niche_custom_variables: Record<string, string> | null
  voicemail_greeting_text: string | null
  sms_enabled: boolean | null
  sms_template: string | null
}

interface Props {
  client: GreetingFieldsClient
  isAdmin: boolean
  /** Optional callback fired after each successful save. */
  onSave?: () => void
}

const DEBOUNCE_MS = 800

// Default placeholders — niche-aware copy lives upstream in NICHE_CONFIG;
// these are safe generic fallbacks if the parent doesn't override.
const PLACEHOLDERS = {
  business_name: 'e.g. Bright Smile Dental',
  agent_name: 'e.g. Aisha',
  opening_line: 'e.g. Bright Smile Dental, this is Aisha — how can I help?',
  job: 'e.g. Find out what they need, then book an appointment',
}

export default function GreetingFields({ client, isAdmin, onSave }: Props) {
  const ncv = (client.niche_custom_variables ?? {}) as Record<string, string>

  // ── Local state — controlled inputs ──────────────────────────────────────
  const [businessName, setBusinessName] = useState(client.business_name ?? '')
  const [agentName, setAgentName] = useState(client.agent_name ?? '')
  const [openingLine, setOpeningLine] = useState(ncv.GREETING_LINE ?? '')
  const [job, setJob] = useState(ncv.PRIMARY_GOAL ?? '')

  // Voicemail + SMS accordion state
  const [accordionOpen, setAccordionOpen] = useState(false)
  const [voicemailText, setVoicemailText] = useState(client.voicemail_greeting_text ?? '')
  const [smsEnabled, setSmsEnabled] = useState(!!client.sms_enabled)
  const [smsTemplate, setSmsTemplate] = useState(
    client.sms_template ?? 'Hey — caught your call from {{business_name}}. What can I help with?'
  )

  // Per-field saved-just-now state (drives the green ✓ chip)
  const [savedFlash, setSavedFlash] = useState<Record<string, boolean>>({})

  const { patch } = usePatchSettings(client.id, isAdmin, { onSave })

  // ── Debounce machinery ───────────────────────────────────────────────────
  // One timer per field name. clearAllOnUnmount.
  const timers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({})
  useEffect(() => {
    const t = timers.current
    return () => {
      Object.values(t).forEach(timer => { if (timer) clearTimeout(timer) })
    }
  }, [])

  /** Schedule a debounced patch for a single field key. */
  const scheduleSave = useCallback(
    (fieldKey: string, build: () => Record<string, unknown>) => {
      const existing = timers.current[fieldKey]
      if (existing) clearTimeout(existing)
      timers.current[fieldKey] = setTimeout(async () => {
        const payload = build()
        const res = await patch(payload)
        if (res?.ok) {
          setSavedFlash(prev => ({ ...prev, [fieldKey]: true }))
          // ✓ chip fades after 2s
          setTimeout(() => {
            setSavedFlash(prev => {
              if (!prev[fieldKey]) return prev
              const next = { ...prev }
              delete next[fieldKey]
              return next
            })
          }, 2000)
        }
      }, DEBOUNCE_MS)
    },
    [patch]
  )

  // ── Handlers ─────────────────────────────────────────────────────────────
  function onBusinessNameChange(v: string) {
    setBusinessName(v)
    scheduleSave('business_name', () => ({ business_name: v.trim() }))
  }
  function onAgentNameChange(v: string) {
    setAgentName(v)
    scheduleSave('agent_name', () => ({ agent_name: v.trim() }))
  }
  function onOpeningLineChange(v: string) {
    setOpeningLine(v)
    scheduleSave('opening_line', () => ({
      niche_custom_variables: { ...(client.niche_custom_variables ?? {}), GREETING_LINE: v.trim() },
    }))
  }
  function onJobChange(v: string) {
    setJob(v)
    scheduleSave('job', () => ({
      niche_custom_variables: { ...(client.niche_custom_variables ?? {}), PRIMARY_GOAL: v.trim() },
    }))
  }
  function onVoicemailChange(v: string) {
    setVoicemailText(v)
    scheduleSave('voicemail_greeting_text', () => ({ voicemail_greeting_text: v }))
  }
  function onSmsToggle(next: boolean) {
    setSmsEnabled(next)
    // Toggle = immediate (no debounce) to match user expectation.
    const t = timers.current.sms_enabled
    if (t) clearTimeout(t)
    timers.current.sms_enabled = setTimeout(async () => {
      const res = await patch({ sms_enabled: next })
      if (res?.ok) {
        setSavedFlash(prev => ({ ...prev, sms_enabled: true }))
        setTimeout(() => setSavedFlash(prev => {
          const n = { ...prev }; delete n.sms_enabled; return n
        }), 2000)
      }
    }, 50)
  }
  function onSmsTemplateChange(v: string) {
    setSmsTemplate(v)
    scheduleSave('sms_template', () => ({ sms_template: v }))
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <section className="space-y-4" aria-labelledby="go-live-greeting-heading">
      <h2 id="go-live-greeting-heading" className="sr-only">How they&apos;re greeted</h2>

      <Field
        id="gl-business-name"
        label="Business name"
        value={businessName}
        onChange={onBusinessNameChange}
        placeholder={PLACEHOLDERS.business_name}
        autoComplete="organization"
        savedFlash={!!savedFlash.business_name}
        helper="Your agent will say this exactly as written."
      />

      <Field
        id="gl-agent-name"
        label="Agent name"
        value={agentName}
        onChange={onAgentNameChange}
        placeholder={PLACEHOLDERS.agent_name}
        autoComplete="off"
        savedFlash={!!savedFlash.agent_name}
      />

      <Field
        id="gl-opening-line"
        label="Opening line"
        value={openingLine}
        onChange={onOpeningLineChange}
        placeholder={PLACEHOLDERS.opening_line}
        autoComplete="off"
        savedFlash={!!savedFlash.opening_line}
        textarea
        rows={2}
      />

      <Field
        id="gl-job"
        label="What's the agent's job on this call?"
        value={job}
        onChange={onJobChange}
        placeholder={PLACEHOLDERS.job}
        autoComplete="off"
        savedFlash={!!savedFlash.job}
        textarea
        rows={2}
      />

      {/* ── Voicemail + missed-call text accordion ────────────────────── */}
      <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setAccordionOpen(o => !o)}
          aria-expanded={accordionOpen}
          aria-controls="gl-vm-sms-panel"
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-zinc-50 transition-colors"
        >
          <span className="text-sm font-medium text-zinc-900">
            Voicemail + missed-call text
          </span>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            className={`text-zinc-400 transition-transform duration-200 ${accordionOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <AnimatePresence initial={false}>
          {accordionOpen && (
            <motion.div
              id="gl-vm-sms-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 pt-1 space-y-4 border-t border-zinc-100">
                <Field
                  id="gl-voicemail-text"
                  label="Voicemail greeting"
                  value={voicemailText}
                  onChange={onVoicemailChange}
                  placeholder={`Hi, you've reached ${client.business_name || 'us'} — leave a message and we'll call you back.`}
                  autoComplete="off"
                  savedFlash={!!savedFlash.voicemail_greeting_text}
                  textarea
                  rows={3}
                  helper="Played to callers if your agent is ever unavailable."
                />

                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-zinc-900">Send a text if I miss them</span>
                    <span className="text-xs text-zinc-500">After a missed call, your agent texts the caller.</span>
                  </div>
                  <SwitchToggle
                    checked={smsEnabled}
                    onChange={onSmsToggle}
                    label="Enable missed-call text"
                    savedFlash={!!savedFlash.sms_enabled}
                  />
                </div>

                {smsEnabled && (
                  <Field
                    id="gl-sms-template"
                    label="Missed-call text template"
                    value={smsTemplate}
                    onChange={onSmsTemplateChange}
                    placeholder="Hey — caught your call from {{business_name}}. What can I help with?"
                    autoComplete="off"
                    savedFlash={!!savedFlash.sms_template}
                    textarea
                    rows={3}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Low-contrast deep link to the prompt editor */}
      <div className="text-center pt-1">
        <a
          href="/dashboard/settings?tab=agent#prompt"
          className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors underline-offset-2 hover:underline"
        >
          Want to change how it handles tricky calls? Edit the full script &rarr;
        </a>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Field — shared input/textarea row with sr-only label and ✓ chip.
// ─────────────────────────────────────────────────────────────────────────────

interface FieldProps {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  autoComplete: string
  savedFlash: boolean
  textarea?: boolean
  rows?: number
  helper?: string
}

function Field({
  id, label, value, onChange, placeholder, autoComplete,
  savedFlash, textarea, rows, helper,
}: FieldProps) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm p-5">
      <div className="flex items-center justify-between mb-2">
        <label htmlFor={id} className="text-sm font-medium text-zinc-900">
          {label}
        </label>
        <SavedChip visible={savedFlash} />
      </div>

      {textarea ? (
        <textarea
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode="text"
          rows={rows ?? 2}
          className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 transition-colors resize-y"
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode="text"
          className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 transition-colors"
        />
      )}

      {helper && <p className="text-xs text-zinc-500 mt-1.5">{helper}</p>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SavedChip — green ✓ chip (motion: fade + 4px translate-y, 200ms ease-out).
// ─────────────────────────────────────────────────────────────────────────────

function SavedChip({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.span
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5"
          role="status"
          aria-live="polite"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Saved
        </motion.span>
      )}
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SwitchToggle — minimal accessible toggle (not the heavy bouncy-toggle).
// ─────────────────────────────────────────────────────────────────────────────

interface SwitchToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  savedFlash?: boolean
}

function SwitchToggle({ checked, onChange, label, savedFlash }: SwitchToggleProps) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <SavedChip visible={!!savedFlash} />
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${
          checked ? 'bg-zinc-900' : 'bg-zinc-300'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
