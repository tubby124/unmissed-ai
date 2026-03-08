import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getRecordingStream } from '@/lib/ultravox'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params

  // Verify the call exists in our DB before proxying
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('call_logs')
    .select('id')
    .eq('ultravox_call_id', callId)
    .single()

  if (!data) {
    return new NextResponse('Not found', { status: 404 })
  }

  try {
    // Re-fetch every time — Ultravox recording URLs are 302 redirects with ~12h expiry
    const upstream = await getRecordingStream(callId)
    if (!upstream.ok) {
      return new NextResponse('Recording unavailable', { status: 404 })
    }

    return new NextResponse(upstream.body, {
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return new NextResponse('Recording unavailable', { status: 502 })
  }
}
