import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const callId = req.nextUrl.searchParams.get('callId')
  if (!callId) return new NextResponse('Missing callId', { status: 400 })

  const res = await fetch(
    `https://api.ultravox.ai/api/calls/${callId}/messages?pageSize=200`,
    { headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY! } }
  )

  if (!res.ok) return new NextResponse('Ultravox error', { status: res.status })

  const data = await res.json()
  const messages: Array<{ role: string; text: string }> = (data.results || [])
    .filter((m: { role: string }) =>
      m.role === 'MESSAGE_ROLE_AGENT' || m.role === 'MESSAGE_ROLE_USER'
    )
    .map((m: { role: string; text: string }) => ({
      role: m.role === 'MESSAGE_ROLE_AGENT' ? 'agent' : 'user',
      text: m.text,
    }))

  return NextResponse.json(messages)
}
