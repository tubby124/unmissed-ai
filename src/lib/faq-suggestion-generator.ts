/**
 * generateFaqSuggestions
 *
 * Uses Haiku 4.5 to analyze a call transcript and produce up to 3 pre-answered
 * FAQ Q+A pairs for questions the agent couldn't confidently answer.
 *
 * Called fire-and-forget from the completed webhook after L5 gap analysis.
 * Results stored in call_logs.faq_suggestions JSONB column.
 *
 * Skipped for test calls — only runs on real production calls.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface FaqSuggestion {
  q: string
  a: string
}

interface TranscriptMessage {
  role: string
  text: string
}

const SUGGESTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          q: { type: 'string' },
          a: { type: 'string' },
        },
        required: ['q', 'a'],
      },
    },
  },
  required: ['suggestions'],
}

export async function generateFaqSuggestions({
  supabase,
  callLogId,
  transcript,
  businessName,
  niche,
  businessFacts,
  extraQa,
}: {
  supabase: SupabaseClient
  callLogId: string
  transcript: TranscriptMessage[]
  businessName: string
  niche: string
  businessFacts: string | null
  extraQa: { q: string; a: string }[] | null
}): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return

  // Compact transcript to stay within token budget
  const transcriptText = transcript
    .map(m => `${m.role === 'user' ? 'Caller' : 'Agent'}: ${m.text}`)
    .join('\n')
    .slice(0, 3000)

  if (!transcriptText.trim()) return

  const factsBlock = typeof businessFacts === 'string' && businessFacts.trim()
    ? `\nBusiness facts:\n${businessFacts.slice(0, 400)}`
    : ''

  const existingFaqs = Array.isArray(extraQa) ? extraQa : []
  const faqsBlock = existingFaqs.length > 0
    ? `\nExisting FAQs (do not duplicate these):\n${existingFaqs.slice(0, 5).map(f => `Q: ${f.q}`).join('\n')}`
    : ''

  const systemPrompt = `You are analyzing a customer service call for ${businessName || 'a business'} (${niche || 'general'}).${factsBlock}${faqsBlock}

Find up to 3 questions the caller asked that the agent couldn't confidently answer — agent said "I'm not sure", deflected, gave a vague reply, or the caller had to repeat the question.

For each question output:
- q: The caller's question, rephrased naturally (max 15 words)
- a: A 2-3 sentence spoken answer the agent should give. Use [YOUR ANSWER HERE] for specific details (prices, exact hours, staff names) that aren't in the context. Never invent facts.

Rules:
- Skip questions the agent answered well
- Keep answers conversational — they'll be spoken aloud
- Output 0 suggestions if none found — don't force-fit`

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4-5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Call transcript:\n\n${transcriptText}\n\nExtract FAQ suggestions from unanswered questions.` },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'faq_suggestions', strict: true, schema: SUGGESTION_SCHEMA },
        },
        max_tokens: 512,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(20_000),
    })

    if (!res.ok) {
      console.warn(`[faq-gen] OpenRouter error ${res.status} for callLogId=${callLogId}`)
      return
    }

    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = json.choices?.[0]?.message?.content
    if (!content) return

    const parsed = JSON.parse(content) as { suggestions: FaqSuggestion[] }
    const suggestions = (parsed.suggestions ?? [])
      .filter(s => typeof s.q === 'string' && typeof s.a === 'string' && s.q.trim() && s.a.trim())
      .slice(0, 3)

    if (suggestions.length === 0) return

    await supabase
      .from('call_logs')
      .update({ faq_suggestions: suggestions })
      .eq('id', callLogId)

    console.log(`[faq-gen] Stored ${suggestions.length} FAQ suggestion(s) for callLogId=${callLogId}`)
  } catch (err) {
    console.warn('[faq-gen] Failed (non-fatal):', err instanceof Error ? err.message : err)
  }
}
