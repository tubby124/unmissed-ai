/**
 * scrape-validation.ts — Shape + parity validation for WebsiteScrapeResult and ApprovedPackage.
 *
 * Called in provision/trial and create-public-checkout before seeding knowledge chunks.
 * Invalid shape → fall back to raw scrape (prevents malformed client data from poisoning KB).
 *
 * SCRAPE8: Added approval-array parity checks and validateApprovedPackage() for the
 * dashboard approve route. Mismatched approval arrays previously resolved to
 * `undefined !== false` = `true`, silently including unapproved items.
 */

import type { WebsiteScrapeResult } from '@/types/onboarding'

/**
 * Validates the runtime shape of a WebsiteScrapeResult.
 * Returns true only if all required fields have correct types AND approval arrays
 * have the same length as their source arrays (SCRAPE8 parity check).
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

  // SCRAPE8: Approval arrays must match source arrays in length.
  // Mismatched lengths cause silent inclusion: approvedFacts[i] === undefined → !== false → included.
  if (d.approvedFacts.length !== d.businessFacts.length) return false
  if (d.approvedQa.length !== d.extraQa.length) return false

  // serviceTags is optional — tolerate missing (older data), but reject non-array if present
  if (d.serviceTags !== undefined && (!Array.isArray(d.serviceTags) || !d.serviceTags.every((t: unknown) => typeof t === 'string'))) return false

  return true
}

// ── ApprovedPackage validation (SCRAPE8) ──────────────────────────────────────

export interface ApprovedPackageValidation {
  valid: boolean
  errors: string[]
}

/**
 * Validates the ApprovedPackage payload sent to the approve-website-knowledge route.
 * Returns structured errors so the API can return user-safe 400 responses.
 *
 * Unlike validateScrapeResult (which guards the full WebsiteScrapeResult shape for
 * onboarding seeding), this validates the post-filter payload where approval booleans
 * have already been applied — only the selected items remain.
 */
export function validateApprovedPackage(
  data: unknown,
): ApprovedPackageValidation {
  const errors: string[] = []

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['approved must be an object'] }
  }

  const d = data as Record<string, unknown>

  // businessFacts: string[]
  if (!Array.isArray(d.businessFacts)) {
    errors.push('businessFacts must be an array')
  } else {
    for (let i = 0; i < d.businessFacts.length; i++) {
      if (typeof d.businessFacts[i] !== 'string') {
        errors.push(`businessFacts[${i}] must be a string`)
        break // one error per field is enough
      }
      if (!(d.businessFacts[i] as string).trim()) {
        errors.push(`businessFacts[${i}] is empty`)
        break
      }
    }
  }

  // extraQa: { q: string, a: string }[]
  if (!Array.isArray(d.extraQa)) {
    errors.push('extraQa must be an array')
  } else {
    for (let i = 0; i < d.extraQa.length; i++) {
      const qa = d.extraQa[i]
      if (!qa || typeof qa !== 'object') {
        errors.push(`extraQa[${i}] must be an object with q and a strings`)
        break
      }
      const r = qa as Record<string, unknown>
      if (typeof r.q !== 'string' || typeof r.a !== 'string') {
        errors.push(`extraQa[${i}] must have string q and a fields`)
        break
      }
      if (!(r.q as string).trim()) {
        errors.push(`extraQa[${i}].q is empty`)
        break
      }
      if (!(r.a as string).trim()) {
        errors.push(`extraQa[${i}].a is empty`)
        break
      }
    }
  }

  // serviceTags: string[] (optional, defaults to [])
  if (d.serviceTags !== undefined) {
    if (!Array.isArray(d.serviceTags)) {
      errors.push('serviceTags must be an array')
    } else {
      for (let i = 0; i < d.serviceTags.length; i++) {
        if (typeof d.serviceTags[i] !== 'string') {
          errors.push(`serviceTags[${i}] must be a string`)
          break
        }
      }
    }
  }

  return { valid: errors.length === 0, errors }
}
