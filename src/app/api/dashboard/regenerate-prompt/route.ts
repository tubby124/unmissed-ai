/**
 * POST /api/dashboard/regenerate-prompt
 * Admin or owner. Re-generates system_prompt from latest intake_submission,
 * inserts a prompt_versions record, and syncs the Ultravox agent.
 * Body: { clientId: string }
 * Returns: { ok, saved, synced, error? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { buildPromptFromIntake } from '@/lib/prompt-builder'
import { updateAgent, buildAgentTools } from '@/lib/ultravox'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .single()
  if (!cu || !['admin', 'owner'].includes(cu.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as { clientId?: string }
  const { clientId } = body
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  // Scope check: owners can only regenerate their own client
  if (cu.role === 'owner' && cu.client_id !== clientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const svc = createServiceClient()

  // Get client — include all fields needed for buildAgentTools
  const { data: client } = await svc
    .from('clients')
    .select('id, slug, agent_name, status, ultravox_agent_id, agent_voice_id, forwarding_number, booking_enabled, sms_enabled, knowledge_backend, transfer_conditions')
    .eq('id', clientId)
    .single()
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // Get latest intake submission
  const { data: intake } = await svc
    .from('intake_submissions')
    .select('intake_json')
    .eq('client_slug', client.slug)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (!intake?.intake_json) return NextResponse.json({ error: 'No intake found for this client' }, { status: 404 })

  const intakeData = { ...intake.intake_json } as Record<string, unknown>

  // For active clients, preserve the current agent_name
  if (client.agent_name && client.status === 'active') {
    intakeData.db_agent_name = client.agent_name
  }

  // Fetch knowledge docs
  let knowledgeDocs = ''
  const { data: kDocs } = await svc
    .from('client_knowledge_docs')
    .select('content_text')
    .eq('client_id', clientId)
  if (kDocs && kDocs.length > 0) {
    knowledgeDocs = kDocs.map((d: { content_text: string }) => d.content_text).join('\n\n---\n\n')
  }

  const newPrompt = buildPromptFromIntake(intakeData, undefined, knowledgeDocs)

  // Insert prompt_versions record before overwriting system_prompt
  const { data: latestVersion } = await svc
    .from('prompt_versions')
    .select('version')
    .eq('client_id', clientId)
    .order('version', { ascending: false })
    .limit(1)
    .single()
  const nextVersion = (latestVersion?.version ?? 0) + 1

  await svc.from('prompt_versions').update({ is_active: false }).eq('client_id', clientId)
  const { data: newVersion } = await svc
    .from('prompt_versions')
    .insert({
      client_id: clientId,
      version: nextVersion,
      content: newPrompt,
      change_description: `Re-generated from intake (${newPrompt.length} chars)`,
      is_active: true,
    })
    .select('id')
    .single()

  // Save to clients table
  const dbUpdates: Record<string, unknown> = {
    system_prompt: newPrompt,
    updated_at: new Date().toISOString(),
  }
  if (newVersion) dbUpdates.active_prompt_version_id = newVersion.id
  await svc.from('clients').update(dbUpdates).eq('id', clientId)

  // Sync to Ultravox agent if one exists
  if (client.ultravox_agent_id) {
    try {
      // Count knowledge chunks for K15 skip-if-empty check
      const knowledgeBackend = (client.knowledge_backend as string | null) || undefined
      let knowledgeChunkCount: number | undefined
      if (knowledgeBackend === 'pgvector') {
        const { count } = await svc
          .from('knowledge_chunks')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .eq('status', 'approved')
        knowledgeChunkCount = count ?? 0
      }

      const agentFlags: Parameters<typeof updateAgent>[1] = {
        systemPrompt: newPrompt,
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

      // Keep clients.tools in sync (S1a pattern)
      const syncTools = buildAgentTools(agentFlags)
      await svc.from('clients').update({ tools: syncTools }).eq('id', clientId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[regenerate-prompt] Ultravox sync failed:', msg)
      return NextResponse.json({ ok: true, saved: true, synced: false, error: msg })
    }
  }

  return NextResponse.json({ ok: true, saved: true, synced: true })
}
