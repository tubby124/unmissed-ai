/**
 * POST /api/onboard/autofill
 * Public — no auth. Scrapes a business website and extracts hours + services.
 * Body: { url: string }
 * Returns: { hours?: string, services?: string }
 * Times out after 8s. Returns {} on any failure.
 */
import { NextRequest, NextResponse } from 'next/server'
import { scrapeAndExtract } from '@/lib/firecrawl'

async function extractHoursAndServices(markdown: string): Promise<{ hours?: string; services?: string }> {
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
2. Main services offered (as a comma-separated list) — return null if not found

Return ONLY valid JSON: {"hours": "...", "services": "..."}
Use null for any field you cannot find.

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
    }
  } catch {
    return {}
  }
}

export async function POST(req: NextRequest) {
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

      const extracted = await extractHoursAndServices(markdown)
      return NextResponse.json(extracted || {})
    } catch {
      clearTimeout(timer)
      return NextResponse.json({})
    }
  } catch {
    return NextResponse.json({})
  }
}
