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
import { sendAlert } from '@/lib/telegram'
import { activateClient } from '@/lib/activate-client'
import { getEffectiveMinuteLimit } from '@/lib/plan-entitlements'
import { createServiceClient } from '@/lib/supabase/server'
import { notifySystemFailure } from '@/lib/admin-alerts'
import { syncClientTools } from '@/lib/sync-client-tools'
import { ensureTwilioProvisioned } from '@/lib/ensure-twilio-provisioned'
import { PLANS } from '@/lib/pricing'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })
}

function getTierLabel(selectedPlan: string | null): string {
  if (!selectedPlan) return 'Unknown Plan'
  const plan = PLANS.find(p => p.id === selectedPlan)
  if (!plan) return 'Unknown Plan'
  return `${plan.name} ($${plan.monthly})`
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

export async function POST(req: NextRequest) {
  const adminSupa = createServiceClient()
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err)
    return new NextResponse('Invalid signature', { status: 400 })
  }

  // S13f: Event-level idempotency — skip if already processed
  const { data: inserted, error: idempErr } = await adminSupa
    .from('stripe_events')
    .upsert(
      { event_id: event.id, event_type: event.type },
      { onConflict: 'event_id', ignoreDuplicates: true }
    )
    .select('event_id')

  if (idempErr) {
    // Fail open: duplicate processing beats missing an activation
    console.error(`[stripe-webhook] Idempotency check failed: ${idempErr.message} — proceeding anyway`)
  } else if (!inserted || inserted.length === 0) {
    console.log(`[stripe-webhook] Duplicate event skipped: ${event.id} (${event.type})`)
    return new NextResponse('OK', { status: 200 })
  }

  // ── invoice.paid (clears past_due after successful retry) ────────────────
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as Stripe.Invoice
    const parentSub = invoice.parent?.subscription_details?.subscription
    const subId = typeof parentSub === 'string' ? parentSub : (parentSub as Stripe.Subscription | undefined)?.id ?? null

    // Only clear past_due — subscription_cycle renewals handled in payment_succeeded
    if (subId && invoice.billing_reason !== 'subscription_cycle') {
      const { data: cl } = await adminSupa
        .from('clients')
        .select('id, slug, subscription_status')
        .eq('stripe_subscription_id', subId)
        .single()

      if (cl?.subscription_status === 'past_due') {
        await adminSupa.from('clients').update({
          subscription_status: 'active',
          grace_period_end: null,
        }).eq('id', cl.id)
        console.log(`[stripe-webhook] Past-due cleared for ${cl.slug} — invoice paid`)
      }
    }

    return new NextResponse('OK', { status: 200 })
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
        .select('id, slug, business_name, niche, selected_plan')
        .eq('stripe_subscription_id', subId)
        .single()

      if (cl) {
        const sub = await getStripe().subscriptions.retrieve(subId)
        const minuteLimit = getEffectiveMinuteLimit(cl.selected_plan, 'active', cl.niche)
        const tierLabel = getTierLabel(cl.selected_plan ?? null)
        const { discountName, effectiveRate } = extractDiscountInfo(sub)

        await adminSupa.from('clients').update({
          subscription_status: 'active',
          monthly_minute_limit: minuteLimit,
          minutes_used_this_month: 0,
          seconds_used_this_month: 0,
          grace_period_end: null,
          // G7: Reset usage alert timestamps so they fire again in the new cycle
          minute_warning_80_sent_at: null,
          minute_warning_100_sent_at: null,
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
            await adminSupa.from('notification_logs').insert({
              client_id: cl.id,
              channel: 'telegram',
              recipient: adminCl.telegram_chat_id,
              content: `Subscription renewed: ${cl.business_name} (${cl.slug})`,
              status: 'sent',
            })
          }
        } catch (tgErr) {
          console.error('[stripe-webhook] Subscription renewed Telegram alert failed:', tgErr)
          try {
            await adminSupa.from('notification_logs').insert({
              client_id: cl.id,
              channel: 'telegram',
              recipient: 'admin',
              content: `Subscription renewed: ${cl.business_name} (${cl.slug})`,
              status: 'failed',
              error: String(tgErr).slice(0, 1000),
            })
          } catch { /* never let logging break the webhook */ }
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

        // ── Customer-facing payment-failed email (grace period notice) ────────
        const { data: clEmail } = await adminSupa
          .from('clients')
          .select('contact_email')
          .eq('id', cl.id)
          .single()
        if (clEmail?.contact_email) {
          const { sendBrandedEmail } = await import('@/lib/email/send')
          const { APP_URL } = await import('@/lib/app-url')
          const { BRAND_NAME } = await import('@/lib/brand')
          const graceDate = new Date(graceEnd).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })
          const billingUrl = `${APP_URL}/dashboard/billing`
          const result = await sendBrandedEmail({
            to: clEmail.contact_email as string,
            clientId: cl.id,
            clientSlug: cl.slug as string,
            purpose: 'system',
            tag: 'payment_failed_grace',
            reason: `Your ${BRAND_NAME} subscription payment didn't go through.`,
            subject: `Action needed — your ${BRAND_NAME} payment failed`,
            html: `<h2 style="margin-bottom:4px">Your payment didn't go through</h2>
<p>Hi${cl.business_name ? ` ${cl.business_name}` : ''},</p>
<p>We tried to process your ${BRAND_NAME} subscription renewal and the card was declined.</p>
<p><strong>Your agent will keep answering calls until ${graceDate}</strong> (7-day grace period). After that, your agent pauses and you'll start missing calls again.</p>
<a href="${billingUrl}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">Update payment method</a>
<p style="font-size:14px;color:#555">Common fixes: card expired, new billing address, or your bank flagged the charge. Updating takes 30 seconds.</p>`,
          })
          if (result.ok) {
            console.log(`[stripe-webhook] Payment-failed email sent to ${clEmail.contact_email} (id=${result.id})`)
          } else {
            console.error(`[stripe-webhook] Payment-failed email failed: ${result.error}`)
          }
        }

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
            await adminSupa.from('notification_logs').insert({
              client_id: cl.id,
              channel: 'telegram',
              recipient: adminCl.telegram_chat_id,
              content: `Payment failed: ${cl.business_name} (${cl.slug})`,
              status: 'sent',
            })
          }
        } catch (tgErr) {
          console.error('[stripe-webhook] Payment failed Telegram alert failed:', tgErr)
          try {
            await adminSupa.from('notification_logs').insert({
              client_id: cl.id,
              channel: 'telegram',
              recipient: 'admin',
              content: `Payment failed: ${cl.business_name} (${cl.slug})`,
              status: 'failed',
              error: String(tgErr).slice(0, 1000),
            })
          } catch { /* never let logging break the webhook */ }
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
          await adminSupa.from('notification_logs').insert({
            client_id: cl.id,
            channel: 'telegram',
            recipient: adminCl.telegram_chat_id,
            content: `Subscription canceled: ${cl.business_name} (${cl.slug})`,
            status: 'sent',
          })
        }
      } catch (tgErr) {
        console.error('[stripe-webhook] Subscription canceled Telegram alert failed:', tgErr)
        try {
          await adminSupa.from('notification_logs').insert({
            client_id: cl.id,
            channel: 'telegram',
            recipient: 'admin',
            content: `Subscription canceled: ${cl.business_name} (${cl.slug})`,
            status: 'failed',
            error: String(tgErr).slice(0, 1000),
          })
        } catch { /* never let logging break the webhook */ }
      }
    }

    return new NextResponse('OK', { status: 200 })
  }

  // ── customer.subscription.updated (discount changes, plan changes, downgrades) ─────
  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription
    const { data: cl } = await adminSupa
      .from('clients')
      .select('id, slug, selected_plan, niche')
      .eq('stripe_subscription_id', sub.id)
      .single()

    if (cl) {
      const { discountName, effectiveRate } = extractDiscountInfo(sub)
      const updatePayload: Record<string, unknown> = {
        subscription_status: sub.status,
        stripe_discount_name: discountName,
        effective_monthly_rate: effectiveRate,
        subscription_current_period_end: sub.items.data[0]?.current_period_end
          ? new Date(sub.items.data[0].current_period_end * 1000).toISOString()
          : null,
      }

      // Detect plan change via price → product mapping
      const currentPriceId = sub.items.data[0]?.price?.id
      if (currentPriceId) {
        const matchedPlan = PLANS.find(
          p => p.stripeMonthlyPriceId === currentPriceId || p.stripeAnnualPriceId === currentPriceId
        )
        if (matchedPlan && matchedPlan.id !== cl.selected_plan) {
          updatePayload.selected_plan = matchedPlan.id
          updatePayload.monthly_minute_limit = getEffectiveMinuteLimit(matchedPlan.id, sub.status, cl.niche ?? null)
          console.log(`[stripe-webhook] Plan changed: ${cl.slug} ${cl.selected_plan} → ${matchedPlan.id}`)

          // Rebuild tools for new plan entitlements
          try {
            await syncClientTools(adminSupa, cl.id)
            console.log(`[stripe-webhook] Tools rebuilt for ${cl.slug} after plan change to ${matchedPlan.id}`)
          } catch (toolErr) {
            console.error(`[stripe-webhook] syncClientTools failed after plan change for ${cl.slug}:`, toolErr)
          }
        }
      }

      await adminSupa.from('clients').update(updatePayload).eq('id', cl.id)

      // Track scheduled cancellation (cancel_at column — added in Phase 6 migration)
      try {
        const cancelAt = sub.cancel_at_period_end && sub.cancel_at
          ? new Date(sub.cancel_at * 1000).toISOString()
          : null
        await adminSupa.from('clients').update({ cancel_at: cancelAt }).eq('id', cl.id)
        if (cancelAt) {
          console.log(`[stripe-webhook] Subscription scheduled to cancel: ${cl.slug} on ${cancelAt}`)
        }
      } catch {
        // cancel_at column may not exist yet — non-fatal
      }
      console.log(`[stripe-webhook] Subscription updated: ${cl.slug} status=${sub.status} discount=${discountName} rate=$${effectiveRate}`)
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
        .update({
          bonus_minutes: currentBonus + reloadMinutes,
          // G7: Reset 100% warning since user is now below limit again
          minute_warning_100_sent_at: null,
        })
        .eq('id', reloadClientId)

      console.log(`[stripe-webhook] Minute reload: +${reloadMinutes} min for slug=${reloadSlug} (total bonus: ${currentBonus + reloadMinutes})`)

      const { data: adminCl } = await adminSupa
        .from('clients')
        .select('telegram_bot_token, telegram_chat_id')
        .eq('slug', 'hasan-sharif')
        .single()
      if (adminCl?.telegram_bot_token && adminCl?.telegram_chat_id) {
        try {
          await sendAlert(
            adminCl.telegram_bot_token as string,
            adminCl.telegram_chat_id as string,
            `\u{1F4B0} <b>${currentClient?.business_name ?? reloadSlug}</b> reloaded ${reloadMinutes} min ($${session.amount_total ? (session.amount_total / 100).toFixed(0) : '10'} CAD)\nNew bonus total: ${currentBonus + reloadMinutes} min`
          )
          await adminSupa.from('notification_logs').insert({
            client_id: reloadClientId,
            channel: 'telegram',
            recipient: adminCl.telegram_chat_id,
            content: `Minute reload: ${currentClient?.business_name ?? reloadSlug} +${reloadMinutes} min`,
            status: 'sent',
          })
        } catch (tgErr) {
          console.error('[stripe-webhook] Minute reload Telegram alert failed:', tgErr)
          try {
            await adminSupa.from('notification_logs').insert({
              client_id: reloadClientId,
              channel: 'telegram',
              recipient: 'admin',
              content: `Minute reload: ${currentClient?.business_name ?? reloadSlug} +${reloadMinutes} min`,
              status: 'failed',
              error: String(tgErr).slice(0, 1000),
            })
          } catch { /* never let logging break the webhook */ }
        }
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

  // ── Trial-to-paid upgrade path ─────────────────────────────────────
  // Upgrade route sends { clientId, planId, billing } — no intake_id or client_slug
  if (session.metadata?.clientId && session.metadata?.planId && !session.metadata?.intake_id) {
    const upgradeClientId = session.metadata.clientId
    const upgradePlanId = session.metadata.planId

    const { data: cl } = await adminSupa
      .from('clients')
      .select('id, slug, business_name, niche')
      .eq('id', upgradeClientId)
      .maybeSingle()

    if (!cl) {
      console.error(`[stripe-webhook] Upgrade: client not found clientId=${upgradeClientId}`)
      return new NextResponse('OK', { status: 200 })
    }

    const updatePayload: Record<string, unknown> = {
      subscription_status: 'active',
      trial_converted: true,
      selected_plan: upgradePlanId,
      stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
    }

    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription : (session.subscription as { id: string } | null)?.id

    if (subscriptionId) {
      try {
        const sub = await getStripe().subscriptions.retrieve(subscriptionId)
        const { discountName, effectiveRate } = extractDiscountInfo(sub)
        updatePayload.stripe_subscription_id = subscriptionId
        updatePayload.subscription_current_period_end = new Date(
          (sub.items.data[0]?.current_period_end ?? sub.trial_end ?? 0) * 1000
        ).toISOString()
        updatePayload.stripe_discount_name = discountName
        updatePayload.effective_monthly_rate = effectiveRate
        // Minute limit from plan (canonical) with niche fallback
        updatePayload.monthly_minute_limit = getEffectiveMinuteLimit(upgradePlanId, 'active', cl.niche ?? null)
      } catch (subErr) {
        console.error('[stripe-webhook] Upgrade: failed to retrieve subscription:', subErr)
      }
    }

    await adminSupa.from('clients').update(updatePayload).eq('id', upgradeClientId)
    console.log(`[stripe-webhook] Trial upgrade complete: ${cl.slug} plan=${upgradePlanId}`)

    // Phase 4: Rebuild tools with new plan entitlements (e.g. Lite→Pro unlocks booking/transfer)
    try {
      await syncClientTools(adminSupa, upgradeClientId)
      console.log(`[stripe-webhook] Tools rebuilt for ${cl.slug} after plan upgrade to ${upgradePlanId}`)
    } catch (toolErr) {
      console.error(`[stripe-webhook] syncClientTools failed after upgrade for ${cl.slug}:`, toolErr)
      // Non-fatal — tools will be rebuilt on next settings save or sync-agent call
    }

    // ── Provision Twilio number if not yet assigned ─────────────────────────────
    // Trial users have no number. Dashboard upgrades skip activateClient(), so
    // we provision here. ensureTwilioProvisioned() is idempotent — safe to replay.
    const provision = await ensureTwilioProvisioned(adminSupa, {
      clientId: upgradeClientId,
      clientSlug: cl.slug,
      businessName: cl.business_name ?? cl.slug,
    })
    if (!provision.skipped) {
      if (provision.ok) {
        console.log(`[stripe-webhook] Twilio provisioned after upgrade: ${provision.twilioNumber} for ${cl.slug}`)
      } else {
        console.error(`[stripe-webhook] Twilio provisioning failed after upgrade for ${cl.slug}: ${provision.error}`)
        await notifySystemFailure(
          `Twilio provisioning failed after upgrade for ${cl.slug}`,
          provision.error ?? 'unknown',
          adminSupa,
          upgradeClientId,
        )
      }
    }

    // Telegram alert
    try {
      const { data: adminCl } = await adminSupa
        .from('clients')
        .select('telegram_bot_token, telegram_chat_id')
        .eq('slug', 'hasan-sharif')
        .single()
      if (adminCl?.telegram_bot_token && adminCl?.telegram_chat_id) {
        const twilioLine = provision.ok
          ? `\n${provision.notifyMsg}`
          : provision.skipped ? '' : `\n⚠️ Twilio provisioning failed: ${provision.error}`
        await sendAlert(
          adminCl.telegram_bot_token as string,
          adminCl.telegram_chat_id as string,
          `🎉 Trial converted: ${cl.business_name} (${cl.slug})\nPlan: ${upgradePlanId}\nStatus: active${twilioLine}`
        )
      }
    } catch { /* non-fatal */ }

    return new NextResponse('OK', { status: 200 })
  }

  // ── Concierge / generic payment-link path ──────────────────────────
  // Triggered when a Stripe Payment Link uses metadata.client=<slug>
  // (no intake_id, no advisor_credits, no minute_reload, no dashboard upgrade).
  // Activates the named client + (optionally) anchors billing to a chosen day of month.
  //
  // Metadata contract:
  //   client            — required. clients.slug (e.g. "velly-remodeling")
  //   program           — optional. label for tagging (e.g. "founding_concierge")
  //   anchor_day        — optional. 1-28. Push billing anchor to next occurrence of this day.
  //   extra_days_free   — optional. Add N days on top of the anchor push.
  //
  // Used for: founder/concierge links, one-off custom-priced clients, any link
  // where Hasan wants "paste this URL, they pay, it just works".
  if (session.metadata?.client && !session.metadata?.intake_id && !session.metadata?.clientId) {
    const conciergeSlug = session.metadata.client
    const program = session.metadata.program ?? null
    const anchorDay = Math.min(28, Math.max(0, parseInt(session.metadata.anchor_day ?? '0', 10) || 0))
    const extraDaysFree = Math.max(0, parseInt(session.metadata.extra_days_free ?? '0', 10) || 0)

    const { data: cl } = await adminSupa
      .from('clients')
      .select('id, slug, business_name, contact_email, niche, selected_plan')
      .eq('slug', conciergeSlug)
      .maybeSingle()

    if (!cl) {
      console.error(`[stripe-webhook] Concierge: client slug not found: ${conciergeSlug}`)
      await notifySystemFailure(
        `Concierge payment received but client slug not found: ${conciergeSlug}`,
        `metadata.client="${conciergeSlug}" session=${session.id}`,
        adminSupa,
      )
      return new NextResponse('OK', { status: 200 })
    }

    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription : (session.subscription as { id: string } | null)?.id ?? null
    const customerId = typeof session.customer === 'string' ? session.customer : null

    let nextPeriodEnd: string | null = null
    if (subscriptionId && anchorDay) {
      try {
        const now = new Date()
        const targetMonth = now.getUTCDate() >= anchorDay ? now.getUTCMonth() + 1 : now.getUTCMonth()
        const anchorDate = new Date(Date.UTC(now.getUTCFullYear(), targetMonth, anchorDay, 0, 0, 0))
        if (extraDaysFree > 0) anchorDate.setUTCDate(anchorDate.getUTCDate() + extraDaysFree)
        const trialEndUnix = Math.floor(anchorDate.getTime() / 1000)
        await getStripe().subscriptions.update(subscriptionId, {
          trial_end: trialEndUnix,
          proration_behavior: 'none',
        })
        nextPeriodEnd = anchorDate.toISOString()
        console.log(`[stripe-webhook] Concierge: anchored ${cl.slug} billing to ${nextPeriodEnd}`)
      } catch (anchorErr) {
        console.error(`[stripe-webhook] Concierge: failed to anchor billing for ${cl.slug}:`, anchorErr)
      }
    } else if (subscriptionId) {
      try {
        const sub = await getStripe().subscriptions.retrieve(subscriptionId)
        const periodEnd = sub.items.data[0]?.current_period_end ?? sub.trial_end
        if (periodEnd) nextPeriodEnd = new Date(periodEnd * 1000).toISOString()
      } catch { /* non-fatal */ }
    }

    const updatePayload: Record<string, unknown> = {
      subscription_status: 'active',
      trial_converted: true,
      status: 'active',
    }
    if (customerId) updatePayload.stripe_customer_id = customerId
    if (subscriptionId) updatePayload.stripe_subscription_id = subscriptionId
    if (nextPeriodEnd) updatePayload.subscription_current_period_end = nextPeriodEnd

    await adminSupa.from('clients').update(updatePayload).eq('id', cl.id)
    console.log(`[stripe-webhook] Concierge: activated ${cl.slug} (program=${program})`)

    // Telegram alert to admin (hasan-sharif row)
    try {
      const { data: adminCl } = await adminSupa
        .from('clients')
        .select('telegram_bot_token, telegram_chat_id')
        .eq('slug', 'hasan-sharif')
        .single()
      if (adminCl?.telegram_bot_token && adminCl?.telegram_chat_id) {
        const amountStr = session.amount_total
          ? `$${(session.amount_total / 100).toFixed(0)} ${(session.currency || 'cad').toUpperCase()}`
          : ''
        const nextStr = nextPeriodEnd ? `\nNext renewal: ${new Date(nextPeriodEnd).toLocaleDateString('en-CA')}` : ''
        const programStr = program ? `\nProgram: ${program}` : ''
        await sendAlert(
          adminCl.telegram_bot_token as string,
          adminCl.telegram_chat_id as string,
          `💰 New paid client: ${cl.business_name} (${cl.slug})${programStr}\nAmount: ${amountStr}${nextStr}`
        )
        await adminSupa.from('notification_logs').insert({
          client_id: cl.id,
          channel: 'telegram',
          recipient: adminCl.telegram_chat_id,
          content: `Concierge payment: ${cl.business_name} (${cl.slug})`,
          status: 'sent',
        })
      }
    } catch (tgErr) {
      console.error('[stripe-webhook] Concierge Telegram alert failed:', tgErr)
    }

    // Welcome / subscription-active email to the customer
    const customerEmail = typeof session.customer_details?.email === 'string'
      ? session.customer_details.email : null
    const recipientEmail = (cl.contact_email as string | null) || customerEmail
    if (recipientEmail) {
      try {
        const { sendBrandedEmail } = await import('@/lib/email/send')
        const { APP_URL } = await import('@/lib/app-url')
        const { BRAND_NAME } = await import('@/lib/brand')
        const dashboardUrl = `${APP_URL}/dashboard`
        const renewalDateCopy = nextPeriodEnd
          ? `<p style="font-size:13px;color:#555;margin:8px 0 0">Next renewal: <strong>${new Date(nextPeriodEnd).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>.</p>`
          : ''
        const result = await sendBrandedEmail({
          to: recipientEmail,
          clientId: cl.id,
          clientSlug: cl.slug as string,
          purpose: 'marketing',
          tag: 'concierge_welcome',
          reason: `You just activated ${BRAND_NAME} for ${cl.business_name}.`,
          subject: `${cl.business_name} — your AI agent is live`,
          html: `<h2 style="margin-bottom:4px;font-size:24px">Your AI agent is live.</h2>
<p style="color:#555;margin-top:0">Payment confirmed. Your ${BRAND_NAME} AI receptionist is active and ready to answer calls.</p>
${renewalDateCopy}
<a href="${dashboardUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;margin:20px 0;font-size:15px">Open my dashboard →</a>
<p style="font-size:14px;color:#555;margin-top:24px">Reply to this email if anything's broken or confusing — Hasan answers personally.</p>`,
        })
        if (result.ok) {
          console.log(`[stripe-webhook] Concierge welcome email sent to ${recipientEmail} (id=${result.id})`)
        } else {
          console.error(`[stripe-webhook] Concierge welcome email failed: ${result.error}`)
        }
      } catch (emailErr) {
        console.error('[stripe-webhook] Concierge welcome email threw:', emailErr)
      }
    } else {
      console.warn(`[stripe-webhook] Concierge: no email on file for ${cl.slug} — welcome email skipped`)
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

  // Phase 4.5 GAP-J: Write selected_plan BEFORE activation so syncClientTools reads correct plan
  const sessionPlan = session.metadata?.planId ?? session.metadata?.tier ?? null
  if (sessionPlan) {
    await adminSupa.from('clients').update({ selected_plan: sessionPlan }).eq('id', client_id)
    console.log(`[stripe-webhook] Pre-activation: set selected_plan=${sessionPlan} for client=${client_id}`)
  }

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
    // S13t: Alert operator — partial activation is invisible otherwise (Stripe won't retry 200)
    await notifySystemFailure(
      `Stripe activation FAILED for ${client_slug}`,
      result.error ?? 'Unknown activation error',
      adminSupa,
      client_id,
    )
  }

  // ── Set plan-based minute limit ──────────────────────────────────────────────
  const sessionTier = session.metadata?.tier ?? null
  if (sessionTier) {
    const tierMinutes = getEffectiveMinuteLimit(sessionTier, 'active', existingClient?.niche ?? null)
    await adminSupa.from('clients').update({
      monthly_minute_limit: tierMinutes,
      selected_plan: sessionTier,
    }).eq('id', client_id)
    console.log(`[stripe-webhook] Set tier=${sessionTier} minute_limit=${tierMinutes} for slug=${client_slug}`)
  }

  // ── Store subscription info (Stripe-specific — session only available here) ─
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription : (session.subscription as { id: string })?.id
  if (subscriptionId) {
    try {
      const sub = await getStripe().subscriptions.retrieve(subscriptionId)
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
