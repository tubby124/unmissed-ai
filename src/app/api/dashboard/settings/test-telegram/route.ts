import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { sendAlert } from '@/lib/telegram'
import { BRAND_NAME } from '@/lib/brand'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (!cu || cu.role !== 'admin') {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const targetClientId = body.client_id ?? cu.client_id

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

  return NextResponse.json({ ok })
}
