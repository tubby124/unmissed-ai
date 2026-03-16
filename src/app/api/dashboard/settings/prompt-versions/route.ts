import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { updateAgent } from '@/lib/ultravox'

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

  // Restore: update clients.system_prompt + active version pointer + set is_active
  await supabase.from('clients').update({
    system_prompt: versionRow.content,
    active_prompt_version_id: version_id,
    updated_at: new Date().toISOString(),
  }).eq('id', client_id)

  await supabase.from('prompt_versions').update({ is_active: false }).eq('client_id', client_id)
  await supabase.from('prompt_versions').update({ is_active: true }).eq('id', version_id)

  // Sync restored prompt to Ultravox agent (if one exists)
  const { data: clientRow } = await supabase
    .from('clients')
    .select('slug, ultravox_agent_id, agent_voice_id, forwarding_number, booking_enabled')
    .eq('id', client_id)
    .single()

  if (clientRow?.ultravox_agent_id) {
    // Build tools array — include transfer tool if forwarding_number exists (mirrors settings/route.ts)
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
    const tools = clientRow.forwarding_number
      ? [{ toolName: 'hangUp' }, transferTool]
      : [{ toolName: 'hangUp' }]

    updateAgent(clientRow.ultravox_agent_id, {
      systemPrompt: versionRow.content,
      ...(clientRow.agent_voice_id ? { voice: clientRow.agent_voice_id } : {}),
      tools,
      booking_enabled: clientRow.booking_enabled ?? false,
      slug: clientRow.slug,
    })
      .then(() => console.log(`[prompt-versions] Ultravox agent ${clientRow.ultravox_agent_id} synced to v${versionRow.version}`))
      .catch(err => console.error(`[prompt-versions] Ultravox agent sync failed: ${err}`))
  }

  return NextResponse.json({ ok: true, restored_version: versionRow.version, restored_content: versionRow.content })
}
