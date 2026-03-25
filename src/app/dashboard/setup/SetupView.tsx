'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { SetupClientConfig } from './page'
import {
  stripToDigits, fmtPhone, SectionLabel, CopyButton,
} from '@/components/dashboard/setup/shared'
import MobileSetup from '@/components/dashboard/setup/MobileSetup'
import LandlineSetup from '@/components/dashboard/setup/LandlineSetup'
import VoipSetup from '@/components/dashboard/setup/VoipSetup'
import { STORAGE_KEYS } from '@/lib/storage-keys'
import HoursCard from '@/components/dashboard/settings/HoursCard'
import { trackEvent } from '@/lib/analytics'
import { deriveActivationState, type ActivationState } from '@/lib/derive-activation-state'
import { useRef } from 'react'
import { useUpgradeModal } from '@/contexts/UpgradeModalContext'

// ── Shared icons ──────────────────────────────────────────────────────────────

const PhoneIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="12" y1="18" x2="12.01" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)
const DeskPhoneIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 8.96a19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const CloudIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

// ── Checklist ─────────────────────────────────────────────────────────────────

function ActivationChecklist({
  activationState,
  isActive,
  hasNumber,
  hasHours,
  displayNumber,
}: {
  activationState: ActivationState
  isActive: boolean
  hasNumber: boolean
  hasHours: boolean
  displayNumber: string
}) {
  const isReady = activationState === 'ready' || isActive
  const isForwardingActive = activationState === 'forwarding_needed' && !isActive

  const items = [
    { label: 'Account activated', done: true, pending: false, active: false },
    {
      label: hasNumber ? `Number assigned — ${displayNumber}` : 'Business number being assigned…',
      done: hasNumber,
      pending: !hasNumber,
      active: false,
    },
    {
      label: 'Forwarding connected',
      done: isReady,
      pending: false,
      active: isForwardingActive,
    },
    {
      label: hasHours ? 'Business hours configured' : 'Business hours (recommended)',
      done: hasHours,
      pending: false,
      active: false,
    },
  ]

  return (
    <div className="rounded-2xl p-4 card-surface">
      <p className="text-[10px] uppercase tracking-[0.15em] t3 font-semibold mb-3">Activation progress</p>
      <div className="space-y-2.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            {item.done ? (
              <span className="w-4 h-4 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" className="text-green-400">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            ) : item.pending ? (
              <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-amber-400 opacity-40" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
              </span>
            ) : item.active ? (
              <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: 'var(--color-primary)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
              </span>
            ) : (
              <span className="w-4 h-4 rounded-full border shrink-0" style={{ borderColor: 'var(--color-border)' }} />
            )}
            <span
              className={`text-xs ${item.done ? 'font-medium t1' : item.active ? 'font-medium' : 't3'}`}
              style={item.active ? { color: 'var(--color-primary)' } : undefined}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface SetupViewProps {
  clients: SetupClientConfig[]
  isAdmin: boolean
  isTrialing?: boolean
  isNewUpgrade?: boolean
}

export default function SetupView({
  clients,
  isAdmin,
  isTrialing = false,
  isNewUpgrade = false,
}: SetupViewProps) {
  const [selectedId, setSelectedId] = useState(clients[0]?.id ?? '')
  const [lineType, setLineType] = useState<'mobile' | 'landline' | 'voip'>('mobile')
  const [carrier, setCarrier] = useState('')
  const [device, setDevice] = useState<'iphone' | 'android'>('iphone')
  const [landlineCarrier, setLandlineCarrier] = useState('')
  const [voipPlatform, setVoipPlatform] = useState('')
  const [telusOption, setTelusOption] = useState<'A' | 'B'>('A')
  const [isActive, setIsActive] = useState(false)
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set())
  const [codesExpanded, setCodesExpanded] = useState(false)
  const hasTrackedView = useRef(false)
  const hasTrackedPreviewView = useRef(false)
  const { openUpgradeModal } = useUpgradeModal()

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

  // Reset forwarding state when admin switches clients
  useEffect(() => {
    setIsActive(false)
    setCodesExpanded(false)
    hasTrackedView.current = false
  }, [selectedId])

  const client = clients.find(c => c.id === selectedId) ?? clients[0]

  // Derive state before conditional returns (used in tracking effect)
  const activationState: ActivationState = client
    ? deriveActivationState(client)
    : 'awaiting_number'

  // Track activation view once per mount / client switch
  useEffect(() => {
    if (!client || hasTrackedView.current) return
    if (isTrialing && !isAdmin && !isNewUpgrade) return
    hasTrackedView.current = true
    trackEvent('activation_viewed', {
      activation_state: activationState,
      client_id: client.id,
      assigned_number_present: !!client.twilio_number,
    })
  }) // intentionally no dep array — runs each render but guarded by ref + state

  // Track setup preview view once for trial users seeing the locked preview
  useEffect(() => {
    if (!isTrialing || isAdmin || isNewUpgrade) return
    if (hasTrackedPreviewView.current) return
    hasTrackedPreviewView.current = true
    trackEvent('setup_preview_viewed', { client_id: clients[0]?.id ?? null })
  }) // intentionally no dep array — guarded by ref

  if (!client) return null

  // ── Trial users: locked preview ───────────────────────────────────────────
  if (isTrialing && !isAdmin && !isNewUpgrade) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-xl space-y-6">
          <div
            className="flex items-start gap-3 py-4 px-5 rounded-xl border"
            style={{ backgroundColor: 'var(--color-accent-tint)', borderColor: 'color-mix(in srgb, var(--color-primary) 25%, transparent)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }}>
              <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-1)' }}>Call Forwarding Setup</p>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-3)' }}>This is where you&apos;ll set up call forwarding after upgrading. Here&apos;s what to expect:</p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { num: '01', title: 'Get your dedicated phone number', desc: 'We provision a local number in your area code that your agent answers on.' },
              { num: '02', title: 'Configure forwarding from your business line', desc: 'Dial a short code on your existing phone to send missed calls to your agent.' },
              { num: '03', title: 'Test that calls reach your agent', desc: 'Call your existing number, let it ring, and confirm your agent picks up.' },
            ].map(step => (
              <div key={step.num} className="flex items-start gap-4 rounded-2xl p-4 relative overflow-hidden" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', opacity: 0.65 }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[11px] font-bold font-mono" style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-3)' }}>
                  {step.num}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-1)' }}>{step.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>{step.desc}</p>
                </div>
                <div className="absolute top-3 right-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-text-3)' }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => openUpgradeModal('setup_preview_upgrade_cta', clients[0]?.id)}
            className="w-full py-3 rounded-xl text-[13px] font-semibold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 cursor-pointer"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Upgrade to unlock call forwarding setup
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <div className="rounded-2xl border px-5 py-4 space-y-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold" style={{ color: 'var(--color-text-3)' }}>What you&apos;ll need to go live</p>
            <div className="space-y-2.5">
              {[
                'Your existing business phone number (mobile, landline, or VoIP)',
                'About 3 minutes to dial the forwarding activation codes',
                'Your agent is already trained — no extra setup needed',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5 text-green-400">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-xs" style={{ color: 'var(--color-text-2)' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-center" style={{ color: 'var(--color-text-3)' }}>
            Once you go live, your existing business phone number keeps working — callers just reach your agent when you&apos;re unavailable.
          </p>
        </div>
      </div>
    )
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const rawNumber = stripToDigits(client.twilio_number)
  const displayNumber = fmtPhone(client.twilio_number)
  const hasHours = !!client.business_hours_weekday
  const isReady = activationState === 'ready' || isActive

  const lineTypeTabs = [
    { id: 'mobile' as const, label: 'Mobile', icon: PhoneIcon },
    { id: 'landline' as const, label: 'Landline', icon: DeskPhoneIcon },
    { id: 'voip' as const, label: 'VoIP', icon: CloudIcon },
  ]

  function toggleStep(i: number) {
    setCheckedSteps(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  // ── Forwarding wizard (shared between forwarding_needed and update mode) ─

  function ForwardingWizard({ showSectionLabels }: { showSectionLabels: boolean }) {
    const Label = showSectionLabels ? SectionLabel : null

    return (
      <div className="space-y-8">
        {/* 01 — Agent Number */}
        <div>
          {Label && <SectionLabel num="01" label="Your AI Agent Number" />}
          <div className="relative overflow-hidden rounded-2xl border b-theme bg-input">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,rgba(59,130,246,0.08),transparent_70%)] pointer-events-none" />
            <div className="relative text-center px-8 pt-8 pb-6 space-y-4">
              <p className="text-[10px] uppercase tracking-[0.2em] t3 font-semibold">Forward calls to this number</p>
              {rawNumber ? (
                <>
                  <p className="font-mono font-bold text-[2.75rem] sm:text-5xl t1 tracking-tight tabular-nums leading-none">
                    {displayNumber}
                  </p>
                  <div className="flex justify-center pt-1">
                    <CopyButton value={rawNumber} label="Copy Number" />
                  </div>
                  <p className="text-[11px] t3">Copy this before dialing the codes below — you&apos;ll need it</p>
                </>
              ) : (
                <p className="text-3xl font-mono t3 py-2">Not configured yet</p>
              )}
            </div>
            {showSectionLabels && (
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
            )}
          </div>
        </div>

        {/* 02 — Phone Type */}
        <div>
          {Label && <SectionLabel num="02" label="Your Business Phone Type" />}
          <div className="flex gap-1.5 p-1.5 bg-input border b-theme rounded-xl">
            {lineTypeTabs.map(t => (
              <button
                key={t.id}
                onClick={() => {
                  setLineType(t.id)
                  setIsActive(false)
                  localStorage.setItem(STORAGE_KEYS.SETUP, JSON.stringify({ lt: t.id, d: device, c: carrier }))
                  trackEvent('forwarding_setup_started', { line_type: t.id, client_id: client.id, activation_state: activationState })
                }}
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

        {/* 03 — Activate Forwarding */}
        <div>
          {Label && <SectionLabel num="03" label="Activate Forwarding" />}
          {lineType === 'mobile' && (
            <MobileSetup
              rawNumber={rawNumber}
              displayNumber={displayNumber}
              carrier={carrier}
              onCarrierChange={(id) => { setCarrier(id); setIsActive(false); localStorage.setItem(STORAGE_KEYS.SETUP, JSON.stringify({ lt: lineType, d: device, c: id })) }}
              device={device}
              onDeviceChange={(d) => { setDevice(d); localStorage.setItem(STORAGE_KEYS.SETUP, JSON.stringify({ lt: lineType, d, c: carrier })) }}
              isActive={isActive}
              onActivated={() => {
                trackEvent('forwarding_setup_completed', { line_type: lineType, client_id: client.id })
                setIsActive(true)
                setCodesExpanded(false)
              }}
            />
          )}
          {lineType === 'landline' && (
            <LandlineSetup
              rawNumber={rawNumber}
              displayNumber={displayNumber}
              landlineCarrier={landlineCarrier}
              onCarrierChange={(id) => { setLandlineCarrier(id); setIsActive(false) }}
              telusOption={telusOption}
              onTelusOptionChange={setTelusOption}
              isActive={isActive}
              onActivated={() => {
                trackEvent('forwarding_setup_completed', { line_type: lineType, client_id: client.id })
                setIsActive(true)
                setCodesExpanded(false)
              }}
            />
          )}
          {lineType === 'voip' && (
            <VoipSetup
              rawNumber={rawNumber}
              displayNumber={displayNumber}
              voipPlatform={voipPlatform}
              onPlatformChange={(id) => { setVoipPlatform(id); setIsActive(false); setCheckedSteps(new Set()) }}
              checkedSteps={checkedSteps}
              onToggleStep={toggleStep}
              isActive={isActive}
              onActivated={() => {
                trackEvent('forwarding_setup_completed', { line_type: lineType, client_id: client.id })
                setIsActive(true)
                setCodesExpanded(false)
              }}
            />
          )}
        </div>

        <p className="text-[11px] t3 text-center">Need help? Contact us and we&apos;ll walk you through it.</p>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-xl mx-auto px-5 py-8 space-y-6">

      {/* Admin client selector */}
      {isAdmin && clients.length > 1 && (
        <ClientDropdown clients={clients} selectedId={selectedId} onSelect={setSelectedId} />
      )}

      {/* ── ACTIVATION HERO ────────────────────────────────────────────────── */}

      {activationState === 'awaiting_number' && (
        <div
          className="rounded-2xl p-5"
          style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, var(--color-surface) 100%)', border: '1px solid rgba(245,158,11,0.15)' }}
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: 'rgb(245,158,11)' }}>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                <polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-base font-semibold t1">Your business number is being assigned</h1>
              <p className="text-sm t3 mt-1 leading-relaxed">
                This usually takes a few minutes. Your agent is trained and ready — we&apos;re just provisioning your phone number.
              </p>
              <button
                onClick={() => {
                  trackEvent('activation_primary_cta_clicked', { activation_state: activationState, client_id: client.id })
                  window.location.reload()
                }}
                className="mt-4 flex items-center gap-1.5 text-xs font-semibold hover:opacity-75 transition-opacity"
                style={{ color: 'var(--color-primary)' }}
              >
                Refresh status
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {activationState === 'forwarding_needed' && !isActive && (
        <div
          className="rounded-2xl p-5"
          style={{ background: 'linear-gradient(135deg, var(--color-accent-tint) 0%, var(--color-surface) 100%)', border: '1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)' }}
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 8.96a19.79 19.79 0 01-3.07-8.67A2 2 0 012.88 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold t1">
                {isNewUpgrade ? 'One step from go live' : 'Connect forwarding to go live'}
              </h1>
              <p className="text-sm t3 mt-1 leading-relaxed">
                {isNewUpgrade
                  ? `Your upgrade is confirmed. Your AI number ${displayNumber} is ready. Dial the codes below to start taking real calls.`
                  : `Your AI number ${displayNumber} is ready. Dial the forwarding codes below to redirect missed calls to your agent.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {isReady && (
        <div
          className="rounded-2xl p-5"
          style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.06) 0%, var(--color-surface) 100%)', border: '1px solid rgba(34,197,94,0.15)' }}
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: 'rgb(34,197,94)' }}>
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-base font-semibold t1">You&apos;re ready to go live</h1>
              <p className="text-sm t3 mt-1 leading-relaxed">
                Forwarding is active. Your agent will answer calls when you&apos;re unavailable.
              </p>
              <Link
                href="/dashboard"
                onClick={() => trackEvent('activation_completed', { client_id: client.id, activation_state: activationState })}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Go to dashboard
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIVATION CHECKLIST ───────────────────────────────────────────── */}

      <ActivationChecklist
        activationState={activationState}
        isActive={isActive}
        hasNumber={!!client.twilio_number}
        hasHours={hasHours}
        displayNumber={displayNumber}
      />

      {/* ── FORWARDING WIZARD — shown when forwarding needed ──────────────── */}

      {activationState === 'forwarding_needed' && !isActive && (
        <>
          <ForwardingWizard showSectionLabels />

          {/* 04 — Hours (set now while they're here) */}
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
        </>
      )}

      {/* ── READY STATE CONTENT ──────────────────────────────────────────────*/}

      {isReady && (
        <div className="space-y-4">

          {/* Behavior summary */}
          <div className="rounded-2xl border b-theme card-surface px-5 py-4 space-y-1.5">
            <p className="text-[10px] uppercase tracking-[0.15em] t3 font-semibold">How your agent handles calls</p>
            <p className="text-xs t2 leading-relaxed">
              {client.business_hours_weekday
                ? <>Answers weekdays: <span className="font-medium t1">{client.business_hours_weekday}</span>.</>
                : 'Business hours not yet configured.'}
              {client.business_hours_weekend && (
                <> Weekends: <span className="font-medium t1">{client.business_hours_weekend}</span>.</>
              )}
              {' '}After-hours:{' '}
              <span className="font-medium t1">
                {client.after_hours_behavior === 'emergency_transfer'
                  ? `transfers to ${client.after_hours_emergency_phone || 'emergency line'}`
                  : client.after_hours_behavior === 'always_answer'
                  ? 'always answers (24/7)'
                  : 'takes a message'}
              </span>.
            </p>
            {!hasHours && (
              <p className="text-[11px] t3 mt-1">
                No hours set — your agent answers all calls 24/7 by default.{' '}
                <span className="t2">Add hours below to control availability.</span>
              </p>
            )}
          </div>

          {/* Hours card — shown as a recommendation when not yet set */}
          {!hasHours && (
            <HoursCard
              clientId={client.id}
              isAdmin={isAdmin}
              initialWeekday={client.business_hours_weekday ?? ''}
              initialWeekend={client.business_hours_weekend ?? ''}
              initialBehavior={client.after_hours_behavior ?? 'take_message'}
              initialPhone={client.after_hours_emergency_phone ?? ''}
            />
          )}

          {/* Update forwarding codes — collapsible, for phone/carrier changes */}
          <button
            onClick={() => setCodesExpanded(v => !v)}
            className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl border b-theme bg-surface hover:bg-hover transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold t1">Update forwarding codes</span>
              <span className="text-[11px] t3">Changed phones or carrier?</span>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={`t3 transition-transform duration-200 ${codesExpanded ? 'rotate-180' : ''}`}>
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {codesExpanded && (
            <div className="rounded-2xl border b-theme bg-surface px-5 py-5">
              <ForwardingWizard showSectionLabels={false} />
            </div>
          )}
        </div>
      )}

      {/* ── Awaiting number: explicit context ─────────────────────────────── */}
      {activationState === 'awaiting_number' && (
        <p className="text-[11px] t3 text-center">
          This page will reflect your number automatically once it&apos;s provisioned.
        </p>
      )}

    </div>
  )
}

// ── Admin client dropdown ─────────────────────────────────────────────────────

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
