/**
 * POST /api/dashboard/analysis/[id]/approve
 * POST /api/dashboard/analysis/[id]/reject
 * Auth: admin session
 *
 * approve: applies the recommendation, triggers test suite, returns test_run_id
 * reject:  sets status='rejected'
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { classifyCall } from '@/lib/openrouter'

export const maxDuration = 120

async function runTestSuiteInternal(clientId: string, businessContext: string): Promise<{
  run_id: string | null
  total: number
  passed: number
  failed: number
}> {
  const supabase = createServiceClient()

  const { data: scenarios } = await supabase
    .from('test_scenarios')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at')

  if (!scenarios?.length) return { run_id: null, total: 0, passed: 0, failed: 0 }

  const results = await Promise.all(
    scenarios.map(async (s) => {
      const transcript = s.transcript as Array<{ role: string; text: string }>
      const classification = await classifyCall(transcript, businessContext)
      const passed = classification.status === s.expected_status
      return { scenario_id: s.id, name: s.name, expected: s.expected_status, got: classification.status, passed, confidence: classification.confidence }
    })
  )

  const total = results.length
  const passed = results.filter(r => r.passed).length

  const { data: runRow } = await supabase
    .from('test_runs')
    .insert({ client_id: clientId, triggered_by: 'post_approval', total, passed, failed: total - passed, results })
    .select('id')
    .single()

  return { run_id: runRow?.id || null, total, passed, failed: total - passed }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase.from('client_users').select('client_id,role').eq('user_id', user.id).single()
  if (!cu || cu.role !== 'admin') return new NextResponse('Forbidden', { status: 403 })

  const body = await req.json().catch(() => ({}))
  const action = body.action === 'reject' ? 'reject' : 'approve'

  if (action === 'reject') {
    const { error } = await supabase
      .from('call_analysis_reports')
      .update({ status: 'rejected' })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, status: 'rejected' })
  }

  // Approve flow
  const { data: report } = await supabase
    .from('call_analysis_reports')
    .select('*')
    .eq('id', id)
    .single()

  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  const { recommendation_index } = body as { recommendation_index?: number }

  // If a specific recommendation has a prompt change, apply it
  let promptApplied = false
  if (typeof recommendation_index === 'number' && Array.isArray(report.recommendations)) {
    const rec = report.recommendations[recommendation_index] as Record<string, unknown> | undefined
    if (rec?.change_type === 'prompt' && typeof rec.suggested_value === 'string') {
      // Append the suggested value to the system prompt
      const { data: client } = await supabase
        .from('clients')
        .select('system_prompt')
        .eq('id', report.client_id)
        .single()

      if (client?.system_prompt) {
        const newPrompt = `${client.system_prompt}\n\n// Auto-applied recommendation (${new Date().toLocaleDateString()}):\n${rec.suggested_value}`
        await supabase.from('clients').update({ system_prompt: newPrompt, updated_at: new Date().toISOString() }).eq('id', report.client_id)
        promptApplied = true
      }
    }
  }

  // Mark report applied
  await supabase
    .from('call_analysis_reports')
    .update({ status: 'applied', applied_at: new Date().toISOString() })
    .eq('id', id)

  // Auto-run test suite
  const { data: client } = await supabase
    .from('clients')
    .select('business_name, niche')
    .eq('id', report.client_id)
    .single()

  const businessContext = [client?.business_name, client?.niche].filter(Boolean).join(' — ')
  const testRun = await runTestSuiteInternal(report.client_id, businessContext)

  return NextResponse.json({
    ok: true,
    status: 'applied',
    prompt_applied: promptApplied,
    test_run: testRun,
  })
}
