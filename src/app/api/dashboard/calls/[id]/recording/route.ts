import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: callId } = await params

  // Verify session
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // Fetch call — RLS ensures it belongs to this user's client
  const { data: call } = await supabase
    .from('call_logs')
    .select('ultravox_call_id, recording_url')
    .eq('ultravox_call_id', callId)
    .single()

  if (!call) {
    return new NextResponse('Not found', { status: 404 })
  }

  // Prefer stored recording_url (Supabase Storage — permanent)
  if (call.recording_url) {
    const res = await fetch(call.recording_url)
    if (res.ok) {
      return new NextResponse(res.body, {
        headers: {
          'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }
  }

  // Fallback: proxy from Ultravox API
  const ultravoxRes = await fetch(
    `https://api.ultravox.ai/api/calls/${callId}/recording`,
    {
      headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY! },
      redirect: 'follow',
    }
  )

  if (!ultravoxRes.ok) {
    return new NextResponse('Recording unavailable', { status: 404 })
  }

  return new NextResponse(ultravoxRes.body, {
    headers: {
      'Content-Type': ultravoxRes.headers.get('Content-Type') || 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  })
}
