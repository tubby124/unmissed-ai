/**
 * POST /api/onboard/infer-niche
 *
 * Given a business name, uses OpenRouter/Haiku to:
 *   1. Match it to a known niche slug (returns { niche: 'plumbing' })
 *   2. OR, if no niche fits, generate smart prompt variables for 'other'
 *      (returns { niche: 'other', customVariables: { INDUSTRY, PRIMARY_CALL_REASON, ... } })
 *
 * Falls back to { niche: 'other' } on any error or if OPENROUTER_API_KEY is not set.
 * Public — no auth. Rate limited 10/IP/min.
 */

import { NextRequest, NextResponse } from 'next/server'
import { SlidingWindowRateLimiter } from '@/lib/rate-limiter'
import { NICHE_PRODUCTION_READY } from '@/lib/niche-config'

const limiter = new SlidingWindowRateLimiter(10, 60 * 1000)

const NICHE_HINTS: Record<string, string> = {
  auto_glass:          'windshield repair, auto glass, car glass replacement',
  hvac:                'heating, cooling, air conditioning, furnace, ventilation contractor',
  plumbing:            'plumber, pipes, drains, water heaters, leak repair, sewer',
  dental:              'dentist, teeth cleaning, oral health, dental clinic, orthodontist',
  legal:               'lawyer, attorney, law firm, legal services, paralegal',
  salon:               'hair salon, barbershop, beauty salon, nail salon, spa, aesthetics',
  real_estate:         'real estate agent, realtor, home buying, home selling, mortgage',
  property_management: 'property management, rental management, landlord services, tenants',
  restaurant:          'restaurant, cafe, food service, takeout, catering, dining',
  print_shop:          'printing, signs, banners, business cards, custom print, signage',
  voicemail:           'answering service, message taking, simple voicemail, call screening',
  mechanic_shop:       'auto mechanic, car repair, vehicle service, oil change, brake repair, engine diagnostics',
  pest_control:        'pest control, exterminator, bug control, rodent removal, bed bugs, wasp nest',
  electrician:         'electrician, electrical contractor, wiring, panel upgrade, EV charger install, electrical repair',
  locksmith:           'locksmith, lockout service, lock replacement, key cutting, car lockout, security locks',
  other:               'none of the above — use this if the business is a unique type',
}

const CUSTOM_VAR_KEYS = ['INDUSTRY', 'PRIMARY_CALL_REASON', 'FIRST_INFO_QUESTION', 'INFO_TO_COLLECT', 'SERVICES_OFFERED', 'TRIAGE_DEEP'] as const

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const check = limiter.check(ip)
  if (!check.allowed) {
    return NextResponse.json({ niche: 'other' }, { status: 429 })
  }

  let businessName: string
  let callerReasons: string[] | undefined
  let knownNiche: string | undefined
  let urgencyWords: string | undefined
  try {
    const body = await req.json()
    businessName = (body.businessName as string)?.trim() || ''
    if (Array.isArray(body.callerReasons)) {
      callerReasons = (body.callerReasons as unknown[])
        .map(r => String(r).trim())
        .filter(r => r.length > 0)
        .slice(0, 5)
      if (callerReasons.length === 0) callerReasons = undefined
    }
    knownNiche = typeof body.knownNiche === 'string' ? body.knownNiche.trim() : undefined
    urgencyWords = typeof body.urgencyWords === 'string' && body.urgencyWords.trim()
      ? body.urgencyWords.trim()
      : undefined
  } catch {
    return NextResponse.json({ niche: 'other' }, { status: 400 })
  }

  if (!businessName || businessName.length < 2) {
    return NextResponse.json({ niche: 'other' })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json({ niche: 'other' })
  }

  // D247: If caller reasons + known niche are provided, skip niche classification
  // and generate a custom TRIAGE_DEEP from the owner's actual call intent answers.
  if (callerReasons && callerReasons.length > 0 && knownNiche) {
    const validKnown = (Object.keys(NICHE_PRODUCTION_READY) as string[]).includes(knownNiche)
      ? knownNiche
      : 'other'
    const nicheLabel = NICHE_HINTS[validKnown] ?? validKnown.replace(/_/g, ' ')
    const reasonsList = callerReasons.map((r, i) => `${i + 1}. ${r}`).join('\n')

    const urgencyLine = urgencyWords
      ? `\nUrgency signals the owner provided (what callers say when it's an emergency):\n${urgencyWords}\n`
      : ''

    const triagePrompt = `You are an expert voice agent designer configuring a phone answering agent for a ${nicheLabel} business called "${businessName}".

The owner says these are the top reasons people call:
${reasonsList}
${urgencyLine}
Generate a TRIAGE_DEEP routing block — the core logic the agent uses to identify why someone is calling and exactly what to do next.

---
EXAMPLE (auto glass business, 2 reasons given):

WINDSHIELD_REPLACEMENT:
Ask: "Is this for a full replacement or a chip repair?"
Triggers: windshield, crack, shattered, broken glass, full replacement, can't see
→ Collect: vehicle make/model/year, insurance carrier → book same-day appointment

CHIP_REPAIR:
Ask: "How big is the chip — smaller than a quarter?"
Triggers: chip, ding, small crack, rock chip, small damage
→ Collect: chip size, vehicle info → book same-day appointment

URGENT:
Caller signals immediate need — glass completely shattered, safety issue, stranded.
Triggers: urgent, today, right now, emergency, stranded, can't drive
→ Skip info collection → book same-day appointment immediately

SPAM_OR_WRONG_NUMBER:
Caller is silent, robotic, or clearly not a real customer.
Triggers: silence, recorded message, "press 1", solicitor, wrong number
→ use hangUp tool immediately
---

Now generate TRIAGE_DEEP for ${businessName}.

FORMAT RULES — follow exactly:
- INTENT_NAME: ALLCAPS_WITH_UNDERSCORES
- One block per caller reason listed above (max 5 blocks)
- Each block must contain ALL FOUR lines: Ask, Triggers, → Collect, close action
- Ask: must be a specific opening question for THIS business — not generic "how can I help"
- Triggers: 4-6 words/phrases callers actually say when they have this intent
- Close action must be one of: book appointment | give quote | answer directly | take message | transfer to owner | use hangUp tool
- Add URGENT block if ANY reason implies same-day urgency, emergency, or "not working" — URGENT skips info collection and goes straight to close action
- URGENT block Triggers MUST include the owner-provided urgency signals above (if any) plus obvious safety/emergency phrases for this business type
- Always add SPAM_OR_WRONG_NUMBER as the final block
- Be specific to "${businessName}" — no generic responses

Return ONLY valid JSON with no other text:
{"TRIAGE_DEEP":"<all blocks as one string, blocks separated by two newlines>"}`

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-haiku-4-5',
          messages: [{ role: 'user', content: triagePrompt }],
          max_tokens: 1000,
          temperature: 0,
        }),
        signal: AbortSignal.timeout(8000),
      })

      if (res.ok) {
        const data = await res.json()
        const raw = (data.choices?.[0]?.message?.content ?? '').trim()
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
            if (typeof parsed.TRIAGE_DEEP === 'string' && parsed.TRIAGE_DEEP.trim()) {
              limiter.record(ip)
              return NextResponse.json({
                niche: validKnown,
                customVariables: { TRIAGE_DEEP: parsed.TRIAGE_DEEP.trim() },
              })
            }
          } catch { /* fall through to default */ }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.warn('[infer-niche] triage generation error:', err.message)
      }
    }
    // Fallback: return niche without custom triage
    limiter.record(ip)
    return NextResponse.json({ niche: validKnown })
  }

  const validNiches = (Object.keys(NICHE_PRODUCTION_READY) as string[]).filter(
    (n) => n !== 'outbound_isa_realtor'
  )

  const nicheList = validNiches
    .map((n) => `${n}: ${NICHE_HINTS[n] ?? n}`)
    .join('\n')

  const prompt = `You classify businesses for a phone answering agent system.

Business name: "${businessName}"

Available niches:
${nicheList}

Match to the best niche. Use "other" if the business doesn't fit any category well.
If niche is "other", also generate 5 phone agent variables specific to this business.

Return ONLY valid JSON, no other text:
- If matched to a specific niche: {"niche":"<slug>"}
- If other: {"niche":"other","customVariables":{"INDUSTRY":"<short business type, e.g. pest control company>","PRIMARY_CALL_REASON":"<main reason customers call>","FIRST_INFO_QUESTION":"<natural first question to ask, lowercase, no question mark>","INFO_TO_COLLECT":"<key info to collect, comma-separated>","SERVICES_OFFERED":"<common services, comma-separated>","TRIAGE_DEEP":"<3-5 intent routing blocks in this exact format — INTENT_NAME:\\nrouting instruction\\n→ Collect: [fields] → close. One block per common caller reason. End urgent/spam blocks with: then use hangUp tool."}}`

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
        max_tokens: 600,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      console.warn('[infer-niche] OpenRouter error:', res.status)
      return NextResponse.json({ niche: 'other' })
    }

    const data = await res.json()
    const raw = (data.choices?.[0]?.message?.content ?? '').trim()

    // Extract JSON from response (handles any preamble/postamble)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ niche: 'other' })
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      return NextResponse.json({ niche: 'other' })
    }

    const niche = validNiches.includes(String(parsed.niche ?? '')) ? String(parsed.niche) : 'other'

    // For 'other' businesses, extract and whitelist custom variables
    let customVariables: Record<string, string> | undefined
    if (niche === 'other' && parsed.customVariables && typeof parsed.customVariables === 'object') {
      const cv = parsed.customVariables as Record<string, unknown>
      const filtered: Record<string, string> = {}
      for (const key of CUSTOM_VAR_KEYS) {
        if (typeof cv[key] === 'string' && cv[key]) {
          filtered[key] = (cv[key] as string).trim()
        }
      }
      if (Object.keys(filtered).length > 0) customVariables = filtered
    }

    limiter.record(ip)
    return NextResponse.json({ niche, ...(customVariables ? { customVariables } : {}) })
  } catch (err) {
    if (err instanceof Error && err.name !== 'AbortError') {
      console.warn('[infer-niche] fetch error:', err.message)
    }
    return NextResponse.json({ niche: 'other' })
  }
}
