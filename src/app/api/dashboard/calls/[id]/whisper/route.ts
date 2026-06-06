import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST — inject a supervisor whisper to the live Ultravox agent
// The agent hears this as a tool result; the caller does NOT hear it
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.warn(`[whisper] Unauthorized attempt for callId=${id}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu) return NextResponse.json({ error: 'No client found' }, { status: 404 })

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

  const body = await req.json().catch(() => ({}))
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const apiKey = process.env.ULTRAVOX_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 })

  console.log(`[whisper] Injecting to callId=${id} textLen=${text.length}`)
  const res = await fetch(`https://api.ultravox.ai/api/calls/${callLog.ultravox_call_id}/messages`, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: 'MESSAGE_ROLE_TOOL_RESULT',
      text,
      toolName: 'supervisor_whisper',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`[whisper] Ultravox error: HTTP ${res.status} for callId=${id} — ${err}`)
    return NextResponse.json({ error: 'Ultravox inject failed', detail: err }, { status: 502 })
  }

  console.log(`[whisper] Injected OK for callId=${id}`)
  return NextResponse.json({ ok: true })
}

// DELETE — end the Ultravox call immediately
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.warn(`[end-call] Unauthorized attempt for callId=${id}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu) return NextResponse.json({ error: 'No client found' }, { status: 404 })

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
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 })

  console.log(`[end-call] Terminating callId=${id} userId=${user.id}`)
  const res = await fetch(`https://api.ultravox.ai/api/calls/${callLog.ultravox_call_id}`, {
    method: 'DELETE',
    headers: { 'X-API-Key': apiKey },
  })

  // 204 = deleted, 404 = already ended — both are fine
  if (res.status === 404) {
    console.log(`[end-call] callId=${id} already ended (404) — OK`)
    return NextResponse.json({ ok: true })
  }

  if (!res.ok) {
    const err = await res.text()
    console.error(`[end-call] Ultravox error: HTTP ${res.status} for callId=${id} — ${err}`)
    return NextResponse.json({ error: 'End call failed', detail: err }, { status: 502 })
  }

  console.log(`[end-call] Terminated OK: callId=${id}`)
  return NextResponse.json({ ok: true })
}
