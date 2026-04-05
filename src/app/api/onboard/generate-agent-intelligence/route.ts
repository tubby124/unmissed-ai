/**
 * POST /api/onboard/generate-agent-intelligence
 *
 * Given ALL available business context (GBP, niche, services, caller reasons,
 * website scrape facts), generates a rich Agent Intelligence Seed:
 *   - TRIAGE_DEEP with intent buckets, outcomes, and business-specific routing
 *   - GREETING_LINE with capability signal (Pattern 1 from working-agent-patterns)
 *   - URGENCY_KEYWORDS business-specific urgency triggers (Pattern 4)
 *   - FORBIDDEN_EXTRA niche-specific NEVER list (Pattern 5)
 *
 * This is the "smart agent from day 1" endpoint — generates what previously
 * required manual prompt tuning by Hasan for each client.
 *
 * Public — no auth. Rate limited 5/IP/min.
 */

import { NextRequest, NextResponse } from 'next/server'
import { SlidingWindowRateLimiter } from '@/lib/rate-limiter'
import { NICHE_DEFAULTS } from '@/lib/prompt-config/niche-defaults'

const limiter = new SlidingWindowRateLimiter(5, 60 * 1000)

interface AgentIntelligenceRequest {
  businessName: string
  niche: string
  agentName?: string
  gbpDescription?: string
  manualDescription?: string
  services?: string[]
  callerReasons?: string[]
  hours?: string
  city?: string
  websiteFacts?: string[]
  websiteQa?: { q: string; a: string }[]
  ownerName?: string
  selectedPlan?: string
  calendarEnabled?: boolean
}

interface AgentIntelligenceSeed {
  TRIAGE_DEEP: string
  GREETING_LINE: string
  URGENCY_KEYWORDS: string
  FORBIDDEN_EXTRA: string
}

// Labels for the Haiku prompt
const NICHE_LABELS: Record<string, string> = {
  auto_glass: 'auto glass repair shop',
  hvac: 'HVAC contractor (heating/cooling)',
  plumbing: 'plumbing company',
  dental: 'dental clinic',
  legal: 'law firm',
  salon: 'hair salon / beauty salon',
  real_estate: 'real estate agent/team',
  property_management: 'property management company',
  restaurant: 'restaurant',
  print_shop: 'print shop / signage company',
  barbershop: 'barbershop',
  mechanic_shop: 'auto mechanic / car repair shop',
  pest_control: 'pest control company',
  electrician: 'electrical contractor',
  locksmith: 'locksmith service',
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const check = limiter.check(ip)
  if (!check.allowed) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  let body: AgentIntelligenceRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.businessName?.trim() || !body.niche?.trim()) {
    return NextResponse.json({ error: 'businessName and niche required' }, { status: 400 })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    // Fallback: return niche defaults as-is
    return NextResponse.json({ seed: buildFallbackSeed(body) })
  }

  // Build the context block for Haiku
  const nicheLabel = NICHE_LABELS[body.niche] || body.niche.replace(/_/g, ' ')
  const agentName = body.agentName || 'the AI assistant'
  const ownerName = body.ownerName || 'the owner'

  const contextLines: string[] = [
    `Business: "${body.businessName}" — a ${nicheLabel}`,
  ]
  if (body.city) contextLines.push(`Location: ${body.city}`)
  if (body.hours) contextLines.push(`Hours: ${body.hours}`)
  if (body.services?.length) contextLines.push(`Services offered: ${body.services.join(', ')}`)
  if (body.callerReasons?.length) {
    contextLines.push(`Owner says top reasons people call:\n${body.callerReasons.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}`)
  }
  if (body.gbpDescription) contextLines.push(`Google Business description: "${body.gbpDescription}"`)
  if (!body.gbpDescription && body.manualDescription) contextLines.push(`Business description (owner-provided): "${body.manualDescription}"`)
  if (body.websiteFacts?.length) {
    contextLines.push(`Facts from their website:\n${body.websiteFacts.slice(0, 10).map(f => `  - ${f}`).join('\n')}`)
  }
  if (body.websiteQa?.length) {
    contextLines.push(`Q&A from their website:\n${body.websiteQa.slice(0, 5).map(qa => `  Q: ${qa.q}\n  A: ${qa.a}`).join('\n')}`)
  }

  const contextBlock = contextLines.join('\n')

  const prompt = `You are an expert voice agent designer. You configure AI phone answering agents for small businesses. You are creating the intelligence seed for a new agent.

BUSINESS CONTEXT:
${contextBlock}

---

Generate 4 fields that make this agent smart from day 1. Use ONLY information from the context above — do not invent services, hours, or facts not provided.

FIELD 1 — TRIAGE_DEEP
Intent routing blocks. Each caller intent gets its own block with:
- INTENT_NAME (ALLCAPS)
- "Ask:" — a specific opening question for THIS business (not generic)
- "Triggers:" — 4-6 phrases callers actually say
- "→ Collect:" — what info to gather for this intent
- "→ Outcome:" — one of: book appointment | give quote callback | answer from knowledge | take message for ${ownerName} | transfer to ${ownerName}

Rules:
- 3-5 intent blocks based on the business type and caller reasons provided
- Each intent must end with a SPECIFIC outcome, not "someone will follow up"
- For ORDER intents (food, service requests): add "→ Before closing: read back the full order — 'so that's [items] for [pickup/delivery] under [name] at [time] — did I get that right?'" as the last step before outcome
- Add URGENT block — what triggers urgency for THIS business specifically
- Add SPAM_OR_WRONG_NUMBER as final block
- Be specific to "${body.businessName}" — use their actual services/context
- Close actions must name "${ownerName}" (not "the team" or "someone")

FIELD 2 — GREETING_LINE
The agent's opening line when answering the phone. This is the FIRST thing the caller hears — it must sound human, warm, and confident. Not robotic.

Rules:
- Start with business name naturally — "${body.businessName}, this is ${agentName}"
- Signal 1-2 things the agent can help with, specific to THIS business
- End with an open question that invites the caller to talk
- NO "AI assistant" or "virtual receptionist" — just sound like a real person
- Keep it under 25 words — short and punchy
- Sound like someone who LOVES their job, not a script reader

Good examples:
- "Thanks for calling Mike's Auto Glass, this is Jade — I can help with quotes, claims, or scheduling. What's going on with your windshield?"
- "Hey! Red Swan Pizza, this is Ava — ordering, reservations, or catering, what can I do for you?"
- "Good [time of day], ${body.businessName}, ${agentName} speaking — how can I help you today?"

Bad examples (DO NOT generate these):
- "${body.businessName} — ${agentName} here, AI assistant. I can help with scheduling and quotes — how can I assist you today?" (robotic, too formal)
- "Welcome to ${body.businessName}! I'm ${agentName}, your virtual receptionist..." (nobody talks like this)

FIELD 3 — URGENCY_KEYWORDS
Comma-separated list of 8-12 phrases that signal urgency for THIS specific business type.
Include business-specific emergencies, not just generic ones.

FIELD 4 — FORBIDDEN_EXTRA
2-4 rules specific to THIS business type about what the agent must NEVER say or commit to.
Format each rule on its own line starting with "NEVER".
Focus on things that would create liability or false expectations for THIS kind of business.

---

Return ONLY valid JSON with no other text:
{"TRIAGE_DEEP":"...","GREETING_LINE":"...","URGENCY_KEYWORDS":"...","FORBIDDEN_EXTRA":"..."}`

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4-5',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      console.warn('[generate-agent-intelligence] OpenRouter error:', res.status)
      limiter.record(ip)
      return NextResponse.json({ seed: buildFallbackSeed(body) })
    }

    const data = await res.json()
    const raw = (data.choices?.[0]?.message?.content ?? '').trim()

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      limiter.record(ip)
      return NextResponse.json({ seed: buildFallbackSeed(body) })
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      limiter.record(ip)
      return NextResponse.json({ seed: buildFallbackSeed(body) })
    }

    // Haiku sometimes returns TRIAGE_DEEP as an array of objects instead of a flat string.
    // It may also return it as a string containing a JSON array (e.g. "[{...}]").
    // Convert both formats to the flat string format that prompt-slots.ts expects.
    let triageDeep = ''
    let triageArray: Array<Record<string, unknown>> | null = null

    if (Array.isArray(parsed.TRIAGE_DEEP)) {
      triageArray = parsed.TRIAGE_DEEP as Array<Record<string, unknown>>
    } else if (typeof parsed.TRIAGE_DEEP === 'string') {
      const trimmed = parsed.TRIAGE_DEEP.trim()
      // Detect stringified JSON array
      if (trimmed.startsWith('[')) {
        try {
          const arr = JSON.parse(trimmed)
          if (Array.isArray(arr)) triageArray = arr as Array<Record<string, unknown>>
        } catch { /* not valid JSON array — use as flat text */ }
      }
      if (!triageArray) triageDeep = trimmed
    }

    if (triageArray) {
      triageDeep = triageArray
        .map(block => {
          const name = String(block.INTENT_NAME || block.intent_name || '').toUpperCase()
          const ask = String(block.Ask || block.ask || '')
          const rawTriggers = block.Triggers || block.triggers
          const triggers = Array.isArray(rawTriggers)
            ? (rawTriggers as string[]).join(', ')
            : String(rawTriggers || '')
          const rawCollect = block.Collect || block.collect
          const collect = Array.isArray(rawCollect)
            ? (rawCollect as string[]).join(', ')
            : String(rawCollect || '')
          const outcome = String(block.Outcome || block.outcome || '')
          return `${name}:\nAsk: "${ask}"\nTriggers: ${triggers}\n→ Collect: ${collect}\n→ Outcome: ${outcome}`
        })
        .join('\n\n')
    }

    const seed: AgentIntelligenceSeed = {
      TRIAGE_DEEP: triageDeep,
      GREETING_LINE: typeof parsed.GREETING_LINE === 'string' ? parsed.GREETING_LINE.trim() : '',
      URGENCY_KEYWORDS: typeof parsed.URGENCY_KEYWORDS === 'string' ? parsed.URGENCY_KEYWORDS.trim() : '',
      FORBIDDEN_EXTRA: typeof parsed.FORBIDDEN_EXTRA === 'string' ? parsed.FORBIDDEN_EXTRA.trim() : '',
    }

    // Validate: only use fields that look reasonable
    if (!seed.TRIAGE_DEEP || seed.TRIAGE_DEEP.length < 50) {
      seed.TRIAGE_DEEP = buildFallbackSeed(body).TRIAGE_DEEP
    }

    // P1-B: Calendar booking guard — if no calendar is connected, replace booking outcomes
    // with callback language so the agent never promises a time slot it can't deliver.
    if (body.calendarEnabled === false) {
      seed.TRIAGE_DEEP = seed.TRIAGE_DEEP
        .replace(/→\s*Outcome:\s*book\s+appointment/gi,
          "→ Outcome: callback — \"I've got all those details logged. I'll have {{CLOSE_PERSON}} call you back to get you on the schedule — does that work?\"")
        .replace(/bookCalendar\b/g, 'callback')
    }
    if (!seed.GREETING_LINE || seed.GREETING_LINE.length < 20) {
      seed.GREETING_LINE = ''  // Let niche wow greetings handle it
    }

    // Fallback: if validator cleared it (or Haiku returned empty), use template
    if (!seed.GREETING_LINE) {
      seed.GREETING_LINE = `Thank you for calling ${body.businessName}, this is ${agentName}. How can I help you today?`
    }
    if (!seed.URGENCY_KEYWORDS || seed.URGENCY_KEYWORDS.length < 10) {
      seed.URGENCY_KEYWORDS = ''  // Let niche defaults handle it
    }

    limiter.record(ip)
    return NextResponse.json({ seed })
  } catch (err) {
    if (err instanceof Error && err.name !== 'AbortError') {
      console.warn('[generate-agent-intelligence] error:', err.message)
    }
    limiter.record(ip)
    return NextResponse.json({ seed: buildFallbackSeed(body) })
  }
}

/**
 * Fallback when OpenRouter is unavailable — use niche defaults.
 * Better than nothing, but won't have business-specific intelligence.
 */
function buildFallbackSeed(body: AgentIntelligenceRequest): AgentIntelligenceSeed {
  const nicheDefaults = NICHE_DEFAULTS[body.niche] ?? NICHE_DEFAULTS.other
  return {
    TRIAGE_DEEP: nicheDefaults.TRIAGE_DEEP || '',
    GREETING_LINE: '', // Let prompt-slots NICHE_WOW_GREETINGS handle it
    URGENCY_KEYWORDS: nicheDefaults.URGENCY_KEYWORDS || '',
    FORBIDDEN_EXTRA: '', // Let niche-specific logic in buildSlotContext handle it
  }
}
