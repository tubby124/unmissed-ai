/**
 * POST /api/dashboard/regenerate-prompt/preview
 *
 * Admin-only. Returns what a deep-mode rebuild would produce WITHOUT writing
 * to DB or syncing Ultravox. The UI shows this as a before/after diff so the
 * admin can review before confirming.
 *
 * Uses the same buildAgentModeRebuildPrompt helper as the confirm route —
 * guaranteeing that preview and confirm produce identical prompts.
 *
 * Body: { clientId: string, agentModeOverride: AgentMode }
 * Returns: { currentPrompt, rebuiltPrompt, charCountCurrent, charCountRebuilt, effectiveCallHandlingMode }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { buildAgentModeRebuildPrompt, AGENT_MODE_VALUES, type AgentMode } from '@/lib/agent-mode-rebuild'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role, client_id')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()
  if (!cu || cu.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as { clientId?: string; agentModeOverride?: string }
  const { clientId } = body
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  const agentModeOverride = body.agentModeOverride as AgentMode | undefined
  if (!agentModeOverride || !AGENT_MODE_VALUES.includes(agentModeOverride)) {
    return NextResponse.json(
      { error: `agentModeOverride is required and must be one of: ${AGENT_MODE_VALUES.join(', ')}` },
      { status: 400 },
    )
  }

  const svc = createServiceClient()

  let result
  try {
    result = await buildAgentModeRebuildPrompt(svc, clientId, agentModeOverride)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 404 })
  }

  return NextResponse.json({
    currentPrompt: result.currentPrompt ?? '',
    rebuiltPrompt: result.newPrompt,
    charCountCurrent: result.prevCharCount,
    charCountRebuilt: result.newPrompt.length,
    effectiveCallHandlingMode: result.effectiveCallHandlingMode,
  })
}
