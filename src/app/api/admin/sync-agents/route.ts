/**
 * POST /api/admin/sync-agents
 *
 * Reconciles Ultravox agent callTemplate.systemPrompt against clients.system_prompt
 * in Supabase. Fixes silent drift caused by direct DB edits outside the dashboard.
 *
 * Auth: Basic (ADMIN_PASSWORD) — same gate as /api/admin/transcript
 * Optional body: { slug: "windshield-hub" } to sync one client; omit to sync all.
 *
 * Returns: { synced: [...], skipped: [...], errors: [...] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { updateAgent } from '@/lib/ultravox'

function checkAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Basic ')) return false
  const encoded = authHeader.slice(6)
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
  const [, password] = decoded.split(':')
  return password === process.env.ADMIN_PASSWORD
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="admin"' },
    })
  }

  const body = await req.json().catch(() => ({}))
  const targetSlug: string | undefined = body.slug

  const supabase = createServiceClient()

  // Fetch active clients that have an Ultravox agent
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')

  let query = supabase
    .from('clients')
    .select('id, slug, system_prompt, agent_voice_id, forwarding_number, booking_enabled, ultravox_agent_id')
    .eq('status', 'active')
    .not('ultravox_agent_id', 'is', null)

  if (targetSlug) query = query.eq('slug', targetSlug)

  const { data: clients, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!clients?.length) return NextResponse.json({ synced: [], skipped: [], errors: [], note: 'no matching clients' })

  const synced: string[] = []
  const skipped: string[] = []
  const errors: { slug: string; error: string }[] = []

  await Promise.all(clients.map(async (client) => {
    if (!client.system_prompt) {
      skipped.push(`${client.slug} (no system_prompt)`)
      return
    }

    // Fetch current prompt from Ultravox agent to compare
    try {
      const res = await fetch(`https://api.ultravox.ai/api/agents/${client.ultravox_agent_id}`, {
        headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY! },
      })

      if (!res.ok) {
        errors.push({ slug: client.slug, error: `GET agent HTTP ${res.status}` })
        return
      }

      const agentData = await res.json()
      const agentPrompt: string = agentData.callTemplate?.systemPrompt ?? ''

      // Normalize: strip the {{callerContext}} suffix for comparison against Supabase source
      const normalizedAgentPrompt = agentPrompt.replace(/\n\n\{\{callerContext\}\}$/, '')

      if (normalizedAgentPrompt === client.system_prompt) {
        skipped.push(`${client.slug} (in sync)`)
        return
      }

      // Drift detected — patch agent with Supabase version (full payload to avoid wiping callTemplate)
      console.log(`[sync-agents] Drift detected for ${client.slug} — patching agent ${client.ultravox_agent_id}`)
      const transferTool = {
        temporaryTool: {
          modelToolName: 'transferCall',
          description: 'Transfer the current call to a human agent when the caller requests it or in an emergency.',
          dynamicParameters: [
            { name: 'reason', location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string', description: 'Reason for transfer' }, required: false },
          ],
          automaticParameters: [
            { name: 'call_id', location: 'PARAMETER_LOCATION_BODY', knownValue: 'KNOWN_PARAM_CALL_ID' },
          ],
          http: {
            baseUrlPattern: `${appUrl}/api/webhook/${client.slug}/transfer`,
            httpMethod: 'POST',
            staticHeaders: { 'X-Transfer-Secret': process.env.WEBHOOK_SIGNING_SECRET ?? '' },
          },
        },
      }
      const tools = client.forwarding_number
        ? [{ toolName: 'hangUp' }, transferTool]
        : [{ toolName: 'hangUp' }]
      await updateAgent(client.ultravox_agent_id, {
        systemPrompt: client.system_prompt,
        ...(client.agent_voice_id ? { voice: client.agent_voice_id } : {}),
        tools,
        booking_enabled: client.booking_enabled ?? false,
        slug: client.slug,
      })
      synced.push(client.slug)

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push({ slug: client.slug, error: msg })
    }
  }))

  console.log(`[sync-agents] Done — synced=${synced.length} skipped=${skipped.length} errors=${errors.length}`)
  return NextResponse.json({ synced, skipped, errors })
}
