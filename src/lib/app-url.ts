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

// Used for Ultravox agent tool baseUrlPattern values — must be a publicly reachable https URL.
// Falls back to the Railway URL so that creating agents locally still registers working webhooks.
// Set AGENT_WEBHOOK_BASE on Railway if the primary hostname ever changes (domain migration).
export const AGENT_WEBHOOK_BASE = (
  process.env.AGENT_WEBHOOK_BASE || 'https://unmissed-ai-production.up.railway.app'
).replace(/\/$/, '')

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://unmissed.ai'
).replace(/\/$/, '')
