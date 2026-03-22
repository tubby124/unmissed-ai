import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerClient } from '@/lib/supabase/server'
import { CREDIT_PACKS } from '@/lib/ai-models'
import { APP_URL } from '@/lib/app-url'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { packId?: string }
  const { packId } = body

  if (!packId) {
    return NextResponse.json({ error: 'packId is required' }, { status: 400 })
  }

  const pack = CREDIT_PACKS.find(p => p.id === packId)
  if (!pack) {
    return NextResponse.json({ error: 'Invalid packId' }, { status: 400 })
  }

  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'cad',
        unit_amount: pack.priceCad * 100,
        product_data: {
          name: pack.label,
        },
      },
      quantity: 1,
    }],
    metadata: {
      product: 'advisor_credits',
      user_id: user.id,
      credits_cents: String(pack.cents),
      pack_id: packId,
    },
    success_url: `${APP_URL}/dashboard/advisor?topup=success`,
    cancel_url: `${APP_URL}/dashboard/advisor?topup=cancelled`,
  })

  return NextResponse.json({ url: session.url })
}
