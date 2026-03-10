/**
 * POST /api/webhook/stripe
 *
 * Handles Stripe checkout.session.completed events.
 * Runs the full activation chain:
 *   1.   Buy Twilio number
 *   1.5  Send onboarding SMS from new number to client's callbackPhone
 *   2.   Update clients row (status=active, twilio_number, telegram_registration_token)
 *   3.   Create Supabase auth user
 *   4.   Insert client_users row
 *   5.   Send password reset email
 *   6.   Mark intake progress_status = 'activated'
 *   7.   Telegram alert to admin
 *   8.   Write activation_log JSONB to clients row (full audit trail)
 *
 * Returns 200 on any outcome (to prevent Stripe retries on partial success).
 * Must be excluded from Next.js body parsing — reads raw body for sig verification.
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { sendAlert } from '@/lib/telegram'
import { randomUUID } from 'crypto'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })

const adminSupa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)


export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err)
    return new NextResponse('Invalid signature', { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    return new NextResponse('OK', { status: 200 })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const { intake_id, client_id, client_slug } = session.metadata ?? {}

  if (!intake_id || !client_id || !client_slug) {
    console.error('[stripe-webhook] Missing metadata on session:', session.id)
    return new NextResponse('OK', { status: 200 })
  }

  console.log(`[stripe-webhook] Processing activation for slug=${client_slug} intake=${intake_id}`)

  // ── Guard: skip if already active ─────────────────────────────────────────
  const { data: existingClient } = await adminSupa
    .from('clients')
    .select('status, business_name')
    .eq('id', client_id)
    .single()

  if (existingClient?.status === 'active') {
    console.log(`[stripe-webhook] slug=${client_slug} already active — skipping`)
    return new NextResponse('OK', { status: 200 })
  }

  const businessName = existingClient?.business_name ?? client_slug

  // ── Load intake for contact_email, area_code, callbackPhone ───────────────
  const { data: intake } = await adminSupa
    .from('intake_submissions')
    .select('contact_email, intake_json')
    .eq('id', intake_id)
    .single()

  const contactEmail = intake?.contact_email ?? null
  const intakeJson = (intake?.intake_json as Record<string, unknown> | null) ?? {}
  const areaCode = intakeJson.area_code as string | null
  const callbackPhone = (intakeJson.callbackPhone as string | null) || null
  const callerAutoText = intakeJson.callerAutoText !== false  // default true
  const callerAutoTextMessage = (intakeJson.callerAutoTextMessage as string | null) || null

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://unmissed-ai-production.up.railway.app'
  const accountSid = process.env.TWILIO_ACCOUNT_SID!
  const authToken = process.env.TWILIO_AUTH_TOKEN!
  const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'hassitant_1bot'

  // Generate Telegram registration token upfront (needed in SMS + Step 2)
  const telegramRegToken = randomUUID()
  const telegramLink = `https://t.me/${botUsername}?start=${telegramRegToken}`

  let twilioNumber: string | null = null

  // ── Step 1: Buy Twilio number ──────────────────────────────────────────────
  // Strategy: search for an available number first (with area code if provided,
  // then without), then buy the specific phone number returned by the search.
  // This avoids the "Missing required parameter PhoneNumber" error when retrying
  // without an area code on the IncomingPhoneNumbers/Local endpoint.
  try {
    const voiceUrl = `${appUrl}/api/webhook/${client_slug}/inbound`
    const fallbackUrl = `${appUrl}/api/webhook/${client_slug}/fallback`
    const buyUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`

    // Search for an available local number (US or CA depending on area code)
    const country = areaCode && ['403','587','780','604','778','236','250','778','867','902','506','709','905','647','416','613','343','519','226','289','365','705','249','807','548'].includes(areaCode) ? 'CA' : 'US'
    const searchBase = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/AvailablePhoneNumbers/${country}/Local.json`
    const searchUrl = areaCode ? `${searchBase}?AreaCode=${areaCode}&Limit=1` : `${searchBase}?Limit=1`

    let availableNumber: string | null = null

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Basic ${twilioAuth}` },
    })

    if (searchRes.ok) {
      const searchData = await searchRes.json() as { available_phone_numbers: { phone_number: string }[] }
      availableNumber = searchData.available_phone_numbers?.[0]?.phone_number ?? null
    }

    // If area code search returned nothing, retry without area code restriction
    if (!availableNumber && areaCode) {
      console.warn(`[stripe-webhook] Area code ${areaCode} unavailable, searching without area code`)
      const retrySearchRes = await fetch(`${searchBase}?Limit=1`, {
        headers: { Authorization: `Basic ${twilioAuth}` },
      })
      if (retrySearchRes.ok) {
        const retryData = await retrySearchRes.json() as { available_phone_numbers: { phone_number: string }[] }
        availableNumber = retryData.available_phone_numbers?.[0]?.phone_number ?? null
      }
    }

    if (availableNumber) {
      const buyBody = new URLSearchParams({
        PhoneNumber: availableNumber,
        VoiceUrl: voiceUrl,
        VoiceMethod: 'POST',
        VoiceFallbackUrl: fallbackUrl,
        VoiceFallbackMethod: 'POST',
      })

      const buyRes = await fetch(buyUrl, {
        method: 'POST',
        headers: { Authorization: `Basic ${twilioAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: buyBody.toString(),
      })

      if (buyRes.ok) {
        const buyData = await buyRes.json() as { phone_number: string }
        twilioNumber = buyData.phone_number
        console.log(`[stripe-webhook] Twilio number purchased: ${twilioNumber} for slug=${client_slug}`)
      } else {
        const errText = await buyRes.text()
        console.error(`[stripe-webhook] Twilio number purchase failed for slug=${client_slug}: ${errText}`)
      }
    } else {
      console.error(`[stripe-webhook] No available Twilio numbers found for slug=${client_slug}`)
    }
  } catch (err) {
    console.error(`[stripe-webhook] Twilio step threw: ${err}`)
  }

  // ── Step 1.5: Onboarding SMS from new number to client's callbackPhone ──────
  // SMS comes from their new AI line — strong brand impression on first contact.
  // Body includes their Telegram setup link so they can connect call alerts.
  let smsSent = false
  let smsSkipReason: string | null = null

  if (twilioNumber && callbackPhone) {
    try {
      const smsBody = new URLSearchParams({
        From: twilioNumber,
        To: callbackPhone,
        Body: `Welcome to unmissed.ai!\n\nYour AI receptionist is now live at ${twilioNumber}.\n\nConnect Telegram for instant call alerts:\n${telegramLink}\n\nReply STOP to opt out.`,
      })
      const smsRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: { Authorization: `Basic ${twilioAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: smsBody.toString(),
        }
      )
      if (smsRes.ok) {
        smsSent = true
        console.log(`[stripe-webhook] Onboarding SMS sent to ${callbackPhone} from ${twilioNumber}`)
      } else {
        const errText = await smsRes.text()
        smsSkipReason = `Twilio error: ${errText.slice(0, 200)}`
        console.error(`[stripe-webhook] SMS failed for slug=${client_slug}: ${smsSkipReason}`)
      }
    } catch (err) {
      smsSkipReason = `threw: ${err}`
      console.error(`[stripe-webhook] SMS threw: ${err}`)
    }
  } else {
    smsSkipReason = !twilioNumber ? 'no Twilio number purchased' : 'no callbackPhone in intake'
    console.warn(`[stripe-webhook] SMS skipped for slug=${client_slug}: ${smsSkipReason}`)
  }

  // ── Step 2: Update clients row + store Telegram registration token ─────────
  try {
    const updatePayload: Record<string, unknown> = {
      status: 'active',
      updated_at: new Date().toISOString(),
      telegram_registration_token: telegramRegToken,
      sms_enabled: callerAutoText,
    }
    if (twilioNumber) updatePayload.twilio_number = twilioNumber
    if (callerAutoTextMessage) updatePayload.sms_template = callerAutoTextMessage

    await adminSupa.from('clients').update(updatePayload).eq('id', client_id)
    console.log(`[stripe-webhook] clients.status → active for slug=${client_slug}`)
  } catch (err) {
    console.error(`[stripe-webhook] clients update threw: ${err}`)
  }

  // ── Steps 3-5: Create auth user + link + send password email ───────────────
  if (contactEmail) {
    try {
      const { data: newUser, error: createErr } = await adminSupa.auth.admin.createUser({
        email: contactEmail,
        email_confirm: true,
      })

      if (createErr) {
        console.error(`[stripe-webhook] createUser failed for ${contactEmail}: ${createErr.message}`)
      } else if (newUser.user) {
        const newUserId = newUser.user.id

        // Link in client_users
        const { error: linkErr } = await adminSupa
          .from('client_users')
          .insert({ user_id: newUserId, client_id, role: 'owner' })

        if (linkErr) console.error(`[stripe-webhook] client_users insert failed: ${linkErr.message}`)

        // Update intake with user ID
        await adminSupa
          .from('intake_submissions')
          .update({ supabase_user_id: newUserId })
          .eq('id', intake_id)

        // Send password setup email
        await adminSupa.auth.resetPasswordForEmail(contactEmail, {
          redirectTo: `${appUrl}/auth/callback?next=/dashboard`,
        })

        console.log(`[stripe-webhook] Auth user created and password email sent to ${contactEmail}`)
      }
    } catch (err) {
      console.error(`[stripe-webhook] Auth user creation threw: ${err}`)
    }
  } else {
    console.warn(`[stripe-webhook] No contact_email on intake ${intake_id} — skipping auth user creation`)
  }

  // ── Step 6: Mark intake as activated ──────────────────────────────────────
  try {
    await adminSupa
      .from('intake_submissions')
      .update({ progress_status: 'activated' })
      .eq('id', intake_id)
  } catch (err) {
    console.error(`[stripe-webhook] intake progress_status update threw: ${err}`)
  }

  // ── Step 7: Telegram alert to admin (with client registration link) ─────────
  try {
    const { data: adminClient } = await adminSupa
      .from('clients')
      .select('telegram_bot_token, telegram_chat_id')
      .eq('slug', 'hasan-sharif')
      .single()

    if (adminClient?.telegram_bot_token && adminClient?.telegram_chat_id) {
      const msg = twilioNumber
        ? `✅ <b>${businessName}</b> activated — ${twilioNumber}\n\n📱 <b>Client Telegram setup link:</b>\n${telegramLink}\n\n${smsSent ? '📤 Onboarding SMS sent to client.' : `⚠️ SMS not sent: ${smsSkipReason}`}\n\n<i>Forward link if SMS didn't reach them.</i>`
        : `✅ <b>${businessName}</b> activated — no number (assign manually)\n\n📱 <b>Client Telegram setup link:</b>\n${telegramLink}`
      await sendAlert(
        adminClient.telegram_bot_token as string,
        adminClient.telegram_chat_id as string,
        msg
      )
    }
  } catch (err) {
    console.error(`[stripe-webhook] Telegram alert threw: ${err}`)
  }

  // ── Step 8: Write activation_log audit trail ───────────────────────────────
  // Full record of what happened during activation — viewable in admin dashboard.
  // Persists even if SMS/email fail so admin can manually follow up.
  try {
    const activationLog = {
      activated_at: new Date().toISOString(),
      stripe_session_id: session.id,
      stripe_amount: session.amount_total,
      twilio_number_bought: twilioNumber,
      telegram_link: telegramLink,
      telegram_token: telegramRegToken,
      contact_email: contactEmail,
      callback_phone: callbackPhone,
      sms_sent: smsSent,
      sms_skip_reason: smsSent ? null : smsSkipReason,
      email_sent: false,
      email_skip_reason: 'email provider not configured — set RESEND_API_KEY to enable',
      intake_id,
    }
    await adminSupa
      .from('clients')
      .update({ activation_log: activationLog })
      .eq('id', client_id)
    console.log(`[stripe-webhook] activation_log written for slug=${client_slug}`)
  } catch (err) {
    console.error(`[stripe-webhook] activation_log write threw: ${err}`)
  }

  console.log(`[stripe-webhook] Activation complete for slug=${client_slug}`)
  return new NextResponse('OK', { status: 200 })
}
