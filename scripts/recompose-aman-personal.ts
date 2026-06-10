/**
 * Recompose Aman Walia — Wave 1.5 personal-message-flow override.
 *
 * Context: Wave 1 fixed business_name + greeting via niche_custom_variables.
 * Wave 1.5 (this script) adds PERSONAL MESSAGE FLOW as the routing trunk so
 * Aman's forwarded personal calls (family, friends, deliveries, service
 * providers) get a warm message instead of "wrong number, this is a real
 * estate office" hangup or RE force-funnel.
 *
 * Pattern lifted directly from Aisha (hasan-sharif, hand_tuned=true). Proves
 * the fleet-wide architectural fix planned in:
 *   Projects/unmissed/2026-06-06-universal-personal-message-architecture.md
 *
 * Approach — same as recompose-aman.ts:
 *   - Stay on slot pipeline, hand_tuned=false
 *   - Override TRIAGE_DEEP via niche_custom_variables (replaces real_estate
 *     default TRIAGE_DEEP with version PREPENDED with PERSONAL MESSAGE FLOW
 *     branch + APPENDED with UNCLEAR/DOESN'T FIT catchall)
 *   - Append a FORBIDDEN_EXTRA rule softening the WRONG NUMBER line so Riley
 *     does NOT hang up on personal/family/service callers
 *
 * Modes:
 *   default (no flag): dryRun=true. No DB writes. Snapshots preview.
 *   --live:            actually writes niche_custom_variables, recompose live,
 *                      PATCHes Ultravox agent.
 *
 * Run:
 *   npx tsx scripts/recompose-aman-personal.ts             # dryrun
 *   npx tsx scripts/recompose-aman-personal.ts --live      # actually deploy
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { recomposePrompt } from '../src/lib/slot-regenerator'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const SLUG = 'walia-family'
const LIVE = process.argv.includes('--live')
const FORCE_RECOMPOSE = true

// === The override blocks ===========================================

// PERSONAL MESSAGE FLOW is prepended as the TRUNK. RE branches preserved
// underneath. The existing real_estate TRIAGE_DEEP block (lines 474-544 of
// niche-defaults.ts) is included VERBATIM after the new branch to preserve
// every RE routing behavior already validated in Tier-1.5.
const NEW_TRIAGE_DEEP = `PERSONAL / NON-REAL-ESTATE MESSAGE (TRUNK — check first, before routing into real-estate branches):

Aman's personal cell forwards to this number. Riley is BOTH a real estate front desk AND Aman's personal voicemail. If the caller's reason is NOT clearly about buying, selling, renting, valuating property, or scheduling a showing — take a warm message. DO NOT funnel them into real-estate questions. DO NOT hang up with "wrong number."

Examples that go HERE (not into the buy/sell/eval flow):
  - Family or friend ("hey, it's Sarah, his wife — tell him dinner's at 7")
  - Service provider ("this is the plumber calling about tomorrow's appointment")
  - Delivery or courier ("FedEx here, got a package — what's the door code?")
  - Appointment confirmation ("Dr. Singh's office, confirming Aman's appointment Thursday")
  - Generic "just wanted to leave a message for Aman" with no real-estate context
  - Anyone calling for Aman personally (banker, accountant, contractor, etc.)

Flow:
1. Lead with warm acknowledgment: "for sure — I'll get that to Aman right away."
2. If name not given: "can I grab your name?"
3. If reason not given: "and what's this about?"
4. Once you have name AND reason: "got it — I'll pass that along to Aman. take care!" then hangUp.

NEVER ask for a phone number. The caller's phone is already in context.

RELATIONSHIP SHORTCUT: if caller identifies themselves by relationship — "his wife", "his son", "his brother", "his mom", "his friend", "I'm his cousin", "yeah this is his dad" — that IS the name AND the reason. Close immediately:
"hey! got it, I'll let Aman know you called. talk soon." then hangUp.

If the caller VOLUNTEERS a real-estate intent in their first sentence (e.g., "I want to book a showing", "I'm thinking about selling", "I'm looking to buy in Calgary") — skip this trunk and go straight to the matching branch below.

----------

REAL ESTATE INTENT — Open by asking the intent question once: "are you looking to buy, sell, get a home valuation, or rent?"
Then branch based on what they say. If they already volunteered intent in their first sentence, skip the question and go straight to the branch.

BUYING / LOOKING TO PURCHASE:
"awesome — what area are you looking in, and is there a specific place you're already interested in?"
Collect in this order — one question at a time:
  1. Area or neighborhoods of interest
  2. Property type (detached, condo, townhouse) — only if not obvious
  3. Price range or budget
  4. Timeline — "when are you hoping to be in something? next 30 days, 3 months, or just exploring?"
  5. Pre-approval status — "have you already been pre-approved with a lender, or is that still on the to-do?"
  6. Name (required — last)
→ If they're looking at a SPECIFIC listing or address: also collect MLS or address + their preferred showing time, then route to {{CLOSE_PERSON}} for confirmation
→ Never quote price per square foot or comp values — route to {{CLOSE_PERSON}}.

SELLING / LISTING:
"got it — are you ready to list, or are you just trying to get a feel for what your place is worth?"
→ "ready to list" path → SELL flow:
  1. Property address
  2. Reason for selling — "what's driving the move? upsizing, downsizing, relocating, investment?"
  3. Timeline to list — "any rough date in mind? this month, next 30 days, spring market?"
  4. Already working with another agent? — "just so I don't step on toes — are you currently signed with another listing agent?"
  5. Name (required — last)
  → If signed with another agent: "no problem at all — {{CLOSE_PERSON}} won't reach out about listing then. anything else we can help with?"
  → Otherwise: flag [SELL] and route to callback
→ "just want a market read" path → EVAL (HOME VALUATION) flow:
  1. Property address
  2. Recent updates or renovations
  3. Why now
  4. Name (required — last)
  → NEVER speak a number — every valuation is "{{CLOSE_PERSON}} will pull comps and call you back with a real number."
  → Flag [EVAL]

RENTAL INQUIRY:
"awesome — what neighborhoods are you looking in, and when are you trying to move in?"
→ Renter path: areas → move-in date → bed count + budget → name → capture silently as a rental search
→ Landlord path: "got it — are you looking to rent your place out, or are you looking for a property manager?" → branch accordingly.

SHOWING REQUEST (already mentioned a property — book the showing):
"for sure! what's the address or listing link?"
→ Collect: address or MLS + 1-2 preferred date/time windows + name + intent
→ "got it — {{CLOSE_PERSON}} will confirm a time with you shortly." (capture silently as a showing request)
→ NEVER say "yes that's available" or "the showing is booked" — always route confirmation to {{CLOSE_PERSON}}.

TEAM / AGENT QUESTION: "yeah for sure — what are you working on? buying, selling, valuation, or rental? I'll get this to the right person." → Branch based on answer. Do NOT treat as a recruiting call.

VENDOR / CONTRACTOR / SERVICE PROVIDER offering services (photographer, stager, contractor pitching): take a message — "thanks — what's your name and what are you offering? I'll pass it to Aman, he'll reach out if there's a fit." → name + company + offering → flag [VENDOR] → close warmly. Do NOT hang up rudely.

JOB INQUIRY / RECRUITING: "thanks for the interest — what's your name and any current real estate experience?" → name + experience + message → flag [RECRUITING] → close. Do NOT hang up rudely.

LEGAL / MORTGAGE / TAX QUESTION: "good question — that's something {{CLOSE_PERSON}} or a mortgage broker would have to answer specifically. let me grab your name and what you're trying to figure out." → name + topic → route to callback. Do NOT speculate.

INVESTMENT / REVENUE PROPERTY: "got it — investor questions {{CLOSE_PERSON}} loves. what kind of property are you looking at, and what area?" → property type + area + budget + name → flag [INVESTOR] → callback. Never quote a cap rate.

----------

UNCLEAR / DOESN'T FIT (caller's reason doesn't match any branch above after 1-2 turns):
Default back to PERSONAL MESSAGE FLOW (top of this block) — take a warm message. DO NOT loop trying to force a real-estate classification. DO NOT end on "wrong number." Get name + brief reason, close gracefully.`

// FORBIDDEN_EXTRA APPEND — softens the universal WRONG NUMBER line that lives
// in prompt-slots.ts FILTER (line 431) and protects the personal-call default.
// This rule fires near the top of the prompt as part of FORBIDDEN ACTIONS, so
// it has higher priority than the FILTER hangup line per GLM precedence rules.
const FORBIDDEN_EXTRA_APPEND =
  'PERSONAL CALLS — Aman forwards his cell to this number, so MANY callers will not be about real estate. NEVER respond with "wrong number, this is a real estate office" or hang up on personal, family, service-provider, or off-topic callers. Route them to the PERSONAL MESSAGE FLOW in the TRIAGE block — take a warm message, get name + reason, close gracefully. The only time to say "might be a wrong number" is when the caller EXPLICITLY says "wrong number" or "I dialed the wrong number" or is detected automated spam (robocall, warranty pitch, Medicare scam). For everything else: take the message.'

// ===================================================================

const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function main(): Promise<void> {
  console.log(`[1/4] Looking up ${SLUG}...`)
  const { data: client, error: clientErr } = await svc
    .from('clients')
    .select('id, slug, business_name, agent_name, owner_name, niche, ultravox_agent_id, system_prompt, hand_tuned, niche_custom_variables')
    .eq('slug', SLUG)
    .limit(1)
    .maybeSingle()

  if (clientErr || !client) {
    throw new Error(`${SLUG} lookup failed: ${clientErr?.message ?? 'not found'}`)
  }
  const row = client as {
    id: string
    business_name: string | null
    agent_name: string | null
    owner_name: string | null
    niche: string | null
    ultravox_agent_id: string | null
    system_prompt: string | null
    hand_tuned: boolean
    niche_custom_variables: Record<string, unknown> | null
  }

  console.log(`  client.id=${row.id}`)
  console.log(`  business_name           = "${row.business_name ?? ''}"`)
  console.log(`  niche                   = "${row.niche ?? ''}"`)
  console.log(`  hand_tuned              = ${row.hand_tuned}`)
  console.log(`  ultravox_agent_id       = ${row.ultravox_agent_id ?? 'NONE'}`)
  console.log(`  current prompt length   = ${row.system_prompt?.length ?? 0} chars`)

  if (row.hand_tuned) {
    throw new Error('REFUSING: client is hand_tuned=true. Aman must stay on the slot pipeline.')
  }
  if (row.niche !== 'real_estate') {
    throw new Error(`REFUSING: expected niche=real_estate, got "${row.niche}". Aborting.`)
  }
  if (!row.ultravox_agent_id) {
    throw new Error('REFUSING: missing ultravox_agent_id. Cannot sync.')
  }

  const currentNcv: Record<string, unknown> = (row.niche_custom_variables && typeof row.niche_custom_variables === 'object')
    ? { ...row.niche_custom_variables }
    : {}

  // Preserve Wave 1 keys (GREETING_OVERRIDE) + add Wave 1.5 (TRIAGE_DEEP, FORBIDDEN_EXTRA append)
  const mergedNcv = {
    ...currentNcv,
    TRIAGE_DEEP: NEW_TRIAGE_DEEP,
    FORBIDDEN_EXTRA: FORBIDDEN_EXTRA_APPEND,
  }

  console.log('\n[2/4] Planned changes (niche_custom_variables ONLY, no code edits):')
  console.log(`  Existing keys preserved: ${Object.keys(currentNcv).join(', ') || '(none)'}`)
  console.log(`  Adding: TRIAGE_DEEP (${NEW_TRIAGE_DEEP.length} chars) — replaces real_estate default`)
  console.log(`  Adding: FORBIDDEN_EXTRA (${FORBIDDEN_EXTRA_APPEND.length} chars) — appends to real_estate default`)

  const mode = LIVE ? 'LIVE' : 'DRYRUN'
  const alreadyApplied =
    typeof row.niche_custom_variables === 'object' &&
    row.niche_custom_variables !== null &&
    (row.niche_custom_variables as Record<string, unknown>).TRIAGE_DEEP === NEW_TRIAGE_DEEP &&
    (row.niche_custom_variables as Record<string, unknown>).FORBIDDEN_EXTRA === FORBIDDEN_EXTRA_APPEND

  console.log(`\n[3/4] Applying DB updates — mode: ${mode}`)
  if (alreadyApplied) {
    console.log('  Already at target values — skipping write.')
  } else {
    const { error: updErr } = await svc
      .from('clients')
      .update({ niche_custom_variables: mergedNcv })
      .eq('id', row.id)
    if (updErr) {
      throw new Error(`DB update failed: ${updErr.message}`)
    }
    console.log('  DB updated. (Ultravox agent NOT touched until --live recompose.)')
  }

  console.log('\n  Resolving admin user_id for recompose audit trail...')
  const { data: adminCu, error: cuErr } = await svc
    .from('client_users')
    .select('user_id, role')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  if (cuErr || !adminCu?.user_id) {
    throw new Error(`No admin in client_users: ${cuErr?.message ?? 'empty'}`)
  }

  console.log(`\n[4/4] Running recomposePrompt — mode: ${mode}`)

  const result = await recomposePrompt(
    row.id,
    adminCu.user_id as string,
    /* dryRun */ !LIVE,
    /* forceRecompose */ FORCE_RECOMPOSE,
  )

  console.log('\n=== RESULT ===')
  console.log(`  success         = ${result.success}`)
  console.log(`  promptChanged   = ${result.promptChanged}`)
  console.log(`  charCount       = ${result.charCount ?? 'n/a'}`)
  console.log(`  delta vs current= ${(result.charCount ?? 0) - (row.system_prompt?.length ?? 0)} chars`)
  console.log(`  error           = ${result.error ?? 'none'}`)

  if (!LIVE && result.preview) {
    const today = new Date().toISOString().slice(0, 10)
    const snapshotPath = `tests/promptfoo/snapshots/walia-family-personal-${today}.txt`
    mkdirSync(dirname(snapshotPath), { recursive: true })
    writeFileSync(snapshotPath, result.preview, 'utf8')
    console.log(`\n  Snapshot saved: ${snapshotPath}`)

    // Show the new TRIAGE block so we can eyeball the PERSONAL MESSAGE FLOW lands at top
    const triageMatch = result.preview.match(/PERSONAL[\s\S]{0,1500}/)
    if (triageMatch) {
      console.log('\n  === PERSONAL MESSAGE FLOW (first 1500 chars) ===')
      console.log(triageMatch[0])
      console.log('  ============================================')
    }
  }

  if (LIVE) {
    console.log('\n  Aman is now recomposed with PERSONAL MESSAGE FLOW as trunk.')
    console.log('  Next: snapshot live prompt + run Tier-1.5 against extended baseline.')
  } else {
    console.log('\n  Rerun with --live to deploy.')
  }
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
