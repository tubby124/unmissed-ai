import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // ── Fail-closed: reject if webhook secret is not configured ──────────────
  const secret = process.env.ULTRAVOX_WEBHOOK_SECRET
  if (!secret) {
    console.error('[ultravox-webhook] ULTRAVOX_WEBHOOK_SECRET not configured — rejecting')
    return new NextResponse('Webhook secret not configured', { status: 500 })
  }

  // ── Read raw body for HMAC verification ──────────────────────────────────
  const rawBody = await req.text()

  // ── HMAC-SHA256 signature verification ───────────────────────────────────
  const signature = req.headers.get('X-Ultravox-Webhook-Signature')
  const timestamp = req.headers.get('X-Ultravox-Webhook-Timestamp')

  if (!signature || !timestamp) {
    console.error('[ultravox-webhook] Missing signature or timestamp headers')
    return new NextResponse('Missing signature headers', { status: 401 })
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')

  let signatureValid = false
  try {
    signatureValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    )
  } catch {
    signatureValid = false
  }

  if (!signatureValid) {
    console.error('[ultravox-webhook] HMAC signature mismatch — rejecting')
    return new NextResponse('Invalid signature', { status: 401 })
  }

  // ── Parse payload ────────────────────────────────────────────────────────
  let payload: { event: string; call: Record<string, unknown> }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    console.error('[ultravox-webhook] Invalid JSON body')
    return new NextResponse('Bad Request', { status: 400 })
  }

  const event = payload.event
  const call = payload.call

  if (!event || !call) {
    console.error('[ultravox-webhook] Missing event or call in payload')
    return new NextResponse('Bad Request', { status: 400 })
  }

  const callId = call.callId as string | undefined

  // ── Event routing ────────────────────────────────────────────────────────
  switch (event) {
    case 'call.ended': {
      const endReason = (call.endReason as string) || 'unknown'
      const joined = call.joined as string | null
      const ended = call.ended as string | null
      let durationSeconds = 0
      if (joined && ended) {
        durationSeconds = Math.round(
          (new Date(ended).getTime() - new Date(joined).getTime()) / 1000
        )
      }
      console.log(
        `[ultravox-webhook] call.ended: callId=${callId} endReason=${endReason} duration=${durationSeconds}s`
      )
      break
    }

    case 'call.billed': {
      if (!callId) {
        console.error('[ultravox-webhook] call.billed missing callId')
        break
      }

      const billedDurationRaw = call.billedDuration as string | null
      const billingStatus = call.billingStatus as string | null

      let billedDurationSeconds: number | null = null
      if (billedDurationRaw) {
        const match = billedDurationRaw.match(/^(\d+(?:\.\d+)?)s$/)
        if (match) {
          billedDurationSeconds = Math.round(parseFloat(match[1]))
        }
      }

      console.log(
        `[ultravox-webhook] call.billed: callId=${callId} billedDuration=${billedDurationRaw} billingStatus=${billingStatus}`
      )

      try {
        const supabase = createServiceClient()
        const { data: updatedRows, error } = await supabase
          .from('call_logs')
          .update({
            billed_duration_seconds: billedDurationSeconds,
            billing_status: billingStatus,
          })
          .eq('ultravox_call_id', callId)
          .select('id')

        if (error) {
          console.error(
            `[ultravox-webhook] DB update failed for callId=${callId}: ${error.message}`
          )
        } else if (!updatedRows?.length) {
          console.warn(
            `[ultravox-webhook] No call_log row found for callId=${callId} — call may not have been logged yet`
          )
        } else {
          console.log(
            `[ultravox-webhook] call_logs updated: callId=${callId} billed_duration_seconds=${billedDurationSeconds} billing_status=${billingStatus}`
          )
        }
      } catch (err) {
        console.error('[ultravox-webhook] DB error:', err)
      }
      break
    }

    default:
      console.log(`[ultravox-webhook] Unhandled event: ${event} callId=${callId}`)
      break
  }

  return new NextResponse('OK', { status: 200 })
}

export async function GET() {
  return NextResponse.json({ status: 'ok', handler: 'ultravox-account-webhook' })
}
