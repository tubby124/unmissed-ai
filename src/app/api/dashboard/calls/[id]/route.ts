import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

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
    .single()

  if (!cu) {
    return NextResponse.json({ error: 'No client found' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const { call_status } = body

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

  const { error, count } = await query.select('id').single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id, call_status })
}
