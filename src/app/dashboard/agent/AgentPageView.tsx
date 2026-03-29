'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ClientConfig } from '@/app/dashboard/settings/page'
import AgentIdentityHeader from '@/components/dashboard/settings/AgentIdentityHeader'
import VoiceStyleCard from '@/components/dashboard/settings/VoiceStyleCard'
import VoicePicker from '@/components/dashboard/settings/VoicePicker'
import CapabilitiesCard from '@/components/dashboard/settings/CapabilitiesCard'
import ActivityLog from '@/components/dashboard/settings/ActivityLog'
import { usePatchSettings } from '@/components/dashboard/settings/usePatchSettings'
import AdminDropdown from '@/components/dashboard/AdminDropdown'
import AgentTestCard from '@/components/dashboard/AgentTestCard'
import QuickInject from '@/components/dashboard/settings/QuickInject'
import AgentAnswerabilityCard from '@/components/dashboard/agent/AgentAnswerabilityCard'
import { DEFAULT_MINUTE_LIMIT } from '@/lib/niche-config'

// ─── Bot animation keyframes (required by AgentIdentityHeader CSS classes) ────

const BOT_KEYFRAMES = `
  @keyframes antennaBlink {
    0%, 90%, 100% { opacity: 1; }
    95% { opacity: 0.2; }
  }
  @keyframes armWave {
    0%, 100% { transform: rotate(-12deg); }
    50% { transform: rotate(12deg); }
  }
  .bot-antenna { animation: antennaBlink 2.4s ease-in-out infinite; }
  .bot-arm-l { animation: armWave 1.8s ease-in-out infinite; transform-origin: 80% 20%; }
  .bot-arm-r { animation: armWave 1.8s ease-in-out infinite reverse; transform-origin: 20% 20%; }
`

// ─── Chevron icon ─────────────────────────────────────────────────────────────

function ChevronRight({ className = '' }: { className?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Agent name inline edit ───────────────────────────────────────────────────

function AgentNameField({
  clientId,
  isAdmin,
  initialName,
}: {
  clientId: string
  isAdmin: boolean
  initialName: string
}) {
  const [name, setName] = useState(initialName)
  const savedName = useRef(initialName)
  const { saving, saved, patch } = usePatchSettings(clientId, isAdmin)

  return (
    <div className="pt-4 border-t b-theme">
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-2">Agent persona name</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="flex-1 min-w-0 bg-black/20 border b-theme rounded-xl px-3 py-2 text-sm t1 focus:outline-none focus:border-blue-500/40 transition-colors"
          placeholder="e.g. Aisha, Max, Riley"
          maxLength={40}
        />
        <button
          onClick={() => { patch({ agent_name: name }); savedName.current = name }}
          disabled={saving || name === savedName.current}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            saved
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20'
          } disabled:opacity-40`}
        >
          {saving ? 'Saving…' : saved ? '✓' : 'Save'}
        </button>
      </div>
      <p className="text-[10px] t3 mt-1.5">The name your agent uses when introducing itself to callers.</p>
    </div>
  )
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.18em] font-semibold mb-3" style={{ color: 'var(--color-text-3)' }}>
      {children}
    </p>
  )
}

// ─── Inner card group — keyed on client.id so state resets on client switch ──

function AgentCards({
  client,
  isAdmin,
  previewMode,
}: {
  client: ClientConfig
  isAdmin: boolean
  previewMode?: boolean
}) {
  const [statusLocal, setStatusLocal] = useState(client.status ?? 'active')
  const { patch } = usePatchSettings(client.id, isAdmin)
  const router = useRouter()

  const isActive = statusLocal === 'active'

  function toggleStatus() {
    if (previewMode) return
    const newStatus = isActive ? 'paused' : 'active'
    setStatusLocal(newStatus)
    patch({ status: newStatus })
  }

  // All capability configure clicks now route to dedicated pages — no inline drawers
  const handleConfigure = useCallback((section: string) => {
    const dest: Record<string, string> = {
      knowledge: '/dashboard/knowledge',
      'advanced-context': '/dashboard/knowledge',
      hours: '/dashboard/actions#hours',
      booking: '/dashboard/actions#scheduling',
      ivr: '/dashboard/actions#call-menu',
      voicemail: '/dashboard/actions#voicemail',
      'agent-config': '/dashboard/actions#call-handoff',
      sms: '/dashboard/actions#after-call',
    }
    router.push(dest[section] ?? '/dashboard/actions')
  }, [router])

  // ── Usage ────────────────────────────────────────────────────────────────────
  const minutesUsed = client.seconds_used_this_month != null
    ? Math.ceil(client.seconds_used_this_month / 60)
    : (client.minutes_used_this_month ?? 0)
  const minuteLimit = (client.monthly_minute_limit ?? DEFAULT_MINUTE_LIMIT) + (client.bonus_minutes ?? 0)
  const usagePct = minuteLimit > 0 ? (minutesUsed / minuteLimit) * 100 : 0

  // ── Trial days remaining ──────────────────────────────────────────────────────
  const daysRemaining = client.trial_expires_at
    ? Math.max(0, Math.ceil((new Date(client.trial_expires_at).getTime() - Date.now()) / 86400000))
    : undefined

  // ── Needs Attention ──────────────────────────────────────────────────────────
  const factLines = client.business_facts?.split('\n').filter(l => l.trim()).length ?? 0
  const faqCount = client.extra_qa?.filter(p => p.q?.trim() && p.a?.trim()).length ?? 0

  type AttentionItem = { label: string; href: string; urgency: 'high' | 'medium' | 'low' }
  const attentionItems: AttentionItem[] = []

  if (client.calendar_auth_status === 'expired') {
    attentionItems.push({
      label: 'Google Calendar authorization expired — reconnect to restore appointment booking',
      href: '/dashboard/actions#scheduling',
      urgency: 'high',
    })
  }
  if (usagePct >= 80) {
    attentionItems.push({
      label: `${Math.round(usagePct)}% of monthly minutes used`,
      href: '/dashboard/settings',
      urgency: usagePct >= 95 ? 'high' : 'medium',
    })
  }
  if (factLines === 0 && faqCount === 0 && client.website_scrape_status !== 'approved') {
    attentionItems.push({
      label: 'Agent has no business knowledge — add facts, Q&A, or a website',
      href: '/dashboard/knowledge',
      urgency: 'medium',
    })
  }
  if (client.website_url && client.website_scrape_status === 'extracted') {
    attentionItems.push({
      label: 'Website scraped and ready — review and approve your knowledge',
      href: '/dashboard/knowledge',
      urgency: 'medium',
    })
  }
  if (!client.business_hours_weekday) {
    attentionItems.push({
      label: 'Business hours not set — callers can\'t be told when you\'re available',
      href: '/dashboard/actions#hours',
      urgency: 'low',
    })
  }
  if (client.subscription_status === 'trialing' && daysRemaining !== undefined && daysRemaining <= 7) {
    attentionItems.push({
      label: daysRemaining === 0
        ? 'Trial expired — upgrade now to keep your number'
        : `Trial ends in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} — upgrade to keep your number`,
      href: '/dashboard/settings',
      urgency: daysRemaining <= 1 ? 'high' : daysRemaining <= 3 ? 'medium' : 'low',
    })
  }

  const hasHighUrgency = attentionItems.some(i => i.urgency === 'high')
  const hasMediumUrgency = attentionItems.some(i => i.urgency === 'medium')

  // Reset date for minutes bar
  const minuteResetDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
    .toLocaleDateString('en', { month: 'short', day: 'numeric' })

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <style>{BOT_KEYFRAMES}</style>

      {/* ── 1. Needs Attention — elevated above test card when active ── */}
      {attentionItems.length > 0 && (
        <div className="sm:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold" style={{
              color: hasHighUrgency ? '#f87171' : hasMediumUrgency ? '#fbbf24' : 'var(--color-text-3)'
            }}>
              Needs Attention
            </p>
            <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full ${
              hasHighUrgency ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'
            }`}>{attentionItems.length}</span>
          </div>
          <div className={`rounded-2xl border bg-surface overflow-hidden divide-y ${
            hasHighUrgency ? 'border-red-500/40' :
            hasMediumUrgency ? 'border-amber-500/30' :
            'b-theme'
          }`} style={!hasHighUrgency && !hasMediumUrgency ? { borderColor: 'var(--color-border)' } : undefined}>
            {attentionItems.map((item, i) => (
              <Link
                key={i}
                href={item.href}
                className="flex items-start gap-3 px-4 py-3 hover:bg-hover transition-colors group relative"
              >
                <span className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-r-full ${
                  item.urgency === 'high' ? 'bg-red-500' :
                  item.urgency === 'medium' ? 'bg-amber-400' :
                  'bg-zinc-600'
                }`} />
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1 ${
                  item.urgency === 'high' ? 'bg-red-400' :
                  item.urgency === 'medium' ? 'bg-amber-400' :
                  'bg-zinc-500'
                }`} />
                <span className={`text-xs flex-1 leading-relaxed ${
                  item.urgency === 'high' ? 't1' : 't2'
                }`}>{item.label}</span>
                <ChevronRight className="t3 shrink-0 mt-0.5 group-hover:t1 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── 2. Test Your Agent ─────────────────────────────── */}
      <div className="sm:col-span-2">
        <AgentTestCard
          agentName={client.agent_name ?? client.business_name ?? 'your agent'}
          businessName={client.business_name}
          clientStatus={client.status ?? null}
          isTrial={!isAdmin && client.subscription_status === 'trialing'}
          clientId={isAdmin ? client.id : undefined}
          daysRemaining={daysRemaining}
        />
      </div>

      {/* ── 2.5. Today's Update ────────────────────────────── */}
      <div>
        <SectionLabel>Today&apos;s Update</SectionLabel>
        <div className="rounded-2xl border b-theme bg-surface px-5 pb-4">
          <QuickInject client={client} isAdmin={isAdmin} />
        </div>
      </div>

      {/* ── 3. Agent Identity ──────────────────────────────── */}
      <div>
        <SectionLabel>Identity &amp; Status</SectionLabel>
        <div className="rounded-2xl border b-theme bg-surface p-5">
          <AgentIdentityHeader
            client={client}
            isActive={isActive}
            onToggleStatus={toggleStatus}
          />
          {/* Usage bar */}
          <div className="pt-4 border-t b-theme">
            <div className="flex items-center justify-between mb-2">
              <p className={`text-[10px] font-semibold tracking-[0.15em] uppercase transition-colors ${
                usagePct >= 95 ? 'text-amber-400' : 't3'
              }`}>Minutes This Month</p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono t2 tabular-nums">{minutesUsed} / {minuteLimit} min</span>
                {(client.bonus_minutes ?? 0) > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border text-indigo-400 border-indigo-500/30 bg-indigo-500/10">
                    +{client.bonus_minutes}
                  </span>
                )}
              </div>
            </div>
            <div className="h-1.5 bg-hover rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usagePct > 100 ? 'bg-pink-500' :
                  usagePct >= 95 ? 'bg-red-500' :
                  usagePct >= 80 ? 'bg-amber-500' :
                  'bg-blue-500'
                }`}
                style={{ width: `${Math.min(usagePct, 100)}%` }}
              />
            </div>
            <p className={`text-[11px] mt-1.5 tabular-nums font-mono transition-colors ${
              usagePct >= 95 ? 'text-red-400' : 't3'
            }`}>
              {Math.max(minuteLimit - minutesUsed, 0)} min remaining · resets {minuteResetDate}
            </p>
          </div>
          <AgentNameField
            clientId={client.id}
            isAdmin={isAdmin}
            initialName={client.agent_name ?? ''}
          />
        </div>
      </div>

      {/* ── 4. What It Knows ───────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>What It Knows</SectionLabel>
          <Link
            href="/dashboard/knowledge"
            className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 -mt-3"
          >
            Manage <ChevronRight />
          </Link>
        </div>
        <div className="rounded-2xl border b-theme bg-surface px-5 py-4">
          <div className={`grid grid-cols-3 gap-3 text-center ${
            factLines === 0 && faqCount === 0 && client.website_scrape_status !== 'approved' ? 'opacity-60' : ''
          }`}>
            <div>
              <p className={`text-xl font-bold tabular-nums ${factLines > 0 ? 't1' : 't3'}`}>{factLines}</p>
              <p className="text-[10px] t3 mt-0.5">Business facts</p>
            </div>
            <div>
              <p className={`text-xl font-bold tabular-nums ${faqCount > 0 ? 't1' : 't3'}`}>{faqCount}</p>
              <p className="text-[10px] t3 mt-0.5">Q&amp;A pairs</p>
            </div>
            <div>
              {client.website_scrape_status === 'approved' ? (
                <>
                  <p className="text-xl font-bold text-green-400">✓</p>
                  <p className="text-[10px] t3 mt-0.5">Website</p>
                </>
              ) : client.website_scrape_status === 'extracted' ? (
                <>
                  <p className="text-xl font-bold text-amber-400">!</p>
                  <p className="text-[10px] text-amber-400/70 mt-0.5">Review ready</p>
                </>
              ) : (
                <>
                  <p className="text-xl font-bold t3">—</p>
                  <p className="text-[10px] t3 mt-0.5">Website</p>
                </>
              )}
            </div>
          </div>
          {factLines === 0 && faqCount === 0 && client.website_scrape_status !== 'approved' && (
            <p className="text-[11px] text-amber-400/80 mt-3 pt-3 border-t b-theme">
              Your agent answers calls but knows nothing specific about your business yet.{' '}
              <Link href="/dashboard/knowledge" className="underline hover:text-amber-300 transition-colors">
                Add knowledge →
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* ── 5. Voice & Style ───────────────────────────────── */}
      <div>
        <SectionLabel>Voice &amp; Style</SectionLabel>
        <div className="space-y-3">
          {/* Speaker voice — controls agent_voice_id, syncs live agent */}
          <div className="rounded-2xl border b-theme bg-surface p-5">
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3 mb-3">Speaker</p>
            <VoicePicker client={client} isAdmin={isAdmin} />
          </div>
          {/* Personality — controls voice_style_preset (prompt patch) */}
          <VoiceStyleCard
            clientId={client.id}
            isAdmin={isAdmin}
            initialPreset={client.voice_style_preset ?? 'casual_friendly'}
            previewMode={previewMode}
          />
        </div>
      </div>

      {/* ── 5.5. What Your Agent Can Answer ────────────────── */}
      <div className="sm:col-span-2">
        <SectionLabel>What It Can Answer</SectionLabel>
        <AgentAnswerabilityCard
          businessFacts={client.business_facts ?? null}
          extraQa={client.extra_qa ?? []}
          businessHoursWeekday={client.business_hours_weekday ?? null}
          city={client.city ?? null}
          state={client.state ?? null}
          bookingEnabled={!!client.booking_enabled}
        />
      </div>

      {/* ── 6. What It Can Do ──────────────────────────────── */}
      <div className="sm:col-span-2">
        <SectionLabel>What It Can Do</SectionLabel>
        <CapabilitiesCard
          client={client}
          isAdmin={isAdmin}
          onConfigure={handleConfigure}
        />
      </div>

      {/* ── 7. Recent Changes ──────────────────────────────── */}
      <div className="sm:col-span-2">
        <SectionLabel>Recent Changes</SectionLabel>
        <ActivityLog clientId={client.id} isAdmin={isAdmin} />
      </div>
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

interface AgentPageViewProps {
  clients: ClientConfig[]
  isAdmin: boolean
  previewMode?: boolean
  initialClientId?: string
}

export default function AgentPageView({ clients, isAdmin, previewMode, initialClientId }: AgentPageViewProps) {
  const [selectedId, setSelectedId] = useState(
    initialClientId && clients.find(c => c.id === initialClientId)
      ? initialClientId
      : clients[0]?.id ?? ''
  )

  const client = clients.find(c => c.id === selectedId) ?? clients[0]
  if (!client) return null

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-4xl">
      {isAdmin && clients.length > 1 && (
        <AdminDropdown clients={clients} selectedId={selectedId} onSelect={setSelectedId} />
      )}

      <AgentCards key={client.id} client={client} isAdmin={isAdmin} previewMode={previewMode} />
    </div>
  )
}
