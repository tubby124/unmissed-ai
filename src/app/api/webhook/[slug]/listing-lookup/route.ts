import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 10

/**
 * lookupListing tool handler — proxies to the client's own listing-search API
 * (clients.listing_search_url) and reshapes results for a voice agent.
 *
 * The upstream API (e.g. hasansharif.ca /api/listings/search) only returns
 * publicly visible statuses (Active / ComingSoon / ActiveUnderContract /
 * Pending), so "found" == "on the market". Zero matches means sold, expired,
 * or misheard — the _instruction tells the agent how to recover.
 *
 * Always returns 200 with an _instruction on soft failures: a non-2xx here
 * makes Ultravox surface a raw tool error to the model instead of guidance.
 */

type UpstreamListing = {
  listing_key: string
  slug: string | null
  unparsed_address: string | null
  city: string
  list_price: number
  bedrooms_total: number | null
  bathrooms_total_integer: number | null
  property_subtype: string | null
  match_source?: string
}

// Only the deterministic lanes are trustworthy for confirming a SPECIFIC property
// over the phone. The upstream 'filter' lane returns generic browse results (a bare
// community name matches 1,000+ listings region-wide) and 'semantic' is fuzzy —
// reading either back as "the" property would confidently confirm the wrong house.
const TRUSTED_SOURCES = new Set(['mls', 'address'])

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Auth — same shared secret pattern as the sms/transfer tool routes
  const secret = req.headers.get('x-tool-secret')
  const expected = process.env.WEBHOOK_SIGNING_SECRET
  if (!expected || secret !== expected) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  let query = ''
  try {
    const body = await req.json()
    query = String(body.query ?? '').trim().slice(0, 120)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (query.length < 2) {
    return NextResponse.json({
      matches: [],
      _instruction: 'No usable address or MLS number. Ask the caller for the street address or MLS number of the property.',
    })
  }

  const supabase = createServiceClient()
  const { data: client } = await supabase
    .from('clients')
    .select('id, listing_search_url')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (!client?.listing_search_url) {
    return NextResponse.json({
      matches: [],
      _instruction: 'Listing lookup is not set up on this line. Take a message with the property address instead.',
    })
  }

  const search = async (q: string): Promise<{ listings?: UpstreamListing[]; degraded?: boolean }> => {
    const url = `${client.listing_search_url}?q=${encodeURIComponent(q)}&limit=3`
    // 4s per fetch: worst case is two serial fetches (primary + number-stripped
    // retry) — must stay under the route's 10s caller-facing budget.
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(4_000),
    })
    if (!res.ok) throw new Error(`upstream ${res.status}`)
    return res.json()
  }

  let upstream: { listings?: UpstreamListing[]; degraded?: boolean }
  let hits: UpstreamListing[] = []
  try {
    upstream = await search(query)
    hits = (upstream.listings ?? []).filter(l => TRUSTED_SOURCES.has(l.match_source ?? ''))
    // Recall fallback: "50 Royston" can miss while "royston" hits — the upstream
    // address lane is strict about number+name pairing. Retry street-name-only.
    const numberStripped = query.replace(/^\s*\d+[\s,-]*/, '').trim()
    if (hits.length === 0 && numberStripped.length >= 3 && numberStripped !== query) {
      const retry = await search(numberStripped)
      hits = (retry.listings ?? []).filter(l => TRUSTED_SOURCES.has(l.match_source ?? ''))
      if (retry.degraded) upstream.degraded = true
    }
  } catch (err) {
    console.error(`[listing-lookup] slug=${slug} query="${query}" upstream failed:`, err instanceof Error ? err.message : err)
    return NextResponse.json({
      matches: [],
      _instruction: 'The lookup failed — do NOT say the listing is sold. Apologize briefly and offer to have an agent text the details shortly. Collect the caller\'s name.',
    })
  }

  // Upstream outage masquerading as zero results — never tell a caller "sold" on a DB blip
  if (upstream.degraded && hits.length === 0) {
    return NextResponse.json({
      matches: [],
      _instruction: 'The lookup system is having trouble — do NOT say the listing is sold. Offer to have an agent follow up with the details. Collect the caller\'s name.',
    })
  }

  let siteOrigin = ''
  try { siteOrigin = new URL(client.listing_search_url).origin } catch { /* matches keep null url */ }

  const matches = hits.slice(0, 3).map((l) => ({
    address: l.unparsed_address || 'address unavailable',
    city: l.city,
    price: typeof l.list_price === 'number' ? `$${Math.round(l.list_price).toLocaleString('en-CA')}` : null,
    beds: l.bedrooms_total,
    baths: l.bathrooms_total_integer,
    type: l.property_subtype,
    status: 'on the market',
    url: siteOrigin && (l.slug || l.listing_key) ? `${siteOrigin}/listings/${l.slug || l.listing_key}` : null,
  }))

  const _instruction = matches.length === 0
    ? 'No active listing matched. It may have just sold, or the address was misheard — ask the caller to spell the street name or give the MLS number. If still nothing, say it might have sold and offer to have an agent follow up with similar listings. Collect their name.'
    : matches.length === 1
      ? 'One match. Confirm the street address back to the caller, tell them it is still on the market, share the asking price if they ask, then offer to set up a showing.'
      : 'Multiple possible matches. Read just the street addresses back and ask the caller which one they mean. Then confirm that one and offer a showing.'

  // Query content stays out of the success log — address queries are light PII under log retention
  console.log(`[listing-lookup] slug=${slug} queryLen=${query.length} matches=${matches.length}`)
  return NextResponse.json({ matches, _instruction })
}
