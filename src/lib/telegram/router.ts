import type { SupabaseClient } from '@supabase/supabase-js'
import { SlidingWindowRateLimiter } from '@/lib/rate-limiter'
import { getSignedRecordingUrl } from '@/lib/recording-url'
import {
  fetchClientByChatId,
  fetchLastNCalls,
  fetchTodayCalls,
  fetchMissedCalls,
  recordUpdateSeen,
  type TelegramClientRow,
} from './queries'
import {
  renderCallTable,
  renderCallSummary,
  renderHelp,
  renderEmptyCalls,
  renderMinutes,
  renderRateLimited,
  renderUnregistered,
  renderUnknown,
  renderCallsHeader,
} from './format'
import { buildQuickActionsKeyboard } from './menu'
import { matchKeywordShortcut } from './shortcuts'
import type { InlineKeyboardMarkup } from './types'

const rateLimiter = new SlidingWindowRateLimiter(10, 60_000)

export interface TelegramMessage {
  update_id: number
  text: string
  chatId: number
  chatType: string
  firstName: string
}

export interface RouterContext {
  supa: SupabaseClient
  timezone: string
}

export type RouterResult =
  | { kind: 'reply'; text: string; reply_markup?: InlineKeyboardMarkup }
  | { kind: 'assistant'; text: string; client: TelegramClientRow }
  | { kind: 'noop' }
  | { kind: 'fallthrough' } // not a slash command — let the existing /start handler take it

function withKeyboard(text: string): RouterResult {
  return { kind: 'reply', text, reply_markup: buildQuickActionsKeyboard() }
}

export async function routeTelegramMessage(
  msg: TelegramMessage,
  ctx: RouterContext
): Promise<RouterResult> {
  // Group-chat data leak guard
  if (msg.chatType !== 'private') {
    return { kind: 'noop' }
  }

  // /start is handled by the existing registration code path
  if (msg.text.startsWith('/start')) {
    return { kind: 'fallthrough' }
  }

  // update_id idempotency (Telegram retries on 5xx for 24h)
  const seen = await recordUpdateSeen(ctx.supa, msg.update_id, msg.chatId)
  if (seen.alreadySeen) return { kind: 'noop' }

  // Per-chat_id rate limit
  const rateKey = `tg:${msg.chatId}`
  const rate = rateLimiter.check(rateKey)
  if (!rate.allowed) {
    return withKeyboard(renderRateLimited(Math.ceil(rate.retryAfterMs / 1000)))
  }
  rateLimiter.record(rateKey)

  // Multi-tenant gate: chat_id → client_id
  const client = await fetchClientByChatId(ctx.supa, msg.chatId)
  if (!client) {
    return { kind: 'reply', text: renderUnregistered() }
  }

  // Slash command path — handled directly
  if (msg.text.startsWith('/')) {
    return dispatchCommand(msg.text, client, ctx)
  }

  // Keyword shortcut (no-LLM fast path). Single-word "calls" → /calls.
  const shortcut = matchKeywordShortcut(msg.text)
  if (shortcut) {
    return dispatchCommand(shortcut, client, ctx)
  }

  // Anything else → Tier 2 assistant (handled by the webhook layer so it
  // can also fire sendChatAction("typing") and log token usage).
  return { kind: 'assistant', text: msg.text, client }
}

/**
 * Dispatches a command string (e.g. "/calls") for an already-resolved client.
 * Used by both routeTelegramMessage (after rate-limit + client lookup) and
 * the callback_query branch in the webhook (which resolves the client itself
 * and skips rate-limit + idempotency since callbacks are user-initiated taps).
 */
export async function dispatchCommand(
  text: string,
  client: TelegramClientRow,
  ctx: RouterContext
): Promise<RouterResult> {
  const cmd = text.split(/\s+/)[0]?.toLowerCase() ?? ''

  switch (cmd) {
    case '/help':
      return withKeyboard(renderHelp())

    case '/calls':
      return handleCalls(ctx, client)

    case '/today':
      return handleToday(ctx, client)

    case '/missed':
      return handleMissed(ctx, client)

    case '/lastcall':
      return handleLastCall(ctx, client)

    case '/minutes':
      return handleMinutes(client)

    default:
      return withKeyboard(renderUnknown())
  }
}

async function handleCalls(ctx: RouterContext, client: TelegramClientRow): Promise<RouterResult> {
  const rows = await fetchLastNCalls(ctx.supa, client.id, 5)
  if (rows.length === 0) return withKeyboard(renderEmptyCalls())
  const header = renderCallsHeader(rows)
  const table = renderCallTable(rows, ctx.timezone)
  const footer = '/lastcall for full summary · /missed for callbacks'
  const parts = [header, table, footer].filter(Boolean)
  return withKeyboard(parts.join('\n\n'))
}

async function handleToday(ctx: RouterContext, client: TelegramClientRow): Promise<RouterResult> {
  const rows = await fetchTodayCalls(ctx.supa, client.id, ctx.timezone)
  if (rows.length === 0) return withKeyboard('No calls yet today.')
  const header = `<b>${rows.length} call${rows.length === 1 ? '' : 's'} today</b>`
  const table = renderCallTable(rows.slice(0, 10), ctx.timezone)
  return withKeyboard(`${header}\n\n${table}`)
}

async function handleMissed(ctx: RouterContext, client: TelegramClientRow): Promise<RouterResult> {
  const rows = await fetchMissedCalls(ctx.supa, client.id)
  if (rows.length === 0) {
    return withKeyboard('✅ No missed callbacks.')
  }
  const header = `<b>${rows.length} to call back</b>`
  const table = renderCallTable(rows.slice(0, 10), ctx.timezone)
  return withKeyboard(`${header}\n\n${table}`)
}

async function handleLastCall(ctx: RouterContext, client: TelegramClientRow): Promise<RouterResult> {
  const rows = await fetchLastNCalls(ctx.supa, client.id, 1)
  if (rows.length === 0) return withKeyboard(renderEmptyCalls())
  const r = rows[0]!
  let recUrl: string | null = null
  if (r.recording_url) {
    try {
      recUrl = await getSignedRecordingUrl(r.recording_url)
    } catch {
      recUrl = null
    }
  }
  return withKeyboard(renderCallSummary(r, ctx.timezone, recUrl))
}

function handleMinutes(client: TelegramClientRow): RouterResult {
  const used = Math.ceil((client.seconds_used_this_month ?? 0) / 60)
  const limit = client.monthly_minute_limit ?? 0
  const bonus = client.bonus_minutes ?? 0
  return withKeyboard(renderMinutes(used, limit, bonus, client.business_name))
}

// Test hook
export function _resetRateLimiterForTests(): void {
  // @ts-expect-error — internal field
  rateLimiter.windows = new Map()
}
