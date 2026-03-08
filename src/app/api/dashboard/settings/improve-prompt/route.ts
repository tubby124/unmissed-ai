import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 60

const SYSTEM_PROMPT = `You are an AI voice agent prompt engineer. Given a business's current system prompt and real call data, produce an improved system prompt that addresses gaps in the agent's handling.

Return ONLY valid JSON (no markdown fences) with this exact structure:
{"improved_prompt":"<the full improved system prompt>","change_summary":["bullet 1","bullet 2","bullet 3"]}`

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  if (!cu) return new NextResponse('No client found', { status: 404 })

  const body = await req.json().catch(() => ({}))
  const targetClientId = cu.role === 'admin' ? (body.client_id ?? cu.client_id) : cu.client_id

  if (!targetClientId) return NextResponse.json({ error: 'No client_id' }, { status: 400 })

  const svc = createServiceClient()

  const { data: client } = await svc
    .from('clients')
    .select('id, business_name, niche, system_prompt')
    .eq('id', targetClientId)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  if (!client.system_prompt) return NextResponse.json({ error: 'No system prompt configured yet' }, { status: 422 })

  const { data: calls } = await svc
    .from('call_logs')
    .select('id, call_status, ai_summary, service_type, key_topics, sentiment, next_steps, quality_score, duration_seconds')
    .eq('client_id', targetClientId)
    .not('call_status', 'in', '("live","processing")')
    .order('ended_at', { ascending: false })
    .limit(20)

  const callCount = calls?.length ?? 0
  const hasEnoughData = callCount >= 5

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 500 })

  const businessContext = [client.business_name, client.niche].filter(Boolean).join(' — ') || 'service business'

  let callSection = 'No call data yet — improve based on business context and prompt quality alone.'
  if (callCount > 0) {
    const callLines = (calls ?? []).map((c, i) => {
      const topics = Array.isArray(c.key_topics) ? c.key_topics.join(', ') : 'none'
      return `Call ${i + 1}: status=${c.call_status} sentiment=${c.sentiment ?? '?'} quality=${c.quality_score ?? '?'} duration=${c.duration_seconds ?? 0}s service=${c.service_type ?? '?'} topics=[${topics}] summary="${(c.ai_summary || 'none').slice(0, 120)}" next_steps="${(Array.isArray(c.next_steps) ? c.next_steps.join('; ') : c.next_steps || 'none').slice(0, 80)}"`
    }).join('\n')
    callSection = `Last ${callCount} calls:\n${callLines}`
  }

  // Trim prompt to avoid token limits — keep first 6000 chars
  const promptSample = (client.system_prompt ?? '').slice(0, 6000)

  const userMessage = `Business: ${businessContext}

Current system prompt (may be truncated):
${promptSample}

${callSection}

Instructions:
- Keep the improved prompt similar in length and structure
- Fix any gaps revealed by the call data (missed intents, friction, unclear instructions)
- Improve tone, clarity, and coverage of common scenarios
- Return the full improved prompt text + 3-5 bullet points summarizing what changed and why`

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://unmissed.ai',
      'X-Title': 'unmissed.ai prompt improver',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-4.5',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 4000,
      temperature: 0.3,
    }),
  })

  if (!res.ok) return NextResponse.json({ error: `OpenRouter error: ${res.status}` }, { status: 500 })

  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content?.trim() || ''
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  let parsed: { improved_prompt?: string; change_summary?: string[] }
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'AI returned unparseable response. Try again.' }, { status: 500 })
  }

  if (!parsed.improved_prompt) {
    return NextResponse.json({ error: 'AI did not return an improved prompt. Try again.' }, { status: 500 })
  }

  return NextResponse.json({
    improved_prompt: parsed.improved_prompt,
    change_summary: parsed.change_summary ?? [],
    call_count: callCount,
    has_enough_data: hasEnoughData,
  })
}
