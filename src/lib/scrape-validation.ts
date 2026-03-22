/**
 * scrape-validation.ts — Shape validation for WebsiteScrapeResult before chunk seeding.
 *
 * Called in provision/trial and create-public-checkout before seeding knowledge chunks.
 * Invalid shape → fall back to raw scrape (prevents malformed client data from poisoning KB).
 */

import type { WebsiteScrapeResult } from '@/types/onboarding'

/**
 * Validates the runtime shape of a WebsiteScrapeResult.
 * Returns true only if all required fields have correct types.
 */
export function validateScrapeResult(data: unknown): data is WebsiteScrapeResult {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>

  if (!Array.isArray(d.businessFacts) || !d.businessFacts.every((f: unknown) => typeof f === 'string')) return false
  if (!Array.isArray(d.approvedFacts) || !d.approvedFacts.every((f: unknown) => typeof f === 'boolean')) return false
  if (!Array.isArray(d.extraQa) || !d.extraQa.every((qa: unknown) =>
    qa && typeof qa === 'object' && typeof (qa as Record<string, unknown>).q === 'string' && typeof (qa as Record<string, unknown>).a === 'string'
  )) return false
  if (!Array.isArray(d.approvedQa) || !d.approvedQa.every((f: unknown) => typeof f === 'boolean')) return false

  // serviceTags is optional — tolerate missing (older data), but reject non-array if present
  if (d.serviceTags !== undefined && (!Array.isArray(d.serviceTags) || !d.serviceTags.every((t: unknown) => typeof t === 'string'))) return false

  return true
}
