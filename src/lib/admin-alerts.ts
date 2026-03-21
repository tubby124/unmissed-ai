/**
 * S9a: Shared admin notification helper.
 * Sends critical system alerts to the operator Telegram bot
 * and logs them to notification_logs for the health cron (S9c).
 */
import { sendAlert } from '@/lib/telegram'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function notifySystemFailure(
  context: string,
  error: unknown,
  supabase?: SupabaseClient,
  clientId?: string,
): Promise<void> {
  const operatorToken = process.env.TELEGRAM_OPERATOR_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN
  const operatorChat = process.env.TELEGRAM_OPERATOR_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID
  const errStr = error instanceof Error ? error.message : String(error)

  console.error(`[admin-alert] ${context}: ${errStr}`)

  if (operatorToken && operatorChat) {
    try {
      await sendAlert(operatorToken, operatorChat,
        `⚠️ <b>System Alert</b>\n<b>Context:</b> ${context}\n<b>Error:</b> ${errStr.slice(0, 500)}`)
    } catch (alertErr) {
      console.error(`[admin-alert] Telegram send failed:`, alertErr)
    }
  }

  // Log to notification_logs for S9c cron visibility
  if (supabase) {
    try {
      await supabase.from('notification_logs').insert({
        client_id: clientId ?? null,
        channel: 'system',
        recipient: 'admin',
        content: `${context}: ${errStr}`.slice(0, 10000),
        status: 'failed',
        error: errStr.slice(0, 1000),
      })
    } catch {
      // Never let logging break the caller
    }
  }
}
