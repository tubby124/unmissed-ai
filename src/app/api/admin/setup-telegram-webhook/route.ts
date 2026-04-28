/**
 * POST /api/admin/setup-telegram-webhook
 *
 * One-time setup (idempotent):
 *   1. setWebhook        — points @hassitant_1bot at /api/webhook/telegram
 *   2. setMyCommands     — populates the bot's slash-command menu (the "Menu"
 *                          button next to the input + "/" autocomplete)
 *   3. setChatMenuButton — sets the persistent menu icon to "commands"
 *
 * Must be re-run after URL change OR when the command list is updated.
 * Admin only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { APP_URL } from '@/lib/app-url'
import { BOT_COMMANDS } from '@/lib/telegram/menu'

async function tgPost(token: string, method: string, body: unknown): Promise<unknown> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

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

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET

  if (!botToken) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 500 })
  if (!APP_URL) return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL not set' }, { status: 500 })

  const webhookUrl = `${APP_URL}/api/webhook/telegram`

  // 1. setWebhook
  const webhookBody: Record<string, unknown> = { url: webhookUrl }
  if (webhookSecret) webhookBody.secret_token = webhookSecret
  const setWebhookRes = await tgPost(botToken, 'setWebhook', webhookBody)
  console.log(`[setup-telegram-webhook] setWebhook → ${webhookUrl} | result:`, setWebhookRes)

  // 2. setMyCommands — populates the bot's slash menu
  const setCommandsRes = await tgPost(botToken, 'setMyCommands', {
    commands: BOT_COMMANDS,
  })
  console.log('[setup-telegram-webhook] setMyCommands result:', setCommandsRes)

  // 3. setChatMenuButton — surfaces the "Menu" button next to the input
  const setMenuButtonRes = await tgPost(botToken, 'setChatMenuButton', {
    menu_button: { type: 'commands' },
  })
  console.log('[setup-telegram-webhook] setChatMenuButton result:', setMenuButtonRes)

  return NextResponse.json({
    webhookUrl,
    setWebhook: setWebhookRes,
    setMyCommands: setCommandsRes,
    setChatMenuButton: setMenuButtonRes,
  })
}
