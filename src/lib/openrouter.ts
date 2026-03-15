const VALID_STATUSES = ['HOT', 'WARM', 'COLD', 'JUNK'] as const
const VALID_SERVICE_TYPES = ['appointment', 'quote_request', 'emergency', 'complaint', 'follow_up', 'wrong_number', 'spam', 'other'] as const
const VALID_SENTIMENTS = ['positive', 'neutral', 'negative', 'frustrated', 'indifferent'] as const

type Status = typeof VALID_STATUSES[number] | 'UNKNOWN'
type ServiceType = typeof VALID_SERVICE_TYPES[number]
type Sentiment = typeof VALID_SENTIMENTS[number]

export interface AutoGlassNicheData {
  vehicle_year: string | null
  vehicle_make: string | null
  vehicle_model: string | null
  adas: boolean | null
  vin: string | null
  caller_name: string | null
  urgency: 'HIGH' | 'MEDIUM' | 'LOW' | null
  requested_service: string | null
}

interface CallClassification {
  status: Status
  summary: string
  serviceType: ServiceType
  confidence: number
  sentiment: Sentiment
  key_topics: string[]
  next_steps: string
  quality_score: number
  niche_data?: AutoGlassNicheData
}

const AUTO_GLASS_SCHEMA = `{"status":"HOT"|"WARM"|"COLD"|"JUNK","summary":"1-2 sentences, no PII beyond first name","serviceType":"appointment"|"quote_request"|"emergency"|"complaint"|"follow_up"|"wrong_number"|"spam"|"other","confidence":0-100,"sentiment":"positive"|"neutral"|"negative"|"frustrated"|"indifferent","key_topics":["max 4 strings"],"next_steps":"one specific imperative sentence","quality_score":0-100,"niche_data":{"vehicle_year":"YYYY or null","vehicle_make":"brand or null","vehicle_model":"model name or null","adas":true/false/null,"vin":"VIN string or null","caller_name":"first name or null","urgency":"HIGH"|"MEDIUM"|"LOW"|null,"requested_service":"e.g. Windshield Replacement, Chip Repair, Callback, or null"}}`
const BASE_SCHEMA = `{"status":"HOT"|"WARM"|"COLD"|"JUNK","summary":"1-2 sentences, no PII beyond first name","serviceType":"appointment"|"quote_request"|"emergency"|"complaint"|"follow_up"|"wrong_number"|"spam"|"other","confidence":0-100,"sentiment":"positive"|"neutral"|"negative"|"frustrated"|"indifferent","key_topics":["max 4 strings"],"next_steps":"one specific imperative sentence","quality_score":0-100}`

function buildSystemPrompt(businessContext?: string, classificationHints?: string, niche?: string) {
  const business = businessContext || 'a service business'
  const hintsBlock = classificationHints
    ? `\nCLIENT-SPECIFIC RULES:\n${classificationHints}\n`
    : ''
  const isAutoGlass = niche === 'auto_glass'
  const schemaLine = isAutoGlass
    ? `Required fields — return ALL of these:\n${AUTO_GLASS_SCHEMA}`
    : `Required fields — return ALL 8, no others:\n${BASE_SCHEMA}`
  return `You classify inbound call transcripts for ${business} and return a single JSON object. Respond ONLY with the JSON object — no markdown fences, no explanation text.${hintsBlock}

${schemaLine}

RULES:
• HOT (confidence 80-100): Booking/buying NOW, urgency, emergency, immediate need
• WARM (50-79): Interested, callback wanted, price check, intent but no urgency
• COLD (20-49): Info-only, no timeline, no commitment signals
• JUNK (85-100): Silence, robocall, wrong number, spam, recorded message, sales pitch
SENTIMENT: positive=eager|neutral=matter-of-fact|negative=unhappy|frustrated=complaining|indifferent=flat/disconnected
QUALITY: 60 base +20 if call >90s +10 if intent is clear +10 if name/address/issue captured. JUNK=0-10.
NEXT STEPS: always a specific imperative — "Call back within 2 hours", "Block this number", "Send quote via SMS"

<examples>
[HOT-emergency] Caller: My windshield shattered on the highway, need emergency replacement. Agent: We can do same-day.
→ {"status":"HOT","summary":"Caller needs emergency same-day windshield replacement after highway shattering.","serviceType":"emergency","confidence":95,"sentiment":"positive","key_topics":["windshield","emergency","same-day"],"next_steps":"Dispatch tech immediately and collect address.","quality_score":82}

[HOT-ready] Caller: I need a full replacement, I have my insurance card ready. When can you come? Agent: We have 2 PM or 4 PM today.
→ {"status":"HOT","summary":"Caller ready to book windshield replacement with insurance, requesting same-day slot.","serviceType":"appointment","confidence":97,"sentiment":"positive","key_topics":["replacement","insurance","appointment"],"next_steps":"Confirm time slot and collect insurance policy number.","quality_score":90}

[WARM-callback] Caller: I cracked my windshield. Can someone call me back with pricing? Agent: Absolutely.
→ {"status":"WARM","summary":"Caller wants callback for windshield crack pricing, no urgency stated.","serviceType":"quote_request","confidence":70,"sentiment":"neutral","key_topics":["windshield crack","pricing","callback"],"next_steps":"Call back within 3 hours with a quote.","quality_score":58}

[WARM-price] Caller: How much is a chip repair for a Toyota Camry? Agent: Typically $80-120 depending on size.
→ {"status":"WARM","summary":"Caller checking chip repair pricing for a Toyota Camry, no booking intent yet.","serviceType":"quote_request","confidence":55,"sentiment":"neutral","key_topics":["chip repair","pricing","Toyota"],"next_steps":"Send follow-up SMS with pricing and a booking link.","quality_score":42}

[COLD-info] Caller: Do you work on fleet vehicles? Agent: Yes we do.
→ {"status":"COLD","summary":"Brief inquiry about fleet service with no further intent shown.","serviceType":"other","confidence":30,"sentiment":"neutral","key_topics":["fleet vehicles"],"next_steps":"Email fleet services overview and follow up in 5 days.","quality_score":28}

[JUNK-spam] Caller: This is an automated message about your vehicle's extended warranty...
→ {"status":"JUNK","summary":"Automated warranty spam robocall, no real caller.","serviceType":"spam","confidence":99,"sentiment":"indifferent","key_topics":["spam","robocall"],"next_steps":"Block this number.","quality_score":0}

[JUNK-silence] [12 seconds of silence then hangup]
→ {"status":"JUNK","summary":"Silent call with no caller engagement.","serviceType":"spam","confidence":97,"sentiment":"indifferent","key_topics":["silence"],"next_steps":"No action required.","quality_score":0}

[JUNK-wrong] Caller: Hi is this Tony's Pizza? Agent: No, this is an auto glass company.
→ {"status":"JUNK","summary":"Wrong number, caller looking for a restaurant.","serviceType":"wrong_number","confidence":99,"sentiment":"neutral","key_topics":["wrong number"],"next_steps":"No action required.","quality_score":5}
</examples>

Now classify this call for ${business}:`
}

export async function classifyCall(
  transcript: Array<{ role: string; text: string }>,
  businessContext?: string,
  classificationHints?: string,
  niche?: string
): Promise<CallClassification> {
  const transcriptText = transcript
    .map(m => `${m.role === 'agent' ? 'Agent' : 'Caller'}: ${m.text}`)
    .join('\n')

  // UNKNOWN — not COLD — so it appears in dashboard for manual review
  const unknownFallback: CallClassification = {
    status: 'UNKNOWN',
    summary: 'Call transcript unavailable or too short to classify.',
    serviceType: 'other',
    confidence: 0,
    sentiment: 'neutral',
    key_topics: [],
    next_steps: 'Review call manually in dashboard.',
    quality_score: 0,
  }

  if (!transcriptText.trim()) {
    console.warn('[openrouter] classifyCall: empty transcript — returning UNKNOWN')
    return unknownFallback
  }

  if (transcript.length < 2) {
    console.warn('[openrouter] classifyCall: transcript too short (< 2 messages) — returning UNKNOWN without API call')
    return unknownFallback
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    console.error('[openrouter] OPENROUTER_API_KEY not set — returning UNKNOWN. Add to Railway env vars.')
    return unknownFallback
  }

  console.log(`[openrouter] classifyCall: starting — ${transcript.length} messages, context="${businessContext || 'none'}"`)

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://unmissed.ai',
        'X-Title': 'unmissed.ai call classifier',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4.5',
        messages: [
          { role: 'system', content: buildSystemPrompt(businessContext, classificationHints, niche) },
          { role: 'user', content: `Classify this call:\n\n${transcriptText}` },
        ],
        max_tokens: niche === 'auto_glass' ? 1200 : 800,
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '(unreadable)')
      console.error(`[openrouter] classifyCall: HTTP ${res.status} — ${body}`)
      return unknownFallback
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content?.trim() || ''

    if (!content) {
      console.error('[openrouter] classifyCall: empty content in response — data:', JSON.stringify(data).slice(0, 300))
      return unknownFallback
    }

    // Robust JSON extraction — Anthropic models on OpenRouter ignore response_format
    // and return markdown-fenced JSON. The fence may have extra prose after the closing
    // fence (Claude explanation text), so simple start/end anchor regex fails.
    // Strategy: 1) extract JSON from inside fences, 2) fallback to first{...last}
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
    } catch (parseErr) {
      console.error('[openrouter] classifyCall: JSON.parse failed — raw content:', content.slice(0, 300), 'error:', parseErr)
      return unknownFallback
    }

    // UNKNOWN guard — if status is not a recognised value, flag for manual review
    const rawStatus = parsed.status as string
    const validatedStatus: Status = (VALID_STATUSES as readonly string[]).includes(rawStatus)
      ? rawStatus as typeof VALID_STATUSES[number]
      : 'UNKNOWN'

    if (validatedStatus === 'UNKNOWN') {
      console.warn(`[openrouter] classifyCall: unexpected status="${rawStatus}" — setting UNKNOWN for manual review`)
    }

    const nd = parsed.niche_data as Record<string, unknown> | undefined
    const nicheData: AutoGlassNicheData | undefined = niche === 'auto_glass' && nd
      ? {
          vehicle_year: typeof nd.vehicle_year === 'string' ? nd.vehicle_year : null,
          vehicle_make: typeof nd.vehicle_make === 'string' ? nd.vehicle_make : null,
          vehicle_model: typeof nd.vehicle_model === 'string' ? nd.vehicle_model : null,
          adas: typeof nd.adas === 'boolean' ? nd.adas : null,
          vin: typeof nd.vin === 'string' ? nd.vin : null,
          caller_name: typeof nd.caller_name === 'string' ? nd.caller_name : null,
          urgency: ['HIGH', 'MEDIUM', 'LOW'].includes(nd.urgency as string) ? nd.urgency as 'HIGH' | 'MEDIUM' | 'LOW' : null,
          requested_service: typeof nd.requested_service === 'string' ? nd.requested_service : null,
        }
      : undefined

    const result: CallClassification = {
      status: validatedStatus,
      summary: typeof parsed.summary === 'string' ? parsed.summary : unknownFallback.summary,
      serviceType: (VALID_SERVICE_TYPES as readonly string[]).includes(parsed.serviceType as string)
        ? parsed.serviceType as ServiceType
        : 'other',
      confidence: typeof parsed.confidence === 'number' ? Math.min(100, Math.max(0, Math.round(parsed.confidence))) : 0,
      sentiment: (VALID_SENTIMENTS as readonly string[]).includes(parsed.sentiment as string)
        ? parsed.sentiment as Sentiment
        : 'neutral',
      key_topics: Array.isArray(parsed.key_topics) ? (parsed.key_topics as unknown[]).slice(0, 4).map(String) : [],
      next_steps: typeof parsed.next_steps === 'string' ? parsed.next_steps : 'Review call manually.',
      quality_score: typeof parsed.quality_score === 'number' ? Math.min(100, Math.max(0, Math.round(parsed.quality_score))) : 0,
      ...(nicheData ? { niche_data: nicheData } : {}),
    }

    console.log(`[openrouter] classifyCall: success — status=${result.status} confidence=${result.confidence} sentiment=${result.sentiment}`)
    return result
  } catch (err) {
    console.error('[openrouter] classifyCall: unexpected error —', err)
    return unknownFallback
  }
}
