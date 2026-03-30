import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { seedKnowledgeFromScrape } from '@/lib/seed-knowledge'
import { validateApprovedPackage } from '@/lib/scrape-validation'
import { getPlanEntitlements } from '@/lib/plan-entitlements'

type ApprovedPackage = {
  businessFacts: string[]
  extraQa: { q: string; a: string }[]
  serviceTags: string[]
}

/**
 * Approve website-scraped knowledge.
 * Seeds knowledge_chunks via shared seedKnowledgeFromScrape utility (SCRAPE7 cleanup + serviceTags included).
 * Chunk status: pending (default) or approved (if auto_approve=true and user is admin).
 *
 * Also merges into business_facts/extra_qa on the client row for backward compat
 * (agent-context.ts injects these into the prompt at call time).
 */
export async function POST(req: NextRequest) {
  // ── Auth — admin or client owner ──────────────────────────────────────────
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ── Parse body ────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as {
    clientId?: string
    approved?: ApprovedPackage
    auto_approve?: boolean
  }
  const clientId = body.clientId?.trim()

  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  // ── Permission check ──────────────────────────────────────────────────────
  if (cu.role !== 'admin' && cu.client_id !== clientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const svc = createServiceClient()

  // ── Load client row ───────────────────────────────────────────────────────
  const { data: client, error: clientErr } = await svc
    .from('clients')
    .select('business_facts, extra_qa, website_url, website_scrape_pages, website_knowledge_preview, slug, selected_plan, subscription_status')
    .eq('id', clientId)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // ── Phase 5: Enforce plan-based knowledge source limits ─────────────────
  const approvePlan = getPlanEntitlements(
    (client.subscription_status as string | null) === 'trialing' ? 'trial' : (client.selected_plan as string | null)
  )
  if (!approvePlan.knowledgeEnabled) {
    return NextResponse.json({ error: 'Knowledge base is not available on your current plan.' }, { status: 403 })
  }
  const { count: existingSourceCount } = await svc
    .from('client_knowledge_docs')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
  if ((existingSourceCount ?? 0) >= approvePlan.maxKnowledgeSources) {
    return NextResponse.json(
      { error: `Source limit reached for your plan (${existingSourceCount}/${approvePlan.maxKnowledgeSources}). Upgrade to add more.` },
      { status: 403 },
    )
  }

  // ── Resolve approved package ──────────────────────────────────────────────
  const approved: ApprovedPackage | null =
    body.approved ?? (client.website_knowledge_preview as ApprovedPackage | null)

  if (!approved) {
    return NextResponse.json(
      { error: 'No approved data provided and no website_knowledge_preview stored' },
      { status: 400 },
    )
  }

  // SCRAPE8: Validate approved package shape + content before seeding
  const validation = validateApprovedPackage(approved)
  if (!validation.valid) {
    return NextResponse.json(
      { error: 'Invalid approved data', details: validation.errors },
      { status: 400 },
    )
  }

  // ── Determine chunk status based on role ──────────────────────────────────
  // Admin and owner users approve their own website data — chunks go live immediately.
  // Other roles (viewer, etc.) would require admin review, but owner is self-service.
  const chunkStatus = cu.role === 'admin' || cu.role === 'owner' ? 'approved' : 'pending'
  const runId = `website-scrape-${Date.now()}`

  // ── Seed knowledge chunks via shared utility ──────────────────────────────
  // Handles: SCRAPE7 cleanup, serviceTags, embeddings, syncClientTools
  const seedResult = await seedKnowledgeFromScrape(svc, {
    clientId,
    clientSlug: client.slug as string,
    scrapeData: null,
    rawScrapeResult: null,
    approvedPackage: approved,
    runId,
    routeLabel: 'approve-website-knowledge',
    chunkStatus,
    trustTier: 'medium',
    sourceUrl: client.website_url ?? undefined,
  })

  // ── Also merge into business_facts/extra_qa for prompt injection ──────────
  // agent-context.ts still reads these for inline prompt injection
  const existingFacts = typeof client.business_facts === 'string' ? client.business_facts : ''
  const existingQa: { q: string; a: string }[] = Array.isArray(client.extra_qa) ? client.extra_qa : []

  const newFactLines = approved.businessFacts.filter(f => f?.trim())
  const existingFactSet = new Set(existingFacts.split('\n').map(l => l.trim().toLowerCase()))
  const dedupedNewFacts = newFactLines.filter(f => !existingFactSet.has(f.trim().toLowerCase()))
  const mergedFacts = dedupedNewFacts.length > 0
    ? (existingFacts ? existingFacts + '\n' : '') + dedupedNewFacts.join('\n')
    : existingFacts

  const existingQaSet = new Set(existingQa.map(q => q.q.trim().toLowerCase()))
  const dedupedNewQa = approved.extraQa.filter(q => q.q?.trim() && !existingQaSet.has(q.q.trim().toLowerCase()))
  const mergedQa = [...existingQa, ...dedupedNewQa]

  // ── Update client row ─────────────────────────────────────────────────────
  const { error: updateErr } = await svc
    .from('clients')
    .update({
      business_facts: mergedFacts,
      extra_qa: mergedQa,
      website_knowledge_approved: approved as unknown as Record<string, unknown>,
      website_scrape_status: 'approved',
    })
    .eq('id', clientId)

  if (updateErr) {
    console.error(`[approve-website-knowledge] Failed to update client ${clientId}:`, updateErr)
    return NextResponse.json({ error: 'Failed to save approved knowledge' }, { status: 500 })
  }

  const factLines = mergedFacts.split('\n').filter((l: string) => l.trim().length > 0)

  console.log(`[approve-website-knowledge] client=${client.slug} stored=${seedResult.stored} failed=${seedResult.failed} facts=${factLines.length} qa=${mergedQa.length} chunkStatus=${chunkStatus}`)

  return NextResponse.json({
    success: true,
    mergedFacts: factLines.length,
    mergedQa: mergedQa.length,
    chunksStored: seedResult.stored,
    chunksFailed: seedResult.failed,
    chunkStatus,
    errors: seedResult.errors.length > 0 ? seedResult.errors : undefined,
  })
}
