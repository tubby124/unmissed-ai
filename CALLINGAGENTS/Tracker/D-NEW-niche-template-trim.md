---
type: tracker
status: open
priority: P1
phase: Phase-7-Onboarding
related:
  - Features/Prompt-Composer
  - Architecture/Prompt-Architecture
  - Clients/calgary-property-leasing
opened: 2026-05-05
fix_branch: fix/niche-template-trim-property-management
---

# D-NEW — Property-management niche template emits 24k-char prompts (and the cap doesn't block it)

## Status
**OPEN** — discovered 2026-05-05 while auditing Brian's prompt (`calgary-property-leasing`). Two related bugs: (a) `property_management` niche default text is verbose enough to push composed prompts above the documented 12k cap, and (b) the validation cap is `25,000` (warning only) instead of the spec'd `12,000` (hard block) — so bloat ships silently.

## Problem

**Symptom:** Brian's `clients.system_prompt` is **24,768 chars / 17 slots**, sitting 1% below `PROMPT_CHAR_HARD_MAX=25,000`. Industry voice-agent guidance recommends ≤15k. Project rule (`prompt-edit-safety.md`) documents a 12k hard max. The deployed cap is 25k. The deployed cap is also a **warning, not a block** ([prompt-validation.ts:54](src/lib/prompt-validation.ts#L54)).

**Where the bytes come from** (Brian's slot breakdown — composed by `buildPromptFromSlots()` in [prompt-slots.ts:636](src/lib/prompt-slots.ts#L636) from `NICHE_DEFAULTS.property_management` at [niche-defaults.ts:632-772](src/lib/prompt-config/niche-defaults.ts#L632-L772)):

| Slot | Chars | Source |
|---|---:|---|
| `conversation_flow` | 8,339 | `TRIAGE_DEEP` + `INFO_FLOW_OVERRIDE` + `CLOSING_OVERRIDE` |
| `forbidden_actions` | 5,283 | `FORBIDDEN_EXTRA` (12 numbered rules in template → 30 numbered rules at compose) |
| `inline_examples` | 3,378 | `NICHE_EXAMPLES` (6 verbatim transcript examples) |
| All other slots combined | 7,768 | Common slots + niche overrides |

**Why scrape isn't the culprit:** [prompt-builder.ts:25](src/lib/prompt-builder.ts#L25) `buildPromptFromIntake()` explicitly ignores `websiteContent` and `knowledgeDocs` args. Scrape output flows correctly to `knowledge_chunks` via `seedKnowledgeFromScrape()`. The bloat is in the niche template itself — every property-management client onboarded inherits the same 24k baseline.

**Secondary bug — Sonar enrichment:** [dashboard/generate-prompt/route.ts:89-92](src/app/api/dashboard/generate-prompt/route.ts#L89-L92) inlines Sonar Pro enrichment into `intakeData.caller_faq` BEFORE `buildPromptFromIntake()` runs. That goes into the FAQ slot. This is the only path where non-intake content reaches the prompt — and it's a regen bloat vector.

## Bug bucket classification

Per `.claude/rules/core-operating-mode.md`:
- **Source-of-truth bug** (niche template is the source — fix there, not in derived `clients.system_prompt`)
- **Capability-gating bug** (validation cap is documented at 12k, enforced at 25k, warning-only)

## Solution

**Three changes, narrow diffs:**

### Change 1 — Trim `property_management` niche template
File: [src/lib/prompt-config/niche-defaults.ts:632-772](src/lib/prompt-config/niche-defaults.ts#L632-L772)

- **`FORBIDDEN_EXTRA`** — consolidate the 12 numbered rules (which compose into 30 at slot-build time due to common rules being prepended) into 6 grouped rules: SPEECH FORMAT, CALLBACK + ROUTING, COMPLIANCE + SCOPE. Drop overlap: rule 22 (RTA legal) ↔ rule 26 (lease commitments); rule 11 (repair timeline) ↔ rule 14 (transfer); rule 21 (rate guarantee) ↔ rule 24 (availability) ↔ rule 25 (specific property) ↔ rule 26 (lease terms). Target: 5,283 → ~2,400 chars.
- **`NICHE_EXAMPLES`** — DELETE entirely. `TRIAGE_DEEP` already prescribes the same behavior in numbered form. Examples drift from rules over time and Llama follows numbered flows better than transcript examples in voice mode (industry-validated by web search 2026-05-05). Target: 3,378 → 0 chars.
- **`TRIAGE_DEEP`** — keep mostly as-is, it's doing real work. Light edit only: drop the `SHORT / 1-WORD ANSWERS` block (240 chars) — it's behavior that's already implicit in `voice_naturalness` slot. Target: −240 chars.
- **`CLOSING_OVERRIDE`** — keep as-is. Real flow logic.
- Net niche template change: −6,500 chars per composed prompt for every property-mgmt client.

### Change 2 — Fix the validation cap drift
Files: [src/lib/prompt-validation.ts:54-58](src/lib/prompt-validation.ts#L54-L58), [src/lib/knowledge-summary.ts:34-37](src/lib/knowledge-summary.ts#L34-L37)

- Decide which spec is authoritative: project rule (12k hard max) or current code (25k warning). Per `.claude/rules/prompt-edit-safety.md`, the spec is 12k.
- Lower `PROMPT_CHAR_HARD_MAX` from 25,000 → 18,000 (compromise — strict 12k will instantly fail every existing slot pipeline including all 5 active clients).
- Keep `PROMPT_CHAR_TARGET=15,000`.
- Make hard max a **block, not a warning** — composer rejects, surfaces the offending slot to the dev with a "promote to KB" suggestion.
- File a separate `D-NEW-prompt-cap-spec-alignment` if we want to tighten 18k → 12k after Phase 9 promotion loop ships.

### Change 3 — Audit Sonar→`caller_faq` inlining
File: [src/app/api/dashboard/generate-prompt/route.ts:89-92](src/app/api/dashboard/generate-prompt/route.ts#L89-L92)

- Determine: is `enrichWithSonar()` output meant to be FAQ context, or KB content? If KB, move to `seedKnowledgeFromScrape()`-equivalent insert path. If FAQ, cap the size that lands in `caller_faq` (currently unbounded → can push composed prompts past cap on regen).
- Decision required from Hasan before code: keep, cap, or reroute.

## Files
- [src/lib/prompt-config/niche-defaults.ts](src/lib/prompt-config/niche-defaults.ts) — Change 1
- [src/lib/prompt-validation.ts](src/lib/prompt-validation.ts) — Change 2
- [src/lib/knowledge-summary.ts](src/lib/knowledge-summary.ts) — Change 2 (constants)
- [src/app/api/dashboard/generate-prompt/route.ts](src/app/api/dashboard/generate-prompt/route.ts) — Change 3
- [src/lib/__tests__/slot-ceilings.test.ts](src/lib/__tests__/slot-ceilings.test.ts) — add per-niche compose-size assertions

## Acceptance criteria

- [ ] **Niche compose-size regression test** — for each production niche key (`auto_glass`, `hvac`, `plumbing`, `property_management`, `outbound_isa_realtor`), `buildPromptFromIntake()` with empty intake produces ≤18,000 chars. Test in `slot-ceilings.test.ts`.
- [ ] **Property_management compose drop** — same test, property_management bare-minimum intake produces ≤14,500 chars (currently ~21k).
- [ ] **Validation hard-block** — composer with `PROMPT_CHAR_HARD_MAX=18000` rejects 19k prompts. Existing 5 active clients' last composed prompts must still pass (verify against snapshot fixtures).
- [ ] **Property_management golden test** — update existing golden snapshot, manually review diff, confirm no functional behavior loss (compliance rules, P1 triggers, RTA mentions all still present).
- [ ] **Sonar audit** — written decision (keep / cap / reroute) added to this D-item before any code change to Change 3.
- [ ] `npm run test:all` green
- [ ] PR includes before/after slot breakdown for `property_management` (just like Brian's audit table at top of this file)

## Out of scope (do NOT bundle)

- **Editing existing client prompts** (Brian, Hasan, Urban Vibe, etc.) — violates standing "no redeployment" rule. New composes from this point forward inherit the trimmed template; existing clients stay until snowflake migration (D445) lands.
- **Other niche template trims** (auto_glass, hvac, plumbing) — file separately if their golden tests exceed 18k. Property-management is the proven offender.
- **Validation cap → 12k tightening** — defer to post-Phase-9, after promotion loop reduces in-prompt FAQ pressure.
- **Refactoring slot composer** — composer logic is fine; the bug is in the inputs.

## Dependencies
- Blocks: nothing — independent change
- Blocked by: nothing
- Related: D442 Phase 2 (per-field warning chips audit fix), D445 (snowflake migration — required to backfill existing clients with the trim)

## Why this matters

Voice agents that exceed Llama's effective instruction-adherence window degrade silently — caller hits a 15-min flow, the model drifts on rule #29 of `forbidden_actions`, and the symptom looks like "agent gave out a price" instead of "agent's prompt was too long." Hasan's intuition (audit 2026-05-05) was that website + GBP scrape was leaking into prompts. Audit overturned that — the leak is in the **niche template defaults themselves**. Same effect, different root cause. Fixing the template once fixes every future property-mgmt onboarding (manual concierge + self-serve trial + Stripe checkout) in one diff.

## Connections
- → [[Architecture/Prompt-Architecture]]
- → [[Clients/calgary-property-leasing]]
- → [[Tracker/D442]] (Phase 2 follow-up)
- → [[Tracker/D445]] (snowflake migration — required for existing-client backfill)
- → [[Tracker/D-NEW-tool-invocation-log]] (sister D-item — adds the data we'd need to safely tighten cap → 12k later)
