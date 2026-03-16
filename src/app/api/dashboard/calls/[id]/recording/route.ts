import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: callId } = await params

  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: call } = await supabase
    .from('call_logs')
    .select('ultravox_call_id, recording_url')
    .eq('ultravox_call_id', callId)
    .single()

  if (!call) return new NextResponse('Not found', { status: 404 })

  const range = req.headers.get('range')

  // ── Stored recording_url (Supabase Storage) — proxy with Range support ───
  if (call.recording_url) {
    const upstream = await fetch(call.recording_url, {
      headers: range ? { Range: range } : {},
    })
    if (!upstream.ok && upstream.status !== 206) {
      return new NextResponse('Recording unavailable', { status: 404 })
    }
    const headers = new Headers({
      'Content-Type': upstream.headers.get('Content-Type') ?? 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
    })
    for (const h of ['Content-Length', 'Content-Range']) {
      const v = upstream.headers.get(h)
      if (v) headers.set(h, v)
    }
    return new NextResponse(upstream.body, { status: upstream.status, headers })
  }

  // ── Ultravox API fallback ─────────────────────────────────────────────────
  // Use redirect:manual to capture the CDN URL. If Ultravox returns a 3xx,
  // redirect the browser directly to the CDN so it can handle Range requests
  // natively — required for iOS Safari audio playback.
  const probe = await fetch(
    `https://api.ultravox.ai/api/calls/${callId}/recording`,
    {
      headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY! },
      redirect: 'manual',
    }
  )

  if (probe.status >= 300 && probe.status < 400) {
    const location = probe.headers.get('location')
    if (location) {
      return NextResponse.redirect(location, 302)
    }
  }

  if (!probe.ok) return new NextResponse('Recording unavailable', { status: 404 })

  // Ultravox returned audio directly (no redirect) — proxy with Range support
  const src = range
    ? await fetch(
        `https://api.ultravox.ai/api/calls/${callId}/recording`,
        { headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY!, Range: range }, redirect: 'follow' }
      )
    : probe

  const headers = new Headers({
    'Content-Type': src.headers.get('Content-Type') ?? 'audio/mpeg',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  })
  for (const h of ['Content-Length', 'Content-Range']) {
    const v = src.headers.get(h)
    if (v) headers.set(h, v)
  }
  return new NextResponse(src.body, { status: src.status, headers })
}
