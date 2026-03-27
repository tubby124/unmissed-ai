/**
 * POST /api/onboard/autofill
 * Public — no auth. Reads a business website via Sonar and extracts hours + services.
 * Body: { url: string }
 * Returns: { hours?: string, services?: string, faqs?: Array<{question: string, answer: string}> }
 * Times out after 12s. Returns {} on any failure.
 */
import { NextRequest, NextResponse } from 'next/server'
import { SlidingWindowRateLimiter } from '@/lib/rate-limiter'

const limiter = new SlidingWindowRateLimiter(5, 60 * 1000)

async function extractBusinessInfo(url: string): Promise<{ hours?: string; services?: string; faqs?: Array<{question: string; answer: string}> }> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return {}
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'perplexity/sonar',
        messages: [{
          role: 'user',
          content: `Visit this business website and extract structured information: ${url}

From the page content, extract:
1. Business hours (as a brief string like "Mon-Fri 9am-5pm, Sat 10am-2pm") — return null if not found
2. Main services offered (as a comma-separated list, max 10 items) — return null if not found
3. Top 3 FAQ questions and answers callers might ask — return null if not enough content

Return ONLY valid JSON: {"hours": "...", "services": "...", "faqs": [{"question": "...", "answer": "..."}]}
Use null for hours/services if not found. Use null for faqs if there isn't enough content to generate good FAQs. Never invent answers — only extract what is clearly stated on the website.`,
        }],
        max_tokens: 600,
        response_format: { type: 'json_object' },
      }),
    })
    if (!res.ok) return {}
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return {}
    const parsed = JSON.parse(content)
    return {
      hours: parsed.hours || undefined,
      services: parsed.services || undefined,
      faqs: Array.isArray(parsed.faqs) && parsed.faqs.length > 0 ? parsed.faqs : undefined,
    }
  } catch {
    return {}
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip') || 'unknown'
  if (!limiter.check(ip).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') return NextResponse.json({})

    // Basic URL validation
    try { new URL(url) } catch { return NextResponse.json({}) }

    // 12s timeout (Sonar needs a bit more than raw scraper)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)

    try {
      const extracted = await extractBusinessInfo(url)
      clearTimeout(timer)
      if (!extracted || (!extracted.hours && !extracted.services && !extracted.faqs)) {
        return NextResponse.json({})
      }
      limiter.record(ip)
      return NextResponse.json(extracted)
    } catch {
      clearTimeout(timer)
      return NextResponse.json({})
    }
  } catch {
    return NextResponse.json({})
  }
}
