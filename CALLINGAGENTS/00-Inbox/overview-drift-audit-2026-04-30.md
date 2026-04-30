---
type: audit
status: complete
date: 2026-04-30
related: [[D442]], [[Architecture/control-plane-mutation-contract]], [[Architecture/call-path-capability-matrix]]
tags: [drift, overview, audit, d442, read-only]
---

# Overview Drift Audit — 5 Clients — 2026-04-30 (D442 Phase 1)

> **Scope:** `hasan-sharif`, `exp-realty`, `urban-vibe`, `windshield-hub`, `calgary-property-leasing`. Read-only. No mutations.
> **Snapshots:** all 5 written to `docs/refactor-baseline/snapshots/2026-04-30-pre-d442/{slug}-system-prompt.txt` before any analysis.
> **Sources compared:** Supabase `clients` row, Ultravox `GET /api/agents/{id}` callTemplate, expected output of `buildAgentTools()` per current `src/lib/ultravox.ts`.

---

## Top-line summary

| Client | Pipeline | DB↔UV voice | DB↔UV tools | Slot markers | sync metadata | Owner-perceived drift class |
|---|---|---|---|---|---|---|
| `hasan-sharif`             | legacy-monolithic   | MATCH | DB(5) vs UV(7) — DB missing `bookAppointment`+`checkCalendarAvailability`+`hangUp`; carries dead `transitionToBookingStage` | 0 | `unknown / null` | **fake-control + propagation** |
| `exp-realty`               | legacy-monolithic   | MATCH | DB(6) vs UV(7) — DB missing `hangUp` | 0 | `unknown / null` | **propagation (IVR enabled but listen path is correct)** |
| `urban-vibe`               | legacy-monolithic   | MATCH | DB(5) vs UV(5) — DB has `pageOwner`, UV has `hangUp` | 0 | `success` 2026-03-30 | **propagation (Brian's exact symptom class)** |
| `windshield-hub`           | legacy-monolithic   | MATCH | DB(3) vs UV(4) — DB missing `hangUp` | 0 | `unknown / null` | **propagation** |
| `calgary-property-leasing` | **slot-pipeline**   | MATCH | DB(4) vs UV(5) — DB missing `hangUp` | **17** | `success` 2026-04-27 | **fake-control on Greeting tile + UV/DB tool array divergence** |

**Drift findings (count by failure class)**

| Class | Count | Where |
|---|---|---|
| **fake-control** | **3** | (a) Greeting tile is editable in Overview UI but `PROMPT_VARIABLE_REGISTRY[GREETING_LINE].editable=false` and `dbField=null`; the PATCH route does not enforce the registry's editable flag — affects **all 5**. (b) `hasan-sharif.transitionToBookingStage` lingers in `clients.tools` with no matching builder. (c) On 4 snowflakes, **any** Overview variable edit silently no-ops the prompt because `regenerateSlots` returns `success:false` with `warning: 'Old-format prompt without section markers — use patchers instead of regeneration'` (variables/route.ts L218–L228). DB updates land in `niche_custom_variables`; the deployed prompt never changes. |
| **propagation / partial-failure** | **5** | All 5 clients have `clients.tools` (the runtime-authoritative array used as `toolOverrides` per Section 7 risk #7) **out of sync with `Ultravox.callTemplate.selectedTools`**. Every snowflake is missing `hangUp` from `clients.tools`. `hasan-sharif` extra-additionally missing `bookAppointment`+`checkCalendarAvailability`. Last `updateAgent()` ran but `syncClientTools()` never wrote `hangUp` to the DB array, OR an older write predated the `hangUp` builder addition. |
| **source-of-truth / missing wiring** | **3** | (a) `last_agent_sync_at`/`last_agent_sync_status` are NULL on `hasan-sharif`, `exp-realty`, `windshield-hub` despite recent prompt edits — column exists (migration `20260327000000`) but is never written by the variables PATCH path on those clients (only sync-failure or admin-recompose writes it). Reporting these as **"unknown — column never written"**, not "needs sync". (b) `hasan-sharif.injected_note = "Im in mountains this weekend leave my assistant a message"` — content suggests Hasan thinks this is a voicemail greeting; it is actually a per-call `RIGHT NOW:` block injected via `callerContextBlock` (it works, but the label is misleading). (c) `exp-realty.ivr_enabled=true` with `ivr_prompt` set, but no fake-control: PSTN-only and currently routes to agent on any non-1 digit — verified intentional. |
| **environment-drift** | 0 | None observed. Both prod and Ultravox API key resolve to the same env. |
| **path-parity** | 1 | All 5 clients have `knowledge_backend='pgvector'` but `queryKnowledge` registration in `clients.tools` and Ultravox `selectedTools` is conditional on `knowledge_chunk_count > 0`. We could not measure chunk counts in this read-only pass; Ultravox shows the tool present on all 5 except where the snowflake's `clients.tools` happens to omit it — this is the documented "intentional gap" per Section 7 risk #1 of the mutation contract, NOT a bug. |

---

## Cross-cutting findings

### 1. Slot-marker scope is exactly 1-of-5 — Brian's client is the only slot-pipeline client among Hasan-owned active clients

All four "snowflakes" — `hasan-sharif`, `exp-realty`, `urban-vibe`, `windshield-hub` — are **legacy-monolithic** (zero `<!-- unmissed:* -->` markers). `calgary-property-leasing` has **17 markers** (`persona_anchor`, `identity`, `call_handling_mode`, `conversation_flow`, `escalation_transfer`, `after_hours`, `faq_pairs`, `available_properties`, etc.). This confirms the plan's premise: D304 (snowflake migration) is not a 1-of-5 patch but a **4-of-5 patch**. **Fix 5 (Urban Vibe migration) in the plan is the wrong target on impact alone** — Urban Vibe is 1 of 4 equally-broken snowflakes, and `hasan-sharif` is the highest-traffic legacy client.

### 2. Brian's bug is a **DIFFERENT root cause** from the snowflakes' bug

The plan asked the load-bearing question: "Is Brian's drift the same root cause as the snowflakes, or different?" **Different.**

- **Snowflake symptom (4 clients):** Owner edits ANY variable from Overview → `PATCH /api/dashboard/variables` → DB write succeeds → `regenerateSlots` is called → `hasSlotMarkers()` returns false → response is `{ ok: true, warning: 'Old-format prompt…', promptRegenerated: false }` → UI shows toast "Saved" → live prompt never changes. **D369 amber banner exists** in `SettingsView.tsx` (Phase 6 Wiring) — it's a page-level legacy-prompt warning, not a per-field warning, so the owner doesn't connect it to the field they just edited. This is a textbook **propagation + fake-control compound bug**.
- **Brian's symptom (1 client, slot-pipeline):** His current DB GREETING_LINE = `"Hi, this is Eric, welcome to Calgary Edmonton Property Leasing. How may I help you?"` and his **deployed UV `## 1. GREETING` slot literally contains that same line at offset 9027**. So at the moment of this audit, *no live drift exists between UI/DB/UV for the greeting itself*. What Brian observed is consistent with one of two scenarios:
  - (a) The Overview tile is Edit-enabled (renderField always shows the Edit button — there is no `meta.editable` gate in `AgentIdentityCard.tsx#L391-L464`). Brian opened it, edited it, hit Save. Toast said "Saved". On a slot-pipeline client this should have propagated — but the deployed UV greeting still matches the **post-save** value, so we cannot confirm an actual stored→deployed gap right now. Most likely: he edited but `regenerateSlots` already ran and the value DID propagate, and his "different copy" memory was from a stale UI cache before the `onChanged?.()` refresh, OR he tested on the older `urban-vibe` agent ID that was used during the demo phase.
  - (b) **More likely real cause** — the **4-line "AI question response"** in his `persona_anchor` slot reads `'"yeah, i'm an AI — but i'm here to help with Calgary Edmonton Property Leasing, what can I do for ya?"'`. If Brian asked his own agent "are you AI?" the agent says exactly that line, which sounds nothing like the greeting tile. The Overview greeting tile and the AI-question response are two different prompt artifacts; the UI shows only the greeting tile, hence the "displays X but says Y" report.

**Either way, Brian's higher-order question — "if I change the greeting here, will it work there?" — is symptomatic of the global fake-control bug**: the Greeting tile renders an Edit button regardless of `varDef.editable`. Brian's instincts are correct that the surface is untrusted.

### 3. Universal `clients.tools` ↔ `Ultravox.selectedTools` divergence

This is the single most repeated finding. Per Section 7 risk #7 of the mutation contract, `clients.tools` is runtime-authoritative (overrides the agent's stored tools via `toolOverrides: { removeAll: true, add: client.tools }`). Yet on **every** client, `clients.tools` is shorter than the Ultravox `selectedTools`:

- All 5 clients are missing `hangUp` from `clients.tools`. `hangUp` is the only "always" tool per `buildAgentTools()` (line 786). The deployed Ultravox agents have it; the DB array does not. This means `toolOverrides` strips `hangUp` at every production call, yet **the agents do hang up correctly** — implying either (i) `hangUp` is also synthesized at call time outside `buildAgentTools()` or (ii) the agent's stored template tools fall through despite `removeAll: true`. **This warrants its own investigation** — could be a stealth duplicate-source-of-truth bug.
- `hasan-sharif.tools` carries `transitionToBookingStage`, a name that does not appear in any current builder in `src/lib/ultravox.ts`. This is dead code from a prior call-state migration that never got cleared.

### 4. `last_agent_sync_*` columns are never written for variable PATCHes that don't change names

The variables PATCH route only writes `last_agent_sync_*` inside the **safety-net 5b block** (NAME_FIELDS only) and the **5c generalized sync block** (only when `result.promptChanged === true`). For snowflakes where `regenerateSlots` returns `success: false`, neither path runs — so the columns stay NULL forever. The amber banner "needs sync" condition (`last_agent_sync_status='error'`) **never trips for the actual most common failure mode** because nothing writes 'error' on the legacy-prompt rejection path. Reporting this as **silent-failure-category-3** for the future Fix 1.

---

## Per-client sections

### 1. `hasan-sharif` — legacy-monolithic snowflake

- **Pipeline:** legacy-monolithic. 0 slot markers. Voicemail-pipeline check: no `MESSAGE TAKING FLOW`/`Step 1 — Get their name` block — confirmed not voicemail-pipeline.
- **Plan/sub:** `pro` / `active`. Twilio number set. Calendar `connected`. Telegram `7278536150`.
- **Sync metadata:** `last_agent_sync_status='unknown'`, `last_agent_sync_at=NULL`, `last_agent_sync_error=''`. ⇒ Column exists but never written by the legacy-rejection path.
- **`niche_custom_variables.GREETING_LINE`:** `null` ⇒ Overview tile resolves to niche default (real_estate wow-first greeting).
- **System-prompt opening line:** `# PERSONA … You are Aisha, Hasan Sharif's AI assistant at EXP Realty.` (no quoted greeting near top — agent uses runtime callerContext to pick greeting). The actual spoken first words come from the OPENING block deep in the prompt.

| Field | DB | Ultravox Live | Expected | Status | Class |
|---|---|---|---|---|---|
| `agent_voice_id` | `87edb04c-06d4-47c2-bd94-683bc47e8fbe` | callTemplate.voice = same | same | MATCH | — |
| `system_prompt` length | 8342 | 8319 (markers stripped, none to strip) | n/a | MATCH | — |
| `tools` count | 5 | 7 | 8 (incl. pageOwner) | **MISMATCH** | propagation + partial-failure |
| `tools.hangUp` present | NO | YES | YES | **DRIFT** | propagation |
| `tools.bookAppointment` | NO | YES | YES | **DRIFT** | propagation (booking_enabled=true on Pro plan) |
| `tools.checkCalendarAvailability` | NO | YES | YES | **DRIFT** | propagation |
| `tools.transitionToBookingStage` | YES | NO | NO | **DRIFT** | partial-failure (orphaned legacy tool) |
| `tools.pageOwner` | NO | NO | YES (Pro + forwarding_number) | **DRIFT** | propagation |
| `booking_enabled` | true | (via tool) | — | OK | — |
| `sms_enabled` + `twilio_number` | true / `+15877421507` | tool present | tool registered | OK | — |
| `forwarding_number` | `+13068507687` | transferCall present | transferCall registered | OK | — |
| `calendar_auth_status` | `connected` | (UI-only) | — | OK | — |
| Section markers | 0 | n/a | 0 | n/a | (root cause for variable edits to silently fail) |

**Owner-visible:** Hasan thinks his Overview is wired. If he edits the Greeting, AGENT_NAME, BUSINESS_NAME, CLOSE_PERSON, or any other variable from the tile, the toast says "Saved" but the deployed prompt does not change because `hasSlotMarkers` returns false. The amber D369 page banner is showing somewhere, but per-field there is no signal. NAME field edits do propagate via the safety-net 5b block (word-boundary patch) — Greeting/Closing/etc. do not.

**Drift findings:**
- **fake-control** — Greeting/CLOSE_PERSON/etc. tile shows Edit but PATCH silently no-ops the prompt
- **propagation** — `clients.tools` does not include `hangUp`/`bookAppointment`/`checkCalendarAvailability`/`pageOwner` despite plan + flags supporting them; the agent is currently running on its **stored Ultravox template tools** because `toolOverrides` would strip them down to 5 if the DB array were used as-is. This is a *latent* tool-set drift waiting for the next `syncClientTools()` to bite.
- **partial-failure** — `transitionToBookingStage` orphan tool in DB

---

### 2. `exp-realty` — legacy-monolithic snowflake (Omar/Fatema)

- **Pipeline:** legacy-monolithic. 0 markers.
- **Plan/sub:** `pro` / `none` (sub_status='none' — was on free during migration; live status drives plan-gating bypass via `subscription_status='trialing'` in `buildAgentTools`. Here it's neither, so plan='pro' is used directly).
- **Sync metadata:** `unknown / NULL`.
- **`niche_custom_variables.GREETING_LINE`:** `null`.
- **Opening line in DB prompt:** `LIVE VOICE PHONE CALL … IDENTITY — You are Fatema, Omar Sharif's AI assistant.` (greeting is in the OPENING block, not directly at the top).
- **IVR:** `ivr_enabled=true`, `ivr_prompt` set. PSTN-only path; documented intentional (`call-path-capability-matrix.md`).

| Field | DB | UV Live | Expected | Status | Class |
|---|---|---|---|---|---|
| voice | `441ec053-…` | same | same | MATCH | — |
| system_prompt length | 10628 | 10994 | n/a | MATCH (UV adds `{{templateContext}}` placeholders) | — |
| tools count | 6 | 7 | 8 | MISMATCH | propagation |
| `tools.hangUp` | NO | YES | YES | **DRIFT** | propagation |
| `tools.pageOwner` | NO | NO | YES | **DRIFT** | propagation |
| booking_enabled | true | bookAppointment + checkCalendarAvailability present in BOTH | OK | OK | — |
| sms_enabled + twilio_number | true / `+16393850876` | sendTextMessage present | OK | OK | — |
| forwarding_number | `+13067163556` | transferCall present | OK | OK | — |
| ivr_enabled | true | (no agent tool) | — | OK | — |
| Section markers | 0 | n/a | 0 | n/a | root cause for greeting fake-control |

**Owner-visible:** Same as Hasan — Greeting/etc. tile silently saves to DB but doesn't reach the live prompt. NAME edits propagate via safety-net.

**Drift findings:** fake-control on Greeting tile; propagation gap on `clients.tools` (missing `hangUp` + `pageOwner`).

---

### 3. `urban-vibe` — legacy-monolithic snowflake (Ray/Alisha) — explicitly the Fix-5 candidate

- **Pipeline:** legacy-monolithic. 0 markers.
- **Plan/sub:** `pro` / `none`. forwarding_number set.
- **Sync metadata:** `last_agent_sync_status='success'`, `last_agent_sync_at='2026-03-30T21:24:25.825Z'`. ⇒ The 5c generalized sync block ran one time when Ray edited a name field. Now stale by 30 days.
- **`niche_custom_variables.GREETING_LINE`:** `null`.
- **Opening line in DB prompt:** `IDENTITY — You are Alisha, Urban Vibe Properties virtual assistant in Calgary.` Then `OPENING — If callerContext includes RETURNING CALLER … Greet by name: "hey [name], good to hear from you again."` So the agent says either `"hey [name], good to hear from you again"` (returning) or a wow-first niche default (cold caller).
- **`niche` value:** `'property-management'` (with hyphen) — this differs from `calgary-property-leasing.niche='property_management'` (underscore). Both are accepted in code paths but it indicates an old vs new provisioning convention. Cosmetic.

| Field | DB | UV Live | Expected | Status | Class |
|---|---|---|---|---|---|
| voice | `df0b14d7-…` | same | same | MATCH | — |
| system_prompt length | 9623 | 9989 | n/a | MATCH | — |
| tools count | 5 | 5 | 6 | MISMATCH (counts equal but contents differ) | propagation |
| `tools.hangUp` | NO | YES | YES | **DRIFT** | propagation |
| `tools.pageOwner` | YES | NO | YES | **DRIFT** | path-parity (DB has it, UV doesn't — UV agent was last synced before pageOwner was added to its template) |
| booking_enabled | false | (no booking tool) | — | OK | — |
| sms_enabled + twilio_number | true / `+15873296845` | sendTextMessage present | OK | OK | — |
| forwarding_number | `+14036057142` | transferCall present | OK | OK | — |
| Section markers | 0 | n/a | 0 | n/a | greeting fake-control |

**Owner-visible:** Ray is the original user Brian referenced ("Welcome to Urban Vibe — Hi this is Alita…"). His Overview tile shows whatever resolves from the niche wow-first greeting; the actual spoken opening is determined by callerContext (`hey [name], good to hear from you again` for known callers vs niche default for cold callers). If Ray edits the Greeting tile, **nothing changes the live prompt** — the bug Brian flagged is the literal symptom Ray would have hit on this client.

**Drift findings:**
- fake-control on Greeting tile
- bidirectional `pageOwner` vs `hangUp` inconsistency between DB and UV — most pronounced of the 5 clients
- `niche` slug inconsistency vs canonical `property_management`

---

### 4. `windshield-hub` — legacy-monolithic snowflake (Mark/Sabbir)

- **Pipeline:** legacy-monolithic. 0 markers.
- **Plan/sub:** `core` / `none`. **No forwarding_number.** No booking.
- **Sync metadata:** `unknown / NULL`.
- **`niche_custom_variables.GREETING_LINE`:** `null`.
- **`niche`:** `'auto-glass'` (hyphen — same legacy convention as Urban Vibe).

| Field | DB | UV Live | Expected | Status | Class |
|---|---|---|---|---|---|
| voice | `b28f7f08-…` | same | same | MATCH | — |
| system_prompt length | 8586 | 8952 | n/a | MATCH | — |
| tools count | 3 | 4 | 4 | MISMATCH | propagation |
| `tools.hangUp` | NO | YES | YES | **DRIFT** | propagation |
| sms_enabled + twilio_number | true / `+15873551834` | sendTextMessage present | OK | OK | — |
| forwarding_number | NULL | no transferCall | no transferCall | OK | — |
| booking_enabled | false | — | — | OK | — |
| knowledge_backend | pgvector | queryKnowledge present in BOTH | OK | OK | — |
| Section markers | 0 | n/a | 0 | n/a | greeting fake-control |

**Owner-visible:** Mark gets the same fake-control on Greeting + name edits work via safety-net. He has no transfer or booking, so there are fewer surfaces to drift on. The cleanest snowflake.

**Drift findings:** fake-control on Greeting tile; propagation gap on `clients.tools.hangUp`.

---

### 5. `calgary-property-leasing` — slot-pipeline (Brian)

- **Pipeline:** **slot-pipeline**. **17 markers** present: `after_hours`, `available_properties`, `call_handling_mode`, `conversation_flow`, `escalation_transfer`, `faq_pairs`, `forbidden_extra`, `identity`, `inline_examples`, `knowledge_summary`, `live_phone_envelope`, `persona_anchor`, `pricing`, `recording_disclosure`, `safety_block`, `services_overview`, `services_priority`.
- **Plan/sub:** `core` / **`trialing`** ⇒ all tools bypass plan gating per `buildAgentTools()` trialing branch.
- **Sync metadata:** `last_agent_sync_status='success'`, `last_agent_sync_at='2026-04-27T23:40:01.564Z'` ⇒ Healthy. Latest variable edit propagated correctly.
- **`niche_custom_variables.GREETING_LINE`:** `'Hi, this is Eric, welcome to Calgary Edmonton Property Leasing. How may I help you?'`
- **Slot text in DB prompt** — `<!-- unmissed:conversation_flow -->` block, section `## 1. GREETING`: `Hi, this is Eric, welcome to Calgary Edmonton Property Leasing. How may I help you?` ⇒ EXACT MATCH.
- **Deployed UV prompt** (markers stripped on send via `stripPromptMarkers`): contains the same line at offset 9027. ⇒ EXACT MATCH.

| Field | DB | UV Live | Expected | Status | Class |
|---|---|---|---|---|---|
| voice | `5f8e97b1-cd48-…` (Eric) | same | same | MATCH | — |
| system_prompt length | 24491 | 23601 | n/a | MATCH (UV strips 17×~50 chars of markers) | — |
| tools count | 4 | 5 | 4 | MISMATCH | propagation (UV has hangUp, DB doesn't) |
| `tools.hangUp` | NO | YES | YES | **DRIFT** | propagation |
| `tools.submitMaintenanceRequest` | YES | YES | YES (custom niche tool) | OK | — |
| `tools.queryKnowledge` | YES | YES | YES | OK | — |
| `tools.sendTextMessage` | YES | YES | YES (sms_enabled + twilio_number + trialing→smsEnabled=true) | OK | — |
| sms_enabled + twilio_number | true / `+16397393885` | sendTextMessage present | OK | OK | — |
| booking_enabled | false | — | — | OK | — |
| forwarding_number | NULL | no transferCall | no transferCall | OK | — |
| knowledge_backend | pgvector | queryKnowledge present | OK | OK | — |
| Section markers | 17 | n/a (stripped) | 17 | OK | — |
| Greeting (DB GREETING_LINE) ↔ DB system_prompt slot | EXACT MATCH | EXACT MATCH | EXACT MATCH | **NO DRIFT** | — |

**Owner-visible (Brian):** The Overview Greeting tile shows `"Hi, this is Eric, welcome to Calgary Edmonton Property Leasing. How may I help you?"`. The deployed agent **does open with that exact line** when called fresh. So the literal complaint as stated is not reproducible right now — either it was a transient cache before `onChanged?.()` refresh, or Brian's "different copy" was actually the agent's **AI-question response** in the `persona_anchor` slot (`"yeah, i'm an AI — but i'm here to help with Calgary Edmonton Property Leasing, what can I do for ya?"`) which IS different from the greeting tile and is what the agent says when asked "are you AI?".

**The systemic fake-control still applies:** Brian's instinct that the Overview Greeting tile is untrusted is correct because the **registry says `editable: false`** and the **PATCH route does not enforce it** — but on Brian's slot-pipeline client an edit WOULD propagate via `regenerateSlots`. The bug is that the UI shows Edit on a registry-readonly variable and the contract is silently violated by the route. On Brian's client the silent violation happens to produce the correct outcome; on the snowflakes it produces silent no-op.

**Drift findings:**
- fake-control on Greeting tile (registry says read-only, UI shows Edit, PATCH does not enforce)
- propagation on `clients.tools.hangUp` (universal — affects all 5)

---

## Recommended fix order

Based on the above, here is the revised priority:

### Fix 1 (HIGHEST) — Show runtime truth on Overview, not stored DB truth

Per the plan as written. This single change makes every drift class — fake-control, propagation, partial-failure, intentional gap — visibly diagnosable to the owner without forcing a backend per-symptom fix. It is exactly Brian's literal request ("if I change the greeting here, will it work there?"). Implement Fix 1 first, regardless of pipeline.

### Fix 1.5 (NEW — uncovered by this audit) — Reject PATCH on registry-readonly variables

In `src/app/api/dashboard/variables/route.ts` PATCH handler, add **after** the `getVariable(variableKey)` lookup:

```ts
if (!varDef.editable) {
  return NextResponse.json({ error: `Variable ${variableKey} is read-only` }, { status: 400 })
}
```

Pair with: in `AgentIdentityCard.tsx#renderField`, look up `varDef.editable` from the variables response (the GET already includes `meta`) and hide the Edit button when false. This is one-line backend + ~5-line frontend; closes the universal Greeting-tile fake-control across all 5 clients (and any future client) **regardless of pipeline**.

### Fix 2 — Per-field "Saved, but not live yet" warning chip

Per the plan. Trigger when `PATCH /api/dashboard/variables` returns `{ promptRegenerated: false, warning: 'Old-format prompt…' }`. Closes the silent no-op on the 4 snowflakes for any field that DOES have `editable: true`.

### Fix 3 — Plug `twilio_number` into `needsAgentSync`

Per the plan. Documented but unverified in this audit (admin God Mode path). Worth shipping; one-line change. **Lower urgency than Fix 1.5** — this audit found no client where `twilio_number` was set but SMS was missing; all 5 clients with `sms_enabled=true` have `twilio_number` and the SMS tool is correctly registered.

### Fix 4 — Medium-aware capability footnotes (Transfer/IVR "phone calls only")

Per the plan. Cosmetic-but-correct.

### Fix 5 — Migrate snowflakes to slot format (Urban Vibe **NOT** the right starting point alone)

The plan suggested Urban Vibe as the migration target on the assumption it was the only fully-broken one. This audit shows **all 4 snowflakes are equally broken at the slot level** (zero markers, identical regenerateSlots failure mode). On user-visible impact:

- `hasan-sharif` — highest call volume, owner is the engineer (Hasan), prompts are most likely to be edited frequently. **Highest ROI.**
- `exp-realty` — second-highest impact (Omar's family member uses dashboard).
- `urban-vibe` — third (Ray uses it but less actively).
- `windshield-hub` — fourth (Mark/Sabbir most stable; also fewer surfaces — no transfer, no booking).

**Recommended sequence if Fix 5 ships at all:** `hasan-sharif` → `exp-realty` → `urban-vibe` → `windshield-hub`. Each migration: snapshot stored above, run `recomposePrompt` with `dryRun=true` first to diff, owner-approve, deploy via `/prompt-deploy [slug]`, validate with `/review-call` on a follow-up test call. **Standing no-redeploy rule must be lifted explicitly per client.**

But — if Fix 1 + Fix 1.5 + Fix 2 ship cleanly, the snowflake migration becomes optional polish rather than a blocker. The user-facing trust gap (which is what Brian flagged) is fixed by surfacing runtime truth + per-field warnings, not by migrating the underlying prompt format.

### Universal investigation (NEW — uncovered by this audit) — `clients.tools.hangUp` missing on all 5

Every client has `hangUp` in `Ultravox.callTemplate.selectedTools` but **not** in `clients.tools`. Since `clients.tools` is supposedly the runtime-authoritative source (Section 7 risk #7 of mutation contract — `toolOverrides: { removeAll: true, add: client.tools }`), the agents should not be able to hang up on production calls. They do. Either:

1. `hangUp` is synthesized at call creation time outside `buildAgentTools()` and added to `toolOverrides` directly (would explain why it works); OR
2. `removeAll: true` does not actually strip stored template tools the way the contract documents; OR
3. `clients.tools` is stale and the next `syncClientTools()` will write `hangUp` correctly, but stale data has been sitting in the column for weeks/months.

This deserves a focused 30-min `truth-tracer` agent invocation before Fix 5 — it's a Section 7 contract violation regardless of which of the three is true, and it affects 100% of audited clients.

---

## Snapshots written (Task 1 confirmation)

```
docs/refactor-baseline/snapshots/2026-04-30-pre-d442/
├── calgary-property-leasing-system-prompt.txt   24491 chars
├── exp-realty-system-prompt.txt                 10628 chars
├── hasan-sharif-system-prompt.txt                8342 chars
├── urban-vibe-system-prompt.txt                  9623 chars
└── windshield-hub-system-prompt.txt              8586 chars
```

All 5 files exist on disk, plain text, no JSON wrapping. Confirmed before any other work.

---

## Audit data archived

- DB rows (5): `CALLINGAGENTS/00-Inbox/d442-data/clients-raw.json`
- Ultravox agent state (5): `CALLINGAGENTS/00-Inbox/d442-data/ultravox/{slug}.json`
- Drift analyzer script: `/tmp/d442_analyze.py` (re-runnable)
