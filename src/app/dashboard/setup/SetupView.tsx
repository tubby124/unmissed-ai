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
  { id: 'ringcentral',   name: 'RingCentral' },
  { id: 'ooma',         name: 'Ooma Office' },
  { id: 'grasshopper',  name: 'Grasshopper' },
  { id: '8x8',          name: '8x8 Work / Express' },
  { id: 'vonage',       name: 'Vonage Business' },
  { id: 'telus-connect',name: 'Telus Business Connect' },
  { id: 'other-voip',   name: 'Other VoIP System' },
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

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }}
      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-400 border border-white/[0.08] hover:text-zinc-200 hover:border-white/[0.18] hover:bg-white/[0.04] transition-all shrink-0"
    >
      {copied ? (
        <>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          Copy
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

function CarrierNoteBox({ notes }: { notes: string[] }) {
  if (!notes.length) return null
  return (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <svg className="text-amber-400 shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5"/>
          <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <ul className="space-y-1.5">
          {notes.map((note, i) => (
            <li key={i} className="text-xs text-amber-200/80 leading-relaxed">{note}</li>
          ))}
        </ul>
      </div>
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

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">Call Forwarding Setup</h1>
        <p className="text-sm text-zinc-500 mt-1">Activate your AI agent in 60 seconds — set this up once and you&apos;re done.</p>
      </div>

      {/* ── Admin client selector ───────────────────────────────────────── */}
      {isAdmin && clients.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {clients.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
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

      {/* ── Agent number card ───────────────────────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
        <p className="text-xs text-zinc-500 mb-1">Your AI Agent&apos;s Phone Number</p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-2xl font-mono font-semibold text-white tracking-tight">
            {rawNumber ? displayNumber : <span className="text-zinc-600">Not configured</span>}
          </span>
          {rawNumber && (
            <CopyButton value={rawNumber} />
          )}
        </div>
        <p className="text-xs text-zinc-600 mt-2">
          This is the number you&apos;ll forward your calls to. Copy it before dialing the codes below.
        </p>
      </div>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold tracking-wide text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
              CONDITIONAL FORWARDING — RECOMMENDED
            </span>
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed">
            When a caller doesn&apos;t reach you — you&apos;re busy, didn&apos;t answer, or your phone is off — the call automatically routes to your AI agent. <span className="text-white font-medium">Your main line still rings first.</span> You keep full control of your phone.
          </p>
        </div>

        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <svg className="text-red-400 shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <div>
              <p className="text-xs font-semibold text-red-400 mb-1">Avoid: Unconditional (Full) Forwarding</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                iPhone&apos;s built-in <span className="font-mono text-zinc-300">Settings › Phone › Call Forwarding</span> activates unconditional forwarding — every call goes straight to the agent and <span className="text-red-300 font-medium">you receive no calls on your own phone</span>. Only use this if you want 100% of calls handled by the agent.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Line type picker ────────────────────────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
        <p className="text-xs font-medium text-zinc-400 mb-3">Your Business Phone Type</p>
        <div className="flex gap-2 flex-wrap">
          {([
            { id: 'mobile',   label: 'Mobile / Cell Phone' },
            { id: 'landline', label: 'Landline / Desk Phone' },
            { id: 'voip',     label: 'VoIP / Business Phone System' },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setLineType(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                lineType === t.id
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  : 'text-zinc-400 border-white/[0.08] hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MOBILE SECTION
      ══════════════════════════════════════════════════════════════════ */}
      {lineType === 'mobile' && (
        <>
          {/* ── Device picker ─────────────────────────────────────────── */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <p className="text-xs font-medium text-zinc-400 mb-3">Your Device</p>
            <div className="flex gap-2 mb-4">
              {(['iphone', 'android'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDevice(d)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    device === d
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      : 'text-zinc-400 border-white/[0.08] hover:text-zinc-200 hover:bg-white/[0.04]'
                  }`}
                >
                  {d === 'iphone' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                      <line x1="12" y1="18" x2="12.01" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <rect x="5" y="4" width="14" height="16" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M9 2l1 2h4l1-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  )}
                  {d === 'iphone' ? 'iPhone' : 'Android'}
                </button>
              ))}
            </div>
            <div className="text-xs text-zinc-500 bg-black/20 rounded-lg px-3 py-2.5 leading-relaxed">
              {device === 'iphone' ? (
                <>
                  Open your <span className="text-zinc-300 font-medium">Phone app</span> → tap the keypad icon → dial the codes below and press the green Call button.<br/>
                  <span className="text-red-400">Do NOT</span> use Settings › Phone › Call Forwarding — that enables unconditional forwarding.
                </>
              ) : (
                <>
                  Option A (dial pad): Open your <span className="text-zinc-300 font-medium">Phone app</span> → dial the code and press Call.<br/>
                  Option B (in-app): Phone app → More (⋮) → Settings → Supplementary Services → Call Forwarding → select each scenario.
                </>
              )}
            </div>
          </div>

          {/* ── Carrier selector ──────────────────────────────────────── */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <label className="text-xs font-medium text-zinc-400 mb-3 block">Your Carrier</label>
            <select
              value={carrier}
              onChange={e => setCarrier(e.target.value)}
              className="w-full bg-black/40 border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/40 transition-colors"
            >
              <option value="">Select your carrier...</option>
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

          {/* ── Carrier notes ─────────────────────────────────────────── */}
          <CarrierNoteBox notes={carrierNotes} />

          {/* ── Recommended setup: 3 codes ────────────────────────────── */}
          {carrier && rawNumber && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="text-sm font-semibold text-white">Recommended Setup — Forward Missed Calls Only</p>
              </div>
              <p className="text-xs text-zinc-500 mb-4">Dial each code, press Call, wait for confirmation tone, then hang up. Do all three.</p>

              <div className="space-y-3">
                {[
                  { step: 1, label: 'No Answer (missed calls)', code: `*61*${rawNumber}#`, desc: 'Forwards when you don\'t pick up' },
                  { step: 2, label: 'Busy (you\'re on a call)', code: `*67*${rawNumber}#`, desc: 'Forwards when your line is busy' },
                  { step: 3, label: 'Unreachable (phone off / no signal)', code: `*62*${rawNumber}#`, desc: 'Forwards when your phone is unreachable' },
                ].map(({ step, label, code, desc }) => (
                  <div key={step} className="bg-black/30 border border-white/[0.05] rounded-xl p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {step}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-zinc-300">{label}</p>
                          <p className="text-[10px] text-zinc-600 mt-0.5">{desc}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="flex-1 font-mono text-base text-white bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 tracking-wide">
                        {code}
                      </span>
                      <CopyButton value={code} />
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-2">Dial this code, then press the Call button</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Full forwarding (unconditional) ───────────────────────── */}
          {carrier && rawNumber && (
            <details className="group">
              <summary className="cursor-pointer list-none">
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-400">Full Forwarding — All Calls to Agent</p>
                      <p className="text-xs text-zinc-600 mt-0.5">Use this only if you want every single call answered by the AI agent</p>
                    </div>
                    <svg className="text-zinc-600 group-open:rotate-180 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </summary>
              <div className="bg-red-500/5 border border-red-500/20 border-t-0 rounded-b-2xl p-5 space-y-2">
                <p className="text-xs text-red-300/80 mb-3">Your phone will not ring. All callers go directly to the agent.</p>
                <CodeRow label="Enable unconditional" code={`*21*${rawNumber}#`} />
              </div>
            </details>
          )}

          {/* ── Disable forwarding ────────────────────────────────────── */}
          {carrier && (
            <details className="group">
              <summary className="cursor-pointer list-none">
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-400">Disable Forwarding — Rollback</p>
                      <p className="text-xs text-zinc-600 mt-0.5">Codes to turn off forwarding on your line</p>
                    </div>
                    <svg className="text-zinc-600 group-open:rotate-180 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </summary>
              <div className="bg-white/[0.02] border border-white/[0.05] border-t-0 rounded-b-2xl p-5 space-y-0 divide-y divide-white/[0.04]">
                <CodeRow label="Disable no-answer"     code={`${disablePrefix}61#`} />
                <CodeRow label="Disable busy"          code={`${disablePrefix}67#`} />
                <CodeRow label="Disable unreachable"   code={`${disablePrefix}62#`} />
                <CodeRow label="Disable unconditional" code={`${disablePrefix}21#`} />
                <CodeRow label="Disable ALL at once"   code="##002#" />
              </div>
            </details>
          )}

          {/* ── Status check ──────────────────────────────────────────── */}
          {carrier && (
            <details className="group">
              <summary className="cursor-pointer list-none">
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-400">Verify It&apos;s Working</p>
                      <p className="text-xs text-zinc-600 mt-0.5">Check that forwarding is active on your line</p>
                    </div>
                    <svg className="text-zinc-600 group-open:rotate-180 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </summary>
              <div className="bg-white/[0.02] border border-white/[0.05] border-t-0 rounded-b-2xl p-5 space-y-0 divide-y divide-white/[0.04]">
                <CodeRow label="Check no-answer status"   code="*#61#" />
                <CodeRow label="Check unreachable status" code="*#62#" />
                <CodeRow label="Check busy status"        code="*#67#" />
                <p className="pt-3 text-xs text-zinc-600">Dial the code and press Call. Your carrier will display a message confirming whether forwarding is active and which number it routes to.</p>
              </div>
            </details>
          )}

          {/* ── Empty state ───────────────────────────────────────────── */}
          {!carrier && (
            <div className="text-center py-8 text-zinc-600 text-sm">
              Select your carrier above to see the forwarding codes.
            </div>
          )}

          <p className="text-[11px] text-zinc-700 text-center pb-2">
            These are standard 3GPP GSM supplementary service codes — they work on all Canadian carriers.<br/>
            You only need to do this once. Forwarding stays active until you disable it.
          </p>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          LANDLINE SECTION
      ══════════════════════════════════════════════════════════════════ */}
      {lineType === 'landline' && (
        <>
          {/* ── Carrier selector ──────────────────────────────────────── */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <label className="text-xs font-medium text-zinc-400 mb-3 block">Your Landline Provider</label>
            <select
              value={landlineCarrier}
              onChange={e => setLandlineCarrier(e.target.value)}
              className="w-full bg-black/40 border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/40 transition-colors"
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

          {/* ── Carrier notes ─────────────────────────────────────────── */}
          <CarrierNoteBox notes={landlineNotes} />

          {/* ── Recommended setup ─────────────────────────────────────── */}
          {landlineCarrier && rawNumber && landlineCodes && !isTelus && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="text-sm font-semibold text-white">Recommended Setup — Forward Missed Calls</p>
              </div>

              {/* Activation process */}
              <div className="bg-black/20 rounded-lg px-3 py-2.5 mb-4">
                <p className="text-xs text-zinc-400 leading-relaxed">{landlineCodes.process}</p>
              </div>

              <div className="space-y-3">
                {landlineCodes.noAnswerOn && (
                  <div className="bg-black/30 border border-white/[0.05] rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                      <div>
                        <p className="text-xs font-medium text-zinc-300">No Answer (missed calls)</p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">Forwards when you don&apos;t pick up</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex-1 font-mono text-base text-white bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 tracking-wide">
                        {landlineCodes.noAnswerOn} {rawNumber}
                      </span>
                      <CopyButton value={`${landlineCodes.noAnswerOn} ${rawNumber}`} />
                    </div>
                  </div>
                )}

                {landlineCodes.busyOn && (
                  <div className="bg-black/30 border border-white/[0.05] rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                      <div>
                        <p className="text-xs font-medium text-zinc-300">Busy (line in use)</p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">Forwards when your line is busy</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex-1 font-mono text-base text-white bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 tracking-wide">
                        {landlineCodes.busyOn} {rawNumber}
                      </span>
                      <CopyButton value={`${landlineCodes.busyOn} ${rawNumber}`} />
                    </div>
                  </div>
                )}
              </div>

              <p className="text-[10px] text-zinc-600 mt-3">
                No # suffix needed — landline star codes work differently from mobile GSM codes.
              </p>
            </div>
          )}

          {/* ── Telus wireline: two-option layout ─────────────────────── */}
          {isTelus && rawNumber && (
            <div className="space-y-3">
              {/* Option A: star code */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold tracking-wide text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-2 py-0.5">
                    OPTION A — STAR CODE
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                  Dial the code from your desk phone. The destination phone will ring — <span className="text-amber-300 font-medium">you must answer it</span> to confirm activation. If the call goes unanswered, the code won&apos;t activate.
                </p>
                <div className="bg-black/30 border border-white/[0.05] rounded-xl p-4">
                  <p className="text-xs font-medium text-zinc-300 mb-3">Activate call forwarding</p>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 font-mono text-base text-white bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 tracking-wide">
                      *72 {rawNumber}
                    </span>
                    <CopyButton value={`*72 ${rawNumber}`} />
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-2">If *72 doesn&apos;t work, try #72 {rawNumber}</p>
                </div>
              </div>

              {/* Option B: call support */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold tracking-wide text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                    OPTION B — CALL TELUS SUPPORT (EASIER)
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mb-3 leading-relaxed">
                  Skip the star code entirely. Call Telus Business and they&apos;ll enable it for you — takes about 5 minutes. No answer-to-confirm step required.
                </p>
                <div className="bg-black/20 rounded-lg px-3 py-2.5 space-y-1.5">
                  <p className="text-xs text-zinc-300"><span className="text-zinc-500">Call:</span> 1-866-771-9666 (Telus Business support)</p>
                  <p className="text-xs text-zinc-300"><span className="text-zinc-500">Ask:</span> &quot;Please enable Call Forward No Answer on my line to {displayNumber}&quot;</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Full forwarding (unconditional) ───────────────────────── */}
          {landlineCarrier && rawNumber && landlineCodes?.unconditionalOn && !isTelus && (
            <details className="group">
              <summary className="cursor-pointer list-none">
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-400">Full Forwarding — All Calls to Agent</p>
                      <p className="text-xs text-zinc-600 mt-0.5">Every call goes directly to the AI — your phone won&apos;t ring</p>
                    </div>
                    <svg className="text-zinc-600 group-open:rotate-180 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </summary>
              <div className="bg-red-500/5 border border-red-500/20 border-t-0 rounded-b-2xl p-5 space-y-2">
                <p className="text-xs text-red-300/80 mb-3">Your desk phone will not ring. All callers go directly to the agent.</p>
                <CodeRow label="Enable unconditional" code={`${landlineCodes.unconditionalOn} ${rawNumber}`} />
              </div>
            </details>
          )}

          {/* ── Disable forwarding ────────────────────────────────────── */}
          {landlineCarrier && landlineCodes && (
            <details className="group">
              <summary className="cursor-pointer list-none">
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-400">Disable Forwarding — Rollback</p>
                      <p className="text-xs text-zinc-600 mt-0.5">Codes to turn off forwarding on your line</p>
                    </div>
                    <svg className="text-zinc-600 group-open:rotate-180 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </summary>
              <div className="bg-white/[0.02] border border-white/[0.05] border-t-0 rounded-b-2xl p-5 space-y-0 divide-y divide-white/[0.04]">
                {landlineCodes.noAnswerOff && <CodeRow label="Disable no-answer forward" code={landlineCodes.noAnswerOff} />}
                {landlineCodes.busyOff && <CodeRow label="Disable busy forward" code={landlineCodes.busyOff} />}
                {landlineCodes.unconditionalOff && <CodeRow label="Disable unconditional forward" code={landlineCodes.unconditionalOff} />}
                <p className="pt-3 text-xs text-zinc-600">Pick up the receiver, dial the code, and hang up when you hear the confirmation tone.</p>
              </div>
            </details>
          )}

          {/* ── Empty state ───────────────────────────────────────────── */}
          {!landlineCarrier && (
            <div className="text-center py-8 text-zinc-600 text-sm">
              Select your landline provider above to see the forwarding codes.
            </div>
          )}

          <p className="text-[11px] text-zinc-700 text-center pb-2">
            Forwarding stays active until you disable it — even if you restart your phone or lose power.<br/>
            You only need to set this up once.
          </p>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          VOIP SECTION
      ══════════════════════════════════════════════════════════════════ */}
      {lineType === 'voip' && (
        <>
          {/* ── Info banner ───────────────────────────────────────────── */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <svg className="text-blue-400 shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <p className="text-xs text-blue-200/80 leading-relaxed">
                VoIP systems don&apos;t use star codes — forwarding is set up in your admin portal. All platforms support forwarding to any 10-digit North American number at no extra cost. Callers hear seamless ringing with no perceptible delay.
              </p>
            </div>
          </div>

          {/* ── Platform selector ─────────────────────────────────────── */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <label className="text-xs font-medium text-zinc-400 mb-3 block">Your VoIP Platform</label>
            <select
              value={voipPlatform}
              onChange={e => setVoipPlatform(e.target.value)}
              className="w-full bg-black/40 border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/40 transition-colors"
            >
              <option value="">Select your platform...</option>
              {VOIP_PLATFORMS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* ── Step-by-step instructions ─────────────────────────────── */}
          {voipPlatform && voipInstructions && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="text-sm font-semibold text-white">
                  {VOIP_PLATFORMS.find(p => p.id === voipPlatform)?.name} — Setup Steps
                </p>
              </div>

              <ol className="space-y-3">
                {voipInstructions.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm text-zinc-300 leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>

              {rawNumber && (
                <div className="mt-4 bg-black/20 rounded-lg px-3 py-2.5 flex items-center gap-3">
                  <span className="text-xs text-zinc-500 shrink-0">Your agent number:</span>
                  <span className="font-mono text-sm text-white flex-1">{displayNumber}</span>
                  <CopyButton value={rawNumber} />
                </div>
              )}

              {voipInstructions.note && (
                <div className="mt-3 bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-amber-200/80 leading-relaxed">{voipInstructions.note}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Empty state ───────────────────────────────────────────── */}
          {!voipPlatform && (
            <div className="text-center py-8 text-zinc-600 text-sm">
              Select your VoIP platform above to see the setup steps.
            </div>
          )}

          <p className="text-[11px] text-zinc-700 text-center pb-2">
            Once saved in the portal, forwarding stays active permanently — no need to reconfigure.<br/>
            Your business number remains unchanged for outbound calls.
          </p>
        </>
      )}

      {/* ── Footer note ─────────────────────────────────────────────────── */}
      <p className="text-[11px] text-zinc-700 text-center pb-4">
        Need help? Contact us and we&apos;ll walk you through it.
      </p>
    </div>
  )
}
