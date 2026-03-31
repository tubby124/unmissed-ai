'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import Link from 'next/link'
import { useUpgradeModal } from '@/contexts/UpgradeModalContext'

interface AgentIntelligenceSectionProps {
  agentName: string
  businessName: string
  hoursWeekday: string | null
  faqs: { q: string; a: string }[]
  businessFacts: string | null
  websiteUrl: string | null
  hasKnowledge: boolean
  hasSms: boolean
  hasBooking: boolean
  hasTransfer: boolean
  isTrial: boolean
  clientId: string | null
}

// Parse "Mon-Fri: 9am-5pm" style hours string into first line
function parseHoursSnippet(raw: string | null): string | null {
  if (!raw) return null
  const first = raw.split('\n')[0].trim()
  return first.length > 0 ? first : null
}

// Extract first sentence from business_facts
function extractFactSnippet(facts: string | null): string | null {
  if (!facts) return null
  const s = facts.replace(/\n+/g, ' ').trim()
  const end = s.search(/[.!?]/)
  return end > 0 ? s.slice(0, end + 1) : s.slice(0, 100)
}

// Format website domain for display
function formatDomain(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace('www.', '')
  } catch {
    return url
  }
}

// A single caller/agent dialogue bubble pair
function Dialogue({ caller, agent, agentName }: { caller: string; agent: string; agentName: string }) {
  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex justify-end">
        <div
          className="max-w-[80%] px-3 py-1.5 rounded-2xl rounded-tr-sm text-[12px] leading-snug"
          style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-2)' }}
        >
          {caller}
        </div>
      </div>
      <div className="flex items-end gap-1.5">
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold text-white"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {agentName.charAt(0).toUpperCase()}
        </div>
        <div
          className="max-w-[80%] px-3 py-1.5 rounded-2xl rounded-bl-sm text-[12px] leading-snug"
          style={{ backgroundColor: 'rgba(37,99,235,0.12)', color: 'var(--color-text-1)' }}
        >
          {agent}
        </div>
      </div>
    </div>
  )
}

// Locked feature teaser card
function UnlockCard({
  icon,
  label,
  tagline,
  preview,
  planLabel,
  onUnlock,
}: {
  icon: React.ReactNode
  label: string
  tagline: string
  preview: React.ReactNode
  planLabel: string
  onUnlock: () => void
}) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden"
      style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      {/* Plan badge */}
      <div className="absolute top-3 right-3">
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: 'rgb(245,158,11)' }}
        >
          {planLabel}
        </span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--color-hover)' }}
        >
          {icon}
        </div>
        <div>
          <p className="text-[13px] font-semibold t1">{label}</p>
          <p className="text-[11px] t3">{tagline}</p>
        </div>
      </div>

      {/* Preview mockup */}
      <div
        className="rounded-xl p-3 text-[11px] leading-relaxed opacity-70"
        style={{ backgroundColor: 'var(--color-hover)' }}
      >
        {preview}
      </div>

      {/* Unlock CTA */}
      <button
        onClick={onUnlock}
        className="w-full text-[12px] font-semibold py-2 rounded-xl transition-opacity hover:opacity-80 cursor-pointer"
        style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
      >
        Unlock this →
      </button>
    </div>
  )
}

// Expandable knowledge source row
function KnowledgeRow({
  icon,
  label,
  configured: isConfigured,
  configuredSummary,
  configuredHint,
  notConfiguredHint,
  dialogue,
  link,
  agentName,
}: {
  icon: React.ReactNode
  label: string
  configured: boolean
  configuredSummary?: string
  configuredHint?: string
  notConfiguredHint: string
  dialogue?: { caller: string; agent: string } | null
  link: string
  agentName: string
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="border-b last:border-0"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <button
        onClick={() => isConfigured && setExpanded(v => !v)}
        className={`w-full flex items-center gap-3 px-4 py-3 min-h-[52px] text-left transition-colors duration-150 ${isConfigured ? 'hover:bg-hover cursor-pointer' : 'cursor-default'}`}
      >
        {/* Status dot */}
        <div className="shrink-0">
          {isConfigured ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(34,197,94,0.15)' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="rgb(34,197,94)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.div>
          ) : (
            <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: 'var(--color-border)' }} />
          )}
        </div>

        {/* Icon + label */}
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: isConfigured ? 'rgba(37,99,235,0.1)' : 'var(--color-hover)' }}
        >
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium t1">{label}</p>
          <p className="text-[11px] mt-0.5" style={{ color: isConfigured ? 'rgb(34,197,94)' : 'var(--color-text-3)' }}>
            {isConfigured ? (configuredSummary ?? configuredHint) : notConfiguredHint}
          </p>
        </div>

        {/* Chevron or config link */}
        {isConfigured ? (
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            className="shrink-0 transition-transform duration-200"
            style={{
              color: 'var(--color-text-3)',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <Link
            href={link}
            onClick={e => e.stopPropagation()}
            className="text-[11px] font-semibold shrink-0 hover:opacity-75 transition-opacity"
            style={{ color: 'var(--color-primary)' }}
          >
            Add →
          </Link>
        )}
      </button>

      {/* Expanded dialogue preview */}
      <AnimatePresence initial={false}>
        {expanded && dialogue && (
          <motion.div
            key="dialogue"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              <div
                className="rounded-xl p-3"
                style={{ backgroundColor: 'var(--color-hover)' }}
              >
                <p className="text-[10px] font-semibold tracking-wider uppercase mb-2" style={{ color: 'var(--color-text-3)' }}>
                  How your agent responds
                </p>
                <Dialogue caller={dialogue.caller} agent={dialogue.agent} agentName={agentName} />
              </div>
              <Link
                href={link}
                className="text-[11px] font-medium mt-2 inline-block hover:opacity-75 transition-opacity"
                style={{ color: 'var(--color-text-3)' }}
              >
                Edit in settings →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function AgentIntelligenceSection({
  agentName,
  businessName,
  hoursWeekday,
  faqs,
  businessFacts,
  websiteUrl,
  hasKnowledge,
  hasSms,
  hasBooking,
  hasTransfer,
  isTrial,
  clientId,
}: AgentIntelligenceSectionProps) {
  const { openUpgradeModal } = useUpgradeModal()

  const hoursSnippet = parseHoursSnippet(hoursWeekday)
  const factSnippet = extractFactSnippet(businessFacts)
  const domain = formatDomain(websiteUrl)
  const firstFaq = faqs.length > 0 ? faqs[0] : null

  const sourceCount = [!!hoursSnippet, !!firstFaq || !!factSnippet, !!domain, hasKnowledge].filter(Boolean).length

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--color-text-3)' }}>
          Agent Intelligence
        </p>
        {sourceCount > 0 && (
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'rgba(37,99,235,0.1)', color: 'var(--color-primary)' }}
          >
            {sourceCount} source{sourceCount !== 1 ? 's' : ''} active
          </span>
        )}
      </div>

      {/* Knowledge sources card */}
      <div className="rounded-2xl overflow-hidden card-surface">
        {/* Card header */}
        <div className="px-4 pt-4 pb-3 flex items-center gap-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase" style={{ color: 'var(--color-text-2)' }}>
            What {agentName} knows
          </p>
          <p className="text-[11px] t3 ml-auto">Tap any active row to see a preview</p>
        </div>

        {/* Business Hours */}
        <KnowledgeRow
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: hoursSnippet ? 'var(--color-primary)' : 'var(--color-text-3)' }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          label="Business hours"
          configured={!!hoursSnippet}
          configuredSummary={hoursSnippet ?? undefined}
          notConfiguredHint="Not set — agent can't answer 'are you open?'"
          dialogue={hoursSnippet ? {
            caller: 'Hey, are you guys open right now?',
            agent: `Yes! We're open — ${hoursSnippet}. How can I help you today?`,
          } : null}
          link="/dashboard/settings?tab=knowledge"
          agentName={agentName}
        />

        {/* FAQ / Business Facts */}
        <KnowledgeRow
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: firstFaq || factSnippet ? 'var(--color-primary)' : 'var(--color-text-3)' }}>
              <path d="M8 9h8M8 13h5M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          label="Q&A and business facts"
          configured={!!(firstFaq || factSnippet)}
          configuredSummary={firstFaq ? `"${firstFaq.q.slice(0, 45)}${firstFaq.q.length > 45 ? '…' : ''}"` : undefined}
          configuredHint={faqs.length > 0 ? `${faqs.length} Q&A pair${faqs.length !== 1 ? 's' : ''} configured` : 'Business facts set'}
          notConfiguredHint="Not set — agent falls back to 'I'll have someone follow up'"
          dialogue={firstFaq ? {
            caller: firstFaq.q,
            agent: firstFaq.a.slice(0, 120) + (firstFaq.a.length > 120 ? '…' : ''),
          } : factSnippet ? {
            caller: `What can you tell me about ${businessName}?`,
            agent: factSnippet,
          } : null}
          link="/dashboard/settings?tab=knowledge"
          agentName={agentName}
        />

        {/* Website knowledge */}
        <KnowledgeRow
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: domain ? 'var(--color-primary)' : 'var(--color-text-3)' }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke="currentColor" strokeWidth="2" />
            </svg>
          }
          label="Website knowledge"
          configured={!!domain}
          configuredSummary={domain ?? undefined}
          configuredHint="Website scraped and indexed"
          notConfiguredHint="Not set — add your URL to train your agent automatically"
          dialogue={domain ? {
            caller: 'How did you guys get started?',
            agent: `Great question! I pulled some info from ${domain} — let me share what I know. If I miss anything, I'll grab your details and have the team follow up.`,
          } : null}
          link="/dashboard/settings?tab=knowledge"
          agentName={agentName}
        />

        {/* Document knowledge base */}
        <KnowledgeRow
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: hasKnowledge ? 'var(--color-primary)' : 'var(--color-text-3)' }}>
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          label="Document library"
          configured={hasKnowledge}
          configuredSummary="Docs indexed — agent searches during calls"
          notConfiguredHint="Upload PDFs, menus, price lists, or any docs"
          dialogue={hasKnowledge ? {
            caller: 'Do you have a price list?',
            agent: `Let me check what I have on file… Yes! Based on your documents, here's what I found. Want me to send you the full details after the call?`,
          } : null}
          link="/dashboard/settings?tab=knowledge"
          agentName={agentName}
        />
      </div>

      {/* Unlock more capabilities */}
      {isTrial && (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold tracking-[0.15em] uppercase px-1" style={{ color: 'var(--color-text-3)' }}>
            Unlock when you go live
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* SMS Follow-up */}
            {!hasSms && (
              <UnlockCard
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-text-2)' }}>
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
                label="SMS Follow-up"
                tagline="Auto-text every caller"
                planLabel="Receptionist +"
                preview={
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium t2">📱 Auto-sent after every call:</p>
                    <p className="text-[11px] t3 italic">"Hi! Thanks for calling {businessName}. We got your message and will follow up shortly. — {agentName}"</p>
                  </div>
                }
                onUnlock={() => openUpgradeModal('unlock_sms', clientId, undefined)}
              />
            )}

            {/* IVR Menu */}
            <UnlockCard
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-text-2)' }}>
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 8.96a19.79 19.79 0 01-3.07-8.67A2 2 0 012.88 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
              label="Voicemail Menu"
              tagline="Press 1 for voicemail, 2 for agent"
              planLabel="Receptionist +"
              preview={
                <div className="space-y-1 text-[11px] t3">
                  <p className="font-medium t2">Caller hears on answer:</p>
                  <p className="italic">"Press 1 to leave a voicemail. Press 2 to speak with our AI. Press 0 for a callback."</p>
                </div>
              }
              onUnlock={() => openUpgradeModal('unlock_ivr', clientId, undefined)}
            />

            {/* Calendar Booking */}
            {!hasBooking && (
              <UnlockCard
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-text-2)' }}>
                    <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                }
                label="Book Appointments"
                tagline="Agent books directly into your calendar"
                planLabel="Booking Plan"
                preview={
                  <div className="space-y-1 text-[11px] t3">
                    <p className="font-medium t2">During a call, agent can say:</p>
                    <p className="italic">"I can book that for you right now. How does Tuesday at 2 PM work?"</p>
                    <p className="text-green-400">✓ Booked → confirmation sent to caller</p>
                  </div>
                }
                onUnlock={() => openUpgradeModal('unlock_booking', clientId, undefined)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
