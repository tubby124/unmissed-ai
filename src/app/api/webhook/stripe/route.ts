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
import { Resend } from 'resend'
import { sendAlert } from '@/lib/telegram'
import { randomUUID } from 'crypto'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })

// Province → area codes priority list (try each in order, stop at first available)
const PROVINCE_AREA_CODES: Record<string, string[]> = {
  AB: ['587', '403', '780'],
  SK: ['639', '306'],
  BC: ['778', '604', '236'],
  ON: ['647', '416', '905', '519'],
  MB: ['431', '204'],
  QC: ['514', '438'],
  NS: ['902'], NB: ['506'], NL: ['709'], PE: ['902'],
  NT: ['867'], YT: ['867'], NU: ['867'],
}

async function notifyAdmin(bot: string | null, chat: string | null, msg: string) {
  if (!bot || !chat) return
  try { await sendAlert(bot, chat, msg) } catch { /* non-blocking */ }
}

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

  // ── Fetch admin Telegram config (fetched once, used for step-by-step alerts) ─
  const { data: adminClient } = await adminSupa
    .from('clients')
    .select('telegram_bot_token, telegram_chat_id')
    .eq('slug', 'hasan-sharif')
    .single()
  const adminBot = adminClient?.telegram_bot_token as string | null
  const adminChat = adminClient?.telegram_chat_id as string | null

  void notifyAdmin(adminBot, adminChat, `💳 Payment received — activating <b>${businessName}</b>…`)

  // ── Load intake for contact_email, area_code, callbackPhone ───────────────
  const { data: intake } = await adminSupa
    .from('intake_submissions')
    .select('contact_email, intake_json')
    .eq('id', intake_id)
    .single()

  const contactEmail = intake?.contact_email ?? null
  const intakeJson = (intake?.intake_json as Record<string, unknown> | null) ?? {}
  const areaCode = intakeJson.area_code as string | null
  const callbackPhone = (intakeJson.callback_phone as string | null) || null
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
  // Province-first strategy: use province from intake_json to determine country
  // and try area codes in priority order. Never fall through to US for CA provinces.
  try {
    const voiceUrl = `${appUrl}/api/webhook/${client_slug}/inbound`
    const fallbackUrl = `${appUrl}/api/webhook/${client_slug}/fallback`
    const buyUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`

    const province = (intakeJson.province as string | null) || null
    const isCanadian = !!(province && province in PROVINCE_AREA_CODES)
    const searchCountry = isCanadian ? 'CA' : 'US'
    const searchBase = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/AvailablePhoneNumbers/${searchCountry}/Local.json`

    let availableNumber: string | null = null

    if (isCanadian && province) {
      // Try each area code in priority order for the province
      const areaCodes = PROVINCE_AREA_CODES[province] || []
      for (const code of areaCodes) {
        const searchRes = await fetch(`${searchBase}?AreaCode=${code}&Limit=1`, {
          headers: { Authorization: `Basic ${twilioAuth}` },
        })
        if (searchRes.ok) {
          const searchData = await searchRes.json() as { available_phone_numbers: { phone_number: string }[] }
          availableNumber = searchData.available_phone_numbers?.[0]?.phone_number ?? null
          if (availableNumber) { console.log(`[stripe-webhook] Found CA number with area code ${code}`); break }
        }
      }
      // Fallback: any CA number (never US for CA provinces)
      if (!availableNumber) {
        console.warn(`[stripe-webhook] No number found for province=${province}, trying any CA number`)
        const retryRes = await fetch(`${searchBase}?Limit=1`, { headers: { Authorization: `Basic ${twilioAuth}` } })
        if (retryRes.ok) {
          const retryData = await retryRes.json() as { available_phone_numbers: { phone_number: string }[] }
          availableNumber = retryData.available_phone_numbers?.[0]?.phone_number ?? null
        }
      }
    } else {
      // US or no province: use areaCode if provided, else any US number
      const searchUrl = areaCode ? `${searchBase}?AreaCode=${areaCode}&Limit=1` : `${searchBase}?Limit=1`
      const searchRes = await fetch(searchUrl, { headers: { Authorization: `Basic ${twilioAuth}` } })
      if (searchRes.ok) {
        const searchData = await searchRes.json() as { available_phone_numbers: { phone_number: string }[] }
        availableNumber = searchData.available_phone_numbers?.[0]?.phone_number ?? null
      }
      // Retry without area code restriction if needed
      if (!availableNumber && areaCode) {
        console.warn(`[stripe-webhook] Area code ${areaCode} unavailable, searching without area code`)
        const retryRes = await fetch(`${searchBase}?Limit=1`, { headers: { Authorization: `Basic ${twilioAuth}` } })
        if (retryRes.ok) {
          const retryData = await retryRes.json() as { available_phone_numbers: { phone_number: string }[] }
          availableNumber = retryData.available_phone_numbers?.[0]?.phone_number ?? null
        }
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
        void notifyAdmin(adminBot, adminChat, `📞 Twilio number purchased: <b>${twilioNumber}</b> for ${businessName}`)
      } else {
        const errText = await buyRes.text()
        console.error(`[stripe-webhook] Twilio number purchase failed for slug=${client_slug}: ${errText}`)
        void notifyAdmin(adminBot, adminChat, `⚠️ Twilio number purchase FAILED for ${businessName}`)
      }
    } else {
      console.error(`[stripe-webhook] No available Twilio numbers found for slug=${client_slug}`)
      void notifyAdmin(adminBot, adminChat, `⚠️ No Twilio numbers available for ${businessName}`)
    }
  } catch (err) {
    console.error(`[stripe-webhook] Twilio step threw: ${err}`)
    void notifyAdmin(adminBot, adminChat, `⚠️ Twilio step threw: ${String(err).slice(0, 100)}`)
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
        void notifyAdmin(adminBot, adminChat, `📤 Onboarding SMS sent to ${callbackPhone}`)
      } else {
        const errText = await smsRes.text()
        smsSkipReason = `Twilio error: ${errText.slice(0, 200)}`
        console.error(`[stripe-webhook] SMS failed for slug=${client_slug}: ${smsSkipReason}`)
        void notifyAdmin(adminBot, adminChat, `⚠️ SMS failed: ${smsSkipReason.slice(0, 100)}`)
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
  let emailActuallySent = false
  let emailFailReason: string | null = null

  if (contactEmail) {
    try {
      let resolvedUserId: string | null = null

      const { data: newUser, error: createErr } = await adminSupa.auth.admin.createUser({
        email: contactEmail,
        email_confirm: true,
      })

      if (createErr) {
        // User may already exist (e.g. repeat purchase, test run) — look them up
        console.warn(`[stripe-webhook] createUser failed for ${contactEmail}: ${createErr.message} — attempting lookup`)
        const { data: existingUsers } = await adminSupa.auth.admin.listUsers()
        const found = existingUsers?.users?.find((u) => u.email === contactEmail)
        if (found) {
          resolvedUserId = found.id
          console.log(`[stripe-webhook] Found existing auth user ${resolvedUserId} for ${contactEmail}`)
        } else {
          console.error(`[stripe-webhook] Could not resolve user for ${contactEmail}`)
          emailFailReason = `createUser failed and lookup found no user: ${createErr.message}`
        }
      } else if (newUser.user) {
        resolvedUserId = newUser.user.id
      }

      if (resolvedUserId) {
        const newUserId = resolvedUserId

        // Link in client_users (upsert to handle existing links)
        const { error: linkErr } = await adminSupa
          .from('client_users')
          .upsert({ user_id: newUserId, client_id, role: 'owner' }, { onConflict: 'user_id,client_id' })

        if (linkErr) console.error(`[stripe-webhook] client_users upsert failed: ${linkErr.message}`)

        // Update intake with user ID
        await adminSupa
          .from('intake_submissions')
          .update({ supabase_user_id: newUserId })
          .eq('id', intake_id)

        // Send welcome + password setup email via Resend (if key is configured)
        const resendKey = process.env.RESEND_API_KEY
        if (resendKey) {
          try {
            // Generate password setup link without sending Supabase's default email.
            // We extract the token_hash and build our own /auth/confirm URL so the
            // link stays on our domain — bypasses Supabase redirect-allowlist issues.
            const { data: linkData } = await adminSupa.auth.admin.generateLink({
              type: 'recovery',
              email: contactEmail,
            })
            const actionLink = linkData?.properties?.action_link ?? ''
            let setupUrl = `${appUrl}/dashboard`
            if (actionLink) {
              try {
                const parsed = new URL(actionLink)
                const tokenHash = parsed.searchParams.get('token') ?? parsed.searchParams.get('token_hash')
                if (tokenHash) {
                  setupUrl = `${appUrl}/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/dashboard`
                }
              } catch { setupUrl = `${appUrl}/login` }
            }

            const resend = new Resend(resendKey)
            // Use sandbox domain until custom domain is verified — swap 'from' to your domain after setup
            const fromAddress = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
            await resend.emails.send({
              from: fromAddress,
              to: contactEmail,
              subject: `${businessName} — your AI agent is live${twilioNumber ? ` (${twilioNumber})` : ''}`,
              html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin-bottom:4px">Welcome to unmissed.ai</h2>
  <p style="color:#555;margin-top:0">Your AI receptionist is now live.</p>

  ${twilioNumber ? `<p><strong>Your AI phone number:</strong> ${twilioNumber}</p>` : ''}

  <p><strong>Set up your dashboard password</strong></p>
  <a href="${setupUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-bottom:8px">
    Create my password →
  </a>
  <p style="font-size:12px;color:#888;margin-top:4px">This link expires in 24 hours.</p>
  <p style="margin-top:8px;font-size:14px">Or <a href="${appUrl}/login" style="color:#4f46e5">log in directly</a> if you already set a password.</p>

  ${telegramLink ? `<p><strong>Connect Telegram for instant call alerts:</strong><br><a href="${telegramLink}">${telegramLink}</a></p>` : ''}

  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:12px;color:#888">unmissed.ai — AI receptionist for service businesses</p>
</div>`,
            })
            emailActuallySent = true
            console.log(`[stripe-webhook] Welcome email sent via Resend to ${contactEmail}`)
          } catch (emailErr) {
            emailFailReason = String(emailErr)
            console.error(`[stripe-webhook] Resend email failed for ${contactEmail}: ${emailErr}`)
          }
        } else {
          // Fallback: Supabase default email (no custom branding)
          try {
            await adminSupa.auth.resetPasswordForEmail(contactEmail, {
              redirectTo: `${appUrl}/auth/callback?next=/dashboard`,
            })
            emailActuallySent = true
          } catch (emailErr) {
            emailFailReason = String(emailErr)
          }
        }

        console.log(`[stripe-webhook] Auth user resolved and password email sent to ${contactEmail}`)
        void notifyAdmin(adminBot, adminChat, `👤 Auth account linked, welcome email sent to ${contactEmail}`)
      } else if (emailFailReason) {
        void notifyAdmin(adminBot, adminChat, `⚠️ Auth/email step: user not resolved for ${contactEmail}`)
      }
    } catch (err) {
      emailFailReason = String(err)
      console.error(`[stripe-webhook] Auth user creation threw: ${err}`)
      void notifyAdmin(adminBot, adminChat, `❌ Auth/email step failed for ${businessName}: ${String(err).slice(0, 100)}`)
    }
  } else {
    emailFailReason = 'no contact email on intake'
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
      email_sent: emailActuallySent,
      email_skip_reason: emailActuallySent ? null : (emailFailReason ?? 'unknown'),
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
