import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Admin-only auth
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (cu?.role !== 'admin') {
    return new NextResponse('Admin only', { status: 403 })
  }

  // Look up demo call to get ultravox_call_id
  const service = createServiceClient()
  const { data: demoCall, error } = await service
    .from('demo_calls')
    .select('ultravox_call_id')
    .eq('id', id)
    .single()

  if (error || !demoCall?.ultravox_call_id) {
    return new NextResponse('Not found', { status: 404 })
  }

  const callId = demoCall.ultravox_call_id
  const range = req.headers.get('range')

  // Probe Ultravox for recording — capture redirects for CDN URL
  const probe = await fetch(
    `https://api.ultravox.ai/api/calls/${callId}/recording`,
    {
      headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY! },
      redirect: 'manual',
    }
  )

  // Ultravox returned a CDN redirect — pass it through for Range support
  if (probe.status >= 300 && probe.status < 400) {
    const location = probe.headers.get('location')
    if (location) {
      return NextResponse.redirect(location, 302)
    }
  }

  if (!probe.ok) return new NextResponse('Recording unavailable', { status: 404 })

  // Ultravox returned audio directly — proxy with Range support
  const src = range
    ? await fetch(
        `https://api.ultravox.ai/api/calls/${callId}/recording`,
        { headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY!, Range: range }, redirect: 'follow' }
      )
    : probe

  const headers = new Headers({
    'Content-Type': src.headers.get('Content-Type') ?? 'audio/mpeg',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=3600',
  })
  for (const h of ['Content-Length', 'Content-Range']) {
    const v = src.headers.get(h)
    if (v) headers.set(h, v)
  }
  return new NextResponse(src.body, { status: src.status, headers })
}
