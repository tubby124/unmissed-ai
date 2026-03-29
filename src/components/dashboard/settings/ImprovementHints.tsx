'use client'

/**
 * ImprovementHints — Post-call suggestions component (L5)
 *
 * Shows actionable improvement hints after a test call ends.
 * Two sources of hints, merged and prioritized:
 *
 * 1. **Transcript hints** (L5): Evidence-based, from what actually happened in the call.
 *    Detected by analyzeTranscriptClient() in transcript-analysis.ts.
 *    Example: "A caller asked about booking — enable it?"
 *
 * 2. **Config hints** (existing): Capability gaps based on what's not configured.
 *    Example: "Add FAQs so your agent can answer common questions"
 *
 * Transcript hints take priority (they're evidence-based). Max 4 hints shown total.
 *
 * ## How to edit
 * - Add new config hints: extend the CONFIG_HINTS array below
 * - Change hint priority: reorder the arrays or adjust MAX_HINTS
 * - Change action types: edit FEATURE_ACTIONS in transcript-analysis.ts
 * - Change styling: edit the button classes in HintButton
 * - Add new hint categories: extend HintItem type + rendering logic
 */

import type { CallInsight, FeatureSuggestion } from '@/lib/transcript-analysis'
import { analyzeQualityMetrics } from '@/lib/quality-metrics'
import type { AgentKnowledge } from './AgentVoiceTest'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HintItem {
  icon: string
  label: string
  section: string
  /** 'transcript' hints show stronger copy + evidence badge */
  source: 'config' | 'transcript'
  /** For transcript hints: the feature key for potential one-click enable */
  feature?: FeatureSuggestion['feature']
  /** For transcript hints: what the caller actually said */
  evidence?: string
  /** Action type — determines CTA behavior */
  actionType?: 'toggle' | 'setup' | 'scroll'
  /** DB field for toggle actions */
  field?: string
}

interface ImprovementHintsProps {
  knowledge: AgentKnowledge
  /** Transcript analysis results (null if no analysis ran) */
  callInsight?: CallInsight | null
  /** Raw final transcripts for quality metric computation */
  transcripts?: Array<{ speaker: string; text: string; isFinal: boolean }>
  /** Scroll to a settings section by ID */
  onScrollTo?: (section: string) => void
}

const MAX_HINTS = 4

// ─── Config-based hints (existing behavior, now data-driven) ──────────────────

function getConfigHints(knowledge: AgentKnowledge): HintItem[] {
  const hints: HintItem[] = []

  if (!knowledge.hasFacts && !knowledge.hasFaqs)
    hints.push({ icon: '💬', label: 'Add FAQs so your agent can answer common questions', section: 'advanced-context', source: 'config' })
  if (!knowledge.hasHours)
    hints.push({ icon: '🕐', label: 'Set your business hours', section: 'hours', source: 'config' })
  if (!knowledge.hasWebsite)
    hints.push({ icon: '🌐', label: 'Add your website to teach your agent more', section: 'advanced-context', source: 'config' })
  if (!knowledge.hasBooking)
    hints.push({ icon: '📅', label: 'Connect your calendar for appointment booking', section: 'booking', source: 'config' })
  if (!knowledge.hasKnowledge)
    hints.push({ icon: '📄', label: 'Upload documents to your knowledge base', section: 'knowledge', source: 'config' })
  if (!knowledge.hasTransfer)
    hints.push({ icon: '📞', label: 'Add a forwarding number for urgent calls', section: 'agent-config', source: 'config' })

  return hints
}

// ─── Transcript-based hints (L5 new) ──────────────────────────────────────────

const FEATURE_ICONS: Record<FeatureSuggestion['feature'], string> = {
  booking: '📅',
  transfer: '📞',
  sms: '💬',
  hours: '🕐',
  knowledge: '📄',
  website: '🌐',
}

const FEATURE_LABELS: Record<FeatureSuggestion['feature'], string> = {
  booking: 'A caller tried to book — enable appointments?',
  transfer: 'A caller wanted to speak to someone — add call forwarding?',
  sms: 'A caller asked for a text — enable SMS?',
  hours: 'A caller asked about your hours — set them up?',
  knowledge: 'Your agent couldn\'t answer a question — add to knowledge?',
  website: 'Add your website so your agent knows more',
}

function getTranscriptHints(insight: CallInsight): HintItem[] {
  const hints: HintItem[] = []

  // Feature suggestions from transcript
  for (const suggestion of insight.featureSuggestions) {
    hints.push({
      icon: FEATURE_ICONS[suggestion.feature] || '💡',
      label: FEATURE_LABELS[suggestion.feature] || `Enable ${suggestion.feature}`,
      section: suggestion.action.section,
      source: 'transcript',
      feature: suggestion.feature,
      evidence: suggestion.evidence,
      actionType: suggestion.action.type,
      field: suggestion.action.field,
    })
  }

  // Unanswered questions -> knowledge hint
  if (insight.unansweredQuestions.length > 0 && !hints.some(h => h.feature === 'knowledge')) {
    const topQ = insight.unansweredQuestions[0]
    hints.push({
      icon: '❓',
      label: `Your agent couldn't answer: "${topQ.question.slice(0, 60)}${topQ.question.length > 60 ? '...' : ''}"`,
      section: 'knowledge',
      source: 'transcript',
      feature: 'knowledge',
      evidence: topQ.question,
    })
  }

  // Frustration signal
  if (insight.callerFrustrated) {
    hints.push({
      icon: '⚠️',
      label: 'Caller seemed frustrated — review your agent\'s responses',
      section: 'prompt-editor',
      source: 'transcript',
    })
  }

  return hints
}

// ─── Dedup: remove config hints that transcript hints already cover ───────────

function mergeHints(transcriptHints: HintItem[], configHints: HintItem[]): HintItem[] {
  const coveredSections = new Set(transcriptHints.map(h => h.section))

  // Filter config hints that aren't already covered by transcript evidence
  const uniqueConfigHints = configHints.filter(h => !coveredSections.has(h.section))

  // Transcript first (evidence-based), then config (generic)
  return [...transcriptHints, ...uniqueConfigHints].slice(0, MAX_HINTS)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImprovementHints({ knowledge, callInsight, transcripts, onScrollTo }: ImprovementHintsProps) {
  const transcriptHints = callInsight ? getTranscriptHints(callInsight) : []
  const configHints = getConfigHints(knowledge)

  // 8o quality signal: if agent confidence is low, inject a hint toward the prompt editor
  const qualityHints: HintItem[] = []
  if (transcripts && transcripts.length > 0) {
    const messages = transcripts
      .filter(t => t.isFinal)
      .map(t => ({ role: t.speaker === 'agent' ? 'agent' as const : 'user' as const, text: t.text }))
    if (messages.length > 0) {
      const metrics = analyzeQualityMetrics(messages)
      if (metrics.agent_confidence < 0.6) {
        qualityHints.push({
          icon: '🧠',
          label: `Agent confidence was low (${Math.round(metrics.agent_confidence * 100)}%) — review your knowledge base`,
          section: 'knowledge',
          source: 'transcript',
        })
      }
    }
  }

  const hints = mergeHints([...transcriptHints, ...qualityHints], configHints)

  if (hints.length === 0) return null

  function handleHintClick(hint: HintItem) {
    onScrollTo?.(hint.section)
    // L5-GAP: When clicking a knowledge/advanced-context hint, signal KnowledgeEngineCard
    // to refresh its gaps list so the newly-inserted transcript questions appear immediately
    if (hint.section === 'knowledge' || hint.section === 'advanced-context') {
      window.dispatchEvent(new CustomEvent('knowledge-gaps-refresh'))
    }
  }

  return (
    <div className="w-full space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider t3">Ways to improve</p>
      {hints.map((h, i) => (
        <button
          key={`${h.source}-${h.section}-${i}`}
          onClick={() => handleHintClick(h)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-page border b-theme hover:border-blue-500/30 hover:bg-blue-500/[0.04] transition-colors text-left cursor-pointer group"
        >
          <span className="text-sm shrink-0">{h.icon}</span>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] t2 block truncate">{h.label}</span>
            {h.source === 'transcript' && h.evidence && (
              <span className="text-[9px] t3 block truncate mt-0.5 italic">
                Caller said: &ldquo;{h.evidence.slice(0, 50)}{h.evidence.length > 50 ? '...' : ''}&rdquo;
              </span>
            )}
          </div>
          {h.source === 'transcript' && (
            <span className="text-[8px] uppercase font-bold tracking-wider text-amber-400/70 shrink-0">
              from call
            </span>
          )}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-zinc-500 shrink-0">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      ))}
    </div>
  )
}
