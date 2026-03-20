import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getTranscript, getRecordingStream, verifyCallbackSig } from '@/lib/ultravox'
import { classifyCall } from '@/lib/openrouter'
import { sendAlert } from '@/lib/telegram'
import { formatTelegramMessage, type TelegramStyle } from '@/lib/telegram-formats'
import { getSmsTemplate } from '@/lib/sms-templates'
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

  // B3-F2: Extract final call state from Ultravox callback (null if not present)
  const finalCallState = (callData?.state as Record<string, unknown> | undefined) ?? null

  // Return 200 immediately — Ultravox retries up to 10x with exponential backoff
  after(async () => {
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
        .select('id, business_name, niche, telegram_bot_token, telegram_chat_id, telegram_chat_id_2, telegram_style, sms_enabled, sms_template, twilio_number, classification_rules, timezone, contact_email')
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

      // ── Ops alert for system failures ─────────────────────────────────────────
      if (endReason === 'connection_error' || endReason === 'system_error') {
        if (client.telegram_bot_token && client.telegram_chat_id) {
          await sendAlert(
            client.telegram_bot_token,
            client.telegram_chat_id,
            `\u26a0\ufe0f <b>SYSTEM FAILURE</b> [${slug}]\nendReason: ${endReason}\nCaller: ${callerPhone}\nDuration: ${durationSeconds}s\nCall ID: ${callId}`,
            client.telegram_chat_id_2 ?? undefined
          ).catch(() => {})
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

      // ── Telegram alert ───────────────────────────────────────────────────────
      if (client.telegram_bot_token && client.telegram_chat_id) {
        const fullSummary = classification.summary || ultravoxSummary || ''
        const clientTz = (client.timezone as string | null) || 'America/Regina'

        let message: string

        if (client.niche === 'auto_glass') {
          // Rich auto-glass format — preferred by Windshield Hub (Sabbir)
          const mins = Math.floor(durationSeconds / 60)
          const secs = durationSeconds % 60
          const callEnd = new Date(endedAt)
          const dateStr = callEnd.toLocaleDateString('en-US', { timeZone: clientTz, month: 'short', day: 'numeric', year: 'numeric' })
          const timeStr = callEnd.toLocaleTimeString('en-US', { timeZone: clientTz, hour: 'numeric', minute: '2-digit', hour12: true })
          const dur = durationSeconds > 0 ? `${mins}m ${secs}s` : 'n/a'

          const nd = classification.niche_data
          const vehicleParts = [nd?.vehicle_year, nd?.vehicle_make, nd?.vehicle_model].filter(Boolean)
          const vehicleStr = vehicleParts.length > 0 ? vehicleParts.join(' ') : 'Unknown'
          const adasStr = nd?.adas === true ? 'YES' : nd?.adas === false ? 'NO' : 'Unknown'
          const vinStr = nd?.vin || 'Not Provided'
          const nameStr = nd?.caller_name || 'Unknown'
          const urgencyFallback: Record<string, string> = { HOT: 'HIGH', WARM: 'MEDIUM', COLD: 'LOW', JUNK: 'LOW', UNKNOWN: 'LOW' }
          const urgencyStr = nd?.urgency || urgencyFallback[classification.status] || 'MEDIUM'
          const requestedStr = nd?.requested_service || 'None'

          const fmtPhone = (p: string) => {
            const d = p.replace(/\D/g, '')
            if (d.length === 11 && d[0] === '1') return `(${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`
            if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
            return p
          }

          message = [
            `🌡️ WINDSHIELD HUB LEAD: ${classification.status}`,
            ``,
            `📅 Date: ${dateStr}`,
            `🕐 Time: ${timeStr}`,
            ``,
            `📝 SUMMARY:`,
            fullSummary || 'No summary available.',
            ``,
            `🚗 VEHICLE DETAILS:`,
            `• Car: ${vehicleStr}`,
            `• ADAS: ${adasStr}`,
            `• VIN: ${vinStr}`,
            ``,
            `🔥 LEAD INFO:`,
            `• Urgency: ${urgencyStr}`,
            `• Requested: ${requestedStr}`,
            ``,
            `👤 CONTACT:`,
            `• Name: ${nameStr}`,
            `• Phone: ${fmtPhone(callerPhone)}`,
            `• Duration: ${dur}`,
            ...(recordingUrl ? [``, `🎧 Recording: ${recordingUrl}`] : []),
          ].join('\n')
        } else {
          // Configurable format — uses client.telegram_style (compact / standard / action_card)
          const style = ((client.telegram_style as string | null) || 'standard') as TelegramStyle

          // Check for a recent booking (made within this call window — last 2 hours)
          let booking: { callerName: string | null; appointmentTime: string; calendarUrl: string | null } | null = null
          if (callerPhone !== 'unknown') {
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
            const { data: bk } = await supabase
              .from('bookings')
              .select('caller_name, appointment_time, appointment_date, calendar_url')
              .eq('slug', slug)
              .eq('caller_phone', callerPhone)
              .gte('booked_at', twoHoursAgo)
              .order('booked_at', { ascending: false })
              .limit(1)
              .single()

            if (bk) {
              booking = {
                callerName: bk.caller_name,
                appointmentTime: bk.appointment_time,
                calendarUrl: bk.calendar_url,
              }
            }
          }

          const cd = classification.caller_data
          message = formatTelegramMessage(style, {
            status: classification.status,
            businessName: client.business_name || slug,
            callerPhone,
            durationSeconds,
            summary: fullSummary,
            nextSteps: classification.next_steps || '',
            serviceType: classification.serviceType || 'other',
            endedAt,
            timezone: clientTz,
            callerData: cd ? { callerName: cd.caller_name, serviceRequested: cd.service_requested } : null,
            booking,
            recordingUrl,
          })
        }

        const sent = await sendAlert(client.telegram_bot_token, client.telegram_chat_id, message, client.telegram_chat_id_2 ?? undefined)
        if (!sent) console.error(`[completed] Telegram send FAILED for slug=${slug} callId=${callId}`)
      } else {
        console.warn(`[completed] Telegram SKIPPED for slug=${slug}: bot_token=${client.telegram_bot_token ? 'set' : 'MISSING'} chat_id=${client.telegram_chat_id ? 'set' : 'MISSING'}`)
      }

      // ── SMS post-call follow-up (classification-aware) ─────────────────────
      // Skip if in-call SMS was already sent (dedupe — agent used sendTextMessage tool)
      const { data: callRow } = await supabase
        .from('call_logs')
        .select('in_call_sms_sent')
        .eq('ultravox_call_id', callId)
        .single()

      // Cross-check demo_calls table for in-call SMS flag (call-me widget demos write here)
      let demoSmsSent = false
      if (!callRow?.in_call_sms_sent) {
        const { data: demoRow, error: demoCheckError } = await supabase
          .from('demo_calls')
          .select('in_call_sms_sent')
          .eq('ultravox_call_id', callId)
          .single()

        if (demoCheckError && demoCheckError.code !== 'PGRST116') {
          // PGRST116 = no rows — expected for non-demo calls. Other errors are real.
          console.error(`[completed] DEDUPE READ FAILED demo_calls: slug=${slug} callId=${callId} error=${demoCheckError.message}`)
        }
        demoSmsSent = !!demoRow?.in_call_sms_sent
      }

      const shouldSkipSms = !!callRow?.in_call_sms_sent || demoSmsSent
      console.log(`[completed] SMS dedupe: in_call=${!!callRow?.in_call_sms_sent} demo=${demoSmsSent} → skip=${shouldSkipSms} callId=${callId}`)

      if (client.sms_enabled && callerPhone !== 'unknown' && !shouldSkipSms) {
        // Check opt-out list before sending (TCPA/CRTC compliance)
        const { data: optOut } = await supabase
          .from('sms_opt_outs')
          .select('id, opted_back_in_at')
          .eq('phone_number', callerPhone)
          .eq('client_id', client.id)
          .single()

        const isOptedOut = optOut && !optOut.opted_back_in_at
        if (isOptedOut) {
          console.log(`[completed] SMS BLOCKED — recipient opted out: callId=${callId} to=${callerPhone}`)
        }

        if (!isOptedOut) {
          const smsBody = getSmsTemplate(classification.status, {
            businessName: client.business_name || 'us',
            callerName: classification.caller_data?.caller_name ?? classification.niche_data?.caller_name ?? null,
            summary: classification.summary,
            niche: client.niche as string | null,
            smsTemplate: client.sms_template as string | null,
            isTransferRecovery: metadata.transfer_recovery === 'true',
          })
          if (smsBody) {
            try {
              const accountSid = process.env.TWILIO_ACCOUNT_SID
              const authToken = process.env.TWILIO_AUTH_TOKEN
              const fromNumber = (client.twilio_number as string | null) || process.env.TWILIO_FROM_NUMBER
              if (accountSid && authToken && fromNumber) {
                const statusCallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/${slug}/sms-status`
                const twilioClient = twilio(accountSid, authToken)
                const twilioMsg = await twilioClient.messages.create({
                  body: smsBody,
                  from: fromNumber,
                  to: callerPhone,
                  statusCallback: statusCallbackUrl,
                })
                console.log(`[completed] SMS sent: callId=${callId} to=${callerPhone} sid=${twilioMsg.sid} status=${classification.status} recovery=${metadata.transfer_recovery || 'false'}`)

                // Log outbound SMS
                const { data: callLogRow } = await supabase
                  .from('call_logs')
                  .select('id')
                  .eq('ultravox_call_id', callId)
                  .single()

                await supabase.from('sms_logs').insert({
                  client_id: client.id,
                  message_sid: twilioMsg.sid,
                  direction: 'outbound',
                  from_number: fromNumber,
                  to_number: callerPhone,
                  body: smsBody,
                  status: 'sent',
                  related_call_id: callLogRow?.id ?? null,
                }).then(({ error: smsLogErr }) => {
                  if (smsLogErr) console.error(`[completed] sms_logs insert failed: ${smsLogErr.message}`)
                })
              }
            } catch (smsErr) {
              console.error(`[completed] SMS failed for callId=${callId}:`, smsErr)
            }
          } else {
            console.log(`[completed] SMS skipped: callId=${callId} status=${classification.status}`)
          }
        }
      }

      // ── Voicemail-to-email transcription ─────────────────────────────────────
      if (client.niche === 'voicemail' && client.contact_email && classification.status !== 'JUNK') {
        try {
          const resendKey = process.env.RESEND_API_KEY
          if (resendKey) {
            const { Resend } = await import('resend')
            const resend = new Resend(resendKey)
            const fromAddress = process.env.RESEND_FROM_EMAIL ?? 'notifications@unmissed.ai'

            const transcriptText = transcript
              .map((m: { role: string; text: string }) => `${m.role === 'agent' ? 'Agent' : 'Caller'}: ${m.text}`)
              .join('\n')

            const callerName = classification.caller_data?.caller_name || 'Unknown caller'
            const fmtPhone = callerPhone !== 'unknown' ? callerPhone : 'Unknown'
            const mins = Math.floor(durationSeconds / 60)
            const secs = durationSeconds % 60

            const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

            await resend.emails.send({
              from: fromAddress,
              to: client.contact_email as string,
              subject: `Voicemail from ${callerName} — ${client.business_name || slug}`,
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
                <h2 style="margin:0 0 16px">New voicemail message</h2>
                <p><strong>From:</strong> ${escHtml(callerName)} (${escHtml(fmtPhone)})</p>
                <p><strong>Duration:</strong> ${mins}m ${secs}s</p>
                <p><strong>Summary:</strong> ${escHtml(classification.summary || 'No summary available.')}</p>
                <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
                <h3 style="margin:0 0 8px">Transcript</h3>
                <pre style="white-space:pre-wrap;font-size:14px;line-height:1.5;background:#f9f9f9;padding:16px;border-radius:8px">${escHtml(transcriptText)}</pre>
                <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
                <p style="font-size:12px;color:#888">unmissed.ai — AI voicemail for your business</p>
              </div>`,
            })
            console.log(`[completed] Voicemail email sent to ${client.contact_email} for callId=${callId}`)
          }
        } catch (emailErr) {
          console.error(`[completed] Voicemail email failed for callId=${callId}:`, emailErr)
        }
      }

      // ── Increment seconds used (accurate — rounded to minutes at display time) ──
      if (durationSeconds > 0) {
        const { error: rpcError } = await supabase.rpc('increment_seconds_used', {
          p_client_id: client.id,
          p_seconds: durationSeconds,
        })
        if (rpcError) console.error('[completed] Seconds increment failed:', rpcError.message)
        else console.log(`[completed] Seconds incremented: clientId=${client.id} +${durationSeconds}s (${Math.ceil(durationSeconds / 60)}min)`)
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
