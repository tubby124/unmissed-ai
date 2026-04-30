# Urban Vibe Snowflake Migration — Phase 1 Investigation

**Run date:** 2026-04-30
**Driver:** Ray Kassam wants editing surfaces working (D449 sync chips, recompose, etc.)
**Scope:** Read-only investigation. No DB writes. No deploy. No Ultravox sync.
**Pre-migration DB state:** [urban-vibe-snowflake-pre-migration.json](urban-vibe-snowflake-pre-migration.json)
**Dry-run preview:** [urban-vibe-snowflake-dryrun.json](urban-vibe-snowflake-dryrun.json) (`.preview` field)
**Diff:** [urban-vibe-snowflake-diff.txt](urban-vibe-snowflake-diff.txt)

---

## TL;DR

5 pre-dryrun blockers from cold-start inspected. **2 are real blockers, 1 is a slot-pipeline bug (affects all migrations, not just Urban Vibe), 2 are non-blockers.** Recommendation in [urban-vibe-migration-decision.md](urban-vibe-migration-decision.md): **TWEAK FIRST — proceed only after Phase A overrides + a slot-pipeline hours-rendering fix.**

---

## Blocker 1 — "gotcha" word ban vs slot pipeline conflict

**Vault rule:** "Word 'gotcha' is BANNED — forever, all agents. Use 'got it' instead."
**Status: REAL BLOCKER. Recommendation: override via `niche_custom_variables` + leave one residual contradiction in FORBIDDEN_ACTIONS rule 2.**

### Where "gotcha" appears in the new prompt

Confirmed via `grep -nE "gotcha" /tmp/urban-vibe-new-prompt.txt`. Three sites:

| # | Slot | Line | Source | Override path |
|---|------|------|--------|---------------|
| 1 | `forbidden_actions` rule 2 | 26 | [src/lib/prompt-slots.ts:253](../../src/lib/prompt-slots.ts#L253) — **hardcoded** in `buildForbiddenActions()` baseRules. Lists "gotcha" as a recommended phrase example. | None. `forbiddenExtraRules` is additive (line 244-246) — cannot replace baseRules. Code change required to make rule 2 preset-aware. |
| 2 | `voice_naturalness` | 51 | `ctx.fillerStyle` driven by `voice_style_preset='casual_friendly'` ([voice-presets.ts:98](../../src/lib/voice-presets.ts#L98)) | Switch preset → `professional_warm` (no "gotcha" filler) or `direct_efficient` (explicitly bans "gotcha" — voice-presets.ts:140). |
| 3 | `tone_and_style` | 76 | `ctx.toneStyleBlock` from same preset ([voice-presets.ts:94](../../src/lib/voice-presets.ts#L94)) | Same fix as #2. |

### Rule 2 hardcoded behavior (the residual issue)

```ts
// src/lib/prompt-slots.ts:253
2. Never say "certainly," "absolutely," "of course," or "I will." Use "yeah for sure," "you got it," "gotcha," or "I'll."
```

Rule 2's intent is "don't sound corporate" — listing "gotcha" as a recommended replacement is incidental, not load-bearing. But the slot pipeline cannot drop "gotcha" from the example list without a code change.

### Recommended pre-deploy patches (Blocker 1)

**Phase A.1 — set `voice_style_preset='professional_warm'`** (1 SQL update). Removes 2 of 3 leak sites and is also a better fit for Ray's "kind, alert, relaxed but sharp" voice profile than `casual_friendly` (which leans informal/tradesy).

**Phase A.2 — append explicit ban via `niche_custom_variables.FORBIDDEN_EXTRA`:**
```
NEVER use the word "gotcha" — use "got it" or "sure" instead. This applies even though the example list above includes it. The ban is non-negotiable.
```
Yes, this contradicts rule 2's example list. Acceptable contradiction: GLM-4.6 follows the most explicit/recent rule. Document the contradiction so future contributors don't try to "fix" it.

**Phase A.3 (optional code change, defer to follow-up) — make rule 2 preset-aware** so `direct_efficient` and `professional_warm` presets render rule 2 without "gotcha". Out of scope for this migration, but file as a separate D-item.

---

## Blocker 2 — "PENDING DEPLOY for buildVoicemailPrompt()" stale item

**Status: RESOLVED. Not a blocker.**

`buildVoicemailPrompt()` lives in [src/lib/prompt-niches/voicemail-prompt.ts](../../src/lib/prompt-niches/voicemail-prompt.ts). Last commit: `710bdba feat: recording consent + AI Receptionist 200min + realtor UX polish (#35)` — already merged to `main` (2026-03-XX). The "PENDING DEPLOY" item in `.claude/rules/refactor-phase-tracker.md` is stale.

Additionally, **Urban Vibe is in `call_handling_mode='triage'`** (full mode), not voicemail/message_only. The voicemail builder doesn't run for this client at all. Even if `buildVoicemailPrompt()` had open issues, it wouldn't block Urban Vibe migration.

**Action:** Phase tracker line 1067 (`⚠️ urban-vibe — DO NOT deploy until after test call confirms voicemail builder output`) can be deleted in a follow-up sweep. Not part of this PR.

---

## Blocker 3 — Billing inconsistency (`selected_plan='pro'` + `subscription_status='none'`)

**Status: NON-BLOCKER for dryrun. Defer to deploy-prep. Document as open question for Hasan to relay to Ray.**

DB state confirmed:
- `selected_plan='pro'`
- `subscription_status='none'`
- `forwarding_number='+14036057142'` (Ray's cell)

### What this affects

[buildAgentTools()](../../src/lib/ultravox.ts#L789) gates `transferCall` registration on `forwarding_number && plan.transferEnabled && slug`. The `plan.transferEnabled` boolean comes from `getPlanEntitlements(selected_plan)`. Pro plan = `transferEnabled: true`. Tool would be registered.

But [buildAgentTools()](../../src/lib/ultravox.ts) ALSO inspects `subscription_status` for the trialing bypass, and the slot pipeline's `transferEnabled` context flag may resolve differently than the tool gate. **Empirical observation from this dry-run:** the recomposed prompt rendered `Transfer is not enabled` (line 29) and `# ESCALATION AND TRANSFER — TRANSFER NOT AVAILABLE` (line 191), confirming `ctx.transferEnabled === false` despite `forwarding_number` being set. Likely driver: `subscription_status='none'` is treated as "no active subscription" → transfer locked off.

### What this means for migration

- **Dryrun:** safely produced a callback-only prompt — actually preserves Ray's stance better than expected.
- **Tool registration:** ambiguous. `clients.tools` audit (D442) showed transferCall present in DB; recompose/sync didn't run, so this hasn't been re-evaluated. Need a `clients.tools` sweep + `syncClientTools()` dry-run before deploy.
- **Billing reality:** is Ray a paying customer? If `subscription_status='none'`, was he ever paying? Or is he in concierge/manual state like Velly/Brian?

### Open questions (Hasan to relay to Ray, OR check Stripe directly)

1. Is Ray a paying customer, free, or concierge? (concierge is most likely — fits the "Pro plan, no Stripe sub" pattern from D437)
2. Should `transferCall` tool stay registered in `clients.tools` even though new prompt says transfer is disabled? (Answer probably: drop it from `clients.tools` for consistency. `syncClientTools()` post-migration will handle this if `subscription_status` controls transfer entitlement.)

**Don't migrate until #1 is answered.** Tools may differ from what new prompt says.

---

## Blocker 4 — `forwarding_number` set + callback-only prompt

**Status: NON-BLOCKER. Niche default already enforces callback-only-except-P1-emergencies. Surprise upgrade.**

### Old prompt stance (snapshot line 41)
> Never pretend to transfer or put someone on hold — callback only.

### New prompt stance (3 reinforcing lines)
- FORBIDDEN_ACTIONS rule 5 (line 29): `Never say you are transferring. Transfer is not enabled — always route to callback.`
- FORBIDDEN_ACTIONS rule 14 (line 37, from property_management `FORBIDDEN_EXTRA`): `NEVER transfer except for P1 emergencies (active flooding, burst pipe, gas smell, electrical fire, no heat in winter, active break-in) — and only when transfer is enabled. For all other calls, route to callback. NEVER pretend to put someone on hold.`
- ESCALATION_TRANSFER section (lines 191-195): `# ESCALATION AND TRANSFER — TRANSFER NOT AVAILABLE` — full block dedicated to "i'll have the property manager give ya a call back" handling.

### Why transferEnabled resolved false

Tied to Blocker 3. `subscription_status='none'` → slot pipeline treats this as "no active sub" → transfer disabled. The fact that `forwarding_number` is set doesn't matter when the entitlement gate fails first.

### Decision

Keep `forwarding_number='+14036057142'` as-is. The new prompt + niche default match Ray's old stance. If billing flips to `subscription_status='active'` later, we'll need to either (a) clear `forwarding_number` or (b) accept that transfer becomes available — re-decide at that time. For now, no action needed.

**One follow-up open question:** does Ray want transfer for true P1 emergencies (e.g., gas leak in his Calgary buildings) so the agent can patch through to Ray live? The property_management niche default ALLOWS it for P1 only. If Ray wants strict callback-only-no-exceptions, FORBIDDEN_EXTRA would need to override. Defer to Ray.

---

## Blocker 5 — D442 universal `hangUp` tool drift

**Status: NON-BLOCKER for migration. Universal pattern, unrelated to Urban Vibe.**

D442 Phase 1 audit: all 5 active clients (`hasan-sharif`, `exp-realty`, `urban-vibe`, `windshield-hub`, `manzil-isa`) show DB(5) vs Ultravox(5) tool count match, with DB containing `pageOwner` and Ultravox containing `hangUp` instead. Per [feedback memory `unmissed-tool-extractor-recurring-bug`](../../../.claude/projects/-Users-owner/memory/unmissed-tool-extractor-recurring-bug.md), this finding may be a phantom — the audit script missed `temporaryTool.modelToolName` (HTTP tools) and only scanned `toolName` (built-ins). Re-confirm with both keys before treating as drift.

`recomposePrompt()` does not touch `clients.tools`. Migration won't change this. If post-migration `syncClientTools()` runs, the divergence (real or phantom) may resolve. Note in decision doc; do not block.

---

## NEW finding: Slot-pipeline hours-rendering bug (affects ANY client with no-space am/pm)

**Status: BLOCKS DEPLOY. Affects all snowflakes with similar `business_hours_*` formats. Surfacing here so it doesn't migrate forward.**

### Symptom

New prompt renders hours as **"Monday to Friday, 8:30 AMam to 5pm"** in 4 places (lines 41, 42, 103, 104). The literal `AMam` is a corruption of the input `8:30am`.

### Root cause

[src/lib/prompt-slots.ts:669-679](../../src/lib/prompt-slots.ts#L669-L679) — `normalize24hHours()`:

```ts
export function normalize24hHours(raw: string): string {
  if (/\b[AP]M\b/i.test(raw)) return raw  // skip if already has AM/PM
  return raw.replace(/(\d{1,2}):(\d{2})/g, (_, h, m) => {
    const hour = parseInt(h, 10)
    if (hour < 12) return `${hour}:${m} AM`
    // ...
  })
}
```

The guard `\b[AP]M\b` requires word boundaries on both sides of "AM"/"PM". Input `8:30am to 5pm` has:
- `am` directly attached to `0` (no boundary between digit and letter — both are word chars)
- `pm` attached to `5`

So the guard returns false, and the regex `(\d{1,2}):(\d{2})` matches `8:30` and rewrites to `8:30 AM`. Result: original `am` remains in place → `8:30 AMam`. The `5pm` doesn't match `\d:\d\d` (no colon), so it survives untouched.

### Verified

Input from DB: `Monday to Friday, 8:30am to 5pm` (clean — see pre-migration JSON).
Output in new prompt: `Monday to Friday, 8:30 AMam to 5pm` (corrupted).

### Recommended fix (out of scope for this PR — file as new D-item)

Three options:
1. **Tighten the input format check:** `/(?:^|\s)\d{1,2}:?\d{0,2}\s*[AP]M\b/i.test(raw)` — recognize "8:30am" without word boundary.
2. **Pre-strip space-less am/pm before normalize:** `.replace(/(\d):([ap]m)/gi, '$1:$2 ')` to insert a space, then run normalize, then re-trim.
3. **Just bail out earlier:** `if (/\d[ap]m/i.test(raw)) return raw` — catches the common case.

### Why this blocks Urban Vibe deploy

The corrupted `8:30 AMam` would render to callers asking "are you open?" — Alisha would say "yeah we're open Monday to Friday, eight thirty AM am to five PM" or similar. Audible nonsense. Not deployable.

**Pre-deploy gate:** EITHER fix `normalize24hHours()` OR re-format `business_hours_weekday` to `'Monday to Friday, 8:30 AM to 5:00 PM'` (with proper spaces — sidesteps the bug). Recommended: do both. Format the DB cleanly + ship the bug fix as a separate PR.

---

## Char budget validation

| Metric | Old (snapshot) | New (recompose) | Delta |
|---|---|---|---|
| Total chars | 9,623 | 20,838 | **+11,215 (+117%)** |
| `validatePrompt()` result | n/a | passes | — |
| Position vs caps ([settings-schema.ts:322-323](../../src/lib/settings-schema.ts#L322)) | — | between WARN (15K) and MAX (25K) | warning band |
| Section markers | 0 (legacy monolithic) | 20 (`<!-- unmissed:* -->`) | +20 |

Acceptable. Smaller than Hasan's 23,418 (as predicted — Urban Vibe is simpler: no booking, no calendar). But not the < 12K we hoped for. Drivers of growth: full property_management `TRIAGE_DEEP` (10 routes, 70+ lines), full `CLOSING_OVERRIDE` with 6 priority-tier closes, full `FORBIDDEN_EXTRA` (11 hard rules including FHA, ESA, pest control). Each is load-bearing — none can be trimmed without losing real safety.

---

## DB state inputs to recompose

From [urban-vibe-snowflake-pre-migration.json](urban-vibe-snowflake-pre-migration.json):

| Field | Value | Notes |
|---|---|---|
| `slug` | `urban-vibe` | — |
| `niche` | `property-management` (with hyphen) | Maps to `property_management` (underscore) via `resolveProductionNiche()` line 1420. ✓ |
| `business_name` | `Urban Vibe Properties` | Renders cleanly in IDENTITY |
| `agent_name` | `Alisha` | Preserved |
| `agent_voice_id` | `df0b14d7-945f-41b2-989a-7c8c57688ddf` (Ashley) | Unchanged. Voice locked per Ray. |
| `voice_style_preset` | **`casual_friendly`** | **Driver of Blocker 1 — recommend switch to `professional_warm`** |
| `niche_custom_variables` | **`null`** | **Root cause — no Ray-specific overrides** |
| `business_facts` | **`null`** | **No Calgary/Atco context to inject per-call** |
| `extra_qa` | 1 entry: Ray callback policy | **Clean** — not junk like Hasan's `furnace repair → $750/hr` |
| `context_data` | `null` | TENANT LIST LOOKUP (old prompt) was aspirational — never wired |
| `tools` | (not in this audit, see D442) | Defer to deploy-prep |
| `forwarding_number` | `+14036057142` | Set, but transferEnabled=false in slot ctx |
| `transfer_conditions` | `null` | Fine for callback-only |
| `booking_enabled` | `false` | No booking slot rendered ✓ |
| `sms_enabled` | `true` | **SMS_FOLLOWUP slot now active in new prompt — verify Ray wants this** |
| `ivr_enabled` | `false` | No IVR ✓ |
| `knowledge_backend` | `pgvector` | 34 approved chunks. Knowledge slot active. |
| `selected_plan` | `pro` | — |
| `subscription_status` | `none` | **Tied to Blocker 3 — open question** |
| `business_hours_weekday` | `Monday to Friday, 8:30am to 5pm` | DB clean. **Renders corrupted (Hours bug above).** |
| `business_hours_weekend` | `Saturday and Sunday, 10am to 4pm` | Same bug — would render as `10 AMam to 4pm`. |
| `after_hours_behavior` | (not extracted) | Doesn't appear to drive prompt content |
| `injected_note` | `null` | — |
| `call_handling_mode` | `triage` | Full triage mode ✓ |

---

## Summary — what changes if we proceed

### Wins (from migration)
- 20 explicit slot markers — D449 sync chips will work, Ray can edit individual sections
- FAIR HOUSING ACT compliance language (FHA $150K penalty rule) — was missing in old prompt
- Service animal / ESA protection language — was missing
- Pest control / bedbug protocol — was missing
- TRIAGE detail (10 routes vs old ~7) — RENTAL with showing-time capture, MOVE-IN/OUT, LEASE RENEWAL, PROPERTY OWNER all now explicit
- COMPLETION CHECK + read-back-and-confirm flow before `submitMaintenanceRequest`
- Callback-only-except-P1 stance preserved (and explicitly documented)

### Losses (from migration)
- "virtual assistant" wording → "AI assistant" (vault rule violation — fixable via FORBIDDEN_EXTRA override)
- Atco Emergency script → generic "your gas company emergency line" (Calgary-specific knowledge lost — fixable via `business_facts`)
- Ray's name → "the property manager" (depersonalization — fixable via `niche_custom_variables.CLOSE_PERSON='Ray'`)
- Greeting capability list ("log maintenance requests, get Ray to call you back, or help with rental inquiries") → "How can I help ya today?" (informational loss — fixable via prompt patch or accept)
- "gotcha" leaked 3x in new prompt where old never used it (preset + hardcoded — partially fixable)
- TENANT LIST LOOKUP behavior — aspirational only, no real loss

### Pure bugs (NOT migration-related, but block deploy if unfixed)
- Hours rendering: `8:30am` → `8:30 AMam` (slot-pipeline bug — blocks deploy until fixed or DB hours reformatted)

---

## Recommended pre-deploy SQL (Phase A — data hygiene)

**DO NOT RUN. This is the recommended sequence for the eventual deploy after Ray approves.**

```sql
-- 1. Switch voice preset (eliminates 2 of 3 "gotcha" leak sites)
UPDATE clients SET voice_style_preset = 'professional_warm' WHERE slug = 'urban-vibe';

-- 2. Add Ray-specific overrides (preserves Ray's name + Atco + virtual-assistant wording)
UPDATE clients SET niche_custom_variables = '{
  "CLOSE_PERSON": "Ray",
  "FORBIDDEN_EXTRA": "NEVER use the word \"gotcha\" — use \"got it\" or \"sure\" instead. NEVER call yourself an \"AI assistant\" — say \"virtual assistant\" instead. For gas smell or carbon monoxide alarm: tell them to call Atco Emergency or 9-1-1 and get out of the unit, then take their name and unit for Ray to follow up."
}'::jsonb WHERE slug = 'urban-vibe';

-- 3. Add business_facts (Calgary context — Atco, dual brand identity)
UPDATE clients SET business_facts = 'Urban Vibe Properties is a Calgary, Alberta property management company.
The property manager is Ray Kassam.
For natural-gas leaks or CO alarms: callers should phone Atco Emergency or 9-1-1 immediately and evacuate. Atco is the Alberta natural gas utility — Calgary tenants know the brand.
Property type: residential rentals only (no commercial). Service area: Calgary AB.
'::text WHERE slug = 'urban-vibe';

-- 4. Reformat hours to sidestep normalize24hHours() bug (until bug is fixed)
UPDATE clients SET
  business_hours_weekday = 'Monday to Friday, 8:30 AM to 5:00 PM',
  business_hours_weekend = 'Saturday and Sunday, 10:00 AM to 4:00 PM'
WHERE slug = 'urban-vibe';

-- 5. Resolve billing inconsistency (REQUIRES OWNER INPUT — pick one)
-- Option A — concierge state: leave as-is, document
-- Option B — flip to active: UPDATE clients SET subscription_status = 'active' WHERE slug = 'urban-vibe';
-- Option C — flip to trialing: UPDATE clients SET subscription_status = 'trialing' WHERE slug = 'urban-vibe';
```

After Phase A: re-run `npx tsx scripts/dryrun-urban-vibe.ts` and re-diff to confirm Ray's name appears, Atco appears, "virtual assistant" appears, "gotcha" disappears (mostly), hours render cleanly.

---

## Open questions for Hasan to relay to Ray (Phase B prerequisites)

1. **Billing reality:** Is Urban Vibe a paying customer, free trial, or concierge? Drives `subscription_status` decision and `transferCall` registration.
2. **SMS follow-up:** New prompt auto-sends a follow-up SMS after every call (SMS_FOLLOWUP slot, lines 255-263, gated on `sms_enabled=true`). Ray's old prompt didn't do this. Does Ray want auto-SMS, or should we set `sms_enabled=false`?
3. **Transfer for true P1 emergencies:** Niche default allows transfer for active flooding / gas / fire / no-heat-winter / break-in IF the entitlement gate is open. Does Ray want true callback-only with NO exceptions, or P1-only transfer?
4. **Greeting capability list:** "log maintenance requests, get Ray to call you back, or help with rental inquiries" — is this important to keep? If yes, ship as a `niche_custom_variables.CUSTOM_GREETING_SUFFIX` (would require a new variable).
5. **VIP_PROTOCOL slot:** New prompt registers VIP handling (lines 265-277) gated on runtime `VIP CONTACTS:` injection in callerContext. Currently no VIP setup for Urban Vibe — slot is dormant. Acceptable. (Document, don't block.)

---

## Anti-footgun reminders (carried from cold-start)

- **Working tree was clean before branch cut** ✓ (PR #67 stash check passed)
- **dotenv path:** `.env.local` ✓ (not bare `.env`)
- **Result fields:** `.preview` and `.currentPrompt` (NOT `.newPrompt`) ✓
- **Prod API ignores `dryRun` body param** — never use `POST /api/admin/recompose-client` for this work
- **No `clients.system_prompt` write, no `updateAgent()`, no `syncClientTools()`** — confirmed via `recomposePrompt(...,dryRun=true,...)` returning before save block

---

## Phase 1 deliverables status

- [x] [urban-vibe-snowflake-pre-migration.json](urban-vibe-snowflake-pre-migration.json) — current DB state
- [x] [urban-vibe-snowflake-dryrun.json](urban-vibe-snowflake-dryrun.json) — recompose preview
- [x] [urban-vibe-snowflake-diff.txt](urban-vibe-snowflake-diff.txt) — 408-line side-by-side diff
- [x] This file (Phase 1 investigation, 5 blockers resolved)
- [x] [urban-vibe-migration-decision.md](urban-vibe-migration-decision.md) — TL;DR + 9 risk areas + GO/TWEAK/NO-GO recommendation
- [x] [scripts/dryrun-urban-vibe.ts](../../scripts/dryrun-urban-vibe.ts)
