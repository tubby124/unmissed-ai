/**
 * Extracted notification helpers for the completed webhook.
 *
 * S3 — decompose the ~500-line completed/route.ts into testable units.
 * Each function handles one notification channel + its notification_logs insert.
 */

import { sendAlert } from '@/lib/telegram'
import { formatTelegramMessage, type TelegramStyle } from '@/lib/telegram-formats'
import { getSmsTemplate } from '@/lib/sms-templates'
import twilio from 'twilio'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ────────────────────────────────────────────────────────────────────

/** Subset of `clients` row selected in the completed webhook. */
export interface CompletedClient {
  id: string
  business_name: string | null
  niche: string | null
  telegram_bot_token: string | null
  telegram_chat_id: string | null
  telegram_chat_id_2: string | null
  telegram_style: string | null
  sms_enabled: boolean | null
  sms_template: string | null
  twilio_number: string | null
  classification_rules: string | null
  timezone: string | null
  contact_email: string | null
  telegram_notifications_enabled: boolean | null
  email_notifications_enabled: boolean | null
}

/** Classification result from OpenRouter or pre-classification. */
export interface Classification {
  status: string
  summary: string
  serviceType: string
  confidence: number
  sentiment: string
  key_topics: string[]
  next_steps: string
  quality_score: number
  caller_data?: {
    caller_name?: string | null
    service_requested?: string | null
  } | null
  niche_data?: {
    caller_name?: string | null
    vehicle_year?: string | null
    vehicle_make?: string | null
    vehicle_model?: string | null
    adas?: boolean | null
    vin?: string | null
    urgency?: string | null
    requested_service?: string | null
  } | null
}

/** Shared context passed to all notification helpers. */
export interface NotificationContext {
  supabase: SupabaseClient
  client: CompletedClient
  callId: string
  callLogId: string | null
  slug: string
  callerPhone: string
  classification: Classification
  durationSeconds: number
  endedAt: string
  ultravoxSummary: string | null
  recordingUrl: string | null
  metadata: Record<string, string>
  transcript: Array<{ role: string; text: string }>
}

// ── Idempotency Guard ────────────────────────────────────────────────────────

/**
 * Check if notifications have already been sent for this call.
 * Returns true if notification_logs rows exist for the call_id,
 * meaning this is a duplicate completion webhook.
 */
export async function notificationsAlreadySent(
  supabase: SupabaseClient,
  callLogId: string | null
): Promise<boolean> {
  if (!callLogId) return false
  const { count } = await supabase
    .from('notification_logs')
    .select('id', { count: 'exact', head: true })
    .eq('call_id', callLogId)
  return (count ?? 0) > 0
}

// ── Telegram ─────────────────────────────────────────────────────────────────

export async function sendTelegramNotification(ctx: NotificationContext): Promise<void> {
  const { supabase, client, slug, callId, callLogId, callerPhone, classification,
    durationSeconds, endedAt, ultravoxSummary, recordingUrl } = ctx

  if (!client.telegram_bot_token || !client.telegram_chat_id) {
    console.warn(`[completed] Telegram SKIPPED for slug=${slug}: bot_token=${client.telegram_bot_token ? 'set' : 'MISSING'} chat_id=${client.telegram_chat_id ? 'set' : 'MISSING'}`)
    return
  }

  // S9b: Respect client notification preferences
  if (client.telegram_notifications_enabled === false) {
    console.log(`[completed] Telegram SKIPPED for slug=${slug}: notifications disabled by client preference`)
    return
  }

  const fullSummary = classification.summary || ultravoxSummary || ''
  const clientTz = client.timezone || 'America/Regina'

  let message: string

  if (client.niche === 'auto_glass') {
    message = buildAutoGlassMessage({
      classification, callerPhone, durationSeconds, endedAt,
      clientTz, fullSummary, recordingUrl,
    })
  } else {
    const style = (client.telegram_style || 'standard') as TelegramStyle

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
      callerData: cd ? { callerName: cd.caller_name ?? null, serviceRequested: cd.service_requested ?? null } : null,
      booking,
      recordingUrl,
    })
  }

  const sent = await sendAlert(client.telegram_bot_token, client.telegram_chat_id, message, client.telegram_chat_id_2 ?? undefined)
  if (!sent) console.error(`[completed] Telegram send FAILED for slug=${slug} callId=${callId}`)

  // Log to notification_logs
  const { error: nlErr } = await supabase.from('notification_logs').insert({
    call_id: callLogId,
    client_id: client.id,
    channel: 'telegram',
    recipient: client.telegram_chat_id,
    content: message.slice(0, 10000),
    status: sent ? 'sent' : 'failed',
    error: sent ? null : 'sendAlert returned false',
  })
  if (nlErr) console.error(`[completed] notification_logs insert failed (telegram): ${nlErr.message}`)
}

// ── Auto-glass Telegram format (Windshield Hub) ──────────────────────────────

function buildAutoGlassMessage(params: {
  classification: Classification
  callerPhone: string
  durationSeconds: number
  endedAt: string
  clientTz: string
  fullSummary: string
  recordingUrl: string | null
}): string {
  const { classification, callerPhone, durationSeconds, endedAt, clientTz, fullSummary, recordingUrl } = params
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
    if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
    if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
    return p
  }

  return [
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
}

// ── SMS Follow-Up ────────────────────────────────────────────────────────────

export async function sendSmsFollowUp(ctx: NotificationContext): Promise<void> {
  const { supabase, client, slug, callId, callLogId, callerPhone, classification, metadata } = ctx

  if (!client.sms_enabled || callerPhone === 'unknown') return

  // Dedupe: check if in-call SMS was already sent by the agent tool
  const { data: callRow } = await supabase
    .from('call_logs')
    .select('in_call_sms_sent')
    .eq('ultravox_call_id', callId)
    .single()

  // Cross-check demo_calls table (call-me widget demos write here)
  let demoSmsSent = false
  if (!callRow?.in_call_sms_sent) {
    const { data: demoRow, error: demoCheckError } = await supabase
      .from('demo_calls')
      .select('in_call_sms_sent')
      .eq('ultravox_call_id', callId)
      .single()

    if (demoCheckError && demoCheckError.code !== 'PGRST116') {
      console.error(`[completed] DEDUPE READ FAILED demo_calls: slug=${slug} callId=${callId} error=${demoCheckError.message}`)
    }
    demoSmsSent = !!demoRow?.in_call_sms_sent
  }

  const shouldSkipSms = !!callRow?.in_call_sms_sent || demoSmsSent
  console.log(`[completed] SMS dedupe: in_call=${!!callRow?.in_call_sms_sent} demo=${demoSmsSent} → skip=${shouldSkipSms} callId=${callId}`)

  if (shouldSkipSms) return

  // Check opt-out list (TCPA/CRTC compliance)
  const { data: optOut } = await supabase
    .from('sms_opt_outs')
    .select('id, opted_back_in_at')
    .eq('phone_number', callerPhone)
    .eq('client_id', client.id)
    .single()

  const isOptedOut = optOut && !optOut.opted_back_in_at
  if (isOptedOut) {
    console.log(`[completed] SMS BLOCKED — recipient opted out: callId=${callId} to=${callerPhone}`)
    return
  }

  const smsBody = getSmsTemplate(classification.status, {
    businessName: client.business_name || 'us',
    callerName: classification.caller_data?.caller_name ?? classification.niche_data?.caller_name ?? null,
    summary: classification.summary,
    niche: client.niche,
    smsTemplate: client.sms_template,
    isTransferRecovery: metadata.transfer_recovery === 'true',
  })

  if (!smsBody) {
    console.log(`[completed] SMS skipped: callId=${callId} status=${classification.status}`)
    return
  }

  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = client.twilio_number || process.env.TWILIO_FROM_NUMBER
    if (!accountSid || !authToken || !fromNumber) return

    const statusCallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/${slug}/sms-status`
    const twilioClient = twilio(accountSid, authToken)
    const twilioMsg = await twilioClient.messages.create({
      body: smsBody,
      from: fromNumber,
      to: callerPhone,
      statusCallback: statusCallbackUrl,
    })
    console.log(`[completed] SMS sent: callId=${callId} to=${callerPhone} sid=${twilioMsg.sid} status=${classification.status} recovery=${metadata.transfer_recovery || 'false'}`)

    // Log to notification_logs
    const { error: nlErr } = await supabase.from('notification_logs').insert({
      call_id: callLogId,
      client_id: client.id,
      channel: 'sms_followup',
      recipient: callerPhone,
      content: smsBody.slice(0, 10000),
      status: 'sent',
      external_id: twilioMsg.sid,
    })
    if (nlErr) console.error(`[completed] notification_logs insert failed (sms): ${nlErr.message}`)

    // Log to sms_logs
    const { error: smsLogErr } = await supabase.from('sms_logs').insert({
      client_id: client.id,
      message_sid: twilioMsg.sid,
      direction: 'outbound',
      from_number: fromNumber,
      to_number: callerPhone,
      body: smsBody,
      status: 'sent',
      related_call_id: callLogId,
    })
    if (smsLogErr) console.error(`[completed] sms_logs insert failed: ${smsLogErr.message}`)
  } catch (smsErr) {
    console.error(`[completed] SMS failed for callId=${callId}:`, smsErr)
    const { error: nlErr2 } = await supabase.from('notification_logs').insert({
      call_id: callLogId,
      client_id: client.id,
      channel: 'sms_followup',
      recipient: callerPhone,
      content: smsBody.slice(0, 10000),
      status: 'failed',
      error: String(smsErr).slice(0, 1000),
    })
    if (nlErr2) console.error(`[completed] notification_logs insert failed (sms-fail): ${nlErr2.message}`)
  }
}

// ── Email (Voicemail) ────────────────────────────────────────────────────────

export async function sendEmailNotification(ctx: NotificationContext): Promise<void> {
  const { supabase, client, slug, callId, callLogId, callerPhone, classification,
    durationSeconds, transcript } = ctx

  if (client.niche !== 'voicemail' || !client.contact_email || classification.status === 'JUNK') return

  // S9b: Respect client notification preferences
  if (client.email_notifications_enabled === false) {
    console.log(`[completed] Email SKIPPED for slug=${slug}: notifications disabled by client preference`)
    return
  }

  try {
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) return

    const { Resend } = await import('resend')
    const resend = new Resend(resendKey)
    const fromAddress = process.env.RESEND_FROM_EMAIL ?? 'notifications@unmissed.ai'

    const transcriptText = transcript
      .map((m) => `${m.role === 'agent' ? 'Agent' : 'Caller'}: ${m.text}`)
      .join('\n')

    const callerName = classification.caller_data?.caller_name || 'Unknown caller'
    const fmtPhone = callerPhone !== 'unknown' ? callerPhone : 'Unknown'
    const mins = Math.floor(durationSeconds / 60)
    const secs = durationSeconds % 60

    const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    const emailSubject = `Voicemail from ${callerName} — ${client.business_name || slug}`
    const emailHtml = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
        <h2 style="margin:0 0 16px">New voicemail message</h2>
        <p><strong>From:</strong> ${escHtml(callerName)} (${escHtml(fmtPhone)})</p>
        <p><strong>Duration:</strong> ${mins}m ${secs}s</p>
        <p><strong>Summary:</strong> ${escHtml(classification.summary || 'No summary available.')}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
        <h3 style="margin:0 0 8px">Transcript</h3>
        <pre style="white-space:pre-wrap;font-size:14px;line-height:1.5;background:#f9f9f9;padding:16px;border-radius:8px">${escHtml(transcriptText)}</pre>
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
        <p style="font-size:12px;color:#888">unmissed.ai — AI voicemail for your business</p>
      </div>`
    const emailResult = await resend.emails.send({
      from: fromAddress,
      to: client.contact_email,
      subject: emailSubject,
      html: emailHtml,
    })
    console.log(`[completed] Voicemail email sent to ${client.contact_email} for callId=${callId}`)

    // Log to notification_logs
    const { error: nlErr } = await supabase.from('notification_logs').insert({
      call_id: callLogId,
      client_id: client.id,
      channel: 'email',
      recipient: client.contact_email,
      content: `Subject: ${emailSubject}\n\n${transcriptText.slice(0, 9000)}`,
      status: 'sent',
      external_id: emailResult?.data?.id || null,
    })
    if (nlErr) console.error(`[completed] notification_logs insert failed (email): ${nlErr.message}`)
  } catch (emailErr) {
    console.error(`[completed] Voicemail email failed for callId=${callId}:`, emailErr)
    const { error: nlErr2 } = await supabase.from('notification_logs').insert({
      call_id: callLogId,
      client_id: client.id,
      channel: 'email',
      recipient: client.contact_email || 'unknown',
      content: 'voicemail email (failed before send)',
      status: 'failed',
      error: String(emailErr).slice(0, 1000),
    })
    if (nlErr2) console.error(`[completed] notification_logs insert failed (email-fail): ${nlErr2.message}`)
  }
}
