export type ClientEventSeverity = 'debug' | 'info' | 'notice' | 'warning' | 'critical'
export type ClientEventStatus = 'started' | 'success' | 'warning' | 'error' | 'skipped'
export type ClientEventVisibility = 'admin_only' | 'owner_safe' | 'system_only'
export type ClientEventActorType = 'anonymous' | 'owner' | 'admin' | 'system' | 'cron' | 'webhook' | 'harness'

export {
  CLIENT_EVENT_REGISTRY,
  validateClientEventInput,
} from '@/lib/client-event-types'
import { validateClientEventInput } from '@/lib/client-event-types'

export interface ClientEventInput {
  clientId?: string | null
  clientSlug?: string | null
  eventVersion?: number
  eventType: string
  eventGroup: string
  severity?: ClientEventSeverity
  actorType: ClientEventActorType
  actorUserId?: string | null
  source: string
  sourceRoute?: string | null
  correlationId?: string | null
  dedupeKey?: string | null
  runId?: string | null
  callLogId?: string | null
  ultravoxCallId?: string | null
  promptVersionId?: string | null
  harnessFindingId?: string | null
  status: ClientEventStatus
  visibility?: ClientEventVisibility
  summary: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  details?: Record<string, unknown>
}

export interface RecordClientEventResult {
  ok: boolean
  eventId?: string
  error?: string
}

interface SupabaseLike {
  from(table: string): {
    insert?: (row: Record<string, unknown>) => unknown
    upsert?: (row: Record<string, unknown>, options?: Record<string, unknown>) => unknown
  }
}

const SENSITIVE_KEY_RE = /(?:api[_-]?key|authorization|cookie|password|payment|raw[_-]?body|request[_-]?body|secret|signature|stripe|token)/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?\d[\d\s().-]{7,}\d$/
const EMAIL_GLOBAL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const PHONE_GLOBAL_RE = /\+?\d[\d\s().-]{7,}\d/g
const MIN_PHONE_DIGITS = 10

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function maskEmail(value: string): string {
  const [local, domain] = value.split('@')
  if (!local || !domain) return '[REDACTED_EMAIL]'
  const head = local.slice(0, 2)
  return `${head}${local.length > 2 ? '***' : '*'}@${domain}`
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length < MIN_PHONE_DIGITS) return value
  const prefix = value.trim().startsWith('+') ? `+${digits[0]}` : digits[0]
  return `${prefix}${'*'.repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}`
}

function redactContactText(value: string): string {
  const emailMasked = value.replace(EMAIL_GLOBAL_RE, (match) => maskEmail(match))
  return emailMasked.replace(PHONE_GLOBAL_RE, (match, offset: number, source: string) => {
    const digits = match.replace(/\D/g, '')
    const before = offset > 0 ? source[offset - 1] : ''
    const after = source[offset + match.length] ?? ''
    const embeddedInIdentifier = /[A-Za-z0-9]/.test(before) || /[A-Za-z0-9]/.test(after)
    return digits.length >= MIN_PHONE_DIGITS && !embeddedInIdentifier ? maskPhone(match) : match
  })
}

export function redactEventPayload(
  payload: Record<string, unknown> | undefined,
  _visibility: ClientEventVisibility = 'admin_only',
): Record<string, unknown> {
  void _visibility
  if (!payload) return {}

  const redactValue = (key: string, value: unknown): unknown => {
    if (SENSITIVE_KEY_RE.test(key)) return '[REDACTED]'
    if (Array.isArray(value)) return value.map((item) => redactValue(key, item))
    if (isRecord(value)) return redactObject(value)
    if (typeof value === 'string') {
      if (EMAIL_RE.test(value)) return maskEmail(value)
      if (PHONE_RE.test(value) && value.replace(/\D/g, '').length >= MIN_PHONE_DIGITS) return maskPhone(value)
      return redactContactText(value)
    }
    return value
  }

  const redactObject = (obj: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      out[key] = redactValue(key, value)
    }
    return out
  }

  return redactObject(payload)
}

function chainMaybeSingle(result: unknown): Promise<{ data?: { id?: string } | null; error?: { message?: string } | null }> {
  const selectable = result as {
    select?: (columns?: string) => {
      maybeSingle?: () => Promise<{ data?: { id?: string } | null; error?: { message?: string } | null }>
      single?: () => Promise<{ data?: { id?: string } | null; error?: { message?: string } | null }>
    }
  }
  const selected = selectable.select?.('id')
  if (selected?.maybeSingle) return selected.maybeSingle()
  if (selected?.single) return selected.single()
  return Promise.resolve({ data: null, error: null })
}

async function recordEventWriteFailure(
  supabase: SupabaseLike,
  event: ClientEventInput,
  errorMessage: string,
): Promise<void> {
  try {
    const row = {
      harness_name: 'client-nervous-system',
      run_id: 'event-write-failed',
      check_name: 'observability_event_write_failed',
      client_slug: event.clientSlug ?? '_unknown',
      severity: 'P1',
      summary: 'Client event write failed',
      details: {
        event_type: event.eventType,
        source: event.source,
        source_route: event.sourceRoute ?? null,
        error: errorMessage.slice(0, 1000),
      },
      status: 'open',
    }
    await Promise.resolve(
      supabase.from('harness_findings').upsert?.(row, {
        onConflict: 'harness_name,check_name,client_slug',
      }),
    )
  } catch {
    // Never let observability failure handling break primary paths.
  }
}

export async function recordClientEvent(
  supabase: SupabaseLike,
  event: ClientEventInput,
): Promise<RecordClientEventResult> {
  const validation = validateClientEventInput(event)
  if (!validation.ok) return { ok: false, error: validation.error }

  const visibility = event.visibility ?? 'admin_only'
  const row = {
    client_id: event.clientId ?? null,
    client_slug: event.clientSlug ?? null,
    event_version: event.eventVersion ?? 1,
    event_type: event.eventType,
    event_group: event.eventGroup,
    severity: event.severity ?? 'info',
    actor_type: event.actorType,
    actor_user_id: event.actorUserId ?? null,
    source: event.source,
    source_route: event.sourceRoute ?? null,
    correlation_id: event.correlationId ?? null,
    dedupe_key: event.dedupeKey ?? null,
    run_id: event.runId ?? null,
    call_log_id: event.callLogId ?? null,
    ultravox_call_id: event.ultravoxCallId ?? null,
    prompt_version_id: event.promptVersionId ?? null,
    harness_finding_id: event.harnessFindingId ?? null,
    status: event.status,
    visibility,
    summary: redactContactText(event.summary),
    before: redactEventPayload(event.before, visibility),
    after: redactEventPayload(event.after, visibility),
    details: redactEventPayload(event.details, visibility),
  }

  try {
    const table = supabase.from('client_events')
    const write = event.dedupeKey && table.upsert
      ? table.upsert(row, { onConflict: 'dedupe_key', ignoreDuplicates: true })
      : table.insert?.(row)
    if (!write) throw new Error('Supabase write is unavailable for client_events')
    const { data, error } = await chainMaybeSingle(write)
    if (error) {
      const message = error.message ?? 'client_events insert failed'
      await recordEventWriteFailure(supabase, event, message)
      return { ok: false, error: message }
    }
    return { ok: true, eventId: data?.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await recordEventWriteFailure(supabase, event, message)
    return { ok: false, error: message }
  }
}
