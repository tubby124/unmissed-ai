import type { InlineKeyboardMarkup, AssistantIntent } from './types'

export const BOT_COMMANDS: ReadonlyArray<{ command: string; description: string }> = [
  { command: 'calls', description: 'Last 5 calls' },
  { command: 'today', description: "Today's calls" },
  { command: 'missed', description: 'Calls to follow up on' },
  { command: 'lastcall', description: 'Full summary of most recent call' },
  { command: 'minutes', description: 'Minutes used this month' },
  { command: 'help', description: 'Show menu' },
]

export const CALLBACK_CODE_TO_COMMAND: Record<string, string> = {
  c: '/calls',
  t: '/today',
  m: '/missed',
  l: '/lastcall',
  n: '/minutes',
  h: '/help',
}

/**
 * Tier 3 callback codes (live as of commit 2026-04-28):
 *   cb:<id>      → "📞 Call back <name>" tap. Opens confirm flow.
 *   mk:<id>      → "✅ Mark called back" tap. Opens confirm flow.
 *   cf:<uuid>    → confirm a pending action (60s TTL).
 *   cancel:<uuid>→ drop a pending action.
 *
 * The webhook route handles cf:/cancel: in handleConfirmOrCancel(); cb:/mk:
 * are dispatched through handleCbMkTap() which creates a pending action
 * and replies with the confirm keyboard. Per L14 of the cold-start prompt,
 * all four formats fit Telegram's 64-byte callback_data cap (cf:<uuid> is
 * the longest at 39 bytes).
 */

/**
 * Top-urgent metadata used by buildContextActionsKeyboard to swap the
 * static `urgent` keyboard for tap-to-act buttons. Pulled from the
 * highest-priority HOT/WARM row in the recent-calls window the assistant
 * already loaded — adding this is zero extra DB reads.
 */
export interface TopUrgent {
  id: string
  name: string | null
}

export interface ContextActionsOpts {
  topUrgent?: TopUrgent
}

export function buildQuickActionsKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '📞 Calls', callback_data: 'c' },
        { text: '⏰ Today', callback_data: 't' },
      ],
      [
        { text: '🔔 Missed', callback_data: 'm' },
        { text: '📊 Minutes', callback_data: 'n' },
      ],
    ],
  }
}

export function buildContextActionsKeyboard(
  intent: AssistantIntent,
  opts: ContextActionsOpts = {},
): InlineKeyboardMarkup {
  switch (intent) {
    case 'urgent': {
      // Tier 3: when there's a top urgent call, surface tap-to-act buttons.
      // Falls back to the static "see all missed" set when there is no
      // open HOT/WARM row — preserves the Tier 2 contract for empty-state.
      if (opts.topUrgent) {
        const label = opts.topUrgent.name ?? 'top lead'
        return {
          inline_keyboard: [
            [{ text: `📞 Call back ${label}`, callback_data: `cb:${opts.topUrgent.id}` }],
            [{ text: '✅ Mark called back', callback_data: `mk:${opts.topUrgent.id}` }],
            [{ text: '🔔 See all missed', callback_data: 'm' }],
          ],
        }
      }
      return {
        inline_keyboard: [
          [{ text: '🔔 See all missed', callback_data: 'm' }],
          [
            { text: '📞 Calls', callback_data: 'c' },
            { text: '⏰ Today', callback_data: 't' },
          ],
        ],
      }
    }
    case 'schedule':
      return {
        inline_keyboard: [
          [
            { text: '⏰ Today', callback_data: 't' },
            { text: '📞 Calls', callback_data: 'c' },
          ],
          [{ text: '🔔 Missed', callback_data: 'm' }],
        ],
      }
    case 'minutes':
      return {
        inline_keyboard: [
          [
            { text: '📊 Minutes', callback_data: 'n' },
            { text: '📞 Calls', callback_data: 'c' },
          ],
        ],
      }
    case 'knowledge':
    case 'generic':
    default:
      return buildQuickActionsKeyboard()
  }
}

