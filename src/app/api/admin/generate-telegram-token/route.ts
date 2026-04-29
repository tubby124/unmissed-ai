/**
 * POST /api/admin/generate-telegram-token
 *
 * Generates (or regenerates) a Telegram registration token for any client.
 * Returns a deep link the admin can forward to the client.
 * Client clicks link → opens the bot (TELEGRAM_BOT_USERNAME) → sends /start {token}
 * → /api/webhook/telegram captures their chat_id automatically.
 *
 * Admin only.
 * Body: { clientId: string }
 * Returns: { token, deepLink }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth — admin only ──────────────────────────────────────────────────────
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .order('role').limit(1).maybeSingle()

  if (cu?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ── Parse body ─────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as { clientId?: string }
  const clientId = body.clientId?.trim()
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'hassitant_1bot'

  // ── Generate token ─────────────────────────────────────────────────────────
  const token = randomUUID()

  const svc = createServiceClient()
  const { data: client, error: updateErr } = await svc
    .from('clients')
    .update({ telegram_registration_token: token })
    .eq('id', clientId)
    .select('slug, business_name')
    .single()

  if (updateErr || !client) {
    console.error('[generate-telegram-token] Update failed:', updateErr)
    return NextResponse.json({ error: 'Client not found or update failed' }, { status: 404 })
  }

  // Telegram deep link: opens bot and auto-sends /start {token}
  const deepLink = `https://t.me/${botUsername}?start=${token}`

  console.log(`[generate-telegram-token] Token generated for ${client.slug} (${clientId})`)

  return NextResponse.json({
    token,
    deepLink,
    clientSlug: client.slug,
    businessName: client.business_name,
    instructions: `Share this link with ${client.business_name}: ${deepLink}`,
  })
}
