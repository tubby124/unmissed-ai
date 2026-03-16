import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getTranscript } from '@/lib/ultravox'
import { classifyCall } from '@/lib/openrouter'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const { callId } = await req.json().catch(() => ({}))
  if (!callId) return new NextResponse('Missing callId', { status: 400 })

  const supabase = createServiceClient()

  // Fetch call details from Ultravox to get duration + endReason
  let durationSeconds = 0
  let endReason: string | null = null
  let endedAt = new Date().toISOString()
  let ultravoxSummary: string | null = null
  let callFoundOnUltravox = false

  try {
    const res = await fetch(`https://api.ultravox.ai/api/calls/${callId}`, {
      headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY! },
    })
    if (res.ok) {
      callFoundOnUltravox = true
      const data = await res.json()
      if (data.joined && data.ended) {
        durationSeconds = Math.round(
          (new Date(data.ended).getTime() - new Date(data.joined).getTime()) / 1000
        )
        endedAt = data.ended
      }
      endReason = data.endReason || null
      ultravoxSummary = data.shortSummary || null
    }
    // 404 = call purged from Ultravox or was never created — mark MISSED below
  } catch (err) {
    console.error('[recover] Ultravox call fetch failed:', err)
  }

  // If call is not on Ultravox, mark as MISSED without classification attempt
  if (!callFoundOnUltravox) {
    const { error } = await supabase
      .from('call_logs')
      .update({
        call_status: 'MISSED',
        ai_summary: 'Call record unavailable on Ultravox — webhook delivery failed',
        ended_at: endedAt,
      })
      .eq('ultravox_call_id', callId)

    if (error) {
      console.error('[recover] DB update failed:', error.message)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, classification: { status: 'MISSED' }, transcript_turns: 0 })
  }

  // Fetch transcript and classify (Ultravox call exists)
  const transcript = await getTranscript(callId)
  const classification = await classifyCall(transcript)

  const { error } = await supabase
    .from('call_logs')
    .update({
      transcript,
      call_status: classification.status,
      ai_summary: classification.summary || ultravoxSummary || null,
      service_type: classification.serviceType,
      duration_seconds: durationSeconds,
      ended_at: endedAt,
      end_reason: endReason,
    })
    .eq('ultravox_call_id', callId)

  if (error) {
    console.error('[recover] DB update failed:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    classification,
    duration_seconds: durationSeconds,
    end_reason: endReason,
    transcript_turns: transcript.length,
  })
}
