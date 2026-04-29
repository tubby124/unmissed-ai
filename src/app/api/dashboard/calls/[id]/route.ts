import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { updateLeadStatusForClient } from '@/lib/calls/lead-status'

const VALID_STATUSES = ['HOT', 'WARM', 'COLD', 'JUNK', 'MISSED']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu) {
    return NextResponse.json({ error: 'No client found' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const { call_status, lead_status } = body

  // lead_status update path — delegated to the shared mutator so the
  // Telegram cf:<uuid> handler can reuse the same SQL + validation
  // without an internal HTTP roundtrip (it can't satisfy this route's
  // user-session auth from a service-role webhook).
  if ('lead_status' in body) {
    const scopedClientId = cu.role === 'admin' ? null : (cu.client_id as string)
    const result = await updateLeadStatusForClient(supabase, id, scopedClientId, lead_status)
    if (!result.ok) {
      const status = result.code === 'invalid_status' ? 400
        : result.code === 'not_found' ? 404
        : 500
      return NextResponse.json({ error: result.error }, { status })
    }
    return NextResponse.json({ ok: true, id: result.id, lead_status })
  }

  // call_status update path
  if (!call_status || !VALID_STATUSES.includes(call_status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  // Build query — verify the call belongs to this user's client (unless admin)
  let query = supabase
    .from('call_logs')
    .update({ call_status })
    .eq('id', id)

  if (cu.role !== 'admin') {
    query = query.eq('client_id', cu.client_id)
  }

  const { error } = await query.select('id').single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id, call_status })
}
