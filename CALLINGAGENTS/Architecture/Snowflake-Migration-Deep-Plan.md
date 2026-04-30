---
type: architecture
status: draft
date: 2026-04-30
related: [[D442]], [[D445]], [[D304]], [[Architecture/control-plane-mutation-contract]]
tags: [migration, snowflake, slot-pipeline, prompt-architecture]
---

# Snowflake Migration Deep Plan — 4 Legacy-Monolithic Clients → Slot Pipeline

> **Status:** DRAFT. Not approved. Not scheduled. Do NOT execute any step in Section 4 without explicit user direction and the pre-conditions in Section 2 being satisfied.
> **Scope:** `hasan-sharif`, `exp-realty`, `urban-vibe`, `windshield-hub`. Brian's `calgary-property-leasing` is already slot-pipeline and is the reference implementation, not a target.
> **Standing rule still in force:** `.claude/rules/refactor-phase-tracker.md` "No Redeployment" — none of the 4 snowflakes get redeployed without an explicit per-client lift of that rule for that deploy.

---

## 1. Why this plan exists

The original execution plan in `~/.claude/plans/inherited-foraging-shore.md` listed five fixes for the Overview drift problem Brian flagged. The last of those, "Fix 5: Migrate Urban Vibe to slot format," assumed Urban Vibe was the only legacy-monolithic snowflake — a 1-of-5 outlier — and that migrating it would close the loop on the regenerateSlots failure.

The Phase 1 audit (`CALLINGAGENTS/00-Inbox/overview-drift-audit-2026-04-30.md`) revealed that assumption was wrong:

- 4 of 5 active Hasan-owned clients are legacy-monolithic with **zero** slot markers (`hasan-sharif`, `exp-realty`, `urban-vibe`, `windshield-hub`).
- All 4 share the **identical** failure mode in `regenerateSlots()` / `recomposePrompt()` — `hasSlotMarkers()` returns false → `success: false` with `warning: 'Old-format prompt without section markers — use patchers instead of regeneration'` (slot-regenerator.ts L370-372, L440-442, L539-540).
- Only `calgary-property-leasing` (Brian) has the 17 slot markers; only Brian's client can survive an Overview tile edit through the slot pipeline.

This plan replaces the original "Fix 5" — a single Urban Vibe migration — with a structured **4-client migration path**, sequenced by user-impact, with explicit gates. The plan is conditional: it only runs if Fixes 1 + 1.5 + 2 from the audit do **not** already eliminate the user-visible problem.

---

## 2. The two pre-conditions for any migration

Both must be true before any client in Section 3 is migrated. If either is false, defer.

### Pre-condition A — Fixes 1 + 1.5 + 2 have shipped and are stable for ≥2 weeks

- **Fix 1 — Show runtime truth on Overview** ([[D442]] / next phase). Overview tiles read deployed Ultravox state, not stored DB state. This makes drift visibly diagnosable without forcing a backend per-symptom fix.
- **Fix 1.5 — Reject PATCH on registry-readonly variables.** Closes the universal Greeting-tile fake-control across all 5 clients regardless of pipeline. One-line backend gate + ~5-line frontend hide. This single fix removes the load-bearing complaint Brian raised — even on a legacy-monolithic client, the user no longer thinks they have a knob that does nothing because the knob is gone.
- **Fix 2 — Per-field "Saved, but not live yet" warning chip.** Triggers when `PATCH /api/dashboard/variables` returns `{ promptRegenerated: false, warning: 'Old-format prompt…' }`. Closes the silent no-op on the 4 snowflakes for any field that DOES have `editable: true`.

If those three ship cleanly and the owner of a snowflake reports the Overview surface as **truthful and warning-aware** for ≥2 weeks, **the migration is unnecessary**. The user-facing trust gap (which is what Brian flagged) is closed by surfacing runtime truth + per-field warnings, not by migrating the underlying prompt format.

### Pre-condition B — Owner explicitly requests a per-field edit propagate

The cost of migration is non-zero:

- The regenerated prompt will not match the owner's exact phrasing byte-for-byte. Slot builders compose from `clientRowToIntake()` + `niche_custom_variables`, not from the owner's manually-tuned prose.
- Migration is a single-shot prompt rewrite. If the owner has been editing the legacy prompt directly via `/prompt-deploy` over the months, those edits live ONLY in `clients.system_prompt` text and will be **discarded** by `recomposePrompt()` unless they were also captured in DB columns or `niche_custom_variables`.
- The deployed agent's behavior **will** shift, even if subtly (different forbidden-actions block, different inline examples, different greeting structure on cold callers).

Don't migrate proactively. Wait until an owner explicitly says: *"I edited this Overview field, the audit says it didn't propagate, I want it to."* Then evaluate whether the request is single-tile (use patcher path if available) or whether the owner wants Overview to be a real control surface going forward (then migrate).

---

## 3. Per-client risk profile

Each section is grounded in the actual snapshot text at `docs/refactor-baseline/snapshots/2026-04-30-pre-d442/{slug}-system-prompt.txt`.

### 3.1 `hasan-sharif` — Aisha for Hasan Sharif at eXp Realty

- **Snapshot:** `hasan-sharif-system-prompt.txt`, 8342 chars.
- **Niche:** `real_estate`. Real-estate brokerage, residential + commercial + land + leasing, dual-licensed SK/AB.
- **Existing blocks** (legacy-monolithic, hand-named — these are the headers in the snapshot, not slot markers):
  - `# PERSONA` (top-of-prompt identity lock)
  - `IDENTITY` (Aisha, Hasan, eXp, service areas)
  - `OPENING` (specific greeting line + skip-greeting rule + callerContext name handling)
  - `CORE RULES` (turn length, repetition, English-only, no prompt disclosure, jailbreak deflection)
  - `EMERGENCY`
  - `KNOWLEDGE — USE BEFORE DEFERRING` (mandatory queryKnowledge for halal/Manzil/financing questions)
  - `TOOL FAILURES` (with `_instruction` Pattern A handling)
  - `VOICE STYLE` (slang allowed: "gonna", "kinda", "wanna")
  - `MESSAGE FLOW`
  - `BOOKING FLOW` — calls `transitionToBookingStage` (orphaned tool — see audit Section 7)
  - `QUICK RESPONSES` (Hasan-specific: "Is Hasan there?", halal/Manzil routing, Assalamu Alaikum)
  - `EDGE CASES`
  - `# IDENTITY REMINDER`
- **Custom personality elements at risk under regeneration:**
  - The "Wa Alaikum Assalam!" Islamic greeting response — slot pipeline `inline_examples` may not preserve this unless surfaced via `niche_custom_variables`.
  - The Manzil/halal-financing routing block (mandatory queryKnowledge before deferring) — Brian's slot pipeline has a `forbidden_extra` block with rule 30 that does the equivalent ("ALWAYS use queryKnowledge BEFORE deferring") so this concept survives, but the Hasan-specific brand mention "Manzil" will not.
  - The `transitionToBookingStage` orphan in `clients.tools` will be naturally cleaned up by the migration's `syncClientTools()` re-run (good side effect).
  - The "his son, wife, brother, mom" relationship-as-name shortcut in MESSAGE FLOW — this is a Hasan-family-specific behavior that will not reproduce from the canonical slot builders.
- **Slot mapping** (after migration, 17-marker structure like Brian's):
  - `persona_anchor` → identity lock + AI-question response (would need overriding via `niche_custom_variables.AI_QUESTION_RESPONSE`)
  - `identity` → built from `business_name`, `agent_name`, `owner_name`, `niche='real_estate'`, `city`
  - `conversation_flow` → built from `call_handling_mode`, `services_offered`, `niche` defaults
  - `forbidden_actions` → standard real-estate forbidden block (no prices, no commission, no legal advice)
  - `faq_pairs` → from `clients.extra_qa`
  - `knowledge_summary` → from `clients.business_facts` + chunk count
  - `escalation_transfer` → from `forwarding_number`, `transfer_conditions`
- **Phrasing to lock into `niche_custom_variables` post-migration** (additive, before re-running `recomposePrompt`):
  - `GREETING_LINE`: `"Hey! This is Aisha, Hasan's AI assistant — I can book showings, answer questions, or get a message to Hasan. How can I help ya?"`
  - `AI_QUESTION_RESPONSE`: `"yeah, I'm Aisha — Hasan's AI assistant. I can answer questions about his services, book showings, and take messages."`
  - `niche_relationship_shortcut` (if a `niche_*` key for this exists; if not, this becomes acceptable loss).
  - Owner-specific quick responses block — surface via `extra_qa` rather than prompt prose.
- **Active features:** booking, SMS, transfer (forwarding +13068507687), pgvector knowledge (count unknown), Telegram. Plan = pro / sub = active.
- **Owner edit frequency:** **HIGH.** Hasan edits this prompt himself routinely (he's the engineer). Stale-snapshot risk is highest of the four.
- **Migration risk:** **HIGH.**
  - Custom phrasing density is highest of the four.
  - Active features are most numerous (booking + SMS + transfer + knowledge).
  - Hasan's own edit frequency means any pre-migration snapshot can go stale within hours.
  - The `transitionToBookingStage` orphan tool indicates this client has gone through prior pipeline migrations that left residue — re-running through another pipeline shift is more likely to surface latent issues.

---

### 3.2 `exp-realty` — Fatema for Omar Sharif (Hasan's father) at eXp Realty

- **Snapshot:** `exp-realty-system-prompt.txt`, 10628 chars (largest of the four).
- **Niche:** `real_estate`. Manzil Realty Group at eXp Realty, Saskatoon SK + Edmonton AB. Halal-financing referral via Manzil.
- **Existing blocks:**
  - Top — `LIVE VOICE PHONE CALL` envelope + `IDENTITY`
  - `OPENING` (Fatema-specific)
  - `EMERGENCY` (with explicit allowlist of triggers)
  - `CORE RULES` + `NEVER`
  - `TOOL FAILURES` (Pattern A + escalate=true handling)
  - `CLOSING`
  - `VOICE STYLE` (clean, polished, **no slang** — explicit "avoid 'gonna', 'kinda', 'wanna'") — different voice persona from Aisha
  - `MESSAGE FLOW` (with relationship-as-name shortcut)
  - `SHOWING INQUIRY`
  - `TRANSFER` (uses `transferCall` — this client has live transfer enabled)
  - `QUICK RESPONSES` (Manzil halal-financing block, Assalamu Alaikum)
  - `EDGE CASES`
  - `RETURNING CALLER`
  - `SPECIAL INSTRUCTION TAGS` (Pattern A inline)
  - `# CALENDAR BOOKING FLOW` (full 6-step flow with checkCalendarAvailability + bookAppointment)
- **Custom personality elements at risk under regeneration:**
  - The **explicit anti-slang** voice rule — Fatema is professional/polished, NOT "yeah/gonna/wanna." Slot pipeline `tone_and_style` defaults lean casual ("gotta", "lemme", "wanna" — see Brian's snapshot line 87). Migration will need `niche_custom_variables.VOICE_STYLE_OVERRIDE` or `agent_tone='professional_polished'` to preserve this.
  - The **Manzil halal-financing referral language** ("Shariah-compliant, no interest. He can connect you with the right people and walk you through the options") — distinctive Omar-brand phrasing.
  - The relationship-as-name shortcut ("his son, wife, brother, mom, Hasan") — same loss class as `hasan-sharif`.
  - **IVR pre-filter is enabled** (`ivr_enabled=true`, intentional, PSTN-only). Migration must not affect IVR — IVR is gated in the inbound webhook, not in the prompt, so this is a non-issue technically but worth verifying post-deploy.
- **Slot mapping:** Same as `hasan-sharif`. Additionally:
  - `tone_and_style` — must be customized to professional/polished. Set `agent_tone='professional'` or override via `niche_custom_variables`.
  - `escalation_transfer` — uses transferCall on explicit request. Brian's pipeline supports this via `forwarding_number` + `transfer_conditions`. Verify `transfer_conditions` is set on `clients` row before migration.
- **Phrasing to lock into `niche_custom_variables` post-migration:**
  - `GREETING_LINE`: `"Hi, you've reached Omar Sharif — I'm Fatema, his assistant. I can book showings, answer questions about his services, or get a message to him. What can I help you with?"`
  - `AI_QUESTION_RESPONSE`: `"yes, I'm Fatema — Omar's AI assistant. I take messages and he calls people back."`
  - `niche_voice_anti_slang`: `true` (or whatever the canonical key is — needs lookup in `prompt-slots.ts`)
  - Manzil halal-financing block — surface via `extra_qa` so it persists across regenerations.
- **Active features:** booking (with full calendar flow), SMS, transfer, IVR, pgvector knowledge, Telegram. Plan = pro / sub = none.
- **Owner edit frequency:** **MEDIUM.** Omar uses the dashboard but Hasan also edits on his behalf. Stale-snapshot risk medium.
- **Migration risk:** **HIGH.**
  - Largest prompt of the four (10628 chars) → highest combinatorial complexity.
  - Most active features (booking + SMS + transfer + IVR + knowledge) → most surfaces to drift on.
  - Voice persona is distinctly different from defaults (anti-slang) → risk of regenerated agent sounding wrong on first call.
  - IVR enabled, tested — any regression here affects PSTN routing.

---

### 3.3 `urban-vibe` — Alisha for Ray Kassam at Urban Vibe Properties (Calgary property management)

- **Snapshot:** `urban-vibe-system-prompt.txt`, 9623 chars.
- **Niche:** `'property-management'` (with hyphen — see normalization note in Section 6).
- **Existing blocks:**
  - Top — `LIVE VOICE PHONE CALL` envelope + `IDENTITY`
  - `OPENING` — **callerContext-aware**, explicitly: `"hey [name], good to hear from you again"` for returning callers, otherwise the wow-first niche default.
  - `EMERGENCY` (with Calgary-specific gas-smell routing to Atco Emergency)
  - `CORE RULES` + `NEVER`
  - `TOOL FAILURES`
  - `CLOSING`
  - `VOICE STYLE`
  - `GOAL`
  - **`TENANT LIST LOOKUP`** — context_data-driven tenant matching with privacy rule ("NEVER say the tenant name out loud"). This is unique-to-Ray and load-bearing.
  - `THE FILTER` (wrong number, spam, hours, AI question, hiring, commercial, bye, silent, non-English, triage)
  - `TRIAGE` — Calgary-winter-aware (no heat Oct–March = always urgent), Calgary-lockout-aware, water/leak diagnostic question, sewage/drain diagnostic, water-heater auto-urgent
  - `INFO COLLECTION`
  - `COMPLETION CHECK`
  - `EDGE CASES`
  - `SPECIAL INSTRUCTION TAGS`
  - `CALLER CONTEXT`
- **Custom personality elements at risk under regeneration:**
  - **The returning-caller line `"hey [name], good to hear from you again"`** — already exists in Brian's `returning_caller` slot at line 220-221 verbatim, so this **DOES survive** the migration. Verify post-deploy.
  - **Calgary-specific seasonal triage logic** ("no heat October through March is ALWAYS urgent", lockout cold-check question, gas-smell→Atco) — this is highly specific. Slot pipeline's `conversation_flow` for property_management has generic triage; the seasonal rules will not regenerate from canonical builders. Must surface via `niche_custom_variables` (`niche_seasonal_urgent_rules`?) or `extra_qa`.
  - **The water/leak diagnostic flow** ("is water actively coming in or more of a drip?") — diagnostic-first triage logic, not in canonical slot defaults. Brian's slot has a similar urgency tier system but the specific water-vs-drip question is custom.
  - **The TENANT LIST LOOKUP block with privacy rule** — depends on `clients.context_data` being populated AND a prompt block that references it. Brian's slot pipeline has a per-call `contextDataBlock` injection (per `agent-context.ts`), so the data path survives, but the explicit "NEVER say the tenant name out loud" privacy rule needs to be locked into `forbidden_actions` (likely via `niche_custom_variables` or `agent_restrictions`).
- **Slot mapping:** Brian's `calgary-property-leasing` is the closest analog — both are property management in Calgary. Migration here is structurally lowest-risk because the niche slot defaults will largely match.
- **Phrasing to lock into `niche_custom_variables` post-migration:**
  - `GREETING_LINE`: `"Thanks for calling Urban Vibe Properties — I'm Alisha, Ray's virtual assistant. I can log maintenance requests, get Ray to call you back, or help with rental inquiries. What's going on?"`
  - `niche_calgary_seasonal_urgent`: text describing Oct–March no-heat = urgent + lockout cold-check
  - `niche_water_leak_diagnostic`: the active-vs-drip question
  - `niche_tenant_list_privacy_rule`: "NEVER say the tenant name out loud — match silently and reference unit number only"
  - Atco Emergency gas-smell line — into `extra_qa`.
- **Active features:** SMS (twilio_number set), transfer (`+14036057142`), pgvector knowledge, NO booking. Plan = pro / sub = none.
- **Owner edit frequency:** **LOW–MEDIUM.** Ray uses the dashboard but less than Hasan. Last sync was 2026-03-30 (~30 days stale). The audit confirmed `last_agent_sync_status='success'` — only 1 of the 4 snowflakes that has *ever* successfully synced via the slot path (it ran once when a name field was edited via the safety-net 5b block).
- **Migration risk:** **MEDIUM.**
  - Niche overlap with Brian's working slot client is the highest of the four, so structural mapping is closest.
  - But the seasonal/Calgary-specific custom logic is dense and load-bearing for tenant trust.
  - Returning-caller line already lines up with the canonical slot — that's the one piece of "won't drift" certainty.
  - Brian's literal symptom class lives here — Ray is the most likely owner to actually file the complaint that triggers Pre-condition B.

---

### 3.4 `windshield-hub` — Mark for Sabbir at Windshield Hub Auto Glass (Saskatoon)

- **Snapshot:** `windshield-hub-system-prompt.txt`, 8586 chars (smallest of the four).
- **Niche:** `'auto-glass'` (with hyphen — same legacy convention as `urban-vibe`).
- **Existing blocks:**
  - Top — `LIVE VOICE PHONE CALL` envelope + `IDENTITY` (with hardcoded hours)
  - `OPENING` — callerContext-aware (returning caller path)
  - `EMERGENCY`
  - `CORE RULES`
  - `KNOWLEDGE LOOKUP` (mandatory queryKnowledge before deferring on services/insurance/timing)
  - `NEVER`
  - `TOOL FAILURES`
  - `CLOSING`
  - `VOICE STYLE` (no slang — "avoid 'gonna', 'kinda', 'wanna', 'ya', 'lemme'"; spell "v-i-n" out)
  - **`SERVICE FLOW`** — 5-step windshield-specific triage (chip vs crack vs replacement → vehicle YMM → sensor/lane-assist check → scheduling → close)
  - `VEHICLE INFO REDIRECT` (caller says bye before YMM given → one-shot redirect)
  - `QUICK RESPONSES`
  - `EDGE CASES`
  - `SPECIAL INSTRUCTION TAGS`
  - `CALLER CONTEXT`
- **Custom personality elements at risk under regeneration:**
  - **The 5-step SERVICE FLOW with windshield-specific triage** (chip→same-day fix, crack/spreading→full replacement, sensor/calibration question) — this is the entire reason the agent works. Slot pipeline's `conversation_flow` for `auto_glass` niche either has equivalent logic or doesn't. Must verify what `buildConversationFlow(ctx)` outputs for `niche='auto_glass'` BEFORE migration. If the canonical builder doesn't include the chip-vs-crack capability signal, migration will degrade the agent visibly.
  - **The "v-i-n" pronunciation rule** — small, but distinctive. Likely lives in `voice_naturalness` or `tone_and_style` but unverified for auto_glass niche.
  - **The vehicle-info-redirect (one-shot)** — a specific recovery flow when the caller tries to hang up before giving year/make/model. Probably not in canonical slots.
  - **No-slang voice persona** — same risk class as `exp-realty`.
- **Slot mapping:** `auto_glass` niche should have its own slot defaults. The migration will reveal whether those defaults are sufficient or whether `windshield-hub` has been carrying the niche on its hand-written prose alone.
- **Phrasing to lock into `niche_custom_variables` post-migration:**
  - `GREETING_LINE`: `"Windshield Hub Auto Glass, this is Mark — I can get you a quote or check availability. How can I help?"`
  - `niche_chip_vs_crack_capability_signal`: the chip→same-day, crack→replacement language
  - `niche_sensor_calibration_question`: "do you know if it's got that lane assist camera up by the mirror?"
  - `niche_vehicle_redirect`: the one-shot YMM recovery
  - `niche_vin_pronunciation`: "say 'v-i-n' spelled out, never 'vin'"
- **Active features:** SMS (twilio_number set), pgvector knowledge, NO transfer (no forwarding_number), NO booking, NO IVR. Plan = core / sub = none.
- **Owner edit frequency:** **LOW.** Sabbir doesn't edit the dashboard much; Hasan provisioned this one and lets it run.
- **Migration risk:** **LOW.**
  - Smallest prompt of the four (least surface area).
  - Fewest active features (just SMS + knowledge + hangUp).
  - Most stable owner (lowest stale-snapshot risk).
  - Auto-glass niche is well-scoped and the slot defaults likely cover the triage adequately.
  - Best candidate to migrate FIRST as a low-stakes proof-of-concept, before touching the higher-traffic Hasan/Omar clients.

---

### Risk summary

| Client | Migration Risk | Reason in one line |
|---|---|---|
| `hasan-sharif` | **HIGH** | Highest custom-phrasing density + highest owner edit frequency + most active features + orphaned tool residue |
| `exp-realty` | **HIGH** | Largest prompt + most features (incl. IVR + booking calendar) + distinctly anti-slang voice persona |
| `urban-vibe` | **MEDIUM** | Niche-aligned with reference client, but Calgary-seasonal triage and tenant-privacy rules are load-bearing custom logic |
| `windshield-hub` | **LOW** | Smallest prompt, fewest features, most stable owner — best candidate for a first migration if any happens at all |

**Recommended sequence if migration proceeds:** `windshield-hub` → `urban-vibe` → `exp-realty` → `hasan-sharif`. Smallest blast radius first, biggest blast radius last. This **inverts** the audit's user-impact ordering (which suggested `hasan-sharif` first based on traffic) — the deep-plan view is that risk-of-regression should dominate sequencing once Pre-condition A is satisfied, because each migration is ITSELF the proof that the slot pipeline can hold this client's persona.

---

## 4. The migration procedure (per client)

> **Format:** AI-readable SOP per `~/.claude/rules/meta-learning.md`. Maximum 3 commands per step. Triggers + Inputs + Steps + Exceptions explicit.

### Trigger

ALL of the following must be true before this SOP is invoked:

1. Pre-conditions A and B from Section 2 are satisfied.
2. Owner has explicitly requested per-field edit propagation on this snowflake (and the request can't be satisfied by Fix 1.5 / Fix 2 alone — i.e. the owner wants Greeting/CLOSE_PERSON/etc. to actually propagate, not just to know they don't).
3. User (Hasan) has explicitly lifted the no-redeploy rule for this client for this deploy. The standing rule in `.claude/rules/refactor-phase-tracker.md` ("**No Redeployment** to hasan-sharif, exp-realty, windshield-hub, urban-vibe. New architecture = new clients only.") is the gate. Lift it per-client, per-deploy, in writing.

### Inputs required

- `slug` — one of `hasan-sharif`, `exp-realty`, `urban-vibe`, `windshield-hub`.
- Pre-migration snapshot path (already exists at `docs/refactor-baseline/snapshots/2026-04-30-pre-d442/{slug}-system-prompt.txt`).
- Owner-approved diff from the dryRun in step 5.
- The set of `niche_custom_variables` entries that must be added BEFORE step 5 to preserve owner-specific phrasing (see Section 3 per client).

### Steps

**Step 1 — Fresh pre-migration snapshot.**
Settings may have changed since the 2026-04-30 audit. Take a fresh snapshot at deploy-time:
```bash
mkdir -p docs/refactor-baseline/snapshots/$(date +%Y-%m-%d)-pre-d445-{slug}
# Pull current clients.system_prompt for {slug} from Supabase, write to:
# docs/refactor-baseline/snapshots/{date}-pre-d445-{slug}/system-prompt.txt
```
Also dump `clients.*` row, `niche_custom_variables`, and Ultravox `GET /agents/{id}` response into the same directory.

**Step 2 — Add owner-specific phrasing to `niche_custom_variables` BEFORE regeneration.**
Per Section 3 of this plan, write the per-client overrides (`GREETING_LINE`, `AI_QUESTION_RESPONSE`, `niche_*` overrides for seasonal/triage/persona-specific phrasing) into `clients.niche_custom_variables` via Supabase admin update. This is the ONLY place pre-existing owner phrasing can be preserved across `recomposePrompt()`.

**Step 3 — Run `recomposePrompt({ slug, dryRun: true })`.**
This calls into `slot-regenerator.ts:526` with dryRun=true. Capture both `preview` (new prompt text) and `currentPrompt` (current stored). Note: `recomposePrompt` itself has the same `hasSlotMarkers` guard at L539-540 — for legacy-monolithic clients it returns `success: false`. **The migration must use a one-time bypass: either patch `recomposePrompt()` to accept a `forceRecompose` flag for migration, or use a separate one-shot script that calls `buildPromptFromSlots(ctx)` directly without the marker guard.** Document this bypass in the migration commit.

**Step 4 — Diff old vs new and write to review file.**
```bash
diff -u docs/refactor-baseline/snapshots/{date}-pre-d445-{slug}/system-prompt.txt /tmp/{slug}-recomposed.txt > docs/refactor-baseline/snapshots/{date}-pre-d445-{slug}/migration.diff
```
Review the diff for:
- **Missing client-specific phrasing** (cross-reference Section 3 risks for this client)
- **Lost callerContext-aware lines** — the new prompt should have `<!-- unmissed:returning_caller -->` block with the `"hey [name], good to hear from you again"` line. Verify it's there and substitution works.
- **After-hours block** — should be present; verify it matches the client's actual hours.
- **Knowledge block changes** — `<!-- unmissed:knowledge_summary -->` block should reflect current `extra_qa` + `business_facts` + chunk count.
- **Tool block changes** — the deployed `selectedTools` will be regenerated by `buildAgentTools()` post-deploy. Compare against current `clients.tools` to anticipate any tool-count change (see Section 6 for the expected `hangUp` repair).

**Step 5 — Owner reviews and approves/edits/rejects.**
Three outcomes:
1. **Approve** → proceed to Step 6.
2. **Edit `niche_custom_variables` to preserve specific phrasing** → return to Step 2 with the new overrides, re-run Step 3.
3. **Reject** → abort migration, document the blocker in `Tracker/D445-{slug}.md`, do NOT touch `clients.system_prompt`.

**Step 6 — `validatePrompt()` against the new prompt.**
Per `glm46-prompting-rules.md` (read first per `prompt-edit-safety.md`), the prompt must be < 12K chars (warn at 8K). Brian's slot-pipeline prompt is 24491 chars at the DB level — but that includes 17 markers worth of overhead. The new prompt for any of the 4 snowflakes should land between 10K–14K chars. **If validation fails (>12K post-marker-strip), compress the wow-first / FAQ blocks; do not truncate by hand.** Re-run from Step 3.

**Step 7 — Write proposed new prompt to snapshot directory for atomic rollback.**
```bash
# Write the recomposed prompt to:
# docs/refactor-baseline/snapshots/{date}-pre-d445-{slug}/proposed-new-prompt.txt
```
This is the rollback baseline if step 8/9/10 fail.

**Step 8 — `/prompt-deploy {slug}`.**
This is the ONLY command that lifts the standing no-redeploy rule for this client for this deploy. The skill at `~/.claude/skills/prompt-deploy/` writes to `clients.system_prompt`, calls `updateAgent()` against Ultravox, and runs `syncClientTools()` to repair `clients.tools`.

**Step 9 — Verify `last_agent_sync_status='success'` post-deploy.**
Query Supabase: `select last_agent_sync_status, last_agent_sync_at, last_agent_sync_error from clients where slug='{slug}'`. Status must be `'success'` and timestamp must be within the last 60 seconds. Also re-fetch `clients.tools` and compare to expected — `hangUp` should now be present (see Section 6).

**Step 10 — Test call.**
- If owner has Pro plan: use `/api/dashboard/test-call` (Path D — full Agents API path with toolOverrides).
- Otherwise: place a real test call to the agent's Twilio number from a separate phone.
- Run `/review-call {ultravox-call-id}` after the call completes.
- Confirm:
  - Greeting matches what the owner expects (the `GREETING_LINE` from `niche_custom_variables`).
  - Agent name correct ("Aisha" / "Fatema" / "Alisha" / "Mark").
  - For `hasan-sharif` / `exp-realty` / `urban-vibe` / `windshield-hub`: place a second call from the SAME phone number (return caller path) and confirm `"hey [name], good to hear from you again"` triggers correctly via `<!-- unmissed:returning_caller -->` block + callerContext substitution.
  - For `exp-realty`: confirm voice persona is still polished/anti-slang.
  - For `urban-vibe`: confirm Calgary seasonal triage rules still apply if the test call mentions "no heat" between Oct–March.
  - For `windshield-hub`: confirm chip-vs-crack capability signal still triggers.
  - For all: confirm `hangUp` works correctly at end of call.

**Step 11 — Mark complete.**
Update `Tracker/D445-{slug}.md` status to `done` with the deploy timestamp, snapshot directory, and review-call analysis link. Do NOT cascade automatically to the next snowflake — each migration requires fresh owner approval per Pre-condition B.

### Exceptions

- **Diff shows lost client-specific phrasing the owner wants kept:** add to `niche_custom_variables` BEFORE re-running Step 3. Do NOT edit the regenerated prompt directly post-step-3 — that re-introduces the snowflake problem this migration is solving.
- **`validatePrompt()` returns >12K:** compress wow-first / FAQ / inline_examples blocks; don't truncate by hand. If compression isn't enough, the client may not be migration-eligible without a niche-defaults rewrite.
- **Step 9 returns `last_agent_sync_status='error'`:** read `last_agent_sync_error`, fix the underlying issue (most likely a tool builder failure or knowledge-chunk-count mismatch), do NOT proceed to Step 10.
- **Step 10 test call shows wrong greeting / wrong name / wrong returning-caller line:** roll back per Section 5. The agent is now in a worse state than pre-migration; rollback is non-optional.
- **`recomposePrompt()` rejects with the marker guard despite the bypass in Step 3:** the bypass wasn't applied correctly. Stop. Do not retry. Investigate the bypass implementation before re-running.

---

## 5. Rollback procedure

If any post-deploy step fails (steps 8/9/10 return wrong behavior, sync error, or owner rejects on test call):

**Step R1 — Read the original snapshot.**
```bash
cat docs/refactor-baseline/snapshots/2026-04-30-pre-d442/{slug}-system-prompt.txt
```
This is the pre-Phase-1 audit baseline. Use this, not Step 1's fresh snapshot, because Step 1's fresh snapshot will already be byte-identical to whatever was deployed at migration-time.

**Step R2 — Write the original text back to `clients.system_prompt`.**
Via Supabase admin update. Single SQL UPDATE.

**Step R3 — Call `updateAgent()` against the Ultravox agent ID with the restored prompt.**
This is the same code path used by the deploy. Use `/prompt-deploy` with the restored snapshot file as input, OR a one-shot script that calls `updateAgent()` directly. **Do not skip this step** — the DB write alone leaves Ultravox out of sync.

**Step R4 — Verify `system_prompt` matches snapshot byte-for-byte.**
```bash
diff <(supabase select system_prompt from clients where slug='{slug}') docs/refactor-baseline/snapshots/2026-04-30-pre-d442/{slug}-system-prompt.txt
```
Must produce zero diff. If diff is non-empty, investigate before proceeding.

**Step R5 — Test call to confirm restored behavior.**
Same as Section 4 Step 10 acceptance checks — but inverted: confirm the agent is back to its pre-migration behavior.

**Step R6 — Document the failure mode.**
Append to `Tracker/D445-{slug}.md`:
- What step failed
- What the symptom was on the test call
- What was wrong with the regenerated prompt OR the deployment OR the niche defaults
- Whether this is a fixable issue (e.g. add a missing override to `niche_custom_variables`) or a stop-sign (e.g. canonical builder for this niche is fundamentally insufficient)
- If a new exception class was discovered, **update Section 4 of this plan** with a new "Exceptions" entry.

---

## 6. Carry-over from the audit

Findings from `overview-drift-audit-2026-04-30.md` that affect this migration:

### 6.1 Universal `clients.tools.hangUp` gap

All 4 snowflakes (and Brian's client) are missing `hangUp` from `clients.tools`. Per the audit's Section 7 risk #7 of `control-plane-mutation-contract.md`, `clients.tools` is runtime-authoritative via `toolOverrides: { removeAll: true, add: client.tools }`. The agents currently hang up correctly despite this — the audit flagged that this either means (a) `hangUp` is synthesized at call-creation time outside `buildAgentTools()`, (b) `removeAll: true` doesn't actually strip stored template tools, OR (c) `clients.tools` is stale and the next `syncClientTools()` will fix it.

**Implication for migration:** Step 8's `/prompt-deploy` will run `syncClientTools()` as a side effect, which will write a fresh `clients.tools` array. **If hypothesis (c) is correct, the migration will repair this gap as a side effect.** Add an explicit verification to Step 9: confirm `hangUp` is present in `clients.tools` post-deploy. If it is — hypothesis (c) confirmed and the gap is closed. If it isn't — there's a deeper issue in `buildAgentTools()` and the migration has surfaced it (which is a good outcome regardless).

### 6.2 `niche` slug normalization

- `urban-vibe.niche = 'property-management'` (hyphen)
- `windshield-hub.niche = 'auto-glass'` (hyphen)
- Brian's `calgary-property-leasing.niche = 'property_management'` (underscore — canonical)

The hyphen forms are tolerated in code paths but indicate an old provisioning convention. **Migration must normalize this** — update `clients.niche` to the underscore form BEFORE Step 3 runs `clientRowToIntake()`, which feeds `niche` directly to `buildSlotContext()`. The slot builders may dispatch on niche string match; a hyphen-vs-underscore mismatch could silently fall through to a default niche path.

Add to the per-client migration steps for `urban-vibe` and `windshield-hub` only:
```sql
update clients set niche = replace(niche, '-', '_') where slug in ('urban-vibe', 'windshield-hub');
```
Run this as Step 1.5, between snapshot and override-write.

### 6.3 `last_agent_sync_*` columns will be written for the first time on 3 of 4

`hasan-sharif`, `exp-realty`, and `windshield-hub` all have `last_agent_sync_status='unknown'` and `last_agent_sync_at=NULL` per the audit. The migration's `updateAgent()` call will be the first write to these columns for those clients. This is fine — the columns exist (migration `20260327000000`) — but worth noting:
- If Step 9 sees `unknown` AFTER deploy, the sync writer didn't fire, which is a bug.
- If Step 9 sees `success`, that's confirmation that `/prompt-deploy` invoked the writer correctly.
- `urban-vibe` already has `last_agent_sync_status='success'` from a 2026-03-30 name-field edit; it will be overwritten with the migration timestamp.

---

## 7. Acceptance criteria for "done"

A migration is **only** considered complete when ALL of the following are true:

1. **Owner-approved diff** — Step 5 produced an explicit "approve" decision in writing (in `Tracker/D445-{slug}.md` or equivalent).
2. **Pre-migration snapshot exists** at `docs/refactor-baseline/snapshots/{date}-pre-d445-{slug}/system-prompt.txt`.
3. **Post-migration snapshot exists** at `docs/refactor-baseline/snapshots/{date}-pre-d445-{slug}/proposed-new-prompt.txt` (this becomes the post-migration baseline as well).
4. **Test call passes greeting + name + returning-caller checks** per Step 10. The returning-caller test (call from same phone number twice) is non-optional — it's the actual verification that the slot pipeline is operating end-to-end.
5. **`last_agent_sync_status='success'`** after deploy, verified via direct Supabase query in Step 9.
6. **`Tracker/D445-{slug}.md` marked done** with deploy timestamp, snapshot directory paths, review-call analysis link.
7. **One follow-up Overview tile edit by the owner propagates correctly** — this is the actual proof that the migration unstuck the regenerateSlots failure mode. Until the owner edits one tile (e.g. changes a business hour, updates the agent's quick response on prices, etc.) and that edit shows up in the live agent on the next call, the migration is "deployed but unproven." Track this as a post-deploy gate, not a deploy gate — but log it explicitly in the tracker.

---

## Plan addendum — issues found while reading source code

While reading `slot-regenerator.ts` and the snapshots, three issues with the audit's conclusions / underlying assumptions surfaced. They don't invalidate the plan but should be addressed before any migration runs:

### Addendum 1 — `recomposePrompt()` itself has the marker guard

`slot-regenerator.ts:539-540` rejects ANY old-format prompt:
```ts
if (!hasSlotMarkers(client.system_prompt as string)) {
  return { success: false, promptChanged: false, error: 'Old-format prompt without section markers — migrate to slot format first (D304)' }
}
```
**This means `recomposePrompt({ slug, dryRun: true })` from the audit's recommended workflow CANNOT actually produce a preview for any of the 4 snowflakes.** Step 3 of the migration as the audit and original plan describe it is currently a non-starter. The plan calls for a one-time bypass (Section 4 Step 3 explicitly notes this), but the audit document does not mention this guard, only `regenerateSlots`. Anyone executing the plan blindly will hit a `success: false` response and may incorrectly conclude that migration isn't possible. **Surface this in the bypass implementation: add a `forceRecompose: true` parameter that skips L539-540, OR write a separate one-shot migration script that calls `buildPromptFromSlots(ctx)` directly without going through `recomposePrompt()`.**

### Addendum 2 — `niche_custom_variables` round-trip is via top-level keys, not nested

`slot-regenerator.ts:182-189` spreads `niche_*` keys from `niche_custom_variables` back to top-level intake keys:
```ts
const ncv = client.niche_custom_variables as Record<string, unknown> | null
if (ncv && typeof ncv === 'object') {
  for (const [k, v] of Object.entries(ncv)) {
    if (k.startsWith('niche_') && !(k in intake)) {
      intake[k] = v
    }
  }
}
```
**Only keys starting with `niche_*` are spread.** Keys like `GREETING_LINE`, `AI_QUESTION_RESPONSE`, `CLOSE_PERSON` (UPPER_CASE convention used in the audit and PROMPT_VARIABLE_REGISTRY) are NOT spread by this loop. They're read elsewhere (presumably via the variables registry path in `prompt-slots.ts`), but the migration's Section 3 phrasing-preservation strategy depends on knowing which override keys actually get consumed by which slot builder. **Before any migration, audit `prompt-slots.ts` to enumerate exactly which keys (`niche_*` vs uppercase variable names) feed which slots.** Otherwise overrides may silently be ignored and the migrated prompt won't preserve the owner's phrasing.

### Addendum 3 — Brian's client has 3 nested `<!-- unmissed:conversation_flow -->` markers

In Brian's snapshot at lines 104-203 there are THREE `<!-- unmissed:conversation_flow -->` opening tags and three matching closes. This is a pre-existing bug from a prior `regenerateSlots()` or `replacePromptSection()` call that wrapped an already-wrapped block. `replacePromptSection()` in `prompt-sections.ts` (not read in this pass) presumably uses regex matching on the markers. **If the regex is non-greedy and matches the innermost tags, future regenerations on Brian's client will work correctly. If it's greedy and matches outer-to-outer, future regenerations will overwrite the entire 100-line block including the nested wrappers, which would be fine.** Either way, it suggests `replacePromptSection()` has historically been called with input that double-wraps; the migration should avoid creating the same duplication in the 4 new slot-pipeline clients. **Add a verification step to Step 6: after `validatePrompt()`, count occurrences of each marker (`grep -c '<!-- unmissed:conversation_flow -->'`) and confirm exactly one open + one close per slot ID.** If a migrated client comes out double-wrapped, fix before deploy.
