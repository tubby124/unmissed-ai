/**
 * POST /api/dashboard/analyze-now
 * Session-auth proxy for /api/cron/analyze-calls — for use from the dashboard UI.
 * Auth: Supabase session, admin role.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { sendAlert } from '@/lib/telegram'
import { BRAND_NAME, BRAND_REFERER } from '@/lib/brand'

const ANALYSIS_SYSTEM_PROMPT = `You are an AI voice agent performance analyst. You will receive a batch of classified call summaries for a service business and identify patterns, issues, and specific recommendations to improve the AI agent's performance.

Return a single JSON object with this exact structure:
{"issues":[{"severity":"high"|"medium"|"low","type":"misclassification"|"missed_info"|"tone"|"prompt_gap"|"follow_up"|"other","description":"concise description","example_call_id":"string or null","frequency":"e.g. 3 of 10 calls"}],"recommendations":[{"title":"short title","rationale":"why this helps","change_type":"prompt"|"classification"|"follow_up"|"other","priority":"high"|"medium"|"low","suggested_value":"specific text or instruction"}],"overall_quality_score":0-100,"summary":"2-3 sentence executive summary"}

Rules: max 5 issues, max 5 recommendations. Sort by severity/priority descending. Be specific and actionable.`

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase.from('client_users').select('client_id,role').eq('user_id', user.id).single()
  if (!cu || !['admin', 'owner'].includes(cu.role)) return new NextResponse('Forbidden', { status: 403 })

  const body = await req.json().catch(() => ({}))
  const clientId = (body.client_id as string | undefined) || cu.client_id

  const svc = createServiceClient()

  const { data: client } = await svc
    .from('clients')
    .select('id, slug, business_name, niche, telegram_bot_token, telegram_chat_id')
    .eq('id', clientId)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // Idempotency: if a pending report exists created in the last 60 min, return it (prevent TOCTOU duplicate runs)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data: existingReport } = await svc
    .from('call_analysis_reports')
    .select('id, issues, recommendations')
    .eq('client_id', clientId)
    .eq('status', 'pending')
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingReport) {
    return NextResponse.json({
      ok: true,
      report_id: existingReport.id,
      issues_count: Array.isArray(existingReport.issues) ? existingReport.issues.length : 0,
      recommendations_count: Array.isArray(existingReport.recommendations) ? existingReport.recommendations.length : 0,
      deduplicated: true,
    })
  }

  const { data: calls } = await svc
    .from('call_logs')
    .select('id, call_status, ai_summary, service_type, confidence, sentiment, key_topics, next_steps, quality_score, duration_seconds, ended_at')
    .eq('client_id', clientId)
    .not('call_status', 'in', '("live","processing","MISSED","JUNK")')
    .not('test_call', 'is', true)
    .order('ended_at', { ascending: false })
    .limit(50)

  if (!calls?.length) return NextResponse.json({ error: 'No classified calls to analyze yet' }, { status: 422 })

  const periodStart = calls[calls.length - 1]?.ended_at
  const periodEnd = calls[0]?.ended_at
  const businessContext = [client.business_name, client.niche].filter(Boolean).join(' — ') || 'service business'

  const callText = calls.map((c, i) => {
    const topics = Array.isArray(c.key_topics) ? c.key_topics.join(', ') : 'none'
    return `Call ${i + 1} [${c.id}]: status=${c.call_status} confidence=${c.confidence ?? '?'}% sentiment=${c.sentiment ?? '?'} quality=${c.quality_score ?? '?'} duration=${c.duration_seconds ?? 0}s service=${c.service_type ?? '?'} topics=[${topics}] summary="${(c.ai_summary || 'none').slice(0, 100)}"`
  }).join('\n')

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 500 })

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': BRAND_REFERER, 'X-Title': `${BRAND_NAME} analyzer` },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-4.5',
      messages: [
        { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
        { role: 'user', content: `Analyze these ${calls.length} calls for ${businessContext}:\n\n${callText}` },
      ],
      max_tokens: 1200,
      temperature: 0,
    }),
  })

  if (!res.ok) return NextResponse.json({ error: `OpenRouter error: ${res.status}` }, { status: 500 })

  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content?.trim() || ''
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  let parsed: { issues?: unknown[]; recommendations?: unknown[]; overall_quality_score?: number; summary?: string }
  try { parsed = JSON.parse(cleaned) }
  catch { return NextResponse.json({ error: 'OpenRouter returned unparseable response' }, { status: 500 }) }

  const { data: reportRow } = await svc
    .from('call_analysis_reports')
    .insert({ client_id: clientId, calls_analyzed: calls.length, period_start: periodStart, period_end: periodEnd, issues: parsed.issues || [], recommendations: parsed.recommendations || [], status: 'pending' })
    .select('id')
    .single()

  const issuesCount = Array.isArray(parsed.issues) ? parsed.issues.length : 0
  const recsCount = Array.isArray(parsed.recommendations) ? parsed.recommendations.length : 0

  if (client.telegram_bot_token && client.telegram_chat_id) {
    await sendAlert(client.telegram_bot_token, client.telegram_chat_id,
      `🔬 <b>New Analysis Ready — ${client.business_name || client.slug}</b>\n📊 ${calls.length} calls · 🐛 ${issuesCount} issues · 💡 ${recsCount} recs\n⭐ Quality: ${parsed.overall_quality_score ?? '?'}/100\n💬 ${(parsed.summary || '').slice(0, 200)}\n\n📋 Review → /admin/insights`)
  }

  return NextResponse.json({ ok: true, report_id: reportRow?.id, issues_count: issuesCount, recommendations_count: recsCount, calls_analyzed: calls.length })
}
