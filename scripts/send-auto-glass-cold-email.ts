import fs from 'node:fs'
import path from 'node:path'
import { Resend } from 'resend'

type Row = Record<string, string>

const DEFAULT_BATCH = path.join(process.cwd(), 'public/leads/campaigns/auto-glass-email-batch-01-2026-06-17.csv')
const DEFAULT_LOG_DIR = '/Users/owner/Downloads/Obsidian Vault/Projects/unmissed/leads'
const FROM = 'Hasan from EndVoicemail <hello@endvoicemail.ai>'
const DEFAULT_REPLY_TO = 'hello@endvoicemail.ai'
const DEFAULT_MAILING_ADDRESS = 'End Voicemail, Calgary, AB, Canada'
const BLOCKED_RE = /windshield\s*hub|riverbend\s*auto\s*glass|riverbend\s*autoglass/i
const CAMPAIGN_TAG = 'auto_glass_cold_1'

function argValue(name: string): string | undefined {
  const exact = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  if (exact) return exact.slice(name.length + 3)
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match || process.env[match[1]]) continue
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

function parseCsv(text: string): Row[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') {
      cell += char
    }
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }

  const headers = rows.shift()
  if (!headers) return []
  return rows
    .filter((cells) => cells.length === headers.length)
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])))
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function sendLogPath() {
  return path.join(DEFAULT_LOG_DIR, `apify-autoglass-email-batch-01-send-log-${today()}.jsonl`)
}

function uniqueSendableRows(rows: Row[]): Row[] {
  const seenEmails = new Set<string>()
  return rows.filter((row) => {
    const email = row.email?.trim().toLowerCase()
    if (!email || seenEmails.has(email)) return false
    seenEmails.add(email)

    const haystack = [
      row.business_name,
      row.email,
      row.website_url,
      row.google_place_url,
      row.yp_detail_url,
    ].join(' ')
    return !BLOCKED_RE.test(haystack)
  })
}

function assertNoBlockedRows(rows: Row[]) {
  const blocked = rows.filter((row) => BLOCKED_RE.test([
    row.business_name,
    row.email,
    row.website_url,
    row.google_place_url,
    row.yp_detail_url,
  ].join(' ')))
  if (blocked.length > 0) {
    const names = blocked.map((row) => `${row.business_name} <${row.email}>`).join(', ')
    throw new Error(`Blocked rows present; refusing to send: ${names}`)
  }
}

function successfulSendKey(row: Row) {
  return `${row.batch}|${row.send_order}|${row.email.trim().toLowerCase()}`
}

function readSuccessfulSendKeys() {
  const keys = new Set<string>()
  if (!fs.existsSync(DEFAULT_LOG_DIR)) return keys

  const files = fs.readdirSync(DEFAULT_LOG_DIR)
    .filter((name) => /^apify-autoglass-email-batch-01-send-log-\d{4}-\d{2}-\d{2}\.jsonl$/.test(name))

  for (const file of files) {
    const filePath = path.join(DEFAULT_LOG_DIR, file)
    for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
      if (!line.trim()) continue
      try {
        const entry = JSON.parse(line) as {
          batch?: string
          send_order?: string
          email?: string
          resend_email_id?: string
          result?: { ok?: boolean; id?: string }
        }
        const resendEmailId = entry.resend_email_id ?? entry.result?.id
        if (entry.result?.ok && resendEmailId && entry.batch && entry.send_order && entry.email) {
          keys.add(`${entry.batch}|${entry.send_order}|${entry.email.trim().toLowerCase()}`)
        }
      } catch {
        // Ignore malformed historical log lines; the send loop still logs new rows.
      }
    }
  }

  return keys
}

function appendLog(row: Row, result: Record<string, unknown>, resendEmailId?: string) {
  fs.mkdirSync(DEFAULT_LOG_DIR, { recursive: true })
  fs.appendFileSync(sendLogPath(), `${JSON.stringify({
    sent_at: new Date().toISOString(),
    campaign: CAMPAIGN_TAG,
    batch: row.batch,
    send_order: row.send_order,
    business_name: row.business_name,
    city: row.city,
    province: row.province,
    email: row.email,
    subject: row.subject_1,
    campaign_url: row.campaign_url,
    resend_email_id: resendEmailId ?? null,
    result,
  })}\n`)
}

function buildEmailText(row: Row, replyTo: string, mailingAddress: string) {
  const text = row.email_1.trim()
  if (/reply\s+STOP/i.test(text) && text.includes(mailingAddress)) return text

  return [
    text,
    '',
    'PS: If this is not useful, reply STOP and I will not email again.',
    '',
    `${mailingAddress} - ${replyTo}`,
  ].join('\n')
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildEmailHtml(text: string) {
  const paragraphs = text
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => {
      const html = escapeHtml(paragraph).replace(/\n/g, '<br>')
      return `<p style="margin:0 0 16px 0">${html}</p>`
    })
    .join('\n')

  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111">${paragraphs}</div>`
}

function leadId(row: Row) {
  try {
    const url = new URL(row.campaign_url)
    return url.searchParams.get('lead') ?? row.send_order
  } catch {
    return row.send_order
  }
}

async function main() {
  loadEnvFile(path.join(process.cwd(), '.env.local'))

  const send = hasFlag('send')
  const batchPath = argValue('batch') || DEFAULT_BATCH
  const limit = Number(argValue('limit') || (send ? 1 : 5))
  const start = Number(argValue('start') || 1)
  const testTo = argValue('test-to')
  const from = argValue('from') || process.env.COLD_OUTREACH_FROM || FROM
  const replyTo = argValue('reply-to') || process.env.COLD_OUTREACH_REPLY_TO || DEFAULT_REPLY_TO
  const mailingAddress = argValue('mailing-address') || process.env.COLD_OUTREACH_MAILING_ADDRESS || process.env.BRAND_MAILING_ADDRESS || DEFAULT_MAILING_ADDRESS
  const isTestSend = Boolean(testTo)
  const force = hasFlag('force')
  const key = process.env.RESEND_API_KEY

  if (!isTestSend && /@resend\.dev[>\s]*$/i.test(from)) {
    throw new Error('Refusing to send prospects from resend.dev; verify a real sender domain first.')
  }

  if (!fs.existsSync(batchPath)) throw new Error(`Batch CSV not found: ${batchPath}`)
  const rows = uniqueSendableRows(parseCsv(fs.readFileSync(batchPath, 'utf8')))
  assertNoBlockedRows(rows)

  const slice = rows.slice(Math.max(0, start - 1), Math.max(0, start - 1) + limit)
  console.log(JSON.stringify({
    mode: send ? 'send' : 'dry-run',
    batchPath,
    total_sendable_after_blocks: rows.length,
    start,
    limit,
    selected: slice.length,
    from,
    replyTo,
    mailingAddress,
    html: true,
    duplicateGuard: !force,
    blockedPattern: String(BLOCKED_RE),
  }, null, 2))

  const successfulSends = send && !isTestSend && !force ? readSuccessfulSendKeys() : new Set<string>()

  for (const row of slice) {
    const to = testTo || row.email
    const text = buildEmailText(row, replyTo, mailingAddress)
    const html = buildEmailHtml(text)
    const unsubscribeMailto = `mailto:${replyTo}?subject=Unsubscribe&body=Please remove ${encodeURIComponent(row.email)} from End Voicemail outreach.`
    const sendKey = successfulSendKey(row)

    if (!send) {
      console.log('\n--- DRY RUN EMAIL ---')
      console.log(`to: ${to}${testTo ? ` (test override for ${row.email})` : ''}`)
      console.log(`subject: ${row.subject_1}`)
      console.log(`reply-to: ${replyTo}`)
      console.log(text)
      continue
    }

    if (!isTestSend && successfulSends.has(sendKey)) {
      console.log(`skipped already sent: ${row.business_name} <${row.email}>`)
      continue
    }

    if (!key) throw new Error('RESEND_API_KEY is not configured')
    const resend = new Resend(key)
    const result = await resend.emails.send({
      from,
      to,
      replyTo,
      subject: row.subject_1,
      html,
      text,
      headers: {
        'List-Unsubscribe': `<${unsubscribeMailto}>`,
      },
      tags: [
        { name: 'purpose', value: isTestSend ? 'auto_glass_cold_test' : CAMPAIGN_TAG },
        { name: 'campaign', value: 'auto_glass' },
        { name: 'batch', value: row.batch.replace(/[^A-Za-z0-9_-]/g, '_') },
        { name: 'lead', value: leadId(row).replace(/[^A-Za-z0-9_-]/g, '_') },
      ],
    })

    if (!isTestSend) {
      appendLog(row, result.error
        ? { ok: false, error: result.error.message ?? String(result.error) }
        : { ok: true, id: result.data?.id }, result.data?.id)
    }

    if (result.error) {
      console.error(`failed: ${row.business_name} <${row.email}>: ${result.error.message}`)
    } else {
      console.log(`${isTestSend ? 'sent test' : 'sent'}: ${row.business_name} <${row.email}>${testTo ? ` to ${testTo}` : ''} id=${result.data?.id}`)
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
