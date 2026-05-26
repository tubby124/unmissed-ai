import {
  buildClientTimelineReport,
  getClientTimelineReportSelectedFields,
} from '@/lib/client-timeline-report'
import { CLIENT_EVENT_REGISTRY } from '@/lib/client-event-types'
import { redactEventPayload } from '@/lib/client-events'
import type { Finding } from '@/lib/harness-writer'

type QueryResult = {
  data?: unknown
  error?: { message: string } | null
}

interface QueryLike extends PromiseLike<QueryResult> {
  select(columns: string, options?: Record<string, unknown>): QueryLike
  eq(column: string, value: unknown): QueryLike
  is(column: string, value: null | boolean): QueryLike
  order(column: string, options?: Record<string, unknown>): QueryLike
  limit(count: number): QueryLike
  maybeSingle(): Promise<QueryResult>
}

interface SupabaseLike {
  from(table: string): unknown
}

export interface EventSourceText {
  path: string
  text: string
}

export interface PerCallContextSourceText {
  path: string
  text: string
}

export type ReportSelectedFields = Record<string, string[]>

const SENSITIVE_FIELD_RE = /(?:authorization|content|password|raw[_-]?body|request[_-]?body|secret|signature|system[_-]?prompt|token|transcript(?:[_-]?text)?)/i
const SENSITIVE_ASSIGNMENT_RE = /\b(?:authorization|password|raw[_-]?body|request[_-]?body|secret|signature|token)=\S+/gi
const CLIENT_EVENT_TYPE_RE = /recordClientEvent\([\s\S]*?eventType:\s*['"`]([A-Za-z0-9_.:-]+)['"`]/g
const QUOTED_VALUE_RE = /['"`]([^'"`]+)['"`]/g
const PER_CALL_CONTEXT_REQUIRED_FIELDS = ['service_areas', 'injected_note_expires_at'] as const
const AGENT_TEST_ROUTE_RE = /(?:^|\/)src\/app\/api\/dashboard\/agent-test\/route\.ts$/
const CALL_LOGS_INSERT_LIVE_STATUS_RE = /\.from\(\s*['"`]call_logs['"`]\s*\)[\s\S]*?\.insert\(\s*\{[\s\S]*?\bcall_status\s*:\s*['"`]live['"`]/

function sanitizeText(value: string): string {
  const withoutAssignments = value.replace(SENSITIVE_ASSIGNMENT_RE, (match) => {
    const [key] = match.split('=')
    return `${key}=[REDACTED]`
  })
  const redacted = redactEventPayload({ value: withoutAssignments })
  return typeof redacted.value === 'string' ? redacted.value : withoutAssignments
}

function sourceErrorFinding(slug: string, sourceError: string): Finding {
  const [source = 'unknown'] = sourceError.split(':', 1)
  return {
    check_name: 'client_timeline_report_source_error',
    severity: 'P1',
    client_slug: slug,
    summary: `Client timeline source query failed for ${slug}: ${source}`,
    details: {
      source,
      error: sanitizeText(sourceError),
    },
  }
}

export async function checkClientEventsTableExists(supabase: SupabaseLike): Promise<Finding[]> {
  try {
    const { error } = await (supabase
      .from('client_events') as QueryLike)
      .select('id')
      .limit(1)

    if (!error) return []

    return [{
      check_name: 'client_events_table_exists',
      severity: 'P1',
      client_slug: null,
      summary: 'client_events could not be queried',
      details: { error: sanitizeText(error.message) },
    }]
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return [{
      check_name: 'client_events_table_exists',
      severity: 'P1',
      client_slug: null,
      summary: 'client_events could not be queried',
      details: { error: sanitizeText(message) },
    }]
  }
}

export async function checkClientTimelineReportSourcesAvailable(
  supabase: SupabaseLike,
  slugs: string[],
): Promise<Finding[]> {
  const findings: Finding[] = []

  for (const slug of slugs) {
    try {
      const report = await buildClientTimelineReport(supabase, { slug })
      for (const error of report.sourceErrors) {
        findings.push(sourceErrorFinding(slug, error))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      findings.push({
        check_name: 'client_timeline_report_source_error',
        severity: 'P1',
        client_slug: slug,
        summary: `Client timeline report failed for ${slug}`,
        details: { error: sanitizeText(message) },
      })
    }
  }

  return findings
}

export function findUnregisteredClientEventTypes(sources: EventSourceText[]): string[] {
  const emitted = new Set<string>()

  for (const source of sources) {
    for (const match of source.text.matchAll(CLIENT_EVENT_TYPE_RE)) {
      if (match[1]) emitted.add(match[1])
    }
  }

  return [...emitted]
    .filter((eventType) => !(eventType in CLIENT_EVENT_REGISTRY))
    .sort()
}

export function checkEventRegistryCoversEmitters(sources: EventSourceText[]): Finding[] {
  const missing = findUnregisteredClientEventTypes(sources)
  if (missing.length === 0) return []

  return [{
    check_name: 'event_registry_covers_current_emitters',
    severity: 'P1',
    client_slug: null,
    summary: `Client event registry is missing emitted event type(s): ${missing.join(', ')}`,
    details: { missing_event_types: missing },
  }]
}

export function checkReportRedactionContract(
  selectedFields: ReportSelectedFields = getClientTimelineReportSelectedFields(),
): Finding[] {
  const violations = Object.entries(selectedFields).flatMap(([table, fields]) => (
    fields
      .filter((field) => SENSITIVE_FIELD_RE.test(field))
      .map((field) => `${table}.${field}`)
  ))

  if (violations.length === 0) return []

  return [{
    check_name: 'report_redaction_contract',
    severity: 'P1',
    client_slug: null,
    summary: `Client timeline report selects sensitive selected columns: ${violations.join(', ')}`,
    details: { violations },
  }]
}

function asRows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => (
    !!row && typeof row === 'object' && !Array.isArray(row)
  )) : []
}

function asRow(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export async function checkPromptVersionPointerMatchesActiveVersion(
  supabase: SupabaseLike,
  slugs: string[],
): Promise<Finding[]> {
  const findings: Finding[] = []

  for (const slug of slugs) {
    try {
      const { data: clientData, error: clientError } = await (supabase
        .from('clients') as QueryLike)
        .select('id, slug, active_prompt_version_id')
        .eq('slug', slug)
        .limit(1)
        .maybeSingle()

      if (clientError) {
        findings.push({
          check_name: 'prompt_version_pointer_matches_active_version',
          severity: 'P1',
          client_slug: slug,
          summary: `Could not query client prompt pointer for ${slug}`,
          details: { error: sanitizeText(clientError.message) },
        })
        continue
      }

      const client = asRow(clientData)
      if (!client) continue

      const { data: versionData, error: versionError } = await (supabase
        .from('prompt_versions') as QueryLike)
        .select('id, version, is_active, created_at')
        .eq('client_id', client.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5)

      if (versionError) {
        findings.push({
          check_name: 'prompt_version_pointer_matches_active_version',
          severity: 'P1',
          client_slug: slug,
          summary: `Could not query active prompt_versions row for ${slug}`,
          details: { error: sanitizeText(versionError.message) },
        })
        continue
      }

      const activeVersions = asRows(versionData)
      const activeVersion = activeVersions[0]
      const pointer = typeof client.active_prompt_version_id === 'string'
        ? client.active_prompt_version_id
        : null
      const activeId = typeof activeVersion?.id === 'string' ? activeVersion.id : null

      if (activeVersions.length > 1) {
        findings.push({
          check_name: 'prompt_version_pointer_matches_active_version',
          severity: 'P1',
          client_slug: slug,
          summary: `${slug} has multiple active prompt_versions rows; clients.active_prompt_version_id cannot be trusted`,
          details: {
            active_prompt_version_id: pointer,
            active_version_ids: activeVersions.map((row) => row.id).filter(Boolean),
          },
        })
        continue
      }

      if (!pointer && activeId) {
        findings.push({
          check_name: 'prompt_version_pointer_matches_active_version',
          severity: 'P1',
          client_slug: slug,
          summary: `${slug} clients.active_prompt_version_id is null but prompt_versions has active row ${activeId}`,
          details: {
            active_prompt_version_id: null,
            active_prompt_versions_id: activeId,
          },
        })
      } else if (pointer && activeId && pointer !== activeId) {
        findings.push({
          check_name: 'prompt_version_pointer_matches_active_version',
          severity: 'P1',
          client_slug: slug,
          summary: `${slug} clients.active_prompt_version_id (${pointer}) does not match active prompt_versions row (${activeId})`,
          details: {
            active_prompt_version_id: pointer,
            active_prompt_versions_id: activeId,
          },
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      findings.push({
        check_name: 'prompt_version_pointer_matches_active_version',
        severity: 'P1',
        client_slug: slug,
        summary: `Prompt version pointer check failed for ${slug}`,
        details: { error: sanitizeText(message) },
      })
    }
  }

  return findings
}

export async function checkHarnessFindingsFleetNullDuplicates(
  supabase: SupabaseLike,
): Promise<Finding[]> {
  try {
    const { data, error } = await (supabase
      .from('harness_findings') as QueryLike)
      .select('id, harness_name, check_name, client_slug')
      .is('client_slug', null)

    if (error) {
      return [{
        check_name: 'harness_findings_fleet_null_duplicates',
        severity: 'P1',
        client_slug: null,
        summary: 'Could not query fleet-level harness_findings rows for duplicates',
        details: { error: sanitizeText(error.message) },
      }]
    }

    const groups = new Map<string, Array<Record<string, unknown>>>()
    for (const row of asRows(data)) {
      if (row.client_slug !== null) continue
      const harness = typeof row.harness_name === 'string' ? row.harness_name : 'unknown'
      const check = typeof row.check_name === 'string' ? row.check_name : 'unknown'
      const key = `${harness}\u0000${check}`
      groups.set(key, [...(groups.get(key) ?? []), row])
    }

    const duplicates = [...groups.entries()]
      .filter(([, rows]) => rows.length > 1)
      .map(([key, rows]) => {
        const [harness_name, check_name] = key.split('\u0000')
        return {
          harness_name,
          check_name,
          count: rows.length,
          ids: rows.map((row) => row.id).filter(Boolean),
        }
      })

    if (duplicates.length === 0) return []

    return [{
      check_name: 'harness_findings_fleet_null_duplicates',
      severity: 'P1',
      client_slug: null,
      summary: `Found duplicate fleet-level harness_findings rows for ${duplicates.length} check(s)`,
      details: { duplicates },
    }]
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return [{
      check_name: 'harness_findings_fleet_null_duplicates',
      severity: 'P1',
      client_slug: null,
      summary: 'Fleet-level harness_findings duplicate check failed',
      details: { error: sanitizeText(message) },
    }]
  }
}

function extractQuotedValues(text: string): string[] {
  return [...text.matchAll(QUOTED_VALUE_RE)].map((match) => match[1]).filter(Boolean)
}

function extractAllowedCallTranscriptSources(migrationText: string): string[] {
  const sourceCheck = migrationText.match(/source\s+in\s*\(([^)]+)\)/i)
  return sourceCheck ? extractQuotedValues(sourceCheck[1]).sort() : []
}

function extractWrittenCallTranscriptSources(helperText: string): string[] {
  const values = new Set<string>()
  for (const match of helperText.matchAll(/\bsource\s*:\s*['"`]([^'"`]+)['"`]/g)) {
    if (match[1]) values.add(match[1])
  }
  return [...values].sort()
}

export function checkCallTranscriptsSourceAllowed(input: {
  migrationText: string
  helperText: string
}): Finding[] {
  const allowedSources = extractAllowedCallTranscriptSources(input.migrationText)
  const writtenSources = extractWrittenCallTranscriptSources(input.helperText)
  const disallowed = writtenSources.filter((source) => !allowedSources.includes(source))

  if (allowedSources.length > 0 && disallowed.length === 0) return []

  return [{
    check_name: 'call_transcripts_source_allowed',
    severity: 'P1',
    client_slug: null,
    summary: `call_transcripts source writer(s) ${disallowed.join(', ') || 'unknown'} are not in migration allowlist ${allowedSources.join(', ') || 'unknown'}`,
    details: {
      allowed_sources: allowedSources,
      written_sources: writtenSources,
      disallowed_sources: disallowed,
    },
  }]
}

function extractSelectFields(sourceText: string): Set<string> {
  const fields = new Set<string>()
  for (const match of sourceText.matchAll(/\.select\(\s*['"`]([\s\S]*?)['"`]\s*\)/g)) {
    for (const field of match[1].split(',')) {
      const clean = field.trim().split(/\s+/)[0]
      if (clean) fields.add(clean)
    }
  }
  return fields
}

function extractMappedClientRowFields(sourceText: string): Set<string> {
  const fields = new Set<string>()
  const clientRowMatch = sourceText.match(/const\s+clientRow\s*:\s*ClientRow\s*=\s*\{([\s\S]*?)\n\s*\}/)
  if (!clientRowMatch) return fields

  for (const match of clientRowMatch[1].matchAll(/^\s*([A-Za-z0-9_]+)\s*:/gm)) {
    if (match[1]) fields.add(match[1])
  }
  return fields
}

export function checkPerCallContextColumnsSelectedAndMapped(
  sources: PerCallContextSourceText[],
): Finding[] {
  const gaps = sources.flatMap((source) => {
    if (!source.text.includes('buildAgentContext(')) return []

    const selectedFields = extractSelectFields(source.text)
    const mappedFields = extractMappedClientRowFields(source.text)

    return PER_CALL_CONTEXT_REQUIRED_FIELDS.flatMap((field) => {
      const issues: string[] = []
      if (!selectedFields.has(field)) issues.push('not_selected')
      if (!mappedFields.has(field)) issues.push('not_mapped')
      return issues.length > 0 ? [{ path: source.path, field, issues }] : []
    })
  })

  if (gaps.length === 0) return []

  return [{
    check_name: 'per_call_context_columns_selected_and_mapped',
    severity: 'P1',
    client_slug: null,
    summary: `Per-call context source paths are missing selected/mapped fields: ${[...new Set(gaps.map((gap) => gap.field))].join(', ')}`,
    details: {
      required_fields: [...PER_CALL_CONTEXT_REQUIRED_FIELDS],
      gaps,
    },
  }]
}

export function checkDashboardAgentTestStatusHygiene(sources: EventSourceText[]): Finding[] {
  const violations = sources
    .filter((source) => AGENT_TEST_ROUTE_RE.test(source.path))
    .filter((source) => CALL_LOGS_INSERT_LIVE_STATUS_RE.test(source.text))
    .map((source) => source.path)

  if (violations.length === 0) return []

  return [{
    check_name: 'dashboard_agent_test_status_hygiene',
    severity: 'P1',
    client_slug: null,
    summary: "dashboard agent-test route inserts call_logs with call_status='live'",
    details: {
      paths: violations,
      impact: 'Dashboard WebRTC test rows can be classified by completed webhook, notification, and billing logic as real live calls.',
      expected_statuses: ['test', 'trial_test'],
    },
  }]
}
