/**
 * POST /api/admin/apply-promo
 *
 * Admin-only. Applies or removes a coupon on a client's Stripe subscription.
 * After Stripe update, syncs discount columns to Supabase for fast reads.
 *
 * Body: { client_id: string; action: 'apply' | 'remove'; coupon_id?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { STRIPE_IDS } from '@/lib/pricing'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: cu } = await svc
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (cu?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as {
    client_id?: string
    action?: 'apply' | 'remove'
    coupon_id?: string
  }

  const { client_id, action, coupon_id } = body
  if (!client_id || !action) {
    return NextResponse.json({ error: 'client_id and action required' }, { status: 400 })
  }

  const { data: client } = await svc
    .from('clients')
    .select('stripe_subscription_id, slug')
    .eq('id', client_id)
    .single()

  if (!client?.stripe_subscription_id) {
    return NextResponse.json({ error: 'Client has no active subscription' }, { status: 404 })
  }

  const subId = client.stripe_subscription_id as string

  try {
    if (action === 'apply') {
      const coupon = coupon_id || STRIPE_IDS.betaCoupon
      await getStripe().subscriptions.update(subId, { discounts: [{ coupon }] })
      console.log(`[admin/apply-promo] Applied coupon=${coupon} to sub=${subId} slug=${client.slug}`)
    } else if (action === 'remove') {
      await getStripe().subscriptions.update(subId, { discounts: [] })
      console.log(`[admin/apply-promo] Removed coupon from sub=${subId} slug=${client.slug}`)
    } else {
      return NextResponse.json({ error: 'action must be "apply" or "remove"' }, { status: 400 })
    }

    // Re-fetch subscription to get updated discount state
    const sub = await getStripe().subscriptions.retrieve(subId)

    let discountName: string | null = null
    let effectiveRate: number | null = null

    const firstDiscount = sub.discounts?.[0]
    const couponObj = (firstDiscount && typeof firstDiscount !== 'string' && typeof firstDiscount.source?.coupon === 'object')
      ? firstDiscount.source.coupon
      : null
    if (couponObj) {
      discountName = couponObj.name ?? couponObj.id
      const baseAmount = sub.items.data[0]?.price?.unit_amount ?? 3000
      let effectiveAmount = baseAmount
      if (couponObj.amount_off) effectiveAmount = baseAmount - couponObj.amount_off
      else if (couponObj.percent_off) effectiveAmount = Math.round(baseAmount * (1 - couponObj.percent_off / 100))
      effectiveRate = Math.round(effectiveAmount / 100)
    }

    // Sync to Supabase
    await svc.from('clients').update({
      stripe_discount_name: discountName,
      effective_monthly_rate: effectiveRate,
    }).eq('id', client_id)

    return NextResponse.json({
      success: true,
      discountName,
      effectiveRate,
      subscriptionStatus: sub.status,
    })
  } catch (err) {
    console.error('[admin/apply-promo] Stripe update failed:', err)
    return NextResponse.json({ error: 'Failed to update subscription', detail: String(err) }, { status: 502 })
  }
}
