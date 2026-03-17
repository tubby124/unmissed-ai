/**
 * GET /api/onboard/places-lookup?q={name}&city={city}
 *
 * Proxies Google Places Text Search API for business autofill during onboarding.
 * Returns name, address, phone, website, hours from Google Places.
 *
 * Public — no auth (used during onboarding wizard).
 * Rate limit: 10/min/IP.
 *
 * If GOOGLE_PLACES_API_KEY is not set, returns { available: false } (200, not 500).
 */

import { NextRequest, NextResponse } from 'next/server'

const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60 * 1000 // 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const timestamps = (rateLimitMap.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS)
  rateLimitMap.set(ip, timestamps)
  return timestamps.length >= RATE_LIMIT
}

function recordUsage(ip: string) {
  const timestamps = rateLimitMap.get(ip) || []
  timestamps.push(Date.now())
  rateLimitMap.set(ip, timestamps)
}

interface PlaceResult {
  name: string
  formatted_address: string
  place_id: string
}

interface PlaceDetails {
  formatted_phone_number?: string
  website?: string
  opening_hours?: {
    weekday_text?: string[]
  }
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip') || 'unknown'

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return NextResponse.json({ available: false, error: 'Places lookup not configured' })
  }

  const { searchParams } = req.nextUrl
  const q = searchParams.get('q')?.trim()
  const city = searchParams.get('city')?.trim()

  if (!q) {
    return NextResponse.json({ error: 'q parameter is required' }, { status: 400 })
  }

  try {
    const query = city ? `${q} in ${city}` : q
    const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`

    const searchRes = await fetch(textSearchUrl)
    if (!searchRes.ok) {
      console.error(`[places-lookup] Text search API error: ${searchRes.status}`)
      return NextResponse.json({ available: true, results: [] })
    }

    const searchData = await searchRes.json() as { results: PlaceResult[]; status: string }

    if (!searchData.results || searchData.results.length === 0) {
      recordUsage(ip)
      return NextResponse.json({ available: true, results: [] })
    }

    const firstResult = searchData.results[0]

    // Follow-up Place Details call for phone, website, hours
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${firstResult.place_id}&fields=formatted_phone_number,website,opening_hours&key=${apiKey}`

    let details: PlaceDetails = {}
    try {
      const detailsRes = await fetch(detailsUrl)
      if (detailsRes.ok) {
        const detailsData = await detailsRes.json() as { result?: PlaceDetails; status: string }
        details = detailsData.result ?? {}
      }
    } catch (err) {
      console.error('[places-lookup] Details fetch failed:', err)
    }

    recordUsage(ip)
    console.log(`[places-lookup] Found: ${firstResult.name} for query="${query}"`)

    return NextResponse.json({
      available: true,
      name: firstResult.name,
      address: firstResult.formatted_address,
      phone: details.formatted_phone_number ?? null,
      website: details.website ?? null,
      hours: details.opening_hours?.weekday_text ?? null,
    })
  } catch (err) {
    console.error('[places-lookup] Unexpected error:', err)
    return NextResponse.json({ available: true, results: [] })
  }
}
