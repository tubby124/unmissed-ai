/**
 * K2: Shared utility for seeding knowledge chunks from website scrape data.
 *
 * Extracted from duplicate ~25-line blocks in provision/trial/route.ts and
 * stripe/create-public-checkout/route.ts. Same pattern as S6a (syncClientTools)
 * and S7f (insertPromptVersion) — single source of truth prevents drift.
 *
 * K1: Raw scrape fallback now includes serviceTags (was silently lost).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { WebsiteScrapeResult } from '@/types/onboarding'
import { embedChunks, deleteClientChunks, prepareFactChunks, prepareQaChunks, prepareServiceTagChunks } from '@/lib/embeddings'
import type { ChunkInput } from '@/lib/embeddings'
import { validateScrapeResult } from '@/lib/scrape-validation'
import { syncClientTools } from '@/lib/sync-client-tools'
import type { scrapeWebsite } from '@/lib/website-scraper'

type RawScrapeResult = Awaited<ReturnType<typeof scrapeWebsite>>

export interface SeedKnowledgeParams {
  clientId: string
  clientSlug: string
  /** User-approved scrape data from onboarding preview (WebsiteScrapeResult shape) */
  scrapeData: unknown | null
  /** Raw scrape result from scrapeWebsite() — used as fallback */
  rawScrapeResult: RawScrapeResult | null
  /** Pre-filtered approved package — bypasses WebsiteScrapeResult validation.
   *  Use this from the dashboard approve route where facts/qa are already filtered by user selection. */
  approvedPackage?: { businessFacts: string[]; extraQa: { q: string; a: string }[]; serviceTags: string[] } | null
  /** Unique run ID for dedup (e.g. "trial-{intakeId}" or "checkout-{intakeId}") */
  runId: string
  /** Route label for console logs */
  routeLabel: string
  /** Optional chunk status (e.g. 'pending', 'approved'). If omitted, DB default applies. */
  chunkStatus?: string
  /** Optional trust tier (e.g. 'medium'). If omitted, DB default applies. */
  trustTier?: string
  /** Optional source URL — written to knowledge_chunks.source_url so per-URL delete works. */
  sourceUrl?: string
}

export interface SeedKnowledgeResult {
  seeded: boolean
  chunkCount: number
  stored: number
  failed: number
  errors: string[]
}

/**
 * Seeds knowledge chunks from website scrape data. Three paths:
 * 1. Valid WebsiteScrapeResult → use user-approved facts/QA/serviceTags
 * 2. Invalid WebsiteScrapeResult shape → warn + fall back to raw scrape
 * 3. No preview data → fall back to raw scrape
 *
 * K1 fix: raw scrape fallback now includes serviceTags (was silently lost).
 */
export async function seedKnowledgeFromScrape(
  svc: SupabaseClient,
  params: SeedKnowledgeParams,
): Promise<SeedKnowledgeResult> {
  const { clientId, clientSlug, scrapeData, rawScrapeResult, approvedPackage, runId, routeLabel, chunkStatus, trustTier, sourceUrl } = params
  const empty: SeedKnowledgeResult = { seeded: false, chunkCount: 0, stored: 0, failed: 0, errors: [] }

  let factsToSeed: string[] = []
  let qaToSeed: { q: string; a: string }[] = []
  let serviceTagsToSeed: string[] = []

  if (approvedPackage) {
    // Pre-filtered approved data (from dashboard approve route)
    factsToSeed = approvedPackage.businessFacts?.filter(f => f?.trim()) ?? []
    qaToSeed = approvedPackage.extraQa?.filter(q => q.q?.trim() && q.a?.trim()) ?? []
    serviceTagsToSeed = approvedPackage.serviceTags ?? []
  } else if (scrapeData && validateScrapeResult(scrapeData)) {
    // Prefer user-approved data from scrape preview
    const validated = scrapeData as WebsiteScrapeResult
    factsToSeed = validated.businessFacts.filter((_, i) => validated.approvedFacts[i] !== false)
    qaToSeed = validated.extraQa.filter((_, i) => validated.approvedQa[i] !== false)
    serviceTagsToSeed = validated.serviceTags ?? []
  } else if (scrapeData) {
    // Invalid shape — fall back to raw scrape
    console.warn(`[${routeLabel}] Invalid websiteScrapeResult shape for ${clientSlug}, falling back to raw scrape`)
    if (rawScrapeResult) {
      factsToSeed = rawScrapeResult.businessFacts || []
      qaToSeed = rawScrapeResult.extraQa || []
      // K1: raw scrape fallback now includes serviceTags
      serviceTagsToSeed = rawScrapeResult.serviceTags || []
    }
  } else if (rawScrapeResult) {
    // No preview data — use raw scrape result
    factsToSeed = rawScrapeResult.businessFacts || []
    qaToSeed = rawScrapeResult.extraQa || []
    // K1: raw scrape fallback now includes serviceTags
    serviceTagsToSeed = rawScrapeResult.serviceTags || []
  }

  if (factsToSeed.length === 0 && qaToSeed.length === 0 && serviceTagsToSeed.length === 0) {
    return empty
  }

  const chunks = [
    ...prepareFactChunks(factsToSeed.join('\n')),
    ...prepareQaChunks(qaToSeed),
    ...prepareServiceTagChunks(serviceTagsToSeed),
  ]

  if (chunks.length === 0) {
    return empty
  }

  // Apply optional status/trustTier/sourceUrl to all chunks
  if (chunkStatus || trustTier || sourceUrl) {
    for (const chunk of chunks) {
      if (chunkStatus) chunk.status = chunkStatus
      if (trustTier) chunk.trustTier = trustTier
      if (sourceUrl) chunk.source_url = sourceUrl
    }
  }

  // SCRAPE7: Remove stale website-derived chunks before reseeding.
  // Only deletes source='website_scrape' — manual, bulk_import, gap_resolution chunks are preserved.
  // SCRAPE9: deleteClientChunks now throws on DB error — abort reseed if cleanup fails
  // to prevent stale+new chunk accumulation (upsert only dedupes by content_hash).
  try {
    const deleted = await deleteClientChunks(clientId, 'website_scrape')
    if (deleted > 0) {
      console.log(`[${routeLabel}] SCRAPE7: Cleared ${deleted} stale website_scrape chunks for ${clientSlug}`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[${routeLabel}] SCRAPE7: Stale chunk cleanup failed for ${clientSlug} — aborting reseed: ${msg}`)
    return { seeded: false, chunkCount: 0, stored: 0, failed: 0, errors: [`Stale chunk cleanup failed: ${msg}`] }
  }

  const embedResult = await embedChunks(clientId, chunks, runId)
  console.log(`[${routeLabel}] Knowledge seeded: ${embedResult.stored} chunks for ${clientSlug}`)

  // Rebuild tools so queryKnowledge is registered
  await syncClientTools(svc, clientId)

  return {
    seeded: true,
    chunkCount: embedResult.stored,
    stored: embedResult.stored,
    failed: embedResult.failed,
    errors: embedResult.errors,
  }
}

// ── GBP ingestion ─────────────────────────────────────────────────────────────

export interface SeedGBPParams {
  clientId: string
  clientSlug: string
  businessName: string
  gbpSummary: string | null
  gbpRating: number | null
  gbpReviewCount: number | null
  city: string | null
  state: string | null
}

/**
 * Seeds knowledge chunks from stored GBP (Google Business Profile) data.
 * Seeded as source='gbp', status='approved', trust_tier='medium'.
 * Does NOT overwrite manual/settings_edit chunks — only replaces prior 'gbp' source chunks.
 */
export async function seedKnowledgeFromGBP(
  svc: SupabaseClient,
  params: SeedGBPParams,
): Promise<SeedKnowledgeResult> {
  const { clientId, clientSlug, businessName, gbpSummary, gbpRating, gbpReviewCount, city, state } = params
  const empty: SeedKnowledgeResult = { seeded: false, chunkCount: 0, stored: 0, failed: 0, errors: [] }

  const factLines: string[] = []

  if (gbpSummary?.trim()) {
    factLines.push(gbpSummary.trim())
  }
  if (city || state) {
    const location = [city, state].filter(Boolean).join(', ')
    factLines.push(`${businessName} is located in ${location}.`)
  }
  if (gbpRating != null && gbpReviewCount != null && gbpReviewCount > 0) {
    factLines.push(`${businessName} has a ${gbpRating} star rating based on ${gbpReviewCount} customer reviews on Google.`)
  }

  if (factLines.length === 0) return empty

  const chunks: ChunkInput[] = factLines.map(content => ({
    content,
    chunkType: 'fact' as const,
    source: 'gbp',
    status: 'approved',
    trustTier: 'medium',
  }))

  try {
    const deleted = await deleteClientChunks(clientId, 'gbp')
    if (deleted > 0) {
      console.log(`[seed-knowledge/gbp] Cleared ${deleted} stale gbp chunks for ${clientSlug}`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[seed-knowledge/gbp] Stale chunk cleanup failed for ${clientSlug} — aborting: ${msg}`)
    return { seeded: false, chunkCount: 0, stored: 0, failed: 0, errors: [`Stale chunk cleanup failed: ${msg}`] }
  }

  const embedResult = await embedChunks(clientId, chunks, `gbp-seed-${Date.now()}`)
  console.log(`[seed-knowledge/gbp] GBP knowledge seeded: ${embedResult.stored} chunks for ${clientSlug}`)

  await syncClientTools(svc, clientId)

  return {
    seeded: true,
    chunkCount: embedResult.stored,
    stored: embedResult.stored,
    failed: embedResult.failed,
    errors: embedResult.errors,
  }
}
