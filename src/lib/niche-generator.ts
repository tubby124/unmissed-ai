/**
 * AI-generated niche config for businesses that fall to niche='other'.
 * Called at provision time to produce a custom triage config from GBP/website data.
 */

import { BRAND_NAME, BRAND_REFERER } from '@/lib/brand'

export interface CustomNicheConfig {
  industry: string           // e.g. "daycare", "gym", "tattoo studio"
  primary_call_reason: string // e.g. "enrollment inquiry or childcare question"
  triage_deep: string        // HOT/WARM/COLD/JUNK classification block
  info_to_collect: string    // comma-separated fields to capture on calls
  faq_defaults: string[]     // 5 Q&A pairs as "Q — A" strings in spoken language
  classification_rule: string // one-sentence HOT/WARM/COLD/JUNK rule
  close_person: string        // e.g. "our director", "our team"
  close_action: string        // e.g. "call you back to discuss enrollment"
}

const SYSTEM_PROMPT = `You generate niche configs for AI voice agents that handle inbound calls for small businesses.

The agent needs to know how to triage calls (HOT/WARM/COLD/JUNK), what info to collect, and how to close with a callback offer.

Tone rules — match the style of these examples:
- HOT: caller has an urgent, immediate need (ready to proceed NOW)
- WARM: interested, wants a callback, no urgency
- COLD: info-only, no intent signals
- JUNK: spam, robocall, wrong number

Spoken-language FAQ style: "Q — A" where both Q and A sound natural on a phone call.
Keep triage_deep to 3-4 sentences, one per status. Keep close_action to 8 words or fewer.

Return ONLY a valid JSON object — no markdown fences, no explanation.`

const USER_PROMPT = (
  businessName: string,
  gbpCategory: string,
  gbpSummary: string,
  websiteScrape: string,
  city: string,
) => `Business: ${businessName}${city ? ` in ${city}` : ''}
Google Business Category: ${gbpCategory || 'not provided'}
Business Description: ${gbpSummary || 'not provided'}
Website Content: ${websiteScrape ? websiteScrape.slice(0, 2000) : 'not provided'}

Generate a JSON config with EXACTLY these fields:
{
  "industry": "one-word or two-word label (e.g. daycare, tattoo studio, dog groomer)",
  "primary_call_reason": "5-7 word phrase (e.g. enrollment inquiry or childcare question)",
  "triage_deep": "HOT = urgent immediate need (describe what urgent looks like for this industry). WARM = interested, wants callback. COLD = info only, no urgency. JUNK = spam or wrong number.",
  "info_to_collect": "comma-separated list of what to capture (e.g. name, service needed, preferred time)",
  "faq_defaults": ["Q — A", "Q — A", "Q — A", "Q — A", "Q — A"],
  "classification_rule": "one sentence: HOT = ..., WARM = ..., COLD = ..., JUNK = ...",
  "close_person": "who calls them back (e.g. our team, our director, our groomer)",
  "close_action": "what happens next in 8 words or fewer (e.g. call you back to book your visit)"
}`

export async function generateNicheConfig(
  businessName: string,
  gbpCategory: string,
  gbpSummary: string,
  websiteScrape: string,
  city: string,
): Promise<CustomNicheConfig | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    console.warn('[niche-generator] OPENROUTER_API_KEY not set — skipping custom niche config')
    return null
  }

  console.log(`[niche-generator] Generating niche config for "${businessName}" (category: ${gbpCategory || 'unknown'})`)

  try {
    const abort = new AbortController()
    const abortTimer = setTimeout(() => abort.abort(), 30_000)

    let res: Response
    try {
      res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: abort.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': BRAND_REFERER,
          'X-Title': `${BRAND_NAME} niche generator`,
        },
        body: JSON.stringify({
          model: 'anthropic/claude-haiku-4.5',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: USER_PROMPT(businessName, gbpCategory, gbpSummary, websiteScrape, city) },
          ],
          max_tokens: 800,
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }),
      })
    } finally {
      clearTimeout(abortTimer)
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '(unreadable)')
      console.error(`[niche-generator] HTTP ${res.status} — ${body.slice(0, 200)}`)
      return null
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content?.trim() || ''

    if (!content) {
      console.error('[niche-generator] Empty response from OpenRouter')
      return null
    }

    // Extract JSON from markdown fences if present (Anthropic models on OpenRouter may wrap it)
    const fencedMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    const cleaned = fencedMatch
      ? fencedMatch[1].trim()
      : (() => {
          const s = content.indexOf('{')
          const e = content.lastIndexOf('}')
          return s !== -1 && e > s ? content.slice(s, e + 1) : content.trim()
        })()

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('[niche-generator] JSON.parse failed — raw content:', content.slice(0, 300))
      return null
    }

    // Validate required fields — return null if any are missing
    const requiredStrings: (keyof CustomNicheConfig)[] = [
      'industry', 'primary_call_reason', 'triage_deep',
      'info_to_collect', 'classification_rule', 'close_person', 'close_action',
    ]
    for (const field of requiredStrings) {
      if (typeof parsed[field] !== 'string' || !(parsed[field] as string).trim()) {
        console.error(`[niche-generator] Missing or empty field: ${field}`)
        return null
      }
    }

    const faqDefaults = Array.isArray(parsed.faq_defaults)
      ? (parsed.faq_defaults as unknown[]).slice(0, 5).map(String).filter(Boolean)
      : []

    const config: CustomNicheConfig = {
      industry: (parsed.industry as string).trim(),
      primary_call_reason: (parsed.primary_call_reason as string).trim(),
      triage_deep: (parsed.triage_deep as string).trim(),
      info_to_collect: (parsed.info_to_collect as string).trim(),
      faq_defaults: faqDefaults,
      classification_rule: (parsed.classification_rule as string).trim(),
      close_person: (parsed.close_person as string).trim(),
      close_action: (parsed.close_action as string).trim(),
    }

    console.log(`[niche-generator] Generated config for "${config.industry}" — ${config.primary_call_reason}`)
    return config
  } catch (err) {
    console.error('[niche-generator] Unexpected error:', err)
    return null
  }
}
