import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { updateAgent } from '@/lib/ultravox'

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

  const { error } = await supabase
    .from('clients')
    .update({ agent_voice_id: voiceId })
    .eq('id', targetClientId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch full client row — need both agentId and current prompt to avoid wiping config on PATCH
  const { data: client } = await supabase
    .from('clients')
    .select('ultravox_agent_id, system_prompt')
    .eq('id', targetClientId)
    .single()

  let ultravox_synced = false
  let ultravox_error: string | undefined

  if (client?.ultravox_agent_id) {
    try {
      await updateAgent(client.ultravox_agent_id, {
        voice: voiceId,
        ...(client.system_prompt ? { systemPrompt: client.system_prompt } : {}),
      })
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
