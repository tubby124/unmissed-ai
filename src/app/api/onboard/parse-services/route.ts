/**
 * POST /api/onboard/parse-services
 *
 * D126 — Freeform service intake parser.
 * Takes a plain-English description of a business's services and returns
 * a structured array of service drafts via Haiku.
 *
 * Public — no auth. Rate limited 10/IP/min.
 * Returns [] on any error (never throws to the client).
 */

import { NextRequest, NextResponse } from 'next/server'
import { SlidingWindowRateLimiter } from '@/lib/rate-limiter'

const limiter = new SlidingWindowRateLimiter(10, 60 * 1000)

interface ServiceDraftResult {
  name: string
  description?: string
  price?: string
  duration_mins?: number | null
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!limiter.check(ip).allowed) {
    return NextResponse.json({ services: [] }, { status: 429 })
  }

  let text: string
  try {
    const body = await req.json()
    text = (body.text as string)?.trim() || ''
  } catch {
    return NextResponse.json({ services: [] }, { status: 400 })
  }

  if (!text) return NextResponse.json({ services: [] })

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json({ services: [] })
  }

  const prompt = `Extract a list of services from this business description. Return JSON only — an array of objects with: name (string, required), description (string, brief 1 sentence, optional), price (string, e.g. "from $80" or "free" or "" if unknown, optional), duration_mins (number or null, optional).

Business description: "${text}"

Return ONLY valid JSON array, no markdown, no explanation. Example: [{"name":"Oil change","description":"Full synthetic oil change with filter","price":"from $65","duration_mins":30}]`

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4-5',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      console.warn('[parse-services] OpenRouter error:', res.status)
      return NextResponse.json({ services: [] })
    }

    const data = await res.json()
    const raw = (data.choices?.[0]?.message?.content ?? '').trim()

    // Extract JSON array from response
    const arrayMatch = raw.match(/\[[\s\S]*\]/)
    if (!arrayMatch) return NextResponse.json({ services: [] })

    let parsed: unknown[]
    try {
      parsed = JSON.parse(arrayMatch[0])
    } catch {
      return NextResponse.json({ services: [] })
    }

    // Validate and sanitize each item
    const services: ServiceDraftResult[] = []
    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) continue
      const s = item as Record<string, unknown>
      if (typeof s.name !== 'string' || !s.name.trim()) continue
      const draft: ServiceDraftResult = { name: s.name.trim() }
      if (typeof s.description === 'string' && s.description.trim()) {
        draft.description = s.description.trim().slice(0, 200)
      }
      if (typeof s.price === 'string' && s.price.trim()) {
        draft.price = s.price.trim().slice(0, 100)
      }
      if (s.duration_mins !== null && s.duration_mins !== undefined) {
        const d = Number(s.duration_mins)
        if (Number.isFinite(d) && d > 0 && d <= 480) {
          draft.duration_mins = Math.round(d)
        }
      }
      services.push(draft)
    }

    limiter.record(ip)
    return NextResponse.json({ services })
  } catch (err) {
    if (err instanceof Error && err.name !== 'AbortError') {
      console.warn('[parse-services] fetch error:', err.message)
    }
    return NextResponse.json({ services: [] })
  }
}
