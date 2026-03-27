/**
 * GET /api/onboard/places-autocomplete?input={text}&sessiontoken={uuid}
 *
 * Proxies Google Places Autocomplete API for business search during onboarding.
 * Returns up to 5 place predictions.
 * Public — no auth. Rate limit: 10/min/IP.
 * If GOOGLE_PLACES_API_KEY is not set, returns { available: false }.
 */

import { NextRequest, NextResponse } from 'next/server'
import { SlidingWindowRateLimiter } from '@/lib/rate-limiter'

const limiter = new SlidingWindowRateLimiter(10, 60 * 1000)

interface Prediction {
  place_id: string
  description: string
  structured_formatting: {
    main_text: string
    secondary_text?: string
  }
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
  const input = searchParams.get('input')?.trim()
  const sessiontoken = searchParams.get('sessiontoken')?.trim()

  if (!input) {
    return NextResponse.json({ error: 'input parameter is required' }, { status: 400 })
  }

  try {
    const params = new URLSearchParams({
      input,
      types: 'establishment',
      key: apiKey,
    })
    if (sessiontoken) params.set('sessiontoken', sessiontoken)

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`
    const res = await fetch(url)

    if (!res.ok) {
      console.error(`[places-autocomplete] API error: ${res.status}`)
      return NextResponse.json({ available: true, predictions: [] })
    }

    const data = await res.json() as { predictions: Prediction[]; status: string }

    limiter.record(ip)

    return NextResponse.json({
      available: true,
      predictions: (data.predictions || []).slice(0, 5).map(p => ({
        place_id: p.place_id,
        description: p.description,
        main_text: p.structured_formatting.main_text,
        secondary_text: p.structured_formatting.secondary_text ?? '',
      })),
    })
  } catch (err) {
    console.error('[places-autocomplete] Error:', err)
    return NextResponse.json({ available: true, predictions: [] })
  }
}
