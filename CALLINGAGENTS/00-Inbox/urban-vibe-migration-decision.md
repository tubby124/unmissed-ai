# Urban Vibe Snowflake Migration — Dry-Run Decision

**Run date:** 2026-04-30
**Source snapshot:** [urban-vibe-system-prompt.txt](../../docs/refactor-baseline/snapshots/2026-04-30-pre-d442/urban-vibe-system-prompt.txt) (9,623 bytes)
**Pre-migration DB state:** [urban-vibe-snowflake-pre-migration.json](urban-vibe-snowflake-pre-migration.json)
**New prompt (recompose preview):** [urban-vibe-snowflake-dryrun.json](urban-vibe-snowflake-dryrun.json) (`.preview` field, 20,838 bytes)
**Side-by-side diff:** [urban-vibe-snowflake-diff.txt](urban-vibe-snowflake-diff.txt) (408 lines)
**Investigation:** [urban-vibe-investigation.md](urban-vibe-investigation.md)

---

## TL;DR

**Recommendation: TWEAK FIRST → then GO.** Unlike Hasan (NO-GO), Urban Vibe is migratable but requires three pre-deploy patches: (1) Phase A SQL writes (4 statements), (2) one slot-pipeline bug fix (hours-rendering), (3) Ray's input on 5 open questions. With those done, the migration is a net win — Ray gets editing surfaces working AND picks up FHA/ESA compliance language he didn't have before.

**One-sentence rationale:** the dry-run produced a working callback-only property-management prompt that preserves 6 of 9 Ray-specific landmines and strengthens 2 more, but loses 3 (Calgary "Atco Emergency" script, "virtual assistant" wording, Ray's name) — all fixable via `niche_custom_variables` + `business_facts` overrides without code changes.

---

## Char-count comparison

| Metric | Old (snapshot) | New (recompose) | Delta |
|---|---|---|---|
| Total chars | 9,623 | 20,838 | **+11,215 (+117%)** |
| `validatePrompt()` result | n/a | passes | — |
| `validatePrompt()` warnings | — | 1 (length warning, ≥15K WARN cap per [settings-schema.ts:322](../../src/lib/settings-schema.ts#L322)) | +1 warning |
| Section markers | 0 (legacy monolithic) | 20 (`<!-- unmissed:* -->`) | +20 |
| Format | Pre-D274 monolithic | Slot-composed (D274) | structural change |

Smaller than Hasan's 23,418 (+181%) — predicted, since Urban Vibe has no booking/calendar/transfer slots active. But not the < 12K hoped for. Drivers: full property_management `TRIAGE_DEEP` (10 routes, 70+ lines), full `CLOSING_OVERRIDE` (6 priority closes), full `FORBIDDEN_EXTRA` (11 hard rules incl. FHA/ESA/pest). Each is load-bearing — none can be trimmed without losing real safety.

**Validation cap reminder:** `.claude/rules/prompt-edit-safety.md` claims 12K hard cap. Real code uses 15K WARN, 25K MAX ([settings-schema.ts:322-323](../../src/lib/settings-schema.ts#L322)). Same finding as Hasan's decision doc — `.claude/rules/prompt-edit-safety.md` is stale and should be synced.

---

## Risk-area side-by-side (9 Ray-specific landmines)

### 1. "Virtual assistant" wording (NOT "AI assistant") — vault rule, Ray's specific request

**Old (snapshot):**
> Thanks for calling Urban Vibe Properties — I'm Alisha, Ray's virtual assistant. (line 16)
> AI question: "yes, I'm Urban Vibe's virtual assistant — how can I help?" (line 87)

**New (recompose):**
> "Urban Vibe Properties — this is Alisha, an AI assistant. How can I help ya today?" (line 97)
> If asked, say: "Yeah, I'm an AI — but I'm here to help with Urban Vibe Properties..." (PERSONA, line 9)

**Verdict: LOST.** Direct vault-rule violation.

**Fix:** Phase A.2 — `niche_custom_variables.FORBIDDEN_EXTRA` includes 'NEVER call yourself an "AI assistant" — say "virtual assistant" instead'. Slot pipeline still emits the offending greeting (greeting line is preset-driven), so a follow-up code change to make `greetingLine` template-aware is recommended. **Acceptable contradiction for first migration; flag for Phase B.**

### 2. "gotcha" word ban — vault rule

**Old (snapshot):** never uses "gotcha" — uses "got it" throughout.

**New (recompose):** "gotcha" appears 3x (lines 26, 51, 76) — driven by `voice_style_preset='casual_friendly'` plus the hardcoded FORBIDDEN_ACTIONS rule 2 example list.

**Verdict: PARTIAL VIOLATION.** Without intervention, this WILL appear in the deployed prompt. The agent might or might not actually say "gotcha" depending on Ashley voice + GLM-4.6 attention to constraints, but the prompt encourages it.

**Fix:** Phase A.1 (switch preset to `professional_warm`) eliminates 2 of 3 sites. Phase A.2 adds explicit FORBIDDEN_EXTRA ban — handles the 3rd. Residual: rule 2's example list still includes "gotcha" but is now contradicted by the explicit ban. GLM-4.6 follows the most explicit rule. Acceptable.

### 3. Atco Emergency script for gas smell (Calgary-specific)

**Old (snapshot, line 23):**
> Gas smell: "okay — call Atco Emergency or 9-1-1 and get out. what's your name and unit so Ray can follow up?"

**New (recompose, INLINE_EXAMPLES Example E, line 226-231):**
> Caller: "I can smell gas in my apartment"
> You: "okay — call your gas company emergency line or 9-1-1 right now and get out of the building. what's your name and unit so the property manager can follow up?"

**Verdict: LOST.** "Atco Emergency" → "your gas company emergency line." Calgary brand-aware script gone.

**Why this matters:** Atco is the Alberta gas utility brand. Calgary tenants recognize "Atco Emergency" as a specific number to dial. "Your gas company emergency line" is generic and slower in panic.

**Fix:** Phase A.3 — populate `business_facts` with the Atco context. Per-call injection via `{{businessFacts}}` template variable. The agent will integrate Atco knowledge naturally on gas-leak triage. Verified mechanism: [agent-context.ts](../../src/lib/agent-context.ts) `buildAgentContext()` reads `business_facts` and injects.

### 4. Callback-only stance — TIED TO BLOCKER 4

**Old (snapshot, line 41):**
> Never pretend to transfer or put someone on hold — callback only.

**New (recompose):**
> Rule 5 (line 29): `Never say you are transferring. Transfer is not enabled — always route to callback.`
> Rule 14 (line 37): `NEVER transfer except for P1 emergencies (...) — and only when transfer is enabled. For all other calls, route to callback. NEVER pretend to put someone on hold.`
> ESCALATION_TRANSFER section (line 191-195): `# ESCALATION AND TRANSFER — TRANSFER NOT AVAILABLE`

**Verdict: PRESERVED + STRENGTHENED.** Three independent reinforcements. Even if `subscription_status` flips later, niche default still enforces P1-only transfer.

**Why transferEnabled resolved false:** `subscription_status='none'` blocks transfer entitlement at the slot context layer despite `forwarding_number` being set. Surprise upgrade. Document and accept.

### 5. Property-management never-list (rent / availability / pets / parking / utilities)

**Old (snapshot, line 42):**
> Never confirm rent amounts, availability, pet policy, parking, or utilities — route to Ray.

**New (recompose, FORBIDDEN_ACTIONS rule 12, line 35):**
> NEVER confirm or deny rent amounts, unit availability, pet policy, parking, or utilities — always route to manager.

**Plus:** repeated in TRIAGE rental inquiry (line 137), MOVE-IN/OUT (line 144), LEASE RENEWAL (line 148), PROPERTY OWNER (line 155).

**Verdict: PRESERVED + STRENGTHENED.** Stronger language ("confirm or deny") + multi-section reinforcement.

### 6. RTA / eviction / landlord-rights deflection (Alberta legal)

**Old (snapshot, line 43):**
> Never give legal advice — deflect RTA, eviction, or landlord rights questions to Ray.

**New (recompose, FORBIDDEN_ACTIONS rule 13, line 36):**
> NEVER give legal advice — deflect any RTA, eviction, or landlord rights questions to manager.

**Verdict: PRESERVED.** Same constraint, "manager" replaces "Ray" (fixable via `CLOSE_PERSON='Ray'` override in Phase A.2).

### 7. Returning caller flow

**Old (snapshot, lines 11-13):**
> Greet by name: "hey [name], good to hear from you again." If no name: "hey, I think you called before — how can I help?"
> Reference prior call topic briefly. Do NOT re-ask info already in prior call data. Get to next steps fast.

**New (recompose, RETURNING_CALLER, lines 197-205):**
> If callerContext includes RETURNING CALLER or CALLER NAME:
> 1. Greet by name if available: "hey [name], good to hear from you again"
> 2. Reference their last topic briefly from the prior call summary
> 3. Do NOT re-ask info already in prior call data
> 4. Skip small talk, get to next steps fast

**Verdict: PRESERVED.** Exact "hey [name], good to hear from you again" matches. Loses the "no name" fallback ("hey, I think you called before — how can I help?"). Minor loss; can re-add via `niche_custom_variables.RETURNING_CALLER_FALLBACK` if Ray asks.

### 8. Identity opener / capability list

**Old (snapshot, line 16):**
> Thanks for calling Urban Vibe Properties — I'm Alisha, Ray's virtual assistant. **I can log maintenance requests, get Ray to call you back, or help with rental inquiries.** What's going on?

**New (recompose, GREETING line 97):**
> "Urban Vibe Properties — this is Alisha, an AI assistant. How can I help ya today?"

**Verdict: LOST (capability list dropped).** Callers no longer know upfront what Alisha does. Less informative. Combined with Risk 1 (AI vs virtual assistant), greeting needs work.

**Fix:** Either (a) accept the loss and rely on TRIAGE to route any reasonable input, or (b) extend the slot pipeline with a `GREETING_SUFFIX` variable and override per-client. Option (a) is acceptable for migration; option (b) is a follow-up improvement.

### 9. Voice profile

**Old (snapshot, line 59):**
> Kind, alert, relaxed but sharp. Never tired or flat.

**New (recompose, TONE_AND_STYLE, line 72):**
> Upbeat and alert. Sound relaxed but sharp — never tired or flat.

**Verdict: PRESERVED.** Same intent, slightly different wording. Maps cleanly. With Phase A.1 switch to `professional_warm`, voice tone becomes more polished — closer to old "Kind, alert" than `casual_friendly`'s tradesy register.

---

## Risk-area scorecard

| # | Risk | Verdict | Fix |
|---|------|---------|-----|
| 1 | "virtual assistant" wording | LOST | Phase A.2 FORBIDDEN_EXTRA + Phase B code change |
| 2 | "gotcha" word ban | PARTIAL VIOLATION | Phase A.1 preset switch + A.2 FORBIDDEN_EXTRA |
| 3 | Atco Emergency script | LOST | Phase A.3 `business_facts` |
| 4 | Callback-only stance | PRESERVED + STRENGTHENED | none — accept + monitor billing flip |
| 5 | Never-list (rent/avail/pets/parking/utilities) | PRESERVED + STRENGTHENED | none |
| 6 | RTA / eviction deflection | PRESERVED | Phase A.2 `CLOSE_PERSON='Ray'` |
| 7 | Returning caller flow | PRESERVED | none (or A.2 `RETURNING_CALLER_FALLBACK` if Ray asks) |
| 8 | Identity opener / capability list | LOST | accept OR Phase B code change for greeting suffix |
| 9 | Voice profile | PRESERVED | Phase A.1 reinforces |

**Score: 4 PRESERVED, 2 PRESERVED+STRENGTHENED, 1 PARTIAL, 2 LOST.**

After Phase A: 4 PRESERVED, 2 PRESERVED+STRENGTHENED, 2 RECOVERED via DB, 1 RESIDUAL.

Compare Hasan: 1 PRESERVED, 1 PARTIAL, 3 LOST. Urban Vibe is materially better positioned because its niche_default (property_management) covers most Ray-specific behavioral constraints natively.

---

## DB state inputs to recompose

| Field | Current value | Notes |
|---|---|---|
| `slug` | `urban-vibe` | — |
| `niche` | `property-management` | Maps to `property_management` underscore key via `resolveProductionNiche()` |
| `business_name` | `Urban Vibe Properties` | Renders cleanly in IDENTITY |
| `agent_name` | `Alisha` | Preserved |
| `agent_voice_id` | `df0b14d7-...` (Ashley) | Voice locked. **Sensitive to drift — make live test call before pushing.** |
| `voice_style_preset` | **`casual_friendly`** | **CHANGE to `professional_warm` (Phase A.1)** |
| `niche_custom_variables` | **`null`** | **Populate (Phase A.2)** — root cause of personalization loss |
| `business_facts` | **`null`** | **Populate with Atco/Calgary context (Phase A.3)** |
| `extra_qa` | 1 entry: Ray callback policy | Clean. Keep. |
| `context_data` | `null` | Fine — TENANT LIST LOOKUP was aspirational, not wired |
| `forwarding_number` | `+14036057142` | Set. transferEnabled resolved false in slot ctx (subscription_status='none') |
| `transfer_conditions` | `null` | Fine for callback-only |
| `booking_enabled` | `false` | No booking slot ✓ |
| `sms_enabled` | `true` | **Verify with Ray — auto-SMS is new behavior.** |
| `ivr_enabled` | `false` | No IVR ✓ |
| `knowledge_backend` | `pgvector` | 34 approved chunks ✓ |
| `selected_plan` | `pro` | — |
| `subscription_status` | `none` | **Investigate (Blocker 3)** before deploy |
| `business_hours_weekday` | `Monday to Friday, 8:30am to 5pm` | DB clean. **Renders as `8:30 AMam` due to hours-bug** — Phase A.4 reformat |
| `business_hours_weekend` | `Saturday and Sunday, 10am to 4pm` | Same bug — Phase A.4 reformat |
| `injected_note` | `null` | — |
| `call_handling_mode` | `triage` | Full triage mode ✓ |

---

## Tool-array notes (D442 universal `hangUp` drift)

Same caveat as Hasan: `recomposePrompt()` does not modify `clients.tools`. Tool changes flow via `syncClientTools()` (separate code path). D442 audit reports DB(5) vs Ultravox(5) match with `pageOwner` (DB) vs `hangUp` (UV) divergence — same pattern across all 5 active clients, possibly a phantom finding from the D442 audit script missing `temporaryTool.modelToolName` (HTTP tools).

**Pre-deploy audit:** before flipping live, run a real tool-extractor sweep (scanning both `toolName` AND `temporaryTool.modelToolName`) to confirm the divergence. Per [memory `unmissed-tool-extractor-recurring-bug`](../../../.claude/projects/-Users-owner/memory/unmissed-tool-extractor-recurring-bug.md) — D444 closed but fix never applied.

If divergence is real: `syncClientTools()` will resolve when run after migration.
If divergence is phantom: no action needed.

**Either way: not a blocker for this dry-run.**

---

## Recommended pre-deploy patches (ordered)

### Phase A — Data hygiene (5 min, owner-approved SQL)

```sql
-- A.1 — Switch voice preset (eliminates 2 of 3 "gotcha" leak sites)
UPDATE clients SET voice_style_preset = 'professional_warm' WHERE slug = 'urban-vibe';

-- A.2 — Add Ray-specific overrides (preserves Ray's name + gotcha ban + virtual-assistant wording)
UPDATE clients SET niche_custom_variables = '{
  "CLOSE_PERSON": "Ray",
  "FORBIDDEN_EXTRA": "NEVER use the word \"gotcha\" — use \"got it\" or \"sure\" instead. NEVER call yourself an \"AI assistant\" — say \"virtual assistant\" instead. For gas smell or carbon monoxide alarm: tell them to call Atco Emergency or 9-1-1 and get out of the unit, then take their name and unit for Ray to follow up."
}'::jsonb WHERE slug = 'urban-vibe';

-- A.3 — Populate business_facts (Calgary context — Atco + Ray identity)
UPDATE clients SET business_facts = 'Urban Vibe Properties is a Calgary, Alberta property management company.
The property manager is Ray Kassam.
For natural-gas leaks or CO alarms: callers should phone Atco Emergency or 9-1-1 immediately and evacuate. Atco is the Alberta natural gas utility — Calgary tenants know the brand.
Property type: residential rentals only (no commercial). Service area: Calgary AB.
'::text WHERE slug = 'urban-vibe';

-- A.4 — Reformat hours to sidestep normalize24hHours() bug
UPDATE clients SET
  business_hours_weekday = 'Monday to Friday, 8:30 AM to 5:00 PM',
  business_hours_weekend = 'Saturday and Sunday, 10:00 AM to 4:00 PM'
WHERE slug = 'urban-vibe';

-- A.5 — Resolve billing inconsistency (PICK ONE — requires Ray/Hasan input)
-- Option A (concierge): leave as-is, document in Clients/urban-vibe.md
-- Option B (paid):    UPDATE clients SET subscription_status = 'active'   WHERE slug = 'urban-vibe';
-- Option C (trial):   UPDATE clients SET subscription_status = 'trialing' WHERE slug = 'urban-vibe';
```

### Phase B — Re-run dry-run + diff against this baseline

```bash
npx tsx scripts/dryrun-urban-vibe.ts
diff -u docs/refactor-baseline/snapshots/2026-04-30-pre-d442/urban-vibe-system-prompt.txt /tmp/urban-vibe-new-prompt-v2.txt > urban-vibe-snowflake-diff-v2.txt
```

Verify in re-run preview:
- "Ray" appears (CLOSE_PERSON)
- "Atco Emergency" appears (business_facts via {{businessFacts}})
- "virtual assistant" appears (FORBIDDEN_EXTRA bans "AI assistant")
- "gotcha" disappears from VOICE_NATURALNESS + TONE_AND_STYLE (rule 2 still has it — accept)
- Hours render `8:30 AM to 5:00 PM` (no `AMam` corruption)

If all pass → proceed to Phase C.
If any fail → debug root cause, file follow-up D-item, do NOT deploy.

### Phase C — Pre-deploy validation gate

1. Tools audit (real one, scanning both keys per `unmissed-tool-extractor-recurring-bug`)
2. `validatePrompt(newPrompt)` returns `valid:true`
3. Take a fresh snapshot named `urban-vibe-system-prompt-pre-d445-2026-XX-XX.txt` immediately before deploy (live state may have drifted from 2026-04-30 baseline)
4. Owner explicit approval — Hasan relays Ray's GO

### Phase D — Deploy via local script (NOT prod API)

```ts
// scripts/deploy-urban-vibe.ts (NOT WRITTEN — only after Phase A-C pass)
const result = await recomposePrompt(clientId, userId, /*dryRun*/ false, /*forceRecompose*/ true)
```

The prod endpoint [src/app/api/admin/recompose-client/route.ts](../../src/app/api/admin/recompose-client/route.ts) hardcodes `dryRun=false` and ignores body params — DO NOT use it for migration.

### Phase E — Post-deploy verification

1. Make a live test call (Ray's Twilio number `+15873296845`) — confirm greeting + Atco mention + Ray's name
2. `/review-call <ultravox-call-id>` — score on 5 dims
3. Verify `last_agent_sync_status='success'`
4. Update `Clients/urban-vibe.md`: snowflake-migration-target → migrated
5. Update `Tracker/D445.md`: urban-vibe → done

### Rollback path (if any phase fails)

```sql
UPDATE clients SET system_prompt = '<paste contents of docs/refactor-baseline/snapshots/2026-04-30-pre-d442/urban-vibe-system-prompt.txt>' WHERE slug = 'urban-vibe';
```
Then `updateAgent(ultravox_agent_id)` to push the rolled-back prompt to Ultravox.

---

## Open questions (Ray's call, Hasan to relay)

1. **Billing reality** — paying / free / concierge? Drives `subscription_status` decision.
2. **SMS auto-follow-up** — new prompt sends an SMS after every call (slot active because `sms_enabled=true`). OK or set `sms_enabled=false`?
3. **Transfer for true P1 emergencies** — niche default allows P1-only transfer (gas / no-heat / fire / break-in) IF entitlement gate opens. Strict callback-only or P1 transfer?
4. **Greeting capability list** — old prompt's "I can log maintenance requests, get Ray to call you back, or help with rental inquiries" was informative. Worth re-adding via a new variable?
5. **VIP_PROTOCOL slot** — new prompt registers VIP handling (lines 265-277), gated on runtime `VIP CONTACTS:` injection. Currently dormant for Urban Vibe. Acceptable as-is?

**Without answers to #1 and #2, do not deploy.** Other questions are nice-to-have but don't block migration safety.

---

## Anti-footguns

Same as Hasan dry-run:

- Never call `recomposePrompt(...,dryRun=false,...)` until Phase A-C pass and owner explicitly approves.
- Never call `POST /api/admin/recompose-client` for this migration — endpoint hardcodes `dryRun=false`, ignores body params.
- Never write `clients.system_prompt` directly — use `recomposePrompt()` so prompt_versions audit row + `updateAgent()` + `last_agent_sync_status` updates fire correctly.
- Never call `updateAgent(urban-vibe agent ID)` standalone — `recomposePrompt()` handles it inside `savePromptAndSync()`.
- Never modify `niche_custom_variables` until ready to deploy — Phase A.2 is the deploy-prep step, NOT a dry-run step.

---

## Bottom line

Urban Vibe is **migratable** with manageable pre-deploy work. Key differences from Hasan dryrun (NO-GO):

| Dimension | Hasan | Urban Vibe |
|---|-------|------------|
| Char growth | +181% (8.3K → 23.4K) | +117% (9.6K → 20.8K) |
| Risk areas LOST | 3 of 5 (60%) | 2 of 9 (22%) |
| Risk areas PRESERVED+STRENGTHENED | 0 | 2 |
| Niche default coverage | weak (real_estate has thin defaults) | **strong** (property_management has 11 hard rules + 10-route TRIAGE_DEEP) |
| Owner edit frequency | none — Hasan doesn't edit | **active** — Ray wants this |
| Pre-deploy SQL | major (4 critical patches) | minor (4 small patches + 1 owner-input gate) |

**Hasan's NO-GO was driven by the slot pipeline producing a generic real-estate template with no Hasan-specific scaffolding to pull from. Urban Vibe avoids this trap because property_management is one of the most thoroughly-defined niches in [niche-defaults.ts](../../src/lib/prompt-config/niche-defaults.ts).**

**Recommended decision: TWEAK FIRST, then GO.** Ray gets D449 sync chips, FHA/ESA compliance, and editing surfaces. Pay-for: 5 minutes of SQL + a slot-pipeline hours bug fix + 5 questions to confirm.

---

**Status:** dry-run + investigation complete. **PR not merged.** Awaiting owner GO/TWEAK/NO-GO call.

Tag Hasan: "Ray's call: GO/TWEAK/NO-GO?"
