import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 10

/**
 * Go Live Tab Section 4 — "I've already forwarded this number — mark it done".
 *
 * Returning users who already configured carrier forwarding shouldn't have to
 * re-trigger a real verification call every visit. This sets
 * forwarding_verified_at + forwarding_self_attested=true so the GoLiveProgress
 * 4-condition check counts the section as done.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role')
    .limit(1)
    .maybeSingle()

  if (!cu || cu.role === 'viewer') return new NextResponse('Forbidden', { status: 403 })

  const body = await req.json().catch(() => ({}))
  const clientId = cu.role === 'admin' && typeof body.client_id === 'string' ? body.client_id : cu.client_id

  const svc = createServiceClient()
  const nowIso = new Date().toISOString()

  const { error } = await svc
    .from('clients')
    .update({
      forwarding_verified_at: nowIso,
      forwarding_self_attested: true,
    })
    .eq('id', clientId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, verified_at: nowIso })
}
