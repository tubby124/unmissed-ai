/**
 * unmissed.ai — Twilio Voice Fallback Worker
 *
 * Wired as Twilio's per-number `VoiceFallbackUrl`. Twilio hits this Worker when
 * the primary `VoiceUrl` (Railway-hosted Next.js app) returns 4xx/5xx OR times
 * out. We serve a static voicemail TwiML so the caller never hears a dead line.
 *
 * Why a separate worker:
 * - Railway can go down (May 19 2026 incident). If the fallback also lives on
 *   Railway, the fallback is moot.
 * - Cloudflare Workers run on Cloudflare's global edge — independent failure
 *   domain from Railway.
 *
 * Routes served:
 *   POST /voice                — Twilio inbound fallback. Returns voicemail TwiML.
 *   POST /recording            — Twilio recording-status callback. Telegram-alerts operator.
 *   GET  /health               — liveness probe.
 *
 * Twilio recordings stay in Twilio's hosted storage by default (long retention
 * unless the account is configured otherwise). When Railway recovers, a
 * recovery script (`scripts/ingest-fallback-recordings.ts`) backfills
 * `call_logs` VOICEMAIL rows from the Telegram alert log + Twilio recording
 * list.
 */

interface Env {
  TELEGRAM_BOT_TOKEN: string
  TELEGRAM_OPERATOR_CHAT_ID: string
  TWILIO_AUTH_TOKEN: string
  // Optional: comma-separated list of slugs to disable fallback for (e.g. while debugging).
  DISABLED_SLUGS?: string
}

// Twilio-number → client-slug map. Update when provisioning a new client.
// Keep in code (not KV) — it's tiny, rarely changes, and removes a runtime
// dependency for the fallback path.
const NUMBER_TO_SLUG: Record<string, string> = {
  '+15873296845': 'urban-vibe',
  '+15877421507': 'hasan-sharif',
  '+15873551834': 'windshield-hub',
  '+15878014602': 'manzil-isa',
  '+14036693068': 'calgary-property-leasing',
  '+15875905770': 'exp-realty',
  '+15873275902': 'unmissed-demo',
  '+14039003237': 'bowness-property-management',
}

function twimlVoicemail(slug: string | null): string {
  const businessLine = slug ? `the ${slug.replace(/-/g, ' ')} line` : "this number"
  // Plain, calm, non-alarming. Caller doesn't need to know our infra is down.
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Hi, you've reached ${businessLine}. We're unable to take your call right now. Please leave a short message after the beep and we'll get back to you.</Say>
  <Record maxLength="180" playBeep="true" trim="trim-silence" recordingStatusCallback="https://fallback.endvoicemail.ai/recording" recordingStatusCallbackMethod="POST" />
  <Say voice="Polly.Joanna">Sorry, we didn't get that. Please try again later. Goodbye.</Say>
  <Hangup/>
</Response>`
}

function plainText(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })
}

function twiml(xml: string, status = 200): Response {
  return new Response(xml, { status, headers: { 'Content-Type': 'application/xml' } })
}

/**
 * Twilio signature validation — HMAC-SHA1 over (URL + sorted-param-key-concat-value),
 * base64-encoded. Constant-time compare. Same scheme as Twilio SDK's
 * validateRequest, ported to Web Crypto for Workers runtime.
 */
async function validateTwilioSignature(
  signatureHeader: string | null,
  fullUrl: string,
  formParams: Record<string, string>,
  authToken: string,
): Promise<boolean> {
  if (!signatureHeader || !authToken) return false
  const sortedKeys = Object.keys(formParams).sort()
  let data = fullUrl
  for (const k of sortedKeys) data += k + formParams[k]
  const keyData = new TextEncoder().encode(authToken)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data))
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)))
  // Constant-time compare via XOR length-check + byte compare.
  if (expected.length !== signatureHeader.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i)
  return diff === 0
}

async function readFormParams(req: Request): Promise<Record<string, string>> {
  const text = await req.text()
  const params: Record<string, string> = {}
  for (const pair of text.split('&')) {
    const [k, v] = pair.split('=')
    if (!k) continue
    params[decodeURIComponent(k)] = decodeURIComponent((v ?? '').replace(/\+/g, ' '))
  }
  return params
}

async function sendTelegramAlert(env: Env, text: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_OPERATOR_CHAT_ID) return
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_OPERATOR_CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })
  } catch {
    // Best-effort. The voicemail itself is more important than the alert.
  }
}

async function handleVoice(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)
  const form = await readFormParams(req)
  const sig = req.headers.get('x-twilio-signature')

  // Allow Twilio retries on failed signature validation? No — if signature is
  // invalid, this is either a misconfiguration or an attack. Refuse with 403.
  const valid = await validateTwilioSignature(sig, url.toString(), form, env.TWILIO_AUTH_TOKEN)
  if (!valid) {
    await sendTelegramAlert(env, `⚠️ <b>voice-fallback</b> rejected POST /voice with invalid X-Twilio-Signature. URL=${url.toString()}`)
    return plainText('forbidden', 403)
  }

  const to = form['To'] ?? ''
  const slug = NUMBER_TO_SLUG[to] ?? null

  if (env.DISABLED_SLUGS && slug && env.DISABLED_SLUGS.split(',').map(s => s.trim()).includes(slug)) {
    // Operator can opt a slug out (e.g. while debugging) — Twilio retries the
    // primary or rings out. Still alert so we know.
    await sendTelegramAlert(env, `🟡 <b>voice-fallback</b> declined for ${slug} (DISABLED_SLUGS). To=${to}`)
    return plainText('disabled', 503)
  }

  // Fire-and-forget alert so the TwiML response isn't blocked on Telegram.
  // The TwiML response speed matters — slow TwiML = caller hears nothing.
  const from = form['From'] ?? 'unknown'
  const callSid = form['CallSid'] ?? 'unknown'
  void sendTelegramAlert(
    env,
    `🚨 <b>FALLBACK FIRED</b>\n` +
    `Primary route is down. Twilio served the fallback voicemail.\n\n` +
    `Slug: <b>${slug ?? '(unknown number)'}</b>\n` +
    `From: <code>${from}</code>\n` +
    `To: <code>${to}</code>\n` +
    `CallSid: <code>${callSid}</code>\n\n` +
    `Caller is being recorded. Recording will follow in a separate alert.`,
  )

  return twiml(twimlVoicemail(slug))
}

async function handleRecording(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)
  const form = await readFormParams(req)
  const sig = req.headers.get('x-twilio-signature')

  const valid = await validateTwilioSignature(sig, url.toString(), form, env.TWILIO_AUTH_TOKEN)
  if (!valid) {
    return plainText('forbidden', 403)
  }

  const recordingStatus = form['RecordingStatus'] ?? ''
  // Twilio fires this callback with status='in-progress' then 'completed'.
  // Only alert on completed — the in-progress one has no URL.
  if (recordingStatus !== 'completed') {
    return plainText('ok', 200)
  }

  const recordingSid = form['RecordingSid'] ?? 'unknown'
  const recordingUrl = form['RecordingUrl'] ?? ''
  const recordingDuration = form['RecordingDuration'] ?? '?'
  const callSid = form['CallSid'] ?? 'unknown'
  const from = form['From'] ?? 'unknown'
  const to = form['To'] ?? 'unknown'
  const slug = NUMBER_TO_SLUG[to] ?? '(unknown)'

  // Twilio recording URLs require Twilio Basic auth to download. The operator
  // can play it directly in the Twilio console by SID. Including SID + URL
  // gives both paths — paste-in-console OR auth'd curl during recovery.
  await sendTelegramAlert(
    env,
    `🎙 <b>FALLBACK VOICEMAIL</b> (${recordingDuration}s)\n\n` +
    `Slug: <b>${slug}</b>\n` +
    `From: <code>${from}</code>\n` +
    `To: <code>${to}</code>\n` +
    `CallSid: <code>${callSid}</code>\n` +
    `RecordingSid: <code>${recordingSid}</code>\n\n` +
    `<b>Recording URL</b> (needs Twilio Basic auth):\n${recordingUrl}.mp3\n\n` +
    `When primary route recovers, run <code>npx tsx scripts/ingest-fallback-recordings.ts --since=&lt;ISO&gt;</code> to backfill <code>call_logs</code>.`,
  )

  return plainText('ok', 200)
}

function handleHealth(): Response {
  return new Response(
    JSON.stringify({ ok: true, ts: new Date().toISOString(), service: 'unmissed-voice-fallback' }),
    { headers: { 'Content-Type': 'application/json' } },
  )
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (req.method === 'GET' && url.pathname === '/health') return handleHealth()
    if (req.method === 'POST' && url.pathname === '/voice') return handleVoice(req, env)
    if (req.method === 'POST' && url.pathname === '/recording') return handleRecording(req, env)
    return plainText('not found', 404)
  },
}
