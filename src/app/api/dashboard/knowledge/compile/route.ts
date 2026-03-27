/**
 * POST /api/dashboard/knowledge/compile
 *
 * Analyzes raw text with Claude Haiku 4.5 (via OpenRouter structured output)
 * and returns classified, normalized knowledge items for human review.
 * No DB writes — stateless analysis only. Apply approved items via /compile/apply.
 *
 * Body: { raw_input: string, client_id?: string (admin only) }
 * Response: { items: NormalizedItem[], warnings: string[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { getPlanEntitlements } from '@/lib/plan-entitlements'

// JSON Schema for structured output (strict mode — all fields required, empty string for unused)
const COMPILER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: {
            type: 'string',
            enum: [
              'business_fact',
              'faq_pair',
              'operating_policy',
              'call_behavior_instruction',
              'pricing_or_offer',
              'hours_or_availability',
              'location_or_service_area',
              'unsupported_or_ambiguous',
              'conflict_flag',
            ],
          },
          question:             { type: 'string' },
          answer:               { type: 'string' },
          fact_text:            { type: 'string' },
          confidence:           { type: 'number' },
          requires_manual_review: { type: 'boolean' },
          review_reason:        { type: 'string' },
        },
        required: ['kind', 'question', 'answer', 'fact_text', 'confidence', 'requires_manual_review', 'review_reason'],
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['items', 'warnings'],
}

export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────────
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

  // ── Parse body ───────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as { raw_input?: string; client_id?: string }
  const rawInput = body.raw_input?.trim() ?? ''
  if (!rawInput) return NextResponse.json({ error: 'raw_input is required' }, { status: 400 })
  if (rawInput.length > 20_000) {
    return NextResponse.json({ error: 'Input too long (max 20,000 chars)' }, { status: 400 })
  }

  const clientId = cu.role === 'admin' && body.client_id ? body.client_id : cu.client_id
  if (!clientId) return NextResponse.json({ error: 'No client found' }, { status: 400 })

  // ── Plan gate ────────────────────────────────────────────────────────────────
  const svc = createServiceClient()
  const { data: client } = await svc
    .from('clients')
    .select('business_name, niche, selected_plan, subscription_status')
    .eq('id', clientId)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const plan = getPlanEntitlements(
    client.subscription_status === 'trialing' ? 'trial' : client.selected_plan,
  )
  if (!plan.fileUploadEnabled) {
    return NextResponse.json(
      { error: 'AI compilation is not available on your current plan.' },
      { status: 403 },
    )
  }

  // ── OpenRouter / Haiku call ───────────────────────────────────────────────────
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI compiler is not configured' }, { status: 503 })
  }

  const systemPrompt = `You are a business knowledge compiler for a voice AI assistant.
Analyze raw text from a business owner and extract every distinct piece of knowledge the AI agent could use to answer caller questions.

Business: ${client.business_name ?? 'Unknown'} (${client.niche ?? 'general'})

Classify each item as one of these kinds:
- business_fact: General facts about the business (team, certifications, equipment, amenities, etc.)
- faq_pair: A caller question with its answer — put question in "question", answer in "answer"
- pricing_or_offer: Prices, rates, discounts, promotions — put in "fact_text"
- hours_or_availability: Business hours, holiday schedules, turnaround times — put in "fact_text"
- location_or_service_area: Address, coverage area, service zones — put in "fact_text"
- operating_policy: Rules, warranties, cancellation, return, liability terms — put in "fact_text"
- call_behavior_instruction: Instructions about HOW the AI should behave ("tell the agent to...", "always say...", "never mention...") — set requires_manual_review=true, explain in review_reason
- unsupported_or_ambiguous: Cannot reliably classify — set requires_manual_review=true
- conflict_flag: Contradicts another item in the same text — set requires_manual_review=true, note the conflict in review_reason

Rules:
- Extract ALL distinct items — do not merge unrelated facts into one item
- For faq_pair: question = the question, answer = the answer (both required, fact_text = "")
- For all other kinds: put content in fact_text only (question = "", answer = "")
- Keep text caller-friendly and concise — the AI agent will speak it
- Set confidence 0.0–1.0 based on clarity (0.9+ = very clear, 0.5 = ambiguous)
- Set requires_manual_review=true if: call_behavior_instruction, conflict_flag, or confidence < 0.7
- review_reason = "" unless requires_manual_review=true
- Never invent information not in the source text`

  let result: { items: unknown[]; warnings: string[] }
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
          { role: 'user', content: `Extract all knowledge items from this text:\n\n${rawInput}` },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'knowledge_items', strict: true, schema: COMPILER_SCHEMA },
        },
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[compile] OpenRouter error:', res.status, errText)
      return NextResponse.json({ error: 'AI compilation failed — try again' }, { status: 502 })
    }

    const json = await res.json()
    const content = json.choices?.[0]?.message?.content
    if (!content) return NextResponse.json({ error: 'Empty AI response' }, { status: 502 })
    result = JSON.parse(content)
  } catch (err) {
    console.error('[compile] fetch/parse error:', err)
    return NextResponse.json({ error: 'AI compilation failed — try again' }, { status: 502 })
  }

  return NextResponse.json({
    items: result.items ?? [],
    warnings: result.warnings ?? [],
  })
}
