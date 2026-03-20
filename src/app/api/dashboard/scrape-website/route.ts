import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { scrapeWebsite } from '@/lib/website-scraper'
import { normalizeExtraction } from '@/lib/knowledge-extractor'
import type { NormalizedKnowledge } from '@/lib/knowledge-extractor'

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
  // ── Auth — admin or client owner ──────────────────────────────────────────
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .single()

  if (!cu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ── Parse body ────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as { clientId?: string; url?: string }
  const clientId = body.clientId?.trim()
  const url = body.url?.trim()

  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })
  if (!isValidHttpUrl(url)) return NextResponse.json({ error: 'url must be a valid http or https URL' }, { status: 400 })

  // ── Permission check ──────────────────────────────────────────────────────
  if (cu.role !== 'admin' && cu.client_id !== clientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const svc = createServiceClient()

  // ── Get client niche ──────────────────────────────────────────────────────
  const { data: client, error: clientErr } = await svc
    .from('clients')
    .select('niche')
    .eq('id', clientId)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const niche = client.niche || 'other'

  // ── Mark as scraping ──────────────────────────────────────────────────────
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
    await svc
      .from('clients')
      .update({
        website_scrape_status: 'failed',
        website_scrape_error: errorMsg,
        website_last_scraped_at: new Date().toISOString(),
      })
      .eq('id', clientId)

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
    await svc
      .from('clients')
      .update({
        website_scrape_status: 'failed',
        website_scrape_error: `Scrape returned no extractable content (${bucket})`,
        website_last_scraped_at: new Date().toISOString(),
      })
      .eq('id', clientId)

    return NextResponse.json(
      {
        preview: null,
        url,
        scrapedAt: new Date().toISOString(),
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

  // ── Store preview in client row ───────────────────────────────────────────
  await svc
    .from('clients')
    .update({
      website_knowledge_preview: preview as unknown as Record<string, unknown>,
      website_scrape_status: 'extracted',
      website_last_scraped_at: scrapedAt,
      website_scrape_pages: [url],
      website_scrape_error: null,
    })
    .eq('id', clientId)

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
