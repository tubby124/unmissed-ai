/**
 * POST /api/dashboard/run-test-suite
 * Auth: Supabase session, admin role
 * Session-authenticated wrapper around the test-suite runner for use from the dashboard UI.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { classifyCall } from '@/lib/openrouter'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cuRows } = await supabase.from('client_users').select('client_id,role').eq('user_id', user.id).order('role').limit(1)
  const cu = cuRows?.[0] ?? null
  if (!cu || cu.role !== 'admin') return new NextResponse('Forbidden', { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { slug, tags } = body as { slug?: string; tags?: string[] }

  const svc = createServiceClient()

  let clientId = cu.client_id
  let businessContext = ''

  if (slug) {
    const { data: c } = await svc.from('clients').select('id, business_name, niche').eq('slug', slug).single()
    if (!c) return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 })
    clientId = c.id
    businessContext = [c.business_name, c.niche].filter(Boolean).join(' — ')
  } else {
    const { data: c } = await svc.from('clients').select('business_name, niche').eq('id', clientId).single()
    businessContext = [c?.business_name, c?.niche].filter(Boolean).join(' — ')
  }

  let query = svc.from('test_scenarios').select('*').eq('client_id', clientId)
  if (tags?.length) query = query.overlaps('tags', tags)
  const { data: scenarios } = await query.order('created_at')

  if (!scenarios?.length) return NextResponse.json({ error: 'No test scenarios found' }, { status: 404 })

  const results = await Promise.all(
    scenarios.map(async (s) => {
      const transcript = s.transcript as Array<{ role: string; text: string }>
      const classification = await classifyCall(transcript, businessContext || undefined)
      const passed = classification.status === s.expected_status
      return { scenario_id: s.id, name: s.name, expected: s.expected_status, got: classification.status, passed, confidence: classification.confidence, summary: classification.summary }
    })
  )

  const total = results.length
  const passed = results.filter(r => r.passed).length
  const failed = total - passed

  const { data: runRow } = await svc
    .from('test_runs')
    .insert({ client_id: clientId, triggered_by: 'manual', total, passed, failed, results })
    .select('id')
    .single()

  return NextResponse.json({ ok: true, run_id: runRow?.id, total, passed, failed, pass_rate: `${Math.round((passed / total) * 100)}%`, results })
}
