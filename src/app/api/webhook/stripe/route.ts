/**
 * POST /api/webhook/stripe
 *
 * Handles Stripe checkout.session.completed events.
 * Runs the full activation chain:
 *   1. Buy Twilio number
 *   2. Update clients.twilio_number + status = 'active'
 *   3. Create Supabase auth user
 *   4. Insert client_users row
 *   5. Send password reset email
 *   6. Mark intake progress_status = 'activated'
 *   7. Telegram alert to admin
 *
 * Returns 200 on any outcome (to prevent Stripe retries on partial success).
 * Must be excluded from Next.js body parsing — reads raw body for sig verification.
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { sendAlert } from '@/lib/telegram'

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

  // ── Load intake for contact_email + area_code ──────────────────────────────
  const { data: intake } = await adminSupa
    .from('intake_submissions')
    .select('contact_email, intake_json')
    .eq('id', intake_id)
    .single()

  const contactEmail = intake?.contact_email ?? null
  const areaCode = (intake?.intake_json as Record<string, unknown> | null)?.area_code as string | null

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://unmissed-ai-production.up.railway.app'
  const accountSid = process.env.TWILIO_ACCOUNT_SID!
  const authToken = process.env.TWILIO_AUTH_TOKEN!
  const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

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

  // ── Step 2: Update clients row ─────────────────────────────────────────────
  try {
    const updatePayload: Record<string, unknown> = { status: 'active', updated_at: new Date().toISOString() }
    if (twilioNumber) updatePayload.twilio_number = twilioNumber

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

  // ── Step 7: Telegram alert to admin ────────────────────────────────────────
  try {
    const { data: adminClient } = await adminSupa
      .from('clients')
      .select('telegram_bot_token, telegram_chat_id')
      .eq('slug', 'hasan-sharif')
      .single()

    if (adminClient?.telegram_bot_token && adminClient?.telegram_chat_id) {
      const msg = twilioNumber
        ? `✅ ${businessName} activated — number ${twilioNumber}`
        : `✅ ${businessName} activated — number purchase failed, assign manually`
      await sendAlert(
        adminClient.telegram_bot_token as string,
        adminClient.telegram_chat_id as string,
        msg
      )
    }
  } catch (err) {
    console.error(`[stripe-webhook] Telegram alert threw: ${err}`)
  }

  console.log(`[stripe-webhook] Activation complete for slug=${client_slug}`)
  return new NextResponse('OK', { status: 200 })
}
