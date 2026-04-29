/**
 * /api/admin/learning-bank/patterns
 *
 * GET ?status=promoted&category=...&niche=...
 *   Returns prompt_patterns rows. If `niche` given, includes patterns where the niche
 *   is in niche_applicability OR where 'all' is in niche_applicability.
 *
 * PATCH { id, status: 'retired' }
 *   Marks a pattern retired.
 *
 * Admin only.
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
  const status = url.searchParams.get('status') ?? 'promoted'
  const category = url.searchParams.get('category')
  const niche = url.searchParams.get('niche')

  const svc = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = (svc as any)
    .from('prompt_patterns')
    .select('*')
    .eq('status', status)
    .order('score', { ascending: false })
    .order('promoted_at', { ascending: false })

  if (category) {
    q = q.eq('category', category)
  }

  if (niche) {
    // niche match OR 'all' membership in the array. Postgres `&&` overlaps array.
    q = q.or(`niche_applicability.cs.{${niche}},niche_applicability.cs.{all}`)
  }

  const { data, error } = await q

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, patterns: data ?? [] })
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
  if (body.status !== 'retired') {
    return NextResponse.json({ error: 'status must be "retired"' }, { status: 400 })
  }

  const svc = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc as any)
    .from('prompt_patterns')
    .update({ status: 'retired' })
    .eq('id', body.id)
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Pattern not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, pattern: data })
}
