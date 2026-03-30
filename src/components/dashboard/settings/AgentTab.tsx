'use client'

import { useState, useCallback, type Dispatch, type SetStateAction } from 'react'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import AgentOverviewCard from '@/components/dashboard/settings/AgentOverviewCard'
import { NICHE_CONFIG } from '@/lib/niche-config'
import { hasCapability } from '@/lib/niche-capabilities'
import CapabilitiesCard from '@/components/dashboard/CapabilitiesCard'
import { buildCapabilityFlags } from '@/lib/capability-flags'
import RuntimeCard from '@/components/dashboard/settings/RuntimeCard'
import KnowledgeEngineCard from '@/components/dashboard/settings/KnowledgeEngineCard'
import HoursCard from '@/components/dashboard/settings/HoursCard'
import VoiceStyleCard from '@/components/dashboard/settings/VoiceStyleCard'
import VoicemailGreetingCard from '@/components/dashboard/settings/VoicemailGreetingCard'
import IvrMenuCard from '@/components/dashboard/settings/IvrMenuCard'
import VIPContactsCard from '@/components/dashboard/settings/VIPContactsCard'
import AdvancedContextCard from '@/components/dashboard/settings/AdvancedContextCard'
import SectionEditorCard from '@/components/dashboard/settings/SectionEditorCard'
import { findExistingSectionHeader } from '@/lib/prompt-sections'
import WebhooksCard from '@/components/dashboard/settings/WebhooksCard'
import AgentConfigCard from '@/components/dashboard/settings/AgentConfigCard'
import BookingCard from '@/components/dashboard/settings/BookingCard'
import CallHandlingModeCard from '@/components/dashboard/settings/CallHandlingModeCard'
import AgentModeCard from '@/components/dashboard/settings/AgentModeCard'
import TestCallCard from '@/components/dashboard/settings/TestCallCard'
import SetupCard from '@/components/dashboard/settings/SetupCard'
import GodModeCard from '@/components/dashboard/settings/GodModeCard'
import LearningLoopCard from '@/components/dashboard/settings/LearningLoopCard'
import PromptSuggestionsCard from '@/components/dashboard/settings/PromptSuggestionsCard'
import ImprovePromptCard from '@/components/dashboard/settings/ImprovePromptCard'
import PromptEditorCard from '@/components/dashboard/settings/PromptEditorCard'
import OutboundAgentConfigCard from '@/components/dashboard/OutboundAgentConfigCard'
import PromptVersionsCard from '@/components/dashboard/settings/PromptVersionsCard'
import AgentKnowledgeCard from '@/components/dashboard/settings/AgentKnowledgeCard'
import ServicesOfferedCard from '@/components/dashboard/settings/ServicesOfferedCard'
import WebsiteKnowledgeCard from '@/components/dashboard/settings/WebsiteKnowledgeCard'
import WebsiteSourcesList from '@/components/dashboard/settings/WebsiteSourcesList'
import QuickSetupStrip from '@/components/dashboard/settings/QuickSetupStrip'
import SetupProgressRing from '@/components/dashboard/settings/SetupProgressRing'
import SettingsSection from '@/components/dashboard/settings/SettingsSection'
import ActivityLog from '@/components/dashboard/settings/ActivityLog'
import SettingsPanel from '@/components/dashboard/settings/SettingsPanel'
import PlanInfoCard from '@/components/dashboard/settings/PlanInfoCard'
import PlanGate from '@/components/dashboard/PlanGate'
import BillingCard from '@/components/dashboard/settings/BillingCard'
import { useDirtyGuardEffect } from './useDirtyGuard'
import { usePatchSettings } from './usePatchSettings'
import type { GodConfigEntry } from './constants'
import { fmtPhone } from '@/lib/settings-utils'

// ─── Section icon components ──────────────────────────────────────────────────

function MicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-indigo-400">
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-zinc-400">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}
function BookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-blue-400">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function ZapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-emerald-400">
      <path d="M13 2L3 14h9l-1 10 10-12h-9l1-10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-blue-400">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function SlidersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-amber-400">
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AgentTabProps {
  client: ClientConfig
  isAdmin: boolean
  appUrl: string
  prompt: Record<string, string>
  setPrompt: Dispatch<SetStateAction<Record<string, string>>>
  status: Record<string, string>
  setStatus: Dispatch<SetStateAction<Record<string, string>>>
  godConfig: Record<string, GodConfigEntry>
  setGodConfig: Dispatch<SetStateAction<Record<string, GodConfigEntry>>>
  telegramTest: Record<string, 'idle' | 'testing' | 'ok' | 'fail'>
  setTelegramTest: Dispatch<SetStateAction<Record<string, 'idle' | 'testing' | 'ok' | 'fail'>>>
  hoursWeekday: Record<string, string>
  setHoursWeekday: Dispatch<SetStateAction<Record<string, string>>>
  hoursWeekend: Record<string, string>
  setHoursWeekend: Dispatch<SetStateAction<Record<string, string>>>
  afterHoursBehavior: Record<string, string>
  setAfterHoursBehavior: Dispatch<SetStateAction<Record<string, string>>>
  afterHoursPhone: Record<string, string>
  setAfterHoursPhone: Dispatch<SetStateAction<Record<string, string>>>
  sectionContent: Record<string, Record<string, string>>
  setSectionContent: Dispatch<SetStateAction<Record<string, Record<string, string>>>>
  businessFacts: Record<string, string>
  setBusinessFacts: Dispatch<SetStateAction<Record<string, string>>>
  extraQA: Record<string, { q: string; a: string }[]>
  setExtraQA: Dispatch<SetStateAction<Record<string, { q: string; a: string }[]>>>
  contextData: Record<string, string>
  contextDataLabel: Record<string, string>
  bookingDuration: Record<string, number>
  setBookingDuration: Dispatch<SetStateAction<Record<string, number>>>
  bookingBuffer: Record<string, number>
  setBookingBuffer: Dispatch<SetStateAction<Record<string, number>>>
  forwardingNumber: Record<string, string>
  setForwardingNumber: Dispatch<SetStateAction<Record<string, string>>>
  transferConditions: Record<string, string>
  setTransferConditions: Dispatch<SetStateAction<Record<string, string>>>
  setupComplete: Record<string, boolean>
  setSetupComplete: Dispatch<SetStateAction<Record<string, boolean>>>
  voiceStylePreset: Record<string, string>
  setVoiceStylePreset: Dispatch<SetStateAction<Record<string, string>>>
  previewMode?: boolean
}

// ─── Section → scroll target mapping ──────────────────────────────────────────

const SCROLL_TO_SECTION: Record<string, string> = {
  'voice-style': 'identity',
  'voicemail': 'identity',
  'hours': 'capabilities',
  'booking': 'capabilities',
  'ivr': 'capabilities',
  'knowledge': 'knowledge',
  'advanced-context': 'knowledge',
  'agent-config': 'config',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AgentTab({
  client,
  isAdmin,
  appUrl,
  prompt,
  setPrompt,
  status,
  setStatus,
  godConfig,
  hoursWeekday,
  hoursWeekend,
  afterHoursBehavior,
  afterHoursPhone,
  sectionContent,
  businessFacts,
  extraQA,
  contextData,
  contextDataLabel,
  bookingDuration,
  bookingBuffer,
  forwardingNumber,
  transferConditions,
  setupComplete,
  setSetupComplete,
  voiceStylePreset,
  previewMode,
}: AgentTabProps) {
  useDirtyGuardEffect()
  const { patch: patchSettings } = usePatchSettings(client.id, isAdmin)

  // Compute once — used by CapabilitiesCard and TestCallCard (avoids duplicate inline logic)
  const capabilities = buildCapabilityFlags(client)

  // ─── Section open/close state ─────────────────────────────────────────────
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    talk: true,
    identity: true,
    knowledge: false,
    capabilities: false,
    script: false,
    config: false,
  })

  const [activePanel, setActivePanel] = useState<string | null>(null)

  const toggleSection = useCallback((id: string) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

  // ─── Derived values ──────────────────────────────────────────────────────────
  const niche = client.niche ?? ''
  const nicheConfig = NICHE_CONFIG[niche] ?? { label: niche || 'General', color: 't2', border: 'border-zinc-500/30' }
  const isActive = status[client.id] === 'active'

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  async function toggleStatus() {
    const next = status[client.id] === 'active' ? 'paused' : 'active'
    if (next === 'paused') {
      if (!confirm(`Pause ${client.business_name}? Calls will not be answered until you reactivate.`)) return
    }
    setStatus(prev => ({ ...prev, [client.id]: next }))
    const res = await patchSettings({ status: next })
    if (!res.ok) {
      setStatus(prev => ({ ...prev, [client.id]: next === 'active' ? 'paused' : 'active' }))
    }
  }

  async function handleMarkSetupComplete() {
    const res = await patchSettings({ setup_complete: true })
    if (res.ok) {
      setSetupComplete(prev => ({ ...prev, [client.id]: true }))
    }
  }

  // Scroll-to-section with auto-expand
  const handleScrollTo = useCallback((section: string) => {
    const parentSection = SCROLL_TO_SECTION[section]
    if (parentSection && !openSections[parentSection]) {
      setOpenSections(prev => ({ ...prev, [parentSection]: true }))
      // Wait for section to expand before scrolling
      setTimeout(() => {
        const el = document.getElementById(`section-${section}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 280)
    } else {
      const el = document.getElementById(`section-${section}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [openSections])

  // Open right-side panel for panel sections, scroll for others
  const handleConfigure = useCallback((section: string) => {
    if (section === 'hours' || section === 'ivr') {
      setActivePanel(section)
    } else {
      handleScrollTo(section)
    }
  }, [handleScrollTo])

  // For LearningLoopCard → scroll to ImprovePromptCard
  const handleRequestImprovement = useCallback(() => {
    if (!openSections.script) {
      setOpenSections(prev => ({ ...prev, script: true }))
      setTimeout(() => {
        const el = document.getElementById('section-improve-prompt')
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 280)
    } else {
      const el = document.getElementById('section-improve-prompt')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [openSections])

  // SET-13: When any card modifies the prompt server-side, update parent state
  const handlePromptChange = useCallback((newPrompt: string) => {
    setPrompt(prev => ({ ...prev, [client.id]: newPrompt }))
  }, [client.id, setPrompt])

  // ─── JSX ───────────────────────────────────────────────────────────────────────

  return (<div className="space-y-2">
    {/* ── 0. Setup (admin only — clients manage this on Go Live) ──── */}
    {isAdmin && (
      <SetupCard
        clientId={client.id}
        isAdmin={isAdmin}
        twilioNumber={client.twilio_number}
        initialForwardingNumber={forwardingNumber[client.id] ?? ''}
        initialTransferConditions={transferConditions[client.id] ?? ''}
        initialSetupComplete={setupComplete[client.id] ?? false}
        previewMode={previewMode}
        onSetupCompleteChange={(complete) =>
          setSetupComplete(prev => ({ ...prev, [client.id]: complete }))
        }
      />
    )}

    {/* ── Plan Info + Billing (admin — top; owner — bottom after sections) */}
    {isAdmin && (
      <>
        <PlanInfoCard
          clientId={client.id}
          selectedPlan={client.selected_plan}
          subscriptionStatus={client.subscription_status}
          secondsUsedThisMonth={client.seconds_used_this_month}
          monthlyMinuteLimit={client.monthly_minute_limit}
          bonusMinutes={client.bonus_minutes ?? 0}
          trialExpiresAt={client.trial_expires_at ?? null}
          trialConverted={client.trial_converted ?? null}
          stripeCustomerId={client.stripe_customer_id ?? null}
        />
        <BillingCard
          clientId={client.id}
          selectedPlan={client.selected_plan}
          subscriptionStatus={client.subscription_status}
          subscriptionCurrentPeriodEnd={client.subscription_current_period_end ?? null}
          stripeCustomerId={client.stripe_customer_id ?? null}
          stripeDiscountName={client.stripe_discount_name ?? null}
          effectiveMonthlyRate={client.effective_monthly_rate ?? null}
          cancelAt={client.cancel_at ?? null}
          isAdmin={isAdmin}
        />
      </>
    )}

    {/* ── CAPABILITIES OVERVIEW (always visible, all users) ────────── */}
    <CapabilitiesCard
      capabilities={capabilities}
      agentName={client.agent_name ?? client.business_name}
      voiceStylePreset={client.voice_style_preset ?? null}
      isTrial={client.subscription_status === 'trialing'}
      clientId={client.id}
      hasPhoneNumber={!!client.twilio_number}
      hasIvr={!!client.ivr_enabled}
      hasContextData={!!(client.context_data?.trim())}
    />

    {/* ── QUICK SETUP STRIP (non-admin, disappears when fully configured) ── */}
    {!isAdmin && (
      <QuickSetupStrip client={client} onScrollTo={handleScrollTo} />
    )}

    {/* ── 1. TALK TO YOUR AGENT (moved up — key feature) ──────────── */}
    <SettingsSection
      id="talk"
      title="Talk to Your Agent"
      subtitle="Test your agent with a live call"
      icon={<MicIcon />}
      isOpen={openSections.talk ?? false}
      onToggle={() => toggleSection('talk')}
      accentColor="indigo"
    >
      <TestCallCard
        clientId={client.id}
        isAdmin={isAdmin}
        previewMode={previewMode}
        isTrial={client.status === 'trial'}
        knowledge={{
          agentName: client.agent_name || undefined,
          hasFacts: !!(client.business_facts),
          hasFaqs: !!(client.extra_qa && client.extra_qa.length > 0),
          hasHours: !!(client.business_hours_weekday),
          hasBooking: !!(client.booking_enabled && client.calendar_auth_status === 'connected'),
          hasTransfer: !!(client.forwarding_number),
          hasSms: !!(client.sms_enabled && client.twilio_number),
          hasKnowledge: capabilities.hasKnowledge,
          hasWebsite: client.website_scrape_status === 'approved',
        }}
        onScrollTo={handleScrollTo}
      />
      <AgentKnowledgeCard client={client} clientId={client.id} isAdmin={isAdmin} />
      <PlanGate clientId={client.id} selectedPlan={client.selected_plan} subscriptionStatus={client.subscription_status} feature="learningLoop">
        <LearningLoopCard
          clientId={client.id}
          isAdmin={isAdmin}
          onRequestImprovement={isAdmin ? handleRequestImprovement : undefined}
        />
      </PlanGate>
      <PlanGate clientId={client.id} selectedPlan={client.selected_plan} subscriptionStatus={client.subscription_status} feature="learningLoop">
        <PromptSuggestionsCard clientId={client.id} isAdmin={isAdmin} onScrollTo={handleScrollTo} />
      </PlanGate>
    </SettingsSection>

    {/* ── 2. IDENTITY & VOICE ──────────────────────────────────────── */}
    <SettingsSection
      id="identity"
      title="Identity & Voice"
      subtitle={client.agent_name ? `${client.agent_name} \u2014 ${nicheConfig.label}` : nicheConfig.label}
      icon={<UserIcon />}
      isOpen={openSections.identity ?? false}
      onToggle={() => toggleSection('identity')}
      accentColor="zinc"
    >
      {isAdmin && (
        <>
          <AgentOverviewCard
            client={client}
            isAdmin={isAdmin}
            isActive={isActive}
            onToggleStatus={toggleStatus}
            previewMode={previewMode}
            onPromptChange={handlePromptChange}
            promptLength={(prompt[client.id] ?? '').length}
          />
          {!setupComplete[client.id] && (
            <div className="flex justify-end">
              <button
                onClick={handleMarkSetupComplete}
                className="text-xs px-3 py-1.5 rounded-lg border"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-3)' }}
              >
                Setup incomplete &middot; Mark as done &rarr;
              </button>
            </div>
          )}
        </>
      )}
      <CallHandlingModeCard
        clientId={client.id}
        isAdmin={isAdmin}
        initialMode={(client.call_handling_mode as 'message_only' | 'triage' | 'full_service') ?? 'triage'}
        selectedPlan={client.selected_plan}
        subscriptionStatus={client.subscription_status}
        previewMode={previewMode}
        onPromptChange={handlePromptChange}
      />
      {!isAdmin && (
        <AgentModeCard
          clientId={client.id}
          currentAgentMode={client.agent_mode ?? null}
          currentCallHandlingMode={client.call_handling_mode ?? null}
          previewMode={previewMode}
        />
      )}
      <div id="section-voice-style">
        <VoiceStyleCard
          clientId={client.id}
          isAdmin={isAdmin}
          initialPreset={voiceStylePreset[client.id] ?? 'casual_friendly'}
          previewMode={previewMode}
          onPromptChange={handlePromptChange}
        />
      </div>
      <div id="section-voicemail">
        <VoicemailGreetingCard
          clientId={client.id}
          isAdmin={isAdmin}
          initialText={client.voicemail_greeting_text ?? ''}
          businessName={client.business_name}
          hasAudioGreeting={!!client.voicemail_greeting_audio_url}
          previewMode={previewMode}
        />
      </div>
      {isAdmin && (
        <SectionEditorCard
          clientId={client.id}
          isAdmin={isAdmin}
          sectionId="identity"
          label="Agent Identity"
          desc="Agent name, greeting, and personality"
          rows={6}
          initialContent={(sectionContent[client.id] ?? {}).identity ?? ''}
          hasMarker={'identity' in (sectionContent[client.id] ?? {})}
          hasExistingHeader={!('identity' in (sectionContent[client.id] ?? {})) && !!findExistingSectionHeader(prompt[client.id] ?? '', 'identity')}
          previewMode={previewMode}
          onPromptChange={handlePromptChange}
        />
      )}
    </SettingsSection>

    {/* ── 3. WHAT IT KNOWS ─────────────────────────────────────────── */}
    <SettingsSection
      id="knowledge"
      title="What It Knows"
      subtitle="Business facts, FAQs, and knowledge base"
      icon={<BookIcon />}
      isOpen={openSections.knowledge ?? false}
      onToggle={() => toggleSection('knowledge')}
      accentColor="blue"
    >
      <ServicesOfferedCard client={client} clientId={client.id} isAdmin={isAdmin} />
      {isAdmin ? (
        <>
          <div id="section-advanced-context">
            <AdvancedContextCard
              clientId={client.id}
              isAdmin={isAdmin}
              initialFacts={businessFacts[client.id] ?? ''}
              initialQA={extraQA[client.id] ?? []}
              initialContextData={contextData[client.id] ?? ''}
              initialContextDataLabel={contextDataLabel[client.id] ?? ''}
              prompt={prompt[client.id] ?? ''}
              injectedNote={client.injected_note ?? ''}
              knowledgeEnabled={client.knowledge_backend === 'pgvector'}
              timezone={client.timezone ?? 'America/Regina'}
              previewMode={previewMode}
            />
          </div>
          <PlanGate clientId={client.id} selectedPlan={client.selected_plan} subscriptionStatus={client.subscription_status} feature="knowledge">
            <WebsiteSourcesList
              client={client}
              isAdmin={isAdmin}
            />
            <WebsiteKnowledgeCard
              client={client}
              isAdmin={isAdmin}
              previewMode={previewMode}
            />
          </PlanGate>
          <PlanGate clientId={client.id} selectedPlan={client.selected_plan} subscriptionStatus={client.subscription_status} feature="knowledge">
            <div id="section-knowledge">
              <KnowledgeEngineCard
                client={client}
                isAdmin={isAdmin}
                previewMode={previewMode}
                onClientUpdate={(updates) => {
                  if (updates.extra_qa) {
                    extraQA[client.id] = updates.extra_qa
                  }
                }}
              />
            </div>
          </PlanGate>
        </>
      ) : (
        <div className="rounded-2xl border b-theme bg-surface px-5 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium t1">Facts, FAQs &amp; website knowledge</p>
            <p className="text-[11px] t3">Manage everything your agent knows about your business</p>
          </div>
          <a href="/dashboard/knowledge" className="text-[12px] font-medium text-[var(--color-primary)] hover:opacity-75 transition-colors shrink-0">Manage →</a>
        </div>
      )}
      {isAdmin && (
        <SectionEditorCard
          clientId={client.id}
          isAdmin={isAdmin}
          sectionId="knowledge"
          label="Knowledge Base"
          desc="Upload documents for your agent to search through \u2014 policies, procedures, or detailed guides."
          rows={10}
          initialContent={(sectionContent[client.id] ?? {}).knowledge ?? ''}
          hasMarker={'knowledge' in (sectionContent[client.id] ?? {})}
          hasExistingHeader={!('knowledge' in (sectionContent[client.id] ?? {})) && !!findExistingSectionHeader(prompt[client.id] ?? '', 'knowledge')}
          previewMode={previewMode}
          onPromptChange={handlePromptChange}
        />
      )}
    </SettingsSection>

    {/* ── 4. WHAT IT CAN DO ────────────────────────────────────────── */}
    <SettingsSection
      id="capabilities"
      title="What It Can Do"
      subtitle="Hours, booking, transfers, and capabilities"
      icon={<ZapIcon />}
      isOpen={openSections.capabilities ?? false}
      onToggle={() => toggleSection('capabilities')}
      accentColor="green"
    >
      {/* CapabilitiesCard moved to top-level (always visible above sections) */}
      {!isAdmin && (
        <div className="rounded-2xl border b-theme bg-surface px-5 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium t1">Answering schedule</p>
            <p className="text-[11px] t3">Configure when your agent answers calls</p>
          </div>
          <a href="/dashboard/setup" className="text-[12px] font-medium text-[var(--color-primary)] hover:opacity-75 transition-colors shrink-0">
            Go Live →
          </a>
        </div>
      )}
      {hasCapability(niche, 'bookAppointments') && (
        <PlanGate clientId={client.id} selectedPlan={client.selected_plan} subscriptionStatus={client.subscription_status} feature="booking">
          <div id="section-booking">
            {isAdmin ? (
              <BookingCard
                clientId={client.id}
                isAdmin={isAdmin}
                calendarAuthStatus={client.calendar_auth_status}
                googleCalendarId={client.google_calendar_id}
                initialDuration={bookingDuration[client.id] ?? 60}
                initialBuffer={bookingBuffer[client.id] ?? 15}
                initialBookingEnabled={client.booking_enabled ?? false}
                previewMode={previewMode}
                onPromptChange={handlePromptChange}
              />
            ) : (
              <div className="rounded-2xl border b-theme bg-surface px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium t1">Calendar Booking</p>
                  <p className="text-[11px] t3">Configure booking settings on the Actions page.</p>
                </div>
                <a href="/dashboard/actions" className="text-[12px] font-medium text-[var(--color-primary)] hover:opacity-75 transition-colors shrink-0">Actions →</a>
              </div>
            )}
          </div>
        </PlanGate>
      )}
      {/* IVR card lives in the right-side panel — opened via CapabilitiesCard */}

      {/* VIP Contacts — Pro plan feature (same gate as transfer) */}
      <PlanGate clientId={client.id} selectedPlan={client.selected_plan} subscriptionStatus={client.subscription_status} feature="transfer">
        <VIPContactsCard
          clientId={client.id}
          isAdmin={isAdmin}
          forwardingNumber={client.forwarding_number ?? null}
        />
      </PlanGate>
    </SettingsSection>

    {/* ── 5. AGENT SCRIPT (admin only) ─────────────────────────────── */}
    {isAdmin && (
      <SettingsSection
        id="script"
        title="Agent Script"
        subtitle="System prompt, AI improvements, and version history"
        icon={<FileIcon />}
        isOpen={openSections.script ?? false}
        onToggle={() => toggleSection('script')}
        accentColor="blue"
      >
        <PromptEditorCard
          client={client}
          isAdmin={isAdmin}
          nicheLabel={nicheConfig.label}
          prompt={prompt[client.id] ?? ''}
          onPromptChange={(value) => setPrompt(prev => ({ ...prev, [client.id]: value }))}
          previewMode={previewMode}
        />
        <div id="section-improve-prompt">
          <ImprovePromptCard
            clientId={client.id}
            isAdmin={isAdmin}
            onApply={(improved) => setPrompt(prev => ({ ...prev, [client.id]: improved }))}
          />
        </div>
        <PromptVersionsCard
          clientId={client.id}
          isAdmin={isAdmin}
          onRestore={(content) => setPrompt(prev => ({ ...prev, [client.id]: content }))}
        />
        <OutboundAgentConfigCard
          clientId={client.id}
          isAdmin={isAdmin}
          hasPhoneNumber={!!client.twilio_number}
          initialOutboundPrompt={client.outbound_prompt ?? null}
          initialGoal={client.outbound_goal ?? null}
          initialOpening={client.outbound_opening ?? null}
          initialVmScript={client.outbound_vm_script ?? null}
          initialTone={(client.outbound_tone as 'warm' | 'professional' | 'direct') ?? 'warm'}
        />
      </SettingsSection>
    )}

    {/* ── Non-admin: Agent Script section (collapsible, matches admin pattern) */}
    {!isAdmin && (
      <SettingsSection
        id="script"
        title="Agent Script"
        subtitle="See what your agent says on calls"
        icon={<FileIcon />}
        isOpen={openSections.script ?? false}
        onToggle={() => toggleSection('script')}
        accentColor="blue"
      >
        <PromptEditorCard
          client={client}
          isAdmin={isAdmin}
          nicheLabel={nicheConfig.label}
          prompt={prompt[client.id] ?? ''}
          onPromptChange={(value) => setPrompt(prev => ({ ...prev, [client.id]: value }))}
          previewMode={previewMode}
        />
        <OutboundAgentConfigCard
          clientId={client.id}
          isAdmin={false}
          hasPhoneNumber={!!client.twilio_number}
          initialOutboundPrompt={client.outbound_prompt ?? null}
          initialGoal={client.outbound_goal ?? null}
          initialOpening={client.outbound_opening ?? null}
          initialVmScript={client.outbound_vm_script ?? null}
          initialTone={(client.outbound_tone as 'warm' | 'professional' | 'direct') ?? 'warm'}
        />
      </SettingsSection>
    )}

    {/* ── 6. CONFIGURATION (admin only) ────────────────────────────── */}
    {isAdmin && (
      <SettingsSection
        id="config"
        title="Configuration"
        subtitle="Webhooks, agent config, and infrastructure"
        icon={<SlidersIcon />}
        isOpen={openSections.config ?? false}
        onToggle={() => toggleSection('config')}
        accentColor="amber"
      >
        <div id="section-agent-config">
          <AgentConfigCard
            clientId={client.id}
            isAdmin={isAdmin}
            agentVoiceId={client.agent_voice_id}
            ultravoxAgentId={client.ultravox_agent_id}
            telegramChatId={client.telegram_chat_id}
          />
        </div>
        <WebhooksCard appUrl={appUrl} slug={client.slug} twilioNumber={client.twilio_number} />
        {godConfig[client.id] && (
          <GodModeCard
            clientId={client.id}
            initialConfig={godConfig[client.id]}
            previewMode={previewMode}
            currentAgentMode={(client.agent_mode as string | null) ?? null}
            currentCallHandlingMode={(client.call_handling_mode as string | null) ?? null}
          />
        )}
        <RuntimeCard client={client} />
      </SettingsSection>
    )}

    {/* ── Owner: billing + setup at bottom (not above the hero orb) ── */}
    {!isAdmin && (
      <>
        <PlanInfoCard
          clientId={client.id}
          selectedPlan={client.selected_plan}
          subscriptionStatus={client.subscription_status}
          secondsUsedThisMonth={client.seconds_used_this_month}
          monthlyMinuteLimit={client.monthly_minute_limit}
          bonusMinutes={client.bonus_minutes ?? 0}
          trialExpiresAt={client.trial_expires_at ?? null}
          trialConverted={client.trial_converted ?? null}
          stripeCustomerId={client.stripe_customer_id ?? null}
        />
        <BillingCard
          clientId={client.id}
          selectedPlan={client.selected_plan}
          subscriptionStatus={client.subscription_status}
          subscriptionCurrentPeriodEnd={client.subscription_current_period_end ?? null}
          stripeCustomerId={client.stripe_customer_id ?? null}
          stripeDiscountName={client.stripe_discount_name ?? null}
          effectiveMonthlyRate={client.effective_monthly_rate ?? null}
          cancelAt={client.cancel_at ?? null}
          isAdmin={isAdmin}
        />
        <SetupProgressRing client={client} isAdmin={isAdmin} />
        <div className="rounded-2xl border b-theme bg-surface px-5 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium t1">Phone &amp; call forwarding</p>
            <p className="text-[11px] t3">
              {client.twilio_number
                ? <>Your number: <span className="font-mono">{fmtPhone(client.twilio_number)}</span> &mdash; carrier instructions</>
                : 'Configure your phone number and call routing'}
            </p>
          </div>
          <a href="/dashboard/setup" className="text-[12px] font-medium text-[var(--color-primary)] hover:opacity-75 transition-colors shrink-0 cursor-pointer">
            Setup →
          </a>
        </div>
      </>
    )}

    {/* ── ACTIVITY LOG ──────────────────────────────────────────── */}
    <ActivityLog clientId={client.id} isAdmin={isAdmin} />

    {/* ── SETTINGS PANEL (right-side drawer) ───────────────────── */}
    <SettingsPanel
      open={activePanel !== null}
      onClose={() => setActivePanel(null)}
      title={
        activePanel === 'hours' ? 'Answering Schedule'
        : activePanel === 'ivr' ? 'Voicemail Menu (IVR)'
        : ''
      }
    >
      {activePanel === 'hours' && (
        <HoursCard
          clientId={client.id}
          isAdmin={isAdmin}
          initialWeekday={hoursWeekday[client.id] ?? ''}
          initialWeekend={hoursWeekend[client.id] ?? ''}
          initialBehavior={afterHoursBehavior[client.id] ?? 'take_message'}
          initialPhone={afterHoursPhone[client.id] ?? ''}
          previewMode={previewMode}
        />
      )}
      {activePanel === 'ivr' && (
        <IvrMenuCard
          clientId={client.id}
          isAdmin={isAdmin}
          initialEnabled={client.ivr_enabled ?? false}
          initialPrompt={client.ivr_prompt ?? ''}
          businessName={client.business_name}
          agentName={client.agent_name}
          previewMode={previewMode}
        />
      )}
    </SettingsPanel>

  </div>)
}
