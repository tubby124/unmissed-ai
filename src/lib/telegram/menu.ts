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

export const TIER3_RESERVED_PREFIXES = ['cb:', 'mk:'] as const

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

export function buildContextActionsKeyboard(intent: AssistantIntent): InlineKeyboardMarkup {
  switch (intent) {
    case 'urgent':
      return {
        inline_keyboard: [
          [{ text: '🔔 See all missed', callback_data: 'm' }],
          [
            { text: '📞 Calls', callback_data: 'c' },
            { text: '⏰ Today', callback_data: 't' },
          ],
        ],
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

export function isTier3ReservedCode(code: string): boolean {
  return TIER3_RESERVED_PREFIXES.some((p) => code.startsWith(p))
}

export function renderTier3ComingSoon(): string {
  return "That action is coming in a future update — for now use /missed to see callbacks."
}
