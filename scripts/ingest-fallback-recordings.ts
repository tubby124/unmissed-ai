/**
 * Outage recovery — ingest Twilio recordings captured by the Cloudflare
 * voice-fallback Worker, backfill them into `call_logs`, and fire client
 * Telegram alerts.
 *
 * When to run:
 *   After a primary-route outage (Railway down, Ultravox down, anything that
 *   triggered Twilio's `VoiceFallbackUrl` → fallback.endvoicemail.ai/voice).
 *   The Worker captures the recording in Twilio's storage but does NOT write
 *   to Supabase. This script does that catch-up.
 *
 * Detection:
 *   Lists Twilio recordings created after `--since` and filters to ones whose
 *   parent CallSid has no `call_logs` row yet. Those are fallback-captured
 *   recordings.
 *
 * Usage:
 *   npx tsx scripts/ingest-fallback-recordings.ts --since=2026-05-19T22:00:00Z
 *
 * Optional:
 *   --apply              Commit changes (default: dry-run)
 *   --slug=urban-vibe    Limit to one client
 *   --notify             Fire client Telegram alerts (default off — dry-run only logs)
 *
 * Why dry-run by default:
 *   The script writes to call_logs AND fires Telegram alerts to real clients.
 *   You want to eyeball the list once before letting it loose.
 */

import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const NOTIFY = process.argv.includes('--notify')
const SINCE_ARG = process.argv.find((a) => a.startsWith('--since='))?.split('=')[1]
const SLUG_ARG = process.argv.find((a) => a.startsWith('--slug='))?.split('=')[1]

interface TwilioRecording {
  sid: string
  call_sid: string
  duration: string
  date_created: string
  uri: string
}

interface TwilioCall {
  sid: string
  from: string
  to: string
  start_time: string
  end_time: string
  status: string
}

async function twilioGet<T>(accountSid: string, authToken: string, path: string): Promise<T> {
  const auth = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  const res = await fetch(`https://api.twilio.com${path}`, { headers: { Authorization: auth } })
  if (!res.ok) throw new Error(`Twilio GET ${path} failed: ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

async function listRecordingsSince(
  accountSid: string,
  authToken: string,
  since: string,
): Promise<TwilioRecording[]> {
  const out: TwilioRecording[] = []
  let path = `/2010-04-01/Accounts/${accountSid}/Recordings.json?PageSize=100&DateCreated>=${encodeURIComponent(since)}`
  while (path) {
    const body = await twilioGet<{ recordings: TwilioRecording[]; next_page_uri: string | null }>(
      accountSid,
      authToken,
      path,
    )
    out.push(...body.recordings)
    path = body.next_page_uri ?? ''
  }
  return out
}

async function getCall(accountSid: string, authToken: string, callSid: string): Promise<TwilioCall> {
  return twilioGet<TwilioCall>(accountSid, authToken, `/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`)
}

async function main(): Promise<void> {
  if (!SINCE_ARG) {
    console.error('Missing --since=<ISO-timestamp>. Example: --since=2026-05-19T22:00:00Z')
    process.exit(2)
  }
  const since = new Date(SINCE_ARG)
  if (isNaN(since.getTime())) {
    console.error(`Invalid --since: ${SINCE_ARG}`)
    process.exit(2)
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const twilioSid = process.env.TWILIO_ACCOUNT_SID
  const twilioToken = process.env.TWILIO_AUTH_TOKEN
  if (!supaUrl || !supaKey || !twilioSid || !twilioToken) {
    console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN')
    process.exit(2)
  }

  console.log(`[ingest-fallback-recordings] since=${since.toISOString()} mode=${APPLY ? 'APPLY' : 'DRY-RUN'} notify=${NOTIFY ? 'YES' : 'NO'} slug=${SLUG_ARG ?? '(all)'}`)

  const supa = createClient(supaUrl, supaKey, { auth: { persistSession: false } })

  // Map Twilio number → client row for slug + telegram routing.
  const { data: clients } = await supa
    .from('clients')
    .select('id, slug, business_name, twilio_number, telegram_bot_token, telegram_chat_id, telegram_chat_id_2')
    .eq('status', 'active')
    .not('twilio_number', 'is', null)
  const clientByNumber = new Map<string, NonNullable<typeof clients>[number]>()
  for (const c of clients ?? []) {
    if (c.twilio_number) clientByNumber.set(c.twilio_number, c)
  }
  console.log(`[ingest-fallback-recordings] Loaded ${clientByNumber.size} active client(s)`)

  const recordings = await listRecordingsSince(twilioSid, twilioToken, since.toISOString())
  console.log(`[ingest-fallback-recordings] Twilio returned ${recordings.length} recording(s) since ${since.toISOString()}`)

  let ingested = 0
  let skippedExisting = 0
  let skippedNoClient = 0
  let skippedFilteredSlug = 0

  for (const rec of recordings) {
    // Skip if call_logs row already exists for this CallSid (the primary route
    // is back and handled the call normally — not a fallback case).
    const { data: existing } = await supa
      .from('call_logs')
      .select('id, call_status')
      .eq('twilio_call_sid', rec.call_sid)
      .maybeSingle()
    if (existing) {
      skippedExisting++
      continue
    }

    const call = await getCall(twilioSid, twilioToken, rec.call_sid)
    const client = clientByNumber.get(call.to)
    if (!client) {
      skippedNoClient++
      console.log(`  - call ${rec.call_sid} to=${call.to} — no active client maps to this number, skipping`)
      continue
    }
    if (SLUG_ARG && client.slug !== SLUG_ARG) {
      skippedFilteredSlug++
      continue
    }

    const duration = parseInt(rec.duration || '0', 10)
    const recordingPath = `vm-${rec.sid}.mp3`
    console.log(`  + ${client.slug} : from=${call.from} duration=${duration}s recordingSid=${rec.sid} callSid=${rec.call_sid}`)

    if (!APPLY) {
      ingested++
      continue
    }

    // Download from Twilio → upload to Supabase storage.
    try {
      const auth = 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')
      const audioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Recordings/${rec.sid}.mp3`,
        { headers: { Authorization: auth }, signal: AbortSignal.timeout(30_000) },
      )
      if (!audioRes.ok) {
        console.error(`      ✗ recording download failed: ${audioRes.status}`)
        continue
      }
      const audioBuffer = Buffer.from(await audioRes.arrayBuffer())
      const { error: upErr } = await supa.storage
        .from('recordings')
        .upload(recordingPath, audioBuffer, { contentType: 'audio/mpeg', upsert: true })
      if (upErr) {
        console.error(`      ✗ storage upload failed: ${upErr.message}`)
        continue
      }
    } catch (e) {
      console.error(`      ✗ download/upload error:`, e)
      continue
    }

    // Insert call_logs row mimicking the standard voicemail webhook.
    const { error: insErr } = await supa.from('call_logs').insert({
      client_id: client.id,
      twilio_call_sid: rec.call_sid,
      caller_phone: call.from,
      call_status: 'VOICEMAIL',
      recording_url: recordingPath,
      duration_seconds: duration,
      started_at: call.start_time,
      ended_at: call.end_time || new Date().toISOString(),
      // ai_summary doubles as the provenance marker — matches the pattern used
      // by /api/webhook/[slug]/fallback when it writes VOICEMAIL rows inline.
      ai_summary: `Voicemail (${duration}s) — captured by fallback worker during primary route outage`,
    })
    if (insErr) {
      console.error(`      ✗ call_logs insert failed: ${insErr.message}`)
      continue
    }
    ingested++
    console.log(`      ✓ ingested`)

    // Optional client Telegram alert.
    if (NOTIFY && client.telegram_bot_token && client.telegram_chat_id) {
      const msg = [
        `<b>VOICEMAIL</b> [${client.slug}] (recovered)`,
        `Caller: ${call.from}`,
        `Duration: ${duration}s`,
        ``,
        `Captured during a service outage. Listen in your dashboard.`,
      ].join('\n')
      try {
        await fetch(`https://api.telegram.org/bot${client.telegram_bot_token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: client.telegram_chat_id, text: msg, parse_mode: 'HTML' }),
        })
      } catch {
        // best-effort
      }
    }
  }

  console.log('')
  console.log(`[ingest-fallback-recordings] ${APPLY ? 'INGESTED' : 'WOULD INGEST'}=${ingested} skipped-existing=${skippedExisting} skipped-no-client=${skippedNoClient} skipped-slug-filter=${skippedFilteredSlug}`)
  if (!APPLY && ingested > 0) {
    console.log(`[ingest-fallback-recordings] Re-run with --apply to commit (add --notify to alert clients).`)
  }
}

main().catch((e) => {
  console.error('[ingest-fallback-recordings] FATAL:', e)
  process.exit(1)
})
