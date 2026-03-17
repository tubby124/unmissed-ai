/**
 * POST /api/dashboard/regenerate-prompt
 * Admin only. Re-generates system_prompt from latest intake_submission,
 * inserts a prompt_versions record, and syncs the Ultravox agent.
 * Body: { clientId: string }
 * Returns: { ok, saved, synced, error? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { buildPromptFromIntake } from '@/lib/prompt-builder'
import { updateAgent } from '@/lib/ultravox'

export async function POST(req: NextRequest) {
  // Admin auth
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (cu?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { clientId?: string }
  const { clientId } = body
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  const svc = createServiceClient()

  // Get client — include fields needed for Ultravox sync
  const { data: client } = await svc
    .from('clients')
    .select('slug, agent_name, status, ultravox_agent_id, agent_voice_id, forwarding_number, booking_enabled')
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

  // Fetch knowledge docs — try by client_id first, fallback to intake_id
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
  const updates: Record<string, unknown> = {
    system_prompt: newPrompt,
    updated_at: new Date().toISOString(),
  }
  if (newVersion) updates.active_prompt_version_id = newVersion.id
  await svc.from('clients').update(updates).eq('id', clientId)

  // Sync to Ultravox agent if one exists
  if (client.ultravox_agent_id) {
    try {
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
            baseUrlPattern: `${appUrl}/api/webhook/${client.slug}/transfer`,
            httpMethod: 'POST',
            staticHeaders: { 'X-Transfer-Secret': process.env.WEBHOOK_SIGNING_SECRET ?? '' },
          },
        },
      }
      const tools = client.forwarding_number
        ? [{ toolName: 'hangUp' }, transferTool]
        : [{ toolName: 'hangUp' }]

      await updateAgent(client.ultravox_agent_id, {
        systemPrompt: newPrompt,
        ...(client.agent_voice_id ? { voice: client.agent_voice_id } : {}),
        tools,
        booking_enabled: client.booking_enabled ?? false,
        slug: client.slug,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[regenerate-prompt] Ultravox sync failed:', msg)
      return NextResponse.json({ ok: true, saved: true, synced: false, error: msg })
    }
  }

  return NextResponse.json({ ok: true, saved: true, synced: true })
}
