/**
 * POST /api/webhook/telegram
 *
 * Telegram bot webhook handler — receives all updates sent to @hassistant1_bot.
 * Handles the client Telegram registration flow:
 *   Client clicks deep link → sends /start {token} → this route captures their chat_id
 *   → writes telegram_chat_id + telegram_bot_token to clients table
 *   → replies with confirmation message
 *
 * Registered once via POST /api/admin/setup-telegram-webhook.
 * Always returns HTTP 200 (Telegram retries on non-200).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

interface TelegramUpdate {
  message?: {
    text?: string
    chat: { id: number }
    from?: { first_name?: string; username?: string }
  }
}

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN!
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Validate webhook secret (optional but recommended — set via setup-telegram-webhook)
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (webhookSecret) {
    const incomingSecret = req.headers.get('x-telegram-bot-api-secret-token')
    if (incomingSecret !== webhookSecret) {
      console.warn('[telegram-webhook] Invalid secret token — ignoring update')
      return new NextResponse('OK', { status: 200 }) // Always 200 to Telegram
    }
  }

  let update: TelegramUpdate
  try {
    update = await req.json() as TelegramUpdate
  } catch {
    return new NextResponse('OK', { status: 200 })
  }

  const message = update.message
  if (!message?.text) return new NextResponse('OK', { status: 200 })

  const text = message.text.trim()
  const chatId = message.chat.id
  const firstName = message.from?.first_name ?? 'there'

  // Only handle /start commands
  if (!text.startsWith('/start')) {
    console.log(`[telegram-webhook] Non-start message from chatId=${chatId} — ignoring`)
    return new NextResponse('OK', { status: 200 })
  }

  const token = text.slice(6).trim() // "/start TOKEN"

  if (!token) {
    await sendTelegramMessage(chatId, `Hi ${firstName}! To connect your call alerts, use the link from your welcome email.`)
    return new NextResponse('OK', { status: 200 })
  }

  console.log(`[telegram-webhook] Registration attempt — chatId=${chatId} token=${token.slice(0, 8)}...`)

  // Look up client by registration token
  const { data: client, error } = await adminSupa
    .from('clients')
    .select('id, business_name, status')
    .eq('telegram_registration_token', token)
    .in('status', ['setup', 'active'])
    .single()

  if (error || !client) {
    console.warn(`[telegram-webhook] No client found for token=${token.slice(0, 8)}...`)
    await sendTelegramMessage(
      chatId,
      '⚠️ This link is invalid or has already been used.\n\nContact <b>support@unmissed.ai</b> to get a new link.'
    )
    return new NextResponse('OK', { status: 200 })
  }

  // Write chat_id + bot_token, consume the registration token
  const platformBotToken = process.env.TELEGRAM_BOT_TOKEN!
  const { error: updateErr } = await adminSupa
    .from('clients')
    .update({
      telegram_chat_id: String(chatId),
      telegram_bot_token: platformBotToken,
      telegram_registration_token: null,
    })
    .eq('id', client.id)

  if (updateErr) {
    console.error(`[telegram-webhook] Failed to update client ${client.id}: ${updateErr.message}`)
    await sendTelegramMessage(chatId, '⚠️ Registration failed. Please try again or contact support@unmissed.ai.')
    return new NextResponse('OK', { status: 200 })
  }

  console.log(`[telegram-webhook] Registered chatId=${chatId} for client ${client.business_name} (${client.id})`)

  await sendTelegramMessage(
    chatId,
    `✅ <b>Connected!</b>\n\nYou'll now receive call alerts for <b>${client.business_name}</b> here.\n\nEvery time someone calls your AI agent, you'll get an instant notification with call details.`
  )

  return new NextResponse('OK', { status: 200 })
}
