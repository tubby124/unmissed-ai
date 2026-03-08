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

  try {
    const res = await fetch(`https://api.ultravox.ai/api/calls/${callId}`, {
      headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY! },
    })
    if (res.ok) {
      const data = await res.json()
      // Calculate duration from joined/ended timestamps
      if (data.joined && data.ended) {
        durationSeconds = Math.round(
          (new Date(data.ended).getTime() - new Date(data.joined).getTime()) / 1000
        )
        endedAt = data.ended
      }
      endReason = data.endReason || null
      ultravoxSummary = data.shortSummary || null
    }
  } catch (err) {
    console.error('[recover] Ultravox call fetch failed:', err)
  }

  // Fetch transcript
  const transcript = await getTranscript(callId)

  // Classify
  const classification = await classifyCall(transcript)

  // Update DB
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
