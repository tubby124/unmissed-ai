import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

type SendLogEntry = {
  sent_at?: string
  campaign?: string
  batch?: string
  send_order?: string
  business_name?: string
  city?: string
  province?: string
  email?: string
  subject?: string
  campaign_url?: string
  resend_email_id?: string | null
  result?: { ok?: boolean; id?: string; error?: string }
}

type ResendEvent = {
  event_type: string
  resend_email_id: string | null
  to_email: string | null
  subject: string | null
  occurred_at: string
}

const DEFAULT_LOG_DIR = '/Users/owner/Downloads/Obsidian Vault/Projects/unmissed/leads'
const REPORT_PREFIX = 'apify-autoglass-email-batch-01-status'

function argValue(name: string): string | undefined {
  const exact = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  if (exact) return exact.slice(name.length + 3)
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match || process.env[match[1]]) continue
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function latestLogPath() {
  const explicit = argValue('log')
  if (explicit) return explicit
  if (!fs.existsSync(DEFAULT_LOG_DIR)) return null

  const files = fs.readdirSync(DEFAULT_LOG_DIR)
    .filter((name) => /^apify-autoglass-email-batch-01-send-log-\d{4}-\d{2}-\d{2}\.jsonl$/.test(name))
    .sort()
  const latest = files.at(-1)
  if (!latest) return null
  return path.join(DEFAULT_LOG_DIR, latest)
}

function readSendLog(filePath: string): SendLogEntry[] {
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SendLogEntry)
}

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function latestStatus(events: ResendEvent[], send: SendLogEntry) {
  if (send.result?.error) return 'failed'
  const rank: Record<string, number> = {
    'email.sent': 1,
    'email.delivery_delayed': 2,
    'email.delivered': 3,
    'email.opened': 4,
    'email.clicked': 5,
    'email.failed': 90,
    'email.bounced': 91,
    'email.complained': 92,
  }
  const latest = [...events].sort((a, b) => (rank[b.event_type] ?? 0) - (rank[a.event_type] ?? 0))[0]
  return latest?.event_type.replace(/^email\./, '') ?? (send.result?.ok ? 'sent_api_only' : 'unknown')
}

async function main() {
  loadEnvFile(path.join(process.cwd(), '.env.local'))

  const logPath = latestLogPath()
  if (!logPath) {
    console.log(JSON.stringify({
      logPath: null,
      outPath: null,
      sends: 0,
      events: 0,
      summary: {},
      note: 'No live auto-glass send log found yet.',
    }, null, 2))
    return
  }
  const sends = readSendLog(logPath)
  const ids = sends
    .map((send) => send.resend_email_id ?? send.result?.id)
    .filter((id): id is string => Boolean(id))

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const { data, error } = ids.length
    ? await supabase
      .from('resend_email_events')
      .select('event_type,resend_email_id,to_email,subject,occurred_at')
      .in('resend_email_id', ids)
      .order('occurred_at', { ascending: true })
    : { data: [], error: null }
  if (error) throw error

  const eventsById = new Map<string, ResendEvent[]>()
  for (const event of (data ?? []) as ResendEvent[]) {
    if (!event.resend_email_id) continue
    eventsById.set(event.resend_email_id, [...(eventsById.get(event.resend_email_id) ?? []), event])
  }

  const headers = [
    'send_order',
    'business_name',
    'city',
    'province',
    'email',
    'resend_email_id',
    'latest_status',
    'sent_events',
    'delivered_events',
    'opened_events',
    'clicked_events',
    'bounced_events',
    'complained_events',
    'failed_events',
    'sent_at',
    'last_event_at',
    'campaign_url',
  ]

  const rows = sends.map((send) => {
    const id = send.resend_email_id ?? send.result?.id ?? ''
    const events = eventsById.get(id) ?? []
    const count = (eventType: string) => events.filter((event) => event.event_type === eventType).length
    return {
      send_order: send.send_order ?? '',
      business_name: send.business_name ?? '',
      city: send.city ?? '',
      province: send.province ?? '',
      email: send.email ?? '',
      resend_email_id: id,
      latest_status: latestStatus(events, send),
      sent_events: count('email.sent'),
      delivered_events: count('email.delivered'),
      opened_events: count('email.opened'),
      clicked_events: count('email.clicked'),
      bounced_events: count('email.bounced'),
      complained_events: count('email.complained'),
      failed_events: count('email.failed'),
      sent_at: send.sent_at ?? '',
      last_event_at: events.at(-1)?.occurred_at ?? '',
      campaign_url: send.campaign_url ?? '',
    }
  })

  const outPath = argValue('out') ?? path.join(DEFAULT_LOG_DIR, `${REPORT_PREFIX}-${today()}.csv`)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header as keyof typeof row])).join(',')),
  ].join('\n') + '\n')

  const summary = rows.reduce((acc, row) => {
    acc[row.latest_status] = (acc[row.latest_status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log(JSON.stringify({
    logPath,
    outPath,
    sends: sends.length,
    events: (data ?? []).length,
    summary,
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
