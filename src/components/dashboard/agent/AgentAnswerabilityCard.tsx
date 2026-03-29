'use client'

import Link from 'next/link'

// ── Topic detection ────────────────────────────────────────────────────────────

interface TopicCoverage {
  topic: string
  covered: boolean
  hint?: string
}

function detectTopics(
  facts: string | null,
  extraQa: { q: string; a: string }[],
  opts: {
    businessHoursWeekday: string | null
    city: string | null
    state: string | null
    bookingEnabled: boolean
  }
): TopicCoverage[] {
  const allText = [
    facts ?? '',
    ...extraQa.map(p => `${p.q} ${p.a}`),
  ].join(' ').toLowerCase()

  const topics: TopicCoverage[] = []

  // Hours
  const hasHoursInText = /\b(hour|open|close|schedule|available|[0-9]am|[0-9]pm|\bam\b|\bpm\b)\b/.test(allText)
  topics.push({
    topic: 'Hours',
    covered: !!(opts.businessHoursWeekday || hasHoursInText),
    hint: 'Callers ask "when are you open?" — set your hours under Actions',
  })

  // Pricing
  const hasPricing = /\b(price|cost|fee|rate|charge|how much|\$|starting from|starts at|\bfree\b)\b/.test(allText)
  topics.push({
    topic: 'Pricing',
    covered: hasPricing,
    hint: 'Add Q&A like "What does [service] cost?" — callers always ask',
  })

  // Location
  const hasLocation = !!(opts.city || opts.state) || /\b(located|location|address|where are you|street|near|visit us)\b/.test(allText)
  topics.push({
    topic: 'Location',
    covered: hasLocation,
    hint: 'Add your address or city so callers know where to find you',
  })

  // Services
  const hasServices = /\b(offer|service|speciali|provide|help with|what (we|you) do|what (we|you) offer)\b/.test(allText)
  topics.push({
    topic: 'Services',
    covered: hasServices,
    hint: 'Describe what you do so callers get a clear answer to "what do you offer?"',
  })

  // Booking — only show if booking is enabled
  if (opts.bookingEnabled) {
    topics.push({
      topic: 'Appointments',
      covered: true,
    })
  }

  return topics
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AgentAnswerabilityCard({
  businessFacts,
  extraQa,
  businessHoursWeekday,
  city,
  state,
  bookingEnabled,
}: {
  businessFacts: string | null
  extraQa: { q: string; a: string }[]
  businessHoursWeekday: string | null
  city: string | null
  state: string | null
  bookingEnabled: boolean
}) {
  const validQa = (extraQa ?? []).filter(p => p.q?.trim() && p.a?.trim())
  const topics = detectTopics(businessFacts ?? null, validQa, {
    businessHoursWeekday,
    city,
    state,
    bookingEnabled,
  })

  const gaps = topics.filter(t => !t.covered)
  const covered = topics.filter(t => t.covered)
  const exampleQs = validQa.slice(0, 2)

  // Nothing to show if no knowledge at all — let the empty-state hint from "What It Knows" handle it
  if (covered.length === 0 && gaps.length === 0) return null

  return (
    <div className="rounded-2xl border b-theme bg-surface p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="t3">
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase t3">What Your Agent Can Answer</p>
        </div>
        <Link
          href="/dashboard/knowledge"
          className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
        >
          Improve
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </div>

      {/* Covered topics */}
      {covered.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {covered.map(t => (
            <span
              key={t.topic}
              className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-medium"
            >
              ✓ {t.topic}
            </span>
          ))}
        </div>
      )}

      {/* Gaps */}
      {gaps.length > 0 && (
        <div className={`space-y-1.5 ${covered.length > 0 ? 'pt-3 border-t b-theme' : ''}`}>
          <p className="text-[10px] uppercase tracking-[0.12em] t3 mb-2">Missing coverage</p>
          {gaps.map(g => (
            <div key={g.topic} className="flex items-start gap-2 text-[11px]">
              <span className="shrink-0 w-1 h-1 rounded-full bg-amber-400/60 mt-[5px]" />
              <span className="text-amber-400/80">{g.hint ?? `No ${g.topic.toLowerCase()} info added yet`}</span>
            </div>
          ))}
        </div>
      )}

      {/* Example questions */}
      {exampleQs.length > 0 && (
        <div className="mt-4 pt-3 border-t b-theme">
          <p className="text-[10px] t3 mb-2 uppercase tracking-[0.12em]">Example questions it handles</p>
          <div className="space-y-1">
            {exampleQs.map((pair, i) => (
              <p key={i} className="text-[11px] t2 truncate">
                <span className="t3">&ldquo;</span>{pair.q}<span className="t3">&rdquo;</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
