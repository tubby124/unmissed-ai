interface CallClassification {
  status: 'HOT' | 'WARM' | 'COLD' | 'JUNK'
  summary: string
  serviceType: string
}

const SYSTEM_PROMPT = `You classify real estate voicemail transcripts for Hasan Sharif, a real estate agent in Saskatoon SK and Calgary AB.

Return ONLY a valid JSON object with these exact fields:
{
  "status": "HOT" | "WARM" | "COLD" | "JUNK",
  "summary": "1-2 sentence summary of the call",
  "serviceType": "buying" | "selling" | "showing" | "general_inquiry" | "wrong_number" | "spam" | "other"
}

Status definitions:
- HOT: Wants to buy/sell/see a property urgently, has a specific property or timeline
- WARM: General real estate inquiry, wants a callback, browsing
- COLD: Just asking for info, no clear intent or timeline
- JUNK: Wrong number, spam, robocall, silence, recorded message, sales pitch

Be concise in summary. Never include PII beyond first name if mentioned.`

export async function classifyCall(
  transcript: Array<{ role: string; text: string }>
): Promise<CallClassification> {
  const transcriptText = transcript
    .map(m => `${m.role === 'agent' ? 'Aisha' : 'Caller'}: ${m.text}`)
    .join('\n')

  const fallback: CallClassification = {
    status: 'COLD',
    summary: 'Call transcript unavailable or too short to classify.',
    serviceType: 'other',
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
        model: 'anthropic/claude-haiku-4-5',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Classify this call:\n\n${transcriptText}` },
        ],
        max_tokens: 200,
        temperature: 0,
      }),
    })

    if (!res.ok) return fallback

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content?.trim() || ''

    // Strip markdown code fences if present
    const cleaned = content.replace(/^```json\s*/i, '').replace(/\s*```$/, '')
    const parsed = JSON.parse(cleaned)

    return {
      status: ['HOT', 'WARM', 'COLD', 'JUNK'].includes(parsed.status) ? parsed.status : 'COLD',
      summary: parsed.summary || fallback.summary,
      serviceType: parsed.serviceType || 'other',
    }
  } catch {
    return fallback
  }
}
