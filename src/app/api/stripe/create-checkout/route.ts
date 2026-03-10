/**
 * POST /api/stripe/create-checkout
 *
 * Admin only. Creates a Stripe Checkout session for the $20 setup fee.
 * Returns { url } — admin sends this to the client or opens it themselves.
 *
 * Body: { intakeId: string, clientId: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' })

export async function POST(req: NextRequest) {
  // ── Admin auth ─────────────────────────────────────────────────────────────
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (cu?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ── Parse body ─────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as { intakeId?: string; clientId?: string }
  const { intakeId, clientId } = body

  if (!intakeId || !clientId) {
    return NextResponse.json({ error: 'intakeId and clientId required' }, { status: 400 })
  }

  // ── Load intake + client to get slug ───────────────────────────────────────
  const svc = createServiceClient()

  const { data: intake } = await svc
    .from('intake_submissions')
    .select('business_name, contact_email')
    .eq('id', intakeId)
    .single()

  const { data: client } = await svc
    .from('clients')
    .select('slug, status')
    .eq('id', clientId)
    .single()

  if (!intake || !client) {
    return NextResponse.json({ error: 'Intake or client not found' }, { status: 404 })
  }

  if (client.status === 'active') {
    return NextResponse.json({ error: 'Client is already active' }, { status: 409 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://unmissed-ai-production.up.railway.app'

  // ── Create Stripe Checkout session ─────────────────────────────────────────
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: 2000,
          product_data: {
            name: 'unmissed.ai Voice Agent Setup',
            description: `AI phone agent for ${intake.business_name}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      intake_id: intakeId,
      client_id: clientId,
      client_slug: client.slug,
    },
    customer_email: intake.contact_email ?? undefined,
    success_url: `${appUrl}/dashboard/clients?activated={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/dashboard/clients`,
  })

  return NextResponse.json({ url: session.url })
}
