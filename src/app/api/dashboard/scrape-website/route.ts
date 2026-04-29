import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { scrapeWebsite } from '@/lib/website-scraper'
import { normalizeExtraction } from '@/lib/knowledge-extractor'
import { getPlanEntitlements } from '@/lib/plan-entitlements'
import {
  resolveAdminScope,
  rejectIfEditModeRequired,
  auditAdminWrite,
} from '@/lib/admin-scope-helpers'

const SCRAPE_TIMEOUT_MS = 45_000

function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  // ── Auth + Phase 3 Wave B scope guard ────────────────────────────────────
  const supabase = await createServerClient()
  const body = await req.json().catch(() => ({})) as { clientId?: string; url?: string; client_id?: string; edit_mode_confirmed?: boolean }
  const clientId = body.clientId?.trim()
  const url = body.url?.trim()

  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })
  if (!isValidHttpUrl(url)) return NextResponse.json({ error: 'url must be a valid http or https URL' }, { status: 400 })

  const normalizedBody: Record<string, unknown> = { ...body, client_id: clientId }
  const resolved = await resolveAdminScope({
    supabase,
    req,
    body: normalizedBody,
    acceptCamelCase: true,
  })
  if (!resolved.ok) return NextResponse.json({ error: resolved.message }, { status: resolved.status })
  const { scope } = resolved
  if (scope.role !== 'admin' && scope.ownClientId !== clientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const denied = rejectIfEditModeRequired(scope)
  if (denied) return denied

  const svc = createServiceClient()

  // ── Get client niche + plan ───────────────────────────────────────────────
  const { data: client, error: clientErr } = await svc
    .from('clients')
    .select('niche, selected_plan, subscription_status')
    .eq('id', clientId)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const niche = client.niche || 'other'

  // ── D85: Enforce plan URL limit ───────────────────────────────────────────
  const plan = getPlanEntitlements(
    (client.subscription_status as string | null) === 'trialing'
      ? 'trial'
      : (client.selected_plan as string | null)
  )

  // Count existing sources (exclude the URL being re-scraped — it's an update)
  const { count: existingCount } = await svc
    .from('client_website_sources')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .neq('url', url)

  if ((existingCount ?? 0) >= plan.maxWebsiteUrls) {
    return NextResponse.json(
      {
        error: `Website URL limit reached for your plan (${plan.maxWebsiteUrls} URL${plan.maxWebsiteUrls === 1 ? '' : 's'}). Upgrade to add more.`,
        upgrade: true,
        currentPlan: client.selected_plan ?? 'lite',
        limit: plan.maxWebsiteUrls,
      },
      { status: 403 }
    )
  }

  // ── Upsert source record + mark scraping ──────────────────────────────────
  // Reset chunk_count to 0 on every (re)scrape — old chunks for this URL will be
  // wiped on next approve, and showing the prior count during scraping/extracted
  // is misleading (UI implies the live state still reflects the prior approve).
  await svc
    .from('client_website_sources')
    .upsert(
      { client_id: clientId, url, scrape_status: 'scraping', scrape_error: null, chunk_count: 0 },
      { onConflict: 'client_id,url' }
    )

  // Keep clients.website_url in sync for the first/primary URL (backward compat)
  await svc
    .from('clients')
    .update({
      website_url: url,
      website_scrape_status: 'scraping',
      website_scrape_error: null,
    })
    .eq('id', clientId)

  // ── Scrape with timeout ───────────────────────────────────────────────────
  let scrapeResult: Awaited<ReturnType<typeof scrapeWebsite>>
  try {
    scrapeResult = await Promise.race([
      scrapeWebsite(url, niche),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Scrape timed out after 45s')), SCRAPE_TIMEOUT_MS)
      ),
    ])
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Scrape failed'
    console.warn(`[scrape-website] Timeout or crash | bucket=timeout | url=${url} | error=${errorMsg}`)

    const failedAt = new Date().toISOString()
    await Promise.all([
      svc.from('client_website_sources')
        .update({ scrape_status: 'failed', scrape_error: errorMsg, last_scraped_at: failedAt })
        .eq('client_id', clientId).eq('url', url),
      svc.from('clients')
        .update({ website_scrape_status: 'failed', website_scrape_error: errorMsg, website_last_scraped_at: failedAt })
        .eq('id', clientId),
    ])

    return NextResponse.json({ error: errorMsg, failureBucket: 'timeout' }, { status: 502 })
  }

  // ── Log scraper result ──────────────────────────────────────────────────
  console.log(
    `[scrape-website] Scraper returned | bucket=${scrapeResult.failureBucket} | facts=${scrapeResult.businessFacts.length} | qa=${scrapeResult.extraQa.length} | tags=${scrapeResult.serviceTags.length} | citedTarget=${scrapeResult.citedTargetUrl ?? 'n/a'} | url=${url}`
  )

  // ── Check for empty result ────────────────────────────────────────────────
  const isEmpty =
    scrapeResult.businessFacts.length === 0 &&
    scrapeResult.extraQa.length === 0 &&
    scrapeResult.serviceTags.length === 0

  if (isEmpty) {
    const bucket = scrapeResult.failureBucket !== 'success' ? scrapeResult.failureBucket : 'empty_content'
    const errorMsg = `Scrape returned no extractable content (${bucket})`
    const failedAt = new Date().toISOString()

    await Promise.all([
      svc.from('client_website_sources')
        .update({ scrape_status: 'failed', scrape_error: errorMsg, last_scraped_at: failedAt })
        .eq('client_id', clientId).eq('url', url),
      svc.from('clients')
        .update({ website_scrape_status: 'failed', website_scrape_error: errorMsg, website_last_scraped_at: failedAt })
        .eq('id', clientId),
    ])

    return NextResponse.json(
      {
        preview: null,
        url,
        scrapedAt: failedAt,
        status: 'failed' as const,
        failureBucket: bucket,
      },
      { status: 200 }
    )
  }

  // ── Normalize ─────────────────────────────────────────────────────────────
  const { result: preview, stats } = normalizeExtraction(
    scrapeResult.businessFacts,
    scrapeResult.extraQa,
    scrapeResult.serviceTags,
    scrapeResult.warnings,
  )

  // ── Log pre/post normalizer counts ────────────────────────────────────────
  console.log(
    `[scrape-website] Pre-normalizer: ${stats.preFilterFacts} facts, ${stats.preFilterQa} QA | Post-normalizer: ${stats.postFilterFacts} facts, ${stats.postFilterQa} QA | Removed: ${stats.removedFacts.length} facts, ${stats.removedQa.length} QA`
  )

  if (stats.preFilterFacts > 0 && stats.postFilterFacts === 0) {
    console.warn(
      `[scrape-website] normalized_to_zero | All ${stats.preFilterFacts} facts were filtered out | removed: ${stats.removedFacts.map(f => `"${f.slice(0, 80)}"`).join(', ')}`
    )
  }
  if (stats.preFilterQa > 0 && stats.postFilterQa === 0) {
    console.warn(
      `[scrape-website] normalized_to_zero_qa | All ${stats.preFilterQa} QA pairs were filtered out`
    )
  }

  const scrapedAt = new Date().toISOString()

  // ── Update source record to extracted ────────────────────────────────────
  await Promise.all([
    svc.from('client_website_sources')
      .update({ scrape_status: 'extracted', scrape_error: null, last_scraped_at: scrapedAt })
      .eq('client_id', clientId).eq('url', url),
    // Backward compat: keep clients row in sync
    svc.from('clients')
      .update({
        website_knowledge_preview: preview as unknown as Record<string, unknown>,
        website_scrape_status: 'extracted',
        website_last_scraped_at: scrapedAt,
        website_scrape_pages: [url],
        website_scrape_error: null,
      })
      .eq('id', clientId),
  ])

  if (scope.guard.isCrossClient) {
    void auditAdminWrite({
      scope,
      route: '/api/dashboard/scrape-website',
      method: 'POST',
      payload: { client_id: clientId, url, status: 'extracted' },
    })
  }

  return NextResponse.json({
    preview,
    url,
    scrapedAt,
    status: 'extracted' as const,
    failureBucket: scrapeResult.failureBucket,
    citedTargetUrl: scrapeResult.citedTargetUrl,
    stats: {
      preFilterFacts: stats.preFilterFacts,
      postFilterFacts: stats.postFilterFacts,
      preFilterQa: stats.preFilterQa,
      postFilterQa: stats.postFilterQa,
      removedFacts: stats.removedFacts.length,
      removedQa: stats.removedQa.length,
    },
  })
}
