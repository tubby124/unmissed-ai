import crypto from 'crypto'
import { stripPromptMarkers } from '@/lib/prompt-sections'
import { getNicheVoice } from '@/lib/niche-config'
import { getPlanEntitlements } from '@/lib/plan-entitlements'
import { APP_URL } from '@/lib/app-url'
import { BRAND_NAME } from '@/lib/brand'

const ULTRAVOX_BASE = 'https://api.ultravox.ai/api'

function ultravoxHeaders() {
  return {
    'X-API-Key': process.env.ULTRAVOX_API_KEY!,
    'Content-Type': 'application/json',
  }
}

// ── HMAC webhook signing (S13b — nonce + timestamp, replay-protected) ────────

/**
 * Max age (ms) for a signed callback URL before it's considered expired.
 * Budget: 10 min max call + up to 20 min of Ultravox retry backoff if our route was briefly down.
 * Nonce makes each sig unique, so the window is hygiene not security-critical.
 */
const CALLBACK_SIG_MAX_AGE_MS = 30 * 60 * 1000

/**
 * Sign a callbackUrl with HMAC-SHA256 including a per-call nonce and timestamp.
 * Signature covers `slug:nonce:timestamp` — unique per call, replay-protected.
 * S13b-T1a: replaces old slug-only HMAC.
 */
export function signCallbackUrl(baseUrl: string, slug: string): string {
  const secret = process.env.WEBHOOK_SIGNING_SECRET
  if (!secret) return baseUrl // dev: no secret → no sig
  const nonce = crypto.randomBytes(8).toString('hex') // 8 bytes = 16 hex chars (keep URL under 200)
  const ts = Date.now().toString()
  const sig = crypto.createHmac('sha256', secret).update(`${slug}:${nonce}:${ts}`).digest('hex')
  const sep = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${sep}sig=${sig}&n=${nonce}&t=${ts}`
}

/**
 * Verify HMAC sig on an inbound /completed request.
 * Supports two formats:
 *   - New (S13b): sig + nonce + ts → verifies `slug:nonce:ts`, checks 15-min replay window
 *   - Legacy: sig only (no nonce/ts) → verifies `HMAC(secret, slug)` for in-flight calls during deploy
 * Returns { valid, legacy } so callers can log the format used.
 */
export function verifyCallbackSig(
  slug: string,
  sig: string,
  nonce?: string | null,
  ts?: string | null,
): { valid: boolean; legacy: boolean } {
  const secret = process.env.WEBHOOK_SIGNING_SECRET
  if (!secret) return { valid: true, legacy: false } // dev: no secret → skip

  // New format: nonce + timestamp present
  if (nonce && ts) {
    // Replay window check
    const tsNum = parseInt(ts, 10)
    if (isNaN(tsNum) || Math.abs(Date.now() - tsNum) > CALLBACK_SIG_MAX_AGE_MS) {
      return { valid: false, legacy: false }
    }
    const expected = crypto.createHmac('sha256', secret).update(`${slug}:${nonce}:${ts}`).digest('hex')
    try {
      return { valid: crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)), legacy: false }
    } catch {
      return { valid: false, legacy: false }
    }
  }

  // Legacy format: slug-only HMAC (in-flight calls signed before S13b deploy)
  const expected = crypto.createHmac('sha256', secret).update(slug).digest('hex')
  try {
    return { valid: crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)), legacy: true }
  } catch {
    return { valid: false, legacy: true }
  }
}

// ── Shared defaults ──────────────────────────────────────────────────────────

/** B3: Automatic parameter that injects current call state into every tool request header. */
const CALL_STATE_PARAM = {
  name: 'X-Call-State',
  location: 'PARAMETER_LOCATION_HEADER',
  knownValue: 'KNOWN_PARAM_CALL_STATE',
}

const DEFAULT_VOICE = 'aa601962-1cbd-4bbd-9d96-3c7a93c3414a'
const VOICE_MALE    = 'b0e6b5c1-3100-44d5-8578-9015aa3023ae'

/**
 * Resolve the Ultravox voice ID from intake data fields.
 * Priority: specific voiceId picker → gender fallback → niche default.
 * Used in all agent creation paths (generate-prompt, create-public-checkout, test-activate).
 */
export function resolveVoiceId(
  directVoiceId: string | null | undefined,
  voiceGender: string | null | undefined,
  niche: string | null | undefined,
): string {
  if (directVoiceId?.trim()) return directVoiceId.trim()
  if (voiceGender === 'male') return VOICE_MALE
  if (voiceGender === 'female') return DEFAULT_VOICE
  return getNicheVoice(niche)
}

const DEFAULT_VAD = {
  turnEndpointDelay: '0.64s',
  minimumTurnDuration: '0.1s',
  minimumInterruptionDuration: '0.3s',
  frameActivationThreshold: 0.2,
}

const DEFAULT_INACTIVITY = [
  { duration: '30s', message: "Hello? You still there?" },
  { duration: '15s', message: "I'll let you go — feel free to call back anytime. Bye!", endBehavior: 'END_BEHAVIOR_HANG_UP_SOFT' },
]

// Built-in hangUp tool — strict: true ends call regardless of user speech (no greeting loop).
const HANGUP_TOOL = {
  toolName: 'hangUp',
  parameterOverrides: {
    strict: true,
  },
}

// ── Per-call creation (fallback when no agentId) ─────────────────────────────

interface CreateCallOptions {
  systemPrompt: string
  voice?: string | null
  metadata?: Record<string, string>
  callbackUrl?: string
  tools?: object[]
  languageHint?: string
  firstSpeakerText?: string
  /** B3: Initial call state (JSON dict) — sets workflow state for tool-to-tool tracking. */
  initialState?: Record<string, unknown>
}

export async function createCall({ systemPrompt, voice, metadata, callbackUrl, tools, languageHint, firstSpeakerText, initialState }: CreateCallOptions) {
  const body: Record<string, unknown> = {
    model: 'ultravox-v0.7',
    systemPrompt,
    voice: voice || DEFAULT_VOICE,
    maxDuration: '600s',
    medium: { twilio: {} },
    recordingEnabled: true,
    metadata: metadata || {},
    inactivityMessages: DEFAULT_INACTIVITY,
    timeExceededMessage: "I need to wrap up — feel free to call back or text this number. Bye!",
    vadSettings: DEFAULT_VAD,
  }

  if (callbackUrl) body.callbacks = { ended: { url: callbackUrl } }
  if (tools?.length) body.selectedTools = tools
  if (languageHint) body.languageHint = languageHint
  if (firstSpeakerText) body.firstSpeakerSettings = { agent: { uninterruptible: true, text: firstSpeakerText } }
  if (initialState) body.initialState = initialState

  // S9.6c: 10s timeout prevents caller hearing silence if Ultravox hangs
  const res = await fetch(`${ULTRAVOX_BASE}/calls`, {
    method: 'POST',
    headers: ultravoxHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ultravox createCall failed: ${res.status} ${err}`)
  }

  const data = await res.json()
  return { joinUrl: data.joinUrl as string, callId: data.callId as string }
}

// ── Demo call creation (browser WebRTC — no Twilio medium) ──────────────────

interface CreateDemoCallOptions {
  systemPrompt: string
  voice?: string | null
  /** When true, use Twilio medium (for phone IVR demos). Omit for browser WebRTC. */
  useTwilio?: boolean
  /** Override max call duration (default: 120s) */
  maxDuration?: string
  /** Override the message spoken when time runs out */
  timeExceededMessage?: string
  /** Additional tools beyond hangUp (e.g. calendar, SMS, transfer for Zara demos) */
  tools?: object[]
  /** Completed webhook URL — enables post-call processing for demo calls */
  callbackUrl?: string
}

export async function createDemoCall({ systemPrompt, voice, useTwilio, maxDuration, timeExceededMessage, tools, callbackUrl }: CreateDemoCallOptions) {
  const body: Record<string, unknown> = {
    model: 'ultravox-v0.7',
    systemPrompt,
    voice: voice || DEFAULT_VOICE,
    maxDuration: maxDuration || '600s',
    recordingEnabled: true,
    inactivityMessages: DEFAULT_INACTIVITY,
    timeExceededMessage: timeExceededMessage || `hey I wanna respect your time — check out ${BRAND_NAME.replace('.', ' dot ')} whenever you're ready. take care!`,
    vadSettings: DEFAULT_VAD,
    firstSpeakerSettings: { agent: { uninterruptible: true } },
    selectedTools: [HANGUP_TOOL, ...(tools || [])],
  }

  // Only add Twilio medium for phone IVR demos; omit for browser WebRTC
  if (useTwilio) body.medium = { twilio: {} }
  if (callbackUrl) body.callbacks = { ended: { url: callbackUrl } }

  const res = await fetch(`${ULTRAVOX_BASE}/calls`, {
    method: 'POST',
    headers: ultravoxHeaders(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ultravox createDemoCall failed: ${res.status} ${err}`)
  }

  const data = await res.json()
  return { joinUrl: data.joinUrl as string, callId: data.callId as string }
}

// ── Agents API ───────────────────────────────────────────────────────────────

interface UltravoxToolDefinition {
  modelToolName?: string
  description?: string
  defaultReaction?: string
  precomputable?: boolean
  timeout?: string
  dynamicParameters?: Array<{
    name: string
    location: string
    schema: { type: string; description?: string }
    required: boolean
  }>
  automaticParameters?: Array<{
    name: string
    location: string
    knownValue: string
  }>
  staticParameters?: Array<{
    name: string
    location: string
    value: string
  }>
  http?: {
    baseUrlPattern: string
    httpMethod: string
  }
}

interface UltravoxTool {
  toolName?: string
  temporaryTool?: UltravoxToolDefinition
  toolId?: string
  parameterOverrides?: Record<string, unknown>
}

function buildBookingTransitionTool(slug: string): UltravoxTool {
  const appUrl = APP_URL
  const secret = process.env.WEBHOOK_SIGNING_SECRET
  return {
    temporaryTool: {
      modelToolName: 'transitionToBookingStage',
      description: 'Activate the booking stage. Call this tool once you have CONFIRMED both: (1) the caller\'s name, and (2) their service need or appointment type. Do NOT call until both are confirmed. This switches to a focused booking mode where you will check availability and confirm the appointment.',
      timeout: '10s',
      ...(secret ? {
        staticParameters: [
          { name: 'X-Tool-Secret', location: 'PARAMETER_LOCATION_HEADER', value: secret },
        ],
      } : {}),
      http: {
        baseUrlPattern: `${appUrl}/api/stages/${slug}/booking`,
        httpMethod: 'POST',
      },
    },
  }
}

export function buildCalendarTools(slug: string): UltravoxTool[] {
  const appUrl = APP_URL
  const secret = process.env.WEBHOOK_SIGNING_SECRET
  const stageTools: UltravoxTool[] = [buildBookingTransitionTool(slug)]

  return [
    ...stageTools,
    {
      temporaryTool: {
        modelToolName: 'checkCalendarAvailability',
        precomputable: true,
        timeout: '10s',
        description: 'Check available appointment slots for a given date. Returns a slots array — each slot has a displayTime string (e.g. "9:00 AM"). Read up to 3 slots back to the caller naturally. If available=false or slots is empty, no openings exist for that day. When the caller asks for a specific time, pass it as the time parameter — the tool returns the 3 closest available slots to that time. If the exact time is not available, say "I don\'t have exactly [time] but I can do [closest slot] — does that work?" — NEVER say a time is "booked" unless the tool explicitly says so.',
        dynamicParameters: [
          {
            name: 'date',
            location: 'PARAMETER_LOCATION_QUERY',
            schema: { type: 'string', description: 'Date in YYYY-MM-DD format. Use the TODAY value from callerContext to resolve relative dates like "tomorrow" or "next Monday".' },
            required: true,
          },
          {
            name: 'time',
            location: 'PARAMETER_LOCATION_QUERY',
            schema: { type: 'string', description: 'Preferred time in 24h HH:MM format (e.g. "16:00" for 4 PM). When provided, returns 3 slots closest to this time. Omit if caller has no preference.' },
            required: false,
          },
        ],
        automaticParameters: [
          CALL_STATE_PARAM,
          { name: 'X-Call-Id', location: 'PARAMETER_LOCATION_HEADER', knownValue: 'KNOWN_PARAM_CALL_ID' },
        ],
        ...(secret ? {
          staticParameters: [
            { name: 'X-Tool-Secret', location: 'PARAMETER_LOCATION_HEADER', value: secret },
          ],
        } : {}),
        http: {
          baseUrlPattern: `${appUrl}/api/calendar/${slug}/slots`,
          httpMethod: 'GET',
        },
      },
    },
    {
      temporaryTool: {
        modelToolName: 'bookAppointment',
        defaultReaction: 'AGENT_REACTION_SPEAKS',
        timeout: '10s',
        description: 'Book an appointment for a caller. IMPORTANT: pass time exactly as the displayTime value returned by checkCalendarAvailability (e.g. "9:00 AM", "2:30 PM") — do not reformat it. Always include callerPhone from CALLER PHONE in callerContext. If response has booked=false and nextAvailable, offer that slot. If response has fallback=true, switch to message-taking mode instead.',
        dynamicParameters: [
          { name: 'date',        location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string', description: 'Date in YYYY-MM-DD format' }, required: true },
          { name: 'time',        location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string', description: 'Exact displayTime from checkCalendarAvailability e.g. "9:00 AM". Do not reformat.' }, required: true },
          { name: 'callerName',  location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string', description: "Caller's full name" }, required: true },
          { name: 'service',     location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string', description: 'Type of appointment or service' }, required: false },
          { name: 'callerPhone', location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string', description: "Caller's phone number from CALLER PHONE in callerContext" }, required: true },
        ],
        automaticParameters: [
          CALL_STATE_PARAM,
          { name: 'call_id', location: 'PARAMETER_LOCATION_BODY', knownValue: 'KNOWN_PARAM_CALL_ID' },
        ],
        ...(secret ? {
          staticParameters: [
            { name: 'X-Tool-Secret', location: 'PARAMETER_LOCATION_HEADER', value: secret },
          ],
        } : {}),
        http: {
          baseUrlPattern: `${appUrl}/api/calendar/${slug}/book`,
          httpMethod: 'POST',
        },
      },
    },
  ]
}

interface AgentConfig {
  systemPrompt: string
  voice?: string | null
  tools?: object[]
  name?: string
  /** Client slug — required when booking_enabled is true to build calendar tool URLs. */
  slug?: string
  /** When true, inject Google Calendar availability + booking tools into selectedTools. */
  booking_enabled?: boolean
  /** E.164 number for live call transfer (e.g. '+13065551234'). When set, injects transferCall HTTP tool. */
  forwarding_number?: string
  /** When true, inject sendTextMessage HTTP tool so the agent can SMS the caller mid-call. */
  sms_enabled?: boolean
  /** E.164 Twilio number — required for SMS tool injection (trial clients have sms_enabled=true but no number). */
  twilio_number?: string | null
  /** Knowledge retrieval backend: 'pgvector' = queryKnowledge, null = none. */
  knowledge_backend?: string | null
  /** Approved chunk count — when 0 or undefined, skip knowledge tool injection (S5). */
  knowledge_chunk_count?: number
  /** Text describing when the agent should transfer (used in transferCall tool description). */
  transfer_conditions?: string | null
  /** Max call duration (e.g. '180s' for trial, defaults to '600s'). */
  maxDuration?: string
  /** Plan selected by client — used for plan-based tool gating (Phase 4). */
  selectedPlan?: string | null
  /** Subscription status — 'trialing' bypasses plan gating (all features). */
  subscriptionStatus?: string | null
}

/**
 * Build transferCall HTTP tool for live call transfer via our webhook.
 * Flow: Ultravox → POST /api/webhook/{slug}/transfer → Twilio redirectCall → <Dial> with recovery.
 * NOT using Ultravox built-in coldTransfer — SIP INVITE doesn't work over Twilio's WebSocket Stream.
 */
export function buildTransferTools(slug: string, transferConditions?: string | null): UltravoxTool[] {
  const appUrl = APP_URL
  const secret = process.env.WEBHOOK_SIGNING_SECRET
  const description = transferConditions
    ? `Transfer the call to the owner ONLY when ${transferConditions}. Do not use for routine questions, general inquiries, or minor requests.`
    : 'Transfer the call to the owner ONLY when the caller explicitly asks to speak to someone directly, says "put me through", "connect me", or insists on speaking to a person. Do not use for general questions the agent can answer.'

  return [{
    temporaryTool: {
      modelToolName: 'transferCall',
      description,
      dynamicParameters: [
        {
          name: 'reason',
          location: 'PARAMETER_LOCATION_BODY',
          schema: { type: 'string', description: 'Reason for transfer' },
          required: false,
        },
      ],
      automaticParameters: [
        {
          name: 'call_id',
          location: 'PARAMETER_LOCATION_BODY',
          knownValue: 'KNOWN_PARAM_CALL_ID',
        },
        CALL_STATE_PARAM,
      ],
      ...(secret ? {
        staticParameters: [
          { name: 'X-Tool-Secret', location: 'PARAMETER_LOCATION_HEADER', value: secret },
        ],
      } : {}),
      http: {
        baseUrlPattern: `${appUrl}/api/webhook/${slug}/transfer`,
        httpMethod: 'POST',
      },
    },
  }]
}

/**
 * Build sendTextMessage HTTP tool for in-call SMS via our webhook.
 * Flow: Ultravox → POST /api/webhook/{slug}/sms → Twilio sendSms → caller receives text.
 */
export function buildSmsTools(slug: string): UltravoxTool[] {
  const appUrl = APP_URL
  const secret = process.env.WEBHOOK_SIGNING_SECRET
  return [{
    temporaryTool: {
      modelToolName: 'sendTextMessage',
      description: "Send an SMS text message to the caller during the call. Use this to send signup links, booking confirmations, or follow-up info. The caller's phone number is available from callerContext as CALLER PHONE.",
      dynamicParameters: [
        {
          name: 'to',
          location: 'PARAMETER_LOCATION_BODY',
          schema: { type: 'string', description: "Caller's phone number in E.164 format from CALLER PHONE in callerContext" },
          required: true,
        },
        {
          name: 'message',
          location: 'PARAMETER_LOCATION_BODY',
          schema: { type: 'string', description: 'SMS message body to send' },
          required: true,
        },
      ],
      automaticParameters: [
        {
          name: 'call_id',
          location: 'PARAMETER_LOCATION_BODY',
          knownValue: 'KNOWN_PARAM_CALL_ID',
        },
        CALL_STATE_PARAM,
      ],
      ...(secret ? {
        staticParameters: [
          { name: 'X-Tool-Secret', location: 'PARAMETER_LOCATION_HEADER', value: secret },
        ],
      } : {}),
      http: {
        baseUrlPattern: `${appUrl}/api/webhook/${slug}/sms`,
        httpMethod: 'POST',
      },
    },
  }]
}

/**
 * Build queryKnowledge HTTP tool for pgvector RAG retrieval.
 * Points to our Railway endpoint /api/knowledge/{slug}/query.
 * Only injected when knowledge_backend='pgvector' on the client.
 */
export function buildKnowledgeTools(slug: string): UltravoxTool[] {
  const appUrl = APP_URL
  const secret = process.env.WEBHOOK_SIGNING_SECRET
  return [{
    temporaryTool: {
      modelToolName: 'queryKnowledge',
      description: 'Search the business knowledge base for detailed information. Use this when a caller asks a specific question NOT already answered by the Key Business Facts in your context. Returns relevant text passages. If results are empty, tell the caller you will have someone follow up with that information — NEVER guess.',
      dynamicParameters: [
        {
          name: 'query',
          location: 'PARAMETER_LOCATION_BODY',
          schema: { type: 'string', description: 'The search query — rephrase the caller\'s question as a short factual query' },
          required: true,
        },
      ],
      automaticParameters: [
        CALL_STATE_PARAM,
        { name: 'call_id', location: 'PARAMETER_LOCATION_BODY', knownValue: 'KNOWN_PARAM_CALL_ID' },
      ],
      ...(secret ? {
        staticParameters: [
          { name: 'X-Tool-Secret', location: 'PARAMETER_LOCATION_HEADER', value: secret },
        ],
      } : {}),
      http: {
        baseUrlPattern: `${appUrl}/api/knowledge/${slug}/query`,
        httpMethod: 'POST',
      },
    },
  }]
}

// ── Demo tool builder (capability-driven) ────────────────────────────────────

interface DemoToolCapabilities {
  /** Call medium supports phone-based actions (SMS, transfer). True for Twilio, false for WebRTC. */
  hasPhoneMedium: boolean
  /** Caller's phone number is known. Required for SMS to work. */
  hasCallerPhone: boolean
  /** Calendar booking endpoints are available for this slug. */
  calendarEnabled: boolean
  /** A forwarding number exists for live transfer. */
  transferEnabled: boolean
}

/**
 * Build tools for demo calls based on runtime capabilities — NOT slug assumptions.
 * Callers pass capability flags from their actual runtime state (medium, phone presence, etc.).
 */
export function buildDemoTools(slug: string, caps: DemoToolCapabilities): UltravoxTool[] {
  const tools: UltravoxTool[] = []
  if (caps.calendarEnabled) tools.push(...buildCalendarTools(slug))
  if (caps.hasCallerPhone) tools.push(...buildSmsTools(slug))
  if (caps.hasPhoneMedium && caps.transferEnabled) tools.push(...buildTransferTools(slug))
  return tools
}

/** Create a persistent Ultravox agent profile for a client. Store agentId in clients.ultravox_agent_id. */
export async function createAgent({ systemPrompt, voice, tools, name, slug, booking_enabled, forwarding_number, sms_enabled, twilio_number, knowledge_backend, knowledge_chunk_count, transfer_conditions, maxDuration }: AgentConfig): Promise<string> {
  // All call config MUST be nested inside callTemplate — top-level fields are silently ignored by the API
  const callTemplate: Record<string, unknown> = {
    systemPrompt: systemPrompt + '\n\n{{callerContext}}\n\n{{businessFacts}}\n\n## INJECTED REFERENCE DATA\nThe following data is provided for this call. If it is non-empty, use it to look up information about the caller (by name, unit number, phone, or other identifier). Cross-reference naturally — if the caller mentions their name or unit, silently verify against this data before responding.\n\n{{contextData}}',
    model: 'ultravox-v0.7',
    voice: voice || DEFAULT_VOICE,
    maxDuration: maxDuration || '600s',
    medium: { twilio: {} },
    recordingEnabled: true,
    inactivityMessages: DEFAULT_INACTIVITY,
    timeExceededMessage: "I need to wrap up — feel free to call back or text this number. Bye!",
    vadSettings: DEFAULT_VAD,
    contextSchema: {
      type: 'object',
      properties: {
        callerContext:  { type: 'string' },
        businessFacts:  { type: 'string' },
        extraQa:        { type: 'string' },  // kept for backwards compat — resolves to '' at call time
        contextData:    { type: 'string' },
      },
    },
    firstSpeakerSettings: { agent: { uninterruptible: true, delay: '1s' } },
  }

  // Always include hangUp — without it the agent cannot end calls (Gotcha #55)
  callTemplate.selectedTools = buildAgentTools({
    tools: tools?.length ? tools : [HANGUP_TOOL],
    booking_enabled, slug, forwarding_number, transfer_conditions,
    sms_enabled, twilio_number, knowledge_backend, knowledge_chunk_count,
  })

  const res = await fetch(`${ULTRAVOX_BASE}/agents`, {
    method: 'POST',
    headers: ultravoxHeaders(),
    body: JSON.stringify({ name: name || `${BRAND_NAME.replace('.', '-')}-agent`, callTemplate }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ultravox createAgent failed: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.agentId as string
}

/**
 * Build the full selectedTools array from client flags.
 * Single source of truth for tool assembly — used by updateAgent(), createAgent(),
 * settings save, sync-agent, and any route that writes clients.tools.
 */
export function buildAgentTools(opts: Partial<AgentConfig>): object[] {
  // Phase 4: Plan-based tool gating — intersect DB flags with plan entitlements
  // Trial bypass: trialing clients get all features regardless of selected_plan
  const plan = getPlanEntitlements(
    opts.subscriptionStatus === 'trialing' ? 'trial' : opts.selectedPlan
  )

  const baseTools: object[] = opts.tools !== undefined ? opts.tools : [HANGUP_TOOL]
  const calendarTools: object[] = (opts.booking_enabled && plan.bookingEnabled && opts.slug) ? buildCalendarTools(opts.slug) : []
  const transferTools: object[] = (opts.forwarding_number && plan.transferEnabled && opts.slug) ? buildTransferTools(opts.slug, opts.transfer_conditions) : []
  const smsTools: object[] = (opts.sms_enabled && opts.twilio_number && plan.smsEnabled && opts.slug) ? buildSmsTools(opts.slug) : []
  // S5: only register knowledge tool when client has approved chunks (safe default = exclude)
  const hasKnowledge = opts.knowledge_backend === 'pgvector' && opts.slug
    && (opts.knowledge_chunk_count !== undefined && opts.knowledge_chunk_count > 0)
  const knowledgeTools: object[] = (hasKnowledge && plan.knowledgeEnabled) ? buildKnowledgeTools(opts.slug!) : []
  const coachingTools: object[] = (opts.slug && plan.learningLoopEnabled) ? [buildCoachingTool(opts.slug)] : []

  // Phase 4.5 GAP-I: Log plan-gated tools for observability
  if (opts.slug) {
    const gated: string[] = []
    if (opts.booking_enabled && !plan.bookingEnabled) gated.push('booking')
    if (opts.forwarding_number && !plan.transferEnabled) gated.push('transfer')
    if (opts.sms_enabled && !plan.smsEnabled) gated.push('sms')
    if (hasKnowledge && !plan.knowledgeEnabled) gated.push('knowledge')
    if (!plan.learningLoopEnabled) gated.push('coaching')
    if (gated.length > 0) {
      console.log(`[plan-gate] Tools stripped for slug=${opts.slug} plan=${opts.selectedPlan ?? 'unknown'}: ${gated.join(', ')}`)
    }
  }

  return [...baseTools, ...calendarTools, ...transferTools, ...smsTools, ...knowledgeTools, ...coachingTools]
}

/** Update an existing agent's config (call after saving a new system prompt). */
export async function updateAgent(agentId: string, updates: Partial<AgentConfig>): Promise<void> {
  // Always include the full standard defaults — Ultravox PATCH replaces the entire callTemplate
  // in the new revision, so omitting any field wipes it from the live config.
  const callTemplate: Record<string, unknown> = {
    model: 'ultravox-v0.7',
    maxDuration: '600s',
    medium: { twilio: {} },
    recordingEnabled: true,
    vadSettings: DEFAULT_VAD,
    inactivityMessages: DEFAULT_INACTIVITY,
    timeExceededMessage: "I need to wrap up — feel free to call back or text this number. Bye!",
    contextSchema: {
      type: 'object',
      properties: {
        callerContext:  { type: 'string' },
        businessFacts:  { type: 'string' },
        extraQa:        { type: 'string' },  // kept for backwards compat — resolves to '' at call time
        contextData:    { type: 'string' },
      },
    },
    firstSpeakerSettings: { agent: { uninterruptible: true, delay: '1s' } },
  }

  // Client-specific overrides
  if (updates.systemPrompt !== undefined) {
    // Strip section markers before sending to Ultravox — they are storage metadata only
    // Preserve all templateContext placeholders — appended after validation,
    // these resolve at call time via templateContext and must always be present.
    const INJECTED_DATA_BLOCK = '## INJECTED REFERENCE DATA\nThe following data is provided for this call. If it is non-empty, use it to look up information about the caller (by name, unit number, phone, or other identifier). Cross-reference naturally — if the caller mentions their name or unit, silently verify against this data before responding.\n\n{{contextData}}'
    let sp = stripPromptMarkers(updates.systemPrompt)
    // Remove legacy {{extraQa}} placeholder — QA data is folded into KnowledgeSummary
    // which goes through {{businessFacts}}. The placeholder always resolved to empty string.
    sp = sp.replace(/\n\n\{\{extraQa\}\}/g, '')
    if (!sp.includes('{{callerContext}}')) {
      // Brand new prompt — append all placeholders in order
      sp = sp + `\n\n{{callerContext}}\n\n{{businessFacts}}\n\n${INJECTED_DATA_BLOCK}`
    } else {
      // callerContext present — ensure newer placeholders are also present
      if (!sp.includes('{{businessFacts}}')) sp = sp + '\n\n{{businessFacts}}'
      if (!sp.includes('{{contextData}}'))   sp = sp + `\n\n${INJECTED_DATA_BLOCK}`
    }
    callTemplate.systemPrompt = sp
  }
  if (updates.voice !== undefined) callTemplate.voice = updates.voice || DEFAULT_VOICE
  callTemplate.selectedTools = buildAgentTools(updates)

  const res = await fetch(`${ULTRAVOX_BASE}/agents/${agentId}`, {
    method: 'PATCH',
    headers: ultravoxHeaders(),
    body: JSON.stringify({ callTemplate }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ultravox updateAgent failed: ${res.status} ${err}`)
  }
}

interface CallViaAgentOptions {
  callbackUrl?: string
  metadata?: Record<string, string>
  maxDuration?: string
  /** Call medium: 'twilio' for phone calls (default), 'webrtc' for browser-based calls (S12-TRIAL1). */
  medium?: 'twilio' | 'webrtc'
  /** Inject returning-caller context as an initial hidden tool message. */
  callerContext?: string
  /** Stable business facts (hours, staff, location notes) via {{businessFacts}} templateContext. */
  businessFacts?: string
  /** Inject per-call reference data (CSV/text) via {{contextData}} templateContext. */
  contextData?: string
  /** Override the agent's default first speaker text (used for transfer recovery). */
  firstSpeakerText?: string
  /** Hidden context messages injected before the call starts. Used for returning caller context. */
  initialMessages?: Array<{ role: string; text: string; medium: string }>
  /** Override agent's stored tools — needed to inject X-Tool-Secret at call time.
   *  NOTE: Agents API uses `toolOverrides`, NOT `selectedTools`. */
  overrideTools?: object[]
}

/** Start a call via a persistent agent (lightweight — no full payload rebuild). */
export async function callViaAgent(
  agentId: string,
  { callbackUrl, metadata, maxDuration, medium, callerContext, businessFacts, contextData, firstSpeakerText, initialMessages, overrideTools }: CallViaAgentOptions
) {
  const body: Record<string, unknown> = {
    medium: medium === 'webrtc' ? { webRtc: {} } : { twilio: {} },
    metadata: metadata || {},
    joinTimeout: '15s',
    // Always inject all templateContext keys so placeholders resolve cleanly (empty string = no output)
    templateContext: {
      callerContext:  callerContext  || '',
      businessFacts:  businessFacts  || '',
      contextData:    contextData    || '',
    },
  }

  if (callbackUrl) body.callbacks = { ended: { url: callbackUrl } }
  if (maxDuration) body.maxDuration = maxDuration
  if (firstSpeakerText) body.firstSpeakerSettings = { agent: { uninterruptible: true, text: firstSpeakerText } }
  if (initialMessages?.length) body.initialMessages = initialMessages
  // toolOverrides is { removeAll, remove, add } — NOT a raw array (causes 400 "unhashable type: dict")
  if (overrideTools?.length) body.toolOverrides = { removeAll: true, add: overrideTools }
  // NOT supported in StartAgentCallRequest (400 error): initialState, selectedTools, languageHint

  // S9.6c: 10s timeout prevents caller hearing silence if Ultravox hangs
  const res = await fetch(`${ULTRAVOX_BASE}/agents/${agentId}/calls`, {
    method: 'POST',
    headers: ultravoxHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`[callViaAgent] FAILED: agentId=${agentId} status=${res.status} toolCount=${overrideTools?.length ?? 0} err=${err.slice(0, 500)}`)
    throw new Error(`Ultravox callViaAgent failed: ${res.status} ${err}`)
  }

  const data = await res.json()
  return { joinUrl: data.joinUrl as string, callId: data.callId as string }
}

// ── Transcript + recording ───────────────────────────────────────────────────

export async function getTranscript(callId: string) {
  console.log(`[ultravox] getTranscript: fetching callId=${callId}`)
  const res = await fetch(`${ULTRAVOX_BASE}/calls/${callId}/messages?pageSize=200`, {
    headers: ultravoxHeaders(),
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '(unreadable)')
    console.error(`[ultravox] getTranscript: HTTP ${res.status} for callId=${callId} — ${body}`)
    return []
  }

  const data = await res.json()
  const messages: Array<{
    role: string
    text?: string
    medium: string
    callStageMessageIndex: number
    timespan?: { start?: string; end?: string }
  }> = data.results || []

  const filtered = messages
    .filter(m => {
      if (typeof m.text !== 'string' || !m.text.trim()) return false
      if (m.role === 'MESSAGE_ROLE_AGENT') return true
      // Exclude Ultravox platform trigger messages (e.g. "(New Call) Respond as if...") — medium is 'text', not 'voice'
      if (m.role === 'MESSAGE_ROLE_USER') return m.medium === 'MESSAGE_MEDIUM_VOICE'
      return false
    })
    .map(m => ({
      role: m.role === 'MESSAGE_ROLE_AGENT' ? 'agent' : 'user',
      text: m.text!,
      ...(m.timespan?.start != null
        ? { startTime: parseFloat(m.timespan.start) }
        : {}),
      ...(m.timespan?.end != null
        ? { endTime: parseFloat(m.timespan.end) }
        : {}),
    }))

  console.log(`[ultravox] getTranscript: callId=${callId} — ${messages.length} total, ${filtered.length} agent/user`)
  return filtered
}

export async function getRecordingStream(callId: string) {
  console.log(`[ultravox] getRecordingStream: fetching callId=${callId}`)
  const res = await fetch(`${ULTRAVOX_BASE}/calls/${callId}/recording`, {
    headers: ultravoxHeaders(),
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  })
  console.log(`[ultravox] getRecordingStream: callId=${callId} status=${res.status} ok=${res.ok}`)
  return res
}

// ── Durable Tools API (D1+D2) ───────────────────────────────────────────────

export async function createDurableTool(definition: object): Promise<{ toolId: string }> {
  const res = await fetch(`${ULTRAVOX_BASE}/tools`, {
    method: 'POST',
    headers: ultravoxHeaders(),
    body: JSON.stringify({ definition }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ultravox createDurableTool failed: ${res.status} ${err}`)
  }

  const data = await res.json()
  return { toolId: data.toolId as string }
}

export async function getDurableTool(toolId: string) {
  const res = await fetch(`${ULTRAVOX_BASE}/tools/${toolId}`, {
    headers: ultravoxHeaders(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ultravox getDurableTool failed: ${res.status} ${err}`)
  }

  return await res.json()
}

/** Delete an Ultravox agent. Call as a compensating transaction if post-agent work fails. */
export async function deleteAgent(agentId: string): Promise<void> {
  const res = await fetch(`${ULTRAVOX_BASE}/agents/${agentId}`, {
    method: 'DELETE',
    headers: ultravoxHeaders(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ultravox deleteAgent failed: ${res.status} ${err}`)
  }
}

export async function deleteDurableTool(toolId: string): Promise<void> {
  const res = await fetch(`${ULTRAVOX_BASE}/tools/${toolId}`, {
    method: 'DELETE',
    headers: ultravoxHeaders(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ultravox deleteDurableTool failed: ${res.status} ${err}`)
  }
}

export async function listDurableTools() {
  const res = await fetch(`${ULTRAVOX_BASE}/tools`, {
    headers: ultravoxHeaders(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ultravox listDurableTools failed: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.results || []
}

// ── Coaching Tool (G1) ─────────────────────────────────────────────────────

/** Build the checkForCoaching temporaryTool for live coaching during calls. */
export function buildCoachingTool(slug: string): object {
  const appUrl = APP_URL
  const secret = process.env.WEBHOOK_SIGNING_SECRET
  return {
    temporaryTool: {
      modelToolName: 'checkForCoaching',
      description:
        'Check if the manager has sent coaching guidance. Call this every 30 seconds during a live call. If coaching is available, smoothly incorporate it.',
      timeout: '10s',
      dynamicParameters: [
        {
          name: 'ultravox_call_id',
          location: 'PARAMETER_LOCATION_BODY',
          schema: { type: 'string', description: 'The current Ultravox call ID' },
          required: true,
        },
      ],
      automaticParameters: [
        CALL_STATE_PARAM,
        { name: 'call_id', location: 'PARAMETER_LOCATION_BODY', knownValue: 'KNOWN_PARAM_CALL_ID' },
      ],
      ...(secret ? {
        staticParameters: [
          { name: 'X-Tool-Secret', location: 'PARAMETER_LOCATION_HEADER', value: secret },
        ],
      } : {}),
      http: {
        baseUrlPattern: `${appUrl}/api/coaching/${slug}/check`,
        httpMethod: 'POST',
      },
    },
  }
}
