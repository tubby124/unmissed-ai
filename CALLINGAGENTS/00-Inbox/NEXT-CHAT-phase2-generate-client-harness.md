---
type: next-chat-resume
project: endvoicemail
status: ready
created: 2026-06-04
parent: "[[../../../Obsidian Vault/Projects/unmissed/2026-06-03-auto-harness-onboarding-plan]]"
related:
  - "[[NEXT-CHAT-production-harness-foundation]]"
tags:
  - next-chat
  - production-harness
  - phase-2
  - generate-client-harness
---

# NEXT-CHAT — Phase 2: `generate-client-harness.ts`

## Session-start command (paste into the new chat)

```
Read CALLINGAGENTS/00-Inbox/NEXT-CHAT-phase2-generate-client-harness.md
and CALLINGAGENTS/00-Inbox/NEXT-CHAT-production-harness-foundation.md
and the parent vault note 2026-06-03-auto-harness-onboarding-plan.md.

Phase 1 shipped — tests/promptfoo/niche-templates/property_management.yaml
exists with 50 canonical scenarios. Phase 2 task: build
scripts/generate-client-harness.ts that turns the niche template into a
per-client baseline YAML, then auto-appends client-data scenarios from
extra_qa.

Standing rules: no redeploys to hasan-sharif, exp-realty, urban-vibe,
windshield-hub, velly-remodeling without explicit owner go. Brian
(calgary-property-leasing) has carve-out. Validate Phase 2 against
Brian first because his hand-curated 31-scenario harness is the truth
floor — auto-gen output must cover ≥ all 31.
```

## What shipped 2026-06-04 (Phase 1)

`tests/promptfoo/niche-templates/property_management.yaml` — 50 scenarios
across 7 layers, all deterministic (`icontains-any` /
`not-icontains-any`), no `llm-rubric`. Generalized from
`tests/promptfoo/brian-stress-identity-tier.yaml` (31 scenarios, all
PASS on Brian's identity-tier draft as of 2026-06-03).

Layer counts (matches auto-harness plan exactly):

| Layer | Count |
|---|---|
| Identity (Tier A) | 5 |
| Policy (Tier B) | 15 |
| Scope / Tier C | 10 |
| Safety / regulatory | 6 |
| Conversation discipline | 7 |
| Edge cases | 5 |
| Returning caller | 2 |
| **Total** | **50** |

## Placeholder substitution contract (Phase 2 must implement)

The template uses `{{PLACEHOLDER}}` markers. Generator does plain string
replace — promptfoo never sees `{{...}}`.

| Placeholder | Source | Example |
|---|---|---|
| `{{SLUG}}` | `clients.slug` | `calgary-property-leasing` |
| `{{BUSINESS_NAME}}` | `clients.business_name` | `Calgary Edmonton Property Leasing` |
| `{{CLOSE_PERSON}}` | **`clients.niche_custom_variables.CLOSE_PERSON`** (JSON column — NOT a top-level field). Fallback chain: `niche_custom_variables.CLOSE_PERSON ?? owner_name ?? 'our team'` | `Brian` |
| `{{SERVICE_AREA_PRIMARY}}` | `clients.niche_custom_variables.SERVICE_AREA` (JSON, comma-split take [0]) — fallback to a city derived from `business_facts` | `Calgary` |
| `{{SERVICE_AREA_SECONDARY}}` | same source, take [1] OR repeat primary if only one | `Edmonton` |
| `{{OFFICE_HOURS_DISPLAY}}` | composed from `clients.business_hours_weekday` + `business_hours_weekend` | `Monday–Sunday Open 24 hours` |
| `{{OFFICE_HOURS_KEYWORDS}}` | YAML inline list — substrings any of which is valid hours evidence | `["24 hours","open 24","Monday","weekday","weekend","9","8","5"]` |
| `{{SNAPSHOT_PATH}}` | per-run snapshot file path | `snapshots/calgary-property-leasing-baseline-2026-06-04.txt` |
| `{{TODAY}}` | ISO date at generation time | `2026-06-04` |
| `{{CURRENT_TIME}}` | 24h `HH:MM` at generation time | `14:30` |

**Two placeholders that look real but are not generator-substituted:** they were removed from the contract during Phase 1 cleanup because the assertion values are already hardcoded to PM-niche-universal keywords (`property|leasing|rental|management|rent|landlord`). The `{{PLACEHOLDER}}` string literal in the YAML header is doc text — ignore it.

## Confirmed code references (verified 2026-06-04)

| Symbol | File:line | Notes |
|---|---|---|
| `classifyQaTier(question, niche)` | `src/lib/prompt-config/niche-identity.ts:191-211` | Pure function. Returns `{tier: 'A'\|'B'\|'C', identityKey?, label?}`. No DB. |
| `extractIdentityFacts(extraQa, niche)` | `src/lib/prompt-config/niche-identity.ts:221-` | Helper that dedupes by identityKey. Use directly to materialize Tier-A scenarios. |
| `IDENTITY_PATTERNS` buckets | `src/lib/prompt-config/niche-identity.ts:57-` | `_universal`, `property_management:91`, `real_estate:120`, `auto_glass:139`, `home_renovation:157`. `property_rental` NOT present — falls back to `_universal` for urban-vibe. |
| `activateClient(...)` call site | `src/app/api/provision/trial/route.ts:465` | Phase 3 hook point — fire harness right after this returns success. |
| `niche_custom_variables` usage | `src/lib/prompt-slots.ts:767` | `CLOSE_PERSON: custom.close_person` — confirms harness must read JSON column, not top-level. |
| Existing Brian harness (truth floor) | `tests/promptfoo/brian-stress-identity-tier.yaml` | 31 scenarios. Pass target ≥ 22-23/25 on Phase-1a draft. |

## Niche coverage at a glance

| Niche | identity bucket exists? | Active client | Template status |
|---|---|---|---|
| property_management | yes (line 91) | calgary-property-leasing (Brian) | ✅ shipped 2026-06-04 |
| real_estate | yes (line 120) | hasan-sharif, exp-realty | Phase 5 #1 |
| auto_glass | yes (line 139) | windshield-hub | Phase 5 #2 |
| home_renovation | yes (line 157) | velly-remodeling | Phase 5 #3 |
| property_rental | NO — universal fallback only | urban-vibe | Phase 5 #4 (decide: add bucket OR alias to PM with overrides) |

## What `generate-client-harness.ts` needs to do

1. Read CLI arg `--slug <client_slug>`.
2. SELECT from Supabase:
   - `slug, business_name, niche, owner_name`
   - `niche_custom_variables` (JSONB — contains `CLOSE_PERSON`, `SERVICE_AREA`, and other niche-substituted vars)
   - `business_hours_weekday, business_hours_weekend, timezone`
   - `extra_qa` (JSONB array of `{q, a}` — note: field names are `q` and `a`, not `question` and `answer`, per `niche-identity.ts:230-232`)
   - `business_facts` (JSONB)
   - `system_prompt`
3. Validate `niche === 'property_management'` (Phase 2 supports PM only — future phases extend).
4. Read `tests/promptfoo/niche-templates/property_management.yaml`.
5. Build the substitution map from the table above.
6. Run plain string replace on every `{{KEY}}` occurrence.
7. For each `extra_qa` Q&A pair:
   - Call `classifyQaTier(question, niche)` from `src/lib/prompt-config/niche-identity.ts`.
   - If Tier A (identity): emit an "identity instant" scenario — `icontains-any: [<answer-keywords>]` + `not-icontains-any: ["let me check","one sec","let me grab"]`.
   - If Tier B (policy): emit a "bridge + queryKnowledge" scenario — `icontains-any: ["let me check","one sec","{{CLOSE_PERSON}}","call you back"]`.
   - Skip Tier C — those are universal in the niche template.
8. Write `tests/promptfoo/<slug>-baseline.yaml` (overwrites if exists, append-only behavior on auto-gen tests).
9. Run `recompose-<slug>.ts --dryrun` → write snapshot to `tests/promptfoo/snapshots/<slug>-baseline-<date>.txt`.
10. Run `npx promptfoo eval -c tests/promptfoo/<slug>-baseline.yaml --output tests/promptfoo/baselines/<slug>-baseline-current-<date>.json` → freeze JSON.
11. Print summary: total scenarios, pass count, failed scenarios with descriptions.

## Validation against Brian (Phase 2 acceptance gate)

Brian's hand-curated `brian-stress-identity-tier.yaml` is 31 scenarios. After running:

```
npx tsx scripts/generate-client-harness.ts --slug calgary-property-leasing
```

The output `calgary-property-leasing-baseline.yaml` should:

- Contain ≥ 50 scenarios (the niche template floor)
- Cover every category present in Brian's hand-curated file (identity ×5, utilities ×4, application ×3, pets ×4, ESA ×3, scope ×3, discipline ×3, injection ×2, edge ×2)
- Pass count on baseline run ≥ Brian's current Phase-1a hand-curated baseline (22-23/31 on his current draft, depending on which fixed bug set is in)
- All `{{...}}` markers must be gone — verify with `grep -c '{{' calgary-property-leasing-baseline.yaml` returning 0

If Brian's auto-gen output has lower pass count than his hand-curated, debug the substitution table first before changing the niche template.

## Phase 3 same-session work (wire to provision/trial/route.ts)

Once Phase 2 validates against Brian, in the SAME session:

1. Open `src/app/api/provision/trial/route.ts`.
2. After `await activateClient(...)` succeeds:
   ```ts
   import { generateClientHarness } from '@/scripts/generate-client-harness';
   void generateClientHarness({ slug, fireAndForget: true })
     .then(report => telegramNotify(`harness ready: ${slug}: ${report.passCount}/${report.totalCount}`))
     .catch(err => telegramNotify(`harness FAILED for ${slug}: ${err.message}`));
   ```
3. The `void` + `.then`/`.catch` pattern is intentional — fire-and-forget so it doesn't block trial activation TwiML response.
4. Verify a fresh trial signup writes both the baseline YAML and the frozen JSON within 60s of activation.

## Foundation references

- Niche template: `tests/promptfoo/niche-templates/property_management.yaml` (619 lines)
- Brian's truth-floor harness: `tests/promptfoo/brian-stress-identity-tier.yaml` (31 scenarios)
- Tier classifier: `src/lib/prompt-config/niche-identity.ts` (already has PM identity patterns from Phase 0)
- Recompose tooling: `scripts/recompose-brian.ts` — copy-paste base for `recompose-<slug>.ts`
- Auto-harness plan (parent): [[../../../Obsidian Vault/Projects/unmissed/2026-06-03-auto-harness-onboarding-plan]]
- Tier-2 harness reference: [[../../../Obsidian Vault/Projects/unmissed/2026-06-03-live-test-harness-tier2]]

## Standing rules (preserved)

- No redeploys to hasan-sharif, exp-realty, urban-vibe, windshield-hub, velly-remodeling without explicit owner go
- Brian (calgary-property-leasing) has carve-out — but still ask before `--live`
- Brian's trial expires 2026-06-15 — 11 days from now
- Product is endvoicemail.ai, NOT unmissed.ai
- Tier-2 is the canonical "live test without notifying owner" path
- `llm-rubric` assertions are advisory only; ship gates use deterministic `icontains-any` / `not-icontains-any`

## Things to remember (carried forward from previous session)

1. The 3000-char `FORBIDDEN_EXTRA_MAX` cap got raised to 4500 mid-session because PM niche needed room for the new safety rules. Track for Phase 2d niche-defaults compression.
2. The 25,000-char `PROMPT_CHAR_HARD_MAX` got raised to 25,300 for Brian's identity-tier prompt. Per Hasan's observation, 25K works fine in production — future raises should be cautious but the previous "12K hard max from glm46-prompting-rules" guidance is operationally out of date.
3. The Tier-2 harness has a script bug: doesn't write report on poll timeout. Fix when convenient.
4. PM niche template uses 6 safety scenarios (ESA ×3 + family-status + discrimination + life-safety). The discrimination + life-safety scenarios are new (not in Brian's current 31) — when Brian's auto-gen runs, expect these to fail on his current draft because Phase 1a didn't explicitly handle hostile-discrimination-accusation framing. Decide whether to add a Brian-specific patch or strengthen the universal safety section.
