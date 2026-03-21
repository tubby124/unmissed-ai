import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { updateAgent, buildAgentTools } from '@/lib/ultravox'
import { insertPromptVersion } from '@/lib/prompt-version-utils'

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  if (!cu) return new NextResponse('No client found', { status: 404 })

  // Admin can query any client
  const clientId = cu.role === 'admin'
    ? (req.nextUrl.searchParams.get('client_id') ?? cu.client_id)
    : cu.client_id

  const { data: versions, error } = await supabase
    .from('prompt_versions')
    .select('id, version, content, change_description, created_at, is_active')
    .eq('client_id', clientId)
    .order('version', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ versions: versions ?? [] })
}

/** Restore a specific version by ID — sets is_active=true, deactivates others. */
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  if (!cu || (cu.role !== 'admin' && cu.role !== 'owner')) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { version_id } = body
  // Admin can pass explicit client_id; owners are scoped to their own client
  const client_id = cu.role === 'admin' ? (body.client_id ?? cu.client_id) : cu.client_id

  if (!version_id || !client_id) return NextResponse.json({ error: 'version_id required' }, { status: 400 })

  // Fetch the version content — always scoped to this client_id for security
  const { data: versionRow } = await supabase
    .from('prompt_versions')
    .select('id, content, version')
    .eq('id', version_id)
    .eq('client_id', client_id)
    .single()

  if (!versionRow) return NextResponse.json({ error: 'Version not found' }, { status: 404 })

  // S7b: Fetch current prompt for prev_char_count audit
  const { data: currentClient } = await supabase
    .from('clients')
    .select('system_prompt')
    .eq('id', client_id)
    .single()
  const prevCharCount = (currentClient?.system_prompt as string | null)?.length ?? 0

  const restoredCharCount = versionRow.content?.length ?? 0
  const delta = restoredCharCount - prevCharCount

  // S7f: Insert new audited version via shared utility
  const newVersionRow = await insertPromptVersion(supabase, {
    clientId: client_id,
    content: versionRow.content,
    changeDescription: `Restored v${versionRow.version} (${restoredCharCount} chars, delta ${delta > 0 ? '+' : ''}${delta})`,
    triggeredByUserId: user.id,
    triggeredByRole: cu.role,
    prevCharCount,
  })

  // Update clients.system_prompt + active version pointer
  await supabase.from('clients').update({
    system_prompt: versionRow.content,
    active_prompt_version_id: newVersionRow?.id ?? version_id,
    updated_at: new Date().toISOString(),
  }).eq('id', client_id)

  // Sync restored prompt to Ultravox agent (if one exists)
  const { data: clientRow } = await supabase
    .from('clients')
    .select('id, slug, ultravox_agent_id, agent_voice_id, forwarding_number, booking_enabled, sms_enabled, knowledge_backend, transfer_conditions')
    .eq('id', client_id)
    .single()

  if (clientRow?.ultravox_agent_id) {
    // Pass all flags — let updateAgent() build the complete tool set
    const knowledgeBackend = (clientRow.knowledge_backend as string | null) || undefined
    let knowledgeChunkCount: number | undefined
    if (knowledgeBackend === 'pgvector') {
      const { count } = await supabase
        .from('knowledge_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientRow.id)
        .eq('status', 'approved')
      knowledgeChunkCount = count ?? 0
    }

    const agentFlags: Parameters<typeof updateAgent>[1] = {
      systemPrompt: versionRow.content,
      ...(clientRow.agent_voice_id ? { voice: clientRow.agent_voice_id } : {}),
      booking_enabled: clientRow.booking_enabled ?? false,
      slug: clientRow.slug,
      forwarding_number: (clientRow.forwarding_number as string | null) || undefined,
      transfer_conditions: (clientRow.transfer_conditions as string | null) || undefined,
      sms_enabled: clientRow.sms_enabled ?? false,
      knowledge_backend: knowledgeBackend,
      knowledge_chunk_count: knowledgeChunkCount,
    }

    try {
      await updateAgent(clientRow.ultravox_agent_id, agentFlags)
      const syncTools = buildAgentTools(agentFlags)
      await supabase.from('clients').update({ tools: syncTools }).eq('id', clientRow.id)
      console.log(`[prompt-versions] Ultravox agent ${clientRow.ultravox_agent_id} synced to v${versionRow.version}`)
    } catch (err) {
      console.error(`[prompt-versions] Ultravox agent sync failed: ${err}`)
    }
  }

  return NextResponse.json({ ok: true, restored_version: versionRow.version, restored_content: versionRow.content })
}
