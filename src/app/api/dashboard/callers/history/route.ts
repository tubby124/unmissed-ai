import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = req.nextUrl
  const requestedClientId = url.searchParams.get('client_id')
  const phone = url.searchParams.get('phone')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 50)

  const contactId = url.searchParams.get('contact_id')

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (!cu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isAdmin = cu.role === 'admin'
  const clientId = isAdmin && requestedClientId ? requestedClientId : cu.client_id

  // Prefer contact_id lookup (no phone normalization needed)
  if (contactId) {
    const { data, error } = await supabase
      .from('call_logs')
      .select('id, caller_phone, caller_name, call_status, ai_summary, started_at, duration_seconds, sentiment, quality_score')
      .eq('contact_id', contactId)
      .order('started_at', { ascending: false })
      .limit(limit)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ calls: data ?? [] })
  }

  // Fallback: phone-based lookup
  if (!phone) return NextResponse.json({ error: 'phone or contact_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('call_logs')
    .select('id, caller_phone, caller_name, call_status, ai_summary, started_at, duration_seconds, sentiment, quality_score')
    .eq('client_id', clientId)
    .eq('caller_phone', phone)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ calls: data ?? [] })
}
