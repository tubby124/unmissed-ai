import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { updateAgent, createCorpus } from '@/lib/ultravox'
import { replacePromptSection } from '@/lib/prompt-sections'
import { sendAlert } from '@/lib/telegram'

// ── Prompt validation ──────────────────────────────────────────────────────────
interface PromptWarning { field: string; message: string }
interface PromptValidation { valid: boolean; error?: string; warnings: PromptWarning[] }

const PROMPT_MAX_CHARS = 8000

function validatePrompt(prompt: string): PromptValidation {
  const warnings: PromptWarning[] = []

  if (prompt.length > PROMPT_MAX_CHARS) {
    return {
      valid: false,
      error: `Prompt is ${prompt.length.toLocaleString()} characters — maximum is ${PROMPT_MAX_CHARS.toLocaleString()}. Remove content before saving.`,
      warnings,
    }
  }

  // Soft warnings — returned but not blocked
  if (/(?<!\d)\d{10,}(?!\d)/g.test(prompt)) {
    warnings.push({ field: 'phone_number', message: 'Phone numbers in prompts cause hallucination. Use the forwarding number field instead.' })
  }
  if (/https?:\/\/[^\s)]+/gi.test(prompt)) {
    warnings.push({ field: 'url', message: "URLs aren't spoken correctly by voice agents. Use the knowledge base to store web content." })
  }
  if (/(?:we charge|our price is|costs? )\$[\d,.]+/gi.test(prompt)) {
    warnings.push({ field: 'price', message: 'Hardcoded prices can bind your business. Consider using the knowledge base for pricing info.' })
  }

  return { valid: true, warnings }
}

/**
 * Parse free-form hours section content into structured weekday/weekend strings.
 * Looks for lines that clearly indicate weekday vs weekend patterns.
 * Returns null for a field if it can't be determined (caller should leave DB field as-is).
 */
function parseHoursSection(content: string): { weekday: string | null; weekend: string | null } {
  const WEEKDAY_RE = /\b(monday|tuesday|wednesday|thursday|friday|mon|tue|wed|thu|fri|weekday|weekdays|daily|monday.{0,10}friday|mon.{0,5}fri)\b/i
  const WEEKEND_RE = /\b(saturday|sunday|weekend|sat|sun|saturday.{0,10}sunday|sat.{0,5}sun)\b/i

  let weekday: string | null = null
  let weekend: string | null = null

  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const hasWeekday = WEEKDAY_RE.test(line)
    const hasWeekend = WEEKEND_RE.test(line)
    if (hasWeekday && !hasWeekend && !weekday) weekday = line
    else if (hasWeekend && !hasWeekday && !weekend) weekend = line
  }

  return { weekday, weekend }
}

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

  // Track warnings from prompt validation (returned in response)
  let promptWarnings: PromptWarning[] = []

  if (typeof body.system_prompt === 'string') {
    const v = validatePrompt(body.system_prompt)
    if (!v.valid) return NextResponse.json({ error: v.error }, { status: 400 })
    promptWarnings = v.warnings
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
  if (typeof body.voice_style_preset === 'string' && body.voice_style_preset) {
    updates.voice_style_preset = body.voice_style_preset
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
  if (typeof body.agent_voice_id === 'string' && body.agent_voice_id.trim()) {
    updates.agent_voice_id = body.agent_voice_id.trim()
  }
  if ('injected_note' in body) {
    const noteText = typeof body.injected_note === 'string' ? body.injected_note.trim() : null
    updates.injected_note = noteText || null
  }
  if (typeof body.telegram_style === 'string' && ['compact', 'standard', 'action_card'].includes(body.telegram_style)) {
    updates.telegram_style = body.telegram_style
  }
  // Timezone — available to all roles (required for correct booking slot times per client)
  if (typeof body.timezone === 'string' && body.timezone) {
    updates.timezone = body.timezone
  }

  // Clear or set pending loop suggestion (null = clear after apply/dismiss, object = set by cron)
  if ('pending_loop_suggestion' in body) {
    updates.pending_loop_suggestion = body.pending_loop_suggestion ?? null
  }

  // A3 — After-hours config (stored on clients table, injected into callerContext at call time)
  const a3HoursChanged = typeof body.business_hours_weekday === 'string' || typeof body.business_hours_weekend === 'string'
  if (typeof body.business_hours_weekday === 'string') {
    updates.business_hours_weekday = body.business_hours_weekday.trim() || null
  }
  if (typeof body.business_hours_weekend === 'string') {
    updates.business_hours_weekend = body.business_hours_weekend.trim() || null
  }
  if (typeof body.after_hours_behavior === 'string' && ['take_message', 'route_emergency', 'custom_message'].includes(body.after_hours_behavior)) {
    updates.after_hours_behavior = body.after_hours_behavior
  }
  if (typeof body.after_hours_emergency_phone === 'string') {
    updates.after_hours_emergency_phone = body.after_hours_emergency_phone.trim() || null
  }

  // A3a — When hours change, also update the `hours` section in the stored system_prompt so the
  // agent says the correct hours to callers. This syncs A3 → B1 (reverse of B1a which syncs B1 → A3).
  if (a3HoursChanged) {
    const { data: promptRow } = await supabase
      .from('clients')
      .select('system_prompt')
      .eq('id', targetClientId)
      .single()
    if (promptRow?.system_prompt) {
      const weekday = typeof body.business_hours_weekday === 'string'
        ? (body.business_hours_weekday.trim() || null)
        : null
      const weekend = typeof body.business_hours_weekend === 'string'
        ? (body.business_hours_weekend.trim() || null)
        : null
      const hoursText = [weekday, weekend].filter(Boolean).join('\n')
      if (hoursText) {
        const merged = replacePromptSection(
          promptRow.system_prompt as string,
          'hours',
          hoursText
        )
        const v = validatePrompt(merged)
        if (!v.valid) return NextResponse.json({ error: v.error }, { status: 400 })
        if (v.warnings.length) promptWarnings = [...promptWarnings, ...v.warnings]
        updates.system_prompt = merged
        updates.updated_at = new Date().toISOString()
      }
    }
  }

  // B2 — Live transfer conditions: text describing when the agent should use transferCall
  if (typeof body.transfer_conditions === 'string') {
    updates.transfer_conditions = body.transfer_conditions.trim() || null
  }

  // B1 — Section editor: replace a named section in the stored prompt
  // section_id must be a client-editable section; admins can also edit locked sections
  if (typeof body.section_id === 'string' && typeof body.section_content === 'string') {
    const ADMIN_ONLY = ['tone', 'flow', 'technical']
    if (ADMIN_ONLY.includes(body.section_id) && cu.role !== 'admin') {
      return new NextResponse('Forbidden — admin-only section', { status: 403 })
    }
    // We'll apply the section edit after fetching the current prompt below
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

  // A4 — corpus_enabled toggle. All clients share the global corpus (ULTRAVOX_CORPUS_ID env var).
  // Documents are scoped per-client by source naming (client-{slug}-{filename}).
  if (typeof body.corpus_enabled === 'boolean') {
    updates.corpus_enabled = body.corpus_enabled
  }

  // B1 — Section edit: apply section marker replacement to current system_prompt
  if (typeof body.section_id === 'string' && typeof body.section_content === 'string') {
    const { data: promptRow } = await supabase
      .from('clients')
      .select('system_prompt')
      .eq('id', targetClientId)
      .single()
    if (promptRow?.system_prompt) {
      const merged = replacePromptSection(
        promptRow.system_prompt as string,
        body.section_id as string,
        body.section_content as string
      )
      const v = validatePrompt(merged)
      if (!v.valid) return NextResponse.json({ error: v.error }, { status: 400 })
      if (v.warnings.length) promptWarnings = [...promptWarnings, ...v.warnings]
      updates.system_prompt = merged
      updates.updated_at = new Date().toISOString()
    }

    // B1a — Hours section DB sync: when the hours section is saved, also write structured
    // business_hours_weekday / business_hours_weekend so the inbound route's after-hours
    // detection stays in sync with what the agent actually says about its hours.
    if (body.section_id === 'hours') {
      const { weekday, weekend } = parseHoursSection(body.section_content as string)
      if (weekday !== null) updates.business_hours_weekday = weekday
      if (weekend !== null) updates.business_hours_weekend = weekend
      // Blank section = clear both fields (agent has no hours configured)
      if (!(body.section_content as string).trim()) {
        updates.business_hours_weekday = null
        updates.business_hours_weekend = null
      }
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

  // injected_note: rebuild system_prompt before Supabase update
  if ('injected_note' in updates) {
    const { data: promptRow } = await supabase
      .from('clients')
      .select('system_prompt')
      .eq('id', targetClientId)
      .single()

    if (promptRow) {
      const INJECT_MARKER = /\n\n## RIGHT NOW — Time-sensitive info[\s\S]*$/
      let newPrompt = (promptRow.system_prompt ?? '').replace(INJECT_MARKER, '')
      const noteText = updates.injected_note as string | null
      if (noteText) {
        newPrompt += `\n\n## RIGHT NOW — Time-sensitive info\n${noteText}\n`
      }
      updates.system_prompt = newPrompt
      updates.updated_at = new Date().toISOString()
    }
  }

  const needsAgentSync =
    typeof updates.system_prompt === 'string' ||
    'forwarding_number' in updates ||
    'transfer_conditions' in updates ||
    'booking_enabled' in updates ||
    'agent_voice_id' in updates ||
    'corpus_enabled' in updates ||
    'corpus_id' in updates

  if (needsAgentSync) {
    const { data: clientRow } = await supabase
      .from('clients')
      .select('slug, ultravox_agent_id, agent_voice_id, system_prompt, forwarding_number, booking_enabled, corpus_id, corpus_enabled, transfer_conditions')
      .eq('id', targetClientId)
      .single()

    if (clientRow?.ultravox_agent_id) {
      // Use just-saved forwarding_number if it changed, otherwise use current DB value
      const fwdNumber = 'forwarding_number' in updates
        ? (updates.forwarding_number as string | null)
        : clientRow.forwarding_number

      const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
      const transferConditions = 'transfer_conditions' in updates
        ? (updates.transfer_conditions as string | null)
        : (clientRow.transfer_conditions as string | null)
      const transferDescription = transferConditions
        ? `Transfer the call to the owner ONLY when ${transferConditions}. Do not use for routine questions, general inquiries, or minor requests.`
        : 'Transfer the call to the owner ONLY when the caller explicitly says it is an emergency or urgently insists on speaking to a human directly. Do not use for general questions.'
      const transferTool = {
        temporaryTool: {
          modelToolName: 'transferCall',
          description: transferDescription,
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
          staticParameters: [
            { name: 'X-Transfer-Secret', location: 'PARAMETER_LOCATION_HEADER', value: process.env.WEBHOOK_SIGNING_SECRET ?? '' },
          ],
          http: {
            baseUrlPattern: `${appUrl}/api/webhook/${clientRow.slug}/transfer`,
            httpMethod: 'POST',
          },
        },
      }
      const tools = fwdNumber ? [{ toolName: 'hangUp' }, transferTool] : [{ toolName: 'hangUp' }]

      try {
        const promptToSync = typeof updates.system_prompt === 'string'
          ? updates.system_prompt
          : (clientRow.system_prompt ?? '')
        const voiceToSync = 'agent_voice_id' in updates
          ? (updates.agent_voice_id as string)
          : clientRow.agent_voice_id
        const corpusIdToSync = 'corpus_id' in updates
          ? (updates.corpus_id as string | null)
          : (clientRow.corpus_id as string | null)
        const corpusEnabledToSync = 'corpus_enabled' in updates
          ? (updates.corpus_enabled as boolean)
          : (clientRow.corpus_enabled ?? false)
        await updateAgent(clientRow.ultravox_agent_id, {
          systemPrompt: promptToSync,
          ...(voiceToSync ? { voice: voiceToSync } : {}),
          tools,
          booking_enabled: 'booking_enabled' in updates
            ? (updates.booking_enabled as boolean)
            : (clientRow.booking_enabled ?? false),
          slug: clientRow.slug,
          corpus_id: corpusEnabledToSync ? corpusIdToSync : null,
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

    // Notify operator when a non-admin client edits their prompt
    if (cu.role !== 'admin') {
      try {
        const { data: adminCl } = await supabase
          .from('clients')
          .select('telegram_bot_token, telegram_chat_id, business_name')
          .eq('slug', 'hasan-sharif')
          .single()
        const { data: editedCl } = await supabase
          .from('clients')
          .select('business_name')
          .eq('id', targetClientId)
          .single()
        if (adminCl?.telegram_bot_token && adminCl?.telegram_chat_id) {
          const name = editedCl?.business_name || 'Unknown client'
          const charLen = (updates.system_prompt as string).length
          const msg = `✏️ <b>${name}</b> edited their prompt (v${nextVersion}, ${charLen.toLocaleString()} chars).\nReview: /dashboard/settings`
          await sendAlert(adminCl.telegram_bot_token as string, adminCl.telegram_chat_id as string, msg)
        }
      } catch (err) {
        console.error(`[settings] Telegram prompt-change notification failed: ${err}`)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    ultravox_synced,
    ...(ultravox_error ? { ultravox_error } : {}),
    ...(promptWarnings.length ? { warnings: promptWarnings } : {}),
  })
}
