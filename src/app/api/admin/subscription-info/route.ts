/**
 * GET /api/admin/subscription-info?client_id=X
 *
 * Admin-only. Fetches live Stripe subscription details for a client,
 * including discount/coupon info and payment method.
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })
}

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: cu } = await svc
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (cu?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const clientId = req.nextUrl.searchParams.get('client_id')
  if (!clientId) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const { data: client } = await svc
    .from('clients')
    .select('stripe_customer_id, stripe_subscription_id')
    .eq('id', clientId)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  if (!client.stripe_subscription_id) {
    return NextResponse.json({ hasSubscription: false })
  }

  try {
    const sub = await getStripe().subscriptions.retrieve(client.stripe_subscription_id as string, {
      expand: ['default_payment_method', 'discounts.source.coupon'],
    })

    const firstDiscount = sub.discounts?.[0]
    const couponObj = (firstDiscount && typeof firstDiscount !== 'string' && typeof firstDiscount.source?.coupon === 'object')
      ? firstDiscount.source.coupon
      : null
    let discountInfo = null
    if (couponObj) {
      discountInfo = {
        couponId: couponObj.id,
        name: couponObj.name ?? couponObj.id,
        amountOff: couponObj.amount_off,
        percentOff: couponObj.percent_off,
        duration: couponObj.duration,
      }
    }

    const pm = sub.default_payment_method
    let paymentMethod = null
    if (pm && typeof pm !== 'string' && pm.type === 'card' && pm.card) {
      paymentMethod = {
        brand: pm.card.brand,
        last4: pm.card.last4,
      }
    }

    const baseAmount = sub.items.data[0]?.price?.unit_amount ?? 3000
    let effectiveAmount = baseAmount
    if (couponObj?.amount_off) effectiveAmount = baseAmount - couponObj.amount_off
    else if (couponObj?.percent_off) effectiveAmount = Math.round(baseAmount * (1 - couponObj.percent_off / 100))

    return NextResponse.json({
      hasSubscription: true,
      status: sub.status,
      currentPeriodEnd: new Date((sub.items.data[0]?.current_period_end ?? 0) * 1000).toISOString(),
      monthlyAmount: baseAmount,
      currency: sub.currency,
      discount: discountInfo,
      paymentMethod,
      effectiveMonthly: Math.round(effectiveAmount / 100),
    })
  } catch (err) {
    console.error('[admin/subscription-info] Stripe fetch failed:', err)
    return NextResponse.json({ error: 'Failed to fetch subscription', detail: String(err) }, { status: 502 })
  }
}
