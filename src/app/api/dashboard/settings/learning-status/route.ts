/**
 * GET /api/dashboard/settings/learning-status
 * Auth: owner/admin (same pattern as improve-prompt)
 *
 * Returns whether the learning loop should trigger and the latest pending report.
 * Trigger conditions (either is sufficient):
 *   - cadence: 5+ non-JUNK real calls since last analysis
 *   - friction_call: any call with quality_score < 5
 *   - unknown_status: any call classified UNKNOWN
 *   - short_call: any call < 15s (caller hung up fast — friction signal)
 *   - frustrated: any call with sentiment = frustrated
 * If a pending report already exists, should_analyze = false (avoid duplicate runs).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

type Recommendation = {
  title: string
  rationale: string
  priority: 'high' | 'medium' | 'low'
}

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  if (!cu) return new NextResponse('No client found', { status: 404 })
  if (!['admin', 'owner'].includes(cu.role)) return new NextResponse('Forbidden', { status: 403 })

  // Admin can query any client via ?client_id=xxx
  const url = new URL(req.url)
  const queryClientId = url.searchParams.get('client_id')
  const targetClientId = cu.role === 'admin' ? (queryClientId ?? cu.client_id) : cu.client_id

  if (!targetClientId) return NextResponse.json({ error: 'No client_id' }, { status: 400 })

  const svc = createServiceClient()

  // Get client data (including pending loop suggestion from cron)
  const { data: clientData } = await svc
    .from('clients')
    .select('pending_loop_suggestion')
    .eq('id', targetClientId)
    .single()

  // Get most recent analysis report for this client
  const { data: latestReport } = await svc
    .from('call_analysis_reports')
    .select('id, created_at, calls_analyzed, recommendations, issues, status')
    .eq('client_id', targetClientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastAnalyzedAt = latestReport?.created_at ?? null
  const hasPendingReport = latestReport?.status === 'pending'

  // Fetch recent calls for signal detection — filter by date in JS after single query
  const { data: callsWithDate } = await svc
    .from('call_logs')
    .select('id, call_status, quality_score, sentiment, duration_seconds, ended_at')
    .eq('client_id', targetClientId)
    .not('call_status', 'in', '("live","processing","JUNK")')
    .not('test_call', 'is', true)
    .order('ended_at', { ascending: false })
    .limit(50)

  const recentCalls = (callsWithDate ?? []).filter(c =>
    !lastAnalyzedAt || new Date(c.ended_at) > new Date(lastAnalyzedAt)
  )

  const callCount = recentCalls.length

  // Evaluate trigger signals
  const hasFrictionCall = recentCalls.some(c => c.quality_score != null && c.quality_score < 5)
  const hasUnknownStatus = recentCalls.some(c => c.call_status === 'UNKNOWN')
  const hasShortCall = recentCalls.some(c => c.duration_seconds != null && c.duration_seconds < 15)
  const hasFrustratedCaller = recentCalls.some(c => c.sentiment === 'frustrated')
  const hasCountTrigger = callCount >= 5

  let triggerReason: 'cadence' | 'friction_call' | 'unknown_status' | 'short_call' | 'frustrated' | null = null
  if (hasUnknownStatus) triggerReason = 'unknown_status'
  else if (hasFrictionCall) triggerReason = 'friction_call'
  else if (hasFrustratedCaller) triggerReason = 'frustrated'
  else if (hasShortCall) triggerReason = 'short_call'
  else if (hasCountTrigger) triggerReason = 'cadence'

  const shouldAnalyze = triggerReason !== null && !hasPendingReport

  // Build top_recs from pending report if available
  let pendingReport = null
  if (latestReport?.status === 'pending') {
    const recs = (latestReport.recommendations as Recommendation[] | null) ?? []
    pendingReport = {
      id: latestReport.id as string,
      recommendations_count: recs.length,
      top_recs: recs.slice(0, 2).map(r => ({
        title: r.title,
        rationale: r.rationale,
        priority: r.priority,
      })),
    }
  }

  return NextResponse.json({
    calls_since_last_analysis: callCount,
    last_analyzed_at: lastAnalyzedAt,
    should_analyze: shouldAnalyze,
    trigger_reason: triggerReason,
    pending_report: pendingReport,
    loop_suggestion: clientData?.pending_loop_suggestion ?? null,
  })
}
