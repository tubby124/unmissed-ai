'use client'

/**
 * NotificationsBlock — Go Live "How you'll be notified" section.
 *
 * Three rows:
 *   1. Telegram alerts        — advisory only + connect/manage link to Settings
 *   2. SMS auto-text reply    — inline editable (toggle + template textarea), parity with Overview's PostCallActionsTile
 *   3. Voicemail greeting     — inline editable textarea, parity with Overview's IvrVoicemailTile
 *
 * Patch path: usePatchSettings → PATCH /api/dashboard/settings.
 *  - sms_enabled / sms_template are RUNTIME_ONLY (no agent resync needed).
 *  - voicemail_greeting_text is RUNTIME_ONLY (read at call time when Ultravox is unreachable).
 */

import { useState } from 'react'
import Link from 'next/link'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'

interface Props {
  clientId: string
  isAdmin: boolean
  telegramConnected: boolean
  hasSms: boolean
  smsEnabled: boolean
  smsTemplate: string | null
  voicemailGreetingText: string | null
  agentName?: string | null
  businessName?: string | null
}

const SMS_CHAR_LIMIT = 320

const DEFAULT_SMS = (name: string) =>
  `Hi, this is ${name}! Thanks for calling — here's a quick follow-up with any details we discussed. Feel free to reply with any questions.`

const DEFAULT_VOICEMAIL = (name: string) =>
  `Hi, you've reached ${name}. We're unavailable right now. Please leave your name and number and we'll get back to you shortly.`

export default function NotificationsBlock({
  clientId,
  isAdmin,
  telegramConnected,
  hasSms,
  smsEnabled,
  smsTemplate,
  voicemailGreetingText,
  agentName,
  businessName,
}: Props) {
  const { patch, saving } = usePatchSettings(clientId, isAdmin)
  const speaker = agentName ?? 'your agent'
  const biz = businessName ?? agentName ?? 'the business'

  // ── SMS auto-text state ────────────────────────────────────────────────
  const [smsOn, setSmsOn] = useState(smsEnabled)
  const [smsText, setSmsText] = useState(smsTemplate ?? DEFAULT_SMS(speaker))
  const [smsOpen, setSmsOpen] = useState(false)
  const [smsDirty, setSmsDirty] = useState(false)

  // ── Voicemail state ────────────────────────────────────────────────────
  const [vmText, setVmText] = useState(voicemailGreetingText ?? DEFAULT_VOICEMAIL(biz))
  const [vmOpen, setVmOpen] = useState(false)
  const [vmDirty, setVmDirty] = useState(false)

  async function toggleSms() {
    if (!hasSms) return
    const next = !smsOn
    setSmsOn(next)
    await patch({ sms_enabled: next })
  }

  async function saveSms() {
    await patch({ sms_template: smsText })
    setSmsDirty(false)
  }

  async function saveVm() {
    await patch({ voicemail_greeting_text: vmText })
    setVmDirty(false)
  }

  const smsCharsLeft = SMS_CHAR_LIMIT - smsText.length
  const smsOverLimit = smsCharsLeft < 0

  return (
    <div className="rounded-3xl shadow-sm bg-white p-6 border border-zinc-100">
      <div className="pb-2">
        <h3 className="text-base font-semibold text-zinc-900">How you&apos;ll be notified</h3>
        <p className="text-sm text-zinc-600 mt-0.5">
          What the caller hears back, and how you find out.
        </p>
      </div>

      {/* ═══════════ Telegram (advisory only) ═══════════ */}
      <div className="border-t border-zinc-100 py-3 flex items-start gap-3">
        <span className="shrink-0 mt-0.5 text-zinc-500" aria-hidden="true"><TelegramIcon /></span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-zinc-900">Telegram alerts</span>
            <Pill
              tone={telegramConnected ? 'green' : 'gray'}
              label={telegramConnected ? 'Connected' : 'Not set up'}
            />
          </div>
          <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed">
            {telegramConnected
              ? "We'll ping you the moment a call comes in."
              : 'Connect Telegram to get instant call alerts on your phone.'}
          </p>
        </div>
        <Link
          href="/dashboard/settings?tab=notifications"
          className="shrink-0 text-xs font-medium text-zinc-700 hover:text-zinc-900 underline underline-offset-2"
        >
          {telegramConnected ? 'Manage' : 'Connect'}
        </Link>
      </div>

      {/* ═══════════ Auto-text reply (inline editable) ═══════════ */}
      <div className="border-t border-zinc-100">
        <button
          type="button"
          onClick={() => setSmsOpen(o => !o)}
          className="w-full py-3 flex items-start gap-3 text-left hover:bg-zinc-50/60 -mx-2 px-2 rounded-lg transition-colors"
          aria-expanded={smsOpen}
        >
          <span className="shrink-0 mt-0.5 text-zinc-500" aria-hidden="true"><SmsIcon /></span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-zinc-900">Auto-text reply</span>
              <Pill
                tone={smsOn && hasSms ? 'green' : 'gray'}
                label={hasSms ? (smsOn ? 'On' : 'Off') : 'Needs number'}
              />
            </div>
            <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed line-clamp-2">
              {hasSms
                ? truncate(smsText, 90)
                : 'A phone number is required to send follow-up texts.'}
            </p>
          </div>
          <Chevron open={smsOpen} />
        </button>

        {smsOpen && (
          <div className="pb-4 pl-9 pr-1 space-y-2">
            {!hasSms ? (
              <p className="text-xs text-zinc-500 leading-relaxed">
                Activate a phone number first — auto-text replies need an outbound SMS sender.
              </p>
            ) : (
              <>
                <label className="flex items-center gap-2 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smsOn}
                    onChange={toggleSms}
                    disabled={saving}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                  />
                  <span className="text-xs text-zinc-700">Send a follow-up text after each call</span>
                </label>
                <textarea
                  value={smsText}
                  onChange={(e) => { setSmsText(e.target.value); setSmsDirty(true) }}
                  rows={4}
                  className={`w-full text-xs rounded-lg px-3 py-2 resize-none transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-zinc-50 text-zinc-900 leading-relaxed border ${smsOverLimit ? 'border-red-400' : 'border-zinc-200'}`}
                />
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] ${smsOverLimit ? 'text-red-600' : 'text-zinc-500'}`}>
                    {smsOverLimit
                      ? `${Math.abs(smsCharsLeft)} chars over`
                      : `${smsCharsLeft} remaining`}
                  </span>
                  {smsDirty && (
                    <button
                      type="button"
                      onClick={saveSms}
                      disabled={saving || smsOverLimit}
                      className="text-xs font-semibold px-3 py-1 rounded-full bg-zinc-900 text-white disabled:opacity-40"
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ═══════════ Voicemail greeting (inline editable) ═══════════ */}
      <div className="border-t border-zinc-100">
        <button
          type="button"
          onClick={() => setVmOpen(o => !o)}
          className="w-full py-3 flex items-start gap-3 text-left hover:bg-zinc-50/60 -mx-2 px-2 rounded-lg transition-colors"
          aria-expanded={vmOpen}
        >
          <span className="shrink-0 mt-0.5 text-zinc-500" aria-hidden="true"><VoicemailIcon /></span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-zinc-900">Voicemail greeting</span>
              <Pill
                tone={voicemailGreetingText ? 'green' : 'gray'}
                label={voicemailGreetingText ? 'Set' : 'Default'}
              />
            </div>
            <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed line-clamp-2">
              {truncate(vmText, 90)}
            </p>
          </div>
          <Chevron open={vmOpen} />
        </button>

        {vmOpen && (
          <div className="pb-4 pl-9 pr-1 space-y-2">
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Plays only when the agent is unreachable.
            </p>
            <textarea
              value={vmText}
              onChange={(e) => { setVmText(e.target.value); setVmDirty(true) }}
              rows={3}
              className="w-full text-xs rounded-lg px-3 py-2 resize-none transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-zinc-50 text-zinc-900 leading-relaxed border border-zinc-200"
            />
            {vmDirty && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={saveVm}
                  disabled={saving}
                  className="text-xs font-semibold px-3 py-1 rounded-full bg-zinc-900 text-white disabled:opacity-40"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Pill({ tone, label }: { tone: 'green' | 'gray'; label: string }) {
  const cls =
    tone === 'green'
      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
      : 'bg-zinc-50 text-zinc-600 border-zinc-200'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 mt-1 text-zinc-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function truncate(s: string, n: number): string {
  const t = s.trim()
  return t.length > n ? `${t.slice(0, n - 1).trim()}…` : t
}

function TelegramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 3L3 10.5l7 1.5 2 5 3-3 5 3L21 3z" />
    </svg>
  )
}

function SmsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function VoicemailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="14" r="4" />
      <circle cx="18" cy="14" r="4" />
      <line x1="6" y1="18" x2="18" y2="18" />
    </svg>
  )
}
