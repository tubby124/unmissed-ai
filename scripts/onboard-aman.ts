/**
 * onboard-aman.ts — manual provisioning trace for Amandeep "Aman" Walia
 * (DBA: Walia Family Real Estate, brokerage: Ko Realty Ltd., Calgary).
 *
 * Modeled on scripts/onboard-emon.ts. Hasan has Aman's data confirmed in the
 * vault handoff (Projects/unmissed/2026-06-05-aman-walia-provisioning-and-
 * conditional-cf-fix.md) so we SKIP the places-lookup / autofill / scrape /
 * Sonar agent-intelligence steps. We go straight to the slot pipeline.
 *
 * Modes:
 *   --step=N       Run only step N
 *   --step=N --go  Same step, but commit destructive side effects
 *
 * Step list:
 *   6  build-slot-prompt   (buildPromptFromIntake → slot system_prompt)
 *   7  insert-client       (clients shell row, status='paused' until 12)
 *   8  create-agent        (Ultravox createAgent → ultravox_agent_id)
 *  10  twilio-assign       (point +15878728187 voice URL at walia-family)
 *  11  auth-user           (Supabase Auth: amanwalia.realtor@gmail.com)
 *  12  finalize            (status='active', plan='lite', mins=150, $0/mo)
 *  14  welcome-email       (HTML + TEXT preview ONLY — Hasan sends manually)
 *
 * Locked decisions (per handoff):
 *   slug=walia-family, niche=real_estate, agent_name=Riley
 *   voice=Ashley (df0b14d7-945f-41b2-989a-7c8c57688ddf, same as Emon)
 *   plan=lite, subscription_status=trialing, monthly_minute_limit=150
 *   effective_monthly_rate=0 (free trial)
 *   callback_phone = forwarding_number = +14039099868 (Aman's cell)
 *   Twilio number = +15878728187 (Olds AB, closest 587 to Calgary)
 *   No halal financing language (Hasan explicit)
 *
 * Output dir: CALLINGAGENTS/00-Inbox/onboard-aman-trace/
 */

import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const OUT_DIR = resolve('CALLINGAGENTS/00-Inbox/onboard-aman-trace')
mkdirSync(OUT_DIR, { recursive: true })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ULTRAVOX_API_KEY = process.env.ULTRAVOX_API_KEY!
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN!

const GO = process.argv.includes('--go')
const STEP = (() => {
  const a = process.argv.find(a => a.startsWith('--step='))
  return a ? parseInt(a.split('=')[1], 10) : null
})()

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false }})

// ───────── locked provisioning constants ─────────
const SLUG = 'walia-family'
const NICHE = 'real_estate'
const AGENT_NAME = 'Riley'
const VOICE_ID = 'df0b14d7-945f-41b2-989a-7c8c57688ddf' // Ashley — same as Emon
const VOICE_NAME = 'Ashley'
const OWNER_NAME = 'Aman Walia'
const LEGAL_NAME = 'Amandeep Walia'
const BUSINESS_NAME = 'Aman Walia — Walia Family Real Estate'
const BROKERAGE = 'Ko Realty Ltd.'
const CONTACT_EMAIL = 'amanwalia.realtor@gmail.com'
const CALLBACK_PHONE = '+14039099868' // Aman's cell from signature
const TWILIO_NUMBER = '+15878728187'  // Olds AB
const TWILIO_NUMBER_SID = 'PN2538a155ea5494bb05f438c259c5525d'
const BUSINESS_ADDRESS = 'Suite 206, 301 14 St NW, Calgary, AB T2N 2A1'
const WEBSITE_URL = 'https://yychousesforsale.com'
const TIMEZONE = 'America/Edmonton'
const PLAN = 'lite'
const SUBSCRIPTION_STATUS = 'trialing'
const MONTHLY_MINUTE_LIMIT = 150
const EFFECTIVE_MONTHLY_RATE = 0

function writeOut(stepNum: number, label: string, data: unknown) {
  const path = resolve(OUT_DIR, `STEP-${String(stepNum).padStart(2, '0')}-${label}.json`)
  writeFileSync(path, JSON.stringify(data, null, 2))
  console.log(`\n📝 Wrote ${path}`)
}

// ───────── STEP 6: build slot prompt ─────────
async function step6_buildSlotPrompt() {
  console.log('\n========== STEP 6: build slot prompt ==========')

  // Pronunciation rule — Llama tendency is to spell out abbreviations ("N-W" instead of
  // "northwest"). Kept TIGHT (single line) — pads forbidden_actions only ~120 chars.
  const pronunciationRule = "Say 'northwest' (not N-W), 'northeast' (not N-E), 'southwest' (not S-W), 'southeast' (not S-E). Read neighborhood names as words."

  // No website scrape this time — Hasan provided the data directly and we're
  // skipping the Sonar steps. KB will be seeded later if/when Aman wants it.
  const data: any = {
    niche: NICHE,
    businessName: BUSINESS_NAME,
    streetAddress: 'Suite 206, 301 14 St NW',
    city: 'Calgary',
    state: 'AB',
    agentName: AGENT_NAME,
    callbackPhone: CALLBACK_PHONE,
    ownerName: OWNER_NAME,
    contactEmail: CONTACT_EMAIL,
    websiteUrl: WEBSITE_URL,
    placeId: '',
    placesPhotoUrl: '',
    placesRating: 0,
    placesReviewCount: 0,
    gbpDescription: `${OWNER_NAME} | Walia Family Real Estate at ${BROKERAGE} | Calgary REALTOR® serving families, first-time buyers, seniors downsizing, and investors across Calgary, Airdrie, Cochrane, Chestermere, Okotoks, Strathmore, and Bragg Creek. Fluent in English, Punjabi, and Hindi.`,
    nicheCustomVariables: {
      FORBIDDEN_EXTRA: pronunciationRule,
    },
    businessHoursText: 'Available anytime',
    servicesOffered: '',
    hours: {
      monday:    { open: '00:00', close: '23:59', closed: false },
      tuesday:   { open: '00:00', close: '23:59', closed: false },
      wednesday: { open: '00:00', close: '23:59', closed: false },
      thursday:  { open: '00:00', close: '23:59', closed: false },
      friday:    { open: '00:00', close: '23:59', closed: false },
      saturday:  { open: '00:00', close: '23:59', closed: false },
      sunday:    { open: '00:00', close: '23:59', closed: false },
    },
    afterHoursBehavior: 'take_message',
    emergencyPhone: '',
    nicheAnswers: {},
    notificationMethod: 'telegram',
    notificationPhone: '',
    notificationEmail: CONTACT_EMAIL,
    callerAutoText: true,
    callerAutoTextMessage: '',
    callerFAQ: '',
    agentRestrictions: '',
    agentTone: 'professional_warm',
    primaryGoal: 'capture_info',
    completionFields: '',
    pricingPolicy: 'no_quote_callback',
    unknownAnswerBehavior: 'find_out_callback',
    calendarMode: 'request_callback',
    // Short summary — Aman's languages and service area. No halal financing
    // language (Hasan explicit). Brokerage = Ko Realty Ltd., DBA = Walia Family
    // Real Estate per his own email signature.
    businessNotes: `${OWNER_NAME} is a Calgary REALTOR® at ${BROKERAGE} operating under his personal brand "Walia Family Real Estate." He helps families, first-time buyers, seniors downsizing, and investors across Calgary, Airdrie, Cochrane, Chestermere, Okotoks, Strathmore, and Bragg Creek. Fluent in English, Punjabi, and Hindi.`,
    commonObjections: [],
    voiceId: VOICE_ID,
    voiceName: VOICE_NAME,
    callHandlingMode: 'triage',
    faqPairs: [],
    knowledgeDocs: [],
    timezone: TIMEZONE,
    websiteScrapeResult: null,
    ivrEnabled: false,
    ivrPrompt: '',
    scheduleMode: '24_7',
    callForwardingEnabled: true,
    agentJob: 'receptionist',
    recordingConsentAcknowledged: true,
    selectedPlan: PLAN,
    agentMode: 'lead_capture',
    selectedServices: [],
    callerReasons: [],
    urgencyWords: '',
    priceRange: '',
    manualDescription: `${OWNER_NAME} is a Calgary REALTOR® at ${BROKERAGE} (DBA Walia Family Real Estate). He serves families, first-time buyers, seniors downsizing, and investors across Calgary and surrounding communities. Fluent in English, Punjabi, and Hindi.`,
    businessAddress: BUSINESS_ADDRESS,
  }

  const { toIntakePayload } = await import('../src/lib/intake-transform.js')
  const { buildPromptFromIntake, validatePrompt } = await import('../src/lib/prompt-builder.js')

  const intakePayload = toIntakePayload(data)
  const prompt = buildPromptFromIntake(intakePayload)
  const validation = validatePrompt(prompt)
  const markers = (prompt.match(/<!-- unmissed:(\w+)/g) ?? []).map((s:string) => s.replace('<!-- unmissed:', ''))

  console.log(`  prompt chars:  ${prompt.length}`)
  console.log(`  slot markers:  ${markers.length}  (${markers.join(', ')})`)
  console.log(`  validation:    ${validation.valid ? '✓ PASS' : '✗ FAIL'}`)
  if (!validation.valid) {
    console.log(`  warnings:    ${(validation.warnings ?? []).join(' | ')}`)
    console.log(`  errors:      ${(validation.errors ?? []).join(' | ')}`)
  }
  writeOut(6, 'build-slot-prompt', {
    char_count: prompt.length,
    slot_markers: markers,
    validation,
    intakePayload,
    prompt,
  })
  return { prompt, intakePayload, validation }
}

// ───────── STEP 7: insert client shell row (DESTRUCTIVE) ─────────
async function step7_insertClient() {
  console.log('\n========== STEP 7: insert client shell ==========')
  if (!GO) { console.log('  DRY-RUN: would INSERT clients row for slug=walia-family. Pass --go.'); return null }

  const fs = require('node:fs')
  const built = JSON.parse(fs.readFileSync(resolve(OUT_DIR, 'STEP-06-build-slot-prompt.json'), 'utf8'))
  const intake = built.intakePayload

  // Insert shell — status='paused'/subscription_status='paused' until STEP 12 finalize.
  const row = {
    slug: SLUG,
    business_name: BUSINESS_NAME,
    owner_name: OWNER_NAME,
    agent_name: AGENT_NAME,
    agent_voice_id: VOICE_ID,
    niche: NICHE,
    selected_plan: PLAN,
    subscription_status: 'paused',
    status: 'paused',
    callback_phone: CALLBACK_PHONE,
    forwarding_number: CALLBACK_PHONE, // Lite plan, no live transfer — same as callback
    timezone: TIMEZONE,
    business_hours_weekday: intake.business_hours_weekday ?? 'Available anytime',
    business_hours_weekend: intake.business_hours_weekend ?? null,
    after_hours_behavior: 'take_message',
    booking_enabled: false,
    sms_enabled: false,
    knowledge_backend: 'pgvector',
    website_url: WEBSITE_URL,
    website_scrape_status: 'pending',
    system_prompt: built.prompt,
    telegram_notifications_enabled: true,
    email_notifications_enabled: true,
  }
  const { data, error } = await sb.from('clients').insert(row).select('id, slug').single()
  if (error) { console.log(`  ❌ insert failed: ${error.message}`); writeOut(7, 'insert-client-error', { row, error: error.message }); return null }
  console.log(`  ✓ inserted clients row id=${data.id} slug=${data.slug}`)
  writeOut(7, 'insert-client', { client_id: data.id, slug: data.slug, row })
  return data
}

// ───────── STEP 8: create Ultravox agent (DESTRUCTIVE) ─────────
async function step8_createAgent() {
  console.log('\n========== STEP 8: create Ultravox agent ==========')
  if (!GO) { console.log('  DRY-RUN: would call createAgent(). Pass --go.'); return null }

  const fs = require('node:fs')
  const built = JSON.parse(fs.readFileSync(resolve(OUT_DIR, 'STEP-06-build-slot-prompt.json'), 'utf8'))
  const ins = JSON.parse(fs.readFileSync(resolve(OUT_DIR, 'STEP-07-insert-client.json'), 'utf8'))

  const { createAgent } = await import('../src/lib/ultravox.js')

  // Tools rebuilt at STEP 12 via updateAgent after plan + flags are finalized.
  const agentId = await createAgent({
    name: 'riley-aman-walia-family',
    systemPrompt: built.prompt,
    voice: VOICE_ID,
    slug: SLUG,
    niche: NICHE,
    knowledge_backend: 'pgvector',
    knowledge_chunk_count: 0,
  })
  console.log(`  ✓ created Ultravox agent id=${agentId}`)

  const { error: upErr } = await sb.from('clients').update({ ultravox_agent_id: agentId }).eq('id', ins.client_id)
  if (upErr) console.warn(`  ⚠️ failed to persist agent_id: ${upErr.message}`)

  writeOut(8, 'create-agent', { agentId, client_id: ins.client_id, prompt_chars: built.prompt.length, voice: VOICE_ID })
  return { agentId }
}

// ───────── STEP 10: assign Twilio webhook (DESTRUCTIVE) ─────────
async function step10_twilio() {
  console.log('\n========== STEP 10: Twilio webhook assignment ==========')
  if (!GO) { console.log(`  DRY-RUN: would update Twilio ${TWILIO_NUMBER} voice URL. Pass --go.`); return null }

  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')
  const encNumber = encodeURIComponent(TWILIO_NUMBER)
  const list = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/IncomingPhoneNumbers.json?PhoneNumber=${encNumber}`, {
    headers: { Authorization: `Basic ${auth}` },
  })
  const listJson = await list.json() as any
  const number = listJson.incoming_phone_numbers?.[0]
  if (!number?.sid) { console.log(`  ❌ ${TWILIO_NUMBER} not found on account`); writeOut(10, 'twilio-error', listJson); return null }
  const sid = number.sid
  console.log(`  Twilio number SID: ${sid}  (expected ${TWILIO_NUMBER_SID})`)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://endvoicemail.ai'
  const prodBase = appUrl.includes('localhost') ? 'https://endvoicemail.ai' : appUrl
  const updateBody = new URLSearchParams({
    FriendlyName: `${OWNER_NAME} — End Voicemail`,
    VoiceUrl: `${prodBase}/api/webhook/${SLUG}/inbound`,
    VoiceMethod: 'POST',
    VoiceFallbackUrl: `${prodBase}/api/webhook/${SLUG}/fallback`,
    VoiceFallbackMethod: 'POST',
    StatusCallback: `${prodBase}/api/webhook/${SLUG}/voicemail`,
    StatusCallbackMethod: 'POST',
    SmsUrl: `${prodBase}/api/webhook/${SLUG}/sms-inbound`,
    SmsMethod: 'POST',
  })
  const upd = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/IncomingPhoneNumbers/${sid}.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: updateBody.toString(),
  })
  if (!upd.ok) { console.log(`  ❌ Twilio update HTTP ${upd.status}`); writeOut(10, 'twilio-error', await upd.text()); return null }
  const updJson = await upd.json() as any
  console.log(`  ✓ Twilio number configured: ${updJson.friendly_name}`)
  console.log(`    voice_url:    ${updJson.voice_url}`)
  console.log(`    voice_method: ${updJson.voice_method}`)

  const { error: dbErr } = await sb.from('clients').update({ twilio_number: TWILIO_NUMBER }).eq('slug', SLUG)
  if (dbErr) console.warn(`  ⚠️ failed to persist twilio_number: ${dbErr.message}`)
  else console.log(`  ✓ persisted twilio_number on clients row`)

  writeOut(10, 'twilio-assign', { sid, friendly_name: updJson.friendly_name, voice_url: updJson.voice_url, voice_method: updJson.voice_method, status_callback: updJson.status_callback, sms_url: updJson.sms_url })
  return updJson
}

// ───────── STEP 11: Supabase Auth user + client_users link (DESTRUCTIVE) ─────────
async function step11_authUser() {
  console.log('\n========== STEP 11: Supabase Auth user ==========')
  if (!GO) { console.log('  DRY-RUN: would create auth user + client_users row. Pass --go.'); return null }

  const fs = require('node:fs')
  const ins = JSON.parse(fs.readFileSync(resolve(OUT_DIR, 'STEP-07-insert-client.json'), 'utf8'))
  // Secure random temp password (16 chars, mixed). Hasan: use password + Gmail OAuth, NOT magic link.
  const tempPassword = require('node:crypto').randomBytes(12).toString('base64').replace(/[+/=]/g, '').slice(0, 16) + 'A9!'

  const { data: { user }, error } = await sb.auth.admin.createUser({
    email: CONTACT_EMAIL,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { display_name: OWNER_NAME, legal_name: LEGAL_NAME, source: 'concierge-onboard-2026-06-05' },
  })
  if (error || !user) { console.log(`  ❌ createUser failed: ${error?.message}`); writeOut(11, 'auth-error', { error: error?.message }); return null }
  console.log(`  ✓ auth user created: ${user.id} (${user.email})`)

  const { error: cuErr } = await sb.from('client_users').insert({ user_id: user.id, client_id: ins.client_id, role: 'owner' })
  if (cuErr) { console.warn(`  ⚠️ client_users insert failed: ${cuErr.message}`) }
  else console.log(`  ✓ client_users link: ${user.id} → ${ins.client_id} (owner)`)

  writeOut(11, 'auth-user', { user_id: user.id, email: user.email, temp_password: tempPassword, client_id: ins.client_id })
  return { userId: user.id, tempPassword }
}

// ───────── STEP 12: finalize client row (activate) ─────────
async function step12_finalize() {
  console.log('\n========== STEP 12: finalize client (activate) ==========')
  if (!GO) { console.log('  DRY-RUN: would activate walia-family. Pass --go.'); return null }

  const fs = require('node:fs')
  const ins = JSON.parse(fs.readFileSync(resolve(OUT_DIR, 'STEP-07-insert-client.json'), 'utf8'))

  // Founding-member style: status=active, subscription_status=trialing (bypasses
  // plan gating, gives all tools during trial), no Stripe sub_id.
  const updates = {
    status: 'active',
    subscription_status: SUBSCRIPTION_STATUS,
    monthly_minute_limit: MONTHLY_MINUTE_LIMIT,
    effective_monthly_rate: EFFECTIVE_MONTHLY_RATE,
  }
  const { error } = await sb.from('clients').update(updates).eq('id', ins.client_id)
  if (error) { console.log(`  ❌ update failed: ${error.message}`); writeOut(12, 'finalize-error', { error: error.message }); return null }
  console.log(`  ✓ client activated`)

  const { data: c } = await sb.from('clients').select('ultravox_agent_id, agent_voice_id, forwarding_number, transfer_conditions, booking_enabled, sms_enabled, twilio_number, knowledge_backend, selected_plan, subscription_status, niche, slug, system_prompt').eq('id', ins.client_id).single()
  const { count: chunkCount } = await sb.from('knowledge_chunks').select('id', { count: 'exact', head: true }).eq('client_id', ins.client_id).eq('status', 'approved')

  const { updateAgent, buildAgentTools } = await import('../src/lib/ultravox.js')
  const agentFlags: any = {
    systemPrompt: c!.system_prompt,
    voice: c!.agent_voice_id,
    booking_enabled: c!.booking_enabled,
    slug: c!.slug,
    forwarding_number: c!.forwarding_number,
    transfer_conditions: c!.transfer_conditions,
    sms_enabled: c!.sms_enabled,
    twilio_number: c!.twilio_number,
    knowledge_backend: c!.knowledge_backend,
    knowledge_chunk_count: chunkCount ?? 0,
    selectedPlan: c!.selected_plan,
    subscriptionStatus: c!.subscription_status,
    niche: c!.niche,
  }
  await updateAgent(c!.ultravox_agent_id, agentFlags)
  const tools = buildAgentTools(agentFlags)
  await sb.from('clients').update({ tools }).eq('id', ins.client_id)
  console.log(`  ✓ Ultravox agent re-synced with full plan-aware flags`)
  console.log(`    knowledge chunks: ${chunkCount}`)
  console.log(`    tools registered: ${tools.length}`)
  console.log(`    plan:                ${PLAN}`)
  console.log(`    subscription_status: ${SUBSCRIPTION_STATUS} (founding-member, no stripe sub_id)`)
  console.log(`    monthly_minute_limit: ${MONTHLY_MINUTE_LIMIT}`)
  console.log(`    effective_monthly_rate: $${EFFECTIVE_MONTHLY_RATE}/mo`)
  writeOut(12, 'finalize', { client_id: ins.client_id, updates, chunkCount, tools_count: tools.length, agent_flags: { ...agentFlags, systemPrompt: `<${agentFlags.systemPrompt.length} chars>` } })
  return updates
}

// ───────── STEP 14: welcome email PREVIEW (no send) ─────────
async function step14_welcomeEmail() {
  console.log('\n========== STEP 14: welcome email preview ==========')
  const fs = require('node:fs')
  const auth = JSON.parse(fs.readFileSync(resolve(OUT_DIR, 'STEP-11-auth-user.json'), 'utf8'))

  // Telegram registration deep link
  const token = require('node:crypto').randomBytes(16).toString('hex')

  if (GO) {
    const ins = JSON.parse(fs.readFileSync(resolve(OUT_DIR, 'STEP-07-insert-client.json'), 'utf8'))
    await sb.from('clients').update({ telegram_registration_token: token }).eq('id', ins.client_id)
    console.log(`  ✓ persisted telegram_registration_token`)
  } else {
    console.log('  DRY-RUN: would persist telegram_registration_token. Pass --go.')
  }

  const tgBotUsername = process.env.TELEGRAM_BOT_USERNAME ?? 'EndVoicemailBot'
  const tgDeepLink = `https://t.me/${tgBotUsername}?start=${token}`
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL?.includes('localhost') ? 'https://endvoicemail.ai' : process.env.NEXT_PUBLIC_APP_URL) ?? 'https://endvoicemail.ai'

  // Conditional CF codes (no **004* umbrella — Rogers doesn't document it).
  // Twilio number is the destination for all three forwarding scenarios.
  const TWILIO_RAW = TWILIO_NUMBER.replace(/^\+/, '') // 15878728187
  const cfNoAnswer = `*61*${TWILIO_RAW}#`
  const cfBusy = `*67*${TWILIO_RAW}#`
  const cfUnreachable = `*62*${TWILIO_RAW}#`

  const html = `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 24px auto; color: #111; line-height: 1.6;">
<h2 style="margin: 0 0 8px;">Your AI receptionist is live, Aman.</h2>
<p>Your dedicated number is <strong>+1 (587) 872-8187</strong>. Calls to it ring Riley — your 24/7 AI receptionist — and missed calls land in your dashboard with full transcripts. You have <strong>150 free minutes/month</strong> to try it out, no card on file.</p>

<h3 style="margin-top: 24px;">Quick start</h3>
<ol>
  <li><strong>Make a test call</strong> from your phone to <strong>+1 (587) 872-8187</strong>. Riley should answer in 1–2 rings.</li>
  <li><strong>Log in</strong> at <a href="${appUrl}/login">${appUrl}/login</a>:
    <ul style="margin-top: 6px;">
      <li>Email: <code>${CONTACT_EMAIL}</code></li>
      <li>Temporary password: <code>${auth.temp_password}</code></li>
      <li><em>Or click "Sign in with Google" and use this same Gmail — no password needed.</em></li>
    </ul>
  </li>
  <li><strong>Connect Telegram</strong> for instant call alerts on your phone: <a href="${tgDeepLink}">tap here</a> (one-tap setup).</li>
  <li><strong>Forward your phone</strong> to Riley so missed personal calls get answered. On most Canadian carriers (Rogers, Bell, Telus, Fido, Koodo, Virgin, Freedom — all use the same standard), dial each of these once from your cell:
    <ul style="margin-top: 6px;">
      <li><code>${cfNoAnswer}</code> — forwards when you don't pick up</li>
      <li><code>${cfBusy}</code> — forwards when your line is busy</li>
      <li><code>${cfUnreachable}</code> — forwards when your phone is off or has no signal</li>
    </ul>
    <strong>Important:</strong> ask your carrier to fully remove voicemail first (not just pause it). If voicemail is still on, it intercepts the call before Riley can.</li>
</ol>

<h3 style="margin-top: 24px;">What Riley can do</h3>
<ul>
  <li>Take messages from buyers, sellers, and showing requests</li>
  <li>Capture lead info: name, budget, area, timeline</li>
  <li>Triage urgency — flag hot leads to you in real time on Telegram</li>
  <li>Answer FAQs about your services, areas you cover (Calgary, Airdrie, Cochrane, Chestermere, Okotoks, Strathmore, Bragg Creek), and how you work</li>
</ul>

<h3 style="margin-top: 24px;">Make Riley yours</h3>
<p>Anything you want to change — her name, voice, greeting, business hours, FAQs — edit it from <a href="${appUrl}/dashboard/settings">${appUrl}/dashboard/settings</a>. Maya is already taken by another realtor at your office, so we used Riley as a warm gender-neutral default. Change to any name you like.</p>

<h3 style="margin-top: 24px;">What's next</h3>
<p>150 minutes is plenty to see if Riley earns her keep. After 60–90 days, if you're getting value, we'll talk about a paid plan ($15–20/month range). No pressure, no card required to start.</p>

<p style="margin-top: 24px;">Reply to this email or text me directly if anything's off — I'll fix it same day.</p>

<p style="margin-top: 16px;">Hasan</p>

<hr style="margin-top: 32px; border: 0; border-top: 1px solid #eee;">
<p style="font-size: 12px; color: #666; margin-top: 16px;">
  End Voicemail · endvoicemail.ai · Call recording with disclosure to comply with PIPEDA. You can disable recording from your dashboard.
</p>
</body></html>`

  const text = `Your AI receptionist is live, Aman.

Your dedicated number is +1 (587) 872-8187. Calls to it ring Riley — your 24/7 AI receptionist — and missed calls land in your dashboard with full transcripts. You have 150 free minutes/month to try it out, no card on file.

Quick start:

1. Make a test call from your phone to +1 (587) 872-8187. Riley should answer in 1–2 rings.

2. Log in at ${appUrl}/login
   Email: ${CONTACT_EMAIL}
   Temporary password: ${auth.temp_password}
   Or click "Sign in with Google" and use this same Gmail — no password needed.

3. Connect Telegram for instant call alerts on your phone: ${tgDeepLink}

4. Forward your phone to Riley so missed personal calls get answered. On most Canadian carriers (Rogers, Bell, Telus, Fido, Koodo, Virgin, Freedom — all use the same standard), dial each of these once from your cell:
   ${cfNoAnswer}  — forwards when you don't pick up
   ${cfBusy}  — forwards when your line is busy
   ${cfUnreachable}  — forwards when your phone is off or has no signal

   Important: ask your carrier to fully remove voicemail first (not just pause it). If voicemail is still on, it intercepts the call before Riley can.

What Riley can do:
- Take messages from buyers, sellers, and showing requests
- Capture lead info: name, budget, area, timeline
- Triage urgency — flag hot leads to you in real time on Telegram
- Answer FAQs about your services, areas you cover (Calgary, Airdrie, Cochrane, Chestermere, Okotoks, Strathmore, Bragg Creek), and how you work

Make Riley yours:
Anything you want to change — her name, voice, greeting, business hours, FAQs — edit it from ${appUrl}/dashboard/settings. Maya is already taken by another realtor at your office, so we used Riley as a warm gender-neutral default. Change to any name you like.

What's next:
150 minutes is plenty to see if Riley earns her keep. After 60–90 days, if you're getting value, we'll talk about a paid plan ($15–20/month range). No pressure, no card required to start.

Reply to this email or text me directly if anything's off — I'll fix it same day.

Hasan

—
End Voicemail · endvoicemail.ai
Call recording with disclosure to comply with PIPEDA. You can disable recording from your dashboard.`

  const previewPath = resolve(OUT_DIR, 'STEP-14-welcome-email-preview.html')
  require('node:fs').writeFileSync(previewPath, html)
  const textPath = resolve(OUT_DIR, 'STEP-14-welcome-email-preview.txt')
  require('node:fs').writeFileSync(textPath, text)

  console.log(`  📧 HTML preview:  ${previewPath}`)
  console.log(`  📄 Text preview:  ${textPath}`)
  console.log(`  🔗 Telegram deep link: ${tgDeepLink}`)
  console.log(`  ⚠️  NOT SENT — Hasan reviews + sends to Aman manually`)
  writeOut(14, 'welcome-email-preview', { to: CONTACT_EMAIL, subject: "Your AI receptionist is live, Aman.", telegram_deep_link: tgDeepLink, html_path: previewPath, text_path: textPath })
  return { html, text, tgDeepLink }
}

// ───────── main dispatcher ─────────
async function main() {
  const steps: Array<[number, string, () => Promise<unknown>]> = [
    [6, 'build-slot-prompt', step6_buildSlotPrompt],
    [7, 'insert-client', step7_insertClient],
    [8, 'create-agent', step8_createAgent],
    [10, 'twilio-assign', step10_twilio],
    [11, 'auth-user', step11_authUser],
    [12, 'finalize', step12_finalize],
    [14, 'welcome-email', step14_welcomeEmail],
  ]
  if (STEP === null) {
    console.log('Usage: --step=N [--go]')
    console.log('Available steps:')
    for (const [n, label] of steps) console.log(`  ${n}  ${label}`)
    return
  }
  const target = steps.find(s => s[0] === STEP)
  if (!target) {
    console.error(`Step ${STEP} not implemented (or invalid)`)
    process.exit(1)
  }
  await target[2]()
}

main().catch(e => { console.error(e); process.exit(2) })
