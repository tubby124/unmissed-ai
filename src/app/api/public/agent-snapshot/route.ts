/**
 * GET /api/public/agent-snapshot?clientId=xxx
 *
 * Public (no auth). Returns what the agent actually learned during provisioning:
 * services, hours, top scraped facts, knowledge count, and scrape status.
 *
 * Used by TrialSuccessScreen to show "What [AgentName] knows" without exposing
 * the system_prompt or unverified internal state.
 *
 * Authorization: clientId UUID is the "secret". All returned fields are derived
 * from public business information (GBP / website scrape / user-entered data).
 * No personal caller data, no prompt text, no system internals are returned.
 *
 * Gate: only responds for clients with status in ('active', 'setup').
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkPublicRateLimit } from '@/lib/public-rate-limiter'

export async function GET(req: NextRequest) {
  const rl = checkPublicRateLimit(req)
  if (rl) return rl
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) {
    return NextResponse.json({ error: 'clientId required' }, { status: 400 })
  }

  const supa = createServiceClient()

  // Cast to Record so TypeScript doesn't complain about columns not in the
  // auto-generated types (services_offered, business_facts, extra_qa, etc.)
  interface ClientRow {
    agent_name: string | null
    services_offered: string | null
    business_hours_weekday: string | null
    business_hours_weekend: string | null
    business_facts: string | null
    extra_qa: { q: string; a: string }[] | null
    website_scrape_status: string | null
    website_url: string | null
    status: string | null
    niche: string | null
    injected_note: string | null
    trial_expires_at: string | null
  }

  const { data: rawClient } = await supa
    .from('clients')
    .select(
      'agent_name, services_offered, business_hours_weekday, business_hours_weekend, ' +
      'business_facts, extra_qa, website_scrape_status, website_url, status, niche, ' +
      'injected_note, trial_expires_at'
    )
    .eq('id', clientId)
    .in('status', ['active', 'setup'])
    .limit(1)
    .maybeSingle()

  if (!rawClient) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const client = rawClient as unknown as ClientRow

  // ── Services ─────────────────────────────────────────────────────────────
  // Trim and cap at 100 chars so the UI doesn't overflow
  const rawServices = (client.services_offered)?.trim() ?? ''
  const servicesNote = rawServices.length > 0
    ? rawServices.slice(0, 100) + (rawServices.length > 100 ? '…' : '')
    : null

  // ── Hours ─────────────────────────────────────────────────────────────────
  const rawHours = client.business_hours_weekday?.trim() ?? ''
  const hoursNote = rawHours.length > 0 ? rawHours : null

  // ── Scraped facts ─────────────────────────────────────────────────────────
  // business_facts is a newline-separated string of fact lines.
  // Strip leading "- " or "• " bullets, return the first 3 non-empty lines.
  const rawFactsStr = client.business_facts ?? ''
  const allFacts = rawFactsStr
    .split('\n')
    .map((line: string) => line.replace(/^[-•]\s*/, '').trim())
    .filter((line: string) => line.length > 4)  // skip stubs
  const topFacts = allFacts.slice(0, 3)

  // ── FAQ pairs ─────────────────────────────────────────────────────────────
  const qaItems = Array.isArray(client.extra_qa) ? client.extra_qa : []
  const faqCount = qaItems.length

  // ── Scrape status ─────────────────────────────────────────────────────────
  // 'approved'  — user explicitly reviewed + approved facts during onboarding
  // 'extracted' — auto-scraped during provision, not yet user-reviewed
  // 'none'      — no website provided or scrape produced no content
  const scrapeStatus = client.website_scrape_status ?? 'none'

  // ── Has website ───────────────────────────────────────────────────────────
  const hasWebsite = !!(client.website_url?.trim())

  return NextResponse.json({
    servicesNote,
    hoursNote,
    topFacts,           // string[] — first 3 scraped facts (empty array if none)
    faqCount,           // number of FAQ pairs stored
    scrapeStatus,       // 'approved' | 'extracted' | 'none'
    hasWebsite,         // boolean — whether a website URL was provided
    injectedNote: client.injected_note?.trim() || null,  // current quick note (if any)
    trialExpiresAt: client.trial_expires_at || null,     // ISO string — trial end date
  })
}
