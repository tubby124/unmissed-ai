'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────

type ItemKind =
  | 'business_fact'
  | 'faq_pair'
  | 'operating_policy'
  | 'call_behavior_instruction'
  | 'pricing_or_offer'
  | 'hours_or_availability'
  | 'location_or_service_area'
  | 'unsupported_or_ambiguous'
  | 'conflict_flag'

interface NormalizedItem {
  kind: ItemKind
  question: string
  answer: string
  fact_text: string
  confidence: number
  requires_manual_review: boolean
  review_reason: string
}

type Step = 'input' | 'review' | 'done'

// ── Kind metadata ─────────────────────────────────────────────────────────────

const KIND_META: Record<ItemKind, { label: string; color: string; approvable: boolean }> = {
  business_fact:             { label: 'Fact',         color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',    approvable: true },
  faq_pair:                  { label: 'FAQ',          color: 'bg-green-500/10 text-green-400 border-green-500/20', approvable: true },
  operating_policy:          { label: 'Policy',       color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', approvable: true },
  pricing_or_offer:          { label: 'Pricing',      color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', approvable: true },
  hours_or_availability:     { label: 'Hours',        color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',    approvable: true },
  location_or_service_area:  { label: 'Location',     color: 'bg-teal-500/10 text-teal-400 border-teal-500/20',   approvable: true },
  call_behavior_instruction: { label: 'Behavior',     color: 'bg-red-500/10 text-red-400 border-red-500/20',      approvable: false },
  unsupported_or_ambiguous:  { label: 'Ambiguous',    color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',   approvable: false },
  conflict_flag:             { label: 'Conflict',     color: 'bg-orange-500/10 text-orange-400 border-orange-500/20', approvable: false },
}

// High-risk kinds need manual verification before import (content can be stale/inaccurate)
const HIGH_RISK_KINDS = new Set<ItemKind>([
  'pricing_or_offer',
  'hours_or_availability',
  'location_or_service_area',
  'operating_policy',
])

// ── Sub-components ────────────────────────────────────────────────────────────

function KindBadge({ kind }: { kind: ItemKind }) {
  const meta = KIND_META[kind]
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${meta.color}`}>
      {meta.label}
    </span>
  )
}

function ConfidenceDot({ value }: { value: number }) {
  const color = value >= 0.9 ? 'bg-green-400' : value >= 0.7 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <span className={`inline-block w-1.5 h-1.5 rounded-full ${color} shrink-0`} title={`Confidence: ${Math.round(value * 100)}%`} />
  )
}

// ── Step 1 — Input ────────────────────────────────────────────────────────────

function InputStep({
  value,
  onChange,
  onAnalyze,
  loading,
}: {
  value: string
  onChange: (v: string) => void
  onAnalyze: () => void
  loading: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-xs t2 font-medium">Paste business information</p>
        <p className="text-[11px] t3">
          Paste any text — website copy, emails, notes, brochures. The AI will classify and extract each distinct piece of knowledge for your review.
        </p>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={"We are open Monday through Friday 8am–6pm and Saturday 9am–4pm.\nFree estimates on all jobs over $200.\nWe serve Greater Vancouver and the Fraser Valley...\n\n(Paste any text here — we'll extract and classify it for you)"}
        rows={10}
        className="w-full text-[12px] p-3 rounded-xl border b-theme bg-surface t1 font-mono resize-y focus:outline-none focus:ring-1 focus:ring-blue-500/40 placeholder:t3"
      />
      <div className="flex items-center justify-between">
        <p className="text-[10px] t3">{value.length.toLocaleString()} / 20,000 chars</p>
        <button
          onClick={onAnalyze}
          disabled={loading || !value.trim() || value.length > 20_000}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analyzing…
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Analyze with AI
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ── Step 2 — Review ───────────────────────────────────────────────────────────

function ReviewStep({
  items,
  warnings,
  approved,
  onToggle,
  onApply,
  onBack,
  loading,
}: {
  items: NormalizedItem[]
  warnings: string[]
  approved: boolean[]
  onToggle: (i: number) => void
  onApply: () => void
  onBack: () => void
  loading: boolean
}) {
  const [verifiedHighRisk, setVerifiedHighRisk] = useState<Set<number>>(new Set())

  function toggleVerified(i: number) {
    setVerifiedHighRisk(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const approvedCount = approved.filter(Boolean).length
  const approvableItems = items.filter((item) => KIND_META[item.kind].approvable)
  const flaggedItems = items.filter((item) => !KIND_META[item.kind].approvable)
  const hasFaqItems = items.some(item => item.kind === 'faq_pair')

  // Block apply if any approved high-risk item hasn't been verified
  const unverifiedHighRisk = items.filter((item, i) =>
    approved[i] && HIGH_RISK_KINDS.has(item.kind) && !verifiedHighRisk.has(i)
  ).length
  const canApply = approvedCount > 0 && unverifiedHighRisk === 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs t2 font-medium">Review extracted items</p>
          <p className="text-[11px] t3">
            {approvedCount} of {approvableItems.length} items selected
            {unverifiedHighRisk > 0 && (
              <span className="ml-1 text-amber-400">· {unverifiedHighRisk} need verification</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="px-3 py-1.5 rounded-xl text-xs font-medium border b-theme t2 hover:bg-hover transition-colors"
          >
            Back
          </button>
          <button
            onClick={onApply}
            disabled={loading || !canApply}
            title={unverifiedHighRisk > 0 ? `Verify ${unverifiedHighRisk} high-risk item${unverifiedHighRisk !== 1 ? 's' : ''} before importing` : undefined}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving…' : `Add ${approvedCount} item${approvedCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
          {warnings.map((w, i) => (
            <p key={i} className="text-[11px] text-amber-400">{w}</p>
          ))}
        </div>
      )}

      {hasFaqItems && (
        <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
          <p className="text-[11px] text-blue-400 leading-snug">
            <span className="font-semibold">Note:</span> FAQs approved here cannot be individually removed — manage them in{' '}
            <a href="/dashboard/settings?tab=knowledge" className="underline underline-offset-2 hover:opacity-75">Settings → FAQ</a>.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {items.map((item, i) => {
          const meta = KIND_META[item.kind]
          const isApprovable = meta.approvable
          const isApproved = approved[i]
          const displayText = item.kind === 'faq_pair'
            ? `Q: ${item.question}\nA: ${item.answer}`
            : item.fact_text

          return (
            <div
              key={i}
              className={`rounded-xl border p-3 transition-colors ${
                isApprovable
                  ? isApproved
                    ? 'b-theme bg-green-500/5'
                    : 'b-theme bg-surface'
                  : 'border-red-500/20 bg-red-500/5'
              }`}
            >
              <div className="flex items-start gap-2">
                {isApprovable ? (
                  <button
                    onClick={() => onToggle(i)}
                    className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                      isApproved
                        ? 'bg-green-500 border-green-500'
                        : 'border-zinc-500 bg-surface'
                    }`}
                  >
                    {isApproved && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ) : (
                  <div className="mt-0.5 w-4 h-4 rounded border border-red-500/30 bg-red-500/10 shrink-0 flex items-center justify-center">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </div>
                )}

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <KindBadge kind={item.kind} />
                    <ConfidenceDot value={item.confidence} />
                    {item.requires_manual_review && (
                      <span className="text-[9px] font-medium text-amber-400">review needed</span>
                    )}
                  </div>
                  <p className="text-[11px] t2 whitespace-pre-wrap break-words leading-relaxed">{displayText}</p>
                  {item.review_reason && (
                    <p className="text-[10px] text-amber-400/80 italic">{item.review_reason}</p>
                  )}
                  {isApprovable && isApproved && HIGH_RISK_KINDS.has(item.kind) && (
                    <label className="flex items-start gap-1.5 cursor-pointer mt-1 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <input
                        type="checkbox"
                        checked={verifiedHighRisk.has(i)}
                        onChange={() => toggleVerified(i)}
                        className="mt-0.5 w-3 h-3 accent-amber-500 shrink-0"
                      />
                      <span className="text-[10px] text-amber-400/90 leading-snug">
                        I&apos;ve verified this is current and accurate (pricing, hours, and location info can change — incorrect data misleads callers)
                      </span>
                    </label>
                  )}
                  {!isApprovable && (
                    <p className="text-[10px] text-red-400/80">
                      {item.kind === 'call_behavior_instruction'
                        ? 'Behavior instructions require manual review — add them to the prompt directly.'
                        : 'Cannot be auto-imported — review and add manually if needed.'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {flaggedItems.length > 0 && (
        <p className="text-[10px] t3">
          {flaggedItems.length} item{flaggedItems.length !== 1 ? 's' : ''} flagged for manual review — these cannot be auto-imported.
        </p>
      )}
    </div>
  )
}

// ── Step 3 — Done ─────────────────────────────────────────────────────────────

function DoneStep({
  faqsAdded,
  chunksCreated,
  onReset,
}: {
  faqsAdded: number
  chunksCreated: number
  onReset: () => void
}) {
  return (
    <div className="space-y-3">
      <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20 space-y-2">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <p className="text-sm font-semibold text-green-400">Knowledge imported</p>
        </div>
        <div className="space-y-1">
          {faqsAdded > 0 && (
            <p className="text-[11px] t2">
              <span className="font-semibold text-green-400">{faqsAdded}</span> FAQ{faqsAdded !== 1 ? 's' : ''} added to Q&amp;A
            </p>
          )}
          {chunksCreated > 0 && (
            <p className="text-[11px] t2">
              <span className="font-semibold text-green-400">{chunksCreated}</span> knowledge chunk{chunksCreated !== 1 ? 's' : ''} added to knowledge base
            </p>
          )}
          {faqsAdded === 0 && chunksCreated === 0 && (
            <p className="text-[11px] t3">No new items were added (may have been duplicates).</p>
          )}
        </div>
        <p className="text-[10px] t3">Your agent will use this knowledge on the next call.</p>
      </div>
      <button
        onClick={onReset}
        className="text-xs t3 hover:t2 transition-colors underline underline-offset-2"
      >
        Import more text
      </button>
    </div>
  )
}

// ── Step 2b — Saving animation ────────────────────────────────────────────────

function SavingState({ items, approved }: { items: NormalizedItem[]; approved: boolean[] }) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const approvedItems = items.filter((item, i) => approved[i] && KIND_META[item.kind].approvable)

  useEffect(() => {
    if (approvedItems.length <= 1) return
    const t = setInterval(() => setCurrentIdx(i => (i + 1) % approvedItems.length), 800)
    return () => clearInterval(t)
  }, [approvedItems.length])

  const current = approvedItems[currentIdx]

  return (
    <div className="flex flex-col items-center gap-5 py-8">
      {/* Pulsing learning orb */}
      <div className="relative flex items-center justify-center w-20 h-20">
        <div
          className="absolute inset-0 rounded-full bg-green-500/10 animate-ping"
          style={{ animationDuration: '2s' }}
        />
        <div
          className="absolute inset-2 rounded-full bg-green-500/15 animate-ping"
          style={{ animationDuration: '2s', animationDelay: '0.5s' }}
        />
        <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>
      </div>

      <div className="text-center space-y-1">
        <p className="text-sm font-semibold t1">Training your agent…</p>
        <p className="text-[11px] t3">
          Embedding {approvedItems.length} item{approvedItems.length !== 1 ? 's' : ''} into knowledge base
        </p>
      </div>

      {current && (
        <div className="w-full space-y-2">
          <p className="text-[10px] t3 text-center font-medium tracking-wide uppercase">Currently learning</p>
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 space-y-1.5 min-h-[60px]">
            <KindBadge kind={current.kind} />
            <p className="text-[11px] t2 line-clamp-2 leading-relaxed">
              {current.kind === 'faq_pair'
                ? `Q: ${current.question}`
                : current.fact_text}
            </p>
          </div>
          {approvedItems.length > 1 && (
            <div className="flex justify-center gap-1 pt-1">
              {approvedItems.map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all duration-300 ${
                    i === currentIdx
                      ? 'w-3 h-1.5 bg-green-500'
                      : 'w-1.5 h-1.5 bg-zinc-700'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface KnowledgeCompilerProps {
  clientId: string
  isAdmin: boolean
}

export default function KnowledgeCompiler({ clientId, isAdmin }: KnowledgeCompilerProps) {
  const [step, setStep] = useState<Step>('input')
  const [rawInput, setRawInput] = useState('')
  const [items, setItems] = useState<NormalizedItem[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [approved, setApproved] = useState<boolean[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ faqsAdded: number; chunksCreated: number } | null>(null)

  async function handleAnalyze() {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/knowledge/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isAdmin ? { raw_input: rawInput, client_id: clientId } : { raw_input: rawInput }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Analysis failed' }))
        toast.error(error || 'Analysis failed — try again')
        return
      }
      const data = await res.json() as { items: NormalizedItem[]; warnings: string[] }
      if (!data.items?.length) {
        toast.error('No knowledge items found in the provided text')
        return
      }
      setItems(data.items)
      setWarnings(data.warnings ?? [])
      // Default: approve all approvable items that don't require manual review
      setApproved(data.items.map(item =>
        KIND_META[item.kind].approvable && !item.requires_manual_review
      ))
      setStep('review')
    } catch {
      toast.error('Analysis failed — try again')
    } finally {
      setLoading(false)
    }
  }

  function handleToggle(i: number) {
    setApproved(prev => prev.map((v, idx) => idx === i ? !v : v))
  }

  async function handleApply() {
    const faqItems: { q: string; a: string }[] = []
    const factItems: { kind: string; text: string }[] = []

    items.forEach((item, i) => {
      if (!approved[i]) return
      if (item.kind === 'faq_pair') {
        faqItems.push({ q: item.question, a: item.answer })
      } else if (KIND_META[item.kind].approvable) {
        factItems.push({ kind: item.kind, text: item.fact_text })
      }
    })

    if (faqItems.length === 0 && factItems.length === 0) return

    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/knowledge/compile/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isAdmin
          ? { faq_items: faqItems, fact_items: factItems, client_id: clientId }
          : { faq_items: faqItems, fact_items: factItems }
        ),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Failed to save' }))
        toast.error(error || 'Failed to save knowledge — try again')
        return
      }
      const data = await res.json() as { ok: boolean; faqsAdded: number; chunksCreated: number }
      setResult({ faqsAdded: data.faqsAdded, chunksCreated: data.chunksCreated })
      setStep('done')
    } catch {
      toast.error('Failed to save knowledge — try again')
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setStep('input')
    setRawInput('')
    setItems([])
    setWarnings([])
    setApproved([])
    setResult(null)
  }

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5 space-y-4">
      <div className="space-y-0.5">
        <p className="text-xs font-semibold t1">AI Knowledge Compiler</p>
        <p className="text-[11px] t3">Paste any text — the AI extracts and classifies every piece of knowledge for your review before adding it.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {(['input', 'review', 'done'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className={`h-px w-6 ${step === 'input' && i > 0 ? 'bg-zinc-700' : step === 'review' && i > 1 ? 'bg-zinc-700' : 'bg-green-500/50'}`} />}
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
              step === s ? 'bg-blue-600 text-white' :
              (step === 'review' && i === 0) || step === 'done' ? 'bg-green-600/30 text-green-400' :
              'bg-zinc-800 text-zinc-500'
            }`}>
              {step === 'done' || (step === 'review' && i === 0) ? '✓' : i + 1}
            </div>
            <span className={`text-[10px] font-medium ${step === s ? 't2' : 't3'}`}>
              {s === 'input' ? 'Paste' : s === 'review' ? 'Review' : 'Done'}
            </span>
          </div>
        ))}
      </div>

      {step === 'input' && (
        <InputStep
          value={rawInput}
          onChange={setRawInput}
          onAnalyze={handleAnalyze}
          loading={loading}
        />
      )}
      {step === 'review' && !loading && (
        <ReviewStep
          items={items}
          warnings={warnings}
          approved={approved}
          onToggle={handleToggle}
          onApply={handleApply}
          onBack={() => setStep('input')}
          loading={false}
        />
      )}
      {step === 'review' && loading && (
        <SavingState items={items} approved={approved} />
      )}
      {step === 'done' && result && (
        <DoneStep
          faqsAdded={result.faqsAdded}
          chunksCreated={result.chunksCreated}
          onReset={handleReset}
        />
      )}
    </div>
  )
}
