interface CallClassification {
  status: 'HOT' | 'WARM' | 'COLD' | 'JUNK'
  summary: string
  serviceType: 'appointment' | 'quote_request' | 'emergency' | 'complaint' | 'follow_up' | 'wrong_number' | 'spam' | 'other'
  confidence: number
  sentiment: 'positive' | 'neutral' | 'negative' | 'frustrated' | 'indifferent'
  key_topics: string[]
  next_steps: string
  quality_score: number
}

function buildSystemPrompt(businessContext?: string) {
  const business = businessContext || 'a service business'
  return `You classify inbound call transcripts for ${business} and return a single JSON object.

Required fields — return ALL 8, no others:
{"status":"HOT"|"WARM"|"COLD"|"JUNK","summary":"1-2 sentences, no PII beyond first name","serviceType":"appointment"|"quote_request"|"emergency"|"complaint"|"follow_up"|"wrong_number"|"spam"|"other","confidence":0-100,"sentiment":"positive"|"neutral"|"negative"|"frustrated"|"indifferent","key_topics":["max 4 strings"],"next_steps":"one specific imperative sentence","quality_score":0-100}

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
  businessContext?: string
): Promise<CallClassification> {
  const transcriptText = transcript
    .map(m => `${m.role === 'agent' ? 'Agent' : 'Caller'}: ${m.text}`)
    .join('\n')

  const fallback: CallClassification = {
    status: 'COLD',
    summary: 'Call transcript unavailable or too short to classify.',
    serviceType: 'other',
    confidence: 0,
    sentiment: 'neutral',
    key_topics: [],
    next_steps: 'Review call manually.',
    quality_score: 0,
  }

  if (!transcriptText.trim()) return fallback

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://unmissed.ai',
        'X-Title': 'unmissed.ai call classifier',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4.5',
        messages: [
          { role: 'system', content: buildSystemPrompt(businessContext) },
          { role: 'user', content: `Classify this call:\n\n${transcriptText}` },
        ],
        max_tokens: 400,
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) return fallback

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content?.trim() || ''
    const parsed = JSON.parse(content)

    return {
      status: (['HOT', 'WARM', 'COLD', 'JUNK'] as const).includes(parsed.status) ? parsed.status : 'COLD',
      summary: typeof parsed.summary === 'string' ? parsed.summary : fallback.summary,
      serviceType: (['appointment', 'quote_request', 'emergency', 'complaint', 'follow_up', 'wrong_number', 'spam', 'other'] as const).includes(parsed.serviceType)
        ? parsed.serviceType
        : 'other',
      confidence: typeof parsed.confidence === 'number' ? Math.min(100, Math.max(0, Math.round(parsed.confidence))) : 0,
      sentiment: (['positive', 'neutral', 'negative', 'frustrated', 'indifferent'] as const).includes(parsed.sentiment)
        ? parsed.sentiment
        : 'neutral',
      key_topics: Array.isArray(parsed.key_topics) ? parsed.key_topics.slice(0, 4).map(String) : [],
      next_steps: typeof parsed.next_steps === 'string' ? parsed.next_steps : 'Review call manually.',
      quality_score: typeof parsed.quality_score === 'number' ? Math.min(100, Math.max(0, Math.round(parsed.quality_score))) : 0,
    }
  } catch {
    return fallback
  }
}
