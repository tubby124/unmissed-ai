import { normalizeToolNames } from '@/lib/tool-name-extractor'
import { redactEventPayload } from '@/lib/client-events'

type Row = Record<string, unknown>
type SourceName =
  | 'intake_submissions'
  | 'prompt_versions'
  | 'client_events'
  | 'call_logs'
  | 'call_transcripts'
  | 'tool_invocations'
  | 'notification_logs'
  | 'harness_findings'
  | 'client_drift_log'

type SourceState = 'ok' | 'empty' | 'error'

export interface ClientTimelineReportOptions {
  slug: string
  since?: string
}

export interface SourceStatus {
  status: SourceState
  rows: number
  error?: string
}

export interface ClientTimelineReport {
  generatedAt: string
  since: string | null
  client: Row
  sourceErrors: string[]
  sourceStatus: Record<SourceName, SourceStatus>
  intake: Row[]
  clientEvents: Row[]
  promptVersions: Row[]
  calls: Row[]
  transcripts: Row[]
  toolInvocations: Row[]
  notifications: Row[]
  harnessFindings: Row[]
  drift: Row[]
  openRisks: string[]
}

interface QueryResult {
  data: unknown
  error: { message: string } | null
}

interface QueryLike extends PromiseLike<QueryResult> {
  select(columns: string, options?: Record<string, unknown>): QueryLike
  eq(column: string, value: unknown): QueryLike
  order(column: string, options?: Record<string, unknown>): QueryLike
  limit(count: number): QueryLike
  maybeSingle(): PromiseLike<QueryResult>
}

interface SupabaseLike {
  from(table: string): unknown
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function created(row: Row): string {
  return asString(row.created_at) ||
    asString(row.submitted_at) ||
    asString(row.started_at) ||
    asString(row.checked_at) ||
    asString(row.fetched_at) ||
    asString(row.first_seen_at) ||
    ''
}

function redactText(value: string): string {
  const redacted = redactEventPayload({ value })
  return typeof redacted.value === 'string' ? redacted.value : value
}

function pick(row: Row, fields: string[]): Row {
  const out: Row = {}
  for (const field of fields) {
    if (field in row) out[field] = typeof row[field] === 'string' ? redactText(row[field] as string) : row[field]
  }
  return out
}

function statusLine(row: Row, fields: string[]): string {
  return fields
    .map((field) => row[field] === null || row[field] === undefined ? '' : `${field}=${String(row[field])}`)
    .filter(Boolean)
    .join(' ')
}

function applySince<T extends Row>(rows: T[], since?: string): T[] {
  if (!since) return rows
  const sinceMs = new Date(since).getTime()
  if (Number.isNaN(sinceMs)) throw new Error(`Invalid --since date: ${since}`)
  return rows.filter((row) => {
    const ts = created(row)
    return ts ? new Date(ts).getTime() >= sinceMs : true
  })
}

function normalizeRows(data: unknown, fields: string[]): Row[] {
  const rows = Array.isArray(data) ? data : data && typeof data === 'object' ? [data as Row] : []
  return rows.map((row) => pick(row as Row, fields))
}

async function safeQuery(
  source: SourceName,
  query: PromiseLike<QueryResult>,
  fields: string[],
): Promise<{ rows: Row[]; status: SourceStatus }> {
  try {
    const { data, error } = await query
    if (error) {
      return {
        rows: [],
        status: {
          status: 'error',
          rows: 0,
          error: `${source}: ${error.message}`,
        },
      }
    }

    const rows = normalizeRows(data, fields)
    return {
      rows,
      status: { status: rows.length ? 'ok' : 'empty', rows: rows.length },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      rows: [],
      status: {
        status: 'error',
        rows: 0,
        error: `${source}: ${message}`,
      },
    }
  }
}

function summarizeTools(tools: unknown): string[] {
  return normalizeToolNames(Array.isArray(tools) ? tools : [], {
    source: 'client-timeline-report',
    logUnknown: false,
  })
}

function buildSourceStatus(
  results: Record<SourceName, { rows: Row[]; status: SourceStatus }>,
): Record<SourceName, SourceStatus> {
  return Object.fromEntries(
    Object.entries(results).map(([source, result]) => [source, result.status]),
  ) as Record<SourceName, SourceStatus>
}

const CLIENT_FIELDS = 'id, slug, business_name, status, subscription_status, selected_plan, niche, call_handling_mode, ultravox_agent_id, active_prompt_version_id, tools, knowledge_backend, website_scrape_status, first_call_at, last_agent_sync_at, last_agent_sync_status, injected_note, injected_note_expires_at, service_areas'
const INTAKE_FIELDS = ['id', 'status', 'progress_status', 'client_slug', 'submitted_at']
const PROMPT_VERSION_FIELDS = ['id', 'version', 'is_active', 'change_description', 'char_count', 'prev_char_count', 'triggered_by_role', 'created_at']
const EVENT_FIELDS = ['id', 'event_type', 'event_group', 'severity', 'status', 'source', 'source_route', 'summary', 'created_at', 'correlation_id', 'dedupe_key', 'visibility']
const CALL_FIELDS = ['id', 'ultravox_call_id', 'call_status', 'started_at', 'ended_at', 'duration_seconds', 'end_reason', 'seconds_counted', 'lead_status']
const TRANSCRIPT_FIELDS = ['id', 'call_id', 'ultravox_call_id', 'source', 'turn_count', 'total_chars', 'fetched_at']
const TOOL_INVOCATION_FIELDS = ['id', 'call_log_id', 'tool_name', 'success', 'latency_ms', 'created_at']
const NOTIFICATION_FIELDS = ['id', 'call_id', 'channel', 'status', 'created_at']
const FINDING_FIELDS = ['id', 'harness_name', 'check_name', 'severity', 'status', 'summary', 'first_seen_at', 'last_seen_at']
const DRIFT_FIELDS = ['id', 'checked_at', 'status', 'chars_dropped', 'pct_change', 'biggest_drop_section', 'diff_summary', 'error_message']

export function getClientTimelineReportSelectedFields(): Record<string, string[]> {
  return {
    clients: CLIENT_FIELDS.split(',').map((field) => field.trim()),
    intake_submissions: INTAKE_FIELDS,
    prompt_versions: PROMPT_VERSION_FIELDS,
    client_events: EVENT_FIELDS,
    call_logs: CALL_FIELDS,
    call_transcripts: TRANSCRIPT_FIELDS,
    tool_invocations: TOOL_INVOCATION_FIELDS,
    notification_logs: NOTIFICATION_FIELDS,
    harness_findings: FINDING_FIELDS,
    client_drift_log: DRIFT_FIELDS,
  }
}

export async function buildClientTimelineReport(
  supabase: SupabaseLike,
  options: ClientTimelineReportOptions,
): Promise<ClientTimelineReport> {
  const { data: rawClient, error: clientErr } = await (supabase
    .from('clients') as QueryLike)
    .select(CLIENT_FIELDS)
    .eq('slug', options.slug)
    .maybeSingle()

  if (clientErr || !rawClient) {
    throw new Error(clientErr?.message ?? `Client not found for slug=${options.slug}`)
  }

  const client = rawClient as Row
  const clientId = client.id as string

  const resultEntries = await Promise.all([
    safeQuery('intake_submissions', (supabase.from('intake_submissions') as QueryLike).select(INTAKE_FIELDS.join(', ')).eq('client_id', clientId).order('submitted_at', { ascending: false, nullsFirst: false }).limit(20), INTAKE_FIELDS),
    safeQuery('prompt_versions', (supabase.from('prompt_versions') as QueryLike).select(PROMPT_VERSION_FIELDS.join(', ')).eq('client_id', clientId).order('version', { ascending: false }).limit(20), PROMPT_VERSION_FIELDS),
    safeQuery('client_events', (supabase.from('client_events') as QueryLike).select(EVENT_FIELDS.join(', ')).eq('client_id', clientId).order('created_at', { ascending: false }).limit(100), EVENT_FIELDS),
    safeQuery('call_logs', (supabase.from('call_logs') as QueryLike).select(CALL_FIELDS.join(', ')).eq('client_id', clientId).order('started_at', { ascending: false }).limit(30), CALL_FIELDS),
    safeQuery('call_transcripts', (supabase.from('call_transcripts') as QueryLike).select(TRANSCRIPT_FIELDS.join(', ')).eq('client_id', clientId).order('fetched_at', { ascending: false }).limit(30), TRANSCRIPT_FIELDS),
    safeQuery('tool_invocations', (supabase.from('tool_invocations') as QueryLike).select(TOOL_INVOCATION_FIELDS.join(', ')).eq('client_id', clientId).order('created_at', { ascending: false }).limit(50), TOOL_INVOCATION_FIELDS),
    safeQuery('notification_logs', (supabase.from('notification_logs') as QueryLike).select(NOTIFICATION_FIELDS.join(', ')).eq('client_id', clientId).order('created_at', { ascending: false }).limit(50), NOTIFICATION_FIELDS),
    safeQuery('harness_findings', (supabase.from('harness_findings') as QueryLike).select(FINDING_FIELDS.join(', ')).eq('client_slug', options.slug).order('last_seen_at', { ascending: false }).limit(50), FINDING_FIELDS),
    safeQuery('client_drift_log', (supabase.from('client_drift_log') as QueryLike).select(DRIFT_FIELDS.join(', ')).eq('client_id', clientId).order('checked_at', { ascending: false }).limit(10), DRIFT_FIELDS),
  ] as const)

  const results = {
    intake_submissions: resultEntries[0],
    prompt_versions: resultEntries[1],
    client_events: resultEntries[2],
    call_logs: resultEntries[3],
    call_transcripts: resultEntries[4],
    tool_invocations: resultEntries[5],
    notification_logs: resultEntries[6],
    harness_findings: resultEntries[7],
    client_drift_log: resultEntries[8],
  }

  const promptVersions = applySince(results.prompt_versions.rows, options.since)
  const events = applySince(results.client_events.rows, options.since)
  const calls = applySince(results.call_logs.rows, options.since)
  const transcripts = applySince(results.call_transcripts.rows, options.since)
  const toolInvocations = applySince(results.tool_invocations.rows, options.since)
  const notifications = applySince(results.notification_logs.rows, options.since)
  const findings = applySince(results.harness_findings.rows, options.since)
  const drift = applySince(results.client_drift_log.rows, options.since)
  const activeVersion = results.prompt_versions.rows.find((row) => row.is_active === true)
  const sourceStatus = buildSourceStatus(results)
  const sourceErrors = Object.values(sourceStatus)
    .map((status) => status.error)
    .filter((error): error is string => Boolean(error))

  const openRisks = [
    sourceStatus.client_events.status === 'error'
      ? 'client_events query failed or migration not applied; timeline may be reconstructed only from source tables.'
      : null,
    client.active_prompt_version_id && activeVersion?.id && client.active_prompt_version_id !== activeVersion.id
      ? `active_prompt_version_id (${client.active_prompt_version_id}) does not match active prompt_versions row (${activeVersion.id}).`
      : null,
    !client.active_prompt_version_id && activeVersion?.id
      ? `clients.active_prompt_version_id is null but prompt_versions has active row ${activeVersion.id}.`
      : null,
    transcripts.some((row) => row.source === 'ultravox')
      ? 'call_transcripts.source contains ultravox, which conflicts with the local migration CHECK contract.'
      : null,
    client.injected_note && !client.injected_note_expires_at
      ? 'injected_note is set without injected_note_expires_at; report cannot confirm expiry behavior.'
      : null,
  ].filter((risk): risk is string => Boolean(risk))

  return {
    generatedAt: new Date().toISOString(),
    since: options.since ?? null,
    client: {
      id: client.id,
      slug: client.slug,
      business_name: redactText(asString(client.business_name)),
      status: client.status,
      subscription_status: client.subscription_status,
      selected_plan: client.selected_plan,
      niche: client.niche,
      call_handling_mode: client.call_handling_mode,
      ultravox_agent_id: client.ultravox_agent_id ? '[present]' : null,
      active_prompt_version_id: client.active_prompt_version_id,
      runtime_tool_names: summarizeTools(client.tools),
      knowledge_backend: client.knowledge_backend,
      website_scrape_status: client.website_scrape_status,
      last_agent_sync_at: client.last_agent_sync_at,
      last_agent_sync_status: client.last_agent_sync_status,
      first_call_at: client.first_call_at,
      service_areas_count: Array.isArray(client.service_areas) ? client.service_areas.length : 0,
      injected_note_present: Boolean(client.injected_note),
      injected_note_expires_at: client.injected_note_expires_at,
    },
    sourceErrors,
    sourceStatus,
    intake: results.intake_submissions.rows,
    clientEvents: events,
    promptVersions,
    calls,
    transcripts,
    toolInvocations,
    notifications,
    harnessFindings: findings,
    drift,
    openRisks,
  }
}

export function formatClientTimelineMarkdown(report: ClientTimelineReport): string {
  const lines: string[] = []
  const activeVersion = report.promptVersions.find((row) => row.is_active === true)
  lines.push(`# Client Timeline Report: ${report.client.slug}`)
  lines.push('')
  lines.push(`Generated: ${report.generatedAt}${report.since ? ` | Since: ${report.since}` : ''}`)
  lines.push('')
  lines.push('## Client Identity and Runtime State')
  lines.push(`- ${report.client.business_name ?? report.client.slug} (${report.client.status}; ${report.client.subscription_status ?? 'unknown'}; plan=${report.client.selected_plan ?? 'unknown'})`)
  lines.push(`- niche=${report.client.niche ?? 'unknown'} mode=${report.client.call_handling_mode ?? 'unknown'} agent=${report.client.ultravox_agent_id ? 'present' : 'missing'}`)
  lines.push(`- runtime tools: ${(report.client.runtime_tool_names as string[]).join(', ') || 'none'}`)
  lines.push(`- active_prompt_version_id=${report.client.active_prompt_version_id ?? 'null'} latest_active_prompt_version=${activeVersion?.id ?? 'none'}`)
  lines.push('')
  lines.push('## Onboarding / Intake')
  for (const row of report.intake.slice(0, 5)) lines.push(`- ${created(row)} ${statusLine(row, ['status', 'progress_status', 'client_slug'])}`)
  if (report.intake.length === 0) lines.push('- No linked intake_submissions rows found.')
  lines.push('')
  lines.push('## Client Events')
  for (const row of report.clientEvents.slice(0, 20)) lines.push(`- ${row.created_at} ${row.event_type} [${row.status}/${row.severity}] ${row.summary}`)
  if (report.clientEvents.length === 0) lines.push('- No client_events rows found for this window.')
  lines.push('')
  lines.push('## Prompt / Version Timeline')
  for (const row of report.promptVersions.slice(0, 10)) lines.push(`- v${row.version} active=${row.is_active} chars=${row.char_count ?? 'n/a'} ${row.created_at ?? ''} ${row.change_description ?? ''}`)
  if (report.promptVersions.length === 0) lines.push('- No prompt_versions rows found for this window.')
  lines.push('')
  lines.push('## Recent Calls')
  for (const row of report.calls.slice(0, 15)) lines.push(`- ${row.started_at} ${row.call_status} call=${row.ultravox_call_id ?? 'n/a'} dur=${row.duration_seconds ?? 'n/a'}s counted=${row.seconds_counted ?? false}`)
  if (report.calls.length === 0) lines.push('- No call_logs rows found for this window.')
  lines.push('')
  lines.push('## Transcripts / Tools / Notifications')
  lines.push(`- transcripts: ${report.transcripts.length}`)
  lines.push(`- tool invocations: ${report.toolInvocations.length}`)
  lines.push(`- notifications: ${report.notifications.length}`)
  lines.push('')
  lines.push('## Harness Findings and Drift')
  for (const row of report.harnessFindings.slice(0, 10)) lines.push(`- ${row.last_seen_at} ${row.severity}/${row.status} ${row.harness_name}.${row.check_name}: ${row.summary}`)
  if (report.harnessFindings.length === 0) lines.push('- No harness_findings rows found for this window.')
  for (const row of report.drift.slice(0, 5)) lines.push(`- drift ${row.checked_at} status=${row.status} dropped=${row.chars_dropped ?? 'n/a'} ${row.diff_summary ?? row.error_message ?? ''}`)
  lines.push('')
  lines.push('## Open Risks / Missing Trace Points')
  for (const risk of report.openRisks) lines.push(`- ${risk}`)
  if (report.openRisks.length === 0) lines.push('- No report-level risks detected from queried rows.')
  if (report.sourceErrors.length) {
    lines.push('')
    lines.push('## Source Query Errors')
    for (const error of report.sourceErrors) lines.push(`- ${error}`)
  }

  return lines.join('\n')
}
