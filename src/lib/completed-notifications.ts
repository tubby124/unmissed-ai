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
import { APP_URL } from '@/lib/app-url'
import { BRAND_NAME } from '@/lib/brand'
import { sendBrandedEmail } from '@/lib/email/send'

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
  alert_phone: string | null
  alert_email: string | null
  sms_alerts_enabled: boolean | null
  callback_phone: string | null
  call_handling_mode?: string | null
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
  callbackPreference?: string | null
}

export interface OwnerAlertDetails {
  callerName: string
  formattedPhone: string
  urgencyLabel: string
  leadQuality: string
  reasonForCall: string
  requiredNextStep: string
  callbackOpener: string
}

function formatOwnerPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  return phone || 'Unknown'
}

function firstSentence(text: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed) return ''
  const match = trimmed.match(/^(.+?[.!?])(?:\s|$)/)
  return (match?.[1] || trimmed).slice(0, 220)
}

export function buildOwnerAlertDetails(
  classification: Classification,
  callerPhone: string,
  businessName: string | null,
): OwnerAlertDetails {
  const callerName =
    classification.caller_data?.caller_name ||
    classification.niche_data?.caller_name ||
    'Unknown caller'
  const serviceRequested =
    classification.caller_data?.service_requested ||
    classification.niche_data?.requested_service ||
    ''
  const fallbackReason = firstSentence(classification.summary) || classification.serviceType || 'missed call'
  const reasonForCall = serviceRequested || fallbackReason
  const status = classification.status || 'UNKNOWN'
  const urgencyLabel =
    status === 'HOT' ? 'Urgent callback'
    : status === 'WARM' ? 'Good lead'
    : status === 'COLD' ? 'Low urgency'
    : status === 'JUNK' ? 'No action'
    : 'Needs review'
  const quality =
    typeof classification.quality_score === 'number' && Number.isFinite(classification.quality_score)
      ? ` · ${Math.max(0, Math.min(100, Math.round(classification.quality_score)))}/100 quality`
      : ''
  const requiredNextStep =
    classification.next_steps?.trim() ||
    (status === 'HOT'
      ? 'Call back as soon as possible.'
      : status === 'WARM'
        ? 'Call back when you have a clear window.'
        : status === 'COLD'
          ? 'Review when convenient.'
          : 'Review the call manually.')
  const safeReason = reasonForCall.replace(/\.$/, '')
  const openerName = callerName === 'Unknown caller' ? 'there' : callerName
  const business = businessName || 'the business'
  const callbackOpener = `Hi ${openerName}, this is ${business}. My assistant said you called about ${safeReason}. I wanted to help with that.`

  return {
    callerName,
    formattedPhone: callerPhone === 'unknown' ? 'Unknown' : formatOwnerPhone(callerPhone),
    urgencyLabel,
    leadQuality: `${status} lead${quality}`,
    reasonForCall,
    requiredNextStep,
    callbackOpener,
  }
}

export function shouldSendPerCallEmail(client: Pick<CompletedClient, 'niche' | 'call_handling_mode' | 'email_notifications_enabled'>): boolean {
  // Unified semantic (2026-05-25 Task 4): every niche defaults ON unless
  // email_notifications_enabled is explicitly set to false. Existing
  // non-voicemail clients with NULL flag were opted out via the optional
  // backfill SQL in Task 4 step 6 to preserve their pre-deploy behavior.
  // Voicemail-specific helper variables retained for documentation;
  // the niche distinction no longer affects the return value.
  return client.email_notifications_enabled !== false
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
    durationSeconds, endedAt, ultravoxSummary, recordingUrl, callbackPreference } = ctx

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
  const ownerAlert = buildOwnerAlertDetails(classification, callerPhone, client.business_name)

  let message: string

  if (client.niche === 'auto_glass') {
    message = buildAutoGlassMessage({
      classification, callerPhone, durationSeconds, endedAt,
      clientTz, fullSummary, recordingUrl, callbackPreference: callbackPreference ?? null,
    })
  } else if (client.niche === 'property_management') {
    message = buildPmNotificationMessage({
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
      nextSteps: ownerAlert.requiredNextStep,
      serviceType: classification.serviceType || 'other',
      endedAt,
      timezone: clientTz,
      callerData: cd ? { callerName: cd.caller_name ?? null, serviceRequested: cd.service_requested ?? null } : null,
      booking,
      recordingUrl,
      callbackPreference: callbackPreference ?? null,
      qualityScore: classification.quality_score,
      urgencyLabel: ownerAlert.urgencyLabel,
      callbackOpener: ownerAlert.callbackOpener,
    })
  }

  // D248: empty message = JUNK classification — skip sending
  if (!message) {
    console.log(`[completed] Telegram SKIPPED for slug=${slug} callId=${callId}: JUNK classification`)
    return
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
  callbackPreference: string | null
}): string {
  const { classification, callerPhone, durationSeconds, endedAt, clientTz, fullSummary, recordingUrl, callbackPreference } = params
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

  const fmtPhone = (p: string) => {
    const d = p.replace(/\D/g, '')
    if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
    if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
    return p
  }

  // D248: action-first format — HOT leads with "Call NOW", others with context
  const STATUS_EMOJI: Record<string, string> = { HOT: '🔥', WARM: '🟡', COLD: '❄️', JUNK: '🗑', UNKNOWN: '⚠️' }
  const emoji = STATUS_EMOJI[classification.status] || '📞'
  const serviceLabelMap: Record<string, string> = {
    HOT: 'chip repair / replacement',
    WARM: 'quote request',
    COLD: 'inquiry',
    UNKNOWN: 'glass service',
  }
  const serviceLabel = nd?.requested_service || serviceLabelMap[classification.status] || 'glass service'
  const DIVIDER = '━━━━━━━━━━━━━━━━━'

  const lines: string[] = [
    `${emoji} <b>${classification.status} LEAD — ${serviceLabel}</b>`,
    DIVIDER,
  ]

  // Action line — call to action first
  if (classification.status === 'HOT') {
    lines.push(nameStr !== 'Unknown'
      ? `📞 Call <b>${nameStr}</b> NOW: ${fmtPhone(callerPhone)}`
      : `📞 Call back NOW: ${fmtPhone(callerPhone)}`)
  } else if (classification.status === 'WARM') {
    lines.push(nameStr !== 'Unknown'
      ? `📞 Follow up with <b>${nameStr}</b>: ${fmtPhone(callerPhone)}`
      : `📞 Follow up: ${fmtPhone(callerPhone)}`)
  } else {
    lines.push(`📞 ${fmtPhone(callerPhone)}`)
  }

  // Vehicle details
  if (vehicleStr !== 'Unknown') lines.push(`🚗 ${vehicleStr}${adasStr !== 'Unknown' ? ` · ADAS: ${adasStr}` : ''}`)
  if (urgencyStr && urgencyStr !== 'MEDIUM') lines.push(`⚡ Urgency: ${urgencyStr}`)

  if (callbackPreference) lines.push(`⏰ ${callbackPreference}`)

  // Summary below the fold
  if (fullSummary) {
    lines.push(DIVIDER)
    lines.push(fullSummary)
  }

  lines.push(DIVIDER)
  lines.push(`📅 ${dateStr} · ${timeStr} · ${dur}`)
  if (vinStr !== 'Not Provided') lines.push(`VIN: ${vinStr}`)
  if (recordingUrl) lines.push(`🎧 <a href="${recordingUrl}">Recording</a>`)

  return lines.join('\n')
}

// ── Property Management Telegram format ──────────────────────────────────────

function buildPmNotificationMessage(params: {
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
  const DIVIDER = '━━━━━━━━━━━━━━━━━'

  const fmtPhone = (p: string) => {
    const d = p.replace(/\D/g, '')
    if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
    if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
    return p
  }

  // Best-effort parse of unit, tenant, issue from summary text
  const unitMatch = fullSummary.match(/unit\s+([A-Za-z0-9#\-]+)/i)
  const tenantMatch = fullSummary.match(/tenant[:\s]+([A-Za-z ]+?)(?:\s*[-,|]|$)/im)
  const issueMatch = fullSummary.match(/issue[:\s]+(.+?)(?:\n|$)/i)
  const unitStr = unitMatch ? unitMatch[1] : null
  const tenantStr = tenantMatch ? tenantMatch[1].trim() : null
  const issueStr = issueMatch ? issueMatch[1].trim() : null

  const lines: string[] = []

  if (/\[P1\s+(?:URGENT|EMERGENCY)\]/i.test(fullSummary)) {
    lines.push(`🚨 <b>[P1 EMERGENCY]</b>`)
    if (unitStr && tenantStr) lines.push(`${unitStr} — ${tenantStr}`)
    else if (tenantStr) lines.push(tenantStr)
    if (issueStr) lines.push(`Issue: ${issueStr}`)
    else if (!unitStr && !tenantStr) lines.push(fullSummary)
    lines.push(`⚠️ REQUIRES IMMEDIATE RESPONSE`)
  } else if (/\[P2\s+URGENT\]/i.test(fullSummary)) {
    lines.push(`⚡ <b>[P2 URGENT]</b>`)
    if (tenantStr && unitStr) lines.push(`${tenantStr} — ${unitStr}`)
    else if (tenantStr) lines.push(tenantStr)
    if (issueStr) lines.push(`Issue: ${issueStr}`)
    else if (!tenantStr && !unitStr) lines.push(fullSummary)
  } else if (/\[P3\s+ROUTINE\]/i.test(fullSummary)) {
    lines.push(`🔧 <b>[P3 ROUTINE]</b>`)
    if (tenantStr && unitStr) lines.push(`${tenantStr} — ${unitStr}`)
    else if (tenantStr) lines.push(tenantStr)
    else lines.push(fullSummary)
  } else if (/\[SHOWING REQUEST\]/i.test(fullSummary)) {
    lines.push(`🏠 <b>[SHOWING REQUEST]</b>`)
    // Strip the tag and include remaining summary details
    const detail = fullSummary.replace(/\[SHOWING REQUEST\]/gi, '').trim()
    if (detail) lines.push(detail)
  } else {
    // Standard fallback — mirrors the non-niche formatTelegramMessage path
    const STATUS_EMOJI: Record<string, string> = { HOT: '🔥', WARM: '🟡', COLD: '❄️', JUNK: '🗑', UNKNOWN: '⚠️' }
    const emoji = STATUS_EMOJI[classification.status] || '📞'
    lines.push(`${emoji} <b>${classification.status}</b> — ${callerPhone !== 'unknown' ? fmtPhone(callerPhone) : 'Unknown'}`)
    if (fullSummary) {
      lines.push(DIVIDER)
      lines.push(fullSummary)
    }
  }

  lines.push(DIVIDER)
  lines.push(`📞 ${fmtPhone(callerPhone)}`)
  lines.push(`📅 ${dateStr} · ${timeStr} · ${dur}`)
  if (recordingUrl) lines.push(`🎧 <a href="${recordingUrl}">Recording</a>`)

  return lines.join('\n')
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

    const statusCallbackUrl = `${APP_URL}/api/webhook/${slug}/sms-status`
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

// ── Email (per-call alert) ──────────────────────────────────────────────────

export async function sendEmailNotification(ctx: NotificationContext): Promise<void> {
  const { supabase, client, slug, callId, callLogId, callerPhone, classification,
    durationSeconds, transcript, recordingUrl } = ctx

  const emailDestination = client.alert_email || client.contact_email
  if (!emailDestination || classification.status === 'JUNK') return

  // Voicemail replacement always sends per-call email by default, even when the
  // business niche is HVAC/plumbing/etc. Telegram remains optional.
  if (!shouldSendPerCallEmail(client)) {
    const mode = client.call_handling_mode || 'unknown'
    if (client.niche === 'voicemail' || mode === 'message_only') {
      console.log(`[completed] Email SKIPPED for slug=${slug}: voicemail replacement opted out`)
    } else {
      console.log(`[completed] Email SKIPPED for slug=${slug}: niche=${client.niche} mode=${mode} requires explicit opt-in`)
    }
    return
  }

  try {
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      console.error(`[completed] Voicemail email failed for callId=${callId}: RESEND_API_KEY missing`)
      const { error: nlErr } = await supabase.from('notification_logs').insert({
        call_id: callLogId,
        client_id: client.id,
        channel: 'email',
        recipient: emailDestination,
        content: 'voicemail email failed before send: RESEND_API_KEY missing',
        status: 'failed',
        error: 'RESEND_API_KEY missing',
      })
      if (nlErr) console.error(`[completed] notification_logs insert failed (email-config): ${nlErr.message}`)
      return
    }

    const transcriptText = transcript
      .map((m) => `${m.role === 'agent' ? 'Agent' : 'Caller'}: ${m.text}`)
      .join('\n')

    const ownerAlert = buildOwnerAlertDetails(classification, callerPhone, client.business_name)
    const mins = Math.floor(durationSeconds / 60)
    const secs = durationSeconds % 60

    const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

    const emailSubject = `${ownerAlert.urgencyLabel}: ${ownerAlert.callerName} — ${client.business_name || slug}`
    const rows = [
      ['Urgency', ownerAlert.urgencyLabel],
      ['Caller', `${ownerAlert.callerName} (${ownerAlert.formattedPhone})`],
      ['Lead quality', ownerAlert.leadQuality],
      ['Reason for call', ownerAlert.reasonForCall],
      ['Required next step', ownerAlert.requiredNextStep],
      ['Suggested callback opener', ownerAlert.callbackOpener],
    ]
    const emailHtml = `<h2 style="margin:0 0 8px">New captured call</h2>
<p style="margin:0 0 16px;color:#555">Your AI answered a missed call and captured the callback details.</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 16px">
${rows.map(([label, value]) => `<tr><td style="padding:8px 10px;border:1px solid #eee;background:#fafafa;width:34%;font-weight:600">${escHtml(label)}</td><td style="padding:8px 10px;border:1px solid #eee">${escHtml(value)}</td></tr>`).join('')}
</table>
<p><strong>Duration:</strong> ${mins}m ${secs}s</p>
${recordingUrl ? `<p><strong>Recording:</strong> <a href="${escHtml(recordingUrl)}">Listen to the call</a></p>` : ''}
<p><strong>Summary:</strong> ${escHtml(classification.summary || 'No summary available.')}</p>
<hr style="border:none;border-top:1px solid #eee;margin:16px 0">
<h3 style="margin:0 0 8px">Transcript</h3>
<pre style="white-space:pre-wrap;font-size:14px;line-height:1.5;background:#f9f9f9;padding:16px;border-radius:8px">${escHtml(transcriptText)}</pre>`

    const emailResult = await sendBrandedEmail({
      to: emailDestination,
      clientId: client.id,
      clientSlug: slug,
      purpose: 'system',
      tag: 'voicemail_alert',
      reason: `New voicemail message captured by your ${BRAND_NAME} agent.`,
      subject: emailSubject,
      html: emailHtml,
    })
    if (!emailResult.ok) throw new Error(emailResult.error)
    console.log(`[completed] Owner email sent to ${emailDestination} for callId=${callId} (id=${emailResult.id})`)

    // Log to notification_logs
    const { error: nlErr } = await supabase.from('notification_logs').insert({
      call_id: callLogId,
      client_id: client.id,
      channel: 'email',
      recipient: emailDestination,
      content: `Subject: ${emailSubject}

Urgency: ${ownerAlert.urgencyLabel}
Caller: ${ownerAlert.callerName} (${ownerAlert.formattedPhone})
Lead quality: ${ownerAlert.leadQuality}
Reason for call: ${ownerAlert.reasonForCall}
Required next step: ${ownerAlert.requiredNextStep}
Suggested opener: ${ownerAlert.callbackOpener}

Transcript:
${transcriptText.slice(0, 8500)}`,
      status: 'sent',
      external_id: emailResult.id || null,
    })
    if (nlErr) console.error(`[completed] notification_logs insert failed (email): ${nlErr.message}`)
  } catch (emailErr) {
    console.error(`[completed] Voicemail email failed for callId=${callId}:`, emailErr)
    const { error: nlErr2 } = await supabase.from('notification_logs').insert({
      call_id: callLogId,
      client_id: client.id,
      channel: 'email',
      recipient: emailDestination || 'unknown',
      content: 'voicemail email (failed before send)',
      status: 'failed',
      error: String(emailErr).slice(0, 1000),
    })
    if (nlErr2) console.error(`[completed] notification_logs insert failed (email-fail): ${nlErr2.message}`)
  }
}
