/**
 * POST /api/webhook/telegram
 *
 * Telegram bot webhook handler — receives all updates sent to @hassitant_1bot.
 * Handles:
 *   - /start <token> registration deep link
 *   - Tier 1 slash commands (/calls, /today, /missed, /lastcall, /minutes, /help)
 *   - Inline keyboard callback_query taps (callback_data dispatched as the
 *     equivalent slash command — owner can use the bot without typing)
 *
 * Registered once via POST /api/admin/setup-telegram-webhook.
 *
 * Reliability rules:
 * - Return 200 for valid/complete processing and for graceful ignores
 * - Return 500 on infrastructure failures (Supabase write error) so Telegram retries for 24h
 * - No webhook secret check — the UUID token is the security; secret causes silent drops during deploys
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { SUPPORT_EMAIL } from '@/lib/brand'
import { routeTelegramMessage, dispatchCommand } from '@/lib/telegram/router'
import { fetchClientByChatId, type TelegramClientRow } from '@/lib/telegram/queries'
import {
  buildQuickActionsKeyboard,
  buildContextActionsKeyboard,
  CALLBACK_CODE_TO_COMMAND,
  isTier3ReservedCode,
  renderTier3ComingSoon,
} from '@/lib/telegram/menu'
import { answerForClient } from '@/lib/telegram/assistant'
import type { InlineKeyboardMarkup } from '@/lib/telegram/types'
import type { SupabaseClient } from '@supabase/supabase-js'

interface TelegramUpdate {
  update_id?: number
  message?: {
    text?: string
    chat: { id: number; type?: string }
    from?: { first_name?: string; username?: string }
  }
  callback_query?: {
    id: string
    data?: string
    from?: { first_name?: string }
    message?: { chat: { id: number; type?: string } }
  }
}

interface SendOptions {
  reply_markup?: InlineKeyboardMarkup
}

async function sendTelegramMessage(
  chatId: number,
  text: string,
  opts: SendOptions = {}
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN!
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  }
  if (opts.reply_markup) body.reply_markup = opts.reply_markup
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function answerCallbackQuery(callbackQueryId: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN!
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
    })
  } catch (err) {
    // Silent ack failure is non-fatal — the user just sees a spinner for a moment.
    console.warn(`[telegram-webhook] answerCallbackQuery failed: ${(err as Error).message}`)
  }
}

async function sendChatAction(chatId: number, action: 'typing'): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN!
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
    })
  } catch (err) {
    console.warn(`[telegram-webhook] sendChatAction failed: ${(err as Error).message}`)
  }
}

async function handleAssistantRequest(
  supa: SupabaseClient,
  chatId: number,
  client: TelegramClientRow,
  text: string
): Promise<void> {
  await sendChatAction(chatId, 'typing')
  const result = await answerForClient(client, text, {
    supa,
    timezone: 'America/Regina',
  })

  await sendTelegramMessage(chatId, result.reply, {
    reply_markup: buildContextActionsKeyboard(result.intent),
  })

  // PII-free cost telemetry — token counts + outcome only, no message text.
  try {
    await supa.from('telegram_assistant_log').insert({
      chat_id: chatId,
      client_id: client.id,
      model: result.model,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      latency_ms: result.latencyMs,
      outcome: result.outcome,
    })
  } catch (err) {
    console.warn(`[telegram-webhook] assistant log insert failed: ${(err as Error).message}`)
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const adminSupa = createServiceClient()
  let update: TelegramUpdate
  try {
    update = await req.json() as TelegramUpdate
  } catch {
    return new NextResponse('OK', { status: 200 })
  }

  // ── callback_query branch (inline keyboard taps) ──────────────────────────
  if (update.callback_query) {
    const cq = update.callback_query
    const chat = cq.message?.chat
    if (!chat || chat.type !== 'private' || !cq.data) {
      // Silent ack to kill spinner, then ignore
      await answerCallbackQuery(cq.id)
      return new NextResponse('OK', { status: 200 })
    }

    // Always ack first to remove the loading spinner on the tapped button
    await answerCallbackQuery(cq.id)

    const chatId = chat.id
    const code = cq.data

    if (isTier3ReservedCode(code)) {
      await sendTelegramMessage(chatId, renderTier3ComingSoon(), {
        reply_markup: buildQuickActionsKeyboard(),
      })
      return new NextResponse('OK', { status: 200 })
    }

    const cmd = CALLBACK_CODE_TO_COMMAND[code]
    if (!cmd) {
      await sendTelegramMessage(chatId, "I didn't catch that. Try /help or tap a button below.", {
        reply_markup: buildQuickActionsKeyboard(),
      })
      return new NextResponse('OK', { status: 200 })
    }

    try {
      const client = await fetchClientByChatId(adminSupa, chatId)
      if (!client) {
        await sendTelegramMessage(
          chatId,
          "This bot only responds to clients of unmissed.ai.\n\nIf you're a client, use the link from your welcome email to connect."
        )
        return new NextResponse('OK', { status: 200 })
      }
      const result = await dispatchCommand(cmd, client, {
        supa: adminSupa,
        timezone: 'America/Regina',
      })
      if (result.kind === 'reply') {
        await sendTelegramMessage(chatId, result.text, { reply_markup: result.reply_markup })
      }
    } catch (err) {
      console.error(`[telegram-webhook] Callback dispatch error chatId=${chatId} code=${code}: ${(err as Error).message}`)
    }
    return new NextResponse('OK', { status: 200 })
  }

  const message = update.message
  if (!message?.text) return new NextResponse('OK', { status: 200 })

  const text = message.text.trim()
  const chatId = message.chat.id
  const chatType = message.chat.type ?? 'private'
  const firstName = message.from?.first_name ?? 'there'
  const updateId = update.update_id ?? 0

  // ── Router: slash commands + keyword shortcuts + Tier 2 NL Q&A ───────────
  if (!text.startsWith('/start')) {
    try {
      const result = await routeTelegramMessage(
        { update_id: updateId, text, chatId, chatType, firstName },
        { supa: adminSupa, timezone: 'America/Regina' }
      )
      if (result.kind === 'reply') {
        await sendTelegramMessage(chatId, result.text, { reply_markup: result.reply_markup })
      } else if (result.kind === 'assistant') {
        await handleAssistantRequest(adminSupa, chatId, result.client, result.text)
      }
    } catch (err) {
      console.error(`[telegram-webhook] Router error for chatId=${chatId}: ${(err as Error).message}`)
    }
    return new NextResponse('OK', { status: 200 })
  }

  const token = text.slice(6).trim() // "/start TOKEN"

  if (!token) {
    await sendTelegramMessage(
      chatId,
      `Hi ${firstName}! To connect your call alerts, use the link from your welcome email.`
    )
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
      `⚠️ This link is invalid or has already been used.\n\nContact <b>${SUPPORT_EMAIL}</b> to get a new link.`
    )
    return new NextResponse('OK', { status: 200 }) // 200 — don't retry invalid tokens
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
    console.error(`[telegram-webhook] Supabase write failed for client ${client.id}: ${updateErr.message}`)
    return new NextResponse('Error', { status: 500 })
  }

  console.log(`[telegram-webhook] Registered chatId=${chatId} for client ${client.business_name} (${client.id})`)

  await sendTelegramMessage(
    chatId,
    `✅ <b>Connected!</b>\n\nYou'll now receive call alerts for <b>${client.business_name}</b> here.\n\nTap a button below to see your calls — or type any question and I'll answer.`,
    { reply_markup: buildQuickActionsKeyboard() }
  )

  // Operator ping — alert Hasan when any client connects Telegram
  try {
    const { data: adminClient } = await adminSupa
      .from('clients')
      .select('telegram_bot_token, telegram_chat_id')
      .eq('slug', 'hasan-sharif')
      .single()
    const adminBot = adminClient?.telegram_bot_token as string | null
    const adminChat = adminClient?.telegram_chat_id as string | null
    if (adminBot && adminChat) {
      await fetch(`https://api.telegram.org/bot${adminBot}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: adminChat,
          parse_mode: 'HTML',
          text: `🔔 <b>${client.business_name}</b> just connected Telegram\n\nchatId=<code>${chatId}</code> · client_id=<code>${client.id}</code>`,
        }),
      })
    }
  } catch (err) {
    console.warn(`[telegram-webhook] Operator ping failed: ${(err as Error).message}`)
  }

  return new NextResponse('OK', { status: 200 })
}
