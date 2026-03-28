/**
 * POST /api/dashboard/services/analyze
 *
 * Analyzes free-text service descriptions with Claude Haiku 4.5 (via OpenRouter)
 * and returns suggested ServiceDraft rows for human review. NO DB writes.
 *
 * Body: { raw_input: string, client_id?: string (admin only) }
 * Response: { drafts: ServiceDraft[], warnings: string[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const SERVICE_ANALYZE_MODEL = 'anthropic/claude-haiku-4-5'

const ANALYZE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    drafts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name:          { type: 'string' },
          description:   { type: 'string' },
          category:      { type: 'string' },
          duration_mins: { type: 'number' },
          price:         { type: 'string' },
          booking_notes: { type: 'string' },
        },
        required: ['name', 'description', 'category', 'price', 'booking_notes'],
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['drafts', 'warnings'],
}

export async function POST(req: NextRequest) {
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

  const body = await req.json().catch(() => ({})) as { raw_input?: string }
  const rawInput = body.raw_input?.trim() ?? ''
  if (!rawInput) return NextResponse.json({ error: 'raw_input is required' }, { status: 400 })
  if (rawInput.length > 5_000) {
    return NextResponse.json({ error: 'Input too long (max 5,000 chars)' }, { status: 400 })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI analyzer is not configured' }, { status: 503 })

  const systemPrompt = `You are a service catalog assistant for a voice AI booking agent.
Extract individual services from the input text and return structured rows.

Rules:
- One row per distinct service (do not merge different services)
- name: short, caller-friendly service name (max 60 chars)
- description: one sentence explaining the service (leave blank if obvious from name)
- category: group related services (e.g. "Haircuts", "Color", "Skin Care") — leave blank if unclear
- price: as written by the owner (e.g. "$45", "$45–$60", "from $45") — leave blank if not mentioned
- duration_mins: integer minutes, or omit if not mentioned
- booking_notes: any special booking requirements (e.g. "requires patch test 48h before", "walk-in only") — leave blank if none
- Never invent prices, durations, or requirements not stated in the input`

  let result: { drafts: unknown[]; warnings: string[] }
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: SERVICE_ANALYZE_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract service rows from this text:\n\n${rawInput}` },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'service_drafts', strict: true, schema: ANALYZE_SCHEMA },
        },
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[services/analyze] OpenRouter error:', res.status, errText)
      return NextResponse.json({ error: 'AI analysis failed — try again' }, { status: 502 })
    }

    const json = await res.json()
    const content = json.choices?.[0]?.message?.content
    if (!content) return NextResponse.json({ error: 'Empty AI response' }, { status: 502 })
    result = JSON.parse(content)
  } catch (err) {
    console.error('[services/analyze] fetch/parse error:', err)
    return NextResponse.json({ error: 'AI analysis failed — try again' }, { status: 502 })
  }

  const drafts = Array.isArray(result.drafts)
    ? result.drafts.filter(
        (d: unknown) =>
          typeof (d as Record<string, unknown>).name === 'string' &&
          ((d as Record<string, unknown>).name as string).trim(),
      )
    : []

  return NextResponse.json({ drafts, warnings: result.warnings ?? [] })
}
