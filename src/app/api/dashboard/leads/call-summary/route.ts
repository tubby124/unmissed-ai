import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const callLogId = searchParams.get('call_log_id')
  if (!callLogId) return NextResponse.json({ error: 'call_log_id required' }, { status: 400 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  const isAdmin = cu?.role === 'admin'

  const { data: log } = await supabase
    .from('call_logs')
    .select('ai_summary, client_id')
    .eq('id', callLogId)
    .limit(1)
    .maybeSingle()

  if (!log) return NextResponse.json({ ai_summary: null })
  if (!isAdmin && log.client_id !== cu?.client_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ ai_summary: log.ai_summary ?? null })
}
