/**
 * Admin tool: per-client call activity report.
 *
 * Auth chain:
 *   1. X-Tool-Secret header must match WEBHOOK_SIGNING_SECRET.
 *   2. call.metadata.adminMode === 'true' (verified live against Ultravox API).
 *
 * Returns plaintext suitable for the agent to read aloud.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyAdminCall, checkToolSecret } from '@/lib/admin-tools'

const VALID_WINDOWS = new Set(['24h', '7d', '30d', 'mtd'])

function windowToCutoff(window: string): { sinceIso: string; label: string } {
  const now = Date.now()
  switch (window) {
    case '24h':
      return { sinceIso: new Date(now - 24 * 60 * 60 * 1000).toISOString(), label: 'last 24 hours' }
    case '7d':
      return { sinceIso: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(), label: 'last 7 days' }
    case 'mtd': {
      const d = new Date()
      return { sinceIso: new Date(d.getFullYear(), d.getMonth(), 1).toISOString(), label: 'this month' }
    }
    case '30d':
    default:
      return { sinceIso: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(), label: 'last 30 days' }
  }
}

export async function POST(req: NextRequest) {
  const secretError = checkToolSecret(req.headers.get('x-tool-secret'))
  if (secretError) return NextResponse.json({ error: secretError }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { call_id?: string; window?: string }
  const callId = body.call_id

  if (!(await verifyAdminCall(callId))) {
    return NextResponse.json({
      ok: false,
      message: "I can't run that — admin queries are only allowed in admin mode.",
    })
  }

  const window = body.window && VALID_WINDOWS.has(body.window) ? body.window : '30d'
  const { sinceIso, label } = windowToCutoff(window)

  const supabase = createServiceClient()
  const { data: rows, error } = await supabase
    .from('call_logs')
    .select('client_id, billed_duration_seconds, billed_cost_cents, call_status, end_reason, clients(business_name, slug)')
    .gte('started_at', sinceIso)
    .limit(5000)

  if (error) {
    console.error('[admin-tools/calls-report] query failed:', error.message)
    return NextResponse.json({ ok: false, message: 'Database query failed.' })
  }

  type Agg = { name: string; slug: string; calls: number; billable: number; missed: number; seconds: number; cents: number }
  const byClient = new Map<string, Agg>()
  for (const r of rows ?? []) {
    const cid = (r.client_id as string | null) ?? ''
    if (!cid) continue
    const cd = r.clients as { business_name?: string; slug?: string } | null
    const existing = byClient.get(cid) ?? { name: cd?.business_name ?? '(unknown)', slug: cd?.slug ?? '', calls: 0, billable: 0, missed: 0, seconds: 0, cents: 0 }
    existing.calls += 1
    const secs = (r.billed_duration_seconds as number | null) ?? 0
    if (secs > 0) existing.billable += 1
    if (r.call_status === 'MISSED' || r.end_reason === 'unjoined') existing.missed += 1
    existing.seconds += secs
    existing.cents += (r.billed_cost_cents as number | null) ?? 0
    byClient.set(cid, existing)
  }
  const ranked = Array.from(byClient.values()).sort((a, b) => b.seconds - a.seconds).slice(0, 10)

  if (ranked.length === 0) {
    return NextResponse.json({ ok: true, message: `No client activity in the ${label}.` })
  }

  const lines = [`Call activity, ${label}:`]
  for (const c of ranked) {
    const mins = (c.seconds / 60).toFixed(1)
    const usd = (c.cents / 100).toFixed(2)
    const missedNote = c.missed > 0 ? `, ${c.missed} missed` : ''
    lines.push(`${c.name}: ${c.calls} calls (${c.billable} billable${missedNote}), ${mins} minutes, $${usd}`)
  }
  return NextResponse.json({ ok: true, message: lines.join('\n') })
}
