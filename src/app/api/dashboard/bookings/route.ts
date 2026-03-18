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
    .single()

  if (!cu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

  let query = svc
    .from('bookings')
    .select('id, slug, caller_name, caller_phone, appointment_date, appointment_time, service, calendar_url, created_at, client_id, clients(business_name)')
    .order('appointment_date', { ascending: true })
    .order('appointment_time', { ascending: true })
    .limit(limit)

  // Non-admin: scope to own client
  if (cu.role !== 'admin') {
    if (!cu.client_id) return NextResponse.json({ bookings: [] })
    query = query.eq('client_id', cu.client_id)
  }

  const { data: bookings, error } = await query
  if (error) {
    console.error('[bookings] query error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }

  return NextResponse.json({ bookings: bookings || [] })
}
