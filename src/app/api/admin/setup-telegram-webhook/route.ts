/**
 * POST /api/admin/setup-telegram-webhook
 *
 * One-time setup: registers the Telegram bot webhook URL with Telegram's API.
 * Must be called once (or after any URL change) to point @hassitant_1bot
 * at /api/webhook/telegram on this Railway deployment.
 *
 * Idempotent — safe to call multiple times.
 * Admin only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { APP_URL } from '@/lib/app-url'

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth — admin only ──────────────────────────────────────────────────────
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cu } = await supabase
    .from('client_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (cu?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET

  if (!botToken) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 500 })
  if (!APP_URL) return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL not set' }, { status: 500 })

  const webhookUrl = `${APP_URL}/api/webhook/telegram`

  const body: Record<string, unknown> = { url: webhookUrl }
  if (webhookSecret) body.secret_token = webhookSecret

  const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  console.log(`[setup-telegram-webhook] setWebhook → ${webhookUrl} | result:`, data)

  return NextResponse.json({ webhookUrl, telegramResponse: data })
}
