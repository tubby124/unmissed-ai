/**
 * /api/admin/harness/findings
 *
 * GET ?harness=&severity=&status=&limit=  → filtered findings list
 * PATCH { id, action: 'resolve'|'suppress'|'reopen', until?: string }
 *
 * Admin only (client_users.role='admin'). All writes go through the service
 * client so the RLS update policy is bypassed — we trust the requireAdmin()
 * gate above to enforce auth.
 *
 * Why filter at API rather than RLS: dashboard wants to pivot between
 * status=open / status=resolved / status=all without changing the user's
 * effective permissions. Doing it in WHERE keeps the policy simple.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import type { HarnessName, Severity, Status } from '@/lib/harness-writer'

const VALID_HARNESSES: ReadonlySet<HarnessName> = new Set<HarnessName>([
  'data-hygiene',
  'drift-check',
  'stripe-drift',
  'twilio-ownership',
  'telegram-health',
  'calendar-oauth',
  'prompt-injection',
  'schemathesis',
  'promptfoo',
  'provisioning-completeness',
])
const VALID_SEVERITIES: ReadonlySet<Severity> = new Set<Severity>(['P0', 'P1', 'P2', 'PASS'])
const VALID_STATUSES: ReadonlySet<Status | 'all'> = new Set<Status | 'all'>([
  'open',
  'resolved',
  'suppressed',
  'all',
])
const VALID_ACTIONS = new Set(['resolve', 'suppress', 'reopen'])

async function requireAdmin(): Promise<
  | { ok: true; userId: string }
  | { ok: false; res: NextResponse }
> {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const svc = createServiceClient()
  const { data: cu } = await svc
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()
  if (cu?.role !== 'admin') {
    return { ok: false, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { ok: true, userId: user.id }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.res

  const url = new URL(req.url)
  const harness = url.searchParams.get('harness') ?? 'all'
  const severity = url.searchParams.get('severity') ?? 'all'
  const status = url.searchParams.get('status') ?? 'open'
  const limitRaw = parseInt(url.searchParams.get('limit') ?? '200', 10)
  const limit = Math.min(Math.max(isNaN(limitRaw) ? 200 : limitRaw, 1), 1000)

  const svc = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = svc
    .from('harness_findings')
    .select(
      'id, harness_name, run_id, check_name, severity, status, client_slug, summary, details, first_seen_at, last_seen_at, resolved_at, suppressed_until',
    )

  if (harness !== 'all' && VALID_HARNESSES.has(harness as HarnessName)) {
    q = q.eq('harness_name', harness)
  }
  if (severity !== 'all' && VALID_SEVERITIES.has(severity as Severity)) {
    q = q.eq('severity', severity)
  }
  if (status !== 'all' && VALID_STATUSES.has(status as Status | 'all')) {
    q = q.eq('status', status)
  }

  // Sort: severity DESC (P0 first), then last_seen_at DESC.
  // PostgREST can't sort by an arbitrary CASE; we sort client-side after fetch
  // for severity, server-side by last_seen_at.
  q = q.order('last_seen_at', { ascending: false }).limit(limit)

  const { data, error } = await q
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const SEV_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, PASS: 3 }
  const rows = (data ?? []).slice().sort((a: { severity: string; last_seen_at: string }, b: { severity: string; last_seen_at: string }) => {
    const s = (SEV_ORDER[a.severity] ?? 99) - (SEV_ORDER[b.severity] ?? 99)
    if (s !== 0) return s
    return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime()
  })

  return NextResponse.json({ ok: true, findings: rows })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.res

  let body: { id?: unknown; action?: unknown; until?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const id = typeof body.id === 'string' ? body.id : null
  const action = typeof body.action === 'string' ? body.action : null
  const until = typeof body.until === 'string' ? body.until : null

  if (!id || !action || !VALID_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'id + valid action (resolve|suppress|reopen) required' }, { status: 400 })
  }

  const svc = createServiceClient()
  const nowIso = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {}
  if (action === 'resolve') {
    update.status = 'resolved'
    update.resolved_at = nowIso
    update.resolved_by = auth.userId
    update.suppressed_until = null
  } else if (action === 'reopen') {
    update.status = 'open'
    update.resolved_at = null
    update.resolved_by = null
    update.suppressed_until = null
  } else if (action === 'suppress') {
    if (!until || isNaN(new Date(until).getTime())) {
      return NextResponse.json({ error: 'suppress requires valid `until` ISO timestamp' }, { status: 400 })
    }
    update.status = 'suppressed'
    update.suppressed_until = new Date(until).toISOString()
    update.resolved_at = null
    update.resolved_by = null
  }

  const { error } = await svc.from('harness_findings').update(update).eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
