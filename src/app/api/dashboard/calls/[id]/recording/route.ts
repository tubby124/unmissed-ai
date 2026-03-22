import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getSignedRecordingUrl } from '@/lib/recording-url'

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

  // ── Supabase Storage (private bucket) — generate signed URL, proxy with Range ──
  // S13-REC1: recording_url stores a path ("callId.mp3") or legacy public URL.
  // Either way, getSignedRecordingUrl() generates a fresh signed URL via service client.
  if (call.recording_url) {
    const signedUrl = await getSignedRecordingUrl(call.recording_url, 3600) // 1 hour
    if (signedUrl) {
      const upstream = await fetch(signedUrl, {
        headers: range ? { Range: range } : {},
      })
      if (upstream.ok || upstream.status === 206) {
        const headers = new Headers({
          'Content-Type': upstream.headers.get('Content-Type') ?? 'audio/mpeg',
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'private, max-age=3600',
        })
        for (const h of ['Content-Length', 'Content-Range']) {
          const v = upstream.headers.get(h)
          if (v) headers.set(h, v)
        }
        return new NextResponse(upstream.body, { status: upstream.status, headers })
      }
      // Signed URL fetch failed — fall through to Ultravox
    }
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
