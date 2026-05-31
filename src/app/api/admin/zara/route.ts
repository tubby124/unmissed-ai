/**
 * Admin-only entry point that starts a WebRTC call to Zara with admin tools wired.
 *
 * Auth: requires Supabase session + client_users.role='admin'.
 * The call is created with metadata.adminMode='true', which is the gate every admin
 * tool route checks before executing. Public Zara paths never set this flag.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { callViaAgent, signCallbackUrl } from '@/lib/ultravox'
import { APP_URL } from '@/lib/app-url'
import { buildAdminTools } from '@/lib/admin-tools'

const ZARA_SLUG = 'unmissed-demo'

export async function POST(_req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()
  if (cu?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const svc = createServiceClient()
  const { data: zara, error: zaraErr } = await svc
    .from('clients')
    .select('id, slug, ultravox_agent_id, agent_voice_id, agent_name, business_name, tools, system_prompt')
    .eq('slug', ZARA_SLUG)
    .single()

  if (zaraErr || !zara) {
    return NextResponse.json({ error: 'Zara (unmissed-demo) not found' }, { status: 404 })
  }
  if (!zara.ultravox_agent_id) {
    return NextResponse.json({ error: 'Zara has no Ultravox agent configured' }, { status: 500 })
  }

  // Combine Zara's stored tools with admin tools. Override at call time keeps the
  // stored agent config (and therefore the public demo path) unchanged.
  const zaraStoredTools = Array.isArray(zara.tools) ? (zara.tools as object[]) : []
  const adminTools = buildAdminTools()
  const overrideTools = [...zaraStoredTools, ...adminTools]

  // Admin-mode briefing — injected via templateContext.callerContext, never persisted.
  const callerContext = [
    'ADMIN MODE — You are speaking with Hasan Sharif, the operator of the End Voicemail platform.',
    'He has god-mode access. You may answer any operational question about the platform, clients, calls, minutes, or spend.',
    'You have three admin tools available:',
    '- adminCallsReport(window): per-client call activity. Windows: 24h, 7d, 30d, mtd.',
    '- adminSpendReport(window): platform spend totals + top 5 spenders. Windows: 24h, 7d, 30d, mtd, all.',
    '- adminClientLookup(query): look up a single client by slug, business name, or phone.',
    'Default to a 30-day window unless Hasan says otherwise. Speak the results naturally, do not read raw JSON.',
    'Keep your normal Zara identity — same voice, same warmth — but skip the demo sales pitch.',
  ].join(' ')

  const businessFacts = ''  // admin mode bypasses the demo product knowledge
  const contextData = ''

  // Sign the standard completed-call callback so the call gets logged + classified.
  const callbackBaseUrl = `${APP_URL}/api/webhook/${ZARA_SLUG}/completed`
  const callbackUrl = signCallbackUrl(callbackBaseUrl, ZARA_SLUG)

  try {
    const { joinUrl, callId } = await callViaAgent(zara.ultravox_agent_id as string, {
      medium: 'webrtc',
      maxDuration: '900s',
      callbackUrl,
      callerContext,
      businessFacts,
      contextData,
      metadata: {
        slug: ZARA_SLUG,
        source: 'admin-zara',
        adminMode: 'true',
        userId: user.id,
        userEmail: user.email ?? '',
      },
      overrideTools,
    })

    console.log(`[admin-zara] Admin call started: userId=${user.id} callId=${callId}`)

    try {
      await svc.from('call_logs').insert({
        ultravox_call_id: callId,
        client_id: zara.id,
        call_status: 'live',
        caller_phone: 'admin-zara',
        started_at: new Date().toISOString(),
      })
    } catch (logErr) {
      console.error(`[admin-zara] call_logs insert failed: ${logErr instanceof Error ? logErr.message : logErr}`)
    }

    return NextResponse.json({
      joinUrl,
      callId,
      agentName: (zara.agent_name as string | null) ?? 'Zara',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[admin-zara] callViaAgent failed: ${msg}`)
    return NextResponse.json({ error: 'Failed to start admin call. Check logs.' }, { status: 502 })
  }
}
