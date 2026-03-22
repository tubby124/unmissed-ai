import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getTranscript, getRecordingStream, verifyCallbackSig } from '@/lib/ultravox'
import { classifyCall } from '@/lib/openrouter'
import { sendAlert } from '@/lib/telegram'
import { notifySystemFailure } from '@/lib/admin-alerts'
import {
  sendTelegramNotification,
  sendSmsFollowUp,
  sendEmailNotification,
  notificationsAlreadySent,
  type CompletedClient,
} from '@/lib/completed-notifications'

export const maxDuration = 120

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  const callData = payload.call as Record<string, unknown> | undefined
  const callId = (callData?.callId || payload.callId || payload.call_id) as string | undefined

  if (!callId) {
    console.error('[completed] Missing callId in payload:', JSON.stringify(payload).slice(0, 500))
    return new NextResponse('Missing callId', { status: 400 })
  }

  // ── HMAC signature verification (S13b: mandatory when secret configured) ──
  const sig = req.nextUrl.searchParams.get('sig')
  const nonce = req.nextUrl.searchParams.get('n') || req.nextUrl.searchParams.get('nonce')
  const ts = req.nextUrl.searchParams.get('t') || req.nextUrl.searchParams.get('ts')
  const hasSecret = !!process.env.WEBHOOK_SIGNING_SECRET

  if (hasSecret && !sig) {
    // S13b-T1b: reject unsigned webhooks when signing is enabled
    console.error(`[completed] REJECTED — no sig param, WEBHOOK_SIGNING_SECRET is set. slug=${slug} callId=${callId}`)
    return new NextResponse('Forbidden', { status: 403 })
  }

  if (sig) {
    const result = verifyCallbackSig(slug, sig, nonce, ts)
    if (!result.valid) {
      console.error(`[completed] HMAC sig FAILED for slug=${slug} callId=${callId} format=${result.legacy ? 'legacy' : 'new'} — forged webhook rejected`)
      return new NextResponse('Forbidden', { status: 403 })
    }
    if (result.legacy) {
      console.warn(`[completed] HMAC sig verified (LEGACY format — in-flight call) for slug=${slug} callId=${callId}`)
    } else {
      console.log(`[completed] HMAC sig verified for slug=${slug} callId=${callId}`)
    }
  }

  // Duration from Ultravox timestamps
  let durationSeconds = 0
  if (callData?.joined && callData?.ended) {
    durationSeconds = Math.round(
      (new Date(callData.ended as string).getTime() - new Date(callData.joined as string).getTime()) / 1000
    )
  }

  const metadata = (callData?.metadata || payload.metadata || {}) as Record<string, string>
  const callerPhone = metadata.caller_phone || 'unknown'
  const endReason = (callData?.endReason as string | undefined) || null
  const ultravoxSummary = (callData?.shortSummary as string | undefined) || null
  const endedAt = (callData?.ended as string | undefined) || new Date().toISOString()

  // B3-F2: Extract final call state from Ultravox callback (null if not present)
  const finalCallState = (callData?.state as Record<string, unknown> | undefined) ?? null

  // Return 200 immediately — Ultravox retries up to 10x with exponential backoff
  after(async () => {
    const afterStartMs = Date.now()
    console.log(`[completed:after:start] callId=${callId} slug=${slug}`)
    console.log(`[completed] Processing: callId=${callId} slug=${slug} duration=${durationSeconds}s callerPhone=${callerPhone}`)
    try {
      const supabase = createServiceClient()

      // Skip processing for transferred calls — transfer webhook already marked them.
      // The real conversation data comes from the recovery call (if any), not this one.
      const { data: existingRow } = await supabase
        .from('call_logs')
        .select('call_status')
        .eq('ultravox_call_id', callId)
        .single()
      if (existingRow?.call_status === 'transferred') {
        console.log(`[completed] Skipping transferred call callId=${callId} — no SMS/Telegram/classification needed`)
        return
      }

      // S12-TRIAL1: Dashboard agent test calls skip the full notification pipeline
      if (existingRow?.call_status === 'test') {
        console.log(`[completed] Skipping test call callId=${callId} — no classification/notifications needed`)
        return
      }

      // Atomic dedup: transition 'live' → 'processing'
      const { data: locked } = await supabase
        .from('call_logs')
        .update({ call_status: 'processing' })
        .eq('ultravox_call_id', callId)
        .eq('call_status', 'live')
        .select('id')

      if (!locked?.length) {
        // S9g: Check for stale processing row (crash recovery)
        // If a previous webhook attempt crashed after live→processing but before completing,
        // the row is stuck. Re-acquire if updated_at is >60s stale.
        const staleThreshold = new Date(Date.now() - 60_000).toISOString()
        const { data: recovered } = await supabase
          .from('call_logs')
          .update({ call_status: 'processing' })
          .eq('ultravox_call_id', callId)
          .eq('call_status', 'processing')
          .lt('updated_at', staleThreshold)
          .select('id')

        if (recovered?.length) {
          console.warn(`[completed] RECOVERY: re-acquired stale processing lock for callId=${callId} rowId=${recovered[0].id}`)
        } else {
          // No stale row — try fresh insert (first-time completion without inbound row)
          console.warn(`[completed] No live/stale row for callId=${callId} — attempting fresh insert`)
          const { error: insertError } = await supabase.from('call_logs').insert({
            ultravox_call_id: callId,
            caller_phone: callerPhone,
            call_status: 'processing',
            started_at: new Date().toISOString(),
          })
          if (insertError) {
            console.error(`[completed] Insert fallback failed for callId=${callId}: ${insertError.message} — likely duplicate or active processing, bailing`)
            return
          }
        }
      } else {
        console.log(`[completed] Lock acquired: callId=${callId} rowId=${locked[0].id}`)
      }

      // Fetch client — includes sms_enabled for post-call SMS
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, business_name, niche, telegram_bot_token, telegram_chat_id, telegram_chat_id_2, telegram_style, sms_enabled, sms_template, twilio_number, classification_rules, timezone, contact_email, telegram_notifications_enabled, email_notifications_enabled')
        .eq('slug', slug)
        .single()

      if (!client) {
        console.error(`[completed] Client not found for slug=${slug} error=${clientError?.message || 'null row'}`)
        return
      }
      console.log(`[completed] Client: slug=${slug} id=${client.id} business="${client.business_name}" hasTelegram=${!!(client.telegram_bot_token && client.telegram_chat_id)}`)

      // Fetch transcript
      const transcript = await getTranscript(callId)
      console.log(`[completed] Transcript: callId=${callId} messages=${transcript.length}`)

      // ── Canary token leak detection ────────────────────────────────────────
      if (JSON.stringify(transcript).includes('CNRY-UV-7F3X')) {
        console.error(`[completed] CRITICAL — CANARY TOKEN LEAKED — prompt contamination detected for slug=${slug} callId=${callId}`)
      }

      // ── endReason-based pre-classification (C1 safeguard) ──────────────────────
      let skipClassification = false
      let preClassifiedStatus: string | null = null

      if (endReason === 'unjoined') {
        preClassifiedStatus = 'MISSED'
        skipClassification = true
        console.log(`[completed] endReason=unjoined → auto-classify MISSED for callId=${callId}`)
      } else if (endReason === 'timeout' && durationSeconds < 5) {
        preClassifiedStatus = 'MISSED'
        skipClassification = true
        console.log(`[completed] endReason=timeout + ${durationSeconds}s < 5s → auto-classify MISSED for callId=${callId}`)
      } else if (endReason === 'connection_error' || endReason === 'system_error') {
        preClassifiedStatus = 'MISSED'
        skipClassification = true
        console.log(`[completed] endReason=${endReason} → auto-classify MISSED + ops alert for callId=${callId}`)
      }

      // Classify with Claude Haiku via OpenRouter (skip if pre-classified by endReason)
      let classification
      if (skipClassification && preClassifiedStatus) {
        classification = {
          status: preClassifiedStatus,
          summary: `Call ended: ${endReason}${durationSeconds > 0 ? ` (${durationSeconds}s)` : ''}`,
          serviceType: 'other' as const,
          confidence: 100,
          sentiment: 'neutral' as const,
          key_topics: [] as string[],
          next_steps: '',
          quality_score: 0,
        }
        console.log(`[completed] Pre-classified: callId=${callId} status=${preClassifiedStatus} endReason=${endReason}`)
      } else {
        const businessContext = [client.business_name, client.niche].filter(Boolean).join(' — ')
        classification = await classifyCall(transcript, businessContext || undefined, (client.classification_rules as string | null) || undefined, (client.niche as string | null) || undefined)
        console.log(`[completed] Classification: callId=${callId} status=${classification.status} confidence=${classification.confidence} summary="${classification.summary.slice(0, 80)}"`)
      }

      // Update call_log with full data
      const { data: updatedRows, error: updateError } = await supabase
        .from('call_logs')
        .update({
          client_id: client.id,
          transcript,
          call_status: classification.status,
          ai_summary: classification.summary || ultravoxSummary || null,
          service_type: classification.serviceType,
          duration_seconds: durationSeconds,
          ended_at: endedAt,
          end_reason: endReason,
          confidence: classification.confidence || null,
          sentiment: classification.sentiment || null,
          key_topics: classification.key_topics?.length ? classification.key_topics : null,
          next_steps: classification.next_steps || null,
          quality_score: classification.quality_score || null,
          caller_name: classification.caller_data?.caller_name ?? classification.niche_data?.caller_name ?? null,
          ...(finalCallState ? { call_state: finalCallState } : {}),
        })
        .eq('ultravox_call_id', callId)
        .select('id')
      if (updateError) console.error(`[completed] DB update FAILED for callId=${callId}: ${updateError.message} code=${updateError.code}`)
      else if (!updatedRows?.length) console.error(`[completed] DB update matched 0 rows for callId=${callId} — check call_status CHECK constraint or RLS`)
      else console.log(`[completed] DB updated: callId=${callId} status=${classification.status} callState=${finalCallState ? 'PRESENT' : 'NOT_IN_PAYLOAD'}`)

      // Call log row ID for notification_logs FK
      const callLogId = updatedRows?.[0]?.id ?? null

      // ── Ops alert for system failures ─────────────────────────────────────────
      if (endReason === 'connection_error' || endReason === 'system_error') {
        if (client.telegram_bot_token && client.telegram_chat_id) {
          await sendAlert(
            client.telegram_bot_token,
            client.telegram_chat_id,
            `\u26a0\ufe0f <b>SYSTEM FAILURE</b> [${slug}]\nendReason: ${endReason}\nCaller: ${callerPhone}\nDuration: ${durationSeconds}s\nCall ID: ${callId}`,
            client.telegram_chat_id_2 ?? undefined
          ).catch((e) => console.error(`[completed] Ops alert send failed:`, e))
        }
        console.error(`[completed] SYSTEM FAILURE ALERT: slug=${slug} endReason=${endReason} callId=${callId}`)
      }

      // ── Recording upload (before Telegram so we can include the link) ──────
      let recordingUrl: string | null = null
      try {
        const recordingRes = await getRecordingStream(callId)
        if (recordingRes.ok && recordingRes.body) {
          const arrayBuffer = await recordingRes.arrayBuffer()
          const { error: uploadError } = await supabase.storage
            .from('recordings')
            .upload(`${callId}.mp3`, arrayBuffer, { contentType: 'audio/mpeg', upsert: true })
          if (uploadError) {
            console.error(`[completed] Recording upload failed for callId=${callId}: ${uploadError.message}`)
          } else {
            const { data: urlData } = supabase.storage.from('recordings').getPublicUrl(`${callId}.mp3`)
            recordingUrl = urlData.publicUrl
            await supabase.from('call_logs').update({ recording_url: recordingUrl }).eq('ultravox_call_id', callId)
            console.log(`[completed] Recording uploaded: callId=${callId} url=${recordingUrl}`)
          }
        } else {
          console.warn(`[completed] Recording not available for callId=${callId} status=${recordingRes.status}`)
        }
      } catch (storageErr) {
        console.error('[completed] Recording storage failed:', storageErr)
      }

      // ── S3 idempotency guard: skip notifications if already sent for this call ──
      if (await notificationsAlreadySent(supabase, callLogId)) {
        console.warn(`[completed] IDEMPOTENCY — notifications already sent for callId=${callId} callLogId=${callLogId} — skipping Telegram/SMS/email`)
      } else {
        // Build shared notification context
        const notifCtx = {
          supabase, client: client as CompletedClient, callId, callLogId, slug,
          callerPhone, classification, durationSeconds, endedAt,
          ultravoxSummary, recordingUrl, metadata, transcript,
        }

        // ── Telegram alert ─────────────────────────────────────────────────────
        await sendTelegramNotification(notifCtx)

        // ── SMS post-call follow-up ────────────────────────────────────────────
        await sendSmsFollowUp(notifCtx)

        // ── Voicemail-to-email ─────────────────────────────────────────────────
        await sendEmailNotification(notifCtx)
      }

      // ── Increment seconds used (S9h: idempotent — skip if already counted) ──
      if (durationSeconds > 0) {
        const { data: secCheck } = await supabase
          .from('call_logs')
          .select('seconds_counted')
          .eq('ultravox_call_id', callId)
          .single()

        if (secCheck?.seconds_counted) {
          console.log(`[completed] Seconds already counted for callId=${callId} — skipping increment`)
        } else {
          const { error: rpcError } = await supabase.rpc('increment_seconds_used', {
            p_client_id: client.id,
            p_seconds: durationSeconds,
          })
          if (rpcError) {
            console.error('[completed] Seconds increment failed:', rpcError.message)
          } else {
            const { error: flagError } = await supabase.from('call_logs').update({ seconds_counted: true }).eq('ultravox_call_id', callId)
            if (flagError) console.error(`[completed] seconds_counted flag update FAILED for callId=${callId}: ${flagError.message}`)
            console.log(`[completed] Seconds incremented: clientId=${client.id} +${durationSeconds}s (${Math.ceil(durationSeconds / 60)}min)`)
          }
        }
      }

      console.log(`[completed:after:end] callId=${callId} slug=${slug} elapsed=${Date.now() - afterStartMs}ms`)
    } catch (err) {
      console.error(`[completed:after:error] callId=${callId} slug=${slug} elapsed=${Date.now() - afterStartMs}ms`, err)
      try {
        const crashSupa = createServiceClient()
        await notifySystemFailure(
          `Webhook crash: callId=${callId} slug=${slug}`,
          err,
          crashSupa,
        )
      } catch { /* never let alerting break */ }
    }
  })

  return new NextResponse('OK', { status: 200 })
}
