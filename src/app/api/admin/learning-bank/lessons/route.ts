/**
 * /api/admin/learning-bank/lessons
 *
 * GET ?status=open&limit=100  → list prompt_lessons with joined client.slug + call duration
 * PATCH { id, status }        → update lesson status to 'rejected' | 'applied'
 *
 * Admin only (client_users.role='admin').
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

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
  const status = url.searchParams.get('status') ?? 'open'
  const limitRaw = parseInt(url.searchParams.get('limit') ?? '100', 10)
  const limit = Math.min(Math.max(isNaN(limitRaw) ? 100 : limitRaw, 1), 500)

  const svc = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc as any)
    .from('prompt_lessons')
    .select(`
      id,
      client_id,
      call_id,
      observation_type,
      what_happened,
      recommended_change,
      severity,
      status,
      promoted_pattern_id,
      source,
      metadata,
      created_at,
      reviewed_at,
      reviewed_by,
      clients:client_id ( slug, business_name ),
      call_logs:call_id ( duration_seconds, started_at )
    `)
    .eq('status', status)
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, lessons: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.res

  const body = await req.json().catch(() => ({})) as {
    id?: string
    status?: string
  }

  if (!body.id || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }
  const allowed = new Set(['rejected', 'applied'])
  if (!body.status || !allowed.has(body.status)) {
    return NextResponse.json({ error: `status must be one of: ${[...allowed].join(', ')}` }, { status: 400 })
  }

  const svc = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc as any)
    .from('prompt_lessons')
    .update({
      status: body.status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.userId,
    })
    .eq('id', body.id)
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, lesson: data })
}
