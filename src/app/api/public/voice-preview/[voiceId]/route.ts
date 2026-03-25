import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ voiceId: string }> }
) {
  const { voiceId } = await params

  // Basic UUID validation
  if (!/^[a-f0-9-]{36}$/i.test(voiceId)) {
    return new NextResponse('Invalid voice ID', { status: 400 })
  }

  const res = await fetch(
    `https://api.ultravox.ai/api/voices/${voiceId}/preview`,
    { headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY! } }
  )

  if (!res.ok) return new NextResponse('Not found', { status: 404 })

  const buffer = await res.arrayBuffer()

  // Ultravox returns 'text/plain' for some voices even though the bytes are MP3.
  // Detect from magic bytes so the browser actually plays it.
  let contentType = res.headers.get('content-type') || 'audio/wav'
  if (!contentType.startsWith('audio/')) {
    const bytes = new Uint8Array(buffer, 0, 3)
    // MP3 sync word (0xFF 0xEx or 0xFF 0xFx) or ID3 tag (0x49 0x44 0x33 = "ID3")
    if ((bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) ||
        (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)) {
      contentType = 'audio/mpeg'
    } else {
      contentType = 'audio/wav'
    }
  }

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
