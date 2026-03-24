'use client'

import { useState, useEffect, useRef } from 'react'
import type { SetupClientConfig } from './page'
import { stripToDigits, fmtPhone, SectionLabel, CopyButton } from '@/components/dashboard/setup/shared'
import MobileSetup from '@/components/dashboard/setup/MobileSetup'
import LandlineSetup from '@/components/dashboard/setup/LandlineSetup'
import VoipSetup from '@/components/dashboard/setup/VoipSetup'
import { STORAGE_KEYS } from '@/lib/storage-keys'
import HoursCard from '@/components/dashboard/settings/HoursCard'

// ── Main component ────────────────────────────────────────────────────────────

interface SetupViewProps {
  clients: SetupClientConfig[]
  isAdmin: boolean
  isTrialing?: boolean
}

export default function SetupView({ clients, isAdmin, isTrialing = false }: SetupViewProps) {
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
  // Forwarding section collapsed by default when already set up
  const [forwardingExpanded, setForwardingExpanded] = useState(!(clients[0]?.setup_complete ?? false))

  // Restore last-used selections from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SETUP)
    if (!saved) return
    try {
      const { lt, d, c } = JSON.parse(saved) as { lt?: string; d?: string; c?: string }
      if (lt === 'mobile' || lt === 'landline' || lt === 'voip') setLineType(lt)
      if (d === 'iphone' || d === 'android') setDevice(d)
      if (c) setCarrier(c)
    } catch { /* ignore corrupt data */ }
  }, [])

  // Reset forwarding expansion when admin switches clients
  useEffect(() => {
    const c = clients.find(cl => cl.id === selectedId) ?? clients[0]
    if (c) setForwardingExpanded(!c.setup_complete)
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const client = clients.find(c => c.id === selectedId) ?? clients[0]
  if (!client) return null

  // Trial users see a locked preview — the forwarding wizard requires a live account
  if (isTrialing && !isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-5 py-8 space-y-6">
        {/* Top upgrade banner */}
        <div className="flex items-start gap-3 py-4 px-5 rounded-xl border" style={{ backgroundColor: 'var(--color-accent-tint)', borderColor: 'color-mix(in srgb, var(--color-primary) 25%, transparent)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }}>
            <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-1)' }}>Call Forwarding Setup</p>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-3)' }}>This is where you&apos;ll set up call forwarding after upgrading. Here&apos;s what to expect:</p>
          </div>
        </div>

        {/* Preview steps */}
        <div className="space-y-3">
          {[
            { num: '01', title: 'Get your dedicated phone number', desc: 'We provision a local number in your area code that your agent answers on.' },
            { num: '02', title: 'Configure forwarding from your business line', desc: 'Dial a short code on your existing phone to send missed calls to your agent.' },
            { num: '03', title: 'Test that calls reach your agent', desc: 'Call your existing number, let it ring, and confirm your agent picks up.' },
          ].map(step => (
            <div key={step.num} className="flex items-start gap-4 rounded-2xl p-4 relative overflow-hidden" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', opacity: 0.55 }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[11px] font-bold font-mono" style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-3)' }}>
                {step.num}
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-1)' }}>{step.title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>{step.desc}</p>
              </div>
              {/* Lock overlay */}
              <div className="absolute top-3 right-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-text-3)' }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <a
          href="/dashboard/settings?tab=billing"
          className="w-full py-3 rounded-xl text-[13px] font-semibold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          Upgrade to unlock call forwarding setup
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </a>
        <p className="text-[11px] text-center" style={{ color: 'var(--color-text-3)' }}>
          Once you go live, your existing business phone number keeps working — callers just reach your agent when you&apos;re unavailable.
        </p>
      </div>
    )
  }

  const rawNumber = stripToDigits(client.twilio_number)
  const displayNumber = fmtPhone(client.twilio_number)

  function toggleStep(i: number) {
    setCheckedSteps(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

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

      {/* ── Admin client selector (dropdown) ──────────────────────────── */}
      {isAdmin && clients.length > 1 && (
        <ClientDropdown
          clients={clients}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════
          Forwarding setup — collapsible when already active
      ═══════════════════════════════════════════════════════════════ */}
      <div>
        {/* Collapsible header */}
        <button
          onClick={() => setForwardingExpanded(v => !v)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl border b-theme bg-surface hover:bg-hover transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            {client.setup_complete ? (
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
              </span>
            ) : (
              <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-amber-400/70" />
            )}
            <div>
              <p className="text-sm font-semibold t1">Call forwarding</p>
              <p className="text-[11px] t3 mt-0.5">
                {client.setup_complete ? 'Active — agent is live' : 'Not yet configured'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] t3">{forwardingExpanded ? 'Hide codes' : 'Update codes'}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={`t3 transition-transform duration-200 ${forwardingExpanded ? 'rotate-180' : ''}`}>
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </button>

        {/* Expanded wizard */}
        {forwardingExpanded && (
          <div className="mt-4 space-y-8">

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
                <p className="font-mono font-bold text-[2.75rem] sm:text-5xl t1 tracking-tight tabular-nums leading-none">
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
              onClick={() => { setLineType(t.id); setIsActive(false); localStorage.setItem(STORAGE_KEYS.SETUP, JSON.stringify({ lt: t.id, d: device, c: carrier })) }}
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
          <MobileSetup
            rawNumber={rawNumber}
            displayNumber={displayNumber}
            carrier={carrier}
            onCarrierChange={(id) => { setCarrier(id); setIsActive(false); localStorage.setItem(STORAGE_KEYS.SETUP, JSON.stringify({ lt: lineType, d: device, c: id })) }}
            device={device}
            onDeviceChange={(d) => { setDevice(d); localStorage.setItem(STORAGE_KEYS.SETUP, JSON.stringify({ lt: lineType, d, c: carrier })) }}
            isActive={isActive}
            onActivated={() => setIsActive(true)}
          />
        )}

        {/* ── LANDLINE ──────────────────────────────────────────────── */}
        {lineType === 'landline' && (
          <LandlineSetup
            rawNumber={rawNumber}
            displayNumber={displayNumber}
            landlineCarrier={landlineCarrier}
            onCarrierChange={(id) => { setLandlineCarrier(id); setIsActive(false) }}
            telusOption={telusOption}
            onTelusOptionChange={setTelusOption}
            isActive={isActive}
            onActivated={() => setIsActive(true)}
          />
        )}

        {/* ── VOIP ──────────────────────────────────────────────────── */}
        {lineType === 'voip' && (
          <VoipSetup
            rawNumber={rawNumber}
            displayNumber={displayNumber}
            voipPlatform={voipPlatform}
            onPlatformChange={(id) => { setVoipPlatform(id); setIsActive(false); setCheckedSteps(new Set()) }}
            checkedSteps={checkedSteps}
            onToggleStep={toggleStep}
            isActive={isActive}
            onActivated={() => setIsActive(true)}
          />
        )}
      </div>

      <p className="text-[11px] t3 text-center">
        Need help? Contact us and we&apos;ll walk you through it.
      </p>

          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          04 — Answering Schedule
      ═══════════════════════════════════════════════════════════════ */}
      <div>
        <SectionLabel num="04" label="Answering Schedule" />
        <HoursCard
          clientId={client.id}
          isAdmin={isAdmin}
          initialWeekday={client.business_hours_weekday ?? ''}
          initialWeekend={client.business_hours_weekend ?? ''}
          initialBehavior={client.after_hours_behavior ?? 'take_message'}
          initialPhone={client.after_hours_emergency_phone ?? ''}
        />
      </div>

      {/* ── Behavior summary ─────────────────────────────────────────── */}
      <div className="rounded-2xl border b-theme bg-surface px-5 py-4 space-y-1.5">
        <p className="text-[10px] uppercase tracking-[0.15em] t3 font-semibold">How your agent handles calls</p>
        <p className="text-xs t2 leading-relaxed">
          {client.business_hours_weekday
            ? <>Answers weekdays: <span className="font-medium t1">{client.business_hours_weekday}</span>.</>
            : 'Business hours not yet configured.'}
          {client.business_hours_weekend
            ? <> Weekends: <span className="font-medium t1">{client.business_hours_weekend}</span>.</>
            : ''}
          {' '}After-hours:{' '}
          <span className="font-medium t1">
            {client.after_hours_behavior === 'emergency_transfer'
              ? `transfers to ${client.after_hours_emergency_phone || 'emergency line'}`
              : client.after_hours_behavior === 'always_answer'
              ? 'always answers (24/7)'
              : 'takes a message'}
          </span>.
        </p>
      </div>

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

// ── Admin client dropdown with search, grouping, niche badge, phone ──────────
function ClientDropdown({
  clients,
  selectedId,
  onSelect,
}: {
  clients: SetupClientConfig[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  const selected = clients.find(c => c.id === selectedId)
  const q = search.toLowerCase()
  const filtered = clients.filter(c =>
    c.business_name.toLowerCase().includes(q) ||
    (c.niche ?? '').toLowerCase().includes(q) ||
    (c.twilio_number ?? '').includes(q)
  )
  const active = filtered.filter(c => c.status === 'active' || c.status === 'trial')
  const unassigned = filtered.filter(c => c.status !== 'active' && c.status !== 'trial')

  function handleSelect(id: string) {
    onSelect(id)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border b-theme bg-input hover:bg-hover transition-colors text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium t1 truncate">{selected?.business_name ?? 'Select client'}</span>
            {selected?.niche && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                {selected.niche}
              </span>
            )}
          </div>
          {selected?.twilio_number && (
            <span className="text-[11px] t3 font-mono">{fmtPhone(selected.twilio_number)}</span>
          )}
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={`t3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border b-theme bg-surface shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b b-theme">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search clients..."
              className="w-full px-3 py-2 rounded-lg bg-hover border b-theme text-xs t1 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-4 py-6 text-center text-xs t3">No clients match &ldquo;{search}&rdquo;</div>
            )}

            {active.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider t3 bg-hover">Active</div>
                {active.map(c => (
                  <ClientRow key={c.id} client={c} isSelected={c.id === selectedId} onSelect={handleSelect} />
                ))}
              </>
            )}

            {unassigned.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider t3 bg-hover">Unassigned</div>
                {unassigned.map(c => (
                  <ClientRow key={c.id} client={c} isSelected={c.id === selectedId} onSelect={handleSelect} />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ClientRow({
  client: c,
  isSelected,
  onSelect,
}: {
  client: SetupClientConfig
  isSelected: boolean
  onSelect: (id: string) => void
}) {
  return (
    <button
      onClick={() => onSelect(c.id)}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-hover transition-colors ${
        isSelected ? 'bg-blue-500/10' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium truncate ${isSelected ? 'text-blue-400' : 't1'}`}>
            {c.business_name}
          </span>
          {c.niche && (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
              {c.niche}
            </span>
          )}
        </div>
        {c.twilio_number && (
          <span className="text-[10px] t3 font-mono">{fmtPhone(c.twilio_number)}</span>
        )}
      </div>
      {isSelected && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-blue-400 shrink-0">
          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  )
}
