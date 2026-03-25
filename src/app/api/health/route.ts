import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, unknown> = { ts: Date.now() }
  let allOk = true

  // ── Supabase connectivity ─────────────────────────────────────────────────
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('clients')
      .select('id, ultravox_agent_id')
      .eq('status', 'active')
      .limit(10)

    if (error) throw error
    checks.supabase = 'ok'

    // ── Ultravox agent liveness (informational only — does not affect allOk) ─
    const agentClients = (data ?? []).filter(c => c.ultravox_agent_id)
    let agentsHealthy = 0

    await Promise.all(agentClients.map(async (c) => {
      try {
        const res = await fetch(`https://api.ultravox.ai/api/agents/${c.ultravox_agent_id}`, {
          headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY! },
          signal: AbortSignal.timeout(5000),
        })
        if (!res.ok) return
        const body = await res.json()
        if (body.publishedRevisionId) agentsHealthy++
      } catch {
        // Ultravox degraded — informational only, never fail the healthcheck
      }
    }))

    checks.agents_checked = agentClients.length
    checks.agents_healthy = agentsHealthy

  } catch (err) {
    checks.supabase = `error:${err instanceof Error ? err.message : String(err)}`
    allOk = false
  }

  checks.status = allOk ? 'ok' : 'degraded'
  return NextResponse.json(checks, { status: allOk ? 200 : 503 })
}
