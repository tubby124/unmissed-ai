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
}

export async function createCall({ systemPrompt, voice, metadata }: CreateCallOptions) {
  const res = await fetch(`${ULTRAVOX_BASE}/calls`, {
    method: 'POST',
    headers: ultravoxHeaders(),
    body: JSON.stringify({
      model: 'ultravox-v0.7',
      systemPrompt,
      voice: voice || 'aa601962-1cbd-4bbd-9d96-3c7a93c3414a',
      maxDuration: '600s',
      medium: { twilio: {} },
      metadata: metadata || {},
      inactivityMessages: [
        { duration: '8s', message: "Hello? You still there?" },
        { duration: '15s', message: "I'll let you go — feel free to call back anytime. Bye!" },
      ],
      timeExceededMessage: "I need to wrap up — feel free to call back or text this number. Bye!",
      vadSettings: {
        turnEndpointDelay: 640,
        minimumTurnDuration: 100,
        minimumInterruptionDuration: 200,
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
    .filter(m => m.role === 'MESSAGE_ROLE_AGENT' || m.role === 'MESSAGE_ROLE_USER')
    .map(m => ({
      role: m.role === 'MESSAGE_ROLE_AGENT' ? 'agent' : 'user',
      text: m.text,
    }))
}

export async function getRecordingStream(callId: string): Promise<Response> {
  const res = await fetch(`${ULTRAVOX_BASE}/calls/${callId}/recording`, {
    headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY! },
    redirect: 'follow',
  })
  return res
}
