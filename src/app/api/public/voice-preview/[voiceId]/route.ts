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

  const contentType = res.headers.get('content-type') || 'audio/wav'
  const buffer = await res.arrayBuffer()

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
