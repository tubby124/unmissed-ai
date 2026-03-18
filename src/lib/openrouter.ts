const VALID_STATUSES = ['HOT', 'WARM', 'COLD', 'JUNK'] as const
const VALID_SERVICE_TYPES = ['appointment', 'quote_request', 'emergency', 'complaint', 'follow_up', 'wrong_number', 'spam', 'other'] as const
const VALID_SENTIMENTS = ['positive', 'neutral', 'negative', 'frustrated', 'indifferent'] as const

type Status = typeof VALID_STATUSES[number] | 'UNKNOWN'
type ServiceType = typeof VALID_SERVICE_TYPES[number]
type Sentiment = typeof VALID_SENTIMENTS[number]

export interface CallerData {
  caller_name: string | null
  booked: boolean
  appointment_time: string | null
  service_requested: string | null
}

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
  caller_data?: CallerData
  niche_data?: AutoGlassNicheData
}

const AUTO_GLASS_SCHEMA = `{"status":"HOT"|"WARM"|"COLD"|"JUNK","summary":"1-2 sentences, no PII beyond first name","serviceType":"appointment"|"quote_request"|"emergency"|"complaint"|"follow_up"|"wrong_number"|"spam"|"other","confidence":0-100,"sentiment":"positive"|"neutral"|"negative"|"frustrated"|"indifferent","key_topics":["max 4 strings"],"next_steps":"one specific imperative sentence","quality_score":0-100,"niche_data":{"vehicle_year":"YYYY or null","vehicle_make":"brand or null","vehicle_model":"model name or null","adas":true/false/null,"vin":"VIN string or null","caller_name":"first name or null","urgency":"HIGH"|"MEDIUM"|"LOW"|null,"requested_service":"e.g. Windshield Replacement, Chip Repair, Callback, or null"}}`
const BASE_SCHEMA = `{"status":"HOT"|"WARM"|"COLD"|"JUNK","summary":"2-3 sentences including caller name, what they wanted, and outcome. Be specific — include property addresses, service details, dates/times mentioned.","serviceType":"appointment"|"quote_request"|"emergency"|"complaint"|"follow_up"|"wrong_number"|"spam"|"other","confidence":0-100,"sentiment":"positive"|"neutral"|"negative"|"frustrated"|"indifferent","key_topics":["max 4 strings"],"next_steps":"one specific imperative sentence","quality_score":0-100,"caller_data":{"caller_name":"first name or null","booked":true/false,"appointment_time":"e.g. Monday March 17 at 2:00 PM or null","service_requested":"e.g. Home showing at 123 Main St, Quote for deck repair, or null"}}`

function buildSystemPrompt(businessContext?: string, classificationHints?: string, niche?: string) {
  const business = businessContext || 'a service business'
  const hintsBlock = classificationHints
    ? `\nCLIENT-SPECIFIC RULES:\n${classificationHints}\n`
    : ''
  const isAutoGlass = niche === 'auto_glass'
  const schemaLine = isAutoGlass
    ? `Required fields — return ALL of these:\n${AUTO_GLASS_SCHEMA}`
    : `Required fields — return ALL of these:\n${BASE_SCHEMA}`
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
[HOT-booked] Caller: Hi my name is Jacob, I'd like to book a showing for 742 Evergreen Terrace tomorrow afternoon. Agent: I have 2 PM available. Caller: Perfect, book it. Agent: Done!
→ {"status":"HOT","summary":"Jacob called to book a showing at 742 Evergreen Terrace. Appointment confirmed for Tuesday March 18 at 2:00 PM.","serviceType":"appointment","confidence":97,"sentiment":"positive","key_topics":["showing","742 Evergreen Terrace","booking"],"next_steps":"Confirm showing with listing agent and send Jacob a reminder.","quality_score":92,"caller_data":{"caller_name":"Jacob","booked":true,"appointment_time":"Tuesday March 18 at 2:00 PM","service_requested":"Showing at 742 Evergreen Terrace"}}

[HOT-emergency] Caller: My windshield shattered on the highway, need emergency replacement. Agent: We can do same-day.
→ {"status":"HOT","summary":"Caller needs emergency same-day windshield replacement after highway shattering. No name provided.","serviceType":"emergency","confidence":95,"sentiment":"positive","key_topics":["windshield","emergency","same-day"],"next_steps":"Dispatch tech immediately and collect address.","quality_score":82,"caller_data":{"caller_name":null,"booked":false,"appointment_time":null,"service_requested":"Emergency windshield replacement"}}

[WARM-callback] Caller: Hey it's Sarah. I'm looking at selling my house on Preston Ave, can someone call me back? Agent: Absolutely, we'll have someone reach out.
→ {"status":"WARM","summary":"Sarah called about selling her property on Preston Ave. Wants a callback to discuss listing. No appointment booked.","serviceType":"quote_request","confidence":70,"sentiment":"neutral","key_topics":["listing","Preston Ave","seller inquiry","callback"],"next_steps":"Call Sarah back within 2 hours to discuss listing and schedule a market evaluation.","quality_score":58,"caller_data":{"caller_name":"Sarah","booked":false,"appointment_time":null,"service_requested":"Home listing consultation for Preston Ave property"}}

[COLD-info] Caller: Do you work on fleet vehicles? Agent: Yes we do.
→ {"status":"COLD","summary":"Brief inquiry about fleet service with no further intent shown. No name given.","serviceType":"other","confidence":30,"sentiment":"neutral","key_topics":["fleet vehicles"],"next_steps":"Email fleet services overview and follow up in 5 days.","quality_score":28,"caller_data":{"caller_name":null,"booked":false,"appointment_time":null,"service_requested":null}}

[JUNK-spam] Caller: This is an automated message about your vehicle's extended warranty...
→ {"status":"JUNK","summary":"Automated warranty spam robocall, no real caller.","serviceType":"spam","confidence":99,"sentiment":"indifferent","key_topics":["spam","robocall"],"next_steps":"Block this number.","quality_score":0,"caller_data":{"caller_name":null,"booked":false,"appointment_time":null,"service_requested":null}}

[JUNK-wrong] Caller: Hi is this Tony's Pizza? Agent: No, this is an auto glass company.
→ {"status":"JUNK","summary":"Wrong number, caller looking for a restaurant.","serviceType":"wrong_number","confidence":99,"sentiment":"neutral","key_topics":["wrong number"],"next_steps":"No action required.","quality_score":5,"caller_data":{"caller_name":null,"booked":false,"appointment_time":null,"service_requested":null}}
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

  // Short/empty transcripts = junk (robocalls, hang-ups, accidental dials)
  const shortCallFallback: CallClassification = {
    status: 'JUNK',
    summary: 'Ultra-short call — no conversation (likely robocall or hang-up).',
    serviceType: 'spam',
    confidence: 90,
    sentiment: 'neutral',
    key_topics: [],
    next_steps: '',
    quality_score: 0,
  }

  // UNKNOWN only for operational errors (API key missing, etc.)
  const unknownFallback: CallClassification = {
    status: 'UNKNOWN',
    summary: 'Classification failed — check OpenRouter API key.',
    serviceType: 'other',
    confidence: 0,
    sentiment: 'neutral',
    key_topics: [],
    next_steps: 'Check OPENROUTER_API_KEY in Railway env vars.',
    quality_score: 0,
  }

  if (!transcriptText.trim()) {
    console.warn('[openrouter] classifyCall: empty transcript — returning JUNK')
    return shortCallFallback
  }

  if (transcript.length < 2) {
    console.warn('[openrouter] classifyCall: transcript too short (< 2 messages) — returning JUNK without API call')
    return shortCallFallback
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
        max_tokens: niche === 'auto_glass' ? 1200 : 1000,
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

    const cd = parsed.caller_data as Record<string, unknown> | undefined
    const callerData: CallerData | undefined = cd
      ? {
          caller_name: typeof cd.caller_name === 'string' ? cd.caller_name : null,
          booked: cd.booked === true,
          appointment_time: typeof cd.appointment_time === 'string' ? cd.appointment_time : null,
          service_requested: typeof cd.service_requested === 'string' ? cd.service_requested : null,
        }
      : undefined

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
      ...(callerData ? { caller_data: callerData } : {}),
      ...(nicheData ? { niche_data: nicheData } : {}),
    }

    console.log(`[openrouter] classifyCall: success — status=${result.status} confidence=${result.confidence} sentiment=${result.sentiment}`)
    return result
  } catch (err) {
    console.error('[openrouter] classifyCall: unexpected error —', err)
    return unknownFallback
  }
}
