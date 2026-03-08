import { NextRequest, NextResponse } from 'next/server'

async function checkRecording(callId: string) {
  return fetch(
    `https://api.ultravox.ai/api/calls/${callId}/recording`,
    {
      headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY! },
      redirect: 'follow',
    }
  )
}

export async function HEAD(req: NextRequest) {
  const callId = req.nextUrl.searchParams.get('callId')
  if (!callId) return new NextResponse(null, { status: 400 })

  const res = await checkRecording(callId)
  return new NextResponse(null, { status: res.ok ? 200 : 404 })
}

export async function GET(req: NextRequest) {
  const callId = req.nextUrl.searchParams.get('callId')
  if (!callId) return new NextResponse('Missing callId', { status: 400 })

  const res = await checkRecording(callId)

  if (!res.ok) return new NextResponse('Recording not available', { status: res.status })

  return new NextResponse(res.body, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Disposition': `inline; filename="call-${callId}.mp3"`,
    },
  })
}
