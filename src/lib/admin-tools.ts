/**
 * Admin Tools — god-mode platform queries available to Zara (and any future admin-mode agent).
 *
 * Security model:
 * - Tools are injected via overrideTools ONLY by authenticated admin entry routes (e.g. /api/admin/zara).
 * - That entry route stamps `metadata.adminMode: 'true'` on the Ultravox call.
 * - Each tool endpoint (src/app/api/admin-tools/*) verifies BOTH:
 *     1. X-Tool-Secret header (env WEBHOOK_SIGNING_SECRET) — same gate as every other tool.
 *     2. call.metadata.adminMode === 'true' — fetched live from Ultravox API by callId.
 * - Public Zara (browser demo, IVR demo, call-me) never gets these tools injected.
 *
 * If you add a new admin tool, register it here AND create the matching route under
 * src/app/api/admin-tools/<tool-name>/route.ts.
 */

import { AGENT_WEBHOOK_BASE } from '@/lib/app-url'

interface ToolDef {
  modelToolName: string
  description: string
  defaultReaction?: string
  timeout?: string
  dynamicParameters?: Array<{
    name: string
    location: string
    schema: { type: string; description?: string; enum?: string[] }
    required: boolean
  }>
  automaticParameters?: Array<{ name: string; location: string; knownValue: string }>
  staticParameters?: Array<{ name: string; location: string; value: string }>
  http?: { baseUrlPattern: string; httpMethod: string }
}

interface UltravoxTool {
  toolName?: string
  temporaryTool?: ToolDef
  toolId?: string
}

const CALL_ID_PARAM = {
  name: 'call_id',
  location: 'PARAMETER_LOCATION_BODY',
  knownValue: 'KNOWN_PARAM_CALL_ID',
}

export function buildAdminTools(): UltravoxTool[] {
  const appUrl = AGENT_WEBHOOK_BASE
  const secret = process.env.WEBHOOK_SIGNING_SECRET
  const staticParams = secret
    ? [{ name: 'X-Tool-Secret', location: 'PARAMETER_LOCATION_HEADER', value: secret }]
    : undefined

  const wrap = (def: ToolDef): UltravoxTool => ({
    temporaryTool: { ...def, ...(staticParams ? { staticParameters: staticParams } : {}) },
  })

  return [
    wrap({
      modelToolName: 'adminCallsReport',
      description:
        'Get per-client call activity for a time window. Returns each active client with their call count, billed minutes, and missed-call count. Use when Hasan asks about call volume, who is busy, or how clients are performing.',
      timeout: '8s',
      dynamicParameters: [
        {
          name: 'window',
          location: 'PARAMETER_LOCATION_BODY',
          schema: {
            type: 'string',
            description: 'Time window. One of: 24h, 7d, 30d, mtd. Default 30d.',
            enum: ['24h', '7d', '30d', 'mtd'],
          },
          required: false,
        },
      ],
      automaticParameters: [CALL_ID_PARAM],
      http: { baseUrlPattern: `${appUrl}/api/admin-tools/calls-report`, httpMethod: 'POST' },
    }),
    wrap({
      modelToolName: 'adminSpendReport',
      description:
        'Get platform spend totals (Ultravox + Twilio inbound variable cost). Returns total spend for the window plus top 5 clients by cost. Use when Hasan asks about spending, costs, or who is expensive.',
      timeout: '8s',
      dynamicParameters: [
        {
          name: 'window',
          location: 'PARAMETER_LOCATION_BODY',
          schema: {
            type: 'string',
            description: 'Time window. One of: 24h, 7d, 30d, mtd, all. Default mtd.',
            enum: ['24h', '7d', '30d', 'mtd', 'all'],
          },
          required: false,
        },
      ],
      automaticParameters: [CALL_ID_PARAM],
      http: { baseUrlPattern: `${appUrl}/api/admin-tools/spend-report`, httpMethod: 'POST' },
    }),
    wrap({
      modelToolName: 'adminClientLookup',
      description:
        'Look up a single client by slug, business name, or phone number. Returns plan, subscription status, agent name, Twilio number, MTD minutes used vs limit, and last call timestamp. Use when Hasan asks about a specific client by name.',
      timeout: '6s',
      dynamicParameters: [
        {
          name: 'query',
          location: 'PARAMETER_LOCATION_BODY',
          schema: { type: 'string', description: 'Client slug, partial business name, or Twilio phone number (E.164 or last 4 digits).' },
          required: true,
        },
      ],
      automaticParameters: [CALL_ID_PARAM],
      http: { baseUrlPattern: `${appUrl}/api/admin-tools/client-lookup`, httpMethod: 'POST' },
    }),
  ]
}

/**
 * Verify the Ultravox call is admin-mode by fetching its metadata from the Ultravox API.
 * Called by every admin tool route before executing any query.
 * Returns false on missing key, network failure, missing call, or non-admin metadata.
 */
export async function verifyAdminCall(callId: string | undefined): Promise<boolean> {
  if (!callId) return false
  const apiKey = process.env.ULTRAVOX_API_KEY
  if (!apiKey) {
    console.error('[admin-tools] ULTRAVOX_API_KEY not configured — denying admin call verification')
    return false
  }
  try {
    const res = await fetch(`https://api.ultravox.ai/api/calls/${callId}`, {
      headers: { 'X-API-Key': apiKey },
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) {
      console.warn(`[admin-tools] verifyAdminCall: Ultravox returned ${res.status} for callId=${callId}`)
      return false
    }
    const call = await res.json() as { metadata?: Record<string, string> }
    return call.metadata?.adminMode === 'true'
  } catch (err) {
    console.error('[admin-tools] verifyAdminCall failed:', err instanceof Error ? err.message : err)
    return false
  }
}

/**
 * Standard X-Tool-Secret check. Returns NextResponse on failure, null on pass.
 * Mirrors the gate used in every other tool route.
 */
export function checkToolSecret(headerValue: string | null): string | null {
  const secret = process.env.WEBHOOK_SIGNING_SECRET
  if (!secret) return null  // dev — open
  if (headerValue !== secret) return 'Forbidden'
  return null
}
