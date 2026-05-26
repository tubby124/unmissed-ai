import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildClientTimelineReport,
  formatClientTimelineMarkdown,
} from '../client-timeline-report.js'

type QueryResult = {
  data?: unknown
  error?: { message: string } | null
}

type QueryPlan = Record<string, QueryResult | Error>

function createReportSupabase(plan: QueryPlan) {
  const selects: Record<string, string[]> = {}

  function run(table: string): Promise<QueryResult> {
    const result = plan[table]
    if (result instanceof Error) return Promise.reject(result)
    if (!result) return Promise.resolve({ data: [], error: null })
    return Promise.resolve({ data: result.data ?? null, error: result.error ?? null })
  }

  function builder(table: string) {
    const query = {
      select(columns: string) {
        selects[table] = [...(selects[table] ?? []), columns]
        return query
      },
      eq() {
        return query
      },
      order() {
        return query
      },
      limit() {
        return query
      },
      maybeSingle() {
        return run(table)
      },
      then(resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) {
        return Reflect.apply(Promise.prototype.then, run(table), [resolve, reject])
      },
    }
    return query
  }

  return {
    selects,
    supabase: {
      from(table: string) {
        return builder(table)
      },
    },
  }
}

const clientRow = {
  id: 'client-1',
  slug: 'hasan-sharif',
  business_name: 'Hasan Sharif',
  status: 'active',
  subscription_status: 'active',
  selected_plan: 'pro',
  niche: 'real_estate',
  call_handling_mode: 'voice',
  ultravox_agent_id: 'agent-secret-id',
  active_prompt_version_id: 'prompt-1',
  tools: [
    { toolName: 'sendTextMessage' },
    { temporaryTool: { modelToolName: 'bookAppointment' } },
  ],
  knowledge_backend: 'pgvector',
  website_scrape_status: 'approved',
  first_call_at: '2026-05-20T00:00:00Z',
  last_agent_sync_at: '2026-05-21T00:00:00Z',
  last_agent_sync_status: 'success',
  injected_note: 'Call owner at +13065550123',
  injected_note_expires_at: '2026-05-27T00:00:00Z',
  service_areas: ['Regina'],
}

describe('buildClientTimelineReport', () => {
  test('represents source query errors without crashing', async () => {
    const { supabase } = createReportSupabase({
      clients: { data: clientRow, error: null },
      call_logs: { error: { message: 'permission denied for call_logs' } },
    })

    const report = await buildClientTimelineReport(supabase, { slug: 'hasan-sharif' })

    assert.deepEqual(report.calls, [])
    assert.match(report.sourceErrors.join('\n'), /call_logs: permission denied for call_logs/)
    assert.equal(report.sourceStatus.call_logs.status, 'error')
  })

  test('distinguishes empty client_events from client_events source failure', async () => {
    const empty = createReportSupabase({
      clients: { data: clientRow, error: null },
      client_events: { data: [], error: null },
    })

    const emptyReport = await buildClientTimelineReport(empty.supabase, { slug: 'hasan-sharif' })

    assert.deepEqual(emptyReport.clientEvents, [])
    assert.equal(emptyReport.sourceStatus.client_events.status, 'empty')
    assert.equal(emptyReport.sourceErrors.some((error) => error.includes('client_events')), false)

    const failed = createReportSupabase({
      clients: { data: clientRow, error: null },
      client_events: { error: { message: 'relation "client_events" does not exist' } },
    })

    const failedReport = await buildClientTimelineReport(failed.supabase, { slug: 'hasan-sharif' })

    assert.deepEqual(failedReport.clientEvents, [])
    assert.equal(failedReport.sourceStatus.client_events.status, 'error')
    assert.match(failedReport.sourceErrors.join('\n'), /client_events/)
  })

  test('report JSON and Markdown omit raw sensitive payloads', async () => {
    const { supabase, selects } = createReportSupabase({
      clients: { data: clientRow, error: null },
      call_transcripts: {
        data: [{
          id: 'transcript-1',
          call_id: 'call-1',
          ultravox_call_id: 'uv-1',
          source: 'completed_webhook',
          turn_count: 4,
          total_chars: 800,
          fetched_at: '2026-05-22T00:00:00Z',
          transcript_text: 'Caller said secret transcript text.',
        }],
        error: null,
      },
      notification_logs: {
        data: [{
          id: 'notification-1',
          call_id: 'call-1',
          channel: 'telegram',
          status: 'sent',
          created_at: '2026-05-22T00:00:00Z',
          content: 'Owner notification with +13065550123 and owner@example.com',
        }],
        error: null,
      },
      client_events: {
        data: [{
          id: 'event-1',
          event_type: 'tool.invoked',
          event_group: 'runtime',
          severity: 'info',
          status: 'success',
          source: 'tool-invocations',
          source_route: '/api/webhook/hasan-sharif/sms',
          summary: 'Tool invoked safely',
          created_at: '2026-05-22T00:00:00Z',
          correlation_id: 'corr-1',
          dedupe_key: 'dedupe-1',
          visibility: 'admin_only',
          raw_body: '{ "token": "secret-token" }',
        }],
        error: null,
      },
    })

    const report = await buildClientTimelineReport(supabase, { slug: 'hasan-sharif' })
    const markdown = formatClientTimelineMarkdown(report)
    const serialized = JSON.stringify(report) + markdown

    assert.equal(selects.clients.some((columns) => columns.includes('system_prompt')), false)
    assert.doesNotMatch(serialized, /secret transcript text/)
    assert.doesNotMatch(serialized, /Owner notification/)
    assert.doesNotMatch(serialized, /\+13065550123/)
    assert.doesNotMatch(serialized, /owner@example\.com/)
    assert.doesNotMatch(serialized, /secret-token/)
    assert.doesNotMatch(serialized, /raw_body/)
    assert.equal(report.client.injected_note_present, true)
    assert.equal('injected_note' in report.client, false)
  })

  test('normalizes runtime tool names through normalizeToolNames', async () => {
    const { supabase } = createReportSupabase({
      clients: { data: clientRow, error: null },
    })

    const report = await buildClientTimelineReport(supabase, { slug: 'hasan-sharif' })

    assert.deepEqual(report.client.runtime_tool_names, ['bookAppointment', 'sendTextMessage'])
  })
})
