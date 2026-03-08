import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getTranscript, getRecordingStream } from '@/lib/ultravox'
import { classifyCall } from '@/lib/openrouter'
import { sendAlert } from '@/lib/telegram'

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

  // Ultravox webhook payload: { event: "call.ended", call: { callId, created, joined, ended, endReason, shortSummary, metadata } }
  const callData = payload.call as Record<string, unknown> | undefined
  const callId = (callData?.callId || payload.callId || payload.call_id) as string | undefined

  if (!callId) {
    console.error('[completed] Missing callId in payload:', JSON.stringify(payload).slice(0, 500))
    return new NextResponse('Missing callId', { status: 400 })
  }

  // Duration from Ultravox timestamps (no separate duration field)
  let durationSeconds = 0
  if (callData?.joined && callData?.ended) {
    durationSeconds = Math.round(
      (new Date(callData.ended as string).getTime() - new Date(callData.joined as string).getTime()) / 1000
    )
  }

  // Metadata we injected at call creation: { caller_phone, client_slug, client_id }
  const metadata = (callData?.metadata || payload.metadata || {}) as Record<string, string>
  const callerPhone = metadata.caller_phone || 'unknown'
  const endReason = (callData?.endReason as string | undefined) || null
  const ultravoxSummary = (callData?.shortSummary as string | undefined) || null
  const endedAt = (callData?.ended as string | undefined) || new Date().toISOString()

  // Return 200 IMMEDIATELY — Ultravox fires this up to 10x with exponential backoff
  after(async () => {
    try {
      const supabase = createServiceClient()

      // Atomic dedup: transition 'live' → 'processing'
      // Only the first callback wins; subsequent ones see a non-live status and bail
      const { data: locked } = await supabase
        .from('call_logs')
        .update({ call_status: 'processing' })
        .eq('ultravox_call_id', callId)
        .eq('call_status', 'live')
        .select('id')

      if (!locked?.length) {
        // No 'live' row found — either already processed OR inbound insert failed
        // Try a fresh insert as fallback
        const { error: insertError } = await supabase.from('call_logs').insert({
          ultravox_call_id: callId,
          caller_phone: callerPhone,
          call_status: 'processing',
          started_at: new Date().toISOString(),
        })
        if (insertError) return // 23505 = already handled by another callback
      }

      // Fetch client
      const { data: client } = await supabase
        .from('clients')
        .select('id, business_name, niche, telegram_bot_token, telegram_chat_id')
        .eq('slug', slug)
        .single()

      if (!client) {
        console.error('[completed] Client not found for slug:', slug)
        return
      }

      // Fetch transcript from Ultravox
      const transcript = await getTranscript(callId)

      // Classify with Claude Haiku via OpenRouter — pass client context for accurate classification
      const businessContext = [client.business_name, client.niche].filter(Boolean).join(' — ')
      const classification = await classifyCall(transcript, businessContext || undefined)

      // Update call_log with full data
      await supabase
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
        })
        .eq('ultravox_call_id', callId)

      // Send Telegram alert
      if (client.telegram_bot_token && client.telegram_chat_id) {
        const statusEmoji = {
          HOT: '🔥',
          WARM: '🟡',
          COLD: '❄️',
          JUNK: '🗑️',
        }[classification.status] ?? '📞'

        const mins = Math.floor(durationSeconds / 60)
        const secs = durationSeconds % 60
        const durationStr = durationSeconds > 0
          ? `${mins}:${String(secs).padStart(2, '0')}`
          : 'n/a'

        const message = [
          `${statusEmoji} <b>${classification.status} LEAD</b>`,
          `📱 ${callerPhone}`,
          `⏱ ${durationStr}`,
          `📝 ${classification.summary || ultravoxSummary || 'No summary'}`,
          classification.serviceType !== 'other'
            ? `🏷 ${classification.serviceType}`
            : '',
          endReason ? `📋 ${endReason}` : '',
        ]
          .filter(Boolean)
          .join('\n')

        await sendAlert(client.telegram_bot_token, client.telegram_chat_id, message)
      }

      // Increment minutes used (billing foundation)
      if (durationSeconds > 0) {
        const minutesUsed = Math.ceil(durationSeconds / 60)
        const { error: rpcError } = await supabase.rpc('increment_minutes_used', {
          p_client_id: client.id,
          p_minutes: minutesUsed,
        })
        if (rpcError) console.error('[completed] Minute increment failed:', rpcError.message)
      }

      // Download and persist recording to Supabase Storage
      try {
        const recordingRes = await getRecordingStream(callId)
        if (recordingRes.ok && recordingRes.body) {
          const arrayBuffer = await recordingRes.arrayBuffer()
          const { error: uploadError } = await supabase.storage
            .from('recordings')
            .upload(`${callId}.mp3`, arrayBuffer, {
              contentType: 'audio/mpeg',
              upsert: true,
            })
          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('recordings')
              .getPublicUrl(`${callId}.mp3`)
            await supabase
              .from('call_logs')
              .update({ recording_url: urlData.publicUrl })
              .eq('ultravox_call_id', callId)
          }
        }
      } catch (storageErr) {
        console.error('[completed] Recording storage failed:', storageErr)
      }
    } catch (err) {
      console.error('[completed] Processing error:', err)
      // Alert operator via Telegram when webhook crashes
      try {
        const operatorToken = process.env.TELEGRAM_OPERATOR_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN
        const operatorChat = process.env.TELEGRAM_OPERATOR_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID
        if (operatorToken && operatorChat) {
          await sendAlert(
            operatorToken,
            operatorChat,
            `⚠️ <b>Webhook crash</b>\ncallId: ${callId}\nslug: ${slug}\n${String(err).slice(0, 300)}`
          )
        }
      } catch { /* never let alerting break anything */ }
    }
  })

  return new NextResponse('OK', { status: 200 })
}
