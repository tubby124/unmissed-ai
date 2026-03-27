import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: ultravoxCallId } = await params

  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu) return NextResponse.json({ error: 'No client found' }, { status: 404 })

  // ── Fetch call — enforce tenant ownership unless admin ─────────────────────
  let callQuery = supabase
    .from('call_logs')
    .select('id, client_id, caller_phone, sms_outcome')
    .eq('ultravox_call_id', ultravoxCallId)

  if (cu.role !== 'admin') {
    callQuery = callQuery.eq('client_id', cu.client_id)
  }

  const { data: callLog } = await callQuery.maybeSingle()

  if (!callLog) return NextResponse.json({ error: 'Call not found' }, { status: 404 })

  // ── Check opt-out for caller phone + client ────────────────────────────────
  let opted_out = false
  let opted_out_at: string | null = null

  if (callLog.caller_phone) {
    const { data: optOut } = await supabase
      .from('sms_opt_outs')
      .select('created_at')
      .eq('phone_number', callLog.caller_phone)
      .eq('client_id', callLog.client_id)
      .maybeSingle()

    if (optOut) {
      opted_out = true
      opted_out_at = optOut.created_at as string
    }
  }

  return NextResponse.json({
    outcome: callLog.sms_outcome ?? null,
    opted_out,
    opted_out_at,
  })
}
