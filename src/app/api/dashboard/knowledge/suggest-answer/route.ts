/**
 * POST /api/dashboard/knowledge/suggest-answer
 *
 * Uses Haiku 4.5 (via OpenRouter) to generate a suggested FAQ answer for a
 * caller topic the agent couldn't answer. Provides business context (name, niche,
 * existing facts + FAQs) so suggestions are specific to the client.
 *
 * No plan gate — available to all users.
 *
 * Body: {
 *   topic: string                  — the question/topic to answer
 *   client_id?: string             — admin override
 *   transcript_context?: string    — relevant transcript lines (optional)
 * }
 * Response: { answer: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────────
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu || !['admin', 'owner'].includes(cu.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as {
    topic?: string
    client_id?: string
    transcript_context?: string
  }

  const topic = body.topic?.trim() ?? ''
  if (!topic || topic.length > 500) {
    return NextResponse.json({ error: 'topic is required (max 500 chars)' }, { status: 400 })
  }

  const clientId = cu.role === 'admin' && body.client_id ? body.client_id : cu.client_id
  if (!clientId) return NextResponse.json({ error: 'No client found' }, { status: 400 })

  // ── Fetch business context ────────────────────────────────────────────────────
  const svc = createServiceClient()
  const { data: client } = await svc
    .from('clients')
    .select('business_name, niche, business_facts, extra_qa')
    .eq('id', clientId)
    .maybeSingle()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI suggestions not configured' }, { status: 503 })

  // ── Build context blocks ──────────────────────────────────────────────────────
  const businessName = (client.business_name ?? 'this business').slice(0, 100)
  const niche = (client.niche ?? 'general').slice(0, 60)

  const factsBlock = typeof client.business_facts === 'string' && client.business_facts.trim()
    ? `\nWhat the agent already knows:\n${client.business_facts.slice(0, 800)}`
    : ''

  const existingFaqs = Array.isArray(client.extra_qa) ? client.extra_qa as { q: string; a: string }[] : []
  const faqsBlock = existingFaqs.length > 0
    ? `\nExisting FAQs:\n${existingFaqs.slice(0, 8).map(f => `Q: ${f.q}\nA: ${f.a}`).join('\n\n').slice(0, 600)}`
    : ''

  const transcriptBlock = typeof body.transcript_context === 'string' && body.transcript_context.trim()
    ? `\nFrom the call:\n${body.transcript_context.slice(0, 400)}`
    : ''

  // ── OpenRouter / Haiku call ───────────────────────────────────────────────────
  const systemPrompt = `You are helping a business owner teach their voice AI receptionist how to answer caller questions.

Business: ${businessName} (${niche})${factsBlock}${faqsBlock}

Your job: write a short, natural answer the AI agent should speak when a caller asks about the given topic.

Rules:
- 2-3 sentences max — it will be spoken aloud, not read
- Conversational and helpful, not robotic
- If specific details (prices, exact hours, staff names) aren't in the context above, use [YOUR ANSWER HERE] as a placeholder so the owner knows to fill it in
- Never invent facts — only use what's in the context or use placeholders
- Start directly with the answer — no "Sure!" or "Great question!" preamble
- Output ONLY the answer text, nothing else`

  const userMessage = `The caller asked about: "${topic}"${transcriptBlock}

Write the answer the agent should give.`

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
          { role: 'user', content: userMessage },
        ],
        max_tokens: 256,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error')
      console.error('[suggest-answer] OpenRouter error:', res.status, errText.slice(0, 200))
      return NextResponse.json({ error: 'AI suggestion failed' }, { status: 502 })
    }

    const json = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }

    const answer = json.choices?.[0]?.message?.content?.trim() ?? ''
    if (!answer) {
      return NextResponse.json({ error: 'No suggestion returned' }, { status: 502 })
    }

    return NextResponse.json({ answer })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[suggest-answer] fetch error:', msg)
    return NextResponse.json({ error: 'AI suggestion unavailable' }, { status: 503 })
  }
}
