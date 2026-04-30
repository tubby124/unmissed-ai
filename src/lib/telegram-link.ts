/**
 * Centralized Telegram bot deep-link builder.
 *
 * Why: the bot username appeared as a hardcoded fallback in 7 places. Renaming
 * the bot used to be a 7-file PR. Now it's one env var:
 *   - server-side: TELEGRAM_BOT_USERNAME
 *   - client-side: NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
 *
 * The default fallback `AIReceptionist_bot` matches what was previously
 * hardcoded across the repo before consolidation.
 */

const DEFAULT_BOT_USERNAME = 'AIReceptionist_bot'

export function getTelegramBotUsername(): string {
  if (typeof process !== 'undefined' && process.env) {
    return (
      process.env.TELEGRAM_BOT_USERNAME ||
      process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ||
      DEFAULT_BOT_USERNAME
    )
  }
  return DEFAULT_BOT_USERNAME
}

export function buildTelegramBotUrl(): string {
  return `https://t.me/${getTelegramBotUsername()}`
}

export function buildTelegramDeepLink(registrationToken: string): string {
  return `https://t.me/${getTelegramBotUsername()}?start=${registrationToken}`
}
