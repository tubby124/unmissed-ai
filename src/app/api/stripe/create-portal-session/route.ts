/**
 * POST /api/stripe/create-portal-session
 *
 * Creates a Stripe Customer Portal session for subscription management.
 * Authenticated — client or admin. Admin can pass client_id to open portal for a specific client.
 *
 * Body: { client_id?: string }
 * Returns: { url: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { APP_URL } from '@/lib/app-url'

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
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  if (!cu) return NextResponse.json({ error: 'No client linked' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { client_id?: string }
  const clientId = (cu.role === 'admin' && body.client_id) ? body.client_id : cu.client_id

  const { data: client } = await svc
    .from('clients')
    .select('stripe_customer_id')
    .eq('id', clientId)
    .single()

  if (!client?.stripe_customer_id) {
    return NextResponse.json({ error: 'No Stripe customer linked' }, { status: 404 })
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: client.stripe_customer_id as string,
      return_url: `${APP_URL}/dashboard/settings`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[create-portal-session] Failed:', err)
    return NextResponse.json({ error: 'Portal session creation failed', detail: String(err) }, { status: 502 })
  }
}
