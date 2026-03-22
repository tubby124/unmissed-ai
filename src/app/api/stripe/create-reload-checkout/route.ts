import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerClient } from '@/lib/supabase/server'
import { MINUTE_RELOAD } from '@/lib/pricing'
import { APP_URL } from '@/lib/app-url'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })
}

const CENTS_PER_MINUTE = MINUTE_RELOAD.perMinuteRate * 100 // 20 cents per minute

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  if (!cu) return NextResponse.json({ error: 'No client linked' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { minutes?: number; client_id?: string }
  const { minutes } = body

  // Admin can reload for any client
  const clientId = (cu.role === 'admin' && body.client_id) ? body.client_id : cu.client_id

  const minMinutes = MINUTE_RELOAD.minutes       // 50
  const maxMinutes = MINUTE_RELOAD.minutes * 5   // 250
  if (!minutes || minutes < minMinutes || minutes > maxMinutes || minutes % MINUTE_RELOAD.minutes !== 0) {
    return NextResponse.json({ error: `minutes must be a multiple of ${MINUTE_RELOAD.minutes} between ${minMinutes} and ${maxMinutes}` }, { status: 400 })
  }

  const { data: client } = await supabase
    .from('clients')
    .select('business_name, slug')
    .eq('id', clientId)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const amount = minutes * CENTS_PER_MINUTE

  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'cad',
        unit_amount: amount,
        product_data: {
          name: `unmissed.ai Minute Reload — ${minutes} min`,
          description: `${minutes} minutes for ${client.business_name}`,
        },
      },
      quantity: 1,
    }],
    metadata: {
      type: 'minute_reload',
      client_id: clientId,
      client_slug: client.slug,
      minutes: String(minutes),
    },
    success_url: `${APP_URL}/dashboard/settings?reloaded=${minutes}`,
    cancel_url: `${APP_URL}/dashboard/settings`,
  })

  return NextResponse.json({ url: session.url })
}
