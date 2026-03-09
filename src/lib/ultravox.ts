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
  { duration: '8s',  message: "Hello? You still there?" },
  { duration: '15s', message: "I'll let you go — feel free to call back anytime. Bye!" },
]

// ── Per-call creation (fallback when no agentId) ─────────────────────────────

interface CreateCallOptions {
  systemPrompt: string
  voice?: string | null
  metadata?: Record<string, string>
  callbackUrl?: string
  tools?: object[]
}

export async function createCall({ systemPrompt, voice, metadata, callbackUrl, tools }: CreateCallOptions) {
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

  const res = await fetch(`${ULTRAVOX_BASE}/calls`, {
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

// ── Agents API ───────────────────────────────────────────────────────────────

interface AgentConfig {
  systemPrompt: string
  voice?: string | null
  tools?: object[]
  name?: string
}

/** Create a persistent Ultravox agent profile for a client. Store agentId in clients.ultravox_agent_id. */
export async function createAgent({ systemPrompt, voice, tools, name }: AgentConfig): Promise<string> {
  // All call config MUST be nested inside callTemplate — top-level fields are silently ignored by the API
  const callTemplate: Record<string, unknown> = {
    systemPrompt: systemPrompt + '\n\n{{callerContext}}',
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
        callerContext: { type: 'string' },
      },
    },
  }

  if (tools?.length) callTemplate.selectedTools = tools

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
      properties: { callerContext: { type: 'string' } },
    },
  }

  // Client-specific overrides
  if (updates.systemPrompt !== undefined) {
    // Preserve {{callerContext}} placeholder for templateContext injection per call
    callTemplate.systemPrompt = updates.systemPrompt.includes('{{callerContext}}')
      ? updates.systemPrompt
      : updates.systemPrompt + '\n\n{{callerContext}}'
  }
  if (updates.voice !== undefined) callTemplate.voice = updates.voice || DEFAULT_VOICE
  if (updates.tools !== undefined) callTemplate.selectedTools = updates.tools

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
}

/** Start a call via a persistent agent (lightweight — no full payload rebuild). */
export async function callViaAgent(
  agentId: string,
  { callbackUrl, metadata, maxDuration, callerContext }: CallViaAgentOptions
) {
  const body: Record<string, unknown> = {
    medium: { twilio: {} },
    metadata: metadata || {},
    // Always inject templateContext so {{callerContext}} placeholder in systemPrompt resolves cleanly
    templateContext: {
      callerContext: callerContext || '',
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
