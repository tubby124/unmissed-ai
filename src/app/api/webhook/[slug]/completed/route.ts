import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getTranscript, getRecordingStream, verifyCallbackSig } from '@/lib/ultravox'
import { classifyCall } from '@/lib/openrouter'
import { sendAlert } from '@/lib/telegram'
import twilio from 'twilio'

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

  // ── HMAC signature verification ────────────────────────────────────────────
  // sig is appended by inbound route after call creation. Absent on legacy calls — still accepted.
  const sig = req.nextUrl.searchParams.get('sig')
  if (sig && !verifyCallbackSig(slug, sig)) {
    console.error(`[completed] HMAC sig FAILED for slug=${slug} callId=${callId} — forged webhook rejected`)
    return new NextResponse('Forbidden', { status: 403 })
  }
  if (sig) console.log(`[completed] HMAC sig verified for slug=${slug} callId=${callId}`)

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

  // Return 200 immediately — Ultravox retries up to 10x with exponential backoff
  after(async () => {
    console.log(`[completed] Processing: callId=${callId} slug=${slug} duration=${durationSeconds}s callerPhone=${callerPhone}`)
    try {
      const supabase = createServiceClient()

      // Atomic dedup: transition 'live' → 'processing'
      const { data: locked } = await supabase
        .from('call_logs')
        .update({ call_status: 'processing' })
        .eq('ultravox_call_id', callId)
        .eq('call_status', 'live')
        .select('id')

      if (!locked?.length) {
        console.warn(`[completed] No live row for callId=${callId} — attempting fresh insert`)
        const { error: insertError } = await supabase.from('call_logs').insert({
          ultravox_call_id: callId,
          caller_phone: callerPhone,
          call_status: 'processing',
          started_at: new Date().toISOString(),
        })
        if (insertError) {
          console.error(`[completed] Insert fallback failed for callId=${callId}: ${insertError.message} — likely duplicate, bailing`)
          return
        }
      } else {
        console.log(`[completed] Lock acquired: callId=${callId} rowId=${locked[0].id}`)
      }

      // Fetch client — includes sms_enabled for post-call SMS
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, business_name, niche, telegram_bot_token, telegram_chat_id, telegram_chat_id_2, sms_enabled, sms_template, twilio_number, classification_rules')
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

      // Classify with Claude Haiku via OpenRouter
      const businessContext = [client.business_name, client.niche].filter(Boolean).join(' — ')
      const classification = await classifyCall(transcript, businessContext || undefined, (client.classification_rules as string | null) || undefined)
      console.log(`[completed] Classification: callId=${callId} status=${classification.status} confidence=${classification.confidence} summary="${classification.summary.slice(0, 80)}"`)

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
        })
        .eq('ultravox_call_id', callId)
        .select('id')
      if (updateError) console.error(`[completed] DB update FAILED for callId=${callId}: ${updateError.message} code=${updateError.code}`)
      else if (!updatedRows?.length) console.error(`[completed] DB update matched 0 rows for callId=${callId} — check call_status CHECK constraint or RLS`)
      else console.log(`[completed] DB updated: callId=${callId} status=${classification.status}`)

      // ── Telegram alert — 4-tier intelligence routing ───────────────────────
      if (client.telegram_bot_token && client.telegram_chat_id) {
        const mins = Math.floor(durationSeconds / 60)
        const secs = durationSeconds % 60
        const durationStr = durationSeconds > 0 ? `${mins}:${String(secs).padStart(2, '0')} min` : 'n/a'
        const bizName = client.business_name || slug

        const sentimentEmoji: Record<string, string> = {
          positive: '😊', neutral: '😐', negative: '😟', frustrated: '😤', indifferent: '😑',
        }
        const sentimentIcon = sentimentEmoji[classification.sentiment || ''] ?? '😐'
        const topicsLine = classification.key_topics?.length ? `🔑 ${classification.key_topics.join(', ')}` : ''
        const serviceLabel = classification.serviceType && classification.serviceType !== 'other'
          ? `🏷 ${classification.serviceType.replace(/_/g, ' ')}` : ''
        const summary = classification.summary || ultravoxSummary || 'No summary available.'
        const nextSteps = classification.next_steps || ''
        const confidence = classification.confidence != null ? `🎯 ${classification.confidence}%` : ''

        let message: string

        if (classification.status === 'HOT') {
          message = [
            `⚡ <b>ACTION REQUIRED — HOT LEAD</b>`, `━━━━━━━━━━━━━━━━`,
            `🏢 <b>${bizName}</b>`,
            `📱 ${callerPhone} | ⏱ ${durationStr} | ${confidence} | ${sentimentIcon}`,
            ``, `💬 <b>Summary:</b>`, summary, ``,
            [serviceLabel, topicsLine].filter(Boolean).join(' | '),
            nextSteps ? `\n📋 <b>NEXT:</b> ${nextSteps}` : '',
          ].filter(s => s !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim()
        } else if (classification.status === 'WARM') {
          message = [
            `🟡 <b>WARM LEAD — ${bizName}</b>`,
            `📱 ${callerPhone} | ⏱ ${durationStr} | ${confidence} | ${sentimentIcon}`,
            ``, `💬 ${summary}`,
            [serviceLabel, topicsLine].filter(Boolean).join(' | '),
            nextSteps ? `📋 <b>NEXT:</b> ${nextSteps}` : '',
          ].filter(Boolean).join('\n')
        } else if (classification.status === 'COLD') {
          message = [
            `❄️ <b>COLD — ${bizName}</b>`,
            `📱 ${callerPhone} | ⏱ ${durationStr} | ${confidence}`,
            `💬 ${summary}`,
            nextSteps ? `📋 ${nextSteps}` : '',
          ].filter(Boolean).join('\n')
        } else if (classification.status === 'UNKNOWN') {
          message = [
            `⚠️ <b>UNKNOWN — manual review needed</b>`,
            `🏢 ${bizName} | 📱 ${callerPhone} | ⏱ ${durationStr}`,
            `💬 ${summary}`,
            `📋 Classification failed — open dashboard to review manually.`,
          ].filter(Boolean).join('\n')
        } else {
          // JUNK
          const junkType = classification.serviceType || 'junk'
          message = `🗑️ <b>JUNK — ${bizName}</b> | ${callerPhone} | ⏱ ${durationStr} | ${junkType}\nNo action required.`
        }

        const sent = await sendAlert(client.telegram_bot_token, client.telegram_chat_id, message, client.telegram_chat_id_2 ?? undefined)
        if (!sent) console.error(`[completed] Telegram send FAILED for slug=${slug} callId=${callId}`)
      } else {
        console.warn(`[completed] Telegram SKIPPED for slug=${slug}: bot_token=${client.telegram_bot_token ? 'set' : 'MISSING'} chat_id=${client.telegram_chat_id ? 'set' : 'MISSING'}`)
      }

      // ── SMS post-call follow-up ────────────────────────────────────────────
      if (client.sms_enabled && callerPhone !== 'unknown' && classification.status !== 'JUNK') {
        try {
          const accountSid = process.env.TWILIO_ACCOUNT_SID
          const authToken = process.env.TWILIO_AUTH_TOKEN
          const fromNumber = (client.twilio_number as string | null) || process.env.TWILIO_FROM_NUMBER
          if (accountSid && authToken && fromNumber) {
            const defaultSmsBody = client.niche === 'voicemail'
              ? `Hi, this is ${client.business_name || 'us'}'s assistant. We got your message and will get back to you shortly. For faster service, you can also text us at this number.`
              : `Thanks for calling ${client.business_name || 'us'}! We'll follow up with you shortly.`
            const smsBody = client.sms_template
              ? (client.sms_template as string)
                  .replace('{{business}}', client.business_name || '')
                  .replace('{{summary}}', (classification.summary || '').slice(0, 100))
              : defaultSmsBody
            const twilioClient = twilio(accountSid, authToken)
            await twilioClient.messages.create({ body: smsBody, from: fromNumber, to: callerPhone })
            console.log(`[completed] SMS sent: callId=${callId} to=${callerPhone}`)
          }
        } catch (smsErr) {
          console.error(`[completed] SMS failed for callId=${callId}:`, smsErr)
        }
      }

      // ── Increment minutes used ─────────────────────────────────────────────
      if (durationSeconds > 0) {
        const minutesUsed = Math.ceil(durationSeconds / 60)
        const { error: rpcError } = await supabase.rpc('increment_minutes_used', {
          p_client_id: client.id,
          p_minutes: minutesUsed,
        })
        if (rpcError) console.error('[completed] Minute increment failed:', rpcError.message)
        else console.log(`[completed] Minutes incremented: clientId=${client.id} +${minutesUsed}min`)
      }

      // ── Recording upload ───────────────────────────────────────────────────
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
            await supabase.from('call_logs').update({ recording_url: urlData.publicUrl }).eq('ultravox_call_id', callId)
            console.log(`[completed] Recording uploaded: callId=${callId} url=${urlData.publicUrl}`)
          }
        } else {
          console.warn(`[completed] Recording not available for callId=${callId} status=${recordingRes.status}`)
        }
      } catch (storageErr) {
        console.error('[completed] Recording storage failed:', storageErr)
      }

      console.log(`[completed] Done: callId=${callId} slug=${slug}`)
    } catch (err) {
      console.error('[completed] Processing error:', err)
      try {
        const operatorToken = process.env.TELEGRAM_OPERATOR_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN
        const operatorChat = process.env.TELEGRAM_OPERATOR_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID
        if (operatorToken && operatorChat) {
          await sendAlert(operatorToken, operatorChat,
            `⚠️ <b>Webhook crash</b>\ncallId: ${callId}\nslug: ${slug}\n${String(err).slice(0, 300)}`)
        }
      } catch { /* never let alerting break */ }
    }
  })

  return new NextResponse('OK', { status: 200 })
}
