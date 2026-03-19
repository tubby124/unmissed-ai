import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { scrapeWebsite } from '@/lib/website-scraper'
import { normalizeExtraction, NormalizedKnowledge } from '@/lib/knowledge-extractor'

const SCRAPE_TIMEOUT_MS = 30_000

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
        setTimeout(() => reject(new Error('Scrape timed out after 30s')), SCRAPE_TIMEOUT_MS)
      ),
    ])
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Scrape failed'
    await svc
      .from('clients')
      .update({
        website_scrape_status: 'failed',
        website_scrape_error: errorMsg,
        website_last_scraped_at: new Date().toISOString(),
      })
      .eq('id', clientId)

    return NextResponse.json({ error: errorMsg }, { status: 502 })
  }

  // ── Check for empty result ────────────────────────────────────────────────
  const isEmpty =
    scrapeResult.businessFacts.length === 0 &&
    scrapeResult.extraQa.length === 0 &&
    scrapeResult.serviceTags.length === 0

  if (isEmpty) {
    await svc
      .from('clients')
      .update({
        website_scrape_status: 'failed',
        website_scrape_error: 'Scrape returned no extractable content',
        website_last_scraped_at: new Date().toISOString(),
      })
      .eq('id', clientId)

    return NextResponse.json(
      { preview: null, url, scrapedAt: new Date().toISOString(), status: 'failed' as const },
      { status: 200 }
    )
  }

  // ── Normalize ─────────────────────────────────────────────────────────────
  const preview: NormalizedKnowledge = normalizeExtraction(
    scrapeResult.businessFacts,
    scrapeResult.extraQa,
    scrapeResult.serviceTags,
    scrapeResult.warnings,
  )

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
  })
}
