import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const SEVERITY_LEVELS = ['debug', 'info', 'warning', 'error'] as const
type Severity = (typeof SEVERITY_LEVELS)[number]

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()
  if (!cu) {
    return NextResponse.json({ error: 'No client found' }, { status: 404 })
  }

  // Verify the call belongs to this client (admin can see all)
  let callQuery = supabase
    .from('call_logs')
    .select('ultravox_call_id')
    .eq('id', id)

  if (cu.role !== 'admin') {
    callQuery = callQuery.eq('client_id', cu.client_id)
  }

  const { data: callLog, error: callError } = await callQuery.single()
  if (callError || !callLog?.ultravox_call_id) {
    return NextResponse.json({ error: 'Call not found' }, { status: 404 })
  }

  const apiKey = process.env.ULTRAVOX_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  // Parse optional severity filter
  const minimumSeverity = req.nextUrl.searchParams.get('minimum_severity') as Severity | null
  const severity = minimumSeverity && SEVERITY_LEVELS.includes(minimumSeverity)
    ? minimumSeverity
    : 'info'

  const url = new URL(`https://api.ultravox.ai/api/calls/${callLog.ultravox_call_id}/events`)
  url.searchParams.set('pageSize', '100')
  url.searchParams.set('minimum_severity', severity)

  const res = await fetch(url.toString(), {
    headers: { 'X-API-Key': apiKey },
    cache: 'no-store',
  })

  if (!res.ok) {
    return NextResponse.json({ events: [] })
  }

  const data = await res.json()
  const events: Array<{
    callId: string
    callStageId: string
    callTimestamp: string
    wallClockTimestamp: string | null
    severity: string
    type: string
    text: string
    extras: Record<string, unknown>
  }> = data.results || []

  return NextResponse.json({ events })
}
