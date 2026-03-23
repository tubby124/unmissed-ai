import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
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
  const { call_log_id, ultravox_call_id, message } = body as {
    call_log_id?: string
    ultravox_call_id?: string
    message?: string
  }

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  if (!ultravox_call_id) {
    return NextResponse.json({ error: 'ultravox_call_id is required' }, { status: 400 })
  }

  const clientId = cu.role === 'admin' && body.client_id
    ? body.client_id
    : cu.client_id

  const { data: row, error: insertError } = await supabase
    .from('coaching_messages')
    .insert({
      call_log_id: call_log_id || null,
      client_id: clientId,
      ultravox_call_id,
      message: message.trim(),
      status: 'pending',
    })
    .select('id, status, created_at')
    .single()

  if (insertError) {
    console.error('[coaching] Insert failed:', insertError.message)
    return NextResponse.json({ error: 'Failed to send coaching message' }, { status: 500 })
  }

  return NextResponse.json({ coaching: row })
}
