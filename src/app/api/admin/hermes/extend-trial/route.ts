/**
 * POST /api/admin/hermes/extend-trial
 *
 * Hermes-callable. Extends a client's trial by N days.
 * If the client has an active Stripe subscription, pushes `trial_end` on Stripe
 * to anchor the next billing date. Also updates Supabase `trial_expires_at`.
 *
 * Auth: bearer token via HERMES_ADMIN_TOKEN.
 *
 * Body:
 *   slug   string  required — clients.slug
 *   days   int     required — number of days to extend (1-90)
 *
 * Returns: { ok, slug, new_trial_expires_at, stripe_synced }
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/server'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })
}

export async function POST(req: NextRequest) {
  const expected = process.env.HERMES_ADMIN_TOKEN
  if (!expected) {
    return NextResponse.json({ error: 'HERMES_ADMIN_TOKEN not configured' }, { status: 500 })
  }
  const auth = req.headers.get('authorization') ?? ''
  const presented = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (presented !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as { slug?: string; days?: number }
  if (!body.slug || !body.days) {
    return NextResponse.json({ error: 'slug and days required' }, { status: 400 })
  }
  const days = Math.min(90, Math.max(1, Math.floor(body.days)))

  const supa = createServiceClient()
  const { data: cl } = await supa
    .from('clients')
    .select('id, slug, trial_expires_at, stripe_subscription_id, subscription_current_period_end')
    .eq('slug', body.slug)
    .maybeSingle()

  if (!cl) {
    return NextResponse.json({ error: `slug "${body.slug}" not found` }, { status: 404 })
  }

  // Compute new trial end: from existing trial_expires_at if in future, else from now
  const now = Date.now()
  const baseMs = cl.trial_expires_at && new Date(cl.trial_expires_at).getTime() > now
    ? new Date(cl.trial_expires_at).getTime()
    : now
  const newTrialEndMs = baseMs + days * 24 * 60 * 60 * 1000
  const newTrialEndIso = new Date(newTrialEndMs).toISOString()

  let stripeSynced = false
  if (cl.stripe_subscription_id) {
    try {
      await getStripe().subscriptions.update(cl.stripe_subscription_id, {
        trial_end: Math.floor(newTrialEndMs / 1000),
        proration_behavior: 'none',
      })
      stripeSynced = true
    } catch (stripeErr) {
      console.error(`[hermes/extend-trial] Stripe update failed for ${cl.slug}:`, stripeErr)
    }
  }

  await supa
    .from('clients')
    .update({
      trial_expires_at: newTrialEndIso,
      subscription_current_period_end: stripeSynced ? newTrialEndIso : cl.subscription_current_period_end,
    })
    .eq('id', cl.id)

  return NextResponse.json({
    ok: true,
    slug: cl.slug,
    new_trial_expires_at: newTrialEndIso,
    stripe_synced: stripeSynced,
    note: stripeSynced
      ? 'Stripe trial_end pushed — no charge until new date'
      : 'Supabase updated; no Stripe subscription on file (or Stripe call failed — check logs)',
  })
}
