import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { updateAgent, buildAgentTools } from '@/lib/ultravox'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  if (!cu || cu.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { voiceId } = body

  if (!voiceId) {
    return NextResponse.json({ error: 'voiceId required' }, { status: 400 })
  }

  // Admin can assign to any client; owners assign to their own
  const targetClientId = cu.role === 'admin' ? (body.clientId ?? cu.client_id) : cu.client_id

  if (!targetClientId) {
    return NextResponse.json({ error: 'No client found' }, { status: 400 })
  }

  // Read current voice before overwriting so we can track it as previous
  const { data: currentClient } = await supabase
    .from('clients')
    .select('agent_voice_id')
    .eq('id', targetClientId)
    .single()

  const updatePayload: Record<string, string> = { agent_voice_id: voiceId }
  if (currentClient?.agent_voice_id && currentClient.agent_voice_id !== voiceId) {
    updatePayload.previous_agent_voice_id = currentClient.agent_voice_id
  }

  const { error } = await supabase
    .from('clients')
    .update(updatePayload)
    .eq('id', targetClientId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch full client row — need all fields to send complete updateAgent payload
  const { data: client } = await supabase
    .from('clients')
    .select('id, ultravox_agent_id, system_prompt, forwarding_number, booking_enabled, slug, sms_enabled, knowledge_backend, transfer_conditions')
    .eq('id', targetClientId)
    .single()

  let ultravox_synced = false
  let ultravox_error: string | undefined

  if (client?.ultravox_agent_id) {
    try {
      // Pass all flags — let updateAgent() build the complete tool set
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
        voice: voiceId,
        ...(client.system_prompt ? { systemPrompt: client.system_prompt } : {}),
        booking_enabled: client.booking_enabled ?? false,
        slug: client.slug,
        forwarding_number: (client.forwarding_number as string | null) || undefined,
        transfer_conditions: (client.transfer_conditions as string | null) || undefined,
        sms_enabled: client.sms_enabled ?? false,
        knowledge_backend: knowledgeBackend,
        knowledge_chunk_count: knowledgeChunkCount,
      }

      await updateAgent(client.ultravox_agent_id, agentFlags)

      // Keep clients.tools in sync — runtime-authoritative for live calls
      const syncTools = buildAgentTools(agentFlags)
      await supabase.from('clients').update({ tools: syncTools }).eq('id', client.id)

      console.log(`[voices] Agent ${client.ultravox_agent_id} voice updated to ${voiceId}`)
      ultravox_synced = true
    } catch (err) {
      ultravox_error = err instanceof Error ? err.message : String(err)
      console.error(`[voices] Agent voice sync failed: ${ultravox_error}`)
      // Don't fail — Supabase save succeeded
    }
  }

  return NextResponse.json({ ok: true, ultravox_synced, ...(ultravox_error ? { ultravox_error } : {}) })
}
