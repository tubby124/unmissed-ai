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

  const apiKey = process.env.ULTRAVOX_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const res = await fetch(
    `https://api.ultravox.ai/api/calls/${id}/messages?pageSize=200`,
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
    timespan?: { startTime?: string; endTime?: string }
  }> = data.results || []

  const messages = raw
    .filter(m =>
      (m.role === 'MESSAGE_ROLE_AGENT' || m.role === 'MESSAGE_ROLE_USER') &&
      typeof m.text === 'string' && m.text.trim()
    )
    .map(m => ({
      role: m.role === 'MESSAGE_ROLE_AGENT' ? 'agent' : 'user',
      text: m.text,
      ...(m.timespan?.startTime != null ? { startTime: parseFloat(m.timespan.startTime) } : {}),
      ...(m.timespan?.endTime != null ? { endTime: parseFloat(m.timespan.endTime) } : {}),
    }))

  return NextResponse.json({ messages })
}
