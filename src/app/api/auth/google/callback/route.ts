import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { updateAgent, buildAgentTools } from '@/lib/ultravox'
import { patchCalendarBlock, getServiceType, getClosePerson } from '@/lib/prompt-patcher'
import { APP_URL } from '@/lib/app-url'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const stateParam = req.nextUrl.searchParams.get('state')
  const error = req.nextUrl.searchParams.get('error')

  if (error || !code || !stateParam) {
    console.error(`[google-callback] OAuth error: ${error || 'missing code/state'}`)
    return NextResponse.redirect(`${APP_URL}/dashboard/settings?calendar_error=access_denied`)
  }

  let slug: string, clientId: string, nonce: string, isAdmin: boolean
  try {
    const parsed = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
    slug = parsed.slug
    clientId = parsed.clientId
    nonce = parsed.nonce
    isAdmin = parsed.isAdmin === true
  } catch {
    return NextResponse.redirect(`${APP_URL}/dashboard/settings?calendar_error=invalid_state`)
  }

  // Verify nonce
  const cookieNonce = req.cookies.get('google_oauth_nonce')?.value
  if (!cookieNonce || cookieNonce !== nonce) {
    console.error(`[google-callback] Nonce mismatch for slug=${slug}`)
    return NextResponse.redirect(`${APP_URL}/dashboard/settings?calendar_error=invalid_state`)
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${APP_URL}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    console.error(`[google-callback] Token exchange failed for slug=${slug}: ${err}`)
    return NextResponse.redirect(`${APP_URL}/dashboard/settings?calendar_error=token_exchange_failed`)
  }

  const tokens = await tokenRes.json()
  const refreshToken = tokens.refresh_token as string | undefined

  if (!refreshToken) {
    console.error(`[google-callback] No refresh_token for slug=${slug} — user may need to re-authorize`)
    return NextResponse.redirect(`${APP_URL}/dashboard/settings?calendar_error=no_refresh_token`)
  }

  // Get the primary calendar ID
  let calendarId = 'primary'
  try {
    const calRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList/primary', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    if (calRes.ok) {
      const cal = await calRes.json()
      calendarId = cal.id || 'primary'
    }
  } catch {
    // Fall back to 'primary'
  }

  // Store in Supabase — auto-enable booking when calendar connects
  const supabase = createServiceClient()
  const { error: dbError } = await supabase
    .from('clients')
    .update({
      google_refresh_token: refreshToken,
      google_calendar_id: calendarId,
      calendar_auth_status: 'connected',
      booking_enabled: true,
    })
    .eq('id', clientId)

  if (dbError) {
    console.error(`[google-callback] DB update failed for clientId=${clientId}: ${dbError.message}`)
    return NextResponse.redirect(`${APP_URL}/dashboard/settings?calendar_error=db_failed`)
  }

  console.log(`[google-callback] Calendar connected for slug=${slug} calendarId=${calendarId} booking_enabled=true`)

  // Patch prompt + sync Ultravox agent so calendar tools AND instructions are live immediately
  try {
    const { data: client } = await supabase
      .from('clients')
      .select('ultravox_agent_id, system_prompt, agent_voice_id, forwarding_number, transfer_conditions, sms_enabled, knowledge_backend, niche, agent_name')
      .eq('id', clientId)
      .single()

    if (client?.ultravox_agent_id && client.system_prompt) {
      // Patch the stored prompt to include CALENDAR BOOKING FLOW instructions
      const promptStr = client.system_prompt as string
      const patched = patchCalendarBlock(
        promptStr,
        true,
        getServiceType(client.niche as string | null),
        getClosePerson(promptStr, client.agent_name as string | null),
      )
      if (patched !== promptStr) {
        await supabase
          .from('clients')
          .update({ system_prompt: patched, updated_at: new Date().toISOString() })
          .eq('id', clientId)
        console.log(`[google-callback] Calendar booking block added to prompt for slug=${slug}`)
      }

      // Count knowledge chunks for K15 skip-if-empty check
      const knowledgeBackend = (client.knowledge_backend as string | null) || undefined
      let knowledgeChunkCount: number | undefined
      if (knowledgeBackend === 'pgvector') {
        const { count } = await supabase
          .from('knowledge_chunks')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .eq('status', 'approved')
        knowledgeChunkCount = count ?? 0
      }

      const agentFlags: Parameters<typeof updateAgent>[1] = {
        systemPrompt: patched,
        ...(client.agent_voice_id ? { voice: client.agent_voice_id } : {}),
        booking_enabled: true,
        slug,
        forwarding_number: (client.forwarding_number as string | null) ?? undefined,
        transfer_conditions: (client.transfer_conditions as string | null) || undefined,
        sms_enabled: client.sms_enabled ?? false,
        knowledge_backend: knowledgeBackend,
        knowledge_chunk_count: knowledgeChunkCount,
      }

      await updateAgent(client.ultravox_agent_id, agentFlags)

      // Keep clients.tools in sync (S1a pattern)
      const syncTools = buildAgentTools(agentFlags)
      await supabase.from('clients').update({ tools: syncTools }).eq('id', clientId)

      console.log(`[google-callback] Ultravox agent synced with calendar tools for slug=${slug}`)
    }
  } catch (syncErr) {
    // Non-fatal — calendar is connected, tools will sync on next settings save
    console.warn(`[google-callback] Ultravox sync failed for slug=${slug}: ${syncErr}`)
  }

  const successUrl = isAdmin
    ? `${APP_URL}/admin/clients?calendar_connected=1`
    : `${APP_URL}/dashboard/settings?calendar_connected=1`

  const response = NextResponse.redirect(successUrl)
  response.cookies.delete('google_oauth_nonce')
  return response
}
