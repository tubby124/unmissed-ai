/**
 * Operator-confirmed actions (churn flow).
 *
 * promptNumberRelease() is called from the Stripe webhook when a
 * subscription cancels. It creates a long-TTL pending action and sends the
 * operator a Telegram prompt with an inline keyboard:
 *
 *   [📴 Release number]  → rel:<token>   → releaseClientNumber()
 *   [📞 Keep number]     → keep:<token>  → cancel, number stays
 *
 * The message MUST go out via the global bot (TELEGRAM_BOT_TOKEN) — that is
 * the bot whose webhook is registered at /api/webhook/telegram, so button
 * taps only round-trip if this bot sent the message. Per-client bots would
 * swallow the callback.
 *
 * TTL is 72h: churn decisions aren't made in 60 seconds, and an expired
 * token degrades safely — the number is simply kept until released from
 * the admin dashboard (/api/admin/unassign-number).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createPendingAction } from './pending-actions'

const RELEASE_TTL_SECONDS = 72 * 60 * 60

export function operatorBotToken(): string | undefined {
  return process.env.TELEGRAM_OPERATOR_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN
}

export function operatorChatId(): number | null {
  const raw = process.env.TELEGRAM_OPERATOR_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function isOperatorChat(chatId: number): boolean {
  const op = operatorChatId()
  return op !== null && op === chatId
}

export async function promptNumberRelease(
  supa: SupabaseClient,
  client: { id: string; slug: string; business_name: string | null; twilio_number: string | null },
  reason: string,
): Promise<void> {
  const token = operatorBotToken()
  const chatId = operatorChatId()
  if (!token || !chatId) {
    console.warn('[operator-actions] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set — cannot prompt number release')
    return
  }
  if (!client.twilio_number) {
    console.log(`[operator-actions] ${client.slug} has no Twilio number — nothing to release`)
    return
  }

  const actionToken = await createPendingAction(supa, {
    client_id: client.id,
    chat_id: chatId,
    kind: 'release_twilio_number',
    payload: {
      number: client.twilio_number,
      slug: client.slug,
      business_name: client.business_name,
    },
    ttlSeconds: RELEASE_TTL_SECONDS,
  })
  if (!actionToken) {
    console.error(`[operator-actions] pending-action insert failed for ${client.slug} — release prompt not sent`)
    return
  }

  const name = client.business_name ?? client.slug
  const text =
    `📴 <b>Release Twilio number?</b>\n` +
    `${name} (${client.slug}) — ${reason}\n` +
    `Number: ${client.twilio_number}\n\n` +
    `Release returns it to the inventory pool (callers get the idle message). ` +
    `Keep holds it for win-back. Buttons work for 72h; after that release from the admin dashboard.`

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '📴 Release number', callback_data: `rel:${actionToken}` },
          { text: '📞 Keep number', callback_data: `keep:${actionToken}` },
        ]],
      },
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '(unreadable)')
    console.error(`[operator-actions] release prompt send failed HTTP ${res.status}: ${body}`)
  }
}
