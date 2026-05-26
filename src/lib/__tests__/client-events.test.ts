import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CLIENT_EVENT_REGISTRY,
  validateClientEventInput,
  redactEventPayload,
  recordClientEvent,
  type ClientEventInput,
} from '../client-events.js'

function createInsertMock(result: { data?: { id: string } | null; error?: { message: string } | null }) {
  const writes: Array<{ method: string; row: unknown; options?: unknown }> = []
  const harnessRows: unknown[] = []
  const supabase = {
    from(table: string) {
      if (table === 'client_events') {
        return {
          insert(row: unknown) {
            writes.push({ method: 'insert', row })
            return {
              select() {
                return {
                  maybeSingle() {
                    return Promise.resolve({
                      data: result.data ?? null,
                      error: result.error ?? null,
                    })
                  },
                }
              },
            }
          },
          upsert(row: unknown, options?: unknown) {
            writes.push({ method: 'upsert', row, options })
            return {
              select() {
                return {
                  maybeSingle() {
                    return Promise.resolve({
                      data: result.data ?? null,
                      error: result.error ?? null,
                    })
                  },
                }
              },
            }
          },
        }
      }
      if (table === 'harness_findings') {
        return {
          upsert(row: unknown) {
            harnessRows.push(row)
            return Promise.resolve({ error: null })
          },
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  }

  return { supabase, writes, harnessRows }
}

const baseEvent: ClientEventInput = {
  clientId: 'client-1',
  clientSlug: 'test-client',
  eventType: 'setting.changed',
  eventGroup: 'settings',
  actorType: 'owner',
  source: 'api',
  sourceRoute: '/api/dashboard/settings',
  correlationId: 'corr-1',
  dedupeKey: 'setting.changed:client-1:corr-1',
  status: 'success',
  severity: 'notice',
  visibility: 'owner_safe',
  summary: 'Settings changed',
  before: { contact_email: 'owner@example.com' },
  after: { contact_email: 'new@example.com' },
  details: { authorization: 'Bearer secret', phone: '+13065550123' },
}

describe('redactEventPayload', () => {
  test('redacts sensitive keys recursively and masks owner-safe contact values', () => {
    const redacted = redactEventPayload({
      api_key: 'sk_live_secret',
      nested: {
        webhook_signature: 'abc123',
        email: 'owner@example.com',
        phone: '+13065550123',
      },
    }, 'owner_safe')

    assert.equal(redacted.api_key, '[REDACTED]')
    assert.equal((redacted.nested as Record<string, unknown>).webhook_signature, '[REDACTED]')
    assert.equal((redacted.nested as Record<string, unknown>).email, 'ow***@example.com')
    assert.equal((redacted.nested as Record<string, unknown>).phone, '+1*******0123')
  })

  test('masks phone and email values for admin-only payloads too', () => {
    const redacted = redactEventPayload({
      caller_phone: '+13065550123',
      summary: 'Caller owner@example.com asked for a callback at +13065550123.',
    }, 'admin_only')

    assert.equal(redacted.caller_phone, '+1*******0123')
    assert.equal(redacted.summary, 'Caller ow***@example.com asked for a callback at +1*******0123.')
  })

  test('does not treat dates, timestamps, or uuids as phone numbers', () => {
    const redacted = redactEventPayload({
      created_at: '2026-05-26T16:13:59.519Z',
      date_only: '2026-05-26',
      prompt_version_id: 'ff42a3cf-2531-44f3-ad0e-a15000769163',
      summary: 'Prompt version ff42a3cf-2531-44f3-ad0e-a15000769163 inserted at 2026-05-26.',
    }, 'admin_only')

    assert.equal(redacted.created_at, '2026-05-26T16:13:59.519Z')
    assert.equal(redacted.date_only, '2026-05-26')
    assert.equal(redacted.prompt_version_id, 'ff42a3cf-2531-44f3-ad0e-a15000769163')
    assert.equal(redacted.summary, 'Prompt version ff42a3cf-2531-44f3-ad0e-a15000769163 inserted at 2026-05-26.')
  })
})

describe('recordClientEvent', () => {
  test('validates emitted event types against the typed registry', () => {
    assert.deepEqual(Object.keys(CLIENT_EVENT_REGISTRY).sort(), [
      'prompt.version_inserted',
      'tool.invoked',
      'tools.synced',
    ])

    const valid = validateClientEventInput({
      ...baseEvent,
      eventType: 'tool.invoked',
      eventGroup: 'runtime',
      visibility: 'admin_only',
      details: { tool_name: 'queryKnowledge' },
    })

    assert.deepEqual(valid, { ok: true })

    const missingIdentifier = validateClientEventInput({
      ...baseEvent,
      eventType: 'tool.invoked',
      eventGroup: 'runtime',
      visibility: 'admin_only',
      details: {},
    })

    assert.equal(missingIdentifier.ok, false)
    assert.match(missingIdentifier.error ?? '', /details.tool_name/)

    const wrongGroup = validateClientEventInput({
      ...baseEvent,
      eventType: 'tools.synced',
      eventGroup: 'settings',
      visibility: 'admin_only',
      details: { tool_names: ['queryKnowledge'] },
    })

    assert.equal(wrongGroup.ok, false)
    assert.match(wrongGroup.error ?? '', /event_group/)
  })

  test('inserts a normalized event row and returns the inserted id', async () => {
    const { supabase, writes } = createInsertMock({ data: { id: 'event-1' } })

    const result = await recordClientEvent(supabase, baseEvent)

    assert.deepEqual(result, { ok: true, eventId: 'event-1' })
    assert.equal(writes.length, 1)
    assert.equal(writes[0].method, 'upsert')
    assert.deepEqual(writes[0].options, { onConflict: 'dedupe_key', ignoreDuplicates: true })
    assert.deepEqual(writes[0].row, {
      client_id: 'client-1',
      client_slug: 'test-client',
      event_version: 1,
      event_type: 'setting.changed',
      event_group: 'settings',
      severity: 'notice',
      actor_type: 'owner',
      actor_user_id: null,
      source: 'api',
      source_route: '/api/dashboard/settings',
      correlation_id: 'corr-1',
      dedupe_key: 'setting.changed:client-1:corr-1',
      run_id: null,
      call_log_id: null,
      ultravox_call_id: null,
      prompt_version_id: null,
      harness_finding_id: null,
      status: 'success',
      visibility: 'owner_safe',
      summary: 'Settings changed',
      before: { contact_email: 'ow***@example.com' },
      after: { contact_email: 'ne***@example.com' },
      details: { authorization: '[REDACTED]', phone: '+1*******0123' },
    })
  })

  test('does not throw on insert failure and writes a harness finding best-effort', async () => {
    const { supabase, harnessRows } = createInsertMock({ error: { message: 'relation missing' } })

    const result = await recordClientEvent(supabase, baseEvent)

    assert.equal(result.ok, false)
    assert.match(result.error ?? '', /relation missing/)
    assert.equal(harnessRows.length, 1)
    assert.deepEqual(harnessRows[0], {
      harness_name: 'client-nervous-system',
      run_id: 'event-write-failed',
      check_name: 'observability_event_write_failed',
      client_slug: 'test-client',
      severity: 'P1',
      summary: 'Client event write failed',
      details: {
        event_type: 'setting.changed',
        source: 'api',
        source_route: '/api/dashboard/settings',
        error: 'relation missing',
      },
      status: 'open',
    })
  })
})
