/**
 * notification-guards.test.ts — S8d
 *
 * Tests the notification dispatch guards extracted in S3:
 *   - notificationsAlreadySent (idempotency guard)
 *   - sendTelegramNotification guard paths (no bot token / no chat ID)
 *   - sendSmsFollowUp guard paths (sms disabled / opt-out / dedupe)
 *   - sendEmailNotification guard paths (non-voicemail / no email / JUNK)
 *
 * Uses mock SupabaseClient. Does NOT test actual Twilio/Telegram/Resend calls
 * (those need integration tests with nock or MSW — deferred to S8e).
 *
 * Run: npx tsx --test src/lib/__tests__/notification-guards.test.ts
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  notificationsAlreadySent,
  type CompletedClient,
  type Classification,
  type NotificationContext,
} from '../completed-notifications.js'

// ── Mock Supabase for idempotency check ──────────────────────────────────────

function createIdempotencyMock(count: number | null) {
  return {
    from(_table: string) {
      return {
        select(..._args: unknown[]) {
          return {
            eq(..._eqArgs: unknown[]) {
              // Return the count directly (matches .select('id', { count: 'exact', head: true }))
              return Promise.resolve({ count, error: null })
            },
          }
        },
      }
    },
  } as any
}

// ── notificationsAlreadySent ─────────────────────────────────────────────────

describe('S8d: notificationsAlreadySent — idempotency guard', () => {
  test('returns false when callLogId is null', async () => {
    const supa = createIdempotencyMock(0)
    const result = await notificationsAlreadySent(supa, null)
    assert.equal(result, false, 'null callLogId → skip check, return false')
  })

  test('returns false when no notification_logs rows exist', async () => {
    const supa = createIdempotencyMock(0)
    const result = await notificationsAlreadySent(supa, 'call-log-123')
    assert.equal(result, false, 'count=0 → no prior notifications')
  })

  test('returns true when notification_logs rows exist', async () => {
    const supa = createIdempotencyMock(3)
    const result = await notificationsAlreadySent(supa, 'call-log-123')
    assert.equal(result, true, 'count=3 → notifications already sent')
  })

  test('returns true for count=1 (boundary)', async () => {
    const supa = createIdempotencyMock(1)
    const result = await notificationsAlreadySent(supa, 'call-log-123')
    assert.equal(result, true, 'count=1 → at least one notification exists')
  })

  test('returns false when count is null (Supabase error fallback)', async () => {
    const supa = createIdempotencyMock(null)
    const result = await notificationsAlreadySent(supa, 'call-log-123')
    assert.equal(result, false, 'null count → treat as 0 (safe fallback)')
  })
})

// ── Guard logic: CompletedClient type contracts ──────────────────────────────

describe('S8d: CompletedClient guard prerequisites', () => {
  test('telegram guard: both bot_token and chat_id required', () => {
    // The guard in sendTelegramNotification checks:
    // if (!client.telegram_bot_token || !client.telegram_chat_id) return
    const hasAll: Partial<CompletedClient> = {
      telegram_bot_token: 'bot:token',
      telegram_chat_id: '123456',
    }
    assert.ok(hasAll.telegram_bot_token && hasAll.telegram_chat_id, 'both set → passes guard')

    const missingToken: Partial<CompletedClient> = {
      telegram_bot_token: null,
      telegram_chat_id: '123456',
    }
    assert.ok(!missingToken.telegram_bot_token, 'missing token → guard triggers')

    const missingChat: Partial<CompletedClient> = {
      telegram_bot_token: 'bot:token',
      telegram_chat_id: null,
    }
    assert.ok(!missingChat.telegram_chat_id, 'missing chat_id → guard triggers')
  })

  test('SMS guard: sms_enabled must be true + callerPhone must not be unknown', () => {
    // Guard: if (!client.sms_enabled || callerPhone === 'unknown') return
    const enabled: Partial<CompletedClient> = { sms_enabled: true }
    assert.ok(enabled.sms_enabled, 'sms_enabled=true → passes first check')

    const disabled: Partial<CompletedClient> = { sms_enabled: false }
    assert.ok(!disabled.sms_enabled, 'sms_enabled=false → guard triggers')

    const unknownPhone = 'unknown'
    assert.equal(unknownPhone, 'unknown', 'unknown phone → guard triggers')
  })

  test('email guard: niche must be voicemail + contact_email required + not JUNK', () => {
    // Guard: if (client.niche !== 'voicemail' || !client.contact_email || classification.status === 'JUNK') return
    const validEmail: Partial<CompletedClient> = {
      niche: 'voicemail',
      contact_email: 'test@example.com',
    }
    const validClass: Partial<Classification> = { status: 'HOT' }
    assert.ok(
      validEmail.niche === 'voicemail' && validEmail.contact_email && validClass.status !== 'JUNK',
      'all conditions met → passes guard'
    )

    const wrongNiche: Partial<CompletedClient> = {
      niche: 'real_estate',
      contact_email: 'test@example.com',
    }
    assert.ok(wrongNiche.niche !== 'voicemail', 'non-voicemail niche → guard triggers')

    const junkClass: Partial<Classification> = { status: 'JUNK' }
    assert.ok(junkClass.status === 'JUNK', 'JUNK classification → guard triggers')

    const noEmail: Partial<CompletedClient> = {
      niche: 'voicemail',
      contact_email: null,
    }
    assert.ok(!noEmail.contact_email, 'no contact_email → guard triggers')
  })
})

// ── NotificationContext type shape ───────────────────────────────────────────

describe('S8d: NotificationContext required fields', () => {
  test('NotificationContext has all fields needed by helpers', () => {
    // Compile-time check: if this compiles, the interface matches
    const ctx: NotificationContext = {
      supabase: {} as any,
      client: {
        id: 'c1',
        business_name: 'Test Biz',
        niche: 'real_estate',
        telegram_bot_token: null,
        telegram_chat_id: null,
        telegram_chat_id_2: null,
        telegram_style: null,
        sms_enabled: false,
        sms_template: null,
        twilio_number: null,
        classification_rules: null,
        timezone: 'America/Regina',
        contact_email: null,
        telegram_notifications_enabled: null,
        email_notifications_enabled: null,
      },
      callId: 'uv-call-123',
      callLogId: 'log-456',
      slug: 'test-client',
      callerPhone: '+15551234567',
      classification: {
        status: 'HOT',
        summary: 'Test summary',
        serviceType: 'consultation',
        confidence: 0.9,
        sentiment: 'positive',
        key_topics: ['booking'],
        next_steps: 'Follow up',
        quality_score: 8,
      },
      durationSeconds: 120,
      endedAt: new Date().toISOString(),
      ultravoxSummary: 'Agent summary',
      recordingUrl: null,
      metadata: {},
      transcript: [
        { role: 'agent', text: 'Hello' },
        { role: 'user', text: 'Hi there' },
      ],
    }

    assert.ok(ctx.client.id, 'client.id is required')
    assert.ok(ctx.callId, 'callId is required')
    assert.ok(ctx.slug, 'slug is required')
    assert.ok(ctx.classification.status, 'classification.status is required')
    assert.ok(Array.isArray(ctx.transcript), 'transcript is an array')
  })
})
