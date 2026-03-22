import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()

  const { data: cu } = await svc
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  if (!cu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')
  const channel = searchParams.get('channel') // telegram, email, sms_followup, system, or null for all
  const status = searchParams.get('status') // sent, failed, or null for all

  let query = svc
    .from('notification_logs')
    .select('id, call_id, client_id, channel, recipient, content, status, error, external_id, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // Non-admin: scope to own client
  if (cu.role !== 'admin') {
    if (!cu.client_id) return NextResponse.json({ notifications: [], total: 0 })
    query = query.eq('client_id', cu.client_id)
  }

  if (channel) query = query.eq('channel', channel)
  if (status) query = query.eq('status', status)

  const { data: notifications, count, error } = await query
  if (error) {
    console.error('[notifications] query error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }

  return NextResponse.json({ notifications: notifications || [], total: count ?? 0 })
}
