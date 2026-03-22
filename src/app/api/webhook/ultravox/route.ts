import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * S13b-T2: Native Ultravox account-level webhook handler.
 * Events: call.ended (orphan detection), call.billed (billing data).
 * Auth: HMAC-SHA256 via X-Ultravox-Webhook-Signature + X-Ultravox-Webhook-Timestamp.
 *
 * Ultravox HMAC format (verified via docs.ultravox.ai/webhooks/securing-webhooks):
 *   payload = raw_body + timestamp_iso8601  (body FIRST, then timestamp, NO separator)
 *   signature = HMAC-SHA256(secret, payload).hexdigest()
 *   timestamp = ISO 8601 string (NOT epoch seconds)
 *   header may contain comma-separated sigs for key rotation
 *   Python ref: hmac.new(SECRET.encode(), request.content + timestamp.encode(), "sha256").hexdigest()
 */

/** Max age for native webhook timestamp (60s per Ultravox docs). */
const NATIVE_WEBHOOK_MAX_AGE_MS = 60_000

export async function POST(req: NextRequest) {
  // ── Fail-closed: reject if webhook secret is not configured ──────────────
  const secret = process.env.ULTRAVOX_WEBHOOK_SECRET
  if (!secret) {
    console.error('[ultravox-webhook] ULTRAVOX_WEBHOOK_SECRET not configured — rejecting')
    return new NextResponse('Webhook secret not configured', { status: 500 })
  }

  const hmacBypass = process.env.WEBHOOK_HMAC_BYPASS === 'true'

  // ── Read raw body for HMAC verification ──────────────────────────────────
  const rawBody = await req.text()

  // ── Diagnostic: log all Ultravox-related headers ─────────────────────────
  const allHeaders: Record<string, string> = {}
  req.headers.forEach((value, key) => {
    if (key.toLowerCase().startsWith('x-ultravox') || key.toLowerCase().includes('signature') || key.toLowerCase().includes('timestamp')) {
      allHeaders[key] = value
    }
  })
  console.log(`[ultravox-webhook] DIAG: headers=${JSON.stringify(allHeaders)} bodyLen=${rawBody.length} bodyPreview=${rawBody.substring(0, 120)} secretLen=${secret.length} secretPrefix=${secret.substring(0, 8)}...`)

  // ── HMAC-SHA256 signature verification ───────────────────────────────────
  const signatureHeader = req.headers.get('X-Ultravox-Webhook-Signature')
  const timestamp = req.headers.get('X-Ultravox-Webhook-Timestamp')

  if (!signatureHeader || !timestamp) {
    console.error(`[ultravox-webhook] Missing signature or timestamp headers. sigHeader=${!!signatureHeader} tsHeader=${!!timestamp}`)
    if (!hmacBypass) return new NextResponse('Missing signature headers', { status: 401 })
    console.warn('[ultravox-webhook] HMAC BYPASS active — processing despite missing headers')
  }

  let signatureValid = false

  if (signatureHeader && timestamp) {
    // S13b-T2b: Reject timestamps outside 60s replay window
    // Ultravox sends ISO 8601 timestamps (e.g., "2026-03-21T18:30:00")
    const tsDate = new Date(timestamp)
    const ageMs = Math.abs(Date.now() - tsDate.getTime())
    if (isNaN(tsDate.getTime()) || ageMs > NATIVE_WEBHOOK_MAX_AGE_MS) {
      console.error(`[ultravox-webhook] Timestamp replay rejected: ts=${timestamp} age=${ageMs}ms`)
      if (!hmacBypass) return new NextResponse('Timestamp expired', { status: 401 })
      console.warn('[ultravox-webhook] HMAC BYPASS active — processing despite expired timestamp')
    }

    // Ultravox HMAC: HMAC-SHA256(secret, rawBody + timestamp) — body FIRST, NO separator
    // Source: docs.ultravox.ai/webhooks/securing-webhooks
    // Python equiv: hmac.new(SECRET.encode(), request.content + request_timestamp.encode(), "sha256").hexdigest()
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody + timestamp)
      .digest('hex')

    // Header may contain comma-separated signatures (key rotation support)
    const signatures = signatureHeader.split(',').map(s => s.trim())

    // Diagnostic: log computed vs received signatures
    console.log(`[ultravox-webhook] DIAG HMAC: ts=${timestamp} ageMs=${ageMs} expectedSig=${expected.substring(0, 16)}... receivedSigs=${signatures.map(s => s.substring(0, 16) + '...').join(',')} sigLens=${signatures.map(s => s.length).join(',')} expectedLen=${expected.length}`)

    for (const sig of signatures) {
      try {
        if (crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
          signatureValid = true
          break
        }
      } catch {
        // Length mismatch or invalid hex — try next sig
        console.warn(`[ultravox-webhook] DIAG: sig comparison failed for sig len=${sig.length} (expected len=${expected.length}). Sig is hex: ${/^[0-9a-f]+$/i.test(sig)}`)
        continue
      }
    }

    if (!signatureValid) {
      console.error(`[ultravox-webhook] HMAC signature mismatch. ts=${timestamp} bodyLen=${rawBody.length} sigCount=${signatures.length}`)
      if (!hmacBypass) return new NextResponse('Invalid signature', { status: 401 })
      console.warn('[ultravox-webhook] HMAC BYPASS active — processing despite signature mismatch')
    }
  }

  console.log(`[ultravox-webhook] ${signatureValid ? 'HMAC verified OK' : 'HMAC BYPASSED'} — ts=${timestamp}`)

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
  const metadata = (call.metadata || {}) as Record<string, string>

  // S13b-T2e: Skip full processing for demo calls — just log
  const clientSlug = metadata.client_slug || ''
  if (clientSlug.startsWith('unmissed-demo') || clientSlug.startsWith('demo-')) {
    console.log(`[ultravox-webhook] Demo call skipped: event=${event} callId=${callId} slug=${clientSlug}`)
    return new NextResponse('OK', { status: 200 })
  }

  // ── Event routing ────────────────────────────────────────────────────────
  const supabase = createServiceClient()

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

      // S13b-T2c: Orphan detection — if no call_logs row exists or still 'live' after 2 min,
      // the per-call completed callback likely failed
      if (callId) {
        try {
          const { data: row } = await supabase
            .from('call_logs')
            .select('id, call_status, started_at')
            .eq('ultravox_call_id', callId)
            .single()

          if (!row) {
            console.warn(`[ultravox-webhook] ORPHAN: no call_logs row for callId=${callId} — per-call callback may have failed`)
          } else if (row.call_status === 'live') {
            // Check if it's been >2 min since call started (callback should have fired by now)
            const startedAt = row.started_at ? new Date(row.started_at).getTime() : 0
            const ageMs = Date.now() - startedAt
            if (ageMs > 2 * 60 * 1000) {
              console.warn(`[ultravox-webhook] STALE LIVE: callId=${callId} still 'live' after ${Math.round(ageMs / 1000)}s — completed callback likely failed`)
            }
          }
          // If call_status is 'processing' or terminal, per-call callback is handling/handled it — no action needed
        } catch (err) {
          console.error(`[ultravox-webhook] Orphan check failed for callId=${callId}:`, err)
        }
      }
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
