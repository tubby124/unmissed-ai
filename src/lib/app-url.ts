/**
 * Centralized URL constants.
 *
 * Single source of truth for production URLs.
 * When migrating domains (S15), update fallbacks here — one file, not 40+.
 *
 * APP_URL  — API webhooks, Twilio callbacks, Stripe redirects, internal links
 * SITE_URL — SEO canonicals, sitemap, robots.txt, OG tags (public-facing domain)
 */
export const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL || 'https://unmissed-ai-production.up.railway.app'
).replace(/\/$/, '')

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://unmissed.ai'
).replace(/\/$/, '')
