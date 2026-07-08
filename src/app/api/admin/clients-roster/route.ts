/**
 * /api/admin/clients-roster — admin Mission Control client roster.
 *
 * GET  — all clients with billing state + per-client call aggregates
 *        (calls_7d, last_call_at) computed from ONE call_logs query,
 *        plus header stats (MRR, active/trialing counts, stale list).
 * PATCH — { client_id, action: 'pause' | 'resume' } → clients.status update.
 *
 * Admin-only (client_users role gate, .limit(1).maybeSingle() — never .single()).
 */

import { NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

const STALE_DAYS = 21

async function requireAdmin(): Promise<{ svc: ReturnType<typeof createServiceClient> } | NextResponse> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const svc = createServiceClient()
  const { data: cu } = await svc
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (cu?.role !== 'admin') return new NextResponse('Forbidden', { status: 403 })
  return { svc }
}

export interface RosterClient {
  id: string
  slug: string
  business_name: string | null
  agent_name: string | null
  status: string | null
  selected_plan: string | null
  subscription_status: string | null
  effective_monthly_rate: number | null
  trial_expires_at: string | null
  grace_period_end: string | null
  monthly_minute_limit: number | null
  minutes_used_this_month: number | null
  has_stripe: boolean
  twilio_number: string | null
  telegram_linked: boolean
  contact_email: string | null
  created_at: string | null
  calls_7d: number
  last_call_at: string | null
  is_stale: boolean
}

export interface RosterStats {
  mrr: number
  active_count: number
  trialing_count: number
  stale: { id: string; slug: string; business_name: string | null; last_call_at: string | null }[]
}

export async function GET() {
  const gate = await requireAdmin()
  if (gate instanceof NextResponse) return gate
  const { svc } = gate

  const { data: clients, error } = await svc
    .from('clients')
    .select('id, slug, business_name, agent_name, status, selected_plan, subscription_status, effective_monthly_rate, trial_expires_at, grace_period_end, monthly_minute_limit, minutes_used_this_month, stripe_customer_id, twilio_number, telegram_chat_id, contact_email, created_at')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ONE grouped call_logs query (not N+1): pull (client_id, started_at) for all
  // real calls, newest first, and fold into per-client aggregates in memory.
  // Excludes browser test calls and test/demo statuses. Bounded at 20k rows
  // (newest-first, so older overflow only affects clients already stale).
  const { data: callRows, error: callErr } = await svc
    .from('call_logs')
    .select('client_id, started_at')
    .neq('caller_phone', 'webrtc-test')
    .not('call_status', 'in', '("test","demo")')
    .not('started_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(20000)

  if (callErr) return NextResponse.json({ error: callErr.message }, { status: 500 })

  const now = Date.now()
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
  const staleCutoff = now - STALE_DAYS * 24 * 60 * 60 * 1000

  const lastCallMap = new Map<string, string>()
  const calls7dMap = new Map<string, number>()
  for (const row of callRows ?? []) {
    const cid = row.client_id as string | null
    if (!cid || !row.started_at) continue
    if (!lastCallMap.has(cid)) lastCallMap.set(cid, row.started_at as string) // rows are newest-first
    if (new Date(row.started_at as string).getTime() >= sevenDaysAgo) {
      calls7dMap.set(cid, (calls7dMap.get(cid) ?? 0) + 1)
    }
  }

  const roster: RosterClient[] = (clients ?? []).map((c) => {
    const lastCallAt = lastCallMap.get(c.id as string) ?? null
    const isStale =
      c.status === 'active' &&
      (!lastCallAt || new Date(lastCallAt).getTime() < staleCutoff)
    return {
      id: c.id as string,
      slug: c.slug as string,
      business_name: (c.business_name as string | null) ?? null,
      agent_name: (c.agent_name as string | null) ?? null,
      status: (c.status as string | null) ?? null,
      selected_plan: (c.selected_plan as string | null) ?? null,
      subscription_status: (c.subscription_status as string | null) ?? null,
      effective_monthly_rate: (c.effective_monthly_rate as number | null) ?? null,
      trial_expires_at: (c.trial_expires_at as string | null) ?? null,
      grace_period_end: (c.grace_period_end as string | null) ?? null,
      monthly_minute_limit: (c.monthly_minute_limit as number | null) ?? null,
      minutes_used_this_month: (c.minutes_used_this_month as number | null) ?? null,
      has_stripe: !!c.stripe_customer_id,
      twilio_number: (c.twilio_number as string | null) ?? null,
      telegram_linked: !!c.telegram_chat_id,
      contact_email: (c.contact_email as string | null) ?? null,
      created_at: (c.created_at as string | null) ?? null,
      calls_7d: calls7dMap.get(c.id as string) ?? 0,
      last_call_at: lastCallAt,
      is_stale: isStale,
    }
  })

  const stats: RosterStats = {
    mrr: roster
      .filter(c => c.status === 'active' && (c.effective_monthly_rate ?? 0) > 0)
      .reduce((sum, c) => sum + (c.effective_monthly_rate ?? 0), 0),
    active_count: roster.filter(c => c.status === 'active').length,
    trialing_count: roster.filter(c => c.subscription_status === 'trialing').length,
    stale: roster
      .filter(c => c.is_stale)
      .map(c => ({ id: c.id, slug: c.slug, business_name: c.business_name, last_call_at: c.last_call_at })),
  }

  return NextResponse.json({ clients: roster, stats })
}

export async function PATCH(req: Request) {
  const gate = await requireAdmin()
  if (gate instanceof NextResponse) return gate
  const { svc } = gate

  let body: { client_id?: unknown; action?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const clientId = typeof body.client_id === 'string' ? body.client_id : null
  const action = body.action === 'pause' || body.action === 'resume' ? body.action : null
  if (!clientId || !action) {
    return NextResponse.json({ error: 'client_id and action (pause|resume) required' }, { status: 400 })
  }

  const newStatus = action === 'pause' ? 'paused' : 'active'

  const { data: updated, error } = await svc
    .from('clients')
    .update({ status: newStatus })
    .eq('id', clientId)
    .select('id, slug, status')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  return NextResponse.json({ ok: true, client_id: updated.id, status: updated.status })
}
