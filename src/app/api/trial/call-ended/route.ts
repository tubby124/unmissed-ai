/**
 * POST /api/trial/call-ended?clientId=xxx&sig=xxx&n=xxx&t=xxx
 *
 * Ultravox completed webhook for trial test calls.
 * Triggered when createDemoCall() is passed a callbackUrl pointing here.
 *
 * Receives: standard Ultravox call.ended payload
 * Does:
 *   1. Verify HMAC sig (clientId is the slug)
 *   2. Fetch transcript from Ultravox
 *   3. Update the pre-inserted call_logs row with transcript, duration, summary
 * Returns 200 immediately — processing runs in after()
 */

import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getTranscript, verifyCallbackSig } from '@/lib/ultravox'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) {
    return new NextResponse('Missing clientId', { status: 400 })
  }

  const callData = payload.call as Record<string, unknown> | undefined
  const callId = (callData?.callId || payload.callId || payload.call_id) as string | undefined
  if (!callId) {
    console.error('[trial/call-ended] Missing callId in payload')
    return new NextResponse('Missing callId', { status: 400 })
  }

  // HMAC sig verification — clientId acts as the slug
  const sig = req.nextUrl.searchParams.get('sig')
  const nonce = req.nextUrl.searchParams.get('n')
  const ts = req.nextUrl.searchParams.get('t')
  const hasSecret = !!process.env.WEBHOOK_SIGNING_SECRET

  if (hasSecret && !sig) {
    console.error(`[trial/call-ended] REJECTED — no sig, clientId=${clientId} callId=${callId}`)
    return new NextResponse('Forbidden', { status: 403 })
  }

  if (sig) {
    const result = verifyCallbackSig(clientId, sig, nonce, ts)
    if (!result.valid) {
      console.error(`[trial/call-ended] HMAC sig FAILED for clientId=${clientId} callId=${callId}`)
      return new NextResponse('Forbidden', { status: 403 })
    }
  }

  // Duration
  let durationSeconds = 0
  if (callData?.joined && callData?.ended) {
    durationSeconds = Math.round(
      (new Date(callData.ended as string).getTime() - new Date(callData.joined as string).getTime()) / 1000
    )
  }

  const ultravoxSummary = (callData?.shortSummary as string | undefined) || null
  const endedAt = (callData?.ended as string | undefined) || new Date().toISOString()

  after(async () => {
    try {
      const supabase = createServiceClient()

      const transcript = await getTranscript(callId)
      console.log(`[trial/call-ended] transcript fetched: callId=${callId} messages=${transcript.length}`)

      const { error } = await supabase
        .from('call_logs')
        .update({
          transcript,
          call_status: 'trial_test_completed',
          ai_summary: ultravoxSummary || (transcript.length > 0 ? 'Trial test call completed' : null),
          duration_seconds: durationSeconds,
          ended_at: endedAt,
        })
        .eq('ultravox_call_id', callId)

      if (error) {
        console.error(`[trial/call-ended] DB update failed for callId=${callId}: ${error.message}`)
      } else {
        console.log(`[trial/call-ended] call_logs updated: callId=${callId} duration=${durationSeconds}s`)
      }

      // Track minutes usage so the dashboard shows accurate consumption
      if (durationSeconds > 0) {
        const { error: rpcError } = await supabase.rpc('increment_seconds_used', {
          p_client_id: clientId,
          p_seconds: durationSeconds,
        })
        if (rpcError) console.error(`[trial/call-ended] seconds increment failed: ${rpcError.message}`)
      }
    } catch (err) {
      console.error(`[trial/call-ended] after() error for callId=${callId}:`, err)
    }
  })

  return new NextResponse('OK', { status: 200 })
}
