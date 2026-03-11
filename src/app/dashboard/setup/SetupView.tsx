'use client'

import { useState } from 'react'
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
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all shrink-0 cursor-pointer ${
        copied
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
          : 'text-zinc-400 border-white/[0.08] hover:text-zinc-200 hover:border-white/[0.18] hover:bg-white/[0.04]'
      }`}
    >
      {copied ? (
        <>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {label ? 'Copied!' : 'Copied'}
        </>
      ) : (
        <>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          {label ?? 'Copy'}
        </>
      )}
    </button>
  )
}

function CodeRow({ label, code }: { label: string; code: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
      <span className="text-xs text-zinc-500 w-44 shrink-0">{label}</span>
      <span className="flex-1 font-mono text-sm text-zinc-200">{code}</span>
      <CopyButton value={code} />
    </div>
  )
}

function StepHeader({ num, label }: { num: string; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="text-[11px] font-mono font-black tracking-widest text-blue-500/50">{num}</span>
      <span className="text-[11px] text-zinc-500 uppercase tracking-[0.12em] font-semibold">{label}</span>
      <div className="flex-1 h-px bg-gradient-to-r from-white/[0.06] to-transparent" />
    </div>
  )
}

function InlineNotes({ notes }: { notes: string[] }) {
  if (!notes.length) return null
  return (
    <div className="space-y-1.5">
      {notes.map((note, i) => (
        <div key={i} className="flex items-start gap-2">
          <svg className="text-amber-500/60 shrink-0 mt-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p className="text-[11px] text-amber-200/55 leading-relaxed">{note}</p>
        </div>
      ))}
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function ActiveBadge() {
  return (
    <div className="flex items-center justify-center gap-3 py-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      <span className="text-emerald-400 font-semibold text-sm">Agent Active — Calls will forward automatically</span>
    </div>
  )
}

function MarkActiveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3.5 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-400 font-semibold text-sm hover:bg-emerald-500/[0.12] hover:border-emerald-500/30 transition-all cursor-pointer"
    >
      Done dialing → Mark Agent Active
    </button>
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
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set())

  const client = clients.find(c => c.id === selectedId) ?? clients[0]
  if (!client) return null

  const rawNumber = stripToDigits(client.twilio_number)
  const displayNumber = fmtPhone(client.twilio_number)

  // Mobile derived state
  const carrierNotes = carrier ? (CARRIER_NOTES[carrier] ?? []) : []
  const useDoubleHash = FIDO_DISABLE.has(carrier)
  const disablePrefix = useDoubleHash ? '##' : '#'

  // Landline derived state
  const landlineCodes = landlineCarrier ? LANDLINE_CODES[landlineCarrier] : null
  const landlineNotes = landlineCarrier ? (LANDLINE_NOTES[landlineCarrier] ?? []) : []
  const isTelus = landlineCarrier === 'telus-wireline'

  // VoIP derived state
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

  // Icons for line type tabs
  const PhoneIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="12" y1="18" x2="12.01" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
  const DeskPhoneIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  const CloudIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )

  const lineTypeTabs = [
    { id: 'mobile'   as const, label: 'Mobile',   sub: 'Cell Phone',       icon: PhoneIcon     },
    { id: 'landline' as const, label: 'Landline',  sub: 'Desk Phone',       icon: DeskPhoneIcon },
    { id: 'voip'     as const, label: 'VoIP',      sub: 'Business System',  icon: CloudIcon     },
  ]

  // Shared call card for star code scenarios
  function StarCard({ stepNum, label, desc, code, icon }: {
    stepNum: string; label: string; desc: string; code: string; icon: React.ReactNode
  }) {
    return (
      <div className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center shrink-0 text-blue-400">
            {icon}
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] font-black font-mono text-blue-500/40 tracking-widest">{stepNum}</span>
              <p className="text-sm font-semibold text-white">{label}</p>
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">{desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex-1 block font-mono text-xl text-white bg-black/60 border border-white/[0.06] rounded-xl px-4 py-3.5 tracking-wider text-center">
            {code}
          </span>
          <CopyButton value={code} />
        </div>
        <p className="text-[10px] text-zinc-600 text-center">Dial this code, then press the green Call button</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">

      {/* ── Admin client selector ─────────────────────────────────────── */}
      {isAdmin && clients.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {clients.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                selectedId === c.id
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  : 'text-zinc-400 border-white/[0.08] hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              {c.business_name}
            </button>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          01 — Your AI Agent Number
      ═══════════════════════════════════════════════════════════════ */}
      <div>
        <StepHeader num="01" label="Your AI Agent Number" />

        <div className="relative bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent border border-white/[0.08] rounded-2xl p-8 overflow-hidden">
          {/* Background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-blue-500/[0.05] rounded-full blur-3xl pointer-events-none" />

          <div className="relative text-center space-y-3">
            <p className="text-[11px] text-zinc-500 uppercase tracking-[0.15em] font-medium">
              Forward calls to this number
            </p>

            {rawNumber ? (
              <>
                <div className="flex items-center justify-center">
                  <span className="text-4xl sm:text-5xl font-mono font-bold text-white tracking-tight tabular-nums">
                    {displayNumber}
                  </span>
                </div>
                <div className="flex justify-center pt-1">
                  <CopyButton value={rawNumber} label="Copy Number" />
                </div>
                <p className="text-[11px] text-zinc-600 pt-1">
                  Copy this before dialing the codes below — you&apos;ll need it
                </p>
              </>
            ) : (
              <span className="text-3xl font-mono text-zinc-600">Not configured yet</span>
            )}
          </div>

          {/* How it works — minimal inline strip */}
          <div className="mt-6 pt-5 border-t border-white/[0.05] flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
            <p className="text-xs text-zinc-400 leading-relaxed">
              <span className="text-white font-medium">Conditional forwarding</span> — your phone rings first. If you don&apos;t answer, are busy, or are unreachable, the call routes to your AI agent automatically.
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          02 — Phone Type
      ═══════════════════════════════════════════════════════════════ */}
      <div>
        <StepHeader num="02" label="Your Business Phone Type" />

        <div className="grid grid-cols-3 gap-2">
          {lineTypeTabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setLineType(t.id); setIsActive(false) }}
              className={`flex flex-col items-center gap-2 px-3 py-4 rounded-xl border transition-all cursor-pointer ${
                lineType === t.id
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/25 shadow-[0_0_20px_rgba(59,130,246,0.08)]'
                  : 'text-zinc-500 border-white/[0.06] hover:text-zinc-300 hover:border-white/[0.12] hover:bg-white/[0.02]'
              }`}
            >
              {t.icon}
              <div className="text-center">
                <p className="text-xs font-semibold">{t.label}</p>
                <p className="text-[10px] opacity-60 mt-0.5">{t.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          03 — Activate Forwarding
      ═══════════════════════════════════════════════════════════════ */}
      <div>
        <StepHeader num="03" label="Activate Forwarding" />

        {/* ════════════════════════
            MOBILE
        ════════════════════════ */}
        {lineType === 'mobile' && (
          <div className="space-y-5">

            {/* Device + Carrier row */}
            <div className="grid grid-cols-2 gap-3">

              {/* Device toggle */}
              <div>
                <p className="text-[11px] text-zinc-500 uppercase tracking-widest font-semibold mb-2">Device</p>
                <div className="flex gap-1 p-1 bg-black/40 border border-white/[0.06] rounded-xl">
                  {(['iphone', 'android'] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => setDevice(d)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        device === d ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {d === 'iphone' ? (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                          <rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                          <line x1="12" y1="18" x2="12.01" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      ) : (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
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
                <p className="text-[11px] text-zinc-500 uppercase tracking-widest font-semibold mb-2">Carrier</p>
                <select
                  value={carrier}
                  onChange={e => { setCarrier(e.target.value); setIsActive(false) }}
                  className="w-full bg-black/40 border border-white/[0.1] rounded-xl px-3 py-[9px] text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40 transition-colors cursor-pointer"
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

            {/* Device instructions strip */}
            {carrier && (
              <div className="bg-black/20 border border-white/[0.04] rounded-xl px-4 py-3">
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  {device === 'iphone' ? (
                    <>
                      Open your <span className="text-zinc-300 font-medium">Phone app</span> → tap the keypad → dial each code and press the green Call button.{' '}
                      <span className="text-red-400">Do not</span> use Settings → Phone → Call Forwarding.
                    </>
                  ) : (
                    <>
                      Open <span className="text-zinc-300 font-medium">Phone app</span> → dial the code and press Call.
                      Or: Phone → More (⋮) → Settings → Supplementary Services → Call Forwarding.
                    </>
                  )}
                </p>
              </div>
            )}

            {/* Carrier notes */}
            {carrier && carrierNotes.length > 0 && <InlineNotes notes={carrierNotes} />}

            {/* Star code cards */}
            {showMobileCodes && (
              <div className="space-y-3">
                <StarCard
                  stepNum="01"
                  label="No Answer"
                  desc="Forwards when you don't pick up"
                  code={`*61*${rawNumber}#`}
                  icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  }
                />

                {isActive ? <ActiveBadge /> : <MarkActiveButton onClick={() => setIsActive(true)} />}
              </div>
            )}

            {/* Collapsible panels — only when carrier is selected */}
            {carrier && rawNumber && (
              <div className="space-y-1 pt-1">

                {/* Full forwarding */}
                <details className="group">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center gap-2 px-1 py-2 text-zinc-600 hover:text-zinc-400 transition-colors">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5"/>
                        <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      <span className="text-xs font-medium">Full Forwarding — All Calls to Agent</span>
                      <svg className="ml-auto group-open:rotate-180 transition-transform" width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </summary>
                  <div className="bg-black/30 border border-red-500/15 rounded-xl p-4 mt-1 space-y-2">
                    <p className="text-[11px] text-red-300/70 mb-3">Your phone will not ring. Every caller goes directly to the agent.</p>
                    <CodeRow label="Enable unconditional" code={`*21*${rawNumber}#`} />
                  </div>
                </details>

                {/* Rollback */}
                <details className="group">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center gap-2 px-1 py-2 text-zinc-600 hover:text-zinc-400 transition-colors">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M3 3v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-xs font-medium">Rollback — Disable Forwarding</span>
                      <svg className="ml-auto group-open:rotate-180 transition-transform" width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </summary>
                  <div className="bg-black/30 border border-white/[0.05] rounded-xl p-4 mt-1 divide-y divide-white/[0.04]">
                    <CodeRow label="Disable no-answer"     code={`${disablePrefix}61#`} />
                    <CodeRow label="Disable busy"          code={`${disablePrefix}67#`} />
                    <CodeRow label="Disable unreachable"   code={`${disablePrefix}62#`} />
                    <CodeRow label="Disable unconditional" code={`${disablePrefix}21#`} />
                    <CodeRow label="Disable ALL at once"   code="##002#" />
                  </div>
                </details>

                {/* Verify */}
                <details className="group">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center gap-2 px-1 py-2 text-zinc-600 hover:text-zinc-400 transition-colors">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      <span className="text-xs font-medium">Verify It&apos;s Working</span>
                      <svg className="ml-auto group-open:rotate-180 transition-transform" width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </summary>
                  <div className="bg-black/30 border border-white/[0.05] rounded-xl p-4 mt-1 divide-y divide-white/[0.04]">
                    <CodeRow label="Check no-answer status"   code="*#61#" />
                    <CodeRow label="Check unreachable status" code="*#62#" />
                    <CodeRow label="Check busy status"        code="*#67#" />
                    <p className="pt-3 text-[11px] text-zinc-600">Dial the code and press Call. Your carrier displays a message confirming whether forwarding is active.</p>
                  </div>
                </details>
              </div>
            )}

            {/* Empty state */}
            {!carrier && (
              <div className="text-center py-10 text-zinc-600 text-sm">
                Select your carrier above to see the forwarding codes.
              </div>
            )}

            <p className="text-[11px] text-zinc-700 text-center pb-2">
              Standard 3GPP GSM codes — work on all Canadian carriers. Set once, stays active permanently.
            </p>
          </div>
        )}

        {/* ════════════════════════
            LANDLINE
        ════════════════════════ */}
        {lineType === 'landline' && (
          <div className="space-y-5">

            {/* Provider selector */}
            <div>
              <p className="text-[11px] text-zinc-500 uppercase tracking-widest font-semibold mb-2">Landline Provider</p>
              <select
                value={landlineCarrier}
                onChange={e => { setLandlineCarrier(e.target.value); setIsActive(false) }}
                className="w-full bg-black/40 border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/40 transition-colors cursor-pointer"
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

            {/* Inline notes */}
            {landlineCarrier && landlineNotes.length > 0 && <InlineNotes notes={landlineNotes} />}

            {/* Standard landline codes */}
            {showLandlineCodes && !isTelus && (
              <div className="space-y-3">
                {/* Process instructions */}
                <div className="bg-black/20 border border-white/[0.04] rounded-xl px-4 py-3">
                  <p className="text-[11px] text-zinc-400 leading-relaxed">{landlineCodes!.process}</p>
                </div>

                {landlineCodes!.noAnswerOn && (
                  <StarCard
                    stepNum="01"
                    label="No Answer"
                    desc="Forwards when you don't pick up"
                    code={`${landlineCodes!.noAnswerOn} ${rawNumber}`}
                    icon={
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <line x1="8" y1="6" x2="8" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="16" y1="6" x2="16" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    }
                  />
                )}

                <p className="text-[10px] text-zinc-600">No # suffix needed — landline star codes work differently from mobile GSM codes.</p>

                {isActive ? <ActiveBadge /> : <MarkActiveButton onClick={() => setIsActive(true)} />}
              </div>
            )}

            {/* Telus wireline — toggle tabs */}
            {landlineCarrier === 'telus-wireline' && rawNumber && (
              <div className="space-y-4">
                {/* Option toggle */}
                <div className="flex gap-1 p-1 bg-black/40 border border-white/[0.06] rounded-xl">
                  {(['A', 'B'] as const).map(opt => (
                    <button
                      key={opt}
                      onClick={() => setTelusOption(opt)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        telusOption === opt ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      Option {opt} — {opt === 'A' ? 'Star Code (manual)' : 'Call Telus (easier)'}
                    </button>
                  ))}
                </div>

                {telusOption === 'A' && (
                  <div className="space-y-3">
                    <div className="bg-black/20 border border-white/[0.04] rounded-xl px-4 py-3">
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
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
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      }
                    />
                  </div>
                )}

                {telusOption === 'B' && (
                  <div className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center shrink-0 text-emerald-400">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-white">Call Telus Business Support</p>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Skip the star code entirely. Call Telus Business and they&apos;ll enable it for you — takes about 5 minutes. No answer-to-confirm step required.
                    </p>
                    <div className="bg-black/30 rounded-xl px-4 py-3 space-y-2">
                      <p className="text-xs text-zinc-300"><span className="text-zinc-500">Call:</span> 1-866-771-9666</p>
                      <p className="text-xs text-zinc-300"><span className="text-zinc-500">Say:</span> &quot;Please enable Call Forward No Answer on my line to {displayNumber}&quot;</p>
                    </div>
                  </div>
                )}

                {isActive ? <ActiveBadge /> : <MarkActiveButton onClick={() => setIsActive(true)} />}
              </div>
            )}

            {/* Collapsible: Full forward + Rollback */}
            {landlineCarrier && landlineCodes && (
              <div className="space-y-1 pt-1">

                {landlineCodes.unconditionalOn && !isTelus && (
                  <details className="group">
                    <summary className="cursor-pointer list-none">
                      <div className="flex items-center gap-2 px-1 py-2 text-zinc-600 hover:text-zinc-400 transition-colors">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5"/>
                          <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        <span className="text-xs font-medium">Full Forwarding — All Calls to Agent</span>
                        <svg className="ml-auto group-open:rotate-180 transition-transform" width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </summary>
                    <div className="bg-black/30 border border-red-500/15 rounded-xl p-4 mt-1 space-y-2">
                      <p className="text-[11px] text-red-300/70 mb-3">Your desk phone will not ring. Every caller goes directly to the agent.</p>
                      <CodeRow label="Enable unconditional" code={`${landlineCodes.unconditionalOn} ${rawNumber}`} />
                    </div>
                  </details>
                )}

                <details className="group">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center gap-2 px-1 py-2 text-zinc-600 hover:text-zinc-400 transition-colors">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M3 3v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-xs font-medium">Rollback — Disable Forwarding</span>
                      <svg className="ml-auto group-open:rotate-180 transition-transform" width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </summary>
                  <div className="bg-black/30 border border-white/[0.05] rounded-xl p-4 mt-1 divide-y divide-white/[0.04]">
                    {landlineCodes.noAnswerOff && <CodeRow label="Disable no-answer forward"     code={landlineCodes.noAnswerOff} />}
                    {landlineCodes.busyOff && <CodeRow label="Disable busy forward"              code={landlineCodes.busyOff} />}
                    {landlineCodes.unconditionalOff && <CodeRow label="Disable unconditional forward" code={landlineCodes.unconditionalOff} />}
                    <p className="pt-3 text-[11px] text-zinc-600">Pick up the receiver, dial the code, hang up when you hear the confirmation tone.</p>
                  </div>
                </details>
              </div>
            )}

            {/* Empty state */}
            {!landlineCarrier && (
              <div className="text-center py-10 text-zinc-600 text-sm">
                Select your landline provider above to see the forwarding codes.
              </div>
            )}

            <p className="text-[11px] text-zinc-700 text-center pb-2">
              Forwarding stays active until disabled — even after restarts or power outages.
            </p>
          </div>
        )}

        {/* ════════════════════════
            VOIP
        ════════════════════════ */}
        {lineType === 'voip' && (
          <div className="space-y-5">

            {/* Info strip */}
            <div className="flex items-start gap-2 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
              <p className="text-xs text-zinc-400 leading-relaxed">
                VoIP systems use your admin portal instead of star codes. Works with any 10-digit North American number — no extra cost or delay.
              </p>
            </div>

            {/* Platform selector */}
            <div>
              <p className="text-[11px] text-zinc-500 uppercase tracking-widest font-semibold mb-2">VoIP Platform</p>
              <select
                value={voipPlatform}
                onChange={e => { setVoipPlatform(e.target.value); setIsActive(false); setCheckedSteps(new Set()) }}
                className="w-full bg-black/40 border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/40 transition-colors cursor-pointer"
              >
                <option value="">Select your platform...</option>
                {VOIP_PLATFORMS.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Mission checklist */}
            {showVoipCodes && voipInstructions && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-white">
                    {VOIP_PLATFORMS.find(p => p.id === voipPlatform)?.name} — Setup Steps
                  </p>
                  <span className="text-[10px] text-zinc-600 tabular-nums">
                    {checkedSteps.size}/{voipInstructions.steps.length} done
                  </span>
                </div>

                <ol className="space-y-2">
                  {voipInstructions.steps.map((step, i) => (
                    <li
                      key={i}
                      onClick={() => toggleStep(i)}
                      className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                        checkedSteps.has(i)
                          ? 'bg-emerald-500/[0.05] border-emerald-500/20'
                          : 'bg-black/20 border-white/[0.05] hover:border-white/[0.1] hover:bg-white/[0.02]'
                      }`}
                    >
                      <span className="text-sm font-black font-mono text-blue-500/35 w-7 shrink-0 mt-0.5">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <p className={`text-sm leading-relaxed flex-1 transition-colors ${
                        checkedSteps.has(i) ? 'text-zinc-500' : 'text-zinc-300'
                      }`}>
                        {step}
                      </p>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                        checkedSteps.has(i)
                          ? 'bg-emerald-500/30 border-emerald-500/50'
                          : 'border-white/[0.15]'
                      }`}>
                        {checkedSteps.has(i) && (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                            <path d="M20 6L9 17l-5-5" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>

                {/* Agent number inline */}
                {rawNumber && (
                  <div className="bg-black/20 border border-white/[0.04] rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className="text-[11px] text-zinc-500 shrink-0">Agent number:</span>
                    <span className="font-mono text-sm text-white flex-1">{displayNumber}</span>
                    <CopyButton value={rawNumber} />
                  </div>
                )}

                {/* Note */}
                {voipInstructions.note && (
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500/60 mt-1.5 shrink-0" />
                    <p className="text-[11px] text-amber-200/50 leading-relaxed">{voipInstructions.note}</p>
                  </div>
                )}

                {isActive ? <ActiveBadge /> : <MarkActiveButton onClick={() => setIsActive(true)} />}
              </div>
            )}

            {/* Empty state */}
            {!voipPlatform && (
              <div className="text-center py-10 text-zinc-600 text-sm">
                Select your VoIP platform above to see the setup steps.
              </div>
            )}

            <p className="text-[11px] text-zinc-700 text-center pb-2">
              Once saved in the portal, forwarding stays active permanently. Your business number remains unchanged for outbound calls.
            </p>
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <p className="text-[11px] text-zinc-700 text-center pb-4">
        Need help? Contact us and we&apos;ll walk you through it.
      </p>
    </div>
  )
}
