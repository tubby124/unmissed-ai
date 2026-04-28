import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Sniff audio container by magic bytes. Some upstream CDN responses
// (notably Eleven Labs hosted on Google Cloud Storage) serve MP3 audio
// with Content-Type: text/plain, which the browser <audio> element
// refuses to play. Detecting the format from the bytes themselves is the
// only reliable way to set a Content-Type the browser will accept.
function sniffAudioMime(buffer: ArrayBuffer): string | null {
  const head = new Uint8Array(buffer.slice(0, 12))
  if (head.length < 4) return null
  // ID3 — MP3 with metadata
  if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) return 'audio/mpeg'
  // MPEG frame sync — raw MP3 without ID3 tag
  if (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) return 'audio/mpeg'
  // RIFF....WAVE — WAV
  if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46
      && head[8] === 0x57 && head[9] === 0x41 && head[10] === 0x56 && head[11] === 0x45) {
    return 'audio/wav'
  }
  // OggS — Ogg
  if (head[0] === 0x4f && head[1] === 0x67 && head[2] === 0x67 && head[3] === 0x53) return 'audio/ogg'
  // fLaC
  if (head[0] === 0x66 && head[1] === 0x4c && head[2] === 0x61 && head[3] === 0x43) return 'audio/flac'
  return null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ voiceId: string }> }
) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { voiceId } = await params

  const res = await fetch(
    `https://api.ultravox.ai/api/voices/${voiceId}/preview`,
    { headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY! }, redirect: 'follow' }
  )

  if (!res.ok) return new NextResponse('Not found', { status: 404 })

  const buffer = await res.arrayBuffer()
  if (buffer.byteLength === 0) return new NextResponse('Empty preview', { status: 404 })

  const sniffed = sniffAudioMime(buffer)
  const upstream = res.headers.get('content-type') || ''
  const upstreamLooksAudio = upstream.startsWith('audio/')
  const contentType = sniffed ?? (upstreamLooksAudio ? upstream : 'audio/mpeg')

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(buffer.byteLength),
      'Cache-Control': 'public, max-age=86400',
      'Accept-Ranges': 'bytes',
    },
  })
}
