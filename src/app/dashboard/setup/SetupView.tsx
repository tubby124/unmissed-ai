'use client'

import { useState, useEffect } from 'react'
import type { SetupClientConfig } from './page'
import { stripToDigits, fmtPhone, SectionLabel, CopyButton } from '@/components/dashboard/setup/shared'
import MobileSetup from '@/components/dashboard/setup/MobileSetup'
import LandlineSetup from '@/components/dashboard/setup/LandlineSetup'
import VoipSetup from '@/components/dashboard/setup/VoipSetup'

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
          <MobileSetup
            rawNumber={rawNumber}
            displayNumber={displayNumber}
            carrier={carrier}
            onCarrierChange={(id) => { setCarrier(id); setIsActive(false); localStorage.setItem('unmissed-setup-v1', JSON.stringify({ lt: lineType, d: device, c: id })) }}
            device={device}
            onDeviceChange={(d) => { setDevice(d); localStorage.setItem('unmissed-setup-v1', JSON.stringify({ lt: lineType, d, c: carrier })) }}
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
