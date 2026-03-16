import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { updateAgent } from '@/lib/ultravox'

export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .single()

  if (!cu) return new NextResponse('No client found', { status: 404 })

  const body = await req.json().catch(() => ({}))

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
  if (typeof body.sms_enabled === 'boolean') {
    updates.sms_enabled = body.sms_enabled
  }
  if (typeof body.sms_template === 'string') {
    updates.sms_template = body.sms_template
  }
  if (typeof body.business_facts === 'string') {
    updates.business_facts = body.business_facts
  }
  if (Array.isArray(body.extra_qa)) {
    updates.extra_qa = body.extra_qa
  }
  if (typeof body.context_data === 'string') {
    updates.context_data = body.context_data || null
  }
  if (typeof body.context_data_label === 'string') {
    updates.context_data_label = body.context_data_label || null
  }
  if (typeof body.booking_service_duration_minutes === 'number' && body.booking_service_duration_minutes > 0) {
    updates.booking_service_duration_minutes = body.booking_service_duration_minutes
  }
  if (typeof body.booking_buffer_minutes === 'number' && body.booking_buffer_minutes >= 0) {
    updates.booking_buffer_minutes = body.booking_buffer_minutes
  }
  // Admin only: toggle booking_enabled and calendar_beta_enabled
  if (cu.role === 'admin') {
    if (typeof body.booking_enabled === 'boolean') {
      updates.booking_enabled = body.booking_enabled
    }
    if (typeof body.calendar_beta_enabled === 'boolean') {
      updates.calendar_beta_enabled = body.calendar_beta_enabled
    }
  }
  if (typeof body.forwarding_number === 'string') {
    updates.forwarding_number = body.forwarding_number || null
  }
  if (typeof body.setup_complete === 'boolean') {
    updates.setup_complete = body.setup_complete
  }
  if (typeof body.agent_name === 'string' && body.agent_name.trim()) {
    updates.agent_name = body.agent_name.trim()
  }
  // Timezone — available to all roles (required for correct booking slot times per client)
  if (typeof body.timezone === 'string' && body.timezone) {
    updates.timezone = body.timezone
  }

  // Clear or set pending loop suggestion (null = clear after apply/dismiss, object = set by cron)
  if ('pending_loop_suggestion' in body) {
    updates.pending_loop_suggestion = body.pending_loop_suggestion ?? null
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
    if (typeof body.monthly_minute_limit === 'number' && body.monthly_minute_limit > 0) {
      updates.monthly_minute_limit = body.monthly_minute_limit
    }
  }

  if (!Object.keys(updates).length) {
    return new NextResponse('Nothing to update', { status: 400 })
  }

  // 1 — Save to Supabase
  const { error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', targetClientId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 2 — Sync to Ultravox Agent
  let ultravox_synced = false
  let ultravox_error: string | undefined

  const needsAgentSync = typeof updates.system_prompt === 'string' || 'forwarding_number' in updates || 'booking_enabled' in updates

  if (needsAgentSync) {
    const { data: clientRow } = await supabase
      .from('clients')
      .select('slug, ultravox_agent_id, agent_voice_id, system_prompt, forwarding_number, booking_enabled')
      .eq('id', targetClientId)
      .single()

    if (clientRow?.ultravox_agent_id) {
      // Use just-saved forwarding_number if it changed, otherwise use current DB value
      const fwdNumber = 'forwarding_number' in updates
        ? (updates.forwarding_number as string | null)
        : clientRow.forwarding_number

      const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
      const transferTool = {
        temporaryTool: {
          modelToolName: 'transferCall',
          description: 'Transfer the current call to a human agent when the caller requests it or in an emergency.',
          dynamicParameters: [
            {
              name: 'reason',
              location: 'PARAMETER_LOCATION_BODY',
              schema: { type: 'string', description: 'Reason for transfer' },
              required: false,
            },
          ],
          automaticParameters: [
            {
              name: 'call_id',
              location: 'PARAMETER_LOCATION_BODY',
              knownValue: 'KNOWN_PARAM_CALL_ID',
            },
          ],
          http: {
            baseUrlPattern: `${appUrl}/api/webhook/${clientRow.slug}/transfer`,
            httpMethod: 'POST',
            staticHeaders: { 'X-Transfer-Secret': process.env.WEBHOOK_SIGNING_SECRET ?? '' },
          },
        },
      }
      const tools = fwdNumber ? [{ toolName: 'hangUp' }, transferTool] : [{ toolName: 'hangUp' }]

      try {
        const promptToSync = typeof updates.system_prompt === 'string'
          ? updates.system_prompt
          : (clientRow.system_prompt ?? '')
        await updateAgent(clientRow.ultravox_agent_id, {
          systemPrompt: promptToSync,
          ...(clientRow.agent_voice_id ? { voice: clientRow.agent_voice_id } : {}),
          tools,
          booking_enabled: 'booking_enabled' in updates
            ? (updates.booking_enabled as boolean)
            : (clientRow.booking_enabled ?? false),
          slug: clientRow.slug,
        })
        // Keep clients.tools in sync for the createCall fallback path in the inbound route
        await supabase.from('clients').update({ tools }).eq('id', targetClientId)
        console.log(`[settings] Ultravox agent ${clientRow.ultravox_agent_id} synced (prompt=${typeof updates.system_prompt === 'string'} transfer=${!!fwdNumber})`)
        ultravox_synced = true

        // Post-enable verification: when booking_enabled is toggled ON, verify calendar tools are registered
        if ('booking_enabled' in updates && updates.booking_enabled === true) {
          const uvKey = process.env.ULTRAVOX_API_KEY
          if (uvKey) {
            try {
              const verifyRes = await fetch(`https://api.ultravox.ai/api/agents/${clientRow.ultravox_agent_id}`, {
                headers: { 'X-API-Key': uvKey },
              })
              if (verifyRes.ok) {
                const agentData = await verifyRes.json() as { callTemplate?: { selectedTools?: Array<{ temporaryTool?: { modelToolName?: string } }> } }
                const liveTools = agentData?.callTemplate?.selectedTools ?? []
                const hasCalendarTool = liveTools.some(t => t.temporaryTool?.modelToolName === 'checkCalendarAvailability')
                if (hasCalendarTool) {
                  console.log(`[settings] ✓ Calendar tools verified on agent ${clientRow.ultravox_agent_id}`)
                } else {
                  console.warn(`[settings] ⚠ booking_enabled=true but calendar tools NOT found on Ultravox agent — run /prompt-deploy to fix`)
                  ultravox_error = 'booking_enabled is ON but calendar tools are missing from the Ultravox agent. Run /prompt-deploy to fix.'
                  ultravox_synced = false
                }
              }
            } catch (verifyErr) {
              console.warn(`[settings] Calendar tool verification failed: ${verifyErr}`)
            }
          }
        }
      } catch (err) {
        ultravox_error = err instanceof Error ? err.message : String(err)
        console.error(`[settings] Ultravox agent sync failed: ${ultravox_error}`)
        // Don't fail the whole request — Supabase save succeeded
      }
    }
  }

  // 3 — Record prompt version (only when system_prompt changed)
  if (typeof updates.system_prompt === 'string') {
    const { data: latestVersion } = await supabase
      .from('prompt_versions')
      .select('version')
      .eq('client_id', targetClientId)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    const nextVersion = (latestVersion?.version ?? 0) + 1

    await supabase
      .from('prompt_versions')
      .update({ is_active: false })
      .eq('client_id', targetClientId)

    const { data: newVersion } = await supabase.from('prompt_versions').insert({
      client_id: targetClientId,
      version: nextVersion,
      content: updates.system_prompt as string,
      change_description: body.change_description || `Manual update v${nextVersion}`,
      is_active: true,
    }).select('id').single()

    if (newVersion) {
      await supabase.from('clients')
        .update({ active_prompt_version_id: newVersion.id })
        .eq('id', targetClientId)
    }
  }

  return NextResponse.json({ ok: true, ultravox_synced, ...(ultravox_error ? { ultravox_error } : {}) })
}
