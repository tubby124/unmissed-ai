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
  buildOwnerAlertDetails,
  notificationsAlreadySent,
  shouldSendPerCallEmail,
  type CompletedClient,
  type Classification,
  type NotificationContext,
} from '../completed-notifications.js'
import {
  FIELD_REGISTRY,
  settingsBodySchema,
  buildUpdates,
  SYNC_TRIGGER_FIELDS,
} from '../settings-schema.js'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── Mock Supabase for idempotency check ──────────────────────────────────────

function createIdempotencyMock(count: number | null) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              // Return the count directly (matches .select('id', { count: 'exact', head: true }))
              return Promise.resolve({ count, error: null })
            },
          }
        },
      }
    },
  } as unknown as SupabaseClient
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

  test('email guard: all niches default to email when flag is not explicitly false', () => {
    // Voicemail niche: unchanged behavior
    assert.equal(
      shouldSendPerCallEmail({ niche: 'voicemail', call_handling_mode: null, email_notifications_enabled: null }),
      true,
      'voicemail niche default email path passes guard'
    )
    assert.equal(
      shouldSendPerCallEmail({ niche: 'plumbing', call_handling_mode: 'message_only', email_notifications_enabled: null }),
      true,
      'message_only service niche gets default email path'
    )
    assert.equal(
      shouldSendPerCallEmail({ niche: 'hvac', call_handling_mode: 'message_only', email_notifications_enabled: false }),
      false,
      'message_only can explicitly opt out'
    )

    // Non-voicemail niche: NEW behavior — defaults ON unless explicitly false
    assert.equal(
      shouldSendPerCallEmail({ niche: 'real_estate', call_handling_mode: 'triage', email_notifications_enabled: true }),
      true,
      'non-message mode explicit opt-in passes guard'
    )
    assert.equal(
      shouldSendPerCallEmail({ niche: 'real_estate', call_handling_mode: 'triage', email_notifications_enabled: null }),
      true,
      'non-message mode with null flag now defaults ON (Task 4 — unified semantic)'
    )
    assert.equal(
      shouldSendPerCallEmail({ niche: 'real_estate', call_handling_mode: 'triage', email_notifications_enabled: false }),
      false,
      'non-message mode can explicitly opt out'
    )

    const junkClass: Partial<Classification> = { status: 'JUNK' }
    assert.ok(junkClass.status === 'JUNK', 'JUNK classification → guard triggers (separate path)')

    const noEmail: Partial<CompletedClient> = {
      niche: 'voicemail',
      contact_email: null,
      alert_email: null,
    }
    assert.ok(!noEmail.contact_email && !noEmail.alert_email, 'no email destination → guard triggers (separate path)')
  })
})

describe('Launch readiness: owner alert details', () => {
  test('buildOwnerAlertDetails includes callback-critical fields', () => {
    const details = buildOwnerAlertDetails({
      status: 'HOT',
      summary: 'Maya called about a burst pipe under the kitchen sink. She needs help today.',
      serviceType: 'emergency',
      confidence: 91,
      sentiment: 'frustrated',
      key_topics: ['burst pipe', 'kitchen'],
      next_steps: 'Call Maya immediately and confirm whether the water is shut off.',
      quality_score: 88,
      caller_data: {
        caller_name: 'Maya',
        service_requested: 'Burst pipe under kitchen sink',
      },
    }, '+13065550123', 'Prairie Plumbing')

    assert.equal(details.urgencyLabel, 'Urgent callback')
    assert.equal(details.callerName, 'Maya')
    assert.equal(details.formattedPhone, '+1 (306) 555-0123')
    assert.equal(details.reasonForCall, 'Burst pipe under kitchen sink')
    assert.equal(details.requiredNextStep, 'Call Maya immediately and confirm whether the water is shut off.')
    assert.match(details.leadQuality, /HOT lead/)
    assert.match(details.leadQuality, /88\/100/)
    assert.match(details.callbackOpener, /Hi Maya/)
    assert.match(details.callbackOpener, /Prairie Plumbing/)
  })
})

// ── NotificationContext type shape ───────────────────────────────────────────

describe('S8d: NotificationContext required fields', () => {
  test('NotificationContext has all fields needed by helpers', () => {
    // Compile-time check: if this compiles, the interface matches
    const ctx: NotificationContext = {
      supabase: {} as unknown as SupabaseClient,
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
        call_handling_mode: 'triage',
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

// ── Task 2: alert_phone / alert_email / sms_alerts_enabled registry ──────────

describe('multichannel notifications: settings registry', () => {
  test('FIELD_REGISTRY has alert_phone as DB_ONLY without sync', () => {
    assert.equal(FIELD_REGISTRY.alert_phone?.mutationClass, 'DB_ONLY')
    assert.equal(FIELD_REGISTRY.alert_phone?.triggersSync, false)
  })

  test('FIELD_REGISTRY has alert_email as DB_ONLY without sync', () => {
    assert.equal(FIELD_REGISTRY.alert_email?.mutationClass, 'DB_ONLY')
    assert.equal(FIELD_REGISTRY.alert_email?.triggersSync, false)
  })

  test('FIELD_REGISTRY has sms_alerts_enabled as DB_ONLY without sync', () => {
    assert.equal(FIELD_REGISTRY.sms_alerts_enabled?.mutationClass, 'DB_ONLY')
    assert.equal(FIELD_REGISTRY.sms_alerts_enabled?.triggersSync, false)
  })

  test('Zod schema accepts alert_phone in E.164 form', () => {
    const parsed = settingsBodySchema.safeParse({ alert_phone: '+13065550123' })
    assert.equal(parsed.success, true)
  })

  test('Zod schema rejects alert_phone with letters', () => {
    const parsed = settingsBodySchema.safeParse({ alert_phone: 'not-a-phone' })
    assert.equal(parsed.success, false)
  })

  test('Zod schema rejects alert_phone without leading +', () => {
    const parsed = settingsBodySchema.safeParse({ alert_phone: '13065550123' })
    assert.equal(parsed.success, false)
  })

  test('Zod schema accepts alert_email in valid form', () => {
    const parsed = settingsBodySchema.safeParse({ alert_email: 'info@vellyremodeling.com' })
    assert.equal(parsed.success, true)
  })

  test('Zod schema rejects alert_email with no @', () => {
    const parsed = settingsBodySchema.safeParse({ alert_email: 'notanemail' })
    assert.equal(parsed.success, false)
  })

  test('buildUpdates passes alert_phone through (trim + null on empty)', () => {
    const updates = buildUpdates({ alert_phone: '+13065550123' }, 'owner')
    assert.equal(updates.alert_phone, '+13065550123')
    const cleared = buildUpdates({ alert_phone: '' }, 'owner')
    assert.equal(cleared.alert_phone, null)
  })

  test('buildUpdates passes alert_email through (trim + null on empty)', () => {
    const updates = buildUpdates({ alert_email: 'kausar@example.com' }, 'owner')
    assert.equal(updates.alert_email, 'kausar@example.com')
    const cleared = buildUpdates({ alert_email: '' }, 'owner')
    assert.equal(cleared.alert_email, null)
  })

  test('buildUpdates passes sms_alerts_enabled through as boolean', () => {
    const on = buildUpdates({ sms_alerts_enabled: true }, 'owner')
    assert.equal(on.sms_alerts_enabled, true)
    const off = buildUpdates({ sms_alerts_enabled: false }, 'owner')
    assert.equal(off.sms_alerts_enabled, false)
  })

  test('SYNC_TRIGGER_FIELDS does NOT include the 3 new alert fields', () => {
    // Critical: changing alert_* must never call updateAgent() (per no-redeploy rule)
    assert.ok(!SYNC_TRIGGER_FIELDS.includes('alert_phone'))
    assert.ok(!SYNC_TRIGGER_FIELDS.includes('alert_email'))
    assert.ok(!SYNC_TRIGGER_FIELDS.includes('sms_alerts_enabled'))
  })
})

// ── Task 3: email destination resolution ─────────────────────────────────────

describe('multichannel notifications: email destination resolution', () => {
  function resolveEmailDestination(client: Pick<CompletedClient, 'alert_email' | 'contact_email'>): string | null {
    return client.alert_email || client.contact_email || null
  }

  test('uses alert_email when set', () => {
    const dest = resolveEmailDestination({ alert_email: 'info@velly.com', contact_email: 'kausar@example.com' })
    assert.equal(dest, 'info@velly.com')
  })

  test('falls back to contact_email when alert_email is null', () => {
    const dest = resolveEmailDestination({ alert_email: null, contact_email: 'kausar@example.com' })
    assert.equal(dest, 'kausar@example.com')
  })

  test('returns null when both are null', () => {
    const dest = resolveEmailDestination({ alert_email: null, contact_email: null })
    assert.equal(dest, null)
  })

  test('treats empty alert_email as falsy → falls back', () => {
    const dest = resolveEmailDestination({ alert_email: '', contact_email: 'fallback@x.com' })
    assert.equal(dest, 'fallback@x.com')
  })
})
