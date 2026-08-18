import { isHasanSharifRealEstateClient, isNumericSafeLoftyLeadId, REALTOR_LOFTY_REVIVAL_MODE } from './realtor-outbound-prompt'

export const LOFTY_WRITEBACK_MARKER_PREFIX = 'Unmissed Call ID:'
export const LOFTY_WRITEBACK_FAILURE_PREFIX = '[Lofty writeback retry needed]'

export type LoftyWritebackDisposition =
  | 'active_now'
  | 'future_timeline'
  | 'not_looking'
  | 'wrong_number'
  | 'do_not_call'
  | 'no_answer'
  | 'voicemail'
  | 'answered'

export type LoftyWritebackClassification = {
  status?: string | null
  summary?: string | null
  next_steps?: string | null
  serviceType?: string | null
  key_topics?: string[] | null
  confidence?: number | null
  sentiment?: string | null
  quality_score?: number | null
  caller_data?: {
    booked?: boolean | null
    appointment_time?: string | null
    callback_preference?: string | null
  } | null
}

type SupabaseLike = { from(table: string): any }

export type CompletedLoftyWritebackInput = {
  supabase: SupabaseLike
  client: { id?: string | null; slug?: string | null; niche?: string | null; business_name?: string | null }
  metadata: Record<string, string | undefined>
  campaignLeadId?: string | null
  callLogId?: string | null
  callId: string
  endedAt: string
  classification: LoftyWritebackClassification
  endReason?: string | null
  callbackPreference?: string | null
  fetchImpl?: typeof fetch
  now?: () => Date
}

export type LoftyWritebackResult =
  | { ok: true; skipped: true; reason: string }
  | { ok: true; skipped: false; loftyLeadId: string; disposition: LoftyWritebackDisposition }
  | { ok: false; retryable: true; reason: string; loftyLeadId?: string }

function clean(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function truncate(value: string | null | undefined, max = 280): string {
  const text = (value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function hasAny(text: string, tokens: string[]): boolean {
  const normalized = text.toLowerCase()
  return tokens.some(token => normalized.includes(token))
}

export function resolveLoftyWritebackDisposition(params: {
  classification: LoftyWritebackClassification
  metadata?: Record<string, string | undefined>
  endReason?: string | null
  callbackPreference?: string | null
}): LoftyWritebackDisposition {
  const { classification, metadata = {}, endReason, callbackPreference } = params
  const searchable = [
    metadata.realtor_outcome,
    metadata.outbound_result,
    metadata.disposition,
    metadata.lead_status,
    classification.serviceType,
    classification.summary,
    classification.next_steps,
    ...(classification.key_topics ?? []),
  ].filter(Boolean).join(' ')

  // DNC/wrong-number take highest precedence — they are suppression outcomes
  // the operator must never auto-call again.
  if (hasAny(searchable, ['do_not_call', 'do not call', 'dnc', 'stop calling', 'remove me'])) return 'do_not_call'
  if (hasAny(searchable, ['wrong_number', 'wrong number'])) return 'wrong_number'

  // Concrete booking/callback evidence wins over summary phrasing. The
  // opener itself says “should I close the loop?”, so that phrase must never
  // classify a booked/active lead as not-looking.
  const hasConfirmedBooking = classification.caller_data?.booked === true
    || Boolean(classification.caller_data?.appointment_time)
  if (hasConfirmedBooking) return 'active_now'

  if (hasAny(searchable, ['not_looking', 'not looking', 'no longer looking'])) return 'not_looking'
  if (hasAny(searchable, ['active_now', 'active now', 'ready now', 'looking now'])) return 'active_now'
  if (hasAny(searchable, ['future_timeline', 'future timeline', 'later this year', 'next year'])) return 'future_timeline'

  // A vague callback preference (morning/afternoon/evening) is NOT a booking.
  // It means the operator still has to schedule — classify as future timeline
  // so the lead is not inflated to active_now in the CRM.
  if (callbackPreference) return 'future_timeline'

  if (classification.status === 'MISSED' || endReason === 'unjoined') return 'no_answer'
  if (classification.status === 'VOICEMAIL') return 'voicemail'
  return 'answered'
}

export function isSuppressingLoftyDisposition(disposition: LoftyWritebackDisposition): boolean {
  return disposition === 'do_not_call' || disposition === 'wrong_number'
}

export function shouldAttemptLoftyWriteback(input: Pick<CompletedLoftyWritebackInput, 'client' | 'metadata' | 'campaignLeadId'>): boolean {
  return !!input.campaignLeadId
    && input.metadata.call_mode === REALTOR_LOFTY_REVIVAL_MODE
    && isHasanSharifRealEstateClient({ clientSlug: input.client.slug, clientNiche: input.client.niche })
}

export function buildLoftyWritebackNote(params: {
  callId: string
  attemptedAt: string
  disposition: LoftyWritebackDisposition
  summary?: string | null
  nextStep?: string | null
}): string {
  return [
    `${LOFTY_WRITEBACK_MARKER_PREFIX} ${params.callId}`,
    `Attempted: ${params.attemptedAt}`,
    `Disposition: ${params.disposition}`,
    `Summary: ${truncate(params.summary, 220) || 'No concise summary captured.'}`,
    `Next step: ${truncate(params.nextStep, 160) || 'None captured.'}`,
    `Call ID: ${params.callId}`,
  ].join('\n')
}

function appendBlock(existingNotes: string | null | undefined, block: string): string {
  const existing = (existingNotes ?? '').trim()
  return existing ? `${existing}\n\n${block}` : block
}

async function persistCampaignLeadState(supabase: SupabaseLike, leadId: string, updates: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('campaign_leads').update(updates).eq('id', leadId)
  if (error) console.error('[lofty-writeback] campaign_leads state update failed:', error.message ?? error)
}

export async function writeCompletedCallToLofty(input: CompletedLoftyWritebackInput): Promise<LoftyWritebackResult> {
  const { supabase, metadata, campaignLeadId, callId, classification, endReason, callbackPreference } = input
  if (!shouldAttemptLoftyWriteback(input)) return { ok: true, skipped: true, reason: 'not_strict_hasan_lofty_call' }
  const leadId = campaignLeadId!

  const { data: leadRow, error: leadErr } = await supabase
    .from('campaign_leads')
    .select('id, notes, external_ref, lofty_lead_id, status, scheduled_callback_at')
    .eq('id', leadId)
    .maybeSingle()
  if (leadErr || !leadRow) return { ok: false, retryable: true, reason: leadErr?.message ?? 'campaign_lead_not_found' }

  const loftyLeadId = clean(leadRow.lofty_lead_id) ?? clean(metadata.lofty_lead_id) ?? clean(leadRow.external_ref)
  if (!isNumericSafeLoftyLeadId(loftyLeadId)) return { ok: true, skipped: true, reason: 'missing_numeric_lofty_lead_id' }

  const existingNotes = typeof leadRow.notes === 'string' ? leadRow.notes : ''
  if (existingNotes.includes(`${LOFTY_WRITEBACK_MARKER_PREFIX} ${callId}`)) return { ok: true, skipped: true, reason: 'already_written' }

  const disposition = resolveLoftyWritebackDisposition({ classification, metadata, endReason, callbackPreference })
  const suppress = isSuppressingLoftyDisposition(disposition)
  if (suppress) {
    await persistCampaignLeadState(supabase, leadId, {
      status: 'dnc',
      lead_status: 'closed',
      disposition,
      last_call_log_id: input.callLogId ?? null,
      scheduled_callback_at: null,
    })
  }

  const apiKey = process.env.LOFTY_API_KEY
  const baseUrl = process.env.LOFTY_API_BASE_URL ?? 'https://api.lofty.com'
  if (!apiKey) {
    const reason = 'LOFTY_API_KEY not configured'
    await persistCampaignLeadState(supabase, leadId, {
      notes: appendBlock(existingNotes, `${LOFTY_WRITEBACK_FAILURE_PREFIX} ${new Date().toISOString()} ${reason}; call_id=${callId}; lofty_lead_id=${loftyLeadId}`),
      disposition,
      last_call_log_id: input.callLogId ?? null,
      ...(suppress ? { status: 'dnc', lead_status: 'closed', scheduled_callback_at: null } : {}),
    })
    return { ok: false, retryable: true, reason, loftyLeadId }
  }

  const fetchImpl = input.fetchImpl ?? fetch
  const note = buildLoftyWritebackNote({
    callId,
    attemptedAt: (input.now?.() ?? new Date()).toISOString(),
    disposition,
    summary: classification.summary,
    nextStep: classification.next_steps ?? classification.caller_data?.callback_preference ?? callbackPreference ?? null,
  })

  try {
    const url = `${baseUrl.replace(/\/$/, '')}/v1/leads/${loftyLeadId}`
    const readRes = await fetchImpl(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!readRes.ok) throw new Error(`Lofty read failed: ${readRes.status}`)
    const remote = await readRes.json().catch(() => ({})) as { notes?: unknown }
    const remoteNotes = typeof remote.notes === 'string' ? remote.notes : ''
    if (remoteNotes.includes(`${LOFTY_WRITEBACK_MARKER_PREFIX} ${callId}`)) {
      await persistCampaignLeadState(supabase, leadId, {
        notes: appendBlock(existingNotes, note),
        disposition,
        last_call_log_id: input.callLogId ?? null,
        ...(suppress ? { status: 'dnc', lead_status: 'closed', scheduled_callback_at: null } : {}),
      })
      return { ok: true, skipped: true, reason: 'already_written_remote' }
    }

    const writeRes = await fetchImpl(url, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ notes: appendBlock(remoteNotes, note) }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!writeRes.ok) throw new Error(`Lofty write failed: ${writeRes.status}`)

    await persistCampaignLeadState(supabase, leadId, {
      notes: appendBlock(existingNotes, note),
      disposition,
      last_call_log_id: input.callLogId ?? null,
      ...(suppress ? { status: 'dnc', lead_status: 'closed', scheduled_callback_at: null } : {}),
    })
    return { ok: true, skipped: false, loftyLeadId, disposition }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    await persistCampaignLeadState(supabase, leadId, {
      notes: appendBlock(existingNotes, `${LOFTY_WRITEBACK_FAILURE_PREFIX} ${new Date().toISOString()} ${reason}; call_id=${callId}; lofty_lead_id=${loftyLeadId}`),
      disposition,
      last_call_log_id: input.callLogId ?? null,
      ...(suppress ? { status: 'dnc', lead_status: 'closed', scheduled_callback_at: null } : {}),
    })
    return { ok: false, retryable: true, reason, loftyLeadId }
  }
}
