/**
 * POST /api/webhook/telegram
 *
 * Telegram bot webhook handler — receives all updates sent to the configured bot
 * (`TELEGRAM_BOT_USERNAME` env var; the bot's identity is the token, not the
 * @username — renaming via @BotFather doesn't break this handler).
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
import {
  resolvePendingAction,
  cancelPendingAction,
  type PendingActionRow,
} from '@/lib/telegram/pending-actions'
import { updateLeadStatusForClient } from '@/lib/calls/lead-status'

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

async function answerCallbackQuery(
  callbackQueryId: string,
  opts: { text?: string; show_alert?: boolean } = {},
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN!
  const body: Record<string, unknown> = { callback_query_id: callbackQueryId }
  // Toast text on the tapped button. Truncate to 200 chars per Telegram's
  // hard limit on answerCallbackQuery.text.
  if (opts.text) body.text = opts.text.slice(0, 200)
  if (opts.show_alert) body.show_alert = true
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
  // Single-fire only. Telegram's typing indicator persists ~5s; a Haiku
  // turn averages 12-14s so the dot fades mid-wait — accepted trade-off
  // (B.3 from Tier 3 followups). The reply still arrives with the inline
  // keyboard, which is the actual completion signal users care about.
  // Re-firing on a 4s interval was the alternative; not worth the
  // bookkeeping for a sub-second UX win.
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

/**
 * Tier 3: cf:<uuid> redeems a pending action; cancel:<uuid> drops it.
 *
 * Both paths terminate the callback_query interaction (toast + optional
 * follow-up message) and return without further dispatch. Multi-tenant
 * scope is enforced by the resolver — a stolen token is silently treated
 * as expired (no info leak).
 *
 * Failure of the underlying mutator surfaces as a toast + a follow-up
 * message so the owner knows the action did not land. We do NOT attempt
 * to retry — confirmable mutations should be deterministic on first
 * confirm.
 */
async function handleConfirmOrCancel(
  supa: SupabaseClient,
  callbackQueryId: string,
  chatId: number,
  code: string,
): Promise<void> {
  if (code.startsWith('cancel:')) {
    const token = code.slice(7).trim()
    if (token) await cancelPendingAction(supa, token, chatId)
    await answerCallbackQuery(callbackQueryId, { text: 'Cancelled.' })
    await sendTelegramMessage(chatId, 'Cancelled — nothing changed.', {
      reply_markup: buildQuickActionsKeyboard(),
    })
    return
  }

  // code.startsWith('cf:')
  const token = code.slice(3).trim()
  if (!token) {
    await answerCallbackQuery(callbackQueryId, { text: "I didn't catch that." })
    return
  }

  const action: PendingActionRow | null = await resolvePendingAction(supa, token, chatId)
  if (!action) {
    await answerCallbackQuery(callbackQueryId, { text: 'That confirmation expired.' })
    await sendTelegramMessage(
      chatId,
      'That confirmation expired. Tap the action again to retry.',
      { reply_markup: buildQuickActionsKeyboard() },
    )
    return
  }

  const name = action.payload.name ?? 'the lead'

  // Both action kinds end at lead_status='called_back'. cb:<id> additionally
  // surfaces the phone number in the prior reply so the owner can tap-to-call;
  // mk:<id> just flips the status. The DB write is identical.
  const result = await updateLeadStatusForClient(
    supa,
    action.payload.call_id,
    action.client_id,
    'called_back',
  )

  if (!result.ok) {
    console.warn(`[telegram-webhook] lead_status mutator failed code=${result.code} client=${action.client_id} call=${action.payload.call_id}`)
    await answerCallbackQuery(callbackQueryId, { text: "Couldn't save that — try again." })
    await sendTelegramMessage(
      chatId,
      `⚠️ I couldn't update <b>${escapeHtml(name)}</b>. Try the action again, or update from the dashboard.`,
      { reply_markup: buildQuickActionsKeyboard() },
    )
    return
  }

  await answerCallbackQuery(callbackQueryId, {
    text: `Done — ${name} marked called back ✅`,
  })
  await sendTelegramMessage(
    chatId,
    `✅ <b>${escapeHtml(name)}</b> marked called back.`,
    { reply_markup: buildQuickActionsKeyboard() },
  )
}

/**
 * Minimal HTML-entity escape for the small set of inline-payload values
 * we render with parse_mode=HTML (lead names, mostly). Telegram's HTML
 * mode only requires &<> escaping; quotes are safe inside `<b>` tags.
 */
function escapeHtml(input: string): string {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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

    const chatId = chat.id
    const code = cq.data

    // ── Tier 3: cf:<uuid> confirm / cancel:<uuid> dispatch ─────────────────
    // cf:<uuid> redeems a pending action created by a prior cb:/mk: tap.
    // 60s TTL, multi-tenant by chat_id. Ack carries a toast so the user
    // sees "Done — <name> ✅" without the keyboard re-rendering.
    if (code.startsWith('cf:') || code.startsWith('cancel:')) {
      try {
        await handleConfirmOrCancel(adminSupa, cq.id, chatId, code)
      } catch (err) {
        console.error(`[telegram-webhook] cf/cancel error chatId=${chatId}: ${(err as Error).message}`)
        // Best-effort silent ack on failure so the spinner clears.
        await answerCallbackQuery(cq.id)
      }
      return new NextResponse('OK', { status: 200 })
    }

    // Always ack first to remove the loading spinner on the tapped button
    await answerCallbackQuery(cq.id)

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

  // Group-chat data leak guard (B.6 — Tier 3 followups). The /start
  // registration path writes telegram_chat_id to the matched client. In a
  // group chat, the bot would happily register the group's chat_id, and
  // every owner notification would then leak to every group member. The
  // router already blocks non-/start group messages (returns 'noop'); the
  // /start branch needs the same guard explicitly.
  if (chatType !== 'private') {
    console.log(`[telegram-webhook] /start ignored — non-private chat type=${chatType} chatId=${chatId}`)
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
