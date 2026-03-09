'use client'

import { useState } from 'react'
import type { SetupClientConfig } from './page'

// ── Carrier data ─────────────────────────────────────────────────────────────

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

// Fido uses double-hash for disable codes
const FIDO_DISABLE = new Set(['fido', 'chatr'])

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripToDigits(num: string | null): string {
  if (!num) return ''
  const digits = num.replace(/\D/g, '')
  // Remove leading 1 for 11-digit North American numbers
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

// ── Main component ────────────────────────────────────────────────────────────

interface SetupViewProps {
  clients: SetupClientConfig[]
  isAdmin: boolean
}

export default function SetupView({ clients, isAdmin }: SetupViewProps) {
  const [selectedId, setSelectedId] = useState(clients[0]?.id ?? '')
  const [carrier, setCarrier] = useState('')
  const [device, setDevice] = useState<'iphone' | 'android'>('iphone')

  const client = clients.find(c => c.id === selectedId) ?? clients[0]
  if (!client) return null

  const rawNumber = stripToDigits(client.twilio_number)
  const displayNumber = fmtPhone(client.twilio_number)
  const carrierNotes = carrier ? (CARRIER_NOTES[carrier] ?? []) : []
  const useDoubleHash = FIDO_DISABLE.has(carrier)

  const disablePrefix = useDoubleHash ? '##' : '#'

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">Call Forwarding Setup</h1>
        <p className="text-sm text-zinc-500 mt-1">Activate your AI agent in 60 seconds — set this up once and you're done.</p>
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
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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

      {/* ── Device picker ───────────────────────────────────────────────── */}
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

      {/* ── Carrier selector ────────────────────────────────────────────── */}
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

      {/* ── Carrier notes ───────────────────────────────────────────────── */}
      {carrierNotes.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <svg className="text-amber-400 shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <ul className="space-y-1.5">
              {carrierNotes.map((note, i) => (
                <li key={i} className="text-xs text-amber-200/80 leading-relaxed">{note}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ── Recommended setup: 3 codes ─────────────────────────────────── */}
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

      {/* ── Full forwarding (unconditional) ─────────────────────────────── */}
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

      {/* ── Disable forwarding ──────────────────────────────────────────── */}
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

      {/* ── Status check ────────────────────────────────────────────────── */}
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

      {/* ── Empty state: no carrier selected ───────────────────────────── */}
      {!carrier && (
        <div className="text-center py-8 text-zinc-600 text-sm">
          Select your carrier above to see the forwarding codes.
        </div>
      )}

      {/* ── Footer note ─────────────────────────────────────────────────── */}
      <p className="text-[11px] text-zinc-700 text-center pb-4">
        These are standard 3GPP GSM supplementary service codes — they work on all Canadian carriers.<br/>
        You only need to do this once. Forwarding stays active until you disable it.
      </p>
    </div>
  )
}
