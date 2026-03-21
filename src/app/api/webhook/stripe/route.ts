/**
 * POST /api/webhook/stripe
 *
 * Handles Stripe checkout.session.completed events.
 * Delegates the full activation chain to activateClient() in @/lib/activate-client.
 *
 * Also handles:
 *   - invoice.payment_succeeded (subscription renewal)
 *   - invoice.payment_failed (grace period)
 *   - customer.subscription.deleted (pause agent)
 *   - checkout.session.completed with metadata.type=minute_reload
 *   - checkout.session.completed with metadata.product=advisor_credits
 *
 * Returns 200 on any outcome (to prevent Stripe retries on partial success).
 * Must be excluded from Next.js body parsing — reads raw body for sig verification.
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { sendAlert } from '@/lib/telegram'
import { activateClient } from '@/lib/activate-client'
import { DEFAULT_MINUTE_LIMIT } from '@/lib/niche-config'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })

/** All plans include DEFAULT_MINUTE_LIMIT min/mo. Future tiers (Growth/Pro) not yet purchasable. */
const BASE_MINUTE_LIMIT = DEFAULT_MINUTE_LIMIT

function getTierLabel(): string {
  return 'Starter ($30)'
}

/** Extract discount/coupon info from a Stripe subscription for Supabase sync. */
function extractDiscountInfo(sub: Stripe.Subscription): {
  discountName: string | null
  effectiveRate: number | null
} {
  const firstDiscount = sub.discounts?.[0]
  if (!firstDiscount || typeof firstDiscount === 'string') return { discountName: null, effectiveRate: null }
  const coupon = typeof firstDiscount.source?.coupon === 'object' ? firstDiscount.source.coupon : null
  if (!coupon) return { discountName: null, effectiveRate: null }

  const name = coupon.name ?? coupon.id

  const baseAmount = sub.items.data[0]?.price?.unit_amount ?? 3000
  let effectiveAmount = baseAmount
  if (coupon.amount_off) effectiveAmount = baseAmount - coupon.amount_off
  else if (coupon.percent_off) effectiveAmount = Math.round(baseAmount * (1 - coupon.percent_off / 100))

  return {
    discountName: name,
    effectiveRate: Math.round(effectiveAmount / 100),
  }
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
        const tier = sub.metadata?.tier ?? null
        const minuteLimit = BASE_MINUTE_LIMIT
        const tierLabel = getTierLabel()
        const { discountName, effectiveRate } = extractDiscountInfo(sub)

        await adminSupa.from('clients').update({
          subscription_status: 'active',
          monthly_minute_limit: minuteLimit,
          minutes_used_this_month: 0,
          seconds_used_this_month: 0,
          grace_period_end: null,
          subscription_current_period_end: new Date(sub.items.data[0]?.current_period_end * 1000).toISOString(),
          stripe_discount_name: discountName,
          effective_monthly_rate: effectiveRate,
        }).eq('id', cl.id)

        console.log(`[stripe-webhook] Subscription renewed for ${cl.slug} — ${tierLabel} ${minuteLimit} min/mo, reset usage`)

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
              `Plan: ${tierLabel} — ${minuteLimit} min\n` +
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

  // ── customer.subscription.updated (discount changes, plan changes) ─────
  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription
    const { data: cl } = await adminSupa
      .from('clients')
      .select('id, slug')
      .eq('stripe_subscription_id', sub.id)
      .single()

    if (cl) {
      const { discountName, effectiveRate } = extractDiscountInfo(sub)
      await adminSupa.from('clients').update({
        subscription_status: sub.status,
        stripe_discount_name: discountName,
        effective_monthly_rate: effectiveRate,
      }).eq('id', cl.id)
      console.log(`[stripe-webhook] Subscription updated: ${cl.slug} discount=${discountName} rate=$${effectiveRate}`)
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
          `\u{1F4B0} <b>${currentClient?.business_name ?? reloadSlug}</b> reloaded ${reloadMinutes} min ($${session.amount_total ? (session.amount_total / 100).toFixed(0) : '10'} CAD)\nNew bonus total: ${currentBonus + reloadMinutes} min`
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

  // ── Guard: skip if already active with a subscription ───────────────────────
  const { data: existingClient } = await adminSupa
    .from('clients')
    .select('status, business_name, niche, stripe_subscription_id, trial_expires_at, trial_converted')
    .eq('id', client_id)
    .single()

  if (existingClient?.status === 'active' && existingClient?.stripe_subscription_id) {
    console.log(`[stripe-webhook] slug=${client_slug} already active with subscription — skipping`)
    return new NextResponse('OK', { status: 200 })
  }

  // ── Determine activation mode ──────────────────────────────────────────────
  const isTrialConvert = existingClient?.trial_expires_at && !existingClient?.trial_converted
  const mode = isTrialConvert ? 'trial_convert' : 'stripe'

  console.log(`[stripe-webhook] Activation mode=${mode} for slug=${client_slug}`)

  // ── Run activation chain ───────────────────────────────────────────────────
  const result = await activateClient({
    mode,
    intakeId: intake_id,
    clientId: client_id,
    clientSlug: client_slug,
    reservedNumber,
    stripeSession: session,
  })

  if (!result.success) {
    console.error(`[stripe-webhook] activateClient failed for slug=${client_slug}: ${result.error}`)
  }

  // ── Set tier-based minute limit (overrides niche default from activateClient) ─
  const sessionTier = session.metadata?.tier ?? null
  if (sessionTier) {
    const tierMinutes = BASE_MINUTE_LIMIT
    await adminSupa.from('clients').update({
      monthly_minute_limit: tierMinutes,
    }).eq('id', client_id)
    console.log(`[stripe-webhook] Set tier=${sessionTier} minute_limit=${tierMinutes} for slug=${client_slug}`)
  }

  // ── Store subscription info (Stripe-specific — session only available here) ─
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription : (session.subscription as { id: string })?.id
  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId)
      const { discountName, effectiveRate } = extractDiscountInfo(sub)
      await adminSupa.from('clients').update({
        stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
        stripe_subscription_id: subscriptionId,
        subscription_status: sub.status,
        subscription_current_period_end: new Date((sub.items.data[0]?.current_period_end ?? sub.trial_end ?? 0) * 1000).toISOString(),
        stripe_discount_name: discountName,
        effective_monthly_rate: effectiveRate,
      }).eq('id', client_id)
      console.log(`[stripe-webhook] Stored subscription ${subscriptionId} status=${sub.status} for client=${client_id}`)
    } catch (subErr) {
      console.error('[stripe-webhook] Failed to store subscription info:', subErr)
      // Non-fatal — activation already succeeded
    }
  }

  console.log(`[stripe-webhook] Activation complete for slug=${client_slug}`)
  return new NextResponse('OK', { status: 200 })
}
