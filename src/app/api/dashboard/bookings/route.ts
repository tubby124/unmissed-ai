import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()

  // Get client_id + role for authenticated user
  const { data: cu } = await svc
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')
  const statusFilter = searchParams.get('status')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')

  let query = svc
    .from('bookings')
    .select('id, slug, caller_name, caller_phone, appointment_date, appointment_time, service, calendar_url, created_at, client_id, status, call_id, google_event_id, clients(business_name)', { count: 'exact' })
    .order('appointment_date', { ascending: true })
    .order('appointment_time', { ascending: true })
    .range(offset, offset + limit - 1)

  if (statusFilter) query = query.eq('status', statusFilter)
  if (dateFrom) query = query.gte('appointment_date', dateFrom)
  if (dateTo) query = query.lte('appointment_date', dateTo)

  // Non-admin: scope to own client
  if (cu.role !== 'admin') {
    if (!cu.client_id) return NextResponse.json({ bookings: [] })
    query = query.eq('client_id', cu.client_id)
  }

  const { data: bookings, count, error } = await query
  if (error) {
    console.error('[bookings] query error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }

  return NextResponse.json({ bookings: bookings || [], total: count ?? 0 })
}
