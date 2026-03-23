import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { validateSignature } from '@/lib/twilio'
import { sendAlert } from '@/lib/telegram'
import { APP_URL } from '@/lib/app-url'

/**
 * S14b: Voicemail recording status callback.
 *
 * Twilio POSTs here when a voicemail recording file is ready (recordingStatusCallback).
 * Params include: RecordingSid, RecordingUrl, RecordingStatus, RecordingDuration, CallSid.
 *
 * Flow:
 *   1. Validate Twilio signature
 *   2. Find the call_log row by twilio_call_sid (created in inbound catch block)
 *   3. Download recording from Twilio → upload to Supabase storage
 *   4. Update call_log with recording_url + duration
 *   5. Notify client via Telegram
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const formData = await req.formData()
  const body = Object.fromEntries(formData.entries()) as Record<string, string>

  const recordingSid = body.RecordingSid || ''
  const recordingUrl = body.RecordingUrl || '' // e.g. https://api.twilio.com/2010-04-01/Accounts/.../Recordings/RE...
  const recordingStatus = body.RecordingStatus || ''
  const recordingDuration = parseInt(body.RecordingDuration || '0', 10)
  const callSid = body.CallSid || ''

  console.log(`[voicemail] slug=${slug} callSid=${callSid} recordingSid=${recordingSid} status=${recordingStatus} duration=${recordingDuration}s`)

  // Validate Twilio signature
  const signature = req.headers.get('X-Twilio-Signature') || ''
  const url = `${APP_URL}/api/webhook/${slug}/voicemail`
  if (!validateSignature(signature, url, body)) {
    console.error(`[voicemail] Twilio signature FAILED for slug=${slug}`)
    return new NextResponse('Forbidden', { status: 403 })
  }

  // Only process completed recordings
  if (recordingStatus !== 'completed') {
    console.log(`[voicemail] Ignoring status=${recordingStatus} for slug=${slug}`)
    return new NextResponse('OK', { status: 200 })
  }

  // Skip zero-length recordings (caller hung up before leaving message)
  if (recordingDuration === 0) {
    console.log(`[voicemail] Zero-length recording for slug=${slug} — skipping storage`)
    return new NextResponse('OK', { status: 200 })
  }

  const supabase = createServiceClient()

  // Find the call_log row created when voicemail TwiML was returned
  const { data: callLog, error: logErr } = await supabase
    .from('call_logs')
    .select('id, client_id, caller_phone, ai_summary')
    .eq('twilio_call_sid', callSid)
    .eq('call_status', 'VOICEMAIL')
    .single()

  if (logErr || !callLog) {
    console.error(`[voicemail] No VOICEMAIL call_log for callSid=${callSid}: ${logErr?.message || 'not found'}`)
    return new NextResponse('OK', { status: 200 })
  }

  // Download recording from Twilio and upload to Supabase storage
  let storagePath: string | null = null
  try {
    const audioUrl = `${recordingUrl}.mp3`
    const audioRes = await fetch(audioUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
      },
      signal: AbortSignal.timeout(30_000),
    })
    if (audioRes.ok) {
      const audioBuffer = Buffer.from(await audioRes.arrayBuffer())
      const fileName = `vm-${recordingSid}.mp3`
      const { error: uploadErr } = await supabase.storage
        .from('recordings')
        .upload(fileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true })
      if (uploadErr) {
        console.error(`[voicemail] Storage upload failed for ${fileName}:`, uploadErr.message)
      } else {
        storagePath = fileName
        console.log(`[voicemail] Recording stored: ${fileName} (${audioBuffer.length} bytes)`)
      }
    } else {
      console.error(`[voicemail] Twilio recording download failed: ${audioRes.status} ${audioRes.statusText}`)
    }
  } catch (dlErr) {
    console.error(`[voicemail] Recording download/upload error:`, dlErr)
  }

  // Determine if caller chose voicemail via IVR or if it was a fallback
  const wasIvrChoice = (callLog.ai_summary || '').includes('IVR')

  // Update call_log with recording + duration
  const { error: updateErr } = await supabase
    .from('call_logs')
    .update({
      recording_url: storagePath,
      duration_seconds: recordingDuration,
      ended_at: new Date().toISOString(),
      ai_summary: wasIvrChoice
        ? `Caller chose voicemail via IVR menu (${recordingDuration}s)`
        : `Voicemail (${recordingDuration}s) — AI agent was unavailable`,
    })
    .eq('id', callLog.id)

  if (updateErr) {
    console.error(`[voicemail] call_log update failed:`, updateErr.message)
  }

  // Notify client via Telegram
  const { data: client } = await supabase
    .from('clients')
    .select('business_name, telegram_bot_token, telegram_chat_id, telegram_chat_id_2')
    .eq('id', callLog.client_id)
    .single()

  if (client?.telegram_bot_token && client?.telegram_chat_id) {
    const callerDisplay = callLog.caller_phone || 'Unknown'
    const msg = wasIvrChoice
      ? [
          `<b>VOICEMAIL</b> [${slug}]`,
          `Caller: ${callerDisplay}`,
          `Duration: ${recordingDuration}s`,
          ``,
          `Caller chose to leave a voicemail. Check your dashboard to listen.`,
        ].join('\n')
      : [
          `<b>VOICEMAIL</b> [${slug}]`,
          `Caller: ${callerDisplay}`,
          `Duration: ${recordingDuration}s`,
          ``,
          `Your AI agent was temporarily unavailable. The caller left a voicemail.`,
          `Check your dashboard to listen to the recording.`,
        ].join('\n')

    sendAlert(
      client.telegram_bot_token,
      client.telegram_chat_id,
      msg,
      client.telegram_chat_id_2 ?? undefined
    ).catch(e => console.error(`[voicemail] Telegram alert failed:`, e))
  }

  // Also alert operator
  const opToken = process.env.TELEGRAM_OPERATOR_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN
  const opChat = process.env.TELEGRAM_OPERATOR_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID
  if (opToken && opChat) {
    sendAlert(opToken, opChat,
      `Voicemail captured [${slug}] — caller=${callLog.caller_phone || 'unknown'} duration=${recordingDuration}s stored=${!!storagePath}`
    ).catch(e => console.error(`[voicemail] Operator alert failed:`, e))
  }

  return new NextResponse('OK', { status: 200 })
}
