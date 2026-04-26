'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'

interface Props {
  clientId: string
  isAdmin?: boolean
  // Notifications
  telegramConnected: boolean
  telegramBotUrl?: string | null
  emailEnabled: boolean
  // Call routing
  ivrEnabled: boolean
  ivrPrompt: string | null
  voicemailGreetingText: string | null
  businessName: string | null
  agentName: string | null
  // Post-call
  smsEnabled: boolean
  hasSms: boolean
  smsTemplate: string | null
  // Booking
  bookingEnabled?: boolean
  calendarConnected?: boolean
  // Transfer
  hasTransfer?: boolean
  forwardingNumber?: string | null
  transferConditions?: string | null
  // Call routing
  hasTriage?: boolean
  niche?: string | null
  callerReasons?: string[]
  // Sheet opener
  onOpenNotificationsSheet: () => void
}

type PillId = 'telegram' | 'email' | 'ivr' | 'voicemail' | 'sms' | 'booking' | 'transfer' | 'routing'

const DEFAULT_IVR = (name: string) =>
  `Hi, you've reached ${name}. Press 1 for voicemail, or stay on the line to speak with our AI assistant.`

const DEFAULT_VOICEMAIL = (name: string) =>
  `Hi, you've reached ${name}. We're unavailable right now. Please leave your name and number and we'll get back to you shortly.`

const DEFAULT_SMS = (name: string) =>
  `Hi, this is ${name}! Thanks for calling — here's a quick follow-up with any details we discussed. Feel free to reply with any questions.`

const SMS_CHAR_LIMIT = 320

// ── Icons ────────────────────────────────────────────────────────
function TelegramIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
    </svg>
  )
}

function EmailIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  )
}

function IvrIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/>
    </svg>
  )
}

function VoicemailIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="12" r="4"/><circle cx="18" cy="12" r="4"/><line x1="6" y1="16" x2="18" y2="16"/>
    </svg>
  )
}

function SmsIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  )
}

function BookingIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

function RoutingIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>
    </svg>
  )
}

function TransferIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  )
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 24 24" fill="none"
      style={{ color: 'var(--color-text-3)', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : undefined }}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ── Component ────────────────────────────────────────────────────
export default function QuickConfigStrip({
  clientId,
  isAdmin = false,
  telegramConnected,
  telegramBotUrl,
  emailEnabled,
  ivrEnabled,
  ivrPrompt,
  voicemailGreetingText,
  businessName,
  agentName,
  smsEnabled,
  hasSms,
  smsTemplate,
  bookingEnabled = false,
  calendarConnected = false,
  hasTransfer = false,
  forwardingNumber = null,
  transferConditions = null,
  hasTriage = false,
  niche = null,
  callerReasons: initialCallerReasons,
  onOpenNotificationsSheet,
}: Props) {
  const { patch, saving } = usePatchSettings(clientId, isAdmin)
  const biz = businessName ?? agentName ?? 'the business'
  const name = agentName ?? 'your agent'

  // Local state for toggles
  const [ivr, setIvr] = useState(ivrEnabled)
  const [email, setEmail] = useState(emailEnabled)
  const [smsOn, setSmsOn] = useState(smsEnabled)
  const [booking, setBooking] = useState(bookingEnabled)

  // Transfer editing
  const [fwdNumber, setFwdNumber] = useState(forwardingNumber ?? '')
  const [xferConditions, setXferConditions] = useState(transferConditions ?? '')
  const [transferDirty, setTransferDirty] = useState(false)

  // Call routing
  const NICHE_PH: Record<string, string[]> = {
    auto_glass:          ['Windshield replacement quote', 'Chip repair — same day', 'Insurance claim help'],
    hvac:                ['AC not working', 'Furnace tune-up booking', 'Get a quote'],
    plumbing:            ['Emergency leak', 'Drain cleaning quote', 'Water heater install'],
    dental:              ['New patient booking', 'Toothache / emergency', 'Insurance question'],
    legal:               ['Free consultation', 'Case update check-in', 'New matter intake'],
    salon:               ['Book appointment', 'Pricing / services', 'Cancel or reschedule'],
    real_estate:         ['Buy a home', 'Sell my home', 'Rental inquiry'],
    property_management: ['Maintenance request', 'Pay rent / question', 'Lease inquiry'],
    restaurant:          ['Reserve a table or place an order', 'Menu / hours / location', 'Catering or large order'],
    print_shop:          ['Get a printing quote', 'Check order status', 'Rush job request'],
    barbershop:          ['Book a haircut', 'Walk-in availability', 'Pricing / services'],
    mechanic_shop:       ['Car repair or diagnostic', 'Oil change / maintenance', 'Get a quote'],
    pest_control:        ['Pest problem — need service', 'Get an inspection quote', 'Follow-up on treatment'],
    electrician:         ['Electrical issue or repair', 'New installation quote', 'Inspection or panel upgrade'],
    locksmith:           ['Locked out — need help now', 'Lock replacement or rekey', 'Security upgrade quote'],
    voicemail:           ['Leave a message', 'Pricing question', 'Callback request'],
    other:               ['e.g. Get a quote or book service', 'e.g. Check on existing order', 'e.g. Hours, location, or general info'],
  }
  const routingPh = NICHE_PH[niche ?? ''] ?? NICHE_PH.other
  const [routingReasons, setRoutingReasons] = useState<string[]>(
    initialCallerReasons?.length === 3 ? initialCallerReasons : ['', '', '']
  )
  const [routingGenerating, setRoutingGenerating] = useState(false)
  const [routingSaved, setRoutingSaved] = useState(false)
  const [routingTriageActive, setRoutingTriageActive] = useState(hasTriage)
  const [routingError, setRoutingError] = useState<string | null>(null)

  // Expanded panel
  const [expanded, setExpanded] = useState<PillId | null>(null)

  // IVR prompt editing
  const [ivrText, setIvrText] = useState(ivrPrompt ?? DEFAULT_IVR(biz))
  const [ivrDirty, setIvrDirty] = useState(false)

  // Voicemail editing
  const [vmText, setVmText] = useState(voicemailGreetingText ?? DEFAULT_VOICEMAIL(biz))
  const [vmDirty, setVmDirty] = useState(false)

  // SMS template editing
  const [template, setTemplate] = useState(smsTemplate ?? DEFAULT_SMS(name))
  const [templateDirty, setTemplateDirty] = useState(false)

  // Toggle handlers
  const toggleIvr = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = !ivr
    setIvr(next)
    await patch({ ivr_enabled: next })
  }, [ivr, patch])

  const toggleEmail = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = !email
    setEmail(next)
    await patch({ email_notifications_enabled: next })
  }, [email, patch])

  const toggleSms = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!hasSms) return
    const next = !smsOn
    setSmsOn(next)
    await patch({ sms_enabled: next })
  }, [smsOn, hasSms, patch])

  // Save handlers
  const saveIvrPrompt = useCallback(async () => {
    await patch({ ivr_prompt: ivrText })
    setIvrDirty(false)
  }, [ivrText, patch])

  const saveVoicemail = useCallback(async () => {
    await patch({ voicemail_greeting_text: vmText })
    setVmDirty(false)
  }, [vmText, patch])

  const saveSmsTemplate = useCallback(async () => {
    await patch({ sms_template: template })
    setTemplateDirty(false)
  }, [template, patch])

  const toggleBooking = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = !booking
    setBooking(next)
    await patch({ booking_enabled: next })
  }, [booking, patch])

  const saveTransfer = useCallback(async () => {
    await patch({ forwarding_number: fwdNumber || null, transfer_conditions: xferConditions || null })
    setTransferDirty(false)
  }, [fwdNumber, xferConditions, patch])

  const generateRouting = useCallback(async () => {
    const filled = routingReasons.map(r => r.trim()).filter(Boolean)
    if (filled.length === 0) { setRoutingError('Add at least one reason'); return }
    setRoutingGenerating(true)
    setRoutingError(null)
    try {
      const res = await fetch('/api/onboard/infer-niche', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName: biz, knownNiche: niche, callerReasons: filled }),
      })
      if (!res.ok) throw new Error('Inference failed')
      const json = await res.json() as { customVariables?: Record<string, string> }
      const triage = json.customVariables?.TRIAGE_DEEP
      if (!triage) throw new Error('No routing generated')
      await patch({ niche_custom_variables: { TRIAGE_DEEP: triage, _caller_reasons: JSON.stringify(filled) } })
      await patch({ section_id: 'triage', section_content: triage })
      setRoutingTriageActive(true)
      setRoutingSaved(true)
      setTimeout(() => setRoutingSaved(false), 4000)
    } catch (err) {
      setRoutingError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setRoutingGenerating(false)
    }
  }, [routingReasons, biz, niche, patch])

  // Pill definitions
  const pills: {
    id: PillId
    icon: React.ReactNode
    label: string
    active: boolean
    statusText: string
    hasExpand: boolean
    onPillClick?: (e: React.MouseEvent) => void
  }[] = [
    {
      id: 'telegram',
      icon: <TelegramIcon />,
      label: 'Telegram',
      active: telegramConnected,
      statusText: telegramConnected ? 'Connected' : 'Set up',
      hasExpand: false,
      onPillClick: async () => {
        if (telegramConnected && telegramBotUrl) {
          window.open(telegramBotUrl, '_blank', 'noopener')
          return
        }
        // Not connected — fetch the deep link and open Telegram in one tap.
        // No sheet detour. Matches AlertsTab "Open Telegram & Connect" pattern.
        try {
          const res = await fetch('/api/dashboard/telegram-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId }),
          })
          const data = await res.json() as { deepLink?: string }
          if (data.deepLink) {
            window.open(data.deepLink, '_blank', 'noopener')
            return
          }
        } catch {
          // fall through to sheet on failure
        }
        onOpenNotificationsSheet()
      },
    },
    {
      id: 'email',
      icon: <EmailIcon />,
      label: 'Email',
      active: email,
      statusText: email ? 'On' : 'Off',
      hasExpand: false,
      onPillClick: toggleEmail,
    },
    {
      id: 'ivr',
      icon: <IvrIcon />,
      label: 'IVR',
      active: ivr,
      statusText: ivr ? 'On' : 'Off',
      hasExpand: true,
    },
    {
      id: 'voicemail',
      icon: <VoicemailIcon />,
      label: 'Voicemail',
      active: true,
      statusText: voicemailGreetingText ? 'Custom' : 'Default',
      hasExpand: true,
    },
    {
      id: 'sms',
      icon: <SmsIcon />,
      label: 'Auto-text',
      active: smsOn && hasSms,
      statusText: !hasSms ? 'Upgrade' : smsOn ? 'On' : 'Off',
      hasExpand: hasSms,
      onPillClick: !hasSms ? undefined : undefined,
    },
    {
      id: 'booking',
      icon: <BookingIcon />,
      label: 'Booking',
      active: booking && calendarConnected,
      statusText: !booking ? 'Off' : calendarConnected ? 'Connected' : 'Set up',
      hasExpand: true,
    },
    {
      id: 'transfer',
      icon: <TransferIcon />,
      label: 'Transfer',
      active: hasTransfer && !!forwardingNumber,
      statusText: forwardingNumber ? 'Active' : 'Set up',
      hasExpand: true,
    },
    {
      id: 'routing',
      icon: <RoutingIcon />,
      label: 'Routing',
      active: routingTriageActive,
      statusText: routingTriageActive ? 'Active' : 'Set up',
      hasExpand: true,
    },
  ]

  function handlePillClick(pill: typeof pills[number]) {
    if (pill.onPillClick) {
      // Direct action (toggle or link)
      pill.onPillClick({} as React.MouseEvent)
      return
    }
    if (pill.hasExpand) {
      setExpanded(e => e === pill.id ? null : pill.id)
    }
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      {/* ── Pills Row ─────────────────────────────────────────── */}
      <div className="px-3 py-2 flex items-center gap-1 flex-wrap">
        <span className="text-[10px] font-semibold tracking-[0.12em] uppercase t3 mr-1">Config</span>
        {pills.map(pill => {
          const isActive = pill.active
          const isExpanded = expanded === pill.id
          const statusColor = isActive
            ? 'bg-emerald-500/15 text-emerald-400'
            : pill.statusText === 'Set up' || pill.statusText === 'Upgrade'
              ? 'bg-amber-500/15 text-amber-400'
              : 'bg-white/5 t3'

          return (
            <button
              key={pill.id}
              onClick={() => handlePillClick(pill)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors duration-200 cursor-pointer ${
                isExpanded ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
            >
              <span className={isActive ? 'text-emerald-400' : 't3'}>{pill.icon}</span>
              <span className="text-[11px] font-medium t2">{pill.label}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${statusColor}`}>
                {saving ? '...' : pill.statusText}
              </span>
              {pill.hasExpand && <ChevronDown open={isExpanded} />}
            </button>
          )
        })}
      </div>

      {/* ── Expanded Panel ────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {expanded === 'ivr' && (
          <motion.div
            key="ivr"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-medium t1">Pre-call IVR Menu</p>
                  <p className="text-[11px] t3">Callers hear this before connecting to your agent</p>
                </div>
                <button
                  onClick={toggleIvr}
                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer ${
                    ivr ? 'bg-emerald-500' : 'bg-white/10'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                    ivr ? 'left-5' : 'left-0.5'
                  }`} />
                </button>
              </div>
              {ivr && (
                <div className="space-y-2">
                  <textarea
                    value={ivrText}
                    onChange={e => { setIvrText(e.target.value); setIvrDirty(true) }}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg text-[12px] outline-none resize-none focus:ring-2 focus:ring-blue-500/40 transition-colors duration-200"
                    style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-1)' }}
                  />
                  {ivrDirty && (
                    <button
                      onClick={saveIvrPrompt}
                      disabled={!!saving}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-opacity disabled:opacity-50 cursor-pointer"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      {saving ? 'Saving...' : 'Save prompt'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {expanded === 'voicemail' && (
          <motion.div
            key="voicemail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <p className="text-[12px] font-medium t1">Voicemail Greeting</p>
                <p className="text-[11px] t3">Played when callers reach voicemail</p>
              </div>
              <textarea
                value={vmText}
                onChange={e => { setVmText(e.target.value); setVmDirty(true) }}
                rows={2}
                className="w-full px-3 py-2 rounded-lg text-[12px] outline-none resize-none focus:ring-2 focus:ring-blue-500/40 transition-colors duration-200"
                style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-1)' }}
              />
              {vmDirty && (
                <button
                  onClick={saveVoicemail}
                  disabled={!!saving}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-opacity disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {saving ? 'Saving...' : 'Save greeting'}
                </button>
              )}
            </div>
          </motion.div>
        )}

        {expanded === 'sms' && hasSms && (
          <motion.div
            key="sms"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-medium t1">SMS Follow-up Template</p>
                  <p className="text-[11px] t3">Sent automatically after each call</p>
                </div>
                <button
                  onClick={toggleSms}
                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer ${
                    smsOn ? 'bg-emerald-500' : 'bg-white/10'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                    smsOn ? 'left-5' : 'left-0.5'
                  }`} />
                </button>
              </div>
              {smsOn && (
                <div className="space-y-2">
                  <textarea
                    value={template}
                    onChange={e => { setTemplate(e.target.value); setTemplateDirty(true) }}
                    rows={2}
                    maxLength={SMS_CHAR_LIMIT}
                    className="w-full px-3 py-2 rounded-lg text-[12px] outline-none resize-none focus:ring-2 focus:ring-blue-500/40 transition-colors duration-200"
                    style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-1)' }}
                  />
                  <div className="flex items-center justify-between">
                    {templateDirty && (
                      <button
                        onClick={saveSmsTemplate}
                        disabled={!!saving}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-opacity disabled:opacity-50 cursor-pointer"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                      >
                        {saving ? 'Saving...' : 'Save template'}
                      </button>
                    )}
                    <span className="text-[10px] t3 ml-auto">{template.length}/{SMS_CHAR_LIMIT}</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {expanded === 'booking' && (
          <motion.div
            key="booking"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-medium t1">Calendar Booking</p>
                  <p className="text-[11px] t3">Let your agent check availability and book appointments</p>
                </div>
                <button
                  onClick={toggleBooking}
                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer ${
                    booking ? 'bg-emerald-500' : 'bg-white/10'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                    booking ? 'left-5' : 'left-0.5'
                  }`} />
                </button>
              </div>
              {booking && !calendarConnected && (
                <Link
                  href="/dashboard/settings?tab=general#booking"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold transition-colors hover:opacity-90 cursor-pointer"
                  style={{ border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  Connect Google Calendar
                </Link>
              )}
              {booking && calendarConnected && (
                <p className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  Google Calendar connected — your agent can book appointments
                </p>
              )}
            </div>
          </motion.div>
        )}

        {expanded === 'transfer' && (
          <motion.div
            key="transfer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <p className="text-[12px] font-medium t1">Live Transfer</p>
                <p className="text-[11px] t3">Transfer callers to a live person when needed</p>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-medium t2">Forwarding number</label>
                <input
                  type="tel"
                  value={fwdNumber}
                  onChange={e => { setFwdNumber(e.target.value); setTransferDirty(true) }}
                  placeholder="+1 (555) 555-5555"
                  className="w-full px-3 py-2 rounded-lg text-[12px] outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors duration-200"
                  style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-1)' }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-medium t2">Transfer conditions</label>
                <textarea
                  value={xferConditions}
                  onChange={e => { setXferConditions(e.target.value); setTransferDirty(true) }}
                  rows={2}
                  placeholder='e.g. "Transfer when caller asks to speak with someone or mentions an emergency"'
                  className="w-full px-3 py-2 rounded-lg text-[12px] outline-none resize-none focus:ring-2 focus:ring-blue-500/40 transition-colors duration-200"
                  style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-1)' }}
                />
              </div>
              {!fwdNumber && (
                <p className="text-[11px] text-amber-400 flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  No forwarding number set — live transfer is disabled
                </p>
              )}
              {transferDirty && (
                <button
                  onClick={saveTransfer}
                  disabled={!!saving}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-opacity disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {saving ? 'Saving...' : 'Save transfer settings'}
                </button>
              )}
            </div>
          </motion.div>
        )}

        {expanded === 'routing' && (
          <motion.div
            key="routing"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-medium t1">Call Routing</p>
                  <p className="text-[11px] t3">Why do people call you? Your agent routes each caller to the right outcome.</p>
                </div>
                {routingTriageActive && !routingGenerating && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium shrink-0">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    Active
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {routingReasons.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono t3 w-4 shrink-0">{i + 1}.</span>
                    <input
                      type="text"
                      value={r}
                      onChange={e => {
                        const next = [...routingReasons]
                        next[i] = e.target.value
                        setRoutingReasons(next)
                        if (routingTriageActive) setRoutingTriageActive(false)
                      }}
                      placeholder={routingPh[i] ?? `Reason ${i + 1}`}
                      className="flex-1 px-3 py-2 rounded-lg text-[12px] outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors duration-200"
                      style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-1)' }}
                    />
                  </div>
                ))}
              </div>
              {routingError && (
                <p className="text-[11px] text-red-400">{routingError}</p>
              )}
              {routingSaved && (
                <p className="text-[11px] text-emerald-400">Routing saved and deployed to your agent.</p>
              )}
              <div className="flex items-center justify-between">
                <p className="text-[10px] t3">Add at least one reason and click generate to set up call routing.</p>
                <button
                  onClick={generateRouting}
                  disabled={routingGenerating}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-opacity disabled:opacity-50 cursor-pointer shrink-0"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {routingGenerating ? 'Generating...' : routingTriageActive ? 'Update routing' : 'Set up routing'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
