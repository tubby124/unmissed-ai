/**
 * POST /api/admin/save-prompt
 *
 * Admin-only endpoint that saves an edited prompt to Supabase + Ultravox agent.
 * Used by the admin test panel after editing a prompt live.
 *
 * Body: { clientSlug: string, agentId: string, prompt: string }
 * Returns: { ok: true, charCount: number }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { updateAgent, buildAgentTools } from '@/lib/ultravox'

export async function POST(req: NextRequest) {
  // ── Auth — admin only ──────────────────────────────────────────────────────
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data: cu } = await svc
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (cu?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ── Parse body ─────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as {
    clientSlug?: string
    agentId?: string
    prompt?: string
  }

  if (!body.clientSlug || !body.agentId || !body.prompt?.trim()) {
    return NextResponse.json({ error: 'clientSlug, agentId, and prompt required' }, { status: 400 })
  }

  try {
    // Load full client row — needed for Ultravox sync (partial PATCH wipes callTemplate)
    const { data: client } = await svc
      .from('clients')
      .select('id, slug, agent_voice_id, forwarding_number, booking_enabled, sms_enabled, knowledge_backend, transfer_conditions')
      .eq('slug', body.clientSlug)
      .single()

    // Update Supabase clients.system_prompt
    const { error: dbErr } = await svc
      .from('clients')
      .update({
        system_prompt: body.prompt,
        updated_at: new Date().toISOString(),
      })
      .eq('slug', body.clientSlug)

    if (dbErr) throw new Error(`DB update failed: ${dbErr.message}`)

    // PATCH Ultravox agent with full payload — pass all flags, let updateAgent() build tools
    if (client) {
      const knowledgeBackend = (client.knowledge_backend as string | null) || undefined
      let knowledgeChunkCount: number | undefined
      if (knowledgeBackend === 'pgvector') {
        const { count } = await svc
          .from('knowledge_chunks')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', client.id)
          .eq('status', 'approved')
        knowledgeChunkCount = count ?? 0
      }

      const agentFlags: Parameters<typeof updateAgent>[1] = {
        systemPrompt: body.prompt,
        ...(client.agent_voice_id ? { voice: client.agent_voice_id } : {}),
        booking_enabled: client.booking_enabled ?? false,
        slug: client.slug,
        forwarding_number: (client.forwarding_number as string | null) || undefined,
        transfer_conditions: (client.transfer_conditions as string | null) || undefined,
        sms_enabled: client.sms_enabled ?? false,
        knowledge_backend: knowledgeBackend,
        knowledge_chunk_count: knowledgeChunkCount,
      }

      await updateAgent(body.agentId, agentFlags)

      // Keep clients.tools in sync — runtime-authoritative for live calls (Finding 6)
      const syncTools = buildAgentTools(agentFlags)
      await svc.from('clients').update({ tools: syncTools }).eq('id', client.id)
    } else {
      return NextResponse.json({ error: `Client not found: ${body.clientSlug}` }, { status: 404 })
    }

    // Insert prompt version
    if (client) {
      const { data: latestVersion } = await svc
        .from('prompt_versions')
        .select('version')
        .eq('client_id', client.id)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()

      const nextVersion = (latestVersion?.version ?? 0) + 1

      await svc.from('prompt_versions').update({ is_active: false }).eq('client_id', client.id)
      await svc.from('prompt_versions').insert({
        client_id: client.id,
        version: nextVersion,
        content: body.prompt,
        change_description: `Admin live edit (${body.prompt.length} chars)`,
        is_active: true,
      })
    }

    return NextResponse.json({ ok: true, charCount: body.prompt.length })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to save prompt', detail: String(err) },
      { status: 500 },
    )
  }
}
