/**
 * GET /api/stripe/trial-convert?clientId=X
 *
 * Creates a Stripe Checkout session for trial-to-paid conversion.
 * Redirects the user to Stripe Checkout.
 * Single plan: $30/mo CAD. Promo codes (BETA20) available at checkout.
 *
 * Public — linked from trial expiry emails. No auth required.
 * The clientId maps to a client with trial_expires_at set.
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })

function getSubscriptionPriceId(): string {
  const priceId = process.env.STRIPE_SUBSCRIPTION_PRICE_ID
  if (!priceId) throw new Error('Missing env var STRIPE_SUBSCRIPTION_PRICE_ID')
  return priceId
}

const adminSupa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const clientId = searchParams.get('clientId')

  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }

  try {
    // Look up client — must have trial_expires_at set
    const { data: client, error: clientErr } = await adminSupa
      .from('clients')
      .select('id, slug, business_name, trial_expires_at, contact_email')
      .eq('id', clientId)
      .single()

    if (clientErr || !client) {
      console.error(`[trial-convert] Client not found: ${clientId}`, clientErr)
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    if (!client.trial_expires_at) {
      return NextResponse.json({ error: 'Client is not on a trial' }, { status: 400 })
    }

    // Look up intake_id from intake_submissions
    const { data: intake } = await adminSupa
      .from('intake_submissions')
      .select('id')
      .eq('client_slug', client.slug)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .single()

    const intakeId = intake?.id ?? null
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://unmissed-ai-production.up.railway.app'

    let subscriptionPriceId: string
    try {
      subscriptionPriceId = getSubscriptionPriceId()
    } catch (err) {
      console.error('[trial-convert] Subscription price lookup failed:', err)
      return NextResponse.json({ error: 'Subscription price not configured', detail: String(err) }, { status: 500 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      allow_promotion_codes: true,
      line_items: [{ price: subscriptionPriceId, quantity: 1 }],
      subscription_data: {
        metadata: {
          client_id: clientId,
          client_slug: client.slug as string,
        },
      },
      metadata: {
        client_id: clientId,
        client_slug: client.slug,
        is_trial_convert: 'true',
        ...(intakeId ? { intake_id: intakeId } : {}),
      },
      customer_email: (client.contact_email as string) ?? undefined,
      success_url: intakeId
        ? `${appUrl}/onboard/status?id=${intakeId}&trial_converted=true`
        : `${appUrl}/dashboard?trial_converted=true`,
      cancel_url: `${appUrl}/dashboard`,
    })

    if (!session.url) {
      console.error('[trial-convert] Stripe session created but no URL returned')
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
    }

    console.log(`[trial-convert] Redirecting client=${client.slug} to Stripe checkout`)
    return NextResponse.redirect(session.url)
  } catch (err) {
    console.error('[trial-convert] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
