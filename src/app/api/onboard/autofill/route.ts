/**
 * POST /api/onboard/autofill
 * Public — no auth. Scrapes a business website and extracts hours + services.
 * Body: { url: string }
 * Returns: { hours?: string, services?: string, faqs?: Array<{question: string, answer: string}> }
 * Times out after 8s. Returns {} on any failure.
 */
import { NextRequest, NextResponse } from 'next/server'
import { scrapeAndExtract } from '@/lib/firecrawl'

const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT = 5
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

async function extractBusinessInfo(markdown: string): Promise<{ hours?: string; services?: string; faqs?: Array<{question: string; answer: string}> }> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey || !markdown) return {}
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4.5',
        messages: [{
          role: 'user',
          content: `From this website content, extract:
1. Business hours (as a brief string like "Mon–Fri 9am–5pm, Sat 10am–2pm") — return null if not found
2. Main services offered (as a comma-separated list, max 10 items) — return null if not found
3. Top 3 FAQ questions and answers callers might ask — return null if not enough content

Return ONLY valid JSON: {"hours": "...", "services": "...", "faqs": [{"question": "...", "answer": "..."}]}
Use null for hours/services if not found. Use null for faqs if there isn't enough content to generate good FAQs. Never invent answers — only extract what is clearly stated on the website.

Website content:
${markdown.slice(0, 3000)}`,
        }],
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
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') return NextResponse.json({})

    // Basic URL validation
    try { new URL(url) } catch { return NextResponse.json({}) }

    // 8s timeout
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)

    try {
      const markdown = await scrapeAndExtract(url)
      clearTimeout(timer)
      if (!markdown) return NextResponse.json({})

      const extracted = await extractBusinessInfo(markdown)
      recordUsage(ip)
      return NextResponse.json(extracted || {})
    } catch {
      clearTimeout(timer)
      return NextResponse.json({})
    }
  } catch {
    return NextResponse.json({})
  }
}
