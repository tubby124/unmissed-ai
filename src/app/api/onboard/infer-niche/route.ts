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
  other:               'none of the above — use this if the business is a unique type',
}

const CUSTOM_VAR_KEYS = ['INDUSTRY', 'PRIMARY_CALL_REASON', 'FIRST_INFO_QUESTION', 'INFO_TO_COLLECT', 'SERVICES_OFFERED'] as const

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const check = limiter.check(ip)
  if (!check.allowed) {
    return NextResponse.json({ niche: 'other' }, { status: 429 })
  }

  let businessName: string
  try {
    const body = await req.json()
    businessName = (body.businessName as string)?.trim() || ''
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
- If other: {"niche":"other","customVariables":{"INDUSTRY":"<short business type, e.g. pest control company>","PRIMARY_CALL_REASON":"<main reason customers call>","FIRST_INFO_QUESTION":"<natural first question to ask, lowercase, no question mark>","INFO_TO_COLLECT":"<key info to collect, comma-separated>","SERVICES_OFFERED":"<common services, comma-separated>"}}`

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
        max_tokens: 250,
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
