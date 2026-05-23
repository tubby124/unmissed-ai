/**
 * Admin tool: platform spend totals + top spenders.
 * Auth: X-Tool-Secret + call.metadata.adminMode === 'true'.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyAdminCall, checkToolSecret } from '@/lib/admin-tools'

const VALID_WINDOWS = new Set(['24h', '7d', '30d', 'mtd', 'all'])

function windowToCutoff(window: string): { sinceIso: string | null; label: string } {
  const now = Date.now()
  switch (window) {
    case '24h':
      return { sinceIso: new Date(now - 24 * 60 * 60 * 1000).toISOString(), label: 'last 24 hours' }
    case '7d':
      return { sinceIso: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(), label: 'last 7 days' }
    case '30d':
      return { sinceIso: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(), label: 'last 30 days' }
    case 'all':
      return { sinceIso: null, label: 'all time' }
    case 'mtd':
    default: {
      const d = new Date()
      return { sinceIso: new Date(d.getFullYear(), d.getMonth(), 1).toISOString(), label: 'this month' }
    }
  }
}

export async function POST(req: NextRequest) {
  const secretError = checkToolSecret(req.headers.get('x-tool-secret'))
  if (secretError) return NextResponse.json({ error: secretError }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { call_id?: string; window?: string }
  if (!(await verifyAdminCall(body.call_id))) {
    return NextResponse.json({ ok: false, message: "I can't run that — admin queries are only allowed in admin mode." })
  }

  const window = body.window && VALID_WINDOWS.has(body.window) ? body.window : 'mtd'
  const { sinceIso, label } = windowToCutoff(window)

  const supabase = createServiceClient()
  let q = supabase
    .from('call_logs')
    .select('client_id, billed_cost_cents, billed_duration_seconds, clients(business_name, slug)')
    .gt('billed_cost_cents', 0)
    .limit(20000)
  if (sinceIso) q = q.gte('started_at', sinceIso)

  const { data: rows, error } = await q
  if (error) {
    console.error('[admin-tools/spend-report] query failed:', error.message)
    return NextResponse.json({ ok: false, message: 'Database query failed.' })
  }

  type Agg = { name: string; slug: string; cents: number; seconds: number; calls: number }
  const byClient = new Map<string, Agg>()
  let totalCents = 0
  let totalSeconds = 0
  let totalCalls = 0
  for (const r of rows ?? []) {
    const cents = (r.billed_cost_cents as number | null) ?? 0
    const secs = (r.billed_duration_seconds as number | null) ?? 0
    totalCents += cents
    totalSeconds += secs
    totalCalls += 1
    const cid = (r.client_id as string | null) ?? ''
    if (!cid) continue
    const cd = r.clients as { business_name?: string; slug?: string } | null
    const existing = byClient.get(cid) ?? { name: cd?.business_name ?? '(unknown)', slug: cd?.slug ?? '', cents: 0, seconds: 0, calls: 0 }
    existing.cents += cents
    existing.seconds += secs
    existing.calls += 1
    byClient.set(cid, existing)
  }
  const top = Array.from(byClient.values()).sort((a, b) => b.cents - a.cents).slice(0, 5)

  const totalUsd = (totalCents / 100).toFixed(2)
  const totalMins = (totalSeconds / 60).toFixed(1)
  const lines = [
    `Platform spend, ${label}: $${totalUsd} across ${totalCalls} billable calls and ${totalMins} minutes.`,
  ]
  if (top.length > 0) {
    lines.push('Top spenders:')
    for (const c of top) {
      const usd = (c.cents / 100).toFixed(2)
      const mins = (c.seconds / 60).toFixed(1)
      lines.push(`${c.name}: $${usd} (${c.calls} calls, ${mins} min)`)
    }
  }
  return NextResponse.json({ ok: true, message: lines.join('\n') })
}
