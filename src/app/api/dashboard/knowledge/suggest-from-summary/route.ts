/**
 * POST /api/dashboard/knowledge/suggest-from-summary
 *
 * Extracts new business fact suggestions from a call's ai_summary using
 * Claude Haiku via OpenRouter. Returns up to 5 candidate facts that could
 * improve the agent's knowledge base.
 *
 * Non-blocking — does not modify any DB records. Caller can then POST each
 * accepted suggestion to /api/dashboard/knowledge/ingest-text to save it.
 *
 * Body: { call_log_id: string, client_id?: string (admin only) }
 * Response: { suggestions: Array<{ content: string, kind: string }> }
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
    call_log_id?: string
    client_id?: string
  }

  const callLogId = body.call_log_id?.trim() ?? ''
  if (!callLogId) {
    return NextResponse.json({ error: 'call_log_id is required' }, { status: 400 })
  }

  const clientId = cu.role === 'admin' && body.client_id ? body.client_id : cu.client_id
  if (!clientId) return NextResponse.json({ error: 'No client found' }, { status: 400 })

  // ── Fetch call log — verify ownership ────────────────────────────────────────
  const svc = createServiceClient()

  const { data: callLog } = await svc
    .from('call_logs')
    .select('id, client_id, ai_summary')
    .eq('id', callLogId)
    .maybeSingle()

  if (!callLog) {
    return NextResponse.json({ error: 'Call not found' }, { status: 404 })
  }

  // Non-admins can only access calls belonging to their own client
  if (cu.role !== 'admin' && callLog.client_id !== clientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── No summary — return empty suggestions immediately ─────────────────────────
  const summary = (callLog.ai_summary ?? '').trim()
  if (
    !summary ||
    summary === 'Call transcript unavailable or too short to classify.'
  ) {
    return NextResponse.json({ suggestions: [] })
  }

  // ── OpenRouter availability check ─────────────────────────────────────────────
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    // Graceful fallback — feature is opt-in via env var
    console.warn('[suggest-from-summary] OPENROUTER_API_KEY not set — returning empty suggestions')
    return NextResponse.json({ suggestions: [] })
  }

  // ── OpenRouter / Haiku call ───────────────────────────────────────────────────
  const prompt = `Extract any NEW business facts from this call summary that could improve the agent's knowledge base.
Only return facts that are concrete and verifiable (prices, hours, services, policies).
Return as JSON array: [{"content": "...", "kind": "fact|procedure|faq_pair"}]
Limit to 5 suggestions max. If no new facts found, return [].

Call summary: ${summary}`

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4-5-20251001',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown')
      console.error('[suggest-from-summary] OpenRouter error:', res.status, errText.slice(0, 200))
      return NextResponse.json({ suggestions: [] })
    }

    const json = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }

    const raw = json.choices?.[0]?.message?.content?.trim() ?? ''
    if (!raw) return NextResponse.json({ suggestions: [] })

    // Parse JSON from the model — extract array even if wrapped in markdown fences
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return NextResponse.json({ suggestions: [] })

    const parsed = JSON.parse(jsonMatch[0]) as unknown
    if (!Array.isArray(parsed)) return NextResponse.json({ suggestions: [] })

    const suggestions = parsed
      .filter((item): item is { content: string; kind: string } =>
        item !== null &&
        typeof item === 'object' &&
        typeof (item as Record<string, unknown>).content === 'string' &&
        typeof (item as Record<string, unknown>).kind === 'string'
      )
      .slice(0, 5)
      .map(item => ({
        content: item.content.slice(0, 400),
        kind: item.kind,
      }))

    return NextResponse.json({ suggestions })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[suggest-from-summary] fetch error:', msg)
    // Graceful fallback — never surface errors to the user for this non-critical feature
    return NextResponse.json({ suggestions: [] })
  }
}
