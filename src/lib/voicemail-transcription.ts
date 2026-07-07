/**
 * Voicemail transcription + summarization via OpenRouter (Gemini Flash, multimodal).
 *
 * Voicemail recordings historically got a static ai_summary ("Voicemail (32s)")
 * because no speech-to-text step existed — OpenRouter text models can't hear
 * audio, so nothing was ever sent to the classifier. Gemini Flash accepts
 * audio input directly, so ONE call returns transcript + summary + urgency.
 *
 * Deliberately uses the existing OPENROUTER_API_KEY (no new vendor): the
 * classifier-health cron already watches OpenRouter credits/liveness, so this
 * path inherits the same monitoring.
 *
 * Fail-soft: any error returns null and the caller keeps the static summary.
 */

export interface VoicemailAnalysis {
  transcript: string
  summary: string
  urgency: 'urgent' | 'normal'
}

const MODEL = 'google/gemini-2.5-flash'

export async function analyzeVoicemailAudio(
  audio: Buffer,
  opts: { businessName?: string | null } = {},
): Promise<VoicemailAnalysis | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    console.error('[voicemail-stt] OPENROUTER_API_KEY not set — skipping transcription')
    return null
  }

  const businessLine = opts.businessName
    ? `The voicemail was left for a business called "${opts.businessName}".`
    : ''

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  `This is a voicemail recording from a missed phone call. ${businessLine}\n` +
                  `Return ONLY a JSON object, no markdown fences, with exactly these keys:\n` +
                  `"transcript" — verbatim transcription of the audio (empty string if unintelligible),\n` +
                  `"summary" — one or two sentences: who called, what they want, any callback preference. Written for the business owner.\n` +
                  `"urgency" — "urgent" if the caller describes an emergency, safety issue, or explicit time pressure; otherwise "normal".`,
              },
              {
                type: 'input_audio',
                input_audio: { data: audio.toString('base64'), format: 'mp3' },
              },
            ],
          },
        ],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      console.error(`[voicemail-stt] OpenRouter HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`)
      return null
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const raw = data.choices?.[0]?.message?.content ?? ''
    // Defensive parse — strip code fences if the model added them anyway
    const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    const parsed = JSON.parse(jsonText) as Partial<VoicemailAnalysis>

    if (typeof parsed.transcript !== 'string' || typeof parsed.summary !== 'string' || !parsed.summary.trim()) {
      console.error('[voicemail-stt] Malformed response shape — skipping')
      return null
    }

    return {
      transcript: parsed.transcript,
      summary: parsed.summary.trim(),
      urgency: parsed.urgency === 'urgent' ? 'urgent' : 'normal',
    }
  } catch (e) {
    console.error('[voicemail-stt] Transcription failed:', e instanceof Error ? e.message : e)
    return null
  }
}
