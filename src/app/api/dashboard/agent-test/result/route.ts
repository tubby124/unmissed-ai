import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/dashboard/agent-test/result?callId=xxx
 *
 * Polls call_logs for classification + AI summary after a WebRTC test call ends.
 * Returns immediately — caller polls until call_status is a final status.
 */

const PENDING_STATUSES = new Set(['live', 'processing', 'UNKNOWN'])

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const callId = req.nextUrl.searchParams.get('callId')
  if (!callId) return NextResponse.json({ error: 'Missing callId' }, { status: 400 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()
  if (!cu) return NextResponse.json({ error: 'No client' }, { status: 403 })

  const svc = createServiceClient()
  const { data: row } = await svc
    .from('call_logs')
    .select('call_status, ai_summary, duration_seconds, sentiment, caller_name')
    .eq('ultravox_call_id', callId)
    .eq('client_id', cu.client_id)
    .maybeSingle()

  if (!row) return NextResponse.json({ ready: false })

  const ready = !PENDING_STATUSES.has(row.call_status ?? '')
  return NextResponse.json({
    ready,
    call_status: row.call_status,
    ai_summary: row.ai_summary,
    duration_seconds: row.duration_seconds,
    sentiment: row.sentiment,
    caller_name: row.caller_name,
  })
}
