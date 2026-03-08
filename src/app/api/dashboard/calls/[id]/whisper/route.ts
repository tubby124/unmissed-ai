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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const apiKey = process.env.ULTRAVOX_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 })

  const res = await fetch(`https://api.ultravox.ai/api/calls/${id}/messages`, {
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
    console.error('[whisper] Ultravox error:', res.status, err)
    return NextResponse.json({ error: 'Ultravox inject failed', detail: err }, { status: 502 })
  }

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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.ULTRAVOX_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 })

  const res = await fetch(`https://api.ultravox.ai/api/calls/${id}`, {
    method: 'DELETE',
    headers: { 'X-API-Key': apiKey },
  })

  // 204 = deleted, 404 = already ended — both are fine
  if (!res.ok && res.status !== 404) {
    const err = await res.text()
    console.error('[end-call] Ultravox error:', res.status, err)
    return NextResponse.json({ error: 'End call failed', detail: err }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
