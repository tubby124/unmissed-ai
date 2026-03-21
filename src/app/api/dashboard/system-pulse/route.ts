import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/dashboard/system-pulse
 * Auth: Supabase session (S13g)
 */

interface PulseResult {
  ok: boolean
  ts: number
  supabase: 'ok' | string
  agents: Record<string, 'ok' | string>
}

// In-memory cache with 60s TTL
let cachedResult: PulseResult | null = null
let cachedAt = 0
const CACHE_TTL_MS = 60_000

export async function GET(_request: NextRequest) {
  const supabaseAuth = await createServerClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = Date.now()

  // Return cached result if within TTL
  if (cachedResult && now - cachedAt < CACHE_TTL_MS) {
    return NextResponse.json(cachedResult, { status: cachedResult.ok ? 200 : 503 })
  }

  const result: PulseResult = { ok: true, ts: now, supabase: 'ok', agents: {} }

  try {
    // Platform health: single lightweight Supabase query
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('clients')
      .select('slug, ultravox_agent_id')
      .eq('status', 'active')
      .limit(10)

    if (error) throw error

    // Agent exceptions: only flag agents that are DOWN
    // Check publishedRevisionId — missing = flagged
    const agentClients = (data ?? []).filter(c => c.ultravox_agent_id)

    await Promise.all(agentClients.map(async (c) => {
      try {
        const res = await fetch(`https://api.ultravox.ai/api/agents/${c.ultravox_agent_id}`, {
          headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY! },
          signal: AbortSignal.timeout(5000),
        })
        if (!res.ok) {
          result.agents[c.slug] = `http_${res.status}`
          result.ok = false
          return
        }
        const body = await res.json()
        if (body.publishedRevisionId) {
          result.agents[c.slug] = 'ok'
        } else {
          result.agents[c.slug] = 'no_published_revision'
          result.ok = false
        }
      } catch (err) {
        result.agents[c.slug] = `error:${err instanceof Error ? err.message : String(err)}`
        result.ok = false
      }
    }))
  } catch (err) {
    result.supabase = `error:${err instanceof Error ? err.message : String(err)}`
    result.ok = false
  }

  // Cache the result
  cachedResult = result
  cachedAt = now

  return NextResponse.json(result, { status: result.ok ? 200 : 503 })
}
