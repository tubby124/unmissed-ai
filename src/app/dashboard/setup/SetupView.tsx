'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { SetupClientConfig } from './page'

// ── Mobile carrier data ───────────────────────────────────────────────────────

const CARRIERS = [
  // Big 3
  { id: 'rogers',       name: 'Rogers' },
  { id: 'bell',         name: 'Bell' },
  { id: 'telus',        name: 'Telus' },
  // Sub-brands
  { id: 'chatr',        name: 'Chatr (Rogers network)' },
  { id: 'fido',         name: 'Fido (Rogers network)' },
  { id: 'freedom',      name: 'Freedom Mobile' },
  { id: 'koodo',        name: 'Koodo (Telus network)' },
  { id: 'lucky-mobile', name: 'Lucky Mobile (Bell network)' },
  { id: 'pc-mobile',    name: 'PC Mobile (Bell network)' },
  { id: 'public-mobile',name: 'Public Mobile (Telus network)' },
  { id: 'videotron',    name: 'Videotron' },
  { id: 'virgin-plus',  name: 'Virgin Plus (Bell network)' },
  { id: 'other',        name: 'Other / Unlisted' },
]

const CARRIER_NOTES: Record<string, string[]> = {
  'rogers':        ['Conditional forwarding won\'t work if voicemail is active on your plan. Disable voicemail first if needed.'],
  'fido':          ['Conditional forwarding is not available when Voice Messaging is active on your account.', 'To disable forwarding: use ##61#, ##62#, ##67# (double hash) instead of the single-hash codes below.'],
  'koodo':         ['Call Forwarding requires adding the add-on first (~$3–5/month). Do this in the My Koodo app before dialing these codes.', 'Prepaid accounts: only the Unreachable (*62*) forward is available.'],
  'public-mobile': ['Call forwarding is free on all Public Mobile plans — no add-on needed.', 'You must be on the Public Mobile network in Canada when setting this up.'],
  'other':         ['These are standard GSM codes used by most Canadian and international carriers. If the codes don\'t work, contact your carrier to enable conditional call forwarding on your account.'],
}

// Fido/Chatr use double-hash for disable codes
const FIDO_DISABLE = new Set(['fido', 'chatr'])

// ── Landline carrier data ─────────────────────────────────────────────────────

const LANDLINE_CARRIERS = [
  { id: 'rogers-business', name: 'Rogers Business / Shaw Business' },
  { id: 'bell-business',   name: 'Bell Business' },
  { id: 'sasktel',         name: 'SaskTel (IBC)' },
  { id: 'telus-wireline',  name: 'Telus Business (wireline)' },
  { id: 'cogeco',          name: 'Cogeco Business' },
  { id: 'other-landline',  name: 'Other Landline' },
]

type LandlineCodes = {
  noAnswerOn: string | null
  noAnswerOff: string | null
  busyOn: string | null
  busyOff: string | null
  unconditionalOn: string | null
  unconditionalOff: string | null
  process: string
}

const LANDLINE_CODES: Record<string, LandlineCodes> = {
  'rogers-business': {
    noAnswerOn: '*92', noAnswerOff: '*93',
    busyOn: '*90', busyOff: '*91',
    unconditionalOn: '*72', unconditionalOff: '*73',
    process: 'Pick up the receiver → dial the code followed by the 10-digit destination number → wait for the stutter/confirmation tone → hang up.',
  },
  'bell-business': {
    noAnswerOn: '*92', noAnswerOff: '*93',
    busyOn: '*90', busyOff: '*91',
    unconditionalOn: '*72', unconditionalOff: '*73',
    process: 'Pick up the receiver → dial the code followed by the 10-digit destination number → wait for the stutter/confirmation tone → hang up.',
  },
  'sasktel': {
    noAnswerOn: '*92', noAnswerOff: '*93',
    busyOn: '*90', busyOff: '*91',
    unconditionalOn: '*72', unconditionalOff: '*73',
    process: 'Pick up the receiver → dial the code followed by the 10-digit destination number → wait for the confirmation announcement → hang up.',
  },
  'telus-wireline': {
    noAnswerOn: '*72', noAnswerOff: '*73',
    busyOn: null, busyOff: null,
    unconditionalOn: '*72', unconditionalOff: '*73',
    process: 'Dial *72 followed by the 10-digit destination number → the destination phone will ring → answer it to confirm activation. If it doesn\'t ring, try #72 instead.',
  },
  'cogeco': {
    noAnswerOn: '*72', noAnswerOff: '*73',
    busyOn: null, busyOff: null,
    unconditionalOn: '*72', unconditionalOff: '*73',
    process: 'Pick up the receiver → dial the code followed by the 10-digit destination number → wait for the stutter/confirmation tone → hang up.',
  },
  'other-landline': {
    noAnswerOn: '*72', noAnswerOff: '*73',
    busyOn: null, busyOff: null,
    unconditionalOn: '*72', unconditionalOff: '*73',
    process: 'Pick up the receiver → dial the code followed by the 10-digit destination number → wait for the stutter/confirmation tone → hang up.',
  },
}

const LANDLINE_NOTES: Record<string, string[]> = {
  'rogers-business': [
    'Call waiting is disabled while Call Forward is active on your line.',
    'If your plan uses Multi-line Hunting, manage forwarding only from the primary line.',
    'Forwarding works to Canadian and US numbers only.',
  ],
  'bell-business': [
    'Forwarding works to Canadian and US numbers only.',
    'Contact Bell Business at 1-800-667-0123 if the star codes don\'t activate on your line.',
  ],
  'sasktel': [
    'Optional: set ring count before forwarding — dial *92N [number] where N = rings (0–9). Example: *923 3065551234 = forward after 3 rings.',
    'You can also manage forwarding via the SaskTel IBC web portal.',
  ],
  'telus-wireline': [
    'Important: after dialing *72, the destination phone must physically ring and be answered to confirm activation.',
    'If the destination phone doesn\'t answer, call back and try again, or use Option B (call Telus support) below.',
    'If *72 doesn\'t work, try #72 — Telus uses both codes depending on the line type.',
  ],
  'cogeco': [
    'Contact Cogeco Business at 1-855-812-4484 if the codes don\'t work on your plan.',
    'Some Cogeco business plans require the Call Forwarding feature to be added first.',
  ],
  'other-landline': [
    'These are standard NANP star codes used by most North American landline carriers.',
    'If the codes don\'t work, contact your carrier\'s business support and ask to enable "Call Forward No Answer" to an external number.',
  ],
}

// ── VoIP platform data ────────────────────────────────────────────────────────

const VOIP_PLATFORMS = [
  { id: 'ringcentral',    name: 'RingCentral' },
  { id: 'ooma',          name: 'Ooma Office' },
  { id: 'grasshopper',   name: 'Grasshopper' },
  { id: '8x8',           name: '8x8 Work / Express' },
  { id: 'vonage',        name: 'Vonage Business' },
  { id: 'telus-connect', name: 'Telus Business Connect' },
  { id: 'other-voip',    name: 'Other VoIP System' },
]

const VOIP_INSTRUCTIONS: Record<string, { steps: string[]; note?: string }> = {
  'ringcentral': {
    steps: [
      'Log in to your RingCentral Admin Portal',
      'Go to Settings → Phone → Call Handling & Forwarding',
      'Under "When not answered", select Forward to external number',
      'Enter your AI agent number and save',
    ],
  },
  'ooma': {
    steps: [
      'Log in to Ooma Office Manager',
      'Go to Extensions → select your extension → Call Routing',
      'Under "No Answer", select Forward to external number',
      'Enter your AI agent number and save',
    ],
  },
  'grasshopper': {
    steps: [
      'Log in to your Grasshopper dashboard',
      'Go to Extensions → select your extension → Call Forwarding',
      'Under "No Answer", add your AI agent number as a forwarding destination',
      'Save changes',
    ],
  },
  '8x8': {
    steps: [
      'Log in to 8x8 Admin Console',
      'Go to Users → select the user → Call Forwarding Rules',
      'Set "No Answer Forwarding" to forward to your AI agent number',
      'Save and apply',
    ],
  },
  'vonage': {
    steps: [
      'Log in to the Vonage Business Admin Portal',
      'Go to Extensions → select your extension → Call Settings',
      'Find "Call Forwarding on No Answer" and enter your AI agent number',
      'Save changes',
    ],
  },
  'telus-connect': {
    steps: [
      'Log in to the Telus Business Connect Admin portal',
      'Go to Extensions → select your extension → Inbound Rules',
      'Under "No Answer", select Forward to External and enter your AI agent number',
      'Save and apply',
    ],
  },
  'other-voip': {
    steps: [
      'Log in to your VoIP system\'s admin portal',
      'Look for: Call Forwarding, Call Routing, or Call Handling settings',
      'Find the "No Answer" or "Unanswered" option and set it to forward to an external number',
      'Enter your AI agent number — any 10-digit North American number is supported',
    ],
    note: 'Can\'t find the setting? Contact your VoIP provider\'s support and ask to "forward unanswered calls to an external number."',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripToDigits(num: string | null): string {
  if (!num) return ''
  const digits = num.replace(/\D/g, '')
  return digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits
}

function fmtPhone(num: string | null): string {
  if (!num) return '—'
  const d = num.replace(/\D/g, '')
  if (d.length === 11 && d[0] === '1') {
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  }
  if (d.length === 10) {
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  }
  return num
}

// ── UI primitives ─────────────────────────────────────────────────────────────

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }}
      aria-label={label ? `Copy ${label}` : 'Copy to clipboard'}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 shrink-0 cursor-pointer ${
        copied
          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
          : 't3 b-theme hover:t1 hover:b-theme hover:bg-hover'
      }`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="copied"
            className="flex items-center gap-1.5"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {label ? 'Copied!' : 'Copied'}
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            className="flex items-center gap-1.5"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            {label ?? 'Copy'}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}

function CodeRow({ label, code }: { label: string; code: string }) {
  return (
    <motion.div
      className="flex items-center gap-3 py-2.5 border-b b-theme last:border-0"
      whileHover={{ scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      <span className="text-xs t3 w-48 shrink-0">{label}</span>
      <span className="flex-1 font-mono text-sm t1">{code}</span>
      <CopyButton value={code} />
    </motion.div>
  )
}

function SectionLabel({ num, label }: { num: string; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-6 h-6 rounded-md bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
        <span className="text-[9px] font-black font-mono text-blue-400 tracking-wider">{num}</span>
      </div>
      <span className="text-xs font-semibold t2 uppercase tracking-[0.1em]">{label}</span>
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, var(--color-border), transparent)' }} />
    </div>
  )
}

function InlineNotes({ notes }: { notes: string[] }) {
  if (!notes.length) return null
  return (
    <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] px-4 py-3 space-y-2">
      {notes.map((note, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <svg className="text-amber-500/60 shrink-0 mt-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p className="text-[11px] text-amber-700 dark:text-amber-200/60 leading-relaxed">{note}</p>
        </div>
      ))}
    </div>
  )
}

function ActiveBadge() {
  return (
    <div className="flex items-center justify-center gap-3 py-4 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/20">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
      </span>
      <span className="text-emerald-400 font-semibold text-sm">Agent Active — Forwarding is On</span>
    </div>
  )
}

function MarkActiveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3.5 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/20 text-emerald-400 font-semibold text-sm hover:bg-emerald-500/[0.12] hover:border-emerald-500/35 transition-all duration-150 cursor-pointer flex items-center justify-center gap-2"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Done dialing — Mark Agent Active
    </button>
  )
}

function ConfirmActivation({ onConfirmed }: { onConfirmed: () => void }) {
  const [step, setStep] = useState<'idle' | 'confirm'>('idle')
  const CheckIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (step === 'idle') {
    return (
      <button
        onClick={() => setStep('confirm')}
        className="w-full py-3.5 rounded-xl bg-input border b-theme t2 font-semibold text-sm hover:bg-hover hover:t1 transition-all duration-150 cursor-pointer flex items-center justify-center gap-2"
      >
        {CheckIcon}
        I&apos;ve dialed all the codes
      </button>
    )
  }
  return (
    <div className="space-y-3">
      <p className="text-[11px] t3 text-center">
        Call your business number from another phone. If your AI agent answers, forwarding is live.
      </p>
      <button
        onClick={onConfirmed}
        className="w-full py-3.5 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/20 text-emerald-400 font-semibold text-sm hover:bg-emerald-500/[0.12] hover:border-emerald-500/35 transition-all duration-150 cursor-pointer flex items-center justify-center gap-2"
      >
        {CheckIcon}
        Yes, it worked — agent is live
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface SetupViewProps {
  clients: SetupClientConfig[]
  isAdmin: boolean
}

export default function SetupView({ clients, isAdmin }: SetupViewProps) {
  const [selectedId, setSelectedId] = useState(clients[0]?.id ?? '')
  const [lineType, setLineType] = useState<'mobile' | 'landline' | 'voip'>('mobile')
  const [carrier, setCarrier] = useState('')
  const [device, setDevice] = useState<'iphone' | 'android'>('iphone')
  const [landlineCarrier, setLandlineCarrier] = useState('')
  const [voipPlatform, setVoipPlatform] = useState('')
  const [telusOption, setTelusOption] = useState<'A' | 'B'>('A')
  const [isActive, setIsActive] = useState(false)
  const [step, setStep] = useState(1)
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set())

  // Restore last-used selections from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('unmissed-setup-v1')
    if (!saved) return
    try {
      const { lt, d, c } = JSON.parse(saved) as { lt?: string; d?: string; c?: string }
      if (lt === 'mobile' || lt === 'landline' || lt === 'voip') setLineType(lt)
      if (d === 'iphone' || d === 'android') setDevice(d)
      if (c) setCarrier(c)
    } catch { /* ignore corrupt data */ }
  }, [])

  const client = clients.find(c => c.id === selectedId) ?? clients[0]
  if (!client) return null

  const rawNumber = stripToDigits(client.twilio_number)
  const displayNumber = fmtPhone(client.twilio_number)

  const carrierNotes = carrier ? (CARRIER_NOTES[carrier] ?? []) : []
  const useDoubleHash = FIDO_DISABLE.has(carrier)
  const disablePrefix = useDoubleHash ? '##' : '#'

  const landlineCodes = landlineCarrier ? LANDLINE_CODES[landlineCarrier] : null
  const landlineNotes = landlineCarrier ? (LANDLINE_NOTES[landlineCarrier] ?? []) : []
  const isTelus = landlineCarrier === 'telus-wireline'

  const voipInstructions = voipPlatform ? VOIP_INSTRUCTIONS[voipPlatform] : null

  function toggleStep(i: number) {
    setCheckedSteps(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const showMobileCodes = lineType === 'mobile' && !!carrier && !!rawNumber
  const showLandlineCodes = lineType === 'landline' && !!landlineCarrier && !!rawNumber && !!landlineCodes
  const showVoipCodes = lineType === 'voip' && !!voipPlatform && !!voipInstructions

  const PhoneIcon = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="12" y1="18" x2="12.01" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
  const DeskPhoneIcon = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  const CloudIcon = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )

  const lineTypeTabs = [
    { id: 'mobile'   as const, label: 'Mobile',   icon: PhoneIcon     },
    { id: 'landline' as const, label: 'Landline',  icon: DeskPhoneIcon },
    { id: 'voip'     as const, label: 'VoIP',      icon: CloudIcon     },
  ]

  // Terminal-style star code card
  function StarCard({ stepNum, label, desc, code, icon }: {
    stepNum: string; label: string; desc: string; code: string; icon: React.ReactNode
  }) {
    return (
      <div className="group relative overflow-hidden rounded-2xl border b-theme bg-input transition-all duration-200 hover:border-blue-500/20 hover:shadow-[0_0_24px_rgba(59,130,246,0.06)]">
        {/* Header bar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b b-theme bg-surface">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center shrink-0 text-blue-400">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">{label}</p>
            <p className="text-[11px] t3 mt-0.5">{desc}</p>
          </div>
          <span className="text-[9px] font-black font-mono t1 tracking-[0.2em] shrink-0">{stepNum}</span>
        </div>
        {/* Code block */}
        <div className="px-5 py-5 flex items-center gap-3">
          <div className="flex-1 font-mono text-2xl font-bold text-white tracking-wider text-center py-3.5 rounded-xl bg-black/80 border b-theme group-hover:border-blue-500/[0.08] transition-colors">
            {code}
          </div>
          <CopyButton value={code} />
        </div>
        <p className="pb-4 text-[10px] t1 text-center">Dial this code, then press the green Call button</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-5 py-8 space-y-8">

      {/* ── 3-step wizard progress indicator ───────────────────────── */}
      <div className="flex items-center gap-2">
        {[
          { num: 1, label: 'Phone Setup' },
          { num: 2, label: 'Agent' },
          { num: 3, label: 'Context' },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center gap-2 flex-1">
            <button
              onClick={() => setStep(s.num)}
              className="flex items-center gap-2 group"
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                step === s.num
                  ? 'bg-blue-500 text-white'
                  : step > s.num
                  ? 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30'
                  : 'border text-[var(--color-text-3)]'
              }`} style={step <= s.num ? { borderColor: 'var(--color-border)' } : undefined}>
                {step > s.num ? '✓' : s.num}
              </div>
              <span className={`text-[11px] font-medium hidden sm:block transition-colors ${
                step === s.num ? 'text-blue-400' : ''
              }`} style={step !== s.num ? { color: 'var(--color-text-3)' } : undefined}>
                {s.label}
              </span>
            </button>
            {i < 2 && <div className="flex-1 h-px mx-1" style={{ backgroundColor: 'var(--color-border)' }} />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Phone Setup ──────────────────────────────────────── */}
      {step === 1 && <>

      {/* ── Setup complete banner ────────────────────────────────────── */}
      {client.setup_complete && (
        <div className="flex items-center gap-3 py-4 px-5 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/20">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
          </span>
          <div>
            <p className="text-emerald-400 font-semibold text-sm">Forwarding active — agent is live</p>
            <p className="text-[11px] t3 mt-0.5">You can update your forwarding codes below if needed.</p>
          </div>
        </div>
      )}

      {/* ── Admin client selector ────────────────────────────────────── */}
      {isAdmin && clients.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {clients.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                selectedId === c.id
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  : 't3 b-theme hover:t1 hover:bg-hover'
              }`}
            >
              {c.business_name}
            </button>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          01 — Agent Number
      ═══════════════════════════════════════════════════════════════ */}
      <div>
        <SectionLabel num="01" label="Your AI Agent Number" />

        <div className="relative overflow-hidden rounded-2xl border b-theme bg-input">
          {/* Radial glow from top center */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,rgba(59,130,246,0.08),transparent_70%)] pointer-events-none" />

          <div className="relative text-center px-8 pt-8 pb-6 space-y-4">
            <p className="text-[10px] uppercase tracking-[0.2em] t3 font-semibold">
              Forward calls to this number
            </p>

            {rawNumber ? (
              <>
                <p className="font-mono font-bold text-[2.75rem] sm:text-5xl text-white tracking-tight tabular-nums leading-none">
                  {displayNumber}
                </p>
                <div className="flex justify-center pt-1">
                  <CopyButton value={rawNumber} label="Copy Number" />
                </div>
                <p className="text-[11px] t3">
                  Copy this before dialing the codes below — you&apos;ll need it
                </p>
              </>
            ) : (
              <p className="text-3xl font-mono t3 py-2">Not configured yet</p>
            )}
          </div>

          <div className="px-6 py-4 border-t b-theme space-y-2.5">
            {[
              'Copy the number above',
              'Select your phone type below',
              'Pick your carrier or provider',
              'Dial the 3 forwarding codes',
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <span className="text-[8px] font-black font-mono text-blue-400">{i + 1}</span>
                </div>
                <p className="text-xs t3">{s}</p>
              </div>
            ))}
            <p className="text-[11px] t3 pt-1">Your phone rings first — AI answers only when you&apos;re unavailable.</p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          02 — Phone Type
      ═══════════════════════════════════════════════════════════════ */}
      <div>
        <SectionLabel num="02" label="Your Business Phone Type" />

        <div className="flex gap-1.5 p-1.5 bg-input border b-theme rounded-xl">
          {lineTypeTabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setLineType(t.id); setIsActive(false); localStorage.setItem('unmissed-setup-v1', JSON.stringify({ lt: t.id, d: device, c: carrier })) }}
              className={`flex flex-1 items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer ${
                lineType === t.id
                  ? 'bg-blue-500/15 text-blue-300 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.22)]'
                  : 't3 hover:t1 hover:bg-hover'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          03 — Activate Forwarding
      ═══════════════════════════════════════════════════════════════ */}
      <div>
        <SectionLabel num="03" label="Activate Forwarding" />

        {/* ── MOBILE ────────────────────────────────────────────────── */}
        {lineType === 'mobile' && (
          <motion.div
            className="space-y-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.0 }}
          >

            <div className="grid grid-cols-2 gap-3">
              {/* Device toggle */}
              <div>
                <p className="text-[10px] t3 uppercase tracking-widest font-semibold mb-2">Device</p>
                <div className="flex gap-1 p-1 bg-input border b-theme rounded-xl">
                  {(['iphone', 'android'] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => { setDevice(d); localStorage.setItem('unmissed-setup-v1', JSON.stringify({ lt: lineType, d, c: carrier })) }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                        device === d ? 'bg-hover text-white' : 't3 hover:t1'
                      }`}
                    >
                      {d === 'iphone' ? (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                          <line x1="12" y1="18" x2="12.01" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      ) : (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <rect x="5" y="4" width="14" height="16" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                          <path d="M9 2l1 2h4l1-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      )}
                      {d === 'iphone' ? 'iPhone' : 'Android'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Carrier select */}
              <div>
                <p className="text-[10px] t3 uppercase tracking-widest font-semibold mb-2">Carrier</p>
                <select
                  value={carrier}
                  onChange={e => { setCarrier(e.target.value); setIsActive(false); localStorage.setItem('unmissed-setup-v1', JSON.stringify({ lt: lineType, d: device, c: e.target.value })) }}
                  className="w-full bg-input border b-input rounded-xl px-3 py-[9px] text-xs t1 focus:outline-none focus:border-blue-500/40 transition-colors cursor-pointer"
                >
                  <option value="">Select carrier...</option>
                  <optgroup label="Big Three">
                    <option value="rogers">Rogers</option>
                    <option value="bell">Bell</option>
                    <option value="telus">Telus</option>
                  </optgroup>
                  <optgroup label="Sub-brands &amp; Independents">
                    <option value="chatr">Chatr (Rogers network)</option>
                    <option value="fido">Fido (Rogers network)</option>
                    <option value="freedom">Freedom Mobile</option>
                    <option value="koodo">Koodo (Telus network)</option>
                    <option value="lucky-mobile">Lucky Mobile (Bell network)</option>
                    <option value="pc-mobile">PC Mobile (Bell network)</option>
                    <option value="public-mobile">Public Mobile (Telus network)</option>
                    <option value="videotron">Videotron</option>
                    <option value="virgin-plus">Virgin Plus (Bell network)</option>
                  </optgroup>
                  <optgroup label="">
                    <option value="other">Other / Unlisted</option>
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Device instructions */}
            {carrier && (
              device === 'iphone' ? (
                <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] px-4 py-3 flex items-start gap-2.5">
                  <svg className="text-amber-500/60 shrink-0 mt-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5"/>
                    <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <p className="text-[11px] text-amber-700 dark:text-amber-200/60 leading-relaxed">
                    Open your <span className="font-medium">Phone app</span> → tap the keypad → dial each code and press the green Call button. Do <span className="font-medium">not</span> use Settings → Phone → Call Forwarding — those toggles don&apos;t support star codes.
                  </p>
                </div>
              ) : (
                <div className="bg-input border b-theme rounded-xl px-4 py-3">
                  <p className="text-[11px] t3 leading-relaxed">
                    Open <span className="t2 font-medium">Phone app</span> → dial the code and press Call.
                    Or: Phone → More (⋮) → Settings → Supplementary Services → Call Forwarding.
                  </p>
                </div>
              )
            )}

            {carrier && carrierNotes.length > 0 && <InlineNotes notes={carrierNotes} />}

            {/* Video walkthrough placeholder */}
            {carrier && (
              <div className="rounded-xl border border-dashed b-theme bg-hover flex flex-col items-center justify-center gap-2 py-8 cursor-default">
                <svg className="t3" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <polygon points="5 3 19 12 5 21 5 3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
                <p className="text-[11px] t3">Video walkthrough — coming soon</p>
              </div>
            )}

            <AnimatePresence mode="wait">
              {showMobileCodes && (
                <motion.div
                  key={carrier}
                  className="space-y-3"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                >
                  <StarCard
                    stepNum="01"
                    label="No Answer"
                    desc="Forwards when you don't pick up"
                    code={`*61*${rawNumber}#`}
                    icon={
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    }
                  />
                  <StarCard
                    stepNum="02"
                    label="Busy"
                    desc="Forwards when your line is busy"
                    code={`*67*${rawNumber}#`}
                    icon={
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <line x1="8" y1="6" x2="8" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="16" y1="6" x2="16" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    }
                  />
                  <StarCard
                    stepNum="03"
                    label="Unreachable"
                    desc="Forwards when phone is off or has no signal"
                    code={`*62*${rawNumber}#`}
                    icon={
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    }
                  />
                  {isActive ? <ActiveBadge /> : <ConfirmActivation onConfirmed={() => setIsActive(true)} />}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Collapsible panels */}
            {carrier && rawNumber && (
              <div className="space-y-px pt-1">
                <details className="group">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center gap-2 px-1 py-2.5 t3 hover:t2 transition-colors">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5"/>
                        <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      <span className="text-xs font-medium">Send all calls to agent</span>
                      <svg className="ml-auto group-open:rotate-180 transition-transform duration-200" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </summary>
                  <div className="bg-input border border-red-500/15 rounded-xl p-4 mt-1 space-y-2">
                    <p className="text-[11px] text-red-300/60 mb-3">Your phone will not ring. Every caller goes directly to the agent.</p>
                    <CodeRow label="Enable unconditional" code={`*21*${rawNumber}#`} />
                  </div>
                </details>

                <details className="group">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center gap-2 px-1 py-2.5 t3 hover:t2 transition-colors">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M3 3v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-xs font-medium">Turn off forwarding</span>
                      <svg className="ml-auto group-open:rotate-180 transition-transform duration-200" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </summary>
                  <div className="bg-input border b-theme rounded-xl p-4 mt-1 divide-y divide-white/[0.04]">
                    <CodeRow label="Disable no-answer"     code={`${disablePrefix}61#`} />
                    <CodeRow label="Disable busy"          code={`${disablePrefix}67#`} />
                    <CodeRow label="Disable unreachable"   code={`${disablePrefix}62#`} />
                    <CodeRow label="Disable unconditional" code={`${disablePrefix}21#`} />
                    <CodeRow label="Disable ALL at once"   code="##002#" />
                  </div>
                </details>

                <details className="group">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center gap-2 px-1 py-2.5 t3 hover:t2 transition-colors">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      <span className="text-xs font-medium">Check forwarding status</span>
                      <svg className="ml-auto group-open:rotate-180 transition-transform duration-200" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </summary>
                  <div className="bg-input border b-theme rounded-xl p-4 mt-1 divide-y divide-white/[0.04]">
                    <CodeRow label="Check no-answer status"   code="*#61#" />
                    <CodeRow label="Check unreachable status" code="*#62#" />
                    <CodeRow label="Check busy status"        code="*#67#" />
                    <p className="pt-3 text-[11px] t3">Dial the code and press Call. Your carrier displays a message confirming whether forwarding is active.</p>
                  </div>
                </details>
              </div>
            )}

            {!carrier && (
              <div className="text-center py-12 t3 text-sm">
                Select your carrier above to see the forwarding codes.
              </div>
            )}

            <p className="text-[11px] t3 text-center pb-2">
              Standard 3GPP GSM codes — work on all Canadian carriers. Set once, stays active permanently.
            </p>
          </motion.div>
        )}

        {/* ── LANDLINE ──────────────────────────────────────────────── */}
        {lineType === 'landline' && (
          <motion.div
            className="space-y-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.06 }}
          >

            <div>
              <p className="text-[10px] t3 uppercase tracking-widest font-semibold mb-2">Landline Provider</p>
              <select
                value={landlineCarrier}
                onChange={e => { setLandlineCarrier(e.target.value); setIsActive(false) }}
                className="w-full bg-input border b-input rounded-xl px-3 py-2.5 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors cursor-pointer"
              >
                <option value="">Select your provider...</option>
                <optgroup label="Saskatchewan">
                  <option value="sasktel">SaskTel (IBC)</option>
                </optgroup>
                <optgroup label="National Carriers">
                  <option value="rogers-business">Rogers Business / Shaw Business</option>
                  <option value="bell-business">Bell Business</option>
                  <option value="telus-wireline">Telus Business (wireline)</option>
                  <option value="cogeco">Cogeco Business</option>
                </optgroup>
                <optgroup label="">
                  <option value="other-landline">Other Landline</option>
                </optgroup>
              </select>
            </div>

            {landlineCarrier && landlineNotes.length > 0 && <InlineNotes notes={landlineNotes} />}

            <AnimatePresence mode="wait">
              {showLandlineCodes && !isTelus && (
                <motion.div
                  key={landlineCarrier}
                  className="space-y-3"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                >
                  <div className="bg-input border b-theme rounded-xl px-4 py-3">
                    <p className="text-[11px] t2 leading-relaxed">{landlineCodes!.process}</p>
                  </div>

                  {landlineCodes!.noAnswerOn && (
                    <StarCard
                      stepNum="01"
                      label="No Answer"
                      desc="Forwards when you don't pick up"
                      code={`${landlineCodes!.noAnswerOn} ${rawNumber}`}
                      icon={
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      }
                    />
                  )}

                  {landlineCodes!.busyOn && (
                    <StarCard
                      stepNum="02"
                      label="Busy"
                      desc="Forwards when your line is busy"
                      code={`${landlineCodes!.busyOn} ${rawNumber}`}
                      icon={
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <line x1="8" y1="6" x2="8" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          <line x1="16" y1="6" x2="16" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      }
                    />
                  )}

                  <p className="text-[10px] t3">No # suffix needed — landline star codes work differently from mobile GSM codes.</p>
                  {isActive ? <ActiveBadge /> : <ConfirmActivation onConfirmed={() => setIsActive(true)} />}
                </motion.div>
              )}
            </AnimatePresence>

            {landlineCarrier === 'telus-wireline' && rawNumber && (
              <div className="space-y-4">
                <div className="flex gap-1 p-1 bg-input border b-theme rounded-xl">
                  {(['A', 'B'] as const).map(opt => (
                    <button
                      key={opt}
                      onClick={() => setTelusOption(opt)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        telusOption === opt ? 'bg-hover text-white' : 't3 hover:t1'
                      }`}
                    >
                      Option {opt} — {opt === 'A' ? 'Star Code (manual)' : 'Call Telus (easier)'}
                    </button>
                  ))}
                </div>

                {telusOption === 'A' && (
                  <div className="space-y-3">
                    <div className="bg-input border b-theme rounded-xl px-4 py-3">
                      <p className="text-[11px] t2 leading-relaxed">
                        Dial from your desk phone. The destination phone will ring —{' '}
                        <span className="text-amber-300 font-medium">you must answer it</span> to confirm activation.
                      </p>
                    </div>
                    <StarCard
                      stepNum="01"
                      label="Activate Call Forwarding"
                      desc="If *72 doesn't work, try #72"
                      code={`*72 ${rawNumber}`}
                      icon={
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      }
                    />
                  </div>
                )}

                {telusOption === 'B' && (
                  <div className="rounded-2xl border b-theme bg-input overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-4 border-b b-theme">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center shrink-0 text-emerald-400">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-white">Call Telus Business Support</p>
                    </div>
                    <div className="px-5 py-4 space-y-4">
                      <p className="text-xs t2 leading-relaxed">
                        Skip the star code entirely. Call Telus Business and they&apos;ll enable it for you — takes about 5 minutes. No answer-to-confirm step required.
                      </p>
                      <div className="bg-black/40 rounded-xl px-4 py-3.5 space-y-2 border b-theme">
                        <p className="text-xs t2"><span className="t3 w-10 inline-block">Call</span> 1-866-771-9666</p>
                        <p className="text-xs t2"><span className="t3 w-10 inline-block">Say</span> &quot;Please enable Call Forward No Answer on my line to {displayNumber}&quot;</p>
                      </div>
                    </div>
                  </div>
                )}

                {isActive ? <ActiveBadge /> : <MarkActiveButton onClick={() => setIsActive(true)} />}
              </div>
            )}

            {landlineCarrier && landlineCodes && (
              <div className="space-y-px pt-1">
                {landlineCodes.unconditionalOn && !isTelus && (
                  <details className="group">
                    <summary className="cursor-pointer list-none">
                      <div className="flex items-center gap-2 px-1 py-2.5 t3 hover:t2 transition-colors">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5"/>
                          <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        <span className="text-xs font-medium">Send all calls to agent</span>
                        <svg className="ml-auto group-open:rotate-180 transition-transform duration-200" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </summary>
                    <div className="bg-input border border-red-500/15 rounded-xl p-4 mt-1 space-y-2">
                      <p className="text-[11px] text-red-300/60 mb-3">Your desk phone will not ring. Every caller goes directly to the agent.</p>
                      <CodeRow label="Enable unconditional" code={`${landlineCodes.unconditionalOn} ${rawNumber}`} />
                    </div>
                  </details>
                )}

                <details className="group">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center gap-2 px-1 py-2.5 t3 hover:t2 transition-colors">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M3 3v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-xs font-medium">Turn off forwarding</span>
                      <svg className="ml-auto group-open:rotate-180 transition-transform duration-200" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </summary>
                  <div className="bg-input border b-theme rounded-xl p-4 mt-1 divide-y divide-white/[0.04]">
                    {landlineCodes.noAnswerOff && <CodeRow label="Disable no-answer forward"     code={landlineCodes.noAnswerOff} />}
                    {landlineCodes.busyOff && <CodeRow label="Disable busy forward"              code={landlineCodes.busyOff} />}
                    {landlineCodes.unconditionalOff && <CodeRow label="Disable unconditional forward" code={landlineCodes.unconditionalOff} />}
                    <p className="pt-3 text-[11px] t3">Pick up the receiver, dial the code, hang up when you hear the confirmation tone.</p>
                  </div>
                </details>
              </div>
            )}

            {!landlineCarrier && (
              <div className="text-center py-12 t3 text-sm">
                Select your landline provider above to see the forwarding codes.
              </div>
            )}

            <p className="text-[11px] t3 text-center pb-2">
              Forwarding stays active until disabled — even after restarts or power outages.
            </p>
          </motion.div>
        )}

        {/* ── VOIP ──────────────────────────────────────────────────── */}
        {lineType === 'voip' && (
          <motion.div
            className="space-y-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.12 }}
          >

            <div className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
              <p className="text-xs t3 leading-relaxed">
                VoIP systems use your admin portal instead of star codes. Works with any 10-digit North American number — no extra cost or delay.
              </p>
            </div>

            <div>
              <p className="text-[10px] t3 uppercase tracking-widest font-semibold mb-2">VoIP Platform</p>
              <select
                value={voipPlatform}
                onChange={e => { setVoipPlatform(e.target.value); setIsActive(false); setCheckedSteps(new Set()) }}
                className="w-full bg-input border b-input rounded-xl px-3 py-2.5 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors cursor-pointer"
              >
                <option value="">Select your platform...</option>
                {VOIP_PLATFORMS.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <AnimatePresence mode="wait">
              {showVoipCodes && voipInstructions && (
                <motion.div
                  key={voipPlatform}
                  className="space-y-4"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-white">
                      {VOIP_PLATFORMS.find(p => p.id === voipPlatform)?.name} — Setup Steps
                    </p>
                    <span className="text-[10px] font-mono t3 tabular-nums">
                      {checkedSteps.size}/{voipInstructions.steps.length}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-0.5 bg-hover rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500/60 transition-all duration-500 rounded-full"
                      style={{ width: `${(checkedSteps.size / voipInstructions.steps.length) * 100}%` }}
                    />
                  </div>

                  <ol className="space-y-2">
                    {voipInstructions.steps.map((step, i) => (
                      <li
                        key={i}
                        onClick={() => toggleStep(i)}
                        className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-150 ${
                          checkedSteps.has(i)
                            ? 'bg-emerald-500/[0.05] border-emerald-500/20'
                            : 'bg-input b-theme hover:b-theme hover:bg-hover'
                        }`}
                      >
                        <span className="text-sm font-black font-mono text-blue-500/30 w-7 shrink-0 mt-0.5 tabular-nums">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <p className={`text-sm leading-relaxed flex-1 transition-colors ${
                          checkedSteps.has(i) ? 't3 line-through decoration-zinc-700' : 't2'
                        }`}>
                          {step}
                        </p>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-all duration-150 ${
                          checkedSteps.has(i)
                            ? 'bg-emerald-500/25 border-emerald-500/40'
                            : 'b-theme'
                        }`}>
                          {checkedSteps.has(i) && (
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="M20 6L9 17l-5-5" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>

                  {rawNumber && (
                    <div className="bg-input border b-theme rounded-xl px-4 py-3 flex items-center gap-3">
                      <span className="text-[11px] t3 shrink-0">Agent number</span>
                      <span className="font-mono text-sm text-white flex-1">{displayNumber}</span>
                      <CopyButton value={rawNumber} />
                    </div>
                  )}

                  {voipInstructions.note && (
                    <div className="flex items-start gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500/60 mt-1.5 shrink-0" />
                      <p className="text-[11px] text-amber-700 dark:text-amber-200/50 leading-relaxed">{voipInstructions.note}</p>
                    </div>
                  )}

                  {isActive ? <ActiveBadge /> : <ConfirmActivation onConfirmed={() => setIsActive(true)} />}
                </motion.div>
              )}
            </AnimatePresence>

            {!voipPlatform && (
              <div className="text-center py-12 t3 text-sm">
                Select your VoIP platform above to see the setup steps.
              </div>
            )}

            <p className="text-[11px] t3 text-center pb-2">
              Once saved in the portal, forwarding stays active permanently. Your business number remains unchanged for outbound calls.
            </p>
          </motion.div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <p className="text-[11px] t3 text-center pb-4">
        Need help? Contact us and we&apos;ll walk you through it.
      </p>

      {/* Step 1 next button */}
      <div className="flex justify-end">
        <button
          onClick={() => setStep(2)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all"
        >
          Next: Agent
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      </> /* end step 1 */}

      {/* ── Step 2: Agent ────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-1)' }}>Agent Personality</h2>
            <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>Choose your agent&apos;s voice and configure how it handles calls.</p>
          </div>
          <a
            href="/dashboard/voices"
            className="flex items-center justify-between px-5 py-4 rounded-2xl border hover:bg-[var(--color-hover)] transition-colors"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-1)' }}>Voice &amp; Personality</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>Select voice, name, and call handling style</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-text-3)' }}>
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
          <div className="flex items-center justify-between pt-2">
            <button onClick={() => setStep(1)} className="text-xs" style={{ color: 'var(--color-text-3)' }}>← Back</button>
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all"
            >
              Next: Context
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Context ──────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-1)' }}>Business Context</h2>
            <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>Configure notifications, integrations, and advanced settings.</p>
          </div>
          <a
            href="/dashboard/settings"
            className="flex items-center justify-between px-5 py-4 rounded-2xl border hover:bg-[var(--color-hover)] transition-colors"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-1)' }}>Notifications &amp; Integrations</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>Telegram alerts, calendar sync, advanced settings</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-text-3)' }}>
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
          <div className="flex items-center justify-between pt-2">
            <button onClick={() => setStep(2)} className="text-xs" style={{ color: 'var(--color-text-3)' }}>← Back</button>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-3)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-green-500">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Setup complete
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
