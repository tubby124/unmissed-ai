import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isAdmin = cu.role === 'admin'
  const requestedClientId = req.nextUrl.searchParams.get('client_id')
  const clientId = isAdmin ? requestedClientId : cu.client_id
  if (!clientId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('call_logs')
    .select('id, caller_phone, caller_name, call_status, ai_summary, started_at, duration_seconds')
    .eq('client_id', clientId)
    .eq('call_direction', 'outbound')
    .order('started_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ calls: data ?? [] })
}
