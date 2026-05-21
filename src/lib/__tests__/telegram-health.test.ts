/**
 * telegram-health.test.ts — unit tests for the pure check functions in
 * telegram-health.ts. Mocks Telegram API responses with stub projections;
 * no live bot token, no network.
 *
 * Run: npx tsx --test src/lib/__tests__/telegram-health.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkBotTokenValid,
  checkWebhookHealth,
  checkClientChatIdsInvalid,
  checkRecentSendFailureRate,
  exitCodeForFindings,
  FAILURE_RATE_THRESHOLD,
  MIN_FAILURE_RATE_SAMPLE,
  WEBHOOK_ERROR_WINDOW_HOURS,
  type TelegramGetMeResult,
  type TelegramWebhookInfoResult,
  type TelegramGetChatResult,
  type TelegramHealthClientRow,
  type NotificationLogStats,
  type TelegramHealthFinding,
} from '../telegram-health.js'

const NOW = Date.UTC(2026, 4, 20, 12) // 2026-05-20 12:00 UTC

function getMeOk(username = 'unmissed_bot'): TelegramGetMeResult {
  return { ok: true, result: { id: 123, is_bot: true, username } }
}
function getMeFail(error_code = 401, description = 'Unauthorized'): TelegramGetMeResult {
  return { ok: false, error_code, description }
}

function webhookInfo(overrides: Partial<NonNullable<TelegramWebhookInfoResult['result']>> = {}): TelegramWebhookInfoResult {
  return {
    ok: true,
    result: {
      url: 'https://unmissed.ai/api/webhook/telegram',
      has_custom_certificate: false,
      pending_update_count: 0,
      ...overrides,
    },
  }
}

// ────────────────────────────────────────────────────────────────────────
describe('checkBotTokenValid', () => {
  test('PASS: getMe returns ok=true + is_bot=true → no findings', () => {
    const out = checkBotTokenValid(getMeOk())
    assert.deepEqual(out, [])
  })

  test('P0: getMe returns ok=false (401) → single P0 finding', () => {
    const out = checkBotTokenValid(getMeFail(401, 'Unauthorized'))
    assert.equal(out.length, 1)
    assert.equal(out[0].severity, 'P0')
    assert.equal(out[0].check_name, 'bot_token_valid')
    assert.equal(out[0].client_slug, null)
    assert.equal(out[0].details.telegram_error_code, 401)
    assert.match(out[0].summary, /HTTP 401/)
  })

  test('P0: getMe ok=true but is_bot=false (impossibly weird response) → P0', () => {
    const weird: TelegramGetMeResult = { ok: true, result: { id: 0, is_bot: false, username: 'x' } }
    const out = checkBotTokenValid(weird)
    assert.equal(out.length, 1)
    assert.equal(out[0].severity, 'P0')
  })

  test('P0: getMe ok=false with no error_code → still P0, summary has description', () => {
    const out = checkBotTokenValid({ ok: false, description: 'network: ETIMEDOUT' })
    assert.equal(out.length, 1)
    assert.equal(out[0].details.telegram_error_code, null)
    assert.match(out[0].summary, /ETIMEDOUT/)
  })
})

// ────────────────────────────────────────────────────────────────────────
describe('checkWebhookHealth', () => {
  test('PASS: webhook info ok, no last_error_date → no findings', () => {
    const out = checkWebhookHealth(webhookInfo(), NOW)
    assert.deepEqual(out, [])
  })

  test('PASS: getWebhookInfo failed → silent skip (covered by P0 token check)', () => {
    const out = checkWebhookHealth({ ok: false, error_code: 401, description: 'Unauthorized' }, NOW)
    assert.deepEqual(out, [])
  })

  test('PASS: no webhook URL configured (long-poll mode) → silent skip', () => {
    const out = checkWebhookHealth(webhookInfo({ url: '' }), NOW)
    assert.deepEqual(out, [])
  })

  test('P1: last_error_date inside the 24h window with a message → P1', () => {
    const oneHourAgoSec = Math.floor((NOW - 60 * 60 * 1000) / 1000)
    const out = checkWebhookHealth(
      webhookInfo({ last_error_date: oneHourAgoSec, last_error_message: 'Wrong response from the webhook: 502 Bad Gateway' }),
      NOW,
    )
    assert.equal(out.length, 1)
    assert.equal(out[0].severity, 'P1')
    assert.equal(out[0].check_name, 'webhook_health')
    assert.match(out[0].summary, /502 Bad Gateway/)
  })

  test('PASS: last_error_date is older than 24h → no finding (no perpetual alert from old blip)', () => {
    const threeDaysAgoSec = Math.floor((NOW - 3 * 24 * 60 * 60 * 1000) / 1000)
    const out = checkWebhookHealth(
      webhookInfo({ last_error_date: threeDaysAgoSec, last_error_message: 'old' }),
      NOW,
    )
    assert.deepEqual(out, [])
  })

  test('PASS: last_error_date present but no last_error_message → no finding', () => {
    const recent = Math.floor((NOW - 60 * 1000) / 1000)
    const out = checkWebhookHealth(webhookInfo({ last_error_date: recent }), NOW)
    assert.deepEqual(out, [])
  })

  test('boundary: error exactly at the 24h edge does NOT fire (older-than is the gate)', () => {
    const edgeSec = Math.floor((NOW - WEBHOOK_ERROR_WINDOW_HOURS * 60 * 60 * 1000 - 1) / 1000)
    const out = checkWebhookHealth(
      webhookInfo({ last_error_date: edgeSec, last_error_message: 'edge' }),
      NOW,
    )
    assert.deepEqual(out, [])
  })
})

// ────────────────────────────────────────────────────────────────────────
describe('checkClientChatIdsInvalid', () => {
  const clients: TelegramHealthClientRow[] = [
    { slug: 'hasan-sharif', telegram_chat_id: '111' },
    { slug: 'acme', telegram_chat_id: '222' },
    { slug: 'no-chat-yet', telegram_chat_id: null },
  ]

  test('PASS: all clients reachable → no findings', () => {
    const map = new Map<string, TelegramGetChatResult>([
      ['hasan-sharif', { ok: true, result: { id: 111, type: 'private' } }],
      ['acme', { ok: true, result: { id: 222, type: 'private' } }],
    ])
    const out = checkClientChatIdsInvalid(clients, map)
    assert.deepEqual(out, [])
  })

  test('P1: HTTP 400 "chat not found" → one finding for that client', () => {
    const map = new Map<string, TelegramGetChatResult>([
      ['hasan-sharif', { ok: true, result: { id: 111, type: 'private' } }],
      ['acme', { ok: false, error_code: 400, description: 'Bad Request: chat not found' }],
    ])
    const out = checkClientChatIdsInvalid(clients, map)
    assert.equal(out.length, 1)
    assert.equal(out[0].severity, 'P1')
    assert.equal(out[0].client_slug, 'acme')
    assert.equal(out[0].check_name, 'client_chat_id_invalid')
    assert.equal(out[0].details.telegram_error_code, 400)
  })

  test('P1: HTTP 403 (bot blocked by user) → finding fires', () => {
    const map = new Map<string, TelegramGetChatResult>([
      ['acme', { ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' }],
    ])
    const out = checkClientChatIdsInvalid([{ slug: 'acme', telegram_chat_id: '222' }], map)
    assert.equal(out.length, 1)
    assert.equal(out[0].details.telegram_error_code, 403)
  })

  test('skips: HTTP 5xx (transient — handled by token check / no spam) → no finding', () => {
    const map = new Map<string, TelegramGetChatResult>([
      ['acme', { ok: false, error_code: 502, description: 'Bad Gateway' }],
    ])
    const out = checkClientChatIdsInvalid([{ slug: 'acme', telegram_chat_id: '222' }], map)
    assert.deepEqual(out, [])
  })

  test('skips: clients with no telegram_chat_id stored', () => {
    const map = new Map<string, TelegramGetChatResult>()
    const out = checkClientChatIdsInvalid(clients, map)
    assert.deepEqual(out, [])
  })

  test('multi-client: 2 of 3 unreachable → exactly 2 findings, each with correct slug', () => {
    const map = new Map<string, TelegramGetChatResult>([
      ['hasan-sharif', { ok: false, error_code: 400, description: 'chat not found' }],
      ['acme', { ok: false, error_code: 400, description: 'chat not found' }],
    ])
    const out = checkClientChatIdsInvalid(clients, map)
    assert.equal(out.length, 2)
    const slugs = out.map(f => f.client_slug).sort()
    assert.deepEqual(slugs, ['acme', 'hasan-sharif'])
  })
})

// ────────────────────────────────────────────────────────────────────────
describe('checkRecentSendFailureRate', () => {
  function stats(failures: number, total: number): NotificationLogStats {
    return { failures, total, window_since_iso: '2026-05-19T12:00:00.000Z' }
  }

  test('PASS: 0/50 failures (clean) → no finding', () => {
    const out = checkRecentSendFailureRate(stats(0, 50))
    assert.deepEqual(out, [])
  })

  test('PASS: failure rate exactly at threshold (10%) → no finding (must exceed)', () => {
    const out = checkRecentSendFailureRate(stats(5, 50))
    assert.equal(out.length, 0)
  })

  test('P1: failure rate above threshold → fires', () => {
    const out = checkRecentSendFailureRate(stats(10, 50)) // 20%
    assert.equal(out.length, 1)
    assert.equal(out[0].severity, 'P1')
    assert.equal(out[0].check_name, 'recent_send_failure_rate')
    assert.equal(out[0].details.failures, 10)
    assert.equal(out[0].details.total, 50)
    assert.match(out[0].summary, /20\.0%/)
  })

  test('PASS: sample too small (< MIN_FAILURE_RATE_SAMPLE) even at 100% → no finding (noise gate)', () => {
    const out = checkRecentSendFailureRate(stats(1, 1))
    assert.equal(out.length, 0)
    // sanity check on the gate constant
    assert.ok(MIN_FAILURE_RATE_SAMPLE >= 10)
  })

  test('P1: 100% failure rate with large enough sample → fires', () => {
    const out = checkRecentSendFailureRate(stats(MIN_FAILURE_RATE_SAMPLE, MIN_FAILURE_RATE_SAMPLE))
    assert.equal(out.length, 1)
    assert.equal(out[0].details.failure_rate, 1)
  })

  test('threshold constant sanity', () => {
    assert.equal(FAILURE_RATE_THRESHOLD, 0.1)
  })
})

// ────────────────────────────────────────────────────────────────────────
describe('exitCodeForFindings', () => {
  test('0 for no findings', () => {
    assert.equal(exitCodeForFindings([]), 0)
  })

  test('1 when any P0 present (even if P1 also present)', () => {
    const findings: TelegramHealthFinding[] = [
      { check_name: 'bot_token_valid', severity: 'P0', client_slug: null, summary: '', details: {} },
      { check_name: 'webhook_health', severity: 'P1', client_slug: null, summary: '', details: {} },
    ]
    assert.equal(exitCodeForFindings(findings), 1)
  })

  test('2 when only P1 present', () => {
    const findings: TelegramHealthFinding[] = [
      { check_name: 'webhook_health', severity: 'P1', client_slug: null, summary: '', details: {} },
    ]
    assert.equal(exitCodeForFindings(findings), 2)
  })
})

// ────────────────────────────────────────────────────────────────────────
describe('composite scenarios', () => {
  test('token revoked: bot_token_valid P0 fires, downstream checks short-circuit at script layer', () => {
    // This case asserts a contract: when getMe fails the script will not even
    // call getChat / getWebhookInfo, so per-client findings won't pile up.
    // Test layer just confirms the P0 finding is the only one.
    const out = checkBotTokenValid(getMeFail(401, 'Unauthorized'))
    assert.equal(out.length, 1)
    assert.equal(out[0].severity, 'P0')
  })

  test('all-green: clean run produces zero findings across all checks', () => {
    const tokenOut = checkBotTokenValid(getMeOk())
    const webhookOut = checkWebhookHealth(webhookInfo(), NOW)
    const chatOut = checkClientChatIdsInvalid(
      [{ slug: 'acme', telegram_chat_id: '222' }],
      new Map([['acme', { ok: true, result: { id: 222, type: 'private' } }]]),
    )
    const failOut = checkRecentSendFailureRate({ failures: 1, total: 100, window_since_iso: '2026-05-19T12:00:00Z' })
    assert.deepEqual([...tokenOut, ...webhookOut, ...chatOut, ...failOut], [])
  })
})
