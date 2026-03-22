import { NextRequest, NextResponse } from 'next/server'
import { BRAND_NAME, BRAND_REFERER } from '@/lib/brand'

// Simple in-memory rate limiter: 5 summaries per IP per hour
const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60 * 60 * 1000

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const timestamps = rateLimitMap.get(ip) || []
  const recent = timestamps.filter(t => now - t < RATE_WINDOW_MS)
  rateLimitMap.set(ip, recent)
  return recent.length >= RATE_LIMIT
}

function recordUsage(ip: string) {
  const timestamps = rateLimitMap.get(ip) || []
  timestamps.push(Date.now())
  rateLimitMap.set(ip, timestamps)
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'

  if (isRateLimited(ip)) {
    return NextResponse.json({ summary: 'Demo summary limit reached.' }, { status: 200 })
  }

  const body = await req.json().catch(() => ({}))
  const transcript = body.transcript as string
  const demoId = body.demoId as string

  if (!transcript || transcript.trim().length < 20) {
    return NextResponse.json({
      summary: `The AI agent handled the call and would have notified the business owner immediately.`,
    })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    console.error('[demo/summarize] OPENROUTER_API_KEY not set')
    return NextResponse.json({
      summary: `The AI agent handled the call, captured key details, and would have sent an instant notification to the business owner.`,
    })
  }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': BRAND_REFERER,
        'X-Title': `${BRAND_NAME} demo summary`,
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4.5',
        messages: [
          {
            role: 'system',
            content: `You summarize demo calls in 2-3 sentences. Focus on: the caller's intent, key details captured, and outcome. Be specific and concise. Write in third person past tense. Do not mention that this was a demo.`,
          },
          {
            role: 'user',
            content: `Summarize this call:\n\n${transcript.slice(0, 3000)}`,
          },
        ],
        max_tokens: 200,
        temperature: 0,
      }),
    })

    if (!res.ok) {
      console.error(`[demo/summarize] OpenRouter HTTP ${res.status}`)
      return NextResponse.json({
        summary: `The AI agent handled the call and captured the caller's intent. A notification would have been sent to the business owner within seconds.`,
      })
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content?.trim() || ''

    if (!content) {
      return NextResponse.json({
        summary: `The AI agent handled the call and captured the caller's key details for follow-up.`,
      })
    }

    recordUsage(ip)

    console.log(`[demo/summarize] Success for demoId=${demoId || 'unknown'} — ${content.length} chars`)
    return NextResponse.json({ summary: content })
  } catch (err) {
    console.error('[demo/summarize] Error:', err)
    return NextResponse.json({
      summary: `The AI agent handled the call and would have notified the business owner with a full summary.`,
    })
  }
}
