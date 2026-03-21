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
import { updateAgent, buildAgentTools } from '@/lib/ultravox'

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
  const force: boolean = body.force === true

  const supabase = createServiceClient()

  // Fetch active clients that have an Ultravox agent
  let query = supabase
    .from('clients')
    .select('id, slug, system_prompt, agent_voice_id, forwarding_number, booking_enabled, ultravox_agent_id, transfer_conditions, sms_enabled, knowledge_backend')
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

      if (!force && normalizedAgentPrompt === client.system_prompt) {
        skipped.push(`${client.slug} (in sync)`)
        return
      }

      // Drift detected — patch agent with Supabase version (all flags → updateAgent handles tool construction)
      console.log(`[sync-agents] Drift detected for ${client.slug} — patching agent ${client.ultravox_agent_id}`)
      const knowledgeBackend = (client.knowledge_backend as string | null) || undefined
      let knowledgeChunkCount: number | undefined
      if (knowledgeBackend === 'pgvector') {
        const { count } = await supabase
          .from('knowledge_chunks')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', client.id)
          .eq('status', 'approved')
        knowledgeChunkCount = count ?? 0
      }

      const agentFlags: Parameters<typeof updateAgent>[1] = {
        systemPrompt: client.system_prompt,
        ...(client.agent_voice_id ? { voice: client.agent_voice_id } : {}),
        booking_enabled: client.booking_enabled ?? false,
        slug: client.slug,
        forwarding_number: (client.forwarding_number as string | null) || undefined,
        transfer_conditions: (client.transfer_conditions as string | null) || undefined,
        sms_enabled: client.sms_enabled ?? false,
        knowledge_backend: knowledgeBackend,
        knowledge_chunk_count: knowledgeChunkCount,
      }

      await updateAgent(client.ultravox_agent_id, agentFlags)

      // Keep clients.tools in sync
      const syncTools = buildAgentTools(agentFlags)
      await supabase.from('clients').update({ tools: syncTools }).eq('id', client.id)

      synced.push(client.slug)

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push({ slug: client.slug, error: msg })
    }
  }))

  console.log(`[sync-agents] Done — synced=${synced.length} skipped=${skipped.length} errors=${errors.length}`)
  return NextResponse.json({ synced, skipped, errors })
}
