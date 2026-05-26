import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  checkCallTranscriptsSourceAllowed,
  checkClientEventsTableExists,
  checkClientTimelineReportSourcesAvailable,
  checkDashboardAgentTestStatusHygiene,
  checkEventRegistryCoversEmitters,
  checkHarnessFindingsFleetNullDuplicates,
  checkPerCallContextColumnsSelectedAndMapped,
  checkPromptVersionPointerMatchesActiveVersion,
  checkReportRedactionContract,
  findUnregisteredClientEventTypes,
  type PerCallContextSourceText,
  type ReportSelectedFields,
} from '../client-nervous-system-harness.js'

type QueryResult = {
  data?: unknown
  error?: { message: string } | null
}

type QueryPlanValue = QueryResult | Error
type QueryPlan = Record<string, QueryPlanValue | QueryPlanValue[]>

function createReportSupabase(plan: QueryPlan) {
  function run(table: string): Promise<QueryResult> {
    const entry = plan[table]
    const result = Array.isArray(entry) ? (entry.shift() ?? { data: [], error: null }) : entry
    if (result instanceof Error) return Promise.reject(result)
    if (!result) return Promise.resolve({ data: [], error: null })
    return Promise.resolve({ data: result.data ?? null, error: result.error ?? null })
  }

  function builder(table: string) {
    const query = {
      select() {
        return query
      },
      eq() {
        return query
      },
      is() {
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
    from(table: string) {
      return builder(table)
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
  ultravox_agent_id: 'agent-id',
  active_prompt_version_id: 'prompt-1',
  tools: [],
  knowledge_backend: 'pgvector',
  website_scrape_status: 'approved',
  first_call_at: null,
  last_agent_sync_at: null,
  last_agent_sync_status: null,
  injected_note: null,
  injected_note_expires_at: null,
  service_areas: [],
}

const alignedPromptVersion = {
  id: 'prompt-1',
  version: 2,
  is_active: true,
  created_at: '2026-05-26T00:00:00Z',
}

const baseCallPathSource: PerCallContextSourceText = {
  path: 'src/app/api/dashboard/test-call/route.ts',
  text: `
    const { data: client } = await supabase
      .from('clients')
      .select('id, slug, injected_note, service_areas')

    const clientRow: ClientRow = {
      id: client.id,
      slug: client.slug,
      injected_note: client.injected_note,
    }

    const ctx = buildAgentContext(clientRow, '+15555550100')
  `,
}

describe('Client Nervous System harness checks', () => {
  test('source availability failures return sanitized findings without throwing', async () => {
    const supabase = createReportSupabase({
      clients: { data: clientRow, error: null },
      notification_logs: { error: { message: 'permission denied for notification_logs token=secret' } },
    })

    const findings = await checkClientTimelineReportSourcesAvailable(supabase, ['hasan-sharif'])

    assert.equal(findings.length, 1)
    assert.equal(findings[0].check_name, 'client_timeline_report_source_error')
    assert.equal(findings[0].severity, 'P1')
    assert.equal(findings[0].client_slug, 'hasan-sharif')
    assert.match(findings[0].summary, /timeline source query failed/)
    assert.equal(JSON.stringify(findings).includes('secret'), false)
  })

  test('present-but-empty client_events is not treated as a failure', async () => {
    const tableCheck = await checkClientEventsTableExists(createReportSupabase({
      client_events: { data: [], error: null },
    }))
    assert.deepEqual(tableCheck, [])

    const reportCheck = await checkClientTimelineReportSourcesAvailable(createReportSupabase({
      clients: { data: clientRow, error: null },
      client_events: { data: [], error: null },
    }), ['hasan-sharif'])
    assert.deepEqual(reportCheck, [])
  })

  test('event registry coverage catches unregistered emitted event strings', () => {
    const missing = findUnregisteredClientEventTypes([
      {
        path: 'src/lib/example.ts',
        text: "void recordClientEvent(svc, { eventType: 'new.event_type', eventGroup: 'runtime' })",
      },
    ])

    assert.deepEqual(missing, ['new.event_type'])

    const findings = checkEventRegistryCoversEmitters([
      {
        path: 'src/lib/example.ts',
        text: "void recordClientEvent(svc, { eventType: 'new.event_type', eventGroup: 'runtime' })",
      },
    ])

    assert.equal(findings.length, 1)
    assert.equal(findings[0].check_name, 'event_registry_covers_current_emitters')
    assert.match(findings[0].summary, /new.event_type/)
  })

  test('report redaction guard catches sensitive selected columns', () => {
    const selectedFields: ReportSelectedFields = {
      clients: ['id', 'slug', 'system_prompt'],
      call_transcripts: ['id', 'transcript_text'],
      notification_logs: ['id', 'content'],
      client_events: ['id', 'event_type', 'raw_body'],
    }

    const findings = checkReportRedactionContract(selectedFields)

    assert.equal(findings.length, 1)
    assert.equal(findings[0].check_name, 'report_redaction_contract')
    assert.match(findings[0].summary, /sensitive selected columns/)
    assert.deepEqual((findings[0].details as Record<string, unknown>).violations, [
      'clients.system_prompt',
      'call_transcripts.transcript_text',
      'notification_logs.content',
      'client_events.raw_body',
    ])
  })

  test('current report selected columns pass the redaction contract', () => {
    assert.deepEqual(checkReportRedactionContract(), [])
  })

  test('prompt version pointer mismatch returns a P1 finding without throwing', async () => {
    const findings = await checkPromptVersionPointerMatchesActiveVersion(
      createReportSupabase({
        clients: { data: { ...clientRow, active_prompt_version_id: 'stale-prompt' }, error: null },
        prompt_versions: { data: [alignedPromptVersion], error: null },
      }),
      ['hasan-sharif'],
    )

    assert.equal(findings.length, 1)
    assert.equal(findings[0].check_name, 'prompt_version_pointer_matches_active_version')
    assert.equal(findings[0].severity, 'P1')
    assert.equal(findings[0].client_slug, 'hasan-sharif')
    assert.match(findings[0].summary, /active_prompt_version_id/)
  })

  test('prompt version pointer aligned or null with no active row does not produce a finding', async () => {
    const aligned = await checkPromptVersionPointerMatchesActiveVersion(
      createReportSupabase({
        clients: { data: clientRow, error: null },
        prompt_versions: { data: [alignedPromptVersion], error: null },
      }),
      ['hasan-sharif'],
    )
    assert.deepEqual(aligned, [])

    const noActive = await checkPromptVersionPointerMatchesActiveVersion(
      createReportSupabase({
        clients: { data: { ...clientRow, active_prompt_version_id: null }, error: null },
        prompt_versions: { data: [], error: null },
      }),
      ['hasan-sharif'],
    )
    assert.deepEqual(noActive, [])
  })

  test('harness findings fleet null duplicate detector catches duplicate account-level rows', async () => {
    const findings = await checkHarnessFindingsFleetNullDuplicates(createReportSupabase({
      harness_findings: {
        data: [
          { id: 'finding-1', harness_name: 'client-nervous-system', check_name: 'fleet_check', client_slug: null },
          { id: 'finding-2', harness_name: 'client-nervous-system', check_name: 'fleet_check', client_slug: null },
          { id: 'finding-3', harness_name: 'client-nervous-system', check_name: 'other_check', client_slug: null },
        ],
        error: null,
      },
    }))

    assert.equal(findings.length, 1)
    assert.equal(findings[0].check_name, 'harness_findings_fleet_null_duplicates')
    assert.equal(findings[0].severity, 'P1')
    assert.equal(findings[0].client_slug, null)
    assert.match(findings[0].summary, /duplicate fleet-level/)
  })

  test('call transcripts source contract catches helper and migration mismatch', () => {
    const findings = checkCallTranscriptsSourceAllowed({
      migrationText: "source text default 'completed_webhook' check (source in ('completed_webhook','backfill','manual'))",
      helperText: "const row = { source: 'ultravox' }",
    })

    assert.equal(findings.length, 1)
    assert.equal(findings[0].check_name, 'call_transcripts_source_allowed')
    assert.equal(findings[0].severity, 'P1')
    assert.match(findings[0].summary, /ultravox/)
    assert.match(findings[0].summary, /completed_webhook/)
  })

  test('current transcript helper source matches the migration allowlist', () => {
    const findings = checkCallTranscriptsSourceAllowed({
      migrationText: readFileSync('supabase/migrations/20260429010000_create_call_transcripts.sql', 'utf8'),
      helperText: readFileSync('src/lib/call-transcripts.ts', 'utf8'),
    })

    assert.deepEqual(findings, [])
  })

  test('per-call context static check reports selected and mapped field gaps', () => {
    const findings = checkPerCallContextColumnsSelectedAndMapped([baseCallPathSource])

    assert.equal(findings.length, 1)
    assert.equal(findings[0].check_name, 'per_call_context_columns_selected_and_mapped')
    assert.equal(findings[0].severity, 'P1')
    const serialized = JSON.stringify(findings[0])
    assert.match(serialized, /injected_note_expires_at/)
    assert.match(serialized, /service_areas/)
  })

  test('current per-call context paths select and map required fields', () => {
    const paths = [
      'src/app/api/webhook/[slug]/inbound/route.ts',
      'src/app/api/dashboard/agent-test/route.ts',
      'src/app/api/dashboard/test-call/route.ts',
      'src/app/api/dashboard/browser-test-call/route.ts',
      'src/app/api/trial/test-call/route.ts',
    ]
    const findings = checkPerCallContextColumnsSelectedAndMapped(paths.map((path) => ({
      path,
      text: readFileSync(path, 'utf8'),
    })))

    assert.deepEqual(findings, [])
  })

  test('dashboard agent-test status hygiene catches call_logs inserts as live', () => {
    const findings = checkDashboardAgentTestStatusHygiene([{
      path: 'src/app/api/dashboard/agent-test/route.ts',
      text: `
        await svc.from('call_logs').insert({
          ultravox_call_id: callId,
          client_id: client.id,
          call_status: 'live',
          caller_phone: 'webrtc-test',
        })
      `,
    }])

    assert.equal(findings.length, 1)
    assert.equal(findings[0].check_name, 'dashboard_agent_test_status_hygiene')
    assert.equal(findings[0].severity, 'P1')
    assert.equal(findings[0].client_slug, null)
    assert.match(findings[0].summary, /dashboard agent-test/)
    assert.match(findings[0].summary, /call_status='live'/)
  })

  test('dashboard agent-test status hygiene accepts explicit test statuses', () => {
    const safeSources = [
      `
        await svc.from('call_logs').insert({
          call_status: 'test',
          caller_phone: 'webrtc-test',
        })
      `,
      `
        await svc.from('call_logs').insert({
          call_status: 'trial_test',
          caller_phone: 'webrtc-test',
        })
      `,
    ]

    const findings = checkDashboardAgentTestStatusHygiene(safeSources.map((text) => ({
      path: 'src/app/api/dashboard/agent-test/route.ts',
      text,
    })))

    assert.deepEqual(findings, [])
  })

  test('current dashboard agent-test route passes status hygiene', () => {
    const findings = checkDashboardAgentTestStatusHygiene([{
      path: 'src/app/api/dashboard/agent-test/route.ts',
      text: readFileSync('src/app/api/dashboard/agent-test/route.ts', 'utf8'),
    }])

    assert.deepEqual(findings, [])
  })
})
