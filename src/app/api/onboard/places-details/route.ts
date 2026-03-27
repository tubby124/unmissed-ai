/**
 * GET /api/onboard/places-details?place_id={id}&sessiontoken={uuid}
 *
 * Proxies Google Places Details API for business info autofill during onboarding.
 * Returns name, address, phone, website, hours, rating, reviewCount, photoUrl.
 * Public — no auth. Rate limit: 10/min/IP.
 * If GOOGLE_PLACES_API_KEY is not set, returns { available: false }.
 */

import { NextRequest, NextResponse } from 'next/server'
import { SlidingWindowRateLimiter } from '@/lib/rate-limiter'

const limiter = new SlidingWindowRateLimiter(10, 60 * 1000)

interface PlaceDetails {
  name?: string
  formatted_address?: string
  formatted_phone_number?: string
  website?: string
  opening_hours?: { weekday_text?: string[] }
  rating?: number
  user_ratings_total?: number
  photos?: { photo_reference: string }[]
  business_status?: string
  types?: string[]
  editorial_summary?: { overview?: string }
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip') || 'unknown'

  if (!limiter.check(ip).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return NextResponse.json({ available: false })
  }

  const { searchParams } = req.nextUrl
  const place_id = searchParams.get('place_id')?.trim()
  const sessiontoken = searchParams.get('sessiontoken')?.trim()

  if (!place_id) {
    return NextResponse.json({ error: 'place_id parameter is required' }, { status: 400 })
  }

  try {
    const params = new URLSearchParams({
      place_id,
      fields: 'name,formatted_address,formatted_phone_number,website,opening_hours,rating,user_ratings_total,photos,business_status,types,editorial_summary',
      key: apiKey,
    })
    if (sessiontoken) params.set('sessiontoken', sessiontoken)

    const url = `https://maps.googleapis.com/maps/api/place/details/json?${params}`
    const res = await fetch(url)

    if (!res.ok) {
      console.error(`[places-details] API error: ${res.status}`)
      return NextResponse.json({ available: true, result: null })
    }

    const data = await res.json() as { result?: PlaceDetails; status: string }
    const r = data.result

    if (!r) {
      limiter.record(ip)
      return NextResponse.json({ available: true, result: null })
    }

    // Build photo URL if available
    let photoUrl: string | null = null
    if (r.photos?.[0]?.photo_reference) {
      photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${r.photos[0].photo_reference}&key=${apiKey}`
    }

    limiter.record(ip)

    return NextResponse.json({
      available: true,
      result: {
        name: r.name ?? null,
        address: r.formatted_address ?? null,
        phone: r.formatted_phone_number ?? null,
        website: r.website ?? null,
        hours: r.opening_hours?.weekday_text ?? null,
        rating: r.rating ?? null,
        reviewCount: r.user_ratings_total ?? null,
        photoUrl,
        status: r.business_status ?? null,
        types: r.types ?? [],
        editorialSummary: r.editorial_summary?.overview ?? null,
      },
    })
  } catch (err) {
    console.error('[places-details] Error:', err)
    return NextResponse.json({ available: true, result: null })
  }
}
