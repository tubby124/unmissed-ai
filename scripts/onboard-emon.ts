/**
 * onboard-emon.ts — manual provisioning trace for Mohammad Emon (KO Realty, Calgary).
 *
 * Drives the same code paths the live /onboard wizard uses, but inline so we can
 * inspect each step's output before continuing. Pause-after-each: each step writes
 * its output to CALLINGAGENTS/00-Inbox/onboard-emon-trace/STEP-N.json so the
 * operator can review before approving the next.
 *
 * Modes:
 *   --step=N       Run only step N (1-based)
 *   --step=N --go  Same step, but commit destructive side effects (DB writes, UV calls, Twilio writes)
 *   --from=N       Run steps N..LAST in sequence (auto-pauses unless --auto)
 *   --auto         Run without prompting between steps
 *
 * Step list:
 *   0  Inventory + hard-delete current emon (DESTRUCTIVE)
 *   1  places-lookup        (Google Places search for "Mohammad Emon KO Realty Calgary")
 *   2  places-details       (Place details for the matched place_id)
 *   3  autofill             (Sonar-powered website autofill for mohammademon.ca)
 *   4  scrape-preview       (Full website scrape + knowledge extraction preview)
 *   5  generate-agent-intelligence  (TRIAGE_DEEP + GREETING + URGENCY + FORBIDDEN_EXTRA)
 *   6  build-slot-prompt    (buildPromptFromIntake → 19-slot system_prompt)
 *   7  knowledge-seed       (seedKnowledgeFromScrape → knowledge_chunks rows)
 *   8  ultravox-create      (createAgent → new ultravox_agent_id)
 *   9  twilio-assign        (set voice URL on +15873275902 → /api/webhook/emon/inbound)
 *  10  auth-user            (Supabase Auth: realtormoyyc@gmail.com + client_users row)
 *  11  client-row-finalize  (status='active', plan='core', mins=75, $10/mo, custom concierge)
 *  12  validator-run        (provisioning-completeness-check.ts on emon)
 *  13  welcome-email        (sendBrandedEmail → Mohammad's inbox)
 *
 * Output dir: CALLINGAGENTS/00-Inbox/onboard-emon-trace/
 */

import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const OUT_DIR = resolve('CALLINGAGENTS/00-Inbox/onboard-emon-trace')
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

function writeOut(stepNum: number, label: string, data: unknown) {
  const path = resolve(OUT_DIR, `STEP-${String(stepNum).padStart(2, '0')}-${label}.json`)
  writeFileSync(path, JSON.stringify(data, null, 2))
  console.log(`\n📝 Wrote ${path}`)
}

// ───────── STEP 0: hard-delete current emon ─────────
async function step0_delete() {
  console.log('\n========== STEP 0: hard-delete emon ==========')
  const { data: c } = await sb.from('clients').select('id, ultravox_agent_id').eq('slug','emon').maybeSingle()
  const out: any = { found: !!c, deletions: {} }
  if (!c) {
    console.log('emon not in clients — nothing to delete')
    writeOut(0, 'delete', out)
    return out
  }
  const id = c.id
  out.client_id = id
  out.ultravox_agent_id = c.ultravox_agent_id

  if (!GO) {
    console.log(`DRY-RUN: would delete client_id=${id}, UV agent=${c.ultravox_agent_id}`)
    console.log('  Rerun with --go to execute.')
    writeOut(0, 'delete-dryrun', out)
    return out
  }

  // 1. Delete Ultravox agent
  if (c.ultravox_agent_id) {
    const r = await fetch(`https://api.ultravox.ai/api/agents/${c.ultravox_agent_id}`, {
      method: 'DELETE', headers: { 'X-API-Key': ULTRAVOX_API_KEY },
    })
    out.deletions.ultravox = { status: r.status, ok: r.ok }
    console.log(`  Ultravox DELETE /agents/${c.ultravox_agent_id} → ${r.status}`)
  }

  // 2. Break self-FK so prompt_versions can be deleted
  await sb.from('clients').update({ active_prompt_version_id: null }).eq('id', id)

  // 3. Delete child tables (order matters for FKs)
  const childTables = ['knowledge_chunks','call_logs','client_users','prompt_versions','intake_submissions']
  for (const t of childTables) {
    const { error, count } = await sb.from(t).delete({ count: 'exact' }).eq('client_id', id)
    out.deletions[t] = error ? { error: error.message } : { rows: count ?? 0 }
    console.log(`  ${t}: ${error ? 'ERROR ' + error.message : (count ?? 0) + ' rows'}`)
  }

  // 4. Delete client row
  const { error: ce } = await sb.from('clients').delete().eq('id', id)
  out.deletions.clients = ce ? { error: ce.message } : { rows: 1 }
  console.log(`  clients: ${ce ? 'ERROR ' + ce.message : 'deleted'}`)

  // 5. Delete auth user (emon@gmail.com — the placeholder)
  const { data: { users } } = await sb.auth.admin.listUsers()
  const placeholder = (users ?? []).find(u => u.email === 'emon@gmail.com')
  if (placeholder) {
    const { error: ae } = await sb.auth.admin.deleteUser(placeholder.id)
    out.deletions.auth_user = ae ? { error: ae.message } : { user_id: placeholder.id, email: placeholder.email }
    console.log(`  auth.users (emon@gmail.com): ${ae ? 'ERROR ' + ae.message : 'deleted'}`)
  }

  writeOut(0, 'delete', out)
  return out
}

// ───────── STEP 1: places-lookup ─────────
async function step1_placesLookup() {
  console.log('\n========== STEP 1: places-lookup ==========')
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    const out = { available: false, error: 'GOOGLE_PLACES_API_KEY not set in .env.local' }
    console.log('  ❌ ' + out.error)
    writeOut(1, 'places-lookup', out)
    return out
  }
  const q = 'Mohammad Emon KO Realty Calgary'
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${apiKey}`
  const r = await fetch(url)
  const data = await r.json() as any
  const out = { query: q, status: data.status, results: (data.results ?? []).slice(0, 5).map((p:any) => ({ name: p.name, address: p.formatted_address, place_id: p.place_id, types: p.types })) }
  console.log(`  status=${data.status} results=${out.results.length}`)
  for (const p of out.results) console.log(`    · ${p.name} — ${p.address}`)
  writeOut(1, 'places-lookup', out)
  return out
}

// ───────── STEP 2: places-details ─────────
async function step2_placesDetails() {
  console.log('\n========== STEP 2: places-details ==========')
  const lookup = JSON.parse(require('node:fs').readFileSync(resolve(OUT_DIR, 'STEP-01-places-lookup.json'), 'utf8'))
  const place_id = lookup.results?.[0]?.place_id
  if (!place_id) { console.log('  ❌ no place_id from STEP 1'); return null }
  const apiKey = process.env.GOOGLE_PLACES_API_KEY!
  const params = new URLSearchParams({
    place_id,
    fields: 'name,formatted_address,formatted_phone_number,website,opening_hours,rating,user_ratings_total,photos,business_status,types,editorial_summary',
    key: apiKey,
  })
  const url = `https://maps.googleapis.com/maps/api/place/details/json?${params}`
  const r = await fetch(url)
  const data = await r.json() as any
  const x = data.result ?? {}
  const out = {
    name: x.name,
    address: x.formatted_address,
    phone: x.formatted_phone_number,
    website: x.website,
    rating: x.rating,
    ratings_total: x.user_ratings_total,
    business_status: x.business_status,
    hours_weekday: x.opening_hours?.weekday_text ?? null,
    editorial_summary: x.editorial_summary?.overview ?? null,
    types: x.types,
  }
  console.log(`  name:    ${out.name}`)
  console.log(`  phone:   ${out.phone}`)
  console.log(`  website: ${out.website}`)
  console.log(`  rating:  ${out.rating} (${out.ratings_total} reviews)`)
  console.log(`  hours:   ${(out.hours_weekday ?? []).join(' | ')}`)
  writeOut(2, 'places-details', out)
  return out
}

// ───────── STEP 3: autofill (Sonar) ─────────
async function step3_autofill() {
  console.log('\n========== STEP 3: autofill via Sonar ==========')
  const details = JSON.parse(require('node:fs').readFileSync(resolve(OUT_DIR, 'STEP-02-places-details.json'), 'utf8'))
  const websiteUrl = details.website ?? 'http://mohammademon.ca/'
  console.log(`  scraping via OpenRouter/Sonar: ${websiteUrl}`)
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) { console.log('  ❌ OPENROUTER_API_KEY not set'); return null }
  const prompt = `Extract business info from ${websiteUrl}. Return STRICT JSON only (no prose, no markdown). Schema:
{
  "businessName": "...",
  "agentDesignation": "...",
  "hours": "Mon-Sat 8am-8pm, Sun by appointment",
  "phone": "...",
  "email": "...",
  "services": ["service 1", "service 2", ...],
  "specialties": ["first-time buyers", "seniors", ...],
  "serviceAreas": ["Calgary", "Airdrie", ...],
  "languages": ["English", "Bengali", ...],
  "uniqueValueProps": ["..."],
  "faqs": [{"question": "...", "answer": "..."}]
}
Use null for missing fields. Never invent — only extract clearly stated content. Output the JSON object only.`
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'perplexity/sonar',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) { console.log(`  ❌ Sonar HTTP ${res.status}: ${await res.text().catch(()=>'')}`); return null }
  const data = await res.json() as any
  const content: string = data.choices?.[0]?.message?.content ?? ''
  // Strip markdown code fences if present
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, content]
  let parsed: any = {}
  try { parsed = JSON.parse(jsonMatch[1] ?? content) } catch (e:any) {
    console.log(`  ⚠️ JSON parse failed — saving raw text instead`)
    writeOut(3, 'autofill-raw', { websiteUrl, raw: content, parseError: e.message })
    return { raw: content }
  }
  console.log(`  businessName:  ${parsed.businessName ?? '(none)'}`)
  console.log(`  designation:   ${parsed.agentDesignation ?? '(none)'}`)
  console.log(`  hours:         ${parsed.hours ?? '(none)'}`)
  console.log(`  services:      ${(parsed.services ?? []).length} items`)
  console.log(`  specialties:   ${(parsed.specialties ?? []).join(', ') || '(none)'}`)
  console.log(`  serviceAreas:  ${(parsed.serviceAreas ?? []).join(', ') || '(none)'}`)
  console.log(`  languages:     ${(parsed.languages ?? []).join(', ') || '(none)'}`)
  console.log(`  faqs:          ${(parsed.faqs ?? []).length}`)
  writeOut(3, 'autofill', { websiteUrl, ...parsed })
  return parsed
}

// ───────── STEP 4: scrape-preview ─────────
async function step4_scrapePreview() {
  console.log('\n========== STEP 4: scrape-preview ==========')
  const details = JSON.parse(require('node:fs').readFileSync(resolve(OUT_DIR, 'STEP-02-places-details.json'), 'utf8'))
  const websiteUrl = details.website ?? 'http://mohammademon.ca/'
  // Call the scrape via the in-repo library directly (matches the prod API path)
  const { scrapeWebsite } = await import('../src/lib/website-scraper.js')
  const { normalizeExtraction } = await import('../src/lib/knowledge-extractor.js')
  console.log(`  scraping: ${websiteUrl}`)
  try {
    const scraped: any = await scrapeWebsite(websiteUrl, 'real_estate')
    // normalizeExtraction(rawFacts, rawQa, rawServiceTags, rawWarnings)
    // normalizeExtraction returns { result: NormalizedKnowledge, stats }
    // where NormalizedKnowledge has businessFacts/extraQa/serviceTags/warnings
    const rawQa = (scraped.extraQa ?? scraped.qa ?? []).map((p: any) => ({
      q: p.q ?? p.question ?? '',
      a: p.a ?? p.answer ?? '',
    }))
    const normRes = normalizeExtraction(
      scraped.businessFacts ?? scraped.facts ?? [],
      rawQa,
      scraped.serviceTags ?? scraped.tags ?? [],
      scraped.warnings ?? [],
    )
    const normalized = normRes.result
    console.log(`  facts (post-normalize): ${normalized.businessFacts?.length ?? 0}`)
    console.log(`  qas   (post-normalize): ${normalized.extraQa?.length ?? 0}`)
    console.log(`  tags  (post-normalize): ${normalized.serviceTags?.length ?? 0}`)
    console.log(`  warnings:               ${normalized.warnings?.length ?? 0}`)
    writeOut(4, 'scrape-preview', { websiteUrl, scraped, normalized })
    return normalized
  } catch (e: any) {
    console.log(`  ❌ scrape failed: ${e.message}`)
    writeOut(4, 'scrape-preview-error', { websiteUrl, error: e.message, stack: e.stack })
    return null
  }
}

// ───────── STEP 5: generate-agent-intelligence ─────────
async function step5_agentIntelligence() {
  console.log('\n========== STEP 5: generate-agent-intelligence ==========')
  const details = JSON.parse(require('node:fs').readFileSync(resolve(OUT_DIR, 'STEP-02-places-details.json'), 'utf8'))
  const autofill = JSON.parse(require('node:fs').readFileSync(resolve(OUT_DIR, 'STEP-03-autofill.json'), 'utf8'))
  let scrape: any = null
  try { scrape = JSON.parse(require('node:fs').readFileSync(resolve(OUT_DIR, 'STEP-04-scrape-preview.json'), 'utf8')) } catch {}

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) { console.log('  ❌ OPENROUTER_API_KEY not set'); return null }

  const payload = {
    businessName: 'Mohammad Emon — KO Realty',
    niche: 'real_estate',
    agentName: 'Maya',
    ownerName: 'Mohammad Emon',
    city: 'Calgary',
    services: Array.isArray(autofill.services) ? autofill.services : (typeof autofill.services === 'string' ? autofill.services.split(',').map((s:string)=>s.trim()) : []),
    callerReasons: ['showing request','open house inquiry','CMA/home valuation','listing question','buyer pre-approval question','property condition question'],
    hours: autofill.hours,
    websiteFacts: scrape?.facts ?? [],
    websiteQa: (scrape?.qas ?? []).map((q:any) => ({ q: q.question, a: q.answer })),
    selectedPlan: 'core',
    calendarEnabled: false,
  }

  // Use Sonar to generate the agent intelligence — same prompt pattern as the API route uses
  const prompt = `You generate a voice-agent "intelligence seed" for a real estate business. Output ONLY valid JSON with these keys:
- triageDeep: object with intent_buckets[] each having { name, signals[], routing }, plus outcomes[]
- greetingLine: a one-sentence greeting the agent uses to open the call (warm, professional, includes business name + agent name)
- urgencyKeywords: array of 4-8 trigger phrases that escalate priority
- forbiddenExtra: array of 3-6 things the agent should NEVER do for this niche

Business: ${JSON.stringify(payload, null, 2)}

Return JSON only.`

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'perplexity/sonar',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) { console.log(`  ❌ Sonar HTTP ${res.status}`); return null }
  const data = await res.json() as any
  const content: string = data.choices?.[0]?.message?.content ?? ''
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, content]
  let parsed: any = {}
  try { parsed = JSON.parse(jsonMatch[1] ?? content) } catch (e: any) {
    console.log(`  ⚠️ JSON parse failed — saving raw response`)
    writeOut(5, 'agent-intelligence-raw', { payload, raw: content, parseError: e.message })
    return { raw: content }
  }
  console.log(`  greetingLine:    ${parsed.greetingLine ?? '(none)'}`)
  console.log(`  intent_buckets:  ${(parsed.triageDeep?.intent_buckets ?? []).length}`)
  console.log(`  urgencyKeywords: ${(parsed.urgencyKeywords ?? []).length}`)
  console.log(`  forbiddenExtra:  ${(parsed.forbiddenExtra ?? []).length}`)
  writeOut(5, 'agent-intelligence', { payload, intelligence: parsed })
  return parsed
}

// ───────── STEP 6: build slot prompt ─────────
async function step6_buildSlotPrompt() {
  console.log('\n========== STEP 6: build 19-slot prompt ==========')
  const fs = require('node:fs')
  const details = JSON.parse(fs.readFileSync(resolve(OUT_DIR, 'STEP-02-places-details.json'), 'utf8'))
  const autofill = JSON.parse(fs.readFileSync(resolve(OUT_DIR, 'STEP-03-autofill.json'), 'utf8'))
  const scrape = JSON.parse(fs.readFileSync(resolve(OUT_DIR, 'STEP-04-scrape-preview.json'), 'utf8'))
  const intel = JSON.parse(fs.readFileSync(resolve(OUT_DIR, 'STEP-05-agent-intelligence.json'), 'utf8'))
  const intelligence = intel.intelligence ?? {}

  // Pronunciation rule — Llama tendency is to spell out abbreviations ("N-W" instead of
  // "northwest"). Kept TIGHT (single line) — pads forbidden_actions only ~120 chars.
  const pronunciationRule = "Say 'northwest' (not N-W), 'northeast' (not N-E), 'southwest' (not S-W), 'southeast' (not S-E). Read neighborhood names as words."

  // Build a synthetic OnboardingData that toIntakePayload understands
  const data: any = {
    niche: 'real_estate',
    businessName: 'Mohammad Emon — KO Realty',
    streetAddress: '301 14 St NW Suite 206, Room 8',
    city: 'Calgary',
    state: 'AB',
    agentName: 'Maya',
    callbackPhone: '+14038884268',
    ownerName: 'Mohammad Emon',
    contactEmail: 'realtormoyyc@gmail.com',
    websiteUrl: 'http://www.mohammademon.ca/',
    placeId: 'ChIJF79rBHnVL08Ri2egOrCHtBM',
    placesPhotoUrl: '',
    placesRating: 5,
    placesReviewCount: 1,
    gbpDescription: 'Mohammad Emon | KO Realty | Calgary REALTOR® specializing in helping families, first-time buyers, seniors downsizing, and investors buy or sell homes. SRES® certified. Fluent in English, Bengali, Hindi, and Urdu.',
    // Inject pronunciation rule via nicheCustomVariables (concise, single-line).
    // Skip the full agentIntelligenceSeed — Sonar's 6-bucket version inflates
    // conversation_flow past the 21K cap. Niche defaults + a focused
    // pronunciation rule give a tighter, working prompt (Velly/Brian pattern).
    nicheCustomVariables: {
      FORBIDDEN_EXTRA: pronunciationRule,
    },
    // agentIntelligenceSeed intentionally omitted to keep prompt < 21K cap.
    // Custom intent buckets get re-added at runtime via knowledge tool + niche defaults.
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
    notificationEmail: 'realtormoyyc@gmail.com',
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
    // Keep prompt slim — businessFacts go to KB via STEP 7 (seedKnowledgeFromScrape).
    // Only put a short summary in business_notes; the agent reads queryKnowledge at runtime.
    businessNotes: 'Mohammad Emon is a Calgary REALTOR® at KO Realty (SRES® certified). He helps families, first-time buyers, seniors downsizing, and investors across Calgary, Airdrie, Cochrane, Chestermere, Okotoks. Fluent in English, Bengali, Hindi, and Urdu.',
    commonObjections: [],
    voiceId: 'df0b14d7-945f-41b2-989a-7c8c57688ddf',
    voiceName: 'Ashley',
    callHandlingMode: 'triage',
    // FAQs go to pgvector at STEP 7 — keep prompt slim. Empty here.
    faqPairs: [],
    knowledgeDocs: [],
    timezone: 'America/Edmonton',
    websiteScrapeResult: scrape.scraped ? {
      businessFacts: scrape.scraped.businessFacts ?? [],
      extraQa: scrape.scraped.extraQa ?? [],
      serviceTags: scrape.scraped.serviceTags ?? [],
      warnings: scrape.scraped.warnings ?? [],
      scrapedAt: new Date().toISOString(),
      scrapedUrl: 'http://www.mohammademon.ca/',
      approvedFacts: (scrape.scraped.businessFacts ?? []).map(() => true),
      approvedQa: (scrape.scraped.extraQa ?? []).map(() => true),
      contextData: scrape.scraped.contextData ?? null,
    } : null,
    ivrEnabled: false,
    ivrPrompt: '',
    scheduleMode: '24_7',
    callForwardingEnabled: true,
    agentJob: 'receptionist',
    recordingConsentAcknowledged: true,
    selectedPlan: 'core',
    agentMode: 'lead_capture',
    selectedServices: scrape.normalized?.serviceTags ?? scrape.scraped?.serviceTags ?? [],
    // callerReasons + urgencyWords intentionally dropped — niche defaults handle
    // these; passing them inflates conversation_flow past 21K hard cap.
    callerReasons: [],
    urgencyWords: '',
    priceRange: '',
    manualDescription: 'Mohammad Emon is a Bangladeshi-Canadian REALTOR® and SRES® at KO Realty in Calgary. He serves families, first-time buyers, seniors (downsizing/estate sales), and investors across Calgary and surrounding communities. Fluent in English, Bengali, Hindi, and Urdu.',
    businessAddress: '301 14 St NW Suite 206, Room 8, Calgary, AB T2N 2A1',
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
  if (!GO) { console.log('  DRY-RUN: would INSERT clients row for slug=emon. Pass --go to execute.'); return null }

  const fs = require('node:fs')
  const built = JSON.parse(fs.readFileSync(resolve(OUT_DIR, 'STEP-06-build-slot-prompt.json'), 'utf8'))
  const intake = built.intakePayload

  // Insert minimal shell — activation happens at STEP 12 after agent + Twilio + auth are wired.
  // status='paused' until everything verified.
  const row = {
    slug: 'emon',
    business_name: 'Mohammad Emon — KO Realty',
    owner_name: 'Mohammad Emon',
    agent_name: 'Maya',
    agent_voice_id: 'df0b14d7-945f-41b2-989a-7c8c57688ddf',
    niche: 'real_estate',
    selected_plan: 'core',
    subscription_status: 'paused',
    status: 'paused',
    callback_phone: '+14038884268',
    forwarding_number: '+14038884268',
    timezone: 'America/Edmonton',
    business_hours_weekday: intake.business_hours_weekday ?? 'Available anytime',
    business_hours_weekend: intake.business_hours_weekend ?? null,
    after_hours_behavior: 'take_message',
    booking_enabled: false,
    sms_enabled: false,
    knowledge_backend: 'pgvector',
    website_url: 'http://www.mohammademon.ca/',
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

  // createAgent internally calls buildAgentTools — DON'T pre-build tools or they double up.
  // Pass minimal flags here; STEP 12 finalize re-syncs tools with full plan-aware flags via updateAgent.
  const agentId = await createAgent({
    name: 'maya-mohammad-emon-ko-realty',
    systemPrompt: built.prompt,
    voice: 'df0b14d7-945f-41b2-989a-7c8c57688ddf',
    slug: 'emon',
    niche: 'real_estate',
    knowledge_backend: 'pgvector',
    knowledge_chunk_count: 0, // will be > 0 after STEP 9; updateAgent rebuilds tools at STEP 12
  })
  console.log(`  ✓ created Ultravox agent id=${agentId}`)

  const { error: upErr } = await sb.from('clients').update({ ultravox_agent_id: agentId }).eq('id', ins.client_id)
  if (upErr) console.warn(`  ⚠️ failed to persist agent_id: ${upErr.message}`)

  writeOut(8, 'create-agent', { agentId, client_id: ins.client_id, prompt_chars: built.prompt.length, voice: 'df0b14d7-945f-41b2-989a-7c8c57688ddf' })
  return { agentId }
}

// ───────── STEP 9: seed knowledge_chunks (DESTRUCTIVE) ─────────
async function step9_seedKnowledge() {
  console.log('\n========== STEP 9: seed knowledge chunks ==========')
  if (!GO) { console.log('  DRY-RUN: would seed pgvector from STEP-04 scrape. Pass --go.'); return null }

  const fs = require('node:fs')
  const scrape = JSON.parse(fs.readFileSync(resolve(OUT_DIR, 'STEP-04-scrape-preview.json'), 'utf8'))
  const ins = JSON.parse(fs.readFileSync(resolve(OUT_DIR, 'STEP-07-insert-client.json'), 'utf8'))

  const { seedKnowledgeFromScrape } = await import('../src/lib/seed-knowledge.js')
  const businessFacts: string[] = scrape.scraped?.businessFacts ?? []
  const extraQa: any[] = scrape.scraped?.extraQa ?? []
  const serviceTags: string[] = scrape.scraped?.serviceTags ?? []

  try {
    const result = await seedKnowledgeFromScrape(sb as any, {
      clientId: ins.client_id,
      clientSlug: 'emon',
      approvedPackage: { businessFacts, extraQa: extraQa.map(p => ({ q: p.q ?? p.question, a: p.a ?? p.answer })), serviceTags },
      runId: `onboard-emon-trace-${Date.now()}`,
      routeLabel: 'onboard-emon-trace',
      chunkStatus: 'approved',
      trustTier: 'medium',
      sourceUrl: 'http://www.mohammademon.ca/',
    } as any)
    console.log(`  ✓ seeded: stored=${result.stored} chunks=${result.chunkCount} failed=${result.failed}`)
    if ((result.errors ?? []).length) console.log(`  errors: ${result.errors.join(', ')}`)
    await sb.from('clients').update({ website_scrape_status: 'approved' }).eq('id', ins.client_id)
    writeOut(9, 'seed-knowledge', { client_id: ins.client_id, result, inputs: { facts: businessFacts.length, qa: extraQa.length, tags: serviceTags.length } })
    return result
  } catch (e: any) {
    console.log(`  ❌ seed failed: ${e.message}`)
    writeOut(9, 'seed-knowledge-error', { error: e.message, stack: e.stack })
    return null
  }
}

// ───────── STEP 10: assign Twilio webhook (DESTRUCTIVE) ─────────
async function step10_twilio() {
  console.log('\n========== STEP 10: Twilio webhook assignment ==========')
  if (!GO) { console.log('  DRY-RUN: would update Twilio +15873275902 voice URL. Pass --go.'); return null }

  // Find the IncomingPhoneNumber SID for +15873275902
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')
  const list = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/IncomingPhoneNumbers.json?PhoneNumber=%2B15873275902`, {
    headers: { Authorization: `Basic ${auth}` },
  })
  const listJson = await list.json() as any
  const number = listJson.incoming_phone_numbers?.[0]
  if (!number?.sid) { console.log('  ❌ +15873275902 not found on account'); writeOut(10, 'twilio-error', listJson); return null }
  const sid = number.sid
  console.log(`  Twilio number SID: ${sid}`)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://endvoicemail.ai'
  // Production app URL (not localhost — this is a live Twilio webhook)
  const prodBase = appUrl.includes('localhost') ? 'https://endvoicemail.ai' : appUrl
  const updateBody = new URLSearchParams({
    FriendlyName: 'Mohammad Emon — End Voicemail',
    VoiceUrl: `${prodBase}/api/webhook/emon/inbound`,
    VoiceMethod: 'POST',
    VoiceFallbackUrl: `${prodBase}/api/webhook/emon/fallback`,
    VoiceFallbackMethod: 'POST',
    StatusCallback: `${prodBase}/api/webhook/emon/voicemail`,
    StatusCallbackMethod: 'POST',
    SmsUrl: `${prodBase}/api/webhook/emon/sms-inbound`,
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

  // Persist twilio_number on clients row — STEP 7 left it null. Without this, runtime
  // tool gating (sms tool) + admin dashboard both lose track of the assigned number.
  const { error: dbErr } = await sb.from('clients').update({ twilio_number: '+15873275902' }).eq('slug', 'emon')
  if (dbErr) console.warn(`  ⚠️ failed to persist twilio_number on clients row: ${dbErr.message}`)
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
  // Generate a secure random temp password (16 chars, mixed)
  const tempPassword = require('node:crypto').randomBytes(12).toString('base64').replace(/[+/=]/g, '').slice(0, 16) + 'A9!'

  const { data: { user }, error } = await sb.auth.admin.createUser({
    email: 'realtormoyyc@gmail.com',
    password: tempPassword,
    email_confirm: true,
    user_metadata: { display_name: 'Mohammad Emon', source: 'concierge-onboard-2026-05-21' },
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
  if (!GO) { console.log('  DRY-RUN: would activate emon. Pass --go.'); return null }

  const fs = require('node:fs')
  const ins = JSON.parse(fs.readFileSync(resolve(OUT_DIR, 'STEP-07-insert-client.json'), 'utf8'))

  // Velly-style concierge: status='active', subscription_status='active', no stripe_subscription_id
  const updates = {
    status: 'active',
    subscription_status: 'active',
    monthly_minute_limit: 75,
    effective_monthly_rate: 10,
  }
  const { error } = await sb.from('clients').update(updates).eq('id', ins.client_id)
  if (error) { console.log(`  ❌ update failed: ${error.message}`); writeOut(12, 'finalize-error', { error: error.message }); return null }
  console.log(`  ✓ client activated`)

  // Re-sync Ultravox agent tools now that plan + knowledge chunks are in place
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
  console.log(`    plan:                core`)
  console.log(`    subscription_status: active (concierge, no stripe sub_id)`)
  console.log(`    monthly_minute_limit: 75`)
  console.log(`    effective_monthly_rate: $10/mo`)
  writeOut(12, 'finalize', { client_id: ins.client_id, updates, chunkCount, tools_count: tools.length, agent_flags: { ...agentFlags, systemPrompt: `<${agentFlags.systemPrompt.length} chars>` } })
  return updates
}

// ───────── STEP 14: render welcome email PREVIEW (no send) ─────────
async function step14_welcomeEmail() {
  console.log('\n========== STEP 14: welcome email preview ==========')
  const fs = require('node:fs')
  const auth = JSON.parse(fs.readFileSync(resolve(OUT_DIR, 'STEP-11-auth-user.json'), 'utf8'))

  // Generate a Telegram registration deep link using a fresh token
  const token = require('node:crypto').randomBytes(16).toString('hex')

  if (GO) {
    // Persist the telegram_registration_token on the clients row so Emon's first /start TOKEN works
    const ins = JSON.parse(fs.readFileSync(resolve(OUT_DIR, 'STEP-07-insert-client.json'), 'utf8'))
    await sb.from('clients').update({ telegram_registration_token: token }).eq('id', ins.client_id)
    console.log(`  ✓ persisted telegram_registration_token`)
  } else {
    console.log('  DRY-RUN: would persist telegram_registration_token. Pass --go.')
  }

  const tgBotUsername = process.env.TELEGRAM_BOT_USERNAME ?? 'EndVoicemailBot'
  const tgDeepLink = `https://t.me/${tgBotUsername}?start=${token}`
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL?.includes('localhost') ? 'https://endvoicemail.ai' : process.env.NEXT_PUBLIC_APP_URL) ?? 'https://endvoicemail.ai'

  const html = `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 580px; margin: 24px auto; color: #111; line-height: 1.55;">
<h2 style="margin: 0 0 8px;">Your AI receptionist is live, Mohammad.</h2>
<p>Your dedicated number is <strong>+1 587 327 5902</strong>. Calls to it ring Maya — your 24/7 AI receptionist — and missed calls land in your dashboard with full transcripts.</p>

<h3 style="margin-top: 24px;">Quick start</h3>
<ol>
  <li><strong>Make a test call</strong> from your phone to <strong>+1 587 327 5902</strong>. Maya should answer in 1–2 rings.</li>
  <li><strong>Log in</strong> to your dashboard: <a href="${appUrl}/login">${appUrl}/login</a>
    <br>Email: <code>realtormoyyc@gmail.com</code>
    <br>Temporary password: <code>${auth.temp_password}</code>
    <br><em>Change this on first login.</em></li>
  <li><strong>Connect Telegram</strong> for instant call alerts on your phone: <a href="${tgDeepLink}">tap here</a> (one-tap setup).</li>
  <li><strong>Forward your phone</strong> to Maya so missed personal calls get answered. The dashboard has a carrier-specific guide once you log in. Most Canadian carriers use <code>**21*15873275902#</code> (always forward) or <code>*72 1 587 327 5902</code>.</li>
</ol>

<h3 style="margin-top: 24px;">What Maya can do for you</h3>
<ul>
  <li>Take messages from buyers, sellers, and showing requests</li>
  <li>Capture lead info: name, budget, area, timeline</li>
  <li>Triage urgency — flag hot leads to you in real time</li>
  <li>Answer FAQs about your services, areas, and how you work</li>
</ul>

<p style="margin-top: 24px;">Anything you want Maya to say differently — her name, greeting, what she focuses on — edit it from your dashboard. Reply to this email if you hit a snag.</p>

<hr style="margin-top: 32px; border: 0; border-top: 1px solid #eee;">
<p style="font-size: 12px; color: #666; margin-top: 16px;">
  End Voicemail · endvoicemail.ai · This setup includes call recording with disclosure to comply with PIPEDA. You can disable recording from your dashboard.
</p>
</body></html>`

  const text = `Your AI receptionist is live, Mohammad.

Your dedicated number is +1 587 327 5902. Calls to it ring Maya — your 24/7 AI receptionist — and missed calls land in your dashboard with full transcripts.

Quick start:

1. Make a test call from your phone to +1 587 327 5902. Maya should answer in 1–2 rings.

2. Log in to your dashboard: ${appUrl}/login
   Email: realtormoyyc@gmail.com
   Temporary password: ${auth.temp_password}
   Change this on first login.

3. Connect Telegram for instant call alerts on your phone: ${tgDeepLink}

4. Forward your phone to Maya so missed personal calls get answered. The dashboard has a carrier-specific guide once you log in. Most Canadian carriers use **21*15873275902# (always forward) or *72 1 587 327 5902.

What Maya can do for you:
- Take messages from buyers, sellers, and showing requests
- Capture lead info: name, budget, area, timeline
- Triage urgency — flag hot leads to you in real time
- Answer FAQs about your services, areas, and how you work

Anything you want Maya to say differently — her name, greeting, what she focuses on — edit it from your dashboard. Reply to this email if you hit a snag.

—
End Voicemail · endvoicemail.ai
This setup includes call recording with disclosure to comply with PIPEDA. You can disable recording from your dashboard.`

  const previewPath = resolve(OUT_DIR, 'STEP-14-welcome-email-preview.html')
  require('node:fs').writeFileSync(previewPath, html)
  const textPath = resolve(OUT_DIR, 'STEP-14-welcome-email-preview.txt')
  require('node:fs').writeFileSync(textPath, text)

  console.log(`  📧 HTML preview:  ${previewPath}`)
  console.log(`  📄 Text preview:  ${textPath}`)
  console.log(`  🔗 Telegram deep link: ${tgDeepLink}`)
  console.log(`  ⚠️  NOT SENT — Hasan reviews + sends manually`)
  writeOut(14, 'welcome-email-preview', { to: 'realtormoyyc@gmail.com', subject: "Your AI receptionist is live, Mohammad.", telegram_deep_link: tgDeepLink, html_path: previewPath, text_path: textPath })
  return { html, text, tgDeepLink }
}

// ───────── main dispatcher ─────────
async function main() {
  const steps: Array<[number, string, () => Promise<unknown>]> = [
    [0, 'delete', step0_delete],
    [1, 'places-lookup', step1_placesLookup],
    [2, 'places-details', step2_placesDetails],
    [3, 'autofill', step3_autofill],
    [4, 'scrape-preview', step4_scrapePreview],
    [5, 'agent-intelligence', step5_agentIntelligence],
    [6, 'build-slot-prompt', step6_buildSlotPrompt],
    [7, 'insert-client', step7_insertClient],
    [8, 'create-agent', step8_createAgent],
    [9, 'seed-knowledge', step9_seedKnowledge],
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
    console.error(`Step ${STEP} not implemented yet (or invalid)`)
    process.exit(1)
  }
  await target[2]()
}

main().catch(e => { console.error(e); process.exit(2) })
