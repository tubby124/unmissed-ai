/**
 * Promptfoo custom HTTP provider — Ultravox.
 *
 * Wraps Ultravox's REST API (POST /api/calls + GET /api/calls/{id}/messages) so
 * promptfoo can run prompt regressions against a real Ultravox session and
 * assert on the resulting transcript. Use this when you need to exercise the
 * actual voice agent stack (model + voice + tool runtime), not just an offline
 * OpenRouter Haiku approximation like our voicemail-generic-golden.yaml uses.
 *
 * Provider contract — https://promptfoo.dev/docs/providers/custom-api:
 *   - id(): string
 *   - callApi(prompt, context, options): Promise<{ output?, error? }>
 *
 * Per-call vars (from context.vars):
 *   - voice         optional Ultravox voiceId; defaults to platform default
 *   - callerScript  optional initialMessages[] to seed caller turns
 *   - maxDuration   optional override, default '30s' so eval doesn't stall
 *
 * Env: ULTRAVOX_API_KEY (required)
 *
 * Note: this provider creates a real Ultravox call, so each eval row costs
 * Ultravox minutes. Set maxDuration short. WebRTC medium (no Twilio) keeps it
 * cheap — no PSTN leg.
 */

const ULTRAVOX_BASE = 'https://api.ultravox.ai/api'
const DEFAULT_MAX_DURATION = '30s'
const POLL_INTERVAL_MS = 2_000
const POLL_TIMEOUT_MS = 90_000

interface ProviderContextVars {
  voice?: string
  callerScript?: Array<{ role: string; text: string; medium?: string }>
  maxDuration?: string
}

interface ProviderContext {
  vars?: ProviderContextVars
}

interface ProviderResult {
  output?: string
  error?: string
}

interface UltravoxMessage {
  role: string
  text?: string
  medium?: string
}

function headers(): Record<string, string> {
  const key = process.env.ULTRAVOX_API_KEY
  if (!key) throw new Error('ULTRAVOX_API_KEY is not set — export it or source .env.local before running promptfoo eval')
  return {
    'X-API-Key': key,
    'Content-Type': 'application/json',
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function postCreateCall(body: Record<string, unknown>, retryOn5xx: boolean): Promise<{ callId: string }> {
  const res = await fetch(`${ULTRAVOX_BASE}/calls`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '(unreadable)')
    if (retryOn5xx && res.status >= 500 && res.status < 600) {
      await sleep(1_000)
      return postCreateCall(body, false)
    }
    throw new Error(`Ultravox createCall ${res.status}: ${errText.slice(0, 400)}`)
  }

  const data = (await res.json()) as { callId?: string }
  if (!data.callId) throw new Error(`Ultravox createCall returned no callId: ${JSON.stringify(data).slice(0, 400)}`)
  return { callId: data.callId }
}

async function fetchCallStatus(callId: string): Promise<{ ended: boolean }> {
  const res = await fetch(`${ULTRAVOX_BASE}/calls/${callId}`, { headers: headers() })
  if (!res.ok) return { ended: false }
  const data = (await res.json()) as { ended?: string | null }
  return { ended: Boolean(data.ended) }
}

async function fetchTranscript(callId: string): Promise<string> {
  const res = await fetch(`${ULTRAVOX_BASE}/calls/${callId}/messages?pageSize=200`, { headers: headers() })
  if (!res.ok) {
    const errText = await res.text().catch(() => '(unreadable)')
    throw new Error(`Ultravox getMessages ${res.status}: ${errText.slice(0, 400)}`)
  }
  const data = (await res.json()) as { results?: UltravoxMessage[] }
  const messages = data.results || []
  return messages
    .filter((m) => m.role === 'MESSAGE_ROLE_AGENT' && typeof m.text === 'string' && m.text.trim().length > 0)
    .map((m) => m.text!.trim())
    .join('\n')
}

async function waitForCompletion(callId: string): Promise<void> {
  const deadline = Date.now() + POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    const { ended } = await fetchCallStatus(callId)
    if (ended) return
    await sleep(POLL_INTERVAL_MS)
  }
  // Soft timeout — proceed to grab whatever transcript exists; the assertion layer
  // surfaces empty/short transcripts as failed assertions, which is the right signal.
}

class UltravoxProvider {
  id(): string {
    return 'ultravox-call'
  }

  async callApi(prompt: string, context?: ProviderContext): Promise<ProviderResult> {
    const vars = context?.vars || {}
    try {
      const body: Record<string, unknown> = {
        systemPrompt: prompt,
        model: 'ultravox-v0.7',
        voice: vars.voice ?? 'default',
        // medium: undefined → WebRTC (no Twilio), keeps eval cheap and PSTN-free
        medium: undefined,
        initialMessages: vars.callerScript ?? [],
        recordingEnabled: false,
        maxDuration: vars.maxDuration ?? DEFAULT_MAX_DURATION,
      }
      // Strip undefined keys so the JSON body stays clean
      for (const k of Object.keys(body)) {
        if (body[k] === undefined) delete body[k]
      }

      const { callId } = await postCreateCall(body, true)
      await waitForCompletion(callId)
      const transcript = await fetchTranscript(callId)
      return { output: transcript }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { error: message }
    }
  }
}

// Promptfoo loads the default export and instantiates it as the provider.
export default UltravoxProvider
