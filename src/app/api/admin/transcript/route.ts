import { NextRequest, NextResponse } from 'next/server'

function checkBasicAuth(req: NextRequest): boolean {
  const password = process.env.ADMIN_PASSWORD
  if (!password) return false
  const expected = `Basic ${Buffer.from(`admin:${password}`).toString('base64')}`
  return req.headers.get('authorization') === expected
}

export async function GET(req: NextRequest) {
  if (!checkBasicAuth(req)) return new NextResponse('Unauthorized', { status: 401 })
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
