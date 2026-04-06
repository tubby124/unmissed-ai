import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

async function getAuth() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, isAdmin: false, ownerClientId: null as string | null }
  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()
  const isAdmin = cu?.role === 'admin'
  const ownerClientId = !isAdmin ? (cu?.client_id ?? null) : null
  return { supabase, user, isAdmin, ownerClientId }
}

export async function GET(req: NextRequest) {
  const { supabase, user, isAdmin, ownerClientId } = await getAuth()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const urgency = searchParams.get('urgency')
  const clientId = searchParams.get('client_id')

  let query = supabase
    .from('maintenance_requests')
    .select('id, client_id, unit_number, tenant_name, caller_phone, category, description, urgency_tier, preferred_access_window, entry_permission, status, created_at, created_by, call_log_id, notes')
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    if (!ownerClientId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    query = query.eq('client_id', ownerClientId)
  } else {
    if (clientId) query = query.eq('client_id', clientId)
  }

  if (status) query = query.eq('status', status)
  if (urgency) query = query.eq('urgency_tier', urgency)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ maintenance_requests: data })
}

export async function PATCH(req: NextRequest) {
  const { supabase, user, isAdmin, ownerClientId } = await getAuth()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id query param is required' }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { status } = body as { status?: string }
  const VALID_STATUSES = ['new', 'in_progress', 'completed']
  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
  }

  // Non-admin owners can only update requests for their own client
  if (!isAdmin) {
    if (!ownerClientId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { data: existing } = await supabase
      .from('maintenance_requests')
      .select('client_id')
      .eq('id', id)
      .limit(1)
      .maybeSingle()
    if (!existing || existing.client_id !== ownerClientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { data, error } = await supabase
    .from('maintenance_requests')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ maintenance_request: data })
}
