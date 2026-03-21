/**
 * POST /api/stripe/create-public-checkout
 *
 * Public (no auth required). Creates a Stripe Checkout session for the setup fee + subscription.
 * Single plan: $30/mo CAD (100 min). Discount code BETA20 = $20/mo.
 * Fresh number: $25 CAD setup. Inventory number: $20 CAD setup.
 * 7-day free trial included.
 * Auto-provisions the clients row + Ultravox agent if not already done by admin.
 *
 * Body: { intakeId: string; selectedNumber?: string }
 * Returns: { url: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { buildPromptFromIntake, validatePrompt, NICHE_CLASSIFICATION_RULES } from '@/lib/prompt-builder'
import { createAgent, deleteAgent, resolveVoiceId } from '@/lib/ultravox'
import { scrapeWebsite } from '@/lib/website-scraper'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })

/** Single subscription price — $30/mo CAD. Discount codes (BETA20) reduce this at checkout. */
function getSubscriptionPriceId(): string {
  const priceId = process.env.STRIPE_SUBSCRIPTION_PRICE_ID
  if (!priceId) throw new Error('Missing env var STRIPE_SUBSCRIPTION_PRICE_ID')
  return priceId
}

const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const timestamps = (rateLimitMap.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS)
  rateLimitMap.set(ip, timestamps)
  return timestamps.length >= RATE_LIMIT
}

function recordUsage(ip: string) {
  const timestamps = rateLimitMap.get(ip) || []
  timestamps.push(Date.now())
  rateLimitMap.set(ip, timestamps)
}

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip') || 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  recordUsage(ip)

  const body = await req.json().catch(() => ({})) as { intakeId?: string; selectedNumber?: string }
  const { intakeId, selectedNumber } = body

  if (!intakeId) {
    return NextResponse.json({ error: 'intakeId required' }, { status: 400 })
  }

  // ── Load intake ────────────────────────────────────────────────────────────
  const { data: intake, error: intakeErr } = await svc
    .from('intake_submissions')
    .select('id, niche, business_name, client_slug, contact_email, intake_json, progress_status, client_id')
    .eq('id', intakeId)
    .single()

  if (intakeErr || !intake) {
    return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
  }

  if (intake.progress_status === 'activated') {
    return NextResponse.json({ error: 'This setup has already been activated' }, { status: 409 })
  }

  // ── Phase 6: Release stale reservations before attempting new one ──────────
  // Expired reservations (>30 min) are auto-reclaimed by the atomic OR clause below,
  // but this explicit cleanup prevents inventory from looking full in the UI.
  {
    const staleExpiry = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    await svc
      .from('number_inventory')
      .update({ status: 'available', reserved_intake_id: null, reserved_at: null })
      .eq('status', 'reserved')
      .lt('reserved_at', staleExpiry)
  }

  // ── Reserve inventory number if selected ───────────────────────────────────
  if (selectedNumber) {
    const expiryTime = new Date(Date.now() - 30 * 60 * 1000).toISOString()

    // Atomically claim the number — fails if another checkout already holds it (within 30 min)
    const { data: reserved, error: reserveErr } = await svc
      .from('number_inventory')
      .update({
        status: 'reserved',
        reserved_intake_id: intakeId,
        reserved_at: new Date().toISOString(),
      })
      .eq('phone_number', selectedNumber)
      .or(`status.eq.available,and(status.eq.reserved,reserved_at.lt.${expiryTime})`)
      .select('id')

    if (reserveErr) {
      console.error('[create-public-checkout] Reserve number error:', reserveErr)
      return NextResponse.json({ error: 'Failed to reserve number' }, { status: 500 })
    }

    if (!reserved || reserved.length === 0) {
      return NextResponse.json(
        { error: 'Number just taken — pick another or choose a fresh number' },
        { status: 409 }
      )
    }

    console.log(`[create-public-checkout] Reserved inventory number ${selectedNumber} for intake ${intakeId}`)
  }

  // ── Auto-provision clients row if not already done ─────────────────────────
  const baseSlug = intake.client_slug || slugify(intake.business_name || 'unmissed-agent')
  const businessName = intake.business_name || baseSlug

  // If this intake already owns a client, use that client directly
  const alreadyLinkedClientId = intake.client_id as string | null

  // Resolve a unique slug — collision = different client owns this slug
  let clientSlug = baseSlug
  if (!alreadyLinkedClientId) {
    let suffix = 2
    while (true) {
      const { data: slugCheck } = await svc.from('clients').select('id').eq('slug', clientSlug).maybeSingle()
      if (!slugCheck) break // slug is free
      // Slug taken — try next suffix
      clientSlug = `${baseSlug}-${suffix}`
      suffix++
    }
  }

  const rawEmail = intake.contact_email ?? ''
  const customerEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : undefined

  let stripeCustomerId: string | undefined
  if (customerEmail) {
    const existing = await stripe.customers.list({ email: customerEmail, limit: 1 })
    stripeCustomerId = existing.data[0]?.id
    if (!stripeCustomerId) {
      const cust = await stripe.customers.create({ email: customerEmail, name: businessName })
      stripeCustomerId = cust.id
    }
  }

  // Check for existing client linked to this intake
  const { data: existingClient } = alreadyLinkedClientId
    ? await svc.from('clients').select('id, status').eq('id', alreadyLinkedClientId).maybeSingle()
    : { data: null }

  let clientId: string

  if (existingClient) {
    // Admin already ran generate-prompt, or this is a checkout retry — use existing client
    clientId = existingClient.id as string

    if (existingClient.status === 'active') {
      return NextResponse.json({ error: 'This agent is already active' }, { status: 409 })
    }

    if (stripeCustomerId) {
      await svc.from('clients').update({ stripe_customer_id: stripeCustomerId }).eq('id', clientId)
    }
  } else {
    // Self-serve path: generate prompt + create Ultravox agent + insert clients row
    const intakeData = (intake.intake_json as Record<string, unknown>) || {}
    if (!intakeData.niche && intake.niche) intakeData.niche = intake.niche

    // ── Website scraping enrichment ────────────────────────────────────────────
    let websiteContent = ''
    const websiteUrlForScrape = (intakeData.website_url as string) || (intakeData.websiteUrl as string) || ''
    if (websiteUrlForScrape) {
      const niche = intake.niche || 'other'
      const scrapeResult = await scrapeWebsite(websiteUrlForScrape, niche)
      if (scrapeResult.rawContent) {
        const factLines = scrapeResult.businessFacts.map((f: string) => `- ${f}`).join('\n')
        const qaLines = scrapeResult.extraQa.map((qa: { q: string; a: string }) => `Q: ${qa.q}\nA: ${qa.a}`).join('\n\n')
        websiteContent = [factLines, qaLines].filter(Boolean).join('\n\n')
        if (websiteContent) {
          console.log(`[create-public-checkout] Website scraping: ${websiteContent.length} chars for slug=${clientSlug}`)
        }
      }
    }

    // Fetch knowledge docs uploaded during onboarding
    let knowledgeDocs = ''
    const { data: kDocs } = await svc
      .from('client_knowledge_docs')
      .select('content_text')
      .eq('intake_id', intakeId)
    if (kDocs && kDocs.length > 0) {
      knowledgeDocs = kDocs.map((d: { content_text: string }) => d.content_text).join('\n\n---\n\n')
    }

    let prompt: string
    try {
      prompt = buildPromptFromIntake(intakeData, websiteContent, knowledgeDocs)
    } catch (err) {
      console.error('[create-public-checkout] buildPromptFromIntake failed:', err)
      return NextResponse.json({ error: 'Prompt generation failed', detail: String(err) }, { status: 500 })
    }

    const validation = validatePrompt(prompt)
    if (!validation.valid) {
      return NextResponse.json({ error: 'Prompt failed validation', errors: validation.errors }, { status: 422 })
    }

    // Voice ID: direct picker selection > gender fallback > niche default
    const voiceId = resolveVoiceId(
      intakeData.niche_voiceId as string | null,
      intakeData.niche_voiceGender as string | null,
      intake.niche,
    )

    let agentId: string
    try {
      agentId = await createAgent({
        systemPrompt: prompt,
        name: clientSlug.slice(0, 64),
        voice: voiceId,
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
        agent_voice_id: voiceId,
        classification_rules: classificationRules,
        timezone,
        stripe_customer_id: stripeCustomerId ?? null,
      })
      .select('id')
      .single()

    if (insertErr || !newClient) {
      // Compensating rollback — delete the Ultravox agent so it doesn't become an orphan.
      // Future: store agentId in intake_submissions before insert so retries can reuse it
      // instead of creating a new agent (fully idempotent agent creation).
      console.error('[create-public-checkout] clients insert failed, rolling back agent:', insertErr)
      try {
        await deleteAgent(agentId)
      } catch (delErr) {
        console.error(`[create-public-checkout] Orphaned agent ${agentId} — manual cleanup needed:`, delErr)
      }
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

  let subscriptionPriceId: string
  try {
    subscriptionPriceId = getSubscriptionPriceId()
  } catch (err) {
    console.error('[create-public-checkout] Subscription price lookup failed:', err)
    return NextResponse.json({ error: 'Subscription price not configured', detail: String(err) }, { status: 500 })
  }

  let session: { url: string | null }
  try {
    const isInventory = !!selectedNumber
    session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      allow_promotion_codes: true,
      line_items: [
        {
          price: isInventory
            ? process.env.STRIPE_SETUP_INVENTORY_PRICE_ID!
            : process.env.STRIPE_SETUP_PRICE_ID!,
          quantity: 1,
        },
        {
          price: subscriptionPriceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          client_id: clientId,
          client_slug: clientSlug,
          intake_id: intakeId,
        },
      },
      metadata: {
        intake_id: intakeId,
        client_id: clientId,
        client_slug: clientSlug,
        reserved_number: selectedNumber ?? '',
      },
      success_url: `${appUrl}/onboard/status?success=true&id=${intakeId}`,
      cancel_url: `${appUrl}/onboard/status?id=${intakeId}`,
    })
  } catch (err) {
    console.error('[create-public-checkout] Stripe session creation failed:', err)
    return NextResponse.json({ error: 'Checkout session creation failed', detail: String(err) }, { status: 502 })
  }

  return NextResponse.json({ url: session.url })
}
