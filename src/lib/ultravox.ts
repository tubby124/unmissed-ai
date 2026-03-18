import crypto from 'crypto'

const ULTRAVOX_BASE = 'https://api.ultravox.ai/api'

function ultravoxHeaders() {
  return {
    'X-API-Key': process.env.ULTRAVOX_API_KEY!,
    'Content-Type': 'application/json',
  }
}

// ── HMAC webhook signing ─────────────────────────────────────────────────────

/** Sign a callbackUrl with HMAC-SHA256 so /completed can reject forged pings. */
export function signCallbackUrl(baseUrl: string, callId: string): string {
  const secret = process.env.WEBHOOK_SIGNING_SECRET
  if (!secret) return baseUrl // dev: no secret → no sig
  const sig = crypto.createHmac('sha256', secret).update(callId).digest('hex')
  const sep = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${sep}sig=${sig}`
}

/** Verify HMAC sig on an inbound /completed request. */
export function verifyCallbackSig(callId: string, sig: string): boolean {
  const secret = process.env.WEBHOOK_SIGNING_SECRET
  if (!secret) return true // dev: no secret → skip
  const expected = crypto.createHmac('sha256', secret).update(callId).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  } catch {
    return false
  }
}

// ── Shared defaults ──────────────────────────────────────────────────────────

const DEFAULT_VOICE = 'aa601962-1cbd-4bbd-9d96-3c7a93c3414a'

const DEFAULT_VAD = {
  turnEndpointDelay: '0.64s',
  minimumTurnDuration: '0.1s',
  minimumInterruptionDuration: '0.2s',
}

const DEFAULT_INACTIVITY = [
  { duration: '30s', message: "Hello? You still there?" },
  { duration: '15s', message: "I'll let you go — feel free to call back anytime. Bye!", endBehavior: 'END_BEHAVIOR_HANG_UP_SOFT' },
]

// ── Per-call creation (fallback when no agentId) ─────────────────────────────

interface CreateCallOptions {
  systemPrompt: string
  voice?: string | null
  metadata?: Record<string, string>
  callbackUrl?: string
  tools?: object[]
  priorCallId?: string
}

export async function createCall({ systemPrompt, voice, metadata, callbackUrl, tools, priorCallId }: CreateCallOptions) {
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

  // priorCallId reuses conversation history from a prior call — only works with POST /api/calls (not agent calls)
  const url = priorCallId
    ? `${ULTRAVOX_BASE}/calls?priorCallId=${priorCallId}`
    : `${ULTRAVOX_BASE}/calls`

  const res = await fetch(url, {
    method: 'POST',
    headers: ultravoxHeaders(),
    body: JSON.stringify(body),
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
}

export async function createDemoCall({ systemPrompt, voice, useTwilio, maxDuration, timeExceededMessage }: CreateDemoCallOptions) {
  const body: Record<string, unknown> = {
    model: 'ultravox-v0.7',
    systemPrompt,
    voice: voice || DEFAULT_VOICE,
    maxDuration: maxDuration || '120s',
    recordingEnabled: true,
    inactivityMessages: DEFAULT_INACTIVITY,
    timeExceededMessage: timeExceededMessage || "that's the end of this demo — head to unmissed dot ai to get your own agent set up. bye!",
    vadSettings: DEFAULT_VAD,
    firstSpeakerSettings: { agent: { uninterruptible: true } },
    selectedTools: [{ toolName: 'hangUp' }],
  }

  // Only add Twilio medium for phone IVR demos; omit for browser WebRTC
  if (useTwilio) body.medium = { twilio: {} }

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
  precomputable?: boolean
  timeout?: string
  dynamicParameters?: Array<{
    name: string
    location: string
    schema: { type: string; description?: string }
    required: boolean
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

function buildCalendarTools(slug: string): UltravoxTool[] {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://unmissed-ai-production.up.railway.app'
  return [
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
        http: {
          baseUrlPattern: `${appUrl}/api/calendar/${slug}/slots`,
          httpMethod: 'GET',
        },
      },
    },
    {
      temporaryTool: {
        modelToolName: 'bookAppointment',
        timeout: '10s',
        description: 'Book an appointment for a caller. IMPORTANT: pass time exactly as the displayTime value returned by checkCalendarAvailability (e.g. "9:00 AM", "2:30 PM") — do not reformat it. Always include callerPhone from CALLER PHONE in callerContext. If response has booked=false and nextAvailable, offer that slot. If response has fallback=true, switch to message-taking mode instead.',
        dynamicParameters: [
          { name: 'date',        location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string', description: 'Date in YYYY-MM-DD format' }, required: true },
          { name: 'time',        location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string', description: 'Exact displayTime from checkCalendarAvailability e.g. "9:00 AM". Do not reformat.' }, required: true },
          { name: 'callerName',  location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string', description: "Caller's full name" }, required: true },
          { name: 'service',     location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string', description: 'Type of appointment or service' }, required: false },
          { name: 'callerPhone', location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string', description: "Caller's phone number from CALLER PHONE in callerContext" }, required: true },
        ],
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
  /** E.164 number for live call transfer (e.g. '+13065551234'). */
  forwarding_number?: string
  /** When true AND forwarding_number is set, inject coldTransfer tool into selectedTools. */
  transfer_enabled?: boolean
}

/** Build coldTransfer tool entries for native SIP transfer via Ultravox. */
export function buildTransferTools(forwardingNumber: string): UltravoxTool[] {
  return [{
    toolName: 'coldTransfer',
    parameterOverrides: {
      target: forwardingNumber,
      sipVerb: 'INVITE',  // safer for Twilio — REFER may not work
    },
  }]
}

/** Build queryCorpus tool entry if ULTRAVOX_CORPUS_ID env var is set. Returns empty array if not configured. */
export function buildCorpusTools(): UltravoxTool[] {
  const corpusId = process.env.ULTRAVOX_CORPUS_ID
  if (!corpusId) {
    console.warn('[ultravox] ULTRAVOX_CORPUS_ID not set — skipping corpus tool')
    return []
  }
  return [{
    toolName: 'queryCorpus',
    parameterOverrides: {
      corpus_id: corpusId,
      max_results: 5,
      minimum_score: 0.85,
    },
  }]
}

/** Create a persistent Ultravox agent profile for a client. Store agentId in clients.ultravox_agent_id. */
export async function createAgent({ systemPrompt, voice, tools, name, slug, booking_enabled, forwarding_number, transfer_enabled }: AgentConfig): Promise<string> {
  // All call config MUST be nested inside callTemplate — top-level fields are silently ignored by the API
  const callTemplate: Record<string, unknown> = {
    systemPrompt: systemPrompt + '\n\n{{callerContext}}\n\n{{businessFacts}}\n\n{{extraQa}}\n\n## INJECTED REFERENCE DATA\nThe following data is provided for this call. If it is non-empty, use it to look up information about the caller (by name, unit number, phone, or other identifier). Cross-reference naturally — if the caller mentions their name or unit, silently verify against this data before responding.\n\n{{contextData}}',
    model: 'ultravox-v0.7',
    voice: voice || DEFAULT_VOICE,
    maxDuration: '600s',
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
        extraQa:        { type: 'string' },
        contextData:    { type: 'string' },
      },
    },
    firstSpeakerSettings: { agent: { uninterruptible: true } },
  }

  // Always include hangUp — without it the agent cannot end calls (Gotcha #55)
  const baseTools: object[] = tools?.length ? tools : [{ toolName: 'hangUp' }]
  const calendarTools: object[] = (booking_enabled && slug) ? buildCalendarTools(slug) : []
  const transferTools: object[] = (transfer_enabled && forwarding_number) ? buildTransferTools(forwarding_number) : []
  const corpusTools: object[] = buildCorpusTools()
  callTemplate.selectedTools = [...baseTools, ...calendarTools, ...transferTools, ...corpusTools]

  const res = await fetch(`${ULTRAVOX_BASE}/agents`, {
    method: 'POST',
    headers: ultravoxHeaders(),
    body: JSON.stringify({ name: name || 'unmissed-agent', callTemplate }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ultravox createAgent failed: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.agentId as string
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
        extraQa:        { type: 'string' },
        contextData:    { type: 'string' },
      },
    },
    firstSpeakerSettings: { agent: { uninterruptible: true } },
  }

  // Client-specific overrides
  if (updates.systemPrompt !== undefined) {
    // Preserve all templateContext placeholders — appended after validation,
    // these resolve at call time via templateContext and must always be present.
    const INJECTED_DATA_BLOCK = '## INJECTED REFERENCE DATA\nThe following data is provided for this call. If it is non-empty, use it to look up information about the caller (by name, unit number, phone, or other identifier). Cross-reference naturally — if the caller mentions their name or unit, silently verify against this data before responding.\n\n{{contextData}}'
    let sp = updates.systemPrompt
    if (!sp.includes('{{callerContext}}')) {
      // Brand new prompt — append all placeholders in order
      sp = sp + `\n\n{{callerContext}}\n\n{{businessFacts}}\n\n{{extraQa}}\n\n${INJECTED_DATA_BLOCK}`
    } else {
      // callerContext present — ensure newer placeholders are also present
      if (!sp.includes('{{businessFacts}}')) sp = sp + '\n\n{{businessFacts}}'
      if (!sp.includes('{{extraQa}}'))       sp = sp + '\n\n{{extraQa}}'
      if (!sp.includes('{{contextData}}'))   sp = sp + `\n\n${INJECTED_DATA_BLOCK}`
    }
    callTemplate.systemPrompt = sp
  }
  if (updates.voice !== undefined) callTemplate.voice = updates.voice || DEFAULT_VOICE
  // Always include at least hangUp — if tools not explicitly passed, default to hangUp only
  const baseTools: object[] = updates.tools !== undefined ? updates.tools : [{ toolName: 'hangUp' }]
  const calendarTools: object[] = (updates.booking_enabled && updates.slug) ? buildCalendarTools(updates.slug) : []
  const transferTools: object[] = (updates.transfer_enabled && updates.forwarding_number) ? buildTransferTools(updates.forwarding_number) : []
  const corpusTools: object[] = buildCorpusTools()
  callTemplate.selectedTools = [...baseTools, ...calendarTools, ...transferTools, ...corpusTools]

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
  /** Inject returning-caller context as an initial hidden tool message. */
  callerContext?: string
  /** Stable business facts (hours, staff, location notes) via {{businessFacts}} templateContext. */
  businessFacts?: string
  /** Client-entered Q&A pairs via {{extraQa}} templateContext. */
  extraQa?: string
  /** Inject per-call reference data (CSV/text) via {{contextData}} templateContext. */
  contextData?: string
}

/** Start a call via a persistent agent (lightweight — no full payload rebuild). */
export async function callViaAgent(
  agentId: string,
  { callbackUrl, metadata, maxDuration, callerContext, businessFacts, extraQa, contextData }: CallViaAgentOptions
) {
  const body: Record<string, unknown> = {
    medium: { twilio: {} },
    metadata: metadata || {},
    // Always inject all templateContext keys so placeholders resolve cleanly (empty string = no output)
    templateContext: {
      callerContext:  callerContext  || '',
      businessFacts:  businessFacts  || '',
      extraQa:        extraQa        || '',
      contextData:    contextData    || '',
    },
  }

  if (callbackUrl) body.callbacks = { ended: { url: callbackUrl } }
  if (maxDuration) body.maxDuration = maxDuration

  const res = await fetch(`${ULTRAVOX_BASE}/agents/${agentId}/calls`, {
    method: 'POST',
    headers: ultravoxHeaders(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
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
  })
  console.log(`[ultravox] getRecordingStream: callId=${callId} status=${res.status} ok=${res.ok}`)
  return res
}

// ── Corpora API (A1) ────────────────────────────────────────────────────────

export async function createCorpus(name: string, description?: string): Promise<{ corpusId: string }> {
  const body: Record<string, unknown> = { name }
  if (description) body.description = description

  const res = await fetch(`${ULTRAVOX_BASE}/corpora`, {
    method: 'POST',
    headers: ultravoxHeaders(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ultravox createCorpus failed: ${res.status} ${err}`)
  }

  const data = await res.json()
  return { corpusId: data.corpusId as string }
}

export async function getCorpus(corpusId: string) {
  const res = await fetch(`${ULTRAVOX_BASE}/corpora/${corpusId}`, {
    headers: ultravoxHeaders(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ultravox getCorpus failed: ${res.status} ${err}`)
  }

  return await res.json()
}

export async function deleteCorpus(corpusId: string): Promise<void> {
  const res = await fetch(`${ULTRAVOX_BASE}/corpora/${corpusId}`, {
    method: 'DELETE',
    headers: ultravoxHeaders(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ultravox deleteCorpus failed: ${res.status} ${err}`)
  }
}

export async function getUploadUrl(corpusId: string, mimeType: string): Promise<{ uploadUrl: string; documentId: string }> {
  const res = await fetch(`${ULTRAVOX_BASE}/corpora/${corpusId}/uploads`, {
    method: 'POST',
    headers: ultravoxHeaders(),
    body: JSON.stringify({ mimeType }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ultravox getUploadUrl failed: ${res.status} ${err}`)
  }

  const data = await res.json()
  return { uploadUrl: data.uploadUrl as string, documentId: data.documentId as string }
}

interface CreateSourceOptions {
  documentIds?: string[]
  name?: string
  startUrls?: string[]
  maxDepth?: number
}

export async function createSource(corpusId: string, opts: CreateSourceOptions): Promise<{ sourceId: string }> {
  const body: Record<string, unknown> = {}
  if (opts.documentIds) body.documentIds = opts.documentIds
  if (opts.name) body.name = opts.name
  if (opts.startUrls) body.startUrls = opts.startUrls
  if (opts.maxDepth !== undefined) body.maxDepth = opts.maxDepth

  const res = await fetch(`${ULTRAVOX_BASE}/corpora/${corpusId}/sources`, {
    method: 'POST',
    headers: ultravoxHeaders(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ultravox createSource failed: ${res.status} ${err}`)
  }

  const data = await res.json()
  return { sourceId: data.sourceId as string }
}

export async function listSources(corpusId: string) {
  const res = await fetch(`${ULTRAVOX_BASE}/corpora/${corpusId}/sources`, {
    headers: ultravoxHeaders(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ultravox listSources failed: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.results || []
}

export async function deleteSource(corpusId: string, sourceId: string): Promise<void> {
  const res = await fetch(`${ULTRAVOX_BASE}/corpora/${corpusId}/sources/${sourceId}`, {
    method: 'DELETE',
    headers: ultravoxHeaders(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ultravox deleteSource failed: ${res.status} ${err}`)
  }
}

export async function queryCorpus(
  corpusId: string,
  query: string,
  maxResults?: number,
  minimumScore?: number
) {
  const body: Record<string, unknown> = { query }
  if (maxResults !== undefined) body.maxResults = maxResults
  if (minimumScore !== undefined) body.minimumScore = minimumScore

  const res = await fetch(`${ULTRAVOX_BASE}/corpora/${corpusId}/query`, {
    method: 'POST',
    headers: ultravoxHeaders(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ultravox queryCorpus failed: ${res.status} ${err}`)
  }

  return await res.json()
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://unmissed-ai-production.up.railway.app'
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
      http: {
        baseUrlPattern: `${appUrl}/api/coaching/${slug}/check`,
        httpMethod: 'POST',
      },
    },
  }
}
