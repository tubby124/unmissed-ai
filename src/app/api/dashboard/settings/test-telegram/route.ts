import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { sendAlert } from '@/lib/telegram'
import { BRAND_NAME } from '@/lib/brand'
import {
  resolveAdminScope,
  rejectIfEditModeRequired,
  auditAdminWrite,
} from '@/lib/admin-scope-helpers'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const body = await req.json().catch(() => ({}))

  const resolved = await resolveAdminScope({ supabase, req, body })
  if (!resolved.ok) return NextResponse.json({ error: resolved.message }, { status: resolved.status })
  const { scope } = resolved
  if (scope.role !== 'admin') return new NextResponse('Forbidden', { status: 403 })

  const denied = rejectIfEditModeRequired(scope)
  if (denied) return denied

  const targetClientId = scope.targetClientId

  // Use service client to read sensitive fields (telegram_bot_token)
  const service = createServiceClient()
  const { data: client } = await service
    .from('clients')
    .select('telegram_bot_token, telegram_chat_id, business_name')
    .eq('id', targetClientId)
    .single()

  if (!client?.telegram_bot_token || !client?.telegram_chat_id) {
    return NextResponse.json({ ok: false, error: 'Telegram not configured for this client' })
  }

  const ok = await sendAlert(
    client.telegram_bot_token,
    client.telegram_chat_id,
    `<b>${BRAND_NAME} — Test Message</b>\n\nTelegram is configured correctly for <b>${client.business_name}</b>. You will receive call alerts here.`
  )

  if (scope.guard.isCrossClient) {
    void auditAdminWrite({
      scope,
      route: '/api/dashboard/settings/test-telegram',
      method: 'POST',
      payload: { client_id: targetClientId },
      status: ok ? 'ok' : 'error',
      errorMessage: ok ? null : 'sendAlert returned false',
    })
  }

  return NextResponse.json({ ok })
}
