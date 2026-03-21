/**
 * One-off script: rebuild clients.tools for all 4 live clients.
 * Run: node scripts/rebuild-tools.mjs
 * Safe: only writes to clients.tools column — no Ultravox API calls.
 */
import { execSync } from 'child_process'
import { createClient } from '@supabase/supabase-js'

// Load env vars from .env.local + ~/.secrets
async function loadEnv() {
  const fs = await import('fs')
  const envFiles = ['.env.local']
  const env = {}
  for (const f of envFiles) {
    try {
      const content = fs.readFileSync(f, 'utf-8')
      for (const line of content.split('\n')) {
        const match = line.match(/^([A-Z_]+)=(.*)$/)
        if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '')
      }
    } catch {}
  }
  // Also load from ~/.secrets
  try {
    const secrets = fs.readFileSync(`${process.env.HOME}/.secrets`, 'utf-8')
    for (const line of secrets.split('\n')) {
      const match = line.match(/^export\s+([A-Z_]+)=["']?([^"'\s]+)["']?/)
      if (match) env[match[1]] = match[2]
    }
  } catch {}
  return env
}

const env = await loadEnv()
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const WEBHOOK_SECRET = env.WEBHOOK_SIGNING_SECRET || process.env.WEBHOOK_SIGNING_SECRET
const APP_URL = env.NEXT_PUBLIC_APP_URL || 'https://unmissed-ai-production.up.railway.app'

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// --- Tool builders (replicated from ultravox.ts) ---

const HANGUP_TOOL = { toolName: 'hangUp' }
const CALL_STATE_PARAM = { name: 'X-Call-State', location: 'PARAMETER_LOCATION_HEADER', knownValue: 'KNOWN_PARAM_CALL_STATE' }

function secretParam() {
  if (!WEBHOOK_SECRET) return {}
  return { staticParameters: [{ name: 'X-Tool-Secret', location: 'PARAMETER_LOCATION_HEADER', value: WEBHOOK_SECRET }] }
}

function buildCalendarTools(slug) {
  return [
    {
      temporaryTool: {
        modelToolName: 'checkCalendarAvailability',
        description: 'Check available appointment slots for a given date. Returns a slots array — each slot has a displayTime string (e.g. "9:00 AM"). Read up to 3 slots back to the caller naturally. If available=false or slots is empty, no openings exist for that day. When the caller asks for a specific time, pass it as the time parameter — the tool returns the 3 closest available slots to that time. If the exact time is not available, say "I don\'t have exactly [time] but I can do [closest slot] — does that work?" — NEVER say a time is "booked" unless the tool explicitly says so.',
        precomputable: true,
        dynamicParameters: [
          { name: 'date', location: 'PARAMETER_LOCATION_QUERY', schema: { type: 'string', description: 'Date in YYYY-MM-DD format. Use the TODAY value from callerContext to resolve relative dates like "tomorrow" or "next Monday".' }, required: true },
          { name: 'time', location: 'PARAMETER_LOCATION_QUERY', schema: { type: 'string', description: 'Preferred time in 24h HH:MM format (e.g. "16:00" for 4 PM). When provided, returns 3 slots closest to this time. Omit if caller has no preference.' }, required: false },
        ],
        automaticParameters: [CALL_STATE_PARAM],
        ...secretParam(),
        http: { baseUrlPattern: `${APP_URL}/api/calendar/${slug}/slots`, httpMethod: 'GET' },
        timeout: '10s',
      },
    },
    {
      temporaryTool: {
        modelToolName: 'bookAppointment',
        description: 'Book an appointment for a caller. IMPORTANT: pass time exactly as the displayTime value returned by checkCalendarAvailability (e.g. "9:00 AM", "2:30 PM") — do not reformat it. Always include callerPhone from CALLER PHONE in callerContext. If response has booked=false and nextAvailable, offer that slot. If response has fallback=true, switch to message-taking mode instead.',
        dynamicParameters: [
          { name: 'date', location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string', description: 'Date in YYYY-MM-DD format' }, required: true },
          { name: 'time', location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string', description: 'Exact displayTime from checkCalendarAvailability e.g. "9:00 AM". Do not reformat.' }, required: true },
          { name: 'callerName', location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string', description: "Caller's full name" }, required: true },
          { name: 'service', location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string', description: 'Type of appointment or service' }, required: false },
          { name: 'callerPhone', location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string', description: "Caller's phone number from CALLER PHONE in callerContext" }, required: true },
        ],
        automaticParameters: [CALL_STATE_PARAM],
        ...secretParam(),
        http: { baseUrlPattern: `${APP_URL}/api/calendar/${slug}/book`, httpMethod: 'POST' },
        timeout: '10s',
      },
    },
  ]
}

function buildTransferTools(slug, conditions) {
  const desc = conditions
    ? `Transfer the call when: ${conditions}`
    : 'Transfer the call to the owner ONLY when the caller explicitly asks to speak to someone directly, says "put me through", "connect me", or insists on speaking to a person. Do not use for general questions the agent can answer.'
  return [{
    temporaryTool: {
      modelToolName: 'transferCall',
      description: desc,
      dynamicParameters: [
        { name: 'reason', location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string', description: 'Reason for transfer' }, required: false },
      ],
      automaticParameters: [
        { name: 'call_id', location: 'PARAMETER_LOCATION_BODY', knownValue: 'KNOWN_PARAM_CALL_ID' },
        CALL_STATE_PARAM,
      ],
      ...secretParam(),
      http: { baseUrlPattern: `${APP_URL}/api/webhook/${slug}/transfer`, httpMethod: 'POST' },
    },
  }]
}

function buildSmsTools(slug) {
  return [{
    temporaryTool: {
      modelToolName: 'sendTextMessage',
      description: "Send an SMS text message to the caller during the call. Use this to send signup links, booking confirmations, or follow-up info. The caller's phone number is available from callerContext as CALLER PHONE.",
      dynamicParameters: [
        { name: 'to', location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string', description: "Caller's phone number in E.164 format from CALLER PHONE in callerContext" }, required: true },
        { name: 'message', location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string', description: 'SMS message body to send' }, required: true },
      ],
      automaticParameters: [
        { name: 'call_id', location: 'PARAMETER_LOCATION_BODY', knownValue: 'KNOWN_PARAM_CALL_ID' },
        CALL_STATE_PARAM,
      ],
      ...secretParam(),
      http: { baseUrlPattern: `${APP_URL}/api/webhook/${slug}/sms`, httpMethod: 'POST' },
    },
  }]
}

function buildKnowledgeTools(slug) {
  return [{
    temporaryTool: {
      modelToolName: 'queryKnowledge',
      description: 'Search the business knowledge base for detailed information. Use this when a caller asks a specific question NOT already answered by the Key Business Facts in your context. Returns relevant text passages. If results are empty, tell the caller you will have someone follow up with that information — NEVER guess.',
      dynamicParameters: [
        { name: 'query', location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string', description: "The search query — rephrase the caller's question as a short factual query" }, required: true },
      ],
      automaticParameters: [
        CALL_STATE_PARAM,
        { name: 'call_id', location: 'PARAMETER_LOCATION_BODY', knownValue: 'KNOWN_PARAM_CALL_ID' },
      ],
      ...secretParam(),
      http: { baseUrlPattern: `${APP_URL}/api/knowledge/${slug}/query`, httpMethod: 'POST' },
    },
  }]
}

function buildCoachingTool(slug) {
  return {
    temporaryTool: {
      modelToolName: 'checkForCoaching',
      description: 'Check if the manager has sent coaching guidance. Call this every 30 seconds during a live call. If coaching is available, smoothly incorporate it.',
      dynamicParameters: [
        { name: 'ultravox_call_id', location: 'PARAMETER_LOCATION_BODY', schema: { type: 'string', description: 'The current Ultravox call ID' }, required: true },
      ],
      automaticParameters: [CALL_STATE_PARAM],
      ...secretParam(),
      http: { baseUrlPattern: `${APP_URL}/api/coaching/${slug}/check`, httpMethod: 'POST' },
      timeout: '10s',
    },
  }
}

// --- Main ---

const LIVE_SLUGS = ['hasan-sharif', 'exp-realty', 'windshield-hub', 'urban-vibe']

const { data: clients, error } = await supabase
  .from('clients')
  .select('id, slug, booking_enabled, forwarding_number, sms_enabled, knowledge_backend, transfer_conditions')
  .in('slug', LIVE_SLUGS)

if (error) { console.error('DB error:', error.message); process.exit(1) }

for (const c of clients) {
  // Count approved knowledge chunks
  const { count } = await supabase
    .from('knowledge_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', c.id)
    .eq('status', 'approved')

  const tools = [HANGUP_TOOL]
  if (c.booking_enabled && c.slug) tools.push(...buildCalendarTools(c.slug))
  if (c.forwarding_number && c.slug) tools.push(...buildTransferTools(c.slug, c.transfer_conditions))
  if (c.sms_enabled && c.slug) tools.push(...buildSmsTools(c.slug))
  if (c.knowledge_backend === 'pgvector' && c.slug && count > 0) tools.push(...buildKnowledgeTools(c.slug))
  if (c.slug) tools.push(buildCoachingTool(c.slug))

  const { error: updateError } = await supabase.from('clients').update({ tools }).eq('id', c.id)
  if (updateError) {
    console.error(`FAIL ${c.slug}: ${updateError.message}`)
  } else {
    console.log(`OK ${c.slug}: ${tools.length} tools (booking=${!!c.booking_enabled} transfer=${!!c.forwarding_number} sms=${!!c.sms_enabled} knowledge=${c.knowledge_backend === 'pgvector' && count > 0} chunks=${count})`)
  }
}

console.log('\nDone. WEBHOOK_SECRET present:', !!WEBHOOK_SECRET)
