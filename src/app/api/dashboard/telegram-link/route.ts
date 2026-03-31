/**
 * POST /api/dashboard/telegram-link
 *
 * Returns the current Telegram deep link for the authenticated client owner.
 * If no token exists (already consumed or never generated), creates a fresh one.
 * Client owners can only access their own client's token.
 *
 * Body: { clientId: string }
 * Returns: { deepLink: string, token: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { clientId?: string }
  const clientId = body.clientId?.trim()
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  // Verify the user owns (or admins) this client
  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .eq('client_id', clientId)
    .limit(1).maybeSingle()

  if (!cu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const svc = createServiceClient()

  // Fetch current token state
  const { data: client, error: fetchErr } = await svc
    .from('clients')
    .select('telegram_registration_token, telegram_chat_id')
    .eq('id', clientId)
    .single()

  if (fetchErr || !client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // Already connected — no need to return a token
  if (client.telegram_chat_id) {
    return NextResponse.json({ alreadyConnected: true })
  }

  // Use existing token or generate a new one
  let token = client.telegram_registration_token as string | null
  if (!token) {
    token = randomUUID()
    const { error: updateErr } = await svc
      .from('clients')
      .update({ telegram_registration_token: token })
      .eq('id', clientId)

    if (updateErr) {
      console.error('[telegram-link] Token write failed:', updateErr.message)
      return NextResponse.json({ error: 'Failed to generate link' }, { status: 500 })
    }
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'hassitant_1bot'
  const deepLink = `https://t.me/${botUsername}?start=${token}`

  return NextResponse.json({ deepLink, token })
}
