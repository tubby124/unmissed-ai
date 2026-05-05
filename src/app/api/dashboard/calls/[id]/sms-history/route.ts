/**
 * D-NEW-sms-history-surface — SMS history for a single call.
 *
 * Returns outbound SMS sent for this call (joined via sms_logs.related_call_id)
 * AND inbound replies from the same caller within 24h of the call.
 *
 * Used by CallRowExpanded.tsx — lazy-fetched on row expand.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const REPLY_WINDOW_HOURS = 24

interface SmsLogRow {
  id: string
  direction: string | null
  from_number: string | null
  to_number: string | null
  body: string | null
  status: string | null
  delivery_status: string | null
  error_message: string | null
  error_code: string | null
  delivery_error_code: string | null
  created_at: string
}

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

  // Fetch call — tenant-scoped unless admin
  let callQuery = supabase
    .from('call_logs')
    .select('id, client_id, caller_phone, started_at')
    .eq('ultravox_call_id', ultravoxCallId)

  if (cu.role !== 'admin') {
    callQuery = callQuery.eq('client_id', cu.client_id)
  }

  const { data: callLog } = await callQuery.maybeSingle()
  if (!callLog) return NextResponse.json({ error: 'Call not found' }, { status: 404 })

  const callId = callLog.id as string
  const clientId = callLog.client_id as string
  const callerPhone = callLog.caller_phone as string | null
  const startedAt = callLog.started_at as string

  // Outbound SMS — directly linked via related_call_id
  const { data: outboundRows } = await supabase
    .from('sms_logs')
    .select(
      'id, direction, from_number, to_number, body, status, delivery_status, ' +
      'error_message, error_code, delivery_error_code, created_at',
    )
    .eq('related_call_id', callId)
    .order('created_at', { ascending: true })

  const outbound = ((outboundRows ?? []) as unknown as SmsLogRow[])
    .filter(r => r.direction !== 'inbound')
    .map(r => ({
      id: r.id,
      direction: r.direction ?? 'outbound',
      to_number: r.to_number,
      body: r.body,
      status: r.status,
      delivery_status: r.delivery_status,
      error_message: r.error_message ?? null,
      error_code: r.error_code ?? r.delivery_error_code ?? null,
      created_at: r.created_at,
      offset_seconds_after_call: Math.round(
        (new Date(r.created_at).getTime() - new Date(startedAt).getTime()) / 1000,
      ),
    }))

  // Inbound replies — same caller phone, same client, within REPLY_WINDOW_HOURS of call start.
  // These won't have related_call_id set (Twilio inbound webhook doesn't know which call they
  // reply to), so we bind by phone + time window.
  let inboundReplies: ReturnType<typeof Object>[] = []
  if (callerPhone) {
    const windowEnd = new Date(new Date(startedAt).getTime() + REPLY_WINDOW_HOURS * 60 * 60 * 1000)
      .toISOString()

    const { data: replyRows } = await supabase
      .from('sms_logs')
      .select(
        'id, direction, from_number, to_number, body, status, created_at',
      )
      .eq('client_id', clientId)
      .eq('direction', 'inbound')
      .eq('from_number', callerPhone)
      .gte('created_at', startedAt)
      .lte('created_at', windowEnd)
      .order('created_at', { ascending: true })

    inboundReplies = ((replyRows ?? []) as unknown as SmsLogRow[]).map(r => ({
      id: r.id,
      direction: 'inbound' as const,
      from_number: r.from_number,
      body: r.body,
      created_at: r.created_at,
      offset_seconds_after_call: Math.round(
        (new Date(r.created_at).getTime() - new Date(startedAt).getTime()) / 1000,
      ),
    }))
  }

  return NextResponse.json({
    outbound,
    inbound_replies: inboundReplies,
  })
}
