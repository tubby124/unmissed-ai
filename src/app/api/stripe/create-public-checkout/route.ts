/**
 * POST /api/stripe/create-public-checkout
 *
 * Public (no auth required). Creates a Stripe Checkout session for the $20 CAD setup fee.
 * Auto-provisions the clients row + Ultravox agent if not already done by admin.
 *
 * Body: { intakeId: string }
 * Returns: { url: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { buildPromptFromIntake, validatePrompt, NICHE_CLASSIFICATION_RULES } from '@/lib/prompt-builder'
import { createAgent } from '@/lib/ultravox'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { intakeId?: string }
  const { intakeId } = body

  if (!intakeId) {
    return NextResponse.json({ error: 'intakeId required' }, { status: 400 })
  }

  // ── Load intake ────────────────────────────────────────────────────────────
  const { data: intake, error: intakeErr } = await svc
    .from('intake_submissions')
    .select('id, niche, business_name, client_slug, contact_email, intake_json, progress_status')
    .eq('id', intakeId)
    .single()

  if (intakeErr || !intake) {
    return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
  }

  if (intake.progress_status === 'activated') {
    return NextResponse.json({ error: 'This setup has already been activated' }, { status: 409 })
  }

  // ── Auto-provision clients row if not already done ─────────────────────────
  const clientSlug = intake.client_slug || slugify(intake.business_name || 'unmissed-agent')
  const businessName = intake.business_name || clientSlug

  // Check for existing client by slug
  const { data: existingClient } = await svc
    .from('clients')
    .select('id, status')
    .eq('slug', clientSlug)
    .maybeSingle()

  let clientId: string

  if (existingClient) {
    // Admin already ran generate-prompt — use existing client
    clientId = existingClient.id as string

    if (existingClient.status === 'active') {
      return NextResponse.json({ error: 'This agent is already active' }, { status: 409 })
    }
  } else {
    // Self-serve path: generate prompt + create Ultravox agent + insert clients row
    const intakeData = (intake.intake_json as Record<string, unknown>) || {}
    if (!intakeData.niche && intake.niche) intakeData.niche = intake.niche

    let prompt: string
    try {
      prompt = buildPromptFromIntake(intakeData)
    } catch (err) {
      console.error('[create-public-checkout] buildPromptFromIntake failed:', err)
      return NextResponse.json({ error: 'Prompt generation failed', detail: String(err) }, { status: 500 })
    }

    const validation = validatePrompt(prompt)
    if (!validation.valid) {
      return NextResponse.json({ error: 'Prompt failed validation', errors: validation.errors }, { status: 422 })
    }

    let agentId: string
    try {
      agentId = await createAgent({
        systemPrompt: prompt,
        name: clientSlug.slice(0, 64),
      })
    } catch (err) {
      console.error('[create-public-checkout] createAgent failed:', err)
      return NextResponse.json({ error: 'Agent creation failed', detail: String(err) }, { status: 502 })
    }

    const niche = intake.niche || 'other'
    const classificationRules = NICHE_CLASSIFICATION_RULES[niche] || NICHE_CLASSIFICATION_RULES.other
    const timezone = (intakeData.timezone as string) || 'America/Edmonton'

    const { data: newClient, error: insertErr } = await svc
      .from('clients')
      .insert({
        slug: clientSlug,
        business_name: businessName,
        niche,
        status: 'setup',
        system_prompt: prompt,
        ultravox_agent_id: agentId,
        classification_rules: classificationRules,
        timezone,
      })
      .select('id')
      .single()

    if (insertErr || !newClient) {
      console.error('[create-public-checkout] clients insert failed:', insertErr)
      return NextResponse.json({ error: 'Failed to create client', detail: insertErr?.message }, { status: 500 })
    }

    clientId = newClient.id as string

    // Seed prompt_versions
    await svc.from('prompt_versions').insert({
      client_id: clientId,
      version: 1,
      content: prompt,
      change_description: `Auto-generated at checkout (niche: ${niche}, ${validation.charCount} chars)`,
      is_active: true,
    })

    // Mark intake as provisioned
    await svc
      .from('intake_submissions')
      .update({ status: 'provisioned', client_id: clientId })
      .eq('id', intakeId)

    console.log(`[create-public-checkout] Auto-provisioned: ${clientSlug} (${clientId}) agent=${agentId}`)
  }

  // ── Create Stripe Checkout session ─────────────────────────────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://unmissed-ai-production.up.railway.app'

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'cad',
          unit_amount: 2000,
          product_data: {
            name: 'unmissed.ai Voice Agent Setup',
            description: 'Includes your first month of AI call handling — free.',
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      intake_id: intakeId,
      client_id: clientId,
      client_slug: clientSlug,
    },
    customer_email: intake.contact_email ?? undefined,
    success_url: `${appUrl}/onboard/status?success=true`,
    cancel_url: `${appUrl}/onboard/status?id=${intakeId}`,
  })

  return NextResponse.json({ url: session.url })
}
