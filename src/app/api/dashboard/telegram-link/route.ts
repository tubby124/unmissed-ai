/**
 * POST /api/dashboard/telegram-link
 *
 * Returns the current Telegram deep link for the authenticated client owner.
 * If no token exists (already consumed or never generated), creates a fresh one.
 * Client owners can only access their own client's token; admins can fetch
 * for any client they specify.
 *
 * Body: { clientId: string }
 * Returns: { deepLink: string, token: string }
 *
 * Phase 3 Wave B: cross-client edit guard + audit log when admin generates a
 * link for another client. Generating a token mutates `clients.telegram_registration_token`
 * so it qualifies as a "write" under the audit policy.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'
import {
  resolveAdminScope,
  rejectIfEditModeRequired,
  auditAdminWrite,
} from '@/lib/admin-scope-helpers'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createServerClient()
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const requestedId =
    typeof body['clientId'] === 'string' ? (body['clientId'] as string).trim()
    : typeof body['client_id'] === 'string' ? (body['client_id'] as string).trim()
    : ''
  if (!requestedId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  // Normalize to admin-scope-helpers contract: it expects body.client_id.
  const normalizedBody: Record<string, unknown> = { ...body, client_id: requestedId }

  const resolved = await resolveAdminScope({
    supabase,
    req,
    body: normalizedBody,
    acceptCamelCase: true,
  })
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: resolved.status })
  }
  const { scope } = resolved

  // Non-admin must own the row (matches legacy behavior).
  if (scope.role !== 'admin') {
    const { data: cu } = await supabase
      .from('client_users')
      .select('role')
      .eq('user_id', scope.user.id)
      .eq('client_id', requestedId)
      .limit(1)
      .maybeSingle()
    if (!cu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const denied = rejectIfEditModeRequired(scope)
  if (denied) return denied

  const svc = createServiceClient()

  // Fetch current token state (snapshot before-row for cross-client audit).
  const { data: client, error: fetchErr } = await svc
    .from('clients')
    .select('telegram_registration_token, telegram_chat_id')
    .eq('id', requestedId)
    .single()

  if (fetchErr || !client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // Already connected — no need to return a token, no write to audit.
  if (client.telegram_chat_id) {
    return NextResponse.json({ alreadyConnected: true })
  }

  // Use existing token or generate a new one
  let token = client.telegram_registration_token as string | null
  let didMutate = false
  if (!token) {
    token = randomUUID()
    const { error: updateErr } = await svc
      .from('clients')
      .update({ telegram_registration_token: token })
      .eq('id', requestedId)

    if (updateErr) {
      console.error('[telegram-link] Token write failed:', updateErr.message)
      void auditAdminWrite({
        scope,
        route: '/api/dashboard/telegram-link',
        method: 'POST',
        payload: { client_id: requestedId, generated_token: true },
        status: 'error',
        errorMessage: updateErr.message,
      })
      return NextResponse.json({ error: 'Failed to generate link' }, { status: 500 })
    }
    didMutate = true
  }

  if (didMutate && scope.guard.isCrossClient) {
    void auditAdminWrite({
      scope,
      route: '/api/dashboard/telegram-link',
      method: 'POST',
      payload: { client_id: requestedId, generated_token: true },
      beforeRow: { telegram_registration_token: client.telegram_registration_token },
      afterRow: { telegram_registration_token: token },
      fieldKeys: ['telegram_registration_token'],
    })
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'hassitant_1bot'
  const deepLink = `https://t.me/${botUsername}?start=${token}`

  return NextResponse.json({ deepLink, token })
}
