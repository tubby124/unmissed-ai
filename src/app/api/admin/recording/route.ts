import { NextRequest, NextResponse } from 'next/server'

function checkBasicAuth(req: NextRequest): boolean {
  const password = process.env.ADMIN_PASSWORD
  if (!password) return false
  const expected = `Basic ${Buffer.from(`admin:${password}`).toString('base64')}`
  return req.headers.get('authorization') === expected
}

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
  if (!checkBasicAuth(req)) return new NextResponse(null, { status: 401 })
  const callId = req.nextUrl.searchParams.get('callId')
  if (!callId) return new NextResponse(null, { status: 400 })

  const res = await checkRecording(callId)
  return new NextResponse(null, { status: res.ok ? 200 : 404 })
}

export async function GET(req: NextRequest) {
  if (!checkBasicAuth(req)) return new NextResponse('Unauthorized', { status: 401 })
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
