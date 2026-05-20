/**
 * Wire Twilio per-number VoiceFallbackUrl to the Cloudflare Worker.
 *
 * Idempotent — safe to re-run after provisioning a new client. Compares each
 * IncomingPhoneNumber's current `voice_fallback_url` against the target value
 * and patches only when different.
 *
 * Target (env-overridable):
 *   FALLBACK_VOICE_URL=https://fallback.endvoicemail.ai/voice
 *   FALLBACK_METHOD=POST
 *
 * Source of truth for which numbers to wire:
 *   Supabase `clients` rows where status='active' AND twilio_number IS NOT NULL.
 *
 * Run:
 *   railway run -- npx tsx scripts/set-twilio-voice-fallback.ts
 *   OR with local env:
 *   npx tsx scripts/set-twilio-voice-fallback.ts
 *
 * Dry-run (default): logs what WOULD change, makes no PATCH calls.
 * Live:
 *   npx tsx scripts/set-twilio-voice-fallback.ts --apply
 *
 * Why this exists:
 * Railway can go fully dark (May 19 2026 incident). Setting VoiceFallbackUrl
 * at the Twilio level on a different host (Cloudflare Worker) gives every
 * inbound call a place to land even when Railway is unreachable.
 */

import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const FALLBACK_VOICE_URL = process.env.FALLBACK_VOICE_URL || 'https://fallback.endvoicemail.ai/voice'
const FALLBACK_METHOD = (process.env.FALLBACK_METHOD || 'POST').toUpperCase()
const APPLY = process.argv.includes('--apply')

interface TwilioIncomingNumber {
  sid: string
  phone_number: string
  voice_url: string
  voice_fallback_url: string
  voice_fallback_method: string
  friendly_name: string
}

interface ClientRow {
  slug: string
  twilio_number: string | null
  status: string | null
}

async function listTwilioNumbers(accountSid: string, authToken: string): Promise<TwilioIncomingNumber[]> {
  // Twilio paginates at 50; the fleet is well under that, but loop in case it grows.
  const all: TwilioIncomingNumber[] = []
  let url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?PageSize=100`
  const auth = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  while (url) {
    const res = await fetch(url, { headers: { Authorization: auth } })
    if (!res.ok) throw new Error(`Twilio list failed: ${res.status} ${await res.text()}`)
    const body = await res.json() as { incoming_phone_numbers: TwilioIncomingNumber[]; next_page_uri: string | null }
    all.push(...body.incoming_phone_numbers)
    url = body.next_page_uri ? `https://api.twilio.com${body.next_page_uri}` : ''
  }
  return all
}

async function patchTwilioNumber(
  accountSid: string,
  authToken: string,
  numberSid: string,
  voiceFallbackUrl: string,
  voiceFallbackMethod: string,
): Promise<void> {
  const auth = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  const body = new URLSearchParams({
    VoiceFallbackUrl: voiceFallbackUrl,
    VoiceFallbackMethod: voiceFallbackMethod,
  })
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${numberSid}.json`,
    { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' }, body },
  )
  if (!res.ok) throw new Error(`Twilio patch failed: ${res.status} ${await res.text()}`)
}

async function main(): Promise<void> {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const twilioSid = process.env.TWILIO_ACCOUNT_SID
  const twilioToken = process.env.TWILIO_AUTH_TOKEN
  if (!supaUrl || !supaKey || !twilioSid || !twilioToken) {
    console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN')
    process.exit(2)
  }

  console.log(`[set-twilio-voice-fallback] target=${FALLBACK_VOICE_URL} method=${FALLBACK_METHOD} mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`)

  const supa = createClient(supaUrl, supaKey, { auth: { persistSession: false } })
  const { data: clientRows, error } = await supa
    .from('clients')
    .select('slug, twilio_number, status')
    .eq('status', 'active')
    .not('twilio_number', 'is', null) as { data: ClientRow[] | null; error: unknown }
  if (error || !clientRows) {
    console.error('[set-twilio-voice-fallback] Supabase query failed:', error)
    process.exit(2)
  }

  const slugByNumber = new Map<string, string>()
  for (const c of clientRows) {
    if (c.twilio_number) slugByNumber.set(c.twilio_number, c.slug)
  }
  console.log(`[set-twilio-voice-fallback] Found ${slugByNumber.size} active client number(s) in Supabase`)

  const twilioNumbers = await listTwilioNumbers(twilioSid, twilioToken)
  console.log(`[set-twilio-voice-fallback] Found ${twilioNumbers.length} number(s) in Twilio account`)

  let changed = 0
  let skipped = 0
  let unowned = 0

  for (const n of twilioNumbers) {
    const slug = slugByNumber.get(n.phone_number)
    if (!slug) {
      unowned++
      console.log(`  - ${n.phone_number} : NO ACTIVE CLIENT (skipping; sid=${n.sid})`)
      continue
    }
    const currentUrl = (n.voice_fallback_url || '').trim()
    const currentMethod = (n.voice_fallback_method || '').toUpperCase()
    if (currentUrl === FALLBACK_VOICE_URL && currentMethod === FALLBACK_METHOD) {
      skipped++
      console.log(`  - ${n.phone_number} : ${slug} : already wired (skipping)`)
      continue
    }
    console.log(`  - ${n.phone_number} : ${slug} : WILL CHANGE`)
    console.log(`      from: ${currentUrl || '(none)'} (${currentMethod || '(unset)'})`)
    console.log(`      to:   ${FALLBACK_VOICE_URL} (${FALLBACK_METHOD})`)
    if (APPLY) {
      try {
        await patchTwilioNumber(twilioSid, twilioToken, n.sid, FALLBACK_VOICE_URL, FALLBACK_METHOD)
        changed++
        console.log(`      ✓ patched`)
      } catch (e) {
        console.error(`      ✗ patch failed:`, e)
      }
    } else {
      changed++
    }
  }

  console.log('')
  console.log(`[set-twilio-voice-fallback] ${APPLY ? 'CHANGED' : 'WOULD CHANGE'}=${changed} unchanged=${skipped} unowned-numbers=${unowned}`)
  if (!APPLY && changed > 0) {
    console.log(`[set-twilio-voice-fallback] Re-run with --apply to commit.`)
  }
}

main().catch((e) => {
  console.error('[set-twilio-voice-fallback] FATAL:', e)
  process.exit(1)
})
