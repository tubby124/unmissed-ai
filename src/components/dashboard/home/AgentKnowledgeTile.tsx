'use client'

/**
 * AgentKnowledgeTile — knowledge summary bento card.
 * Shows approved chunk count, source types, pending review badge,
 * and fact/FAQ counts. Plan-gated for knowledge backend.
 */

import { getPlanEntitlements } from '@/lib/plan-entitlements'
import type { PlanId } from '@/lib/plan-entitlements'

interface Props {
  clientId: string | null
  selectedPlan: string | null
  subscriptionStatus: string | null
  websiteScrapeStatus: string | null
  knowledge: {
    approved_chunk_count: number
    pending_review_count: number
    source_types: string[]
    last_updated_at: string | null
  }
  editableFields: {
    businessFacts: string | null
    faqs: { q: string; a: string }[]
    websiteUrl: string | null
  }
  onOpenSheet: () => void
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function SourceIcon({ source }: { source: string }) {
  if (source === 'website_scrape') return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
      <path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" stroke="currentColor" strokeWidth="2"/>
    </svg>
  )
  if (source === 'pdf' || source === 'file_upload') return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2"/>
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2"/>
    </svg>
  )
  // settings_edit / manual
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    website_scrape: 'Website',
    pdf: 'PDF',
    file_upload: 'File',
    settings_edit: 'Manual',
    manual: 'Manual',
  }
  return map[source] ?? source
}

export default function AgentKnowledgeTile({
  clientId,
  selectedPlan,
  subscriptionStatus,
  knowledge,
  editableFields,
  onOpenSheet,
}: Props) {
  const planId = (subscriptionStatus === 'trialing' ? 'trial' : (selectedPlan ?? null)) as Parameters<typeof getPlanEntitlements>[0]
  const plan = getPlanEntitlements(planId)

  const factCount = editableFields.businessFacts
    ? editableFields.businessFacts.split('\n').filter(l => l.trim().length > 0).length
    : 0
  const faqCount = editableFields.faqs.length
  const hasAnyKnowledge = factCount > 0 || faqCount > 0 || knowledge.approved_chunk_count > 0
  const hasPendingReview = knowledge.pending_review_count > 0

  if (!plan.knowledgeEnabled) {
    return (
      <div
        className="rounded-2xl p-4 card-surface flex flex-col gap-3"
        style={{ borderStyle: 'dashed', opacity: 0.85 }}
      >
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-text-3)' }}>
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase t3">Knowledge Base</p>
        </div>
        <p className="text-xs t3 leading-relaxed">
          Add a website, PDFs, or Q&A to make your agent smarter. Available on Core and Pro plans.
        </p>
        <a
          href="/dashboard/billing"
          className="text-xs font-semibold self-start"
          style={{ color: 'var(--color-primary)' }}
        >
          Upgrade to unlock →
        </a>
      </div>
    )
  }

  if (knowledge.approved_chunk_count === 0) {
    return (
      <div className="rounded-2xl p-4 card-surface space-y-2">
        <p className="text-[11px] font-semibold tracking-[0.15em] uppercase t3">Knowledge</p>
        <p className="text-sm t3">No knowledge sources yet</p>
        <button onClick={onOpenSheet} className="text-[12px] font-medium" style={{ color: 'var(--color-primary)' }}>
          Add your first source →
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={onOpenSheet}
      className="rounded-2xl p-4 card-surface flex flex-col gap-3 text-left w-full hover:bg-hover transition-colors group"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase t3">Knowledge</p>
        </div>
        <div className="flex items-center gap-2">
          {hasPendingReview && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-400">
              {knowledge.pending_review_count} pending
            </span>
          )}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="t3 opacity-0 group-hover:opacity-100 transition-opacity">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* Stats */}
      {hasAnyKnowledge ? (
        <div className="space-y-2">
          {knowledge.approved_chunk_count > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs t3">Searchable knowledge</span>
              <span className="text-xs font-semibold t1">{knowledge.approved_chunk_count} chunks</span>
            </div>
          )}
          {factCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs t3">Business facts</span>
              <span className="text-xs font-semibold t1">{factCount}</span>
            </div>
          )}
          {faqCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs t3">FAQs</span>
              <span className="text-xs font-semibold t1">{faqCount}</span>
            </div>
          )}
          {/* Source pills */}
          {knowledge.source_types.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {knowledge.source_types.map(src => (
                <span
                  key={src}
                  className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                  style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-2)' }}
                >
                  <SourceIcon source={src} />
                  {sourceLabel(src)}
                </span>
              ))}
            </div>
          )}
          {knowledge.last_updated_at && (
            <p className="text-[11px] t3">Updated {timeAgo(knowledge.last_updated_at)}</p>
          )}
        </div>
      ) : (
        <div>
          <p className="text-sm font-medium t2">No knowledge added yet</p>
          <p className="text-xs t3 mt-0.5 leading-relaxed">
            Add your website, FAQs, or business facts to make your agent smarter.
          </p>
        </div>
      )}

      {/* Pending review CTA */}
      {hasPendingReview && (
        <div
          className="rounded-lg px-3 py-2 flex items-center justify-between"
          style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          <p className="text-xs text-amber-400 font-medium">Review scraped content</p>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-amber-400">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
    </button>
  )
}
