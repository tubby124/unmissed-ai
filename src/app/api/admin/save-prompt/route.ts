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
    // Update Supabase clients.system_prompt
    const { error: dbErr } = await svc
      .from('clients')
      .update({
        system_prompt: body.prompt,
        updated_at: new Date().toISOString(),
      })
      .eq('slug', body.clientSlug)

    if (dbErr) throw new Error(`DB update failed: ${dbErr.message}`)

    // PATCH Ultravox agent with new prompt
    await updateAgent(body.agentId, { systemPrompt: body.prompt })

    // Insert prompt version
    const { data: client } = await svc
      .from('clients')
      .select('id')
      .eq('slug', body.clientSlug)
      .single()

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
