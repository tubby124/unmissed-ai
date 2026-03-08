import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { updateAgent } from '@/lib/ultravox'

export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient()

  // Verify session
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // Get the user's client + role
  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  if (!cu) {
    return new NextResponse('No client found', { status: 404 })
  }

  const body = await req.json().catch(() => ({}))

  // Admin can edit any client by passing client_id in body
  let targetClientId = cu.client_id
  if (cu.role === 'admin' && body.client_id) {
    targetClientId = body.client_id
  }

  const updates: Record<string, unknown> = {}

  if (typeof body.system_prompt === 'string') {
    updates.system_prompt = body.system_prompt
    updates.updated_at = new Date().toISOString()
  }
  if (body.status === 'active' || body.status === 'paused') {
    updates.status = body.status
  }

  // God Mode fields — admin only
  if (cu.role === 'admin') {
    if (typeof body.telegram_bot_token === 'string' && body.telegram_bot_token) {
      updates.telegram_bot_token = body.telegram_bot_token
    }
    if (typeof body.telegram_chat_id === 'string' && body.telegram_chat_id) {
      updates.telegram_chat_id = body.telegram_chat_id
    }
    if (typeof body.twilio_number === 'string' && body.twilio_number) {
      updates.twilio_number = body.twilio_number
    }
    if (typeof body.timezone === 'string' && body.timezone) {
      updates.timezone = body.timezone
    }
    if (typeof body.monthly_minute_limit === 'number' && body.monthly_minute_limit > 0) {
      updates.monthly_minute_limit = body.monthly_minute_limit
    }
  }

  if (!Object.keys(updates).length) {
    return new NextResponse('Nothing to update', { status: 400 })
  }

  const { error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', targetClientId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Sync new system_prompt to Ultravox Agent (if one exists for this client)
  if (typeof updates.system_prompt === 'string') {
    const { data: clientRow } = await supabase
      .from('clients')
      .select('ultravox_agent_id')
      .eq('id', targetClientId)
      .single()

    if (clientRow?.ultravox_agent_id) {
      updateAgent(clientRow.ultravox_agent_id, { systemPrompt: updates.system_prompt as string })
        .then(() => console.log(`[settings] Ultravox agent ${clientRow.ultravox_agent_id} prompt synced`))
        .catch(err => console.error(`[settings] Ultravox agent sync failed: ${err}`))
    }

    // Record this as a new prompt version
    const { data: latestVersion } = await supabase
      .from('prompt_versions')
      .select('version')
      .eq('client_id', targetClientId)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    const nextVersion = (latestVersion?.version ?? 0) + 1

    // Deactivate all previous versions then insert new active one
    await supabase
      .from('prompt_versions')
      .update({ is_active: false })
      .eq('client_id', targetClientId)

    await supabase.from('prompt_versions').insert({
      client_id: targetClientId,
      version: nextVersion,
      content: updates.system_prompt as string,
      change_description: body.change_description || `Manual update v${nextVersion}`,
      is_active: true,
    })
  }

  return NextResponse.json({ ok: true })
}
