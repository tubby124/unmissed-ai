const ULTRAVOX_BASE = 'https://api.ultravox.ai/api'

function ultravoxHeaders() {
  return {
    'X-API-Key': process.env.ULTRAVOX_API_KEY!,
    'Content-Type': 'application/json',
  }
}

interface CreateCallOptions {
  systemPrompt: string
  voice?: string
  metadata?: Record<string, string>
  callbackUrl?: string
}

export async function createCall({ systemPrompt, voice, metadata, callbackUrl }: CreateCallOptions) {
  const res = await fetch(`${ULTRAVOX_BASE}/calls`, {
    method: 'POST',
    headers: ultravoxHeaders(),
    body: JSON.stringify({
      model: 'ultravox-v0.7',
      systemPrompt,
      voice: voice || 'aa601962-1cbd-4bbd-9d96-3c7a93c3414a',
      maxDuration: '600s',
      medium: { twilio: {} },
      recordingEnabled: true,
      metadata: metadata || {},
      ...(callbackUrl ? { callbacks: { ended: { url: callbackUrl } } } : {}),
      inactivityMessages: [
        { duration: '8s', message: "Hello? You still there?" },
        { duration: '15s', message: "I'll let you go — feel free to call back anytime. Bye!" },
      ],
      timeExceededMessage: "I need to wrap up — feel free to call back or text this number. Bye!",
      vadSettings: {
        turnEndpointDelay: '0.64s',
        minimumTurnDuration: '0.1s',
        minimumInterruptionDuration: '0.2s',
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Ultravox createCall failed: ${res.status} ${err}`)
  }

  const data = await res.json()
  return { joinUrl: data.joinUrl as string, callId: data.callId as string }
}

export async function getTranscript(callId: string) {
  const res = await fetch(`${ULTRAVOX_BASE}/calls/${callId}/messages?pageSize=200`, {
    headers: ultravoxHeaders(),
  })

  if (!res.ok) return []

  const data = await res.json()
  const messages: Array<{ role: string; text: string; medium: string; callStageMessageIndex: number }> =
    data.results || []

  return messages
    .filter(m =>
      (m.role === 'MESSAGE_ROLE_AGENT' || m.role === 'MESSAGE_ROLE_USER') &&
      typeof m.text === 'string' && m.text.trim()
    )
    .map(m => ({
      role: m.role === 'MESSAGE_ROLE_AGENT' ? 'agent' : 'user',
      text: m.text,
    }))
}
