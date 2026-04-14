# Progressive Enrichment + Promptfoo Test Suite — Design Spec

**Date:** 2026-04-13
**Status:** Approved
**Scope:** Wire missing enrichment sources into prompt rebuild, add hybrid auto-rebuild triggers, build promptfoo regression suite for enrichment layers + missing niches.

---

## Problem

The agent improves as a business adds more data (GBP, website, manual FAQs, Sonar) — but two data sources are silently lost on every prompt rebuild, and there are zero auto-rebuild triggers. The result: a business that adds 10 FAQs through the dashboard never gets an improved agent unless they manually click Rebuild.

Additionally, `other` and `restaurant` niches have no promptfoo coverage — any regression is silent.

---

## What We're Building

Three sub-systems, delivered together:

1. **Gap fixes** — wire GBP summary + Sonar content into every prompt rebuild
2. **Hybrid trigger system** — auto-rebuild on low-stakes changes, manual gate on big ones
3. **Promptfoo layer suite** — 6 new test files proving enrichment progression works + niche coverage

---

## Architecture

### Enrichment Layer Model

| Layer | Data present | Agent capability |
|-------|-------------|-----------------|
| L0 | Intake only (name, niche, triage rules) | Functional — takes messages, basic routing |
| L1 | + GBP (hours, location, category) | Knows hours, can confirm location |
| L2 | + Website scrape (services, FAQs via pgvector) | Knows services, handles product questions |
| L3 | + Manual FAQs + Sonar enrichment | Answers specifics, handles edge cases |

Each layer is strictly additive. L0 must always be functional — a bare intake with no external data cannot produce a broken agent.

---

## Section 1: Gap Fixes

### 1a — GBP Summary

**Current state:** `gbp_summary` is stored in `clients` table (added in migration `20260327300000_add_gbp_columns.sql`) but `regenerate-prompt/route.ts` SELECT does not include it — never reaches `buildPromptFromIntake`.

**Fix:**
- Add `gbp_summary` to the `.select(...)` in `regenerate-prompt/route.ts`
- After loading `intakeData`, inject: `if (client.gbp_summary) intakeData.gbp_summary = client.gbp_summary`
- In `prompt-builder.ts`: consume `intake.gbp_summary` in the context/knowledge section (append as a business fact line if present)

### 1b — Sonar Enrichment

**Current state:** `enrichWithSonar()` fires at provision (fire-and-forget), result is never stored — lost permanently after signup.

**Fix:**
- New migration: `ALTER TABLE clients ADD COLUMN IF NOT EXISTS sonar_content text;`
- In `provision/trial/route.ts`: after sonar resolves, PATCH `clients.sonar_content` with the returned string
- In `regenerate-prompt/route.ts`: add `sonar_content` to SELECT, inject into `intakeData.sonar_content`
- In `prompt-builder.ts`: consume `intake.sonar_content` in the knowledge/context section (append after gbp_summary if present)

**Injection order in prompt (both are additive, not replacing anything):**
```
[existing prompt body]
[gbp_summary paragraph — if present]
[sonar_content paragraph — if present]
```

---

## Section 2: Hybrid Rebuild Triggers

### Trigger Classification

| Field / Action | Trigger type | Rationale |
|---------------|-------------|-----------|
| knowledge chunk added (FAQ, bulk import, gap) | Auto | Low-risk, purely additive |
| `business_notes` updated | Auto | Low-risk text enrichment |
| `hours` / `services_offered` updated | Auto | Factual update, safe |
| `context_data` updated | Auto | Low-risk |
| `niche` changed | Manual gate | High-impact — changes entire prompt structure |
| `voice_style_preset` changed | Manual gate | Changes tone/persona — user should verify |
| `forwarding_number` changed | Manual gate | Affects call routing — verify intentional |
| `hand_tuned = true` | Never auto | Protected from all auto-rebuild |

### Implementation Pattern

Fire-and-forget (non-blocking) after the primary write succeeds:

```ts
// After successful DB write in low-stakes route:
fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/dashboard/regenerate-prompt`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.INTERNAL_SECRET ?? '' },
  body: JSON.stringify({ clientId, reason: 'auto:faq_added' }),
}).catch(() => {}) // fire-and-forget — never blocks the response
```

**Entry points to modify:**
1. `src/app/api/dashboard/settings/route.ts` PATCH — after DB write, check which fields changed, fire if low-stakes
2. `src/app/api/dashboard/knowledge/chunks/route.ts` — after chunk approved, fire
3. `src/app/api/dashboard/knowledge/bulk-import/route.ts` — after chunks inserted, fire

**Guard: `hand_tuned` check**
`regenerate-prompt` already checks `hand_tuned` and skips rebuild if true — no additional guard needed at trigger sites.

---

## Section 3: Promptfoo Test Suite

### New Files

```
tests/promptfoo/
  enrichment-l0.yaml       # Bare intake only
  enrichment-l1.yaml       # + GBP injected into system_prompt
  enrichment-l2.yaml       # + website scrape knowledge in prompt
  enrichment-l3.yaml       # + manual FAQs + sonar content
  other-niche.yaml         # 'other' niche — no specific detection
  restaurant.yaml          # restaurant niche — Treasure House patterns
```

### Fixture Strategy

Each test file uses a **static system_prompt fixture** (file reference) rather than a live DB call. Same pattern as `windshield-hub.yaml`:

```yaml
defaultTest:
  vars:
    system_prompt: file://prompts/<fixture-name>.txt
```

Fixtures are generated once by running `buildPromptFromIntake` with controlled intake objects at each enrichment level, then saved as static `.txt` files. This makes tests fast, deterministic, and CI-safe.

### Global Assertions (all layers)

- No prompt echo (system instructions not leaked to caller)
- No markdown formatting in output
- One question per turn max
- No filler words (certainly, absolutely, of course)
- No hallucinated prices or percentages unless explicitly in prompt

### Layer-Specific Assertions

| File | Layer-specific checks |
|------|-----------------------|
| `enrichment-l0.yaml` | Agent handles "what are your hours?" gracefully without crashing — says it'll pass along the question |
| `enrichment-l1.yaml` | Agent correctly states hours from GBP data; knows city/location |
| `enrichment-l2.yaml` | Agent references at least one service from website scrape |
| `enrichment-l3.yaml` | Agent answers a specific FAQ correctly; handles edge-case scenario |
| `other-niche.yaml` | Agent collects: name, reason for calling, callback number — does not hallucinate a niche |
| `restaurant.yaml` | Agent does not invent menu items; handles "want to place an order" → triage correctly |

### Enrichment Delta Test

`enrichment-l3.yaml` includes a cross-layer assertion: the same caller scenario that produces "I'll pass that along" at L0 should produce a specific answer at L3. This validates that enrichment actually changes agent behavior.

### run-all.sh Update

Add all 6 new files to the existing run loop (no changes needed — run-all.sh already globs `*.yaml`).

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/20260414000000_add_sonar_content.sql` | New column `sonar_content text` on clients |
| `src/app/api/provision/trial/route.ts` | Store sonar result to `sonar_content` after resolve |
| `src/app/api/dashboard/regenerate-prompt/route.ts` | Add `gbp_summary`, `sonar_content` to SELECT + inject into intakeData |
| `src/lib/prompt-builder.ts` | Consume `intake.gbp_summary` + `intake.sonar_content` in knowledge section |
| `src/app/api/dashboard/settings/route.ts` | Fire-and-forget regen after low-stakes PATCH |
| `src/app/api/dashboard/knowledge/chunks/route.ts` | Fire-and-forget regen after chunk approved |
| `src/app/api/dashboard/knowledge/bulk-import/route.ts` | Fire-and-forget regen after chunks inserted |
| `tests/promptfoo/enrichment-l0.yaml` | New test |
| `tests/promptfoo/enrichment-l1.yaml` | New test |
| `tests/promptfoo/enrichment-l2.yaml` | New test |
| `tests/promptfoo/enrichment-l3.yaml` | New test |
| `tests/promptfoo/other-niche.yaml` | New test |
| `tests/promptfoo/restaurant.yaml` | New test |
| `tests/promptfoo/prompts/` | 6 new static prompt fixture .txt files |

**Total: ~14 files, no architectural changes, no new tables beyond the one column.**

---

## What's Explicitly Out of Scope

- Enrichment score / quality indicator in dashboard UI (can add later once data is flowing)
- Re-scraping website on a schedule (separate feature)
- Expanding `generateNicheConfig()` to named niches (separate backlog item)
- WebRTC widget cooldown fix (separate P2)

---

## Success Criteria

1. After adding a FAQ in the dashboard, the system_prompt in DB updates within 30 seconds without user action (for non-hand-tuned clients)
2. `gbp_summary` content appears in rebuilt prompts for clients that have GBP data
3. `sonar_content` is non-null for any client provisioned after this ships
4. All 6 new promptfoo test files pass in CI
5. L3 prompt answers at least one scenario that L0 prompt cannot
