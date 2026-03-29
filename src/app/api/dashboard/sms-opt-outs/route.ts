import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .limit(1).maybeSingle()

  if (!cu) return NextResponse.json({ error: 'No client found' }, { status: 404 })

  const { data: optOuts, error } = await supabase
    .from('sms_opt_outs')
    .select('phone_number, opted_out_at, opted_back_in_at')
    .eq('client_id', cu.client_id)
    .order('opted_out_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch opt-outs' }, { status: 500 })

  return NextResponse.json({ opt_outs: optOuts ?? [] })
}
