import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { validateSignature } from '@/lib/twilio'
import { sendAlert } from '@/lib/telegram'
import { APP_URL } from '@/lib/app-url'
import { SlidingWindowRateLimiter } from '@/lib/rate-limiter'

export const maxDuration = 10

// S13o: 60 messages per slug per 60s — SMS flood prevention
const smsRateLimiter = new SlidingWindowRateLimiter(60, 60_000)

const OPT_OUT_KEYWORDS = ['STOP', 'END', 'CANCEL', 'QUIT', 'UNSUBSCRIBE', 'ARRET']
const HELP_KEYWORDS = ['HELP', 'AIDE']

function twimlResponse(message?: string): NextResponse {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`
  return new NextResponse(body, { headers: { 'Content-Type': 'text/xml' } })
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const formData = await req.formData()
  const body = Object.fromEntries(formData.entries()) as Record<string, string>

  const from = body.From || ''
  const to = body.To || ''
  const messageSid = body.MessageSid || ''
  const messageBody = body.Body || ''

  console.log(`[sms-inbound] slug=${slug} from=${from} to=${to} sid=${messageSid} body="${messageBody.slice(0, 100)}"`)

  // Validate Twilio signature
  const signature = req.headers.get('X-Twilio-Signature') || ''
  const url = `${APP_URL}/api/webhook/${slug}/sms-inbound`
  if (!validateSignature(signature, url, body)) {
    console.error(`[sms-inbound] Twilio signature FAILED for slug=${slug}`)
    return new NextResponse('Forbidden', { status: 403 })
  }

  if (!messageSid || !from) {
    return new NextResponse('Bad Request', { status: 400 })
  }

  // S13o: Rate limit per slug — block SMS floods before any DB work
  const rl = smsRateLimiter.check(slug)
  if (!rl.allowed) {
    console.warn(`[sms-inbound] RATE LIMITED: slug=${slug} from=${from} retryAfter=${Math.ceil(rl.retryAfterMs / 1000)}s`)
    return twimlResponse()
  }
  smsRateLimiter.record(slug)

  const supabase = createServiceClient()

  // Look up client by Twilio number (the To number is the client's Twilio number)
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, business_name, telegram_bot_token, telegram_chat_id, telegram_chat_id_2, twilio_number')
    .eq('twilio_number', to)
    .eq('status', 'active')
    .single()

  if (clientError || !client) {
    console.error(`[sms-inbound] Client not found for to=${to} slug=${slug} error=${clientError?.message || 'null row'}`)
    return twimlResponse()
  }

  // Idempotency check — skip if MessageSid already logged
  const { data: existing } = await supabase
    .from('sms_logs')
    .select('id')
    .eq('message_sid', messageSid)
    .single()

  if (existing) {
    console.log(`[sms-inbound] Duplicate MessageSid=${messageSid} — skipping`)
    return twimlResponse()
  }

  const normalizedBody = messageBody.trim().toUpperCase()
  const isOptOut = OPT_OUT_KEYWORDS.includes(normalizedBody)
  const isHelp = HELP_KEYWORDS.includes(normalizedBody)
  const isOptIn = normalizedBody === 'START'

  // Log the inbound message
  const { error: insertError } = await supabase.from('sms_logs').insert({
    client_id: client.id,
    message_sid: messageSid,
    direction: 'inbound',
    from_number: from,
    to_number: to,
    body: messageBody,
    status: isOptOut ? 'opted_out' : 'received',
    opt_out: isOptOut,
  })

  if (insertError) {
    console.error(`[sms-inbound] sms_logs insert failed: ${insertError.message}`)
  }

  // Handle STOP/opt-out keywords (TCPA + CRTC compliance)
  if (isOptOut) {
    console.log(`[sms-inbound] OPT-OUT: from=${from} keyword=${normalizedBody} client=${client.id}`)

    const { error: optOutError } = await supabase.from('sms_opt_outs').upsert(
      {
        phone_number: from,
        client_id: client.id,
        opted_out_at: new Date().toISOString(),
        opted_back_in_at: null,
        reason: normalizedBody,
      },
      { onConflict: 'phone_number,client_id' }
    )

    if (optOutError) {
      console.error(`[sms-inbound] sms_opt_outs upsert failed: ${optOutError.message}`)
    }

    // Notify client via Telegram
    if (client.telegram_bot_token && client.telegram_chat_id) {
      try {
        await sendAlert(
          client.telegram_bot_token,
          client.telegram_chat_id,
          `<b>SMS OPT-OUT</b>\nPhone: ${from}\nKeyword: ${normalizedBody}\nThis number will no longer receive SMS.`,
          client.telegram_chat_id_2 ?? undefined
        )
      } catch (alertErr) {
        console.error(`[sms-inbound] Opt-out alert failed for slug=${slug}:`, alertErr)
      }
    }

    return twimlResponse(`You have been unsubscribed from ${client.business_name || 'our'} messages. Text START to re-subscribe.`)
  }

  // Handle START/opt-in
  if (isOptIn) {
    console.log(`[sms-inbound] OPT-IN: from=${from} client=${client.id}`)

    const { error: optInError } = await supabase
      .from('sms_opt_outs')
      .update({ opted_back_in_at: new Date().toISOString() })
      .eq('phone_number', from)
      .eq('client_id', client.id)

    if (optInError) {
      console.error(`[sms-inbound] opt-in update failed: ${optInError.message}`)
    }

    return twimlResponse(`You have been re-subscribed to ${client.business_name || 'our'} messages. Text STOP to unsubscribe.`)
  }

  // Handle HELP/AIDE keywords (CRTC requirement)
  if (isHelp) {
    console.log(`[sms-inbound] HELP request: from=${from} client=${client.id}`)
    return twimlResponse(`${client.business_name || 'This service'} — AI voice assistant powered by unmissed.ai. Reply STOP to unsubscribe. For support, call this number.`)
  }

  // Regular inbound message — forward to Telegram
  if (client.telegram_bot_token && client.telegram_chat_id) {
    const fmtPhone = (p: string) => {
      const d = p.replace(/\D/g, '')
      if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
      if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
      return p
    }

    const alert = [
      `<b>Inbound SMS</b>`,
      `From: ${fmtPhone(from)}`,
      `Message: ${messageBody.slice(0, 500)}`,
    ].join('\n')

    try {
      await sendAlert(
        client.telegram_bot_token,
        client.telegram_chat_id,
        alert,
        client.telegram_chat_id_2 ?? undefined
      )
    } catch (alertErr) {
      console.error(`[sms-inbound] Inbound SMS alert failed for slug=${slug}:`, alertErr)
    }
  }

  // Return empty TwiML (no auto-reply for regular messages)
  return twimlResponse()
}
