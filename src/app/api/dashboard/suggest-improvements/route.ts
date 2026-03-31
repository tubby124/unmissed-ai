/**
 * POST /api/dashboard/suggest-improvements
 *
 * D257 — Self-improving agent flywheel.
 * Gathers all available owner context (TRIAGE_DEEP, context_data, extra_qa, recent
 * unanswered questions) → calls Haiku via OpenRouter → generates 2-3 specific,
 * confirmable prompt improvement suggestions → inserts into prompt_improvement_suggestions.
 *
 * Called by PromptSuggestionsCard "Generate suggestions" button.
 * Auth: Supabase session (owner or admin).
 * Rate-limited: 5 calls / client / 24h (checked against table insert timestamps).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface SuggestionRow {
  section_id: string
  trigger_type: string
  suggestion_text: string
  evidence_count: number
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Resolve client_id — admin can pass target client_id in body
  let body: { client_id?: string } = {}
  try { body = await req.json() } catch { /* no body is fine */ }

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role')
    .limit(1)
    .maybeSingle()

  if (!cu) {
    return NextResponse.json({ error: 'No client found' }, { status: 404 })
  }

  const clientId = cu.role === 'admin' && body.client_id ? body.client_id : cu.client_id

  // Rate limit: max 5 generation runs / client / 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: recentCount } = await supabase
    .from('prompt_improvement_suggestions')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .gte('created_at', oneDayAgo)

  if ((recentCount ?? 0) >= 20) {
    return NextResponse.json({ error: 'Too many suggestions generated today. Check back tomorrow.' }, { status: 429 })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI suggestions not configured' }, { status: 503 })
  }

  // Fetch client context
  const [clientRes, gapsRes] = await Promise.all([
    supabase
      .from('clients')
      .select('business_name, niche, niche_custom_variables, context_data, extra_qa, business_facts, call_handling_mode')
      .eq('id', clientId)
      .single(),
    supabase
      .from('knowledge_query_log')
      .select('query_text, result_count')
      .eq('client_id', clientId)
      .eq('result_count', 0)
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (!clientRes.data) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const client = clientRes.data
  const gaps = gapsRes.data ?? []

  // Aggregate gap queries — normalize and count frequency
  const gapCounts: Record<string, number> = {}
  for (const g of gaps) {
    const key = (g.query_text as string).trim().toLowerCase()
    gapCounts[key] = (gapCounts[key] ?? 0) + 1
  }
  const topGaps = Object.entries(gapCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([text, count]) => ({ text, count }))

  const customVars = (client.niche_custom_variables ?? {}) as Record<string, string>
  const hasTriage = !!customVars.TRIAGE_DEEP
  const hasContextData = !!(client.context_data as string | null)?.trim()
  const faqCount = Array.isArray(client.extra_qa) ? (client.extra_qa as unknown[]).length : 0
  const mode = (client.call_handling_mode as string | null) ?? 'triage'

  // Build context summary for Haiku
  const contextLines: string[] = [
    `Business: ${client.business_name}`,
    `Niche: ${(client.niche as string | null) ?? 'other'}`,
    `Call mode: ${mode}`,
    hasTriage
      ? `Current call routing (TRIAGE_DEEP):\n${customVars.TRIAGE_DEEP.slice(0, 600)}`
      : 'Call routing: NOT SET (agent has no intent routing)',
    hasContextData
      ? `Reference data (context_data):\n${(client.context_data as string).slice(0, 400)}`
      : 'Reference data: NOT SET (no prices, policies, or urgency words)',
    faqCount > 0
      ? `FAQ count: ${faqCount}`
      : 'FAQs: NONE',
  ]

  if (topGaps.length > 0) {
    contextLines.push(
      `Top unanswered caller questions:\n${topGaps.map(g => `- "${g.text}" (${g.count}x unanswered)`).join('\n')}`
    )
  }

  const contextBlock = contextLines.join('\n\n')

  const prompt = `You are an expert voice agent configurator. A business owner needs help improving their phone agent.

CURRENT AGENT CONTEXT:
${contextBlock}

TASK: Generate 2-3 specific, actionable improvements this owner can make to their agent RIGHT NOW. Each improvement must:
1. Reference a specific section: "triage" (call routing/intent), "knowledge" (FAQs/reference data), "after_hours" (hours/escalation), or "identity" (agent personality/opening)
2. Be concrete — name the specific thing to add (e.g., a specific FAQ answer, a specific triage intent, a specific policy)
3. Be based on the GAP in the current context (unanswered questions, missing routing, missing data)
4. NOT be generic advice like "add more FAQs" — instead: "Add FAQ: What is your pricing for {specific service}?"

Trigger types: "knowledge_gap" (repeated unanswered question), "missing_routing" (no triage for common intent), "missing_context" (no prices/policies), "setup_gap" (feature not configured)

Return ONLY valid JSON array, no other text:
[
  {
    "section_id": "triage|knowledge|after_hours|identity",
    "trigger_type": "knowledge_gap|missing_routing|missing_context|setup_gap",
    "suggestion_text": "Specific actionable improvement (1-2 sentences)",
    "evidence_count": number
  }
]

Maximum 3 items. Be highly specific. If no clear improvements exist, return [].`

  let suggestions: SuggestionRow[] = []

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4-5',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (res.ok) {
      const data = await res.json()
      const raw = (data.choices?.[0]?.message?.content ?? '').trim()
      const jsonMatch = raw.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]) as unknown[]
          suggestions = (Array.isArray(parsed) ? parsed : [])
            .filter((s): s is SuggestionRow =>
              typeof s === 'object' && s !== null &&
              typeof (s as SuggestionRow).section_id === 'string' &&
              typeof (s as SuggestionRow).suggestion_text === 'string'
            )
            .slice(0, 3)
        } catch { /* fall through with empty */ }
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name !== 'AbortError') {
      console.warn('[suggest-improvements] Haiku error:', err.message)
    }
  }

  if (suggestions.length === 0) {
    return NextResponse.json({ suggestions: [], message: 'No improvements needed right now — your agent looks well configured.' })
  }

  // Insert into prompt_improvement_suggestions
  const rows = suggestions.map(s => ({
    client_id: clientId,
    section_id: s.section_id,
    trigger_type: s.trigger_type ?? 'setup_gap',
    suggestion_text: s.suggestion_text,
    evidence_count: s.evidence_count ?? 1,
    status: 'pending',
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('prompt_improvement_suggestions')
    .insert(rows)
    .select('id, section_id, trigger_type, suggestion_text, evidence_count, status, created_at')

  if (insertError) {
    console.error('[suggest-improvements] insert error:', insertError.message)
    return NextResponse.json({ error: 'Failed to save suggestions' }, { status: 500 })
  }

  return NextResponse.json({ suggestions: inserted, count: inserted?.length ?? 0 })
}
