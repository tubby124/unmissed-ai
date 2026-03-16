/**
 * POST /api/debug/run-test-suite
 * Auth: Bearer ADMIN_PASSWORD
 *
 * Runs all test_scenarios for a client through classifyCall() and
 * records pass/fail results in test_runs.
 *
 * Body: { slug: string, tags?: string[], triggered_by?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { classifyCall } from '@/lib/openrouter'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!adminPassword || token !== adminPassword) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { slug, tags, triggered_by = 'manual' } = body as {
    slug?: string
    tags?: string[]
    triggered_by?: string
  }

  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: client } = await supabase
    .from('clients')
    .select('id, business_name, niche')
    .eq('slug', slug)
    .single()

  if (!client) return NextResponse.json({ error: `Client not found: ${slug}` }, { status: 404 })

  let query = supabase
    .from('test_scenarios')
    .select('*')
    .eq('client_id', client.id)

  if (tags?.length) {
    query = query.overlaps('tags', tags)
  }

  const { data: scenarios, error: scenariosError } = await query.order('created_at')
  if (scenariosError) return NextResponse.json({ error: scenariosError.message }, { status: 500 })
  if (!scenarios?.length) return NextResponse.json({ error: 'No test scenarios found for this client' }, { status: 404 })

  const businessContext = [client.business_name, client.niche].filter(Boolean).join(' — ')

  const results = await Promise.all(
    scenarios.map(async (s) => {
      const transcript = s.transcript as Array<{ role: string; text: string }>
      const classification = await classifyCall(transcript, businessContext || undefined)
      const passed = classification.status === s.expected_status
      return {
        scenario_id: s.id,
        name: s.name,
        expected: s.expected_status,
        got: classification.status,
        passed,
        confidence: classification.confidence,
        summary: classification.summary,
      }
    })
  )

  const total = results.length
  const passed = results.filter(r => r.passed).length
  const failed = total - passed

  const { data: runRow } = await supabase
    .from('test_runs')
    .insert({
      client_id: client.id,
      triggered_by,
      total,
      passed,
      failed,
      results,
    })
    .select('id')
    .single()

  return NextResponse.json({
    ok: true,
    run_id: runRow?.id,
    slug,
    total,
    passed,
    failed,
    pass_rate: `${Math.round((passed / total) * 100)}%`,
    results,
  })
}
