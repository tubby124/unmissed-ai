import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  // Verify admin auth
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!cu || cu.role !== 'admin') {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { callId, message } = body as { callId?: string; message?: string }

  if (!callId || !message?.trim()) {
    return NextResponse.json({ error: 'callId and message are required' }, { status: 400 })
  }

  const wrappedMessage = `<instruction>${message.trim()}</instruction>`

  const uvKey = process.env.ULTRAVOX_API_KEY
  if (!uvKey) {
    return NextResponse.json({ error: 'Ultravox API key not configured' }, { status: 500 })
  }

  const res = await fetch(`https://api.ultravox.ai/api/calls/${callId}/send_data_message`, {
    method: 'POST',
    headers: {
      'X-API-Key': uvKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: wrappedMessage, role: 'MESSAGE_ROLE_USER' }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`[whisper] Failed to send to callId=${callId} slug=${slug}: ${err}`)
    return NextResponse.json({ error: `Ultravox error: ${res.status}` }, { status: 502 })
  }

  console.log(`[whisper] Coaching sent to callId=${callId} slug=${slug}: "${message.trim().slice(0, 80)}"`)
  return NextResponse.json({ ok: true })
}
