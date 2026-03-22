/**
 * Centralized brand constants.
 *
 * Single source of truth for brand name, emails, and copy.
 * When migrating domains (S15), update these constants — one file, not 78.
 *
 * Safe to import from both server and client components.
 */

export const BRAND_NAME = 'unmissed.ai'
export const BRAND_DOMAIN = 'unmissed.ai'
export const BRAND_PRODUCT = 'AI Receptionist'
export const BRAND_TAGLINE = 'AI receptionist for service businesses'

export const SUPPORT_EMAIL = `support@${BRAND_DOMAIN}`
export const NOTIFICATIONS_EMAIL = `notifications@${BRAND_DOMAIN}`
export const HELLO_EMAIL = `hello@${BRAND_DOMAIN}`

/** User-Agent string for outbound HTTP requests (scraper, enrichment) */
export const BRAND_USER_AGENT = `Mozilla/5.0 (compatible; ${BRAND_NAME}-scraper/1.0; +https://${BRAND_DOMAIN})`

/** HTTP-Referer header for third-party APIs (OpenRouter, Firecrawl) */
export const BRAND_REFERER = `https://${BRAND_DOMAIN}`
