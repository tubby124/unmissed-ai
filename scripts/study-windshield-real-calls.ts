/**
 * Pulls the last 20 real (non-test) calls for windshield-hub, fetches each
 * Ultravox transcript, summarizes patterns, and writes findings for review.
 *
 * Output: CALLINGAGENTS/00-Inbox/windshield-real-calls-study.md
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import * as fs from 'node:fs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ULTRAVOX_API_KEY = process.env.ULTRAVOX_API_KEY!
const ULTRAVOX_BASE = 'https://api.ultravox.ai/api'

if (!SUPABASE_URL || !SERVICE_KEY || !ULTRAVOX_API_KEY) {
  console.error('missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ULTRAVOX_API_KEY')
  process.exit(1)
}

const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const SLUG = 'windshield-hub'
const OUT_PATH = 'CALLINGAGENTS/00-Inbox/windshield-real-calls-study.md'

interface UltravoxMessage {
  role?: string
  speaker?: string  // 'agent' or 'user' in some shapes
  text?: string
  content?: string  // alternate field name
  timespan?: { start?: string; end?: string }
  startedAt?: string
  endedAt?: string
  toolName?: string  // tool calls
  // Tool call fields
  invocationId?: string
}

interface UltravoxMessagesResponse {
  results?: UltravoxMessage[]
  next?: string | null
}

function anonPhone(p: string | null | undefined): string {
  if (!p) return '<unknown>'
  // keep last 4 digits only
  const digits = p.replace(/\D/g, '')
  return digits.length >= 4 ? `***${digits.slice(-4)}` : '***'
}

async function fetchTranscript(ultravoxCallId: string): Promise<UltravoxMessage[] | null> {
  try {
    const res = await fetch(`${ULTRAVOX_BASE}/calls/${ultravoxCallId}/messages`, {
      headers: { 'X-API-Key': ULTRAVOX_API_KEY },
    })
    if (!res.ok) {
      const txt = await res.text()
      console.warn(`  Ultravox ${ultravoxCallId} fetch failed: ${res.status} ${txt.slice(0, 100)}`)
      return null
    }
    const data = await res.json() as UltravoxMessagesResponse
    return data.results ?? null
  } catch (err) {
    console.warn(`  ${ultravoxCallId} fetch error: ${err}`)
    return null
  }
}

async function main() {
  console.log(`[1/3] Fetching last 20 NON-test calls for ${SLUG}...`)
  // Find the client id
  const { data: cl } = await svc.from('clients').select('id').eq('slug', SLUG).limit(1).maybeSingle()
  if (!cl) { throw new Error('client not found') }
  const clientId = (cl as any).id as string

  const { data: calls, error } = await svc
    .from('call_logs')
    .select('id, ultravox_call_id, twilio_call_sid, caller_phone, caller_name, ' +
      'started_at, ended_at, call_status, ai_summary, lead_status, sentiment, ' +
      'service_type, key_topics, billed_duration_seconds, call_state, ' +
      'recording_url, end_reason, transcript')
    .eq('client_id', clientId)
    .neq('call_status', 'test')
    .not('ultravox_call_id', 'is', null)
    .order('started_at', { ascending: false })
    .limit(20)

  if (error) throw error
  console.log(`  found ${calls?.length ?? 0} calls`)

  console.log(`[2/3] Fetching Ultravox transcripts in parallel...`)
  const enriched = await Promise.all((calls ?? []).map(async (c) => {
    const cr = c as unknown as Record<string, unknown>
    const messages = cr.ultravox_call_id ? await fetchTranscript(cr.ultravox_call_id as string) : null
    return { call: cr, messages }
  }))

  console.log(`[3/3] Writing study report...`)
  const lines: string[] = []
  lines.push(`# Windshield Hub — Last 20 Real Calls Study`)
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(`Source: production call_logs + Ultravox /calls/{id}/messages`)
  lines.push('')
  lines.push(`## Quick stats`)
  const total = enriched.length
  const withTranscripts = enriched.filter(e => e.messages && e.messages.length > 0).length
  const totalDuration = (calls ?? []).reduce((s, c) => s + ((c as any).billed_duration_seconds ?? 0), 0)
  const avgDuration = total > 0 ? Math.round(totalDuration / total) : 0
  lines.push(`- Calls fetched: ${total}`)
  lines.push(`- Transcripts retrieved: ${withTranscripts}`)
  lines.push(`- Avg billed duration: ${avgDuration}s`)
  const statuses = new Map<string, number>()
  for (const e of enriched) {
    const s = (e.call.call_status as string) || 'unknown'
    statuses.set(s, (statuses.get(s) ?? 0) + 1)
  }
  lines.push(`- Statuses: ${[...statuses.entries()].map(([k,v]) => `${k}=${v}`).join(', ')}`)
  const leadStatuses = new Map<string, number>()
  for (const e of enriched) {
    const p = (e.call.lead_status as string) || 'unset'
    leadStatuses.set(p, (leadStatuses.get(p) ?? 0) + 1)
  }
  lines.push(`- Lead statuses: ${[...leadStatuses.entries()].map(([k,v]) => `${k}=${v}`).join(', ')}`)
  const sentiments = new Map<string, number>()
  for (const e of enriched) {
    const s = (e.call.sentiment as string) || 'unset'
    sentiments.set(s, (sentiments.get(s) ?? 0) + 1)
  }
  lines.push(`- Sentiments: ${[...sentiments.entries()].map(([k,v]) => `${k}=${v}`).join(', ')}`)
  const serviceTypes = new Map<string, number>()
  for (const e of enriched) {
    const s = (e.call.service_type as string) || 'unset'
    serviceTypes.set(s, (serviceTypes.get(s) ?? 0) + 1)
  }
  lines.push(`- Service types: ${[...serviceTypes.entries()].map(([k,v]) => `${k}=${v}`).join(', ')}`)
  lines.push('')
  lines.push(`## Per-call detail`)
  lines.push('')

  for (let i = 0; i < enriched.length; i++) {
    const { call, messages } = enriched[i]
    lines.push(`---`)
    lines.push(``)
    lines.push(`### Call ${i + 1} — ${call.started_at}`)
    lines.push(``)
    lines.push(`- **Ultravox ID:** \`${call.ultravox_call_id}\``)
    lines.push(`- **Caller:** ${anonPhone(call.caller_phone as string)}`)
    lines.push(`- **Status:** ${call.call_status}  |  **Lead:** ${call.lead_status ?? '—'}  |  **Sentiment:** ${call.sentiment ?? '—'}  |  **Service:** ${call.service_type ?? '—'}  |  **Duration:** ${call.billed_duration_seconds ?? 0}s  |  **End:** ${call.end_reason ?? '—'}`)
    if (call.caller_name) lines.push(`- **Caller name:** ${call.caller_name}`)
    if (call.key_topics && Array.isArray(call.key_topics) && (call.key_topics as unknown[]).length > 0) {
      lines.push(`- **Key topics:** ${JSON.stringify(call.key_topics)}`)
    }
    lines.push(`- **AI Summary:** ${(call.ai_summary as string | null) ?? '—'}`)
    if (call.call_state) {
      const cs = call.call_state as Record<string, unknown>
      const fields = (cs.fieldsCollected as Record<string, unknown>) || {}
      const fieldsList = Object.entries(fields).map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(', ')
      lines.push(`- **Fields collected:** ${fieldsList || '(none)'}`)
      if (cs.workflowType) lines.push(`- **Workflow:** ${cs.workflowType}, step=${cs.step ?? '?'}`)
    }
    lines.push(``)
    if (!messages || messages.length === 0) {
      lines.push(`_No transcript available._`)
      lines.push(``)
      continue
    }
    lines.push(`**Transcript:**`)
    lines.push(``)
    lines.push('```')
    for (const m of messages) {
      const role = m.role || m.speaker || '?'
      const txt = (m.text || m.content || '').trim()
      if (m.toolName) {
        lines.push(`[TOOL] ${m.toolName}`)
      } else if (txt) {
        const tag = role.toLowerCase().includes('agent') || role === 'MESSAGE_ROLE_AGENT' ? 'AGENT' :
                    role.toLowerCase().includes('user') || role === 'MESSAGE_ROLE_USER' ? 'USER' :
                    role.toUpperCase()
        // Truncate very long lines
        const out = txt.length > 280 ? txt.slice(0, 280) + '...' : txt
        lines.push(`${tag}: ${out}`)
      }
    }
    lines.push('```')
    lines.push(``)
  }

  fs.writeFileSync(OUT_PATH, lines.join('\n'))
  console.log(`  wrote ${OUT_PATH} (${lines.length} lines)`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
