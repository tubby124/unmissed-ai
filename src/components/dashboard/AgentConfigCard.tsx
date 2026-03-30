'use client'

import { useState } from 'react'
import Link from 'next/link'

interface AgentConfigCardProps {
  afterHoursBehavior: string | null
  businessHoursWeekday: string | null
  businessHoursWeekend: string | null
  forwardingNumber: string | null
  voicemailGreetingText: string | null
  ivrEnabled: boolean | null
  smsEnabled: boolean | null
  outboundVmScript: string | null
  outboundTone: string | null
  outboundGoal: string | null
  outboundOpening: string | null
  callHandlingMode: string | null
  transferConditions: string | null
  ivrPrompt: string | null
  clientId: string | null
}

type Tab = 'inbound' | 'outbound'
type ModalId = 'hours' | 'transfer' | 'voicemail' | 'ivr' | null

const AFTER_HOURS_OPTIONS = [
  { value: 'take_message', label: 'Take a message' },
  { value: 'voicemail', label: 'Send to voicemail' },
  { value: 'route_emergency', label: 'Transfer to cell' },
  { value: 'always_answer', label: 'Always answer' },
] as const

const TONES = [
  { value: 'warm', label: 'Warm', desc: 'Friendly, builds rapport' },
  { value: 'professional', label: 'Professional', desc: 'Polished but concise' },
  { value: 'direct', label: 'Direct', desc: 'Short, clear ask' },
] as const

const PLACEHOLDERS = [
  { token: '{{LEAD_NAME}}', desc: "Contact's name" },
  { token: '{{AGENT_NAME}}', desc: "Your agent's name" },
  { token: '{{BUSINESS_NAME}}', desc: 'Your business name' },
  { token: '{{PHONE}}', desc: 'Your contact number' },
]

function modeLabel(mode: string | null): string {
  if (!mode) return 'Basic answering'
  if (mode === 'full_service') return 'Receptionist + Booking'
  if (mode === 'receptionist') return 'Receptionist'
  if (mode === 'voicemail_replacement') return 'Smart Voicemail'
  if (mode === 'appointment_booking') return 'Booking focus'
  return mode
}

function NavRow({ label, value, onClick }: { label: string; value?: string | null; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between py-2.5 border-b last:border-0 hover:opacity-70 transition-opacity text-left"
      style={{ borderColor: 'var(--color-border-subtle)' }}
    >
      <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-3)' }}>{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        {value && (
          <span className="text-[11px] truncate max-w-[120px]" style={{ color: 'var(--color-text-2)' }}>{value}</span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-text-3)', flexShrink: 0 }}>
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </button>
  )
}

export default function AgentConfigCard({
  afterHoursBehavior,
  businessHoursWeekday,
  businessHoursWeekend,
  forwardingNumber,
  voicemailGreetingText,
  ivrEnabled,
  smsEnabled,
  outboundVmScript,
  outboundTone,
  outboundGoal,
  outboundOpening,
  callHandlingMode,
  transferConditions,
  ivrPrompt,
  clientId,
}: AgentConfigCardProps) {
  const [tab, setTab] = useState<Tab>('inbound')
  const [modal, setModal] = useState<ModalId>(null)

  // Inbound state
  const [afterHours, setAfterHours] = useState(afterHoursBehavior ?? 'voicemail')
  const [weekday, setWeekday] = useState(businessHoursWeekday ?? '')
  const [weekend, setWeekend] = useState(businessHoursWeekend ?? '')
  const [fwdNum, setFwdNum] = useState(forwardingNumber ?? '')
  const [transferConds, setTransferConds] = useState(transferConditions ?? '')
  const [vmText, setVmText] = useState(voicemailGreetingText ?? '')
  const [ivrOn, setIvrOn] = useState(ivrEnabled ?? false)
  const [ivrText, setIvrText] = useState(ivrPrompt ?? '')
  const [smsOn, setSmsOn] = useState(smsEnabled ?? false)

  // Outbound state
  const [tone, setTone] = useState(outboundTone ?? 'professional')
  const [vmScript, setVmScript] = useState(outboundVmScript ?? '')
  const [goal, setGoal] = useState(outboundGoal ?? '')
  const [opening, setOpening] = useState(outboundOpening ?? '')

  const [saving, setSaving] = useState(false)
  const [savedLabel, setSavedLabel] = useState<string | null>(null)
  const [showPlaceholders, setShowPlaceholders] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const settingsHref = '/dashboard/settings?tab=general'

  async function patch(body: Record<string, unknown>) {
    if (!clientId) return
    setSaving(true)
    try {
      await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      })
    } finally {
      setSaving(false)
    }
  }

  async function selectAfterHours(v: string) {
    setAfterHours(v)
    await patch({ after_hours_behavior: v })
  }

  async function saveHours() {
    await patch({ business_hours_weekday: weekday, business_hours_weekend: weekend, after_hours_behavior: afterHours })
    showSaved('hours')
    setModal(null)
  }

  async function saveTransfer() {
    await patch({ forwarding_number: fwdNum, transfer_conditions: transferConds })
    showSaved('transfer')
    setModal(null)
  }

  async function saveVoicemail() {
    await patch({ voicemail_greeting_text: vmText })
    showSaved('voicemail')
    setModal(null)
  }

  async function saveIvr() {
    await patch({ ivr_enabled: ivrOn, ivr_prompt: ivrText })
    showSaved('ivr')
    setModal(null)
  }

  async function toggleSms() {
    const next = !smsOn
    setSmsOn(next)
    await patch({ sms_enabled: next })
  }

  async function selectTone(t: string) {
    setTone(t)
    await patch({ outbound_tone: t })
  }

  async function saveOutbound() {
    await patch({ outbound_goal: goal, outbound_opening: opening, outbound_vm_script: vmScript })
    showSaved('outbound')
  }

  function showSaved(key: string) {
    setSavedLabel(key)
    setTimeout(() => setSavedLabel(null), 2000)
  }

  return (
    <>
      <div className="card-surface rounded-2xl p-5">
        {/* Header + tab toggle */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 8.96a19.79 19.79 0 01-3.07-8.67A2 2 0 012.88 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-sm font-semibold t1">Agent Configuration</p>
          </div>
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ backgroundColor: 'var(--color-hover)' }}>
            {(['inbound', 'outbound'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-3 py-1 rounded-md text-[11px] font-medium transition-colors capitalize"
                style={
                  tab === t
                    ? { backgroundColor: 'var(--color-surface)', color: 'var(--color-text-1)', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }
                    : { color: 'var(--color-text-3)' }
                }
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* ── Inbound ── */}
        {tab === 'inbound' && (
          <div className="space-y-4">
            {/* Mode label */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest t3">Mode</span>
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--color-accent-tint)', color: 'var(--color-primary)' }}
              >
                {modeLabel(callHandlingMode)}
              </span>
              <Link
                href={settingsHref}
                className="text-[10px] ml-auto"
                style={{ color: 'var(--color-primary)' }}
              >
                Change →
              </Link>
            </div>

            {/* 2-col: After-hours selector | Nav rows */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Left: When closed */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2 t3">When closed</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {AFTER_HOURS_OPTIONS.map(opt => {
                    const active = afterHours === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => void selectAfterHours(opt.value)}
                        className="rounded-xl px-2 py-2 text-[11px] font-medium text-left border transition-all"
                        style={
                          active
                            ? {
                                backgroundColor: 'var(--color-accent-tint)',
                                borderColor: 'var(--color-primary)',
                                color: 'var(--color-primary)',
                              }
                            : {
                                backgroundColor: 'var(--color-hover)',
                                borderColor: 'var(--color-border)',
                                color: 'var(--color-text-2)',
                              }
                        }
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Right: Nav rows */}
              <div>
                <NavRow
                  label="Hours"
                  value={weekday || businessHoursWeekday || undefined}
                  onClick={() => setModal('hours')}
                />
                <NavRow
                  label="Live transfer"
                  value={fwdNum || forwardingNumber || undefined}
                  onClick={() => setModal('transfer')}
                />
                <NavRow
                  label="Voicemail greeting"
                  value={vmText ? vmText.slice(0, 30) + (vmText.length > 30 ? '…' : '') : undefined}
                  onClick={() => setModal('voicemail')}
                />
                <NavRow
                  label="IVR / Pre-call menu"
                  value={ivrOn ? 'On' : 'Off'}
                  onClick={() => setModal('ivr')}
                />
                <Link
                  href="/dashboard/settings?tab=voice"
                  className="w-full flex items-center justify-between py-2.5 hover:opacity-70 transition-opacity"
                >
                  <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-3)' }}>Voice</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-text-3)', flexShrink: 0 }}>
                    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
              </div>
            </div>

            {/* SMS Follow-up */}
            <div
              className="flex items-center justify-between pt-3 border-t"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ color: smsOn ? 'var(--color-primary)' : 'var(--color-text-3)' }}>
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-[11px] font-medium t1">SMS Follow-up</span>
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={
                    smsOn
                      ? { backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e' }
                      : { backgroundColor: 'var(--color-hover)', color: 'var(--color-text-3)' }
                  }
                >
                  {smsOn ? 'Active' : 'Off'}
                </span>
              </div>
              <button
                onClick={() => void toggleSms()}
                disabled={!clientId}
                className="relative inline-flex items-center h-5 w-9 rounded-full transition-colors disabled:opacity-40"
                style={{ backgroundColor: smsOn ? 'var(--color-primary)' : 'var(--color-hover)', border: '1px solid var(--color-border)' }}
              >
                <span
                  className="inline-block w-3.5 h-3.5 rounded-full bg-white shadow transition-transform"
                  style={{ transform: smsOn ? 'translateX(18px)' : 'translateX(2px)' }}
                />
              </button>
            </div>
          </div>
        )}

        {/* ── Outbound ── */}
        {tab === 'outbound' && (
          <div className="space-y-5">
            {/* Tone */}
            <div>
              <p className="text-[10px] font-semibold tracking-[0.12em] uppercase t3 mb-2">Tone</p>
              <div className="grid grid-cols-3 gap-2">
                {TONES.map(t => {
                  const active = tone === t.value
                  return (
                    <button
                      key={t.value}
                      onClick={() => void selectTone(t.value)}
                      className="rounded-xl p-3 text-left transition-all border"
                      style={
                        active
                          ? { backgroundColor: 'var(--color-accent-tint)', borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }
                          : { backgroundColor: 'var(--color-hover)', borderColor: 'var(--color-border)', color: 'var(--color-text-2)' }
                      }
                    >
                      <p className="text-[12px] font-semibold">{t.label}</p>
                      <p className="text-[10px] mt-0.5 opacity-70">{t.desc}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Call Goal */}
            <div>
              <p className="text-[10px] font-semibold tracking-[0.12em] uppercase t3 mb-2">Call Goal</p>
              <input
                value={goal}
                onChange={e => setGoal(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-[12px] outline-none"
                style={{ backgroundColor: 'var(--color-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-1)' }}
                placeholder="Follow up and schedule a conversation"
              />
            </div>

            {/* Opening Line */}
            <div>
              <p className="text-[10px] font-semibold tracking-[0.12em] uppercase t3 mb-2">Opening Line</p>
              <input
                value={opening}
                onChange={e => setOpening(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-[12px] outline-none"
                style={{ backgroundColor: 'var(--color-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-1)' }}
                placeholder="Hi, this is {{AGENT_NAME}} from {{BUSINESS_NAME}}. I'm trying to reach {{LEAD_NAME}} — quick minute?"
              />
            </div>

            {/* Voicemail Script */}
            <div>
              <p className="text-[10px] font-semibold tracking-[0.12em] uppercase t3 mb-2">Voicemail Script</p>
              <textarea
                value={vmScript}
                onChange={e => setVmScript(e.target.value)}
                rows={3}
                maxLength={500}
                className="w-full rounded-xl px-3 py-2.5 text-[12px] resize-none outline-none"
                style={{ backgroundColor: 'var(--color-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-1)' }}
                placeholder="Hi {{LEAD_NAME}}, this is {{AGENT_NAME}} from {{BUSINESS_NAME}}. Just reaching out — call us back. Thanks!"
              />
              <span className="text-[10px] t3">{vmScript.length}/500</span>
            </div>

            {/* Save button */}
            <button
              onClick={() => void saveOutbound()}
              disabled={saving || !clientId}
              className="w-full py-2 rounded-xl text-[12px] font-semibold disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
            >
              {saving ? 'Saving…' : savedLabel === 'outbound' ? 'Saved ✓' : 'Save outbound settings'}
            </button>

            {/* Collapsibles */}
            <div className="space-y-0 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
              {/* Available placeholders */}
              <div className="border-b last:border-0 py-2.5" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <button
                  onClick={() => setShowPlaceholders(v => !v)}
                  className="flex items-center justify-between w-full text-[11px] t3 hover:t2 transition-colors"
                >
                  <span>Available placeholders</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="transition-transform" style={{ transform: showPlaceholders ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {showPlaceholders && (
                  <div className="mt-2 space-y-1.5">
                    {PLACEHOLDERS.map(p => (
                      <div key={p.token} className="flex items-center gap-2">
                        <code className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-primary)' }}>
                          {p.token}
                        </code>
                        <span className="text-[10px] t3">{p.desc}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview assembled prompt */}
              <div className="py-2.5">
                <button
                  onClick={() => setShowPreview(v => !v)}
                  className="flex items-center justify-between w-full text-[11px] t3 hover:t2 transition-colors"
                >
                  <span>Preview assembled prompt</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="transition-transform" style={{ transform: showPreview ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {showPreview && (
                  <pre
                    className="mt-2 text-[10px] leading-relaxed rounded-lg p-3 whitespace-pre-wrap"
                    style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-2)', border: '1px solid var(--color-border)' }}
                  >
{`You are an outbound calling agent.
Tone: ${TONES.find(t => t.value === tone)?.label ?? tone} — ${TONES.find(t => t.value === tone)?.desc ?? ''}
Goal: ${goal || '[not set]'}

Opening: "${opening || '[not set]'}"

If no answer, leave this voicemail:
"${vmScript || '[not set]'}"`}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-5 space-y-4"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Hours Modal */}
            {modal === 'hours' && (
              <>
                <h3 className="text-sm font-semibold t1">Business Hours</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-widest t3 block mb-1">Weekday hours</label>
                    <input
                      value={weekday}
                      onChange={e => setWeekday(e.target.value)}
                      placeholder="e.g. Mon–Fri 9am–5pm"
                      className="w-full rounded-xl px-3 py-2 text-[12px] outline-none"
                      style={{ backgroundColor: 'var(--color-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-1)' }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-widest t3 block mb-1">Weekend hours</label>
                    <input
                      value={weekend}
                      onChange={e => setWeekend(e.target.value)}
                      placeholder="e.g. Sat 10am–3pm, Sun closed"
                      className="w-full rounded-xl px-3 py-2 text-[12px] outline-none"
                      style={{ backgroundColor: 'var(--color-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-1)' }}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest t3 mb-2">When closed, your agent should:</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {AFTER_HOURS_OPTIONS.map(opt => {
                      const active = afterHours === opt.value
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setAfterHours(opt.value)}
                          className="rounded-xl px-2 py-2 text-[11px] font-medium text-left border transition-all"
                          style={
                            active
                              ? { backgroundColor: 'var(--color-accent-tint)', borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }
                              : { backgroundColor: 'var(--color-hover)', borderColor: 'var(--color-border)', color: 'var(--color-text-2)' }
                          }
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <button
                  onClick={() => void saveHours()}
                  disabled={saving || !clientId}
                  className="w-full py-2.5 rounded-xl text-[12px] font-semibold disabled:opacity-40 transition-opacity"
                  style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
                >
                  {saving ? 'Saving…' : 'Save hours'}
                </button>
              </>
            )}

            {/* Transfer Modal */}
            {modal === 'transfer' && (
              <>
                <h3 className="text-sm font-semibold t1">Live Transfer Settings</h3>
                {!fwdNum && (
                  <div
                    className="flex items-start gap-2 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5" style={{ color: '#ef4444' }}>
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <p className="text-[11px]" style={{ color: '#ef4444' }}>No forwarding number set. Transfers will be unavailable.</p>
                  </div>
                )}
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-widest t3 block mb-1">Forwarding number</label>
                    <input
                      value={fwdNum}
                      onChange={e => setFwdNum(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full rounded-xl px-3 py-2 text-[12px] outline-none font-mono"
                      style={{ backgroundColor: 'var(--color-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-1)' }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-widest t3 block mb-1">Transfer conditions</label>
                    <textarea
                      value={transferConds}
                      onChange={e => setTransferConds(e.target.value)}
                      rows={3}
                      placeholder="e.g. Transfer when caller asks to speak with someone or requests a quote."
                      className="w-full rounded-xl px-3 py-2.5 text-[12px] resize-none outline-none"
                      style={{ backgroundColor: 'var(--color-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-1)' }}
                    />
                  </div>
                </div>
                <button
                  onClick={() => void saveTransfer()}
                  disabled={saving || !clientId}
                  className="w-full py-2.5 rounded-xl text-[12px] font-semibold disabled:opacity-40 transition-opacity"
                  style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
                >
                  {saving ? 'Saving…' : 'Save Transfer Settings'}
                </button>
              </>
            )}

            {/* Voicemail Modal */}
            {modal === 'voicemail' && (
              <>
                <h3 className="text-sm font-semibold t1">Voicemail Greeting</h3>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest t3 block mb-1">Greeting text</label>
                  <textarea
                    value={vmText}
                    onChange={e => setVmText(e.target.value)}
                    rows={4}
                    placeholder="Hi, you've reached us. Please leave a message and we'll get back to you shortly."
                    className="w-full rounded-xl px-3 py-2.5 text-[12px] resize-none outline-none"
                    style={{ backgroundColor: 'var(--color-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-1)' }}
                  />
                </div>
                <button
                  onClick={() => void saveVoicemail()}
                  disabled={saving || !clientId}
                  className="w-full py-2.5 rounded-xl text-[12px] font-semibold disabled:opacity-40 transition-opacity"
                  style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
                >
                  {saving ? 'Saving…' : 'Save Greeting'}
                </button>
              </>
            )}

            {/* IVR Modal */}
            {modal === 'ivr' && (
              <>
                <h3 className="text-sm font-semibold t1">IVR / Pre-call Menu</h3>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium t1">Enable pre-call menu</span>
                  <button
                    onClick={() => setIvrOn(v => !v)}
                    className="relative inline-flex items-center h-5 w-9 rounded-full transition-colors"
                    style={{ backgroundColor: ivrOn ? 'var(--color-primary)' : 'var(--color-hover)', border: '1px solid var(--color-border)' }}
                  >
                    <span
                      className="inline-block w-3.5 h-3.5 rounded-full bg-white shadow transition-transform"
                      style={{ transform: ivrOn ? 'translateX(18px)' : 'translateX(2px)' }}
                    />
                  </button>
                </div>
                {ivrOn && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-widest t3 block mb-1">Menu prompt</label>
                    <textarea
                      value={ivrText}
                      onChange={e => setIvrText(e.target.value)}
                      rows={3}
                      placeholder="e.g. Press 1 for existing customers. Press 2 for new inquiries."
                      className="w-full rounded-xl px-3 py-2.5 text-[12px] resize-none outline-none"
                      style={{ backgroundColor: 'var(--color-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-1)' }}
                    />
                  </div>
                )}
                <button
                  onClick={() => void saveIvr()}
                  disabled={saving || !clientId}
                  className="w-full py-2.5 rounded-xl text-[12px] font-semibold disabled:opacity-40 transition-opacity"
                  style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
