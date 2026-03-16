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
import { updateAgent } from '@/lib/ultravox'

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
    // Load full client row first — needed for Ultravox sync (partial PATCH wipes callTemplate)
    const { data: client } = await svc
      .from('clients')
      .select('id, slug, agent_voice_id, forwarding_number, booking_enabled')
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

    // PATCH Ultravox agent with full payload
    if (client) {
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
      const transferTool = {
        temporaryTool: {
          modelToolName: 'transferCall',
          description: 'Transfer the current call to a human agent when the caller requests it or in an emergency.',
          dynamicParameters: [
            { name: 'reason', location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string', description: 'Reason for transfer' }, required: false },
          ],
          automaticParameters: [
            { name: 'call_id', location: 'PARAMETER_LOCATION_BODY', knownValue: 'KNOWN_PARAM_CALL_ID' },
          ],
          http: {
            baseUrlPattern: `${appUrl}/api/webhook/${client.slug}/transfer`,
            httpMethod: 'POST',
            staticHeaders: { 'X-Transfer-Secret': process.env.WEBHOOK_SIGNING_SECRET ?? '' },
          },
        },
      }
      const tools = client.forwarding_number
        ? [{ toolName: 'hangUp' }, transferTool]
        : [{ toolName: 'hangUp' }]

      await updateAgent(body.agentId, {
        systemPrompt: body.prompt,
        ...(client.agent_voice_id ? { voice: client.agent_voice_id } : {}),
        tools,
        booking_enabled: client.booking_enabled ?? false,
        slug: client.slug,
      })
    } else {
      // Client row not found — send minimal payload (best effort)
      await updateAgent(body.agentId, { systemPrompt: body.prompt })
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
