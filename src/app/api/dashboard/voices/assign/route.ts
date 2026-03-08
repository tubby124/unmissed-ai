import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { updateAgent } from '@/lib/ultravox'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { voiceId, clientId } = await req.json()
  if (!voiceId || !clientId) {
    return NextResponse.json({ error: 'voiceId and clientId required' }, { status: 400 })
  }

  const { data: client, error } = await supabase
    .from('clients')
    .update({ agent_voice_id: voiceId })
    .eq('id', clientId)
    .select('ultravox_agent_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (client?.ultravox_agent_id) {
    updateAgent(client.ultravox_agent_id, { voice: voiceId })
      .then(() => console.log(`[voices] Agent ${client.ultravox_agent_id} voice updated to ${voiceId}`))
      .catch(err => console.error(`[voices] Agent voice sync failed: ${err}`))
  }

  return NextResponse.json({ ok: true })
}
