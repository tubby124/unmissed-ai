/**
 * POST /api/admin/hermes/concierge-create
 *
 * Hermes-callable. Creates a stub `clients` row + a one-off Stripe Payment Link
 * with the metadata.client contract the concierge webhook branch reads.
 *
 * The returned `payment_link_url` is what Hasan (or Hermes) sends to the customer.
 * When the customer pays, the webhook activates them automatically.
 *
 * Does NOT provision Twilio number or Ultravox agent — that's still a manual
 * follow-up via `/onboard-client [slug]` after payment lands.
 *
 * Auth: bearer token via HERMES_ADMIN_TOKEN env var. Never use a service-role
 *       key client-side — this is Hermes-only.
 *
 * Body:
 *   business_name      string  required
 *   contact_email      string  required
 *   slug               string  optional — derived from business_name if omitted
 *   niche              string  optional — defaults to 'other'
 *   plan               string  optional — 'lite' | 'core' | 'pro', defaults 'lite'
 *   price_cents        int     required — monthly price in cents (e.g. 11900 = $119)
 *   currency           string  optional — defaults 'cad'
 *   anchor_day         int     optional — 1-28, push billing to Nth of month
 *   extra_days_free    int     optional — defaults 0
 *   program            string  optional — label, e.g. 'founding_concierge'
 *
 * Returns: { ok, client_id, slug, payment_link_url, payment_link_id, stripe_price_id }
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/intake-transform'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })
}

interface CreateBody {
  business_name?: string
  contact_email?: string
  slug?: string
  niche?: string
  plan?: string
  price_cents?: number
  currency?: string
  anchor_day?: number
  extra_days_free?: number
  program?: string
}

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const expected = process.env.HERMES_ADMIN_TOKEN
  if (!expected) {
    return NextResponse.json({ error: 'HERMES_ADMIN_TOKEN not configured' }, { status: 500 })
  }
  const auth = req.headers.get('authorization') ?? ''
  const presented = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (presented !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Validate ────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as CreateBody
  if (!body.business_name || !body.contact_email || !body.price_cents) {
    return NextResponse.json(
      { error: 'business_name, contact_email, price_cents required' },
      { status: 400 }
    )
  }
  if (body.price_cents < 100) {
    return NextResponse.json({ error: 'price_cents must be >= 100' }, { status: 400 })
  }

  const niche = body.niche ?? 'other'
  const plan = body.plan ?? 'lite'
  const currency = (body.currency ?? 'cad').toLowerCase()
  const anchorDay = body.anchor_day ? Math.min(28, Math.max(1, Math.floor(body.anchor_day))) : null
  const extraDaysFree = body.extra_days_free ? Math.max(0, Math.floor(body.extra_days_free)) : 0
  const program = body.program ?? 'concierge'

  const slug = body.slug?.trim() || slugify(body.business_name)

  const supa = createServiceClient()

  // ── Idempotency: refuse if slug already exists ─────────────────────────
  const { data: existing } = await supa
    .from('clients')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle()
  if (existing) {
    return NextResponse.json(
      { error: `slug "${slug}" already exists`, existing_client_id: existing.id },
      { status: 409 }
    )
  }

  // ── Create stub clients row ────────────────────────────────────────────
  const { data: created, error: insertErr } = await supa
    .from('clients')
    .insert({
      slug,
      business_name: body.business_name,
      contact_email: body.contact_email,
      niche,
      selected_plan: plan,
      status: 'trialing',
      subscription_status: 'trialing',
      trial_converted: false,
    })
    .select('id, slug')
    .single()

  if (insertErr || !created) {
    return NextResponse.json(
      { error: `Failed to create client row: ${insertErr?.message ?? 'unknown'}` },
      { status: 500 }
    )
  }

  // ── Create Stripe Price + Payment Link ─────────────────────────────────
  const stripe = getStripe()
  let priceId: string
  let paymentLinkUrl: string
  let paymentLinkId: string
  try {
    const price = await stripe.prices.create({
      unit_amount: body.price_cents,
      currency,
      recurring: { interval: 'month' },
      product_data: { name: `End Voicemail — ${body.business_name}` },
    })
    priceId = price.id

    const metadata: Record<string, string> = {
      client: slug,
      program,
    }
    if (anchorDay) metadata.anchor_day = String(anchorDay)
    if (extraDaysFree) metadata.extra_days_free = String(extraDaysFree)

    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata,
      after_completion: {
        type: 'redirect',
        redirect: { url: 'https://endvoicemail.ai/dashboard' },
      },
    })
    paymentLinkUrl = link.url
    paymentLinkId = link.id
  } catch (stripeErr) {
    // Stripe failed — roll back the clients row to avoid orphan
    await supa.from('clients').delete().eq('id', created.id)
    return NextResponse.json(
      { error: `Stripe error: ${stripeErr instanceof Error ? stripeErr.message : String(stripeErr)}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    client_id: created.id,
    slug: created.slug,
    payment_link_url: paymentLinkUrl,
    payment_link_id: paymentLinkId,
    stripe_price_id: priceId,
    next_steps: [
      'Send payment_link_url to the customer',
      'On payment, the concierge webhook branch activates them automatically',
      `After activation, run /onboard-client ${created.slug} to provision Twilio number + Ultravox agent`,
    ],
  })
}
