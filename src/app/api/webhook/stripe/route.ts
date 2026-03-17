/**
 * POST /api/webhook/stripe
 *
 * Handles Stripe checkout.session.completed events.
 * Runs the full activation chain:
 *   1.   Buy Twilio number
 *   1.1  Create Supabase auth user + client_users link
 *   1.2  Generate recovery link (setupUrl for SMS)
 *   1.3  Send welcome email (separate recovery token)
 *   1.5  Send onboarding SMS with setupUrl + Telegram link
 *   2.   Update clients row (status=active, twilio_number, telegram_registration_token)
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
import { PROVINCE_AREA_CODES } from '@/lib/phone'
import { getNicheMinuteLimit } from '@/lib/niche-config'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })

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

  // ── invoice.payment_succeeded (subscription renewal) ──────────────────────
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as Stripe.Invoice
    const parentSub = invoice.parent?.subscription_details?.subscription
    const subId = typeof parentSub === 'string' ? parentSub : (parentSub as Stripe.Subscription | undefined)?.id ?? null

    // Only handle subscription renewals — skip initial trial invoice
    if (subId && invoice.billing_reason === 'subscription_cycle') {
      const { data: cl } = await adminSupa
        .from('clients')
        .select('id, slug, business_name, niche')
        .eq('stripe_subscription_id', subId)
        .single()

      if (cl) {
        const sub = await stripe.subscriptions.retrieve(subId)
        await adminSupa.from('clients').update({
          subscription_status: 'active',
          monthly_minute_limit: 100,
          minutes_used_this_month: 0,
          seconds_used_this_month: 0,
          grace_period_end: null,
          subscription_current_period_end: new Date(sub.items.data[0]?.current_period_end * 1000).toISOString(),
        }).eq('id', cl.id)

        console.log(`[stripe-webhook] Subscription renewed for ${cl.slug} — 100 min/mo, reset usage`)

        // Telegram notification
        try {
          const { data: adminCl } = await adminSupa
            .from('clients')
            .select('telegram_bot_token, telegram_chat_id')
            .eq('slug', 'hasan-sharif')
            .single()
          if (adminCl?.telegram_bot_token && adminCl?.telegram_chat_id) {
            await sendAlert(
              adminCl.telegram_bot_token as string,
              adminCl.telegram_chat_id as string,
              `💰 Subscription renewed: ${cl.business_name} (${cl.slug})\n` +
              `Plan: $10/mo — 100 min\n` +
              `Next renewal: ${new Date((sub.items.data[0]?.current_period_end ?? 0) * 1000).toLocaleDateString()}`
            )
          }
        } catch (tgErr) {
          console.error('[stripe-webhook] Telegram alert failed:', tgErr)
        }
      }
    }

    return new NextResponse('OK', { status: 200 })
  }

  // ── invoice.payment_failed ───────────────────────────────────────────────
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice
    const parentSub = invoice.parent?.subscription_details?.subscription
    const subId = typeof parentSub === 'string' ? parentSub : (parentSub as Stripe.Subscription | undefined)?.id ?? null

    if (subId) {
      const { data: cl } = await adminSupa
        .from('clients')
        .select('id, slug, business_name')
        .eq('stripe_subscription_id', subId)
        .single()

      if (cl) {
        const graceEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        await adminSupa.from('clients').update({
          subscription_status: 'past_due',
          grace_period_end: graceEnd,
        }).eq('id', cl.id)

        console.log(`[stripe-webhook] Payment failed for ${cl.slug} — grace period until ${graceEnd}`)

        try {
          const { data: adminCl } = await adminSupa
            .from('clients')
            .select('telegram_bot_token, telegram_chat_id')
            .eq('slug', 'hasan-sharif')
            .single()
          if (adminCl?.telegram_bot_token && adminCl?.telegram_chat_id) {
            await sendAlert(
              adminCl.telegram_bot_token as string,
              adminCl.telegram_chat_id as string,
              `⚠️ Payment failed: ${cl.business_name} (${cl.slug})\n` +
              `Grace period: 7 days (until ${new Date(graceEnd).toLocaleDateString()})\n` +
              `Agent will pause if not resolved.`
            )
          }
        } catch (tgErr) {
          console.error('[stripe-webhook] Telegram alert failed:', tgErr)
        }
      }
    }

    return new NextResponse('OK', { status: 200 })
  }

  // ── customer.subscription.deleted ────────────────────────────────────────
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    const { data: cl } = await adminSupa
      .from('clients')
      .select('id, slug, business_name')
      .eq('stripe_subscription_id', sub.id)
      .single()

    if (cl) {
      await adminSupa.from('clients').update({
        subscription_status: 'canceled',
        status: 'paused',
      }).eq('id', cl.id)

      console.log(`[stripe-webhook] Subscription canceled for ${cl.slug} — agent paused`)

      try {
        const { data: adminCl } = await adminSupa
          .from('clients')
          .select('telegram_bot_token, telegram_chat_id')
          .eq('slug', 'hasan-sharif')
          .single()
        if (adminCl?.telegram_bot_token && adminCl?.telegram_chat_id) {
          await sendAlert(
            adminCl.telegram_bot_token as string,
            adminCl.telegram_chat_id as string,
            `🚫 Subscription canceled: ${cl.business_name} (${cl.slug})\n` +
            `Agent has been paused.`
          )
        }
      } catch (tgErr) {
        console.error('[stripe-webhook] Telegram alert failed:', tgErr)
      }
    }

    return new NextResponse('OK', { status: 200 })
  }

  if (event.type !== 'checkout.session.completed') {
    return new NextResponse('OK', { status: 200 })
  }

  const session = event.data.object as Stripe.Checkout.Session

  // ── Minute reload path ─────────────────────────────────────────────
  if (session.metadata?.type === 'minute_reload') {
    const reloadMinutes = parseInt(session.metadata?.minutes ?? '0', 10)
    const reloadClientId = session.metadata?.client_id
    const reloadSlug = session.metadata?.client_slug ?? 'unknown'

    if (reloadMinutes > 0 && reloadClientId) {
      const { data: currentClient } = await adminSupa
        .from('clients')
        .select('bonus_minutes, business_name')
        .eq('id', reloadClientId)
        .single()

      const currentBonus = (currentClient?.bonus_minutes as number) ?? 0
      await adminSupa
        .from('clients')
        .update({ bonus_minutes: currentBonus + reloadMinutes })
        .eq('id', reloadClientId)

      console.log(`[stripe-webhook] Minute reload: +${reloadMinutes} min for slug=${reloadSlug} (total bonus: ${currentBonus + reloadMinutes})`)

      const { data: adminCl } = await adminSupa
        .from('clients')
        .select('telegram_bot_token, telegram_chat_id')
        .eq('slug', 'hasan-sharif')
        .single()
      if (adminCl?.telegram_bot_token && adminCl?.telegram_chat_id) {
        void sendAlert(
          adminCl.telegram_bot_token as string,
          adminCl.telegram_chat_id as string,
          `\u{1F4B0} <b>${currentClient?.business_name ?? reloadSlug}</b> reloaded ${reloadMinutes} min ($${reloadMinutes / 10} CAD)\nNew bonus total: ${currentBonus + reloadMinutes} min`
        )
      }
    }

    return new NextResponse('OK', { status: 200 })
  }

  // ── Advisor credits topup path ─────────────────────────────────────
  if (session.metadata?.product === 'advisor_credits') {
    const userId = session.metadata.user_id
    const creditsCents = parseInt(session.metadata.credits_cents, 10)
    const sessionId = session.id

    if (!userId || isNaN(creditsCents)) {
      console.error('[stripe-webhook] Advisor topup: missing metadata on session:', sessionId)
      return new NextResponse('OK', { status: 200 })
    }

    // Idempotency: check if already processed
    const { data: existing } = await adminSupa
      .from('ai_transactions')
      .select('id')
      .eq('stripe_session_id', sessionId)
      .single()

    if (!existing) {
      await adminSupa.rpc('add_advisor_credits', {
        p_user_id: userId,
        p_amount_cents: creditsCents,
      })
      await adminSupa.from('ai_transactions').insert({
        user_id: userId,
        type: 'topup',
        amount_cents: creditsCents,
        stripe_session_id: sessionId,
        note: `Stripe topup — ${session.metadata.pack_id ?? 'unknown'}`,
      })
      console.log(`[stripe-webhook] Advisor credits: +${creditsCents}¢ for user=${userId}`)
    } else {
      console.log(`[stripe-webhook] Advisor topup already processed: session=${sessionId}`)
    }

    return new NextResponse('OK', { status: 200 })
  }

  // ── Activation path ────────────────────────────────────────────────
  const { intake_id, client_id, client_slug, reserved_number: reservedNumberMeta } = session.metadata ?? {}
  const reservedNumber = reservedNumberMeta || null

  if (!intake_id || !client_id || !client_slug) {
    console.error('[stripe-webhook] Missing metadata on session:', session.id)
    return new NextResponse('OK', { status: 200 })
  }

  console.log(`[stripe-webhook] Processing activation for slug=${client_slug} intake=${intake_id}`)

  // ── Guard: skip if already active ─────────────────────────────────────────
  const { data: existingClient } = await adminSupa
    .from('clients')
    .select('status, business_name, niche')
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

  // ── Step 1: Assign Twilio number (inventory or buy new) ───────────────────
  const voiceUrl   = `${appUrl}/api/webhook/${client_slug}/inbound`
  const fallbackUrl = `${appUrl}/api/webhook/${client_slug}/fallback`

  if (reservedNumber) {
    // ── Inventory path: configure existing number's webhooks ─────────────────
    try {
      const { data: invRow } = await adminSupa
        .from('number_inventory')
        .select('twilio_sid')
        .eq('phone_number', reservedNumber)
        .single()

      if (!invRow) {
        console.error(`[stripe-webhook] Inventory number ${reservedNumber} not found in DB for slug=${client_slug}`)
        void notifyAdmin(adminBot, adminChat, `⚠️ Inventory number ${reservedNumber} missing from DB — manual fix needed`)
      } else {
        const patchUrl  = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${invRow.twilio_sid}.json`
        const patchBody = new URLSearchParams({
          VoiceUrl:            voiceUrl,
          VoiceMethod:         'POST',
          VoiceFallbackUrl:    fallbackUrl,
          VoiceFallbackMethod: 'POST',
        })
        const patchRes = await fetch(patchUrl, {
          method:  'POST',
          headers: { Authorization: `Basic ${twilioAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body:    patchBody.toString(),
        })
        if (patchRes.ok) {
          console.log(`[stripe-webhook] Inventory number ${reservedNumber} reconfigured for slug=${client_slug}`)
          void notifyAdmin(adminBot, adminChat, `📞 Inventory number configured: <b>${reservedNumber}</b> for ${businessName}`)
        } else {
          const errText = await patchRes.text()
          console.error(`[stripe-webhook] Twilio PATCH failed for ${reservedNumber}: ${errText}`)
          void notifyAdmin(adminBot, adminChat, `⚠️ Twilio PATCH failed for ${reservedNumber} — fix VoiceUrl manually`)
        }
      }

      // Mark number as assigned regardless of PATCH result (client paid)
      await adminSupa
        .from('number_inventory')
        .update({
          status: 'assigned',
          assigned_client_id: client_id,
          reserved_intake_id: null,
          reserved_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('phone_number', reservedNumber)

      twilioNumber = reservedNumber
    } catch (err) {
      console.error(`[stripe-webhook] Inventory path threw for ${reservedNumber}: ${err}`)
      void notifyAdmin(adminBot, adminChat, `⚠️ Inventory path threw: ${String(err).slice(0, 100)}`)
      twilioNumber = reservedNumber // still assign — client paid
    }
  } else {
    // ── Fresh path: search + buy a new Twilio number ──────────────────────────
    try {
      const buyUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`

      const province = (intakeJson.province as string | null) || null
      const isCanadian = !!(province && province in PROVINCE_AREA_CODES)
      const searchCountry = isCanadian ? 'CA' : 'US'
      const searchBase = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/AvailablePhoneNumbers/${searchCountry}/Local.json`

      let availableNumber: string | null = null

      if (isCanadian && province) {
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
        if (!availableNumber) {
          console.warn(`[stripe-webhook] No number found for province=${province}, trying any CA number`)
          const retryRes = await fetch(`${searchBase}?Limit=1`, { headers: { Authorization: `Basic ${twilioAuth}` } })
          if (retryRes.ok) {
            const retryData = await retryRes.json() as { available_phone_numbers: { phone_number: string }[] }
            availableNumber = retryData.available_phone_numbers?.[0]?.phone_number ?? null
          }
        }
      } else {
        const searchUrl = areaCode ? `${searchBase}?AreaCode=${areaCode}&Limit=1` : `${searchBase}?Limit=1`
        const searchRes = await fetch(searchUrl, { headers: { Authorization: `Basic ${twilioAuth}` } })
        if (searchRes.ok) {
          const searchData = await searchRes.json() as { available_phone_numbers: { phone_number: string }[] }
          availableNumber = searchData.available_phone_numbers?.[0]?.phone_number ?? null
        }
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
  }

  // ── Steps 3-5 (moved before SMS): Create auth user + generate setup URL ────
  // Auth user creation + recovery link must happen BEFORE SMS so we can include
  // the password setup URL in the SMS body instead of "check your email".
  let emailActuallySent = false
  let emailFailReason: string | null = null
  let setupUrl = `${appUrl}/login`

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
        const { data: existingUsers } = await adminSupa.auth.admin.listUsers({ perPage: 1000 })
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

        // Generate recovery link for SMS setup URL
        try {
          const { data: smsLinkData } = await adminSupa.auth.admin.generateLink({
            type: 'recovery',
            email: contactEmail,
          })
          const smsActionLink = smsLinkData?.properties?.action_link ?? ''
          if (smsActionLink) {
            try {
              const parsed = new URL(smsActionLink)
              const tokenHash = parsed.searchParams.get('token') ?? parsed.searchParams.get('token_hash')
              if (tokenHash) {
                setupUrl = `${appUrl}/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/dashboard`
              }
            } catch { /* use fallback login URL */ }
          }
        } catch (linkErr2) {
          console.warn(`[stripe-webhook] SMS recovery link generation failed: ${linkErr2} — using fallback login URL`)
        }

        // Send welcome + password setup email via Resend (if key is configured)
        // Generates a SECOND recovery token (separate from the SMS one) so both links work independently.
        const resendKey = process.env.RESEND_API_KEY
        if (resendKey) {
          try {
            const { data: linkData } = await adminSupa.auth.admin.generateLink({
              type: 'recovery',
              email: contactEmail,
            })
            const actionLink = linkData?.properties?.action_link ?? ''
            let emailSetupUrl = `${appUrl}/dashboard`
            if (actionLink) {
              try {
                const parsed = new URL(actionLink)
                const tokenHash = parsed.searchParams.get('token') ?? parsed.searchParams.get('token_hash')
                if (tokenHash) {
                  emailSetupUrl = `${appUrl}/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/dashboard`
                }
              } catch { emailSetupUrl = `${appUrl}/login` }
            }

            const resend = new Resend(resendKey)
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
  <a href="${emailSetupUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-bottom:8px">
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

  // ── Step 1.5: Onboarding SMS from new number to client's callbackPhone ──────
  // SMS comes from their new AI line — strong brand impression on first contact.
  // Body includes setup URL + Telegram link so they can set up immediately.
  let smsSent = false
  let smsSkipReason: string | null = null

  if (twilioNumber && callbackPhone) {
    try {
      const smsBody = new URLSearchParams({
        From: twilioNumber,
        To: callbackPhone,
        Body: `Your AI agent is live!\n\nSet up your dashboard:\n${setupUrl}\n\nYour AI number: ${twilioNumber}\n\nConnect Telegram for instant call alerts:\n${telegramLink}\n\nReply STOP to opt out.`,
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
      setup_complete: false,
      updated_at: new Date().toISOString(),
      telegram_registration_token: telegramRegToken,
      sms_enabled: callerAutoText,
      bonus_minutes: 50,
      monthly_minute_limit: getNicheMinuteLimit((existingClient?.niche as string) || null),
      contact_email: contactEmail,
    }
    if (twilioNumber) updatePayload.twilio_number = twilioNumber
    if (callerAutoTextMessage) updatePayload.sms_template = callerAutoTextMessage

    await adminSupa.from('clients').update(updatePayload).eq('id', client_id)
    console.log(`[stripe-webhook] clients.status → active for slug=${client_slug}`)
  } catch (err) {
    console.error(`[stripe-webhook] clients update threw: ${err}`)
  }

  // ── Store subscription info ───────────────────────────────────────────────
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription : (session.subscription as { id: string })?.id
  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId)
      await adminSupa.from('clients').update({
        stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
        stripe_subscription_id: subscriptionId,
        subscription_status: sub.status,
        subscription_current_period_end: new Date((sub.items.data[0]?.current_period_end ?? sub.trial_end ?? 0) * 1000).toISOString(),
      }).eq('id', client_id)
      console.log(`[stripe-webhook] Stored subscription ${subscriptionId} status=${sub.status} for client=${client_id}`)
    } catch (subErr) {
      console.error('[stripe-webhook] Failed to store subscription info:', subErr)
      // Non-fatal — activation already succeeded
    }
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
