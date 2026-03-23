import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: callId } = await params

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

  // Get the call_log to find ultravox_call_id and verify ownership
  let callQuery = supabase
    .from('call_logs')
    .select('ultravox_call_id, client_id')
    .eq('id', callId)

  // Non-admin users can only access their own client's calls
  if (cu.role !== 'admin') {
    callQuery = callQuery.eq('client_id', cu.client_id)
  }

  const { data: callLog, error: callError } = await callQuery.single()

  if (callError || !callLog) {
    return NextResponse.json({ error: 'Call not found' }, { status: 404 })
  }

  if (!callLog.ultravox_call_id) {
    return NextResponse.json({ stages: [] })
  }

  const apiKey = process.env.ULTRAVOX_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  // Proxy to Ultravox Call Stages API
  const res = await fetch(
    `https://api.ultravox.ai/api/calls/${callLog.ultravox_call_id}/stages?pageSize=50`,
    {
      headers: { 'X-API-Key': apiKey },
      cache: 'no-store',
    }
  )

  if (!res.ok) {
    // Call may not have stages yet or may not exist — return empty
    return NextResponse.json({ stages: [] })
  }

  const data = await res.json()
  const stages: unknown[] = data.results || []

  return NextResponse.json({ stages })
}
