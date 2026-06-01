/**
 * GET /api/admin/notifications/lifecycle?slug=<slug>
 *
 * Admin-only proxy that calls the public.client_lifecycle(p_slug) RPC.
 * Used by the LifecycleDrawer on /dashboard/admin/notifications.
 *
 * The RPC is also callable directly with the anon key (it's security definer),
 * but we proxy here so we don't have to ship the anon key to the browser and
 * so the admin role check is enforced consistently.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: cu } = await svc
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (cu?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const slug = new URL(req.url).searchParams.get('slug')?.trim()
  if (!slug) {
    return NextResponse.json({ error: 'slug required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc as any).rpc('client_lifecycle', { p_slug: slug })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // RPC returns an array; take the first row
  const row = Array.isArray(data) && data.length > 0 ? data[0] : null
  if (!row) {
    return NextResponse.json({ error: `slug "${slug}" not found` }, { status: 404 })
  }

  return NextResponse.json({ ok: true, data: row })
}
