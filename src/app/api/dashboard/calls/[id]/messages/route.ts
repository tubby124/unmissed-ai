import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Require authenticated session
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
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

  let callQuery = supabase
    .from('call_logs')
    .select('ultravox_call_id, client_id')
    .eq('ultravox_call_id', id)

  if (cu.role !== 'admin') {
    callQuery = callQuery.eq('client_id', cu.client_id)
  }

  const { data: callLog } = await callQuery.limit(1).maybeSingle()
  if (!callLog?.ultravox_call_id) {
    return NextResponse.json({ error: 'Call not found' }, { status: 404 })
  }

  const apiKey = process.env.ULTRAVOX_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const res = await fetch(
    `https://api.ultravox.ai/api/calls/${callLog.ultravox_call_id}/messages?pageSize=200`,
    {
      headers: { 'X-API-Key': apiKey },
      cache: 'no-store',
    }
  )

  if (!res.ok) {
    // Call may not exist yet (race condition) — return empty
    return NextResponse.json({ messages: [] })
  }

  const data = await res.json()
  const raw: Array<{
    role: string
    text: string
    medium?: string
    callStageMessageIndex?: number
    timespan?: { start?: string; end?: string }
  }> = data.results || []

  const messages = raw
    .filter(m => {
      if (typeof m.text !== 'string' || !m.text.trim()) return false
      if (m.role === 'MESSAGE_ROLE_AGENT') return true
      if (m.role === 'MESSAGE_ROLE_USER') return m.medium === 'MESSAGE_MEDIUM_VOICE'
      return false
    })
    .map(m => ({
      role: m.role === 'MESSAGE_ROLE_AGENT' ? 'agent' : 'user',
      text: m.text,
      ...(m.timespan?.start != null ? { startTime: parseFloat(m.timespan.start) } : {}),
      ...(m.timespan?.end != null ? { endTime: parseFloat(m.timespan.end) } : {}),
    }))

  return NextResponse.json({ messages })
}
