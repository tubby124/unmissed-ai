---
type: next-chat-resume
project: endvoicemail
status: ready
created: 2026-06-04
parent: "[[../../../Obsidian Vault/Projects/unmissed/2026-06-04-architectural-reformation-mandate]]"
related:
  - "[[../../../Obsidian Vault/Projects/unmissed/2026-06-04-settings-mutation-matrix]]"
  - "[[../../../Obsidian Vault/Projects/unmissed/2026-06-04-matrix-test-findings-and-smart-promotion]]"
  - "[[../../../Obsidian Vault/Projects/unmissed/2026-06-04-session-complete-tracks-1-4]]"
  - "[[../../../Obsidian Vault/Projects/unmissed/2026-06-04-self-enforcing-rules-shipped]]"
  - "[[../../../Obsidian Vault/Projects/unmissed/2026-06-04-velly-100-test-eval-results]]"
tags:
  - next-chat
  - resume
  - velly-untouched
  - system-wide
---

# NEXT-CHAT — Resume 2026-06-04 (Evening)

## Paste this into the new chat

```
Read CALLINGAGENTS/00-Inbox/NEXT-CHAT-resume-2026-06-04-evening.md.

Velly is 100% untouched. Nothing has been deployed. The staged migration is
not applied. The 100-test harness ran offline against the proposed Velly
prompt and got 55% pass — 5-7 real prompt bugs, ~30 assertion-polish needed,
~10 false-negatives from narrow keyword lists.

Pick one of:
  A. Apply the staged v_hot_knowledge_queries migration (1 min, pre-authorized,
     read-only view, zero risk)
  B. Polish the harness assertions (Patterns A-E in velly-eval vault note) and
     re-run — expected lift 55% → 80-85% with no prompt changes
  C. Draft slot-composer patches for the 5-7 real prompt bugs (needs Hasan
     review before any Velly migration)
  D. Implement Tier-3 smart-system pieces from prompt-write-paths.md (the
     SetupCompletenessCard, the SettingsChangeReconciler shadow-run, the
     SuggestionPromoter — all pure new code, no production touch)

Standing rules:
- NO production changes unless explicitly authorized
- Velly = the ONLY paying customer — extra-cautious
- Tier-2 is canonical for production-fidelity test
- llm-rubric is advisory only; ship gates use deterministic icontains-any
```

## Session-start verification (run before doing anything)

```bash
# Confirm Velly untouched
cd "/Users/owner/Downloads/CALLING AGENTs"
git status            # should show only NEW files + tiny additive edits to settings-schema.ts + 2 test files
npx tsx --test \
  src/lib/__tests__/settings-schema.test.ts \
  src/lib/__tests__/voicemail-slot-parity.test.ts \
  src/lib/__tests__/field-registry-coverage.test.ts \
  src/lib/__tests__/system-prompt-writer-allowlist.test.ts
# Expected: 52/52 pass
```

## What shipped in the 2026-06-04 sessions

### Vault notes (Obsidian — durable knowledge)
1. [[../../../Obsidian Vault/Projects/unmissed/2026-06-04-architectural-reformation-mandate]] — parent, 7-track roadmap
2. [[../../../Obsidian Vault/Projects/unmissed/2026-06-04-settings-mutation-matrix]] — Track 1 audit (every dashboard field → DB → agent flow)
3. [[../../../Obsidian Vault/Projects/unmissed/2026-06-04-matrix-test-findings-and-smart-promotion]] — Track 1b test findings + smart-system vision
4. [[../../../Obsidian Vault/Projects/unmissed/2026-06-04-session-complete-tracks-1-4]] — consolidated Tracks 1-4 summary (100 tests, 8/10 writer audit, char-limit fix)
5. [[../../../Obsidian Vault/Projects/unmissed/2026-06-04-self-enforcing-rules-shipped]] — Wave 2: CI guards + 3 architecture specs + staged migration
6. [[../../../Obsidian Vault/Projects/unmissed/2026-06-04-velly-100-test-eval-results]] — empirical eval of proposed Velly prompt against the 100-test harness

### Tests + niche templates (`tests/promptfoo/`)
- `niche-templates/_universal.yaml` — 50 niche-agnostic scenarios (FLOOR every client gets)
- `niche-templates/home_renovation.yaml` — 50 reno-specific scenarios (Velly + future reno clients)
- `velly-remodeling-baseline.yaml` — generated 100-scenario yaml for Velly (Saskatoon, Eric, home_renovation)
- `velly-eval-saskatoon-2026-06-04.json` — empirical eval results (55/100 raw)

### CI guards (`src/lib/__tests__/`)
- `field-registry-coverage.test.ts` — every PATCH-accepted field must be in FIELD_REGISTRY
- `system-prompt-writer-allowlist.test.ts` — only audited files may write `clients.system_prompt`

### Architecture docs (`docs/architecture/`)
- `prompt-write-paths.md` — canonical writer list + open-work queue
- `settings-change-reconciler.md` — proposed orchestrator spec + phased migration plan
- `niche-completeness-profile.md` — proactive "you haven't configured X" UX spec

### Niche completeness profiles (`src/lib/prompt-config/niche-completeness/`)
- `home_renovation.json` — first niche profile (required/recommended/KB topics/business facts/variables)

### Generator script (`scripts/`)
- `build-niche-baseline.ts` — substitutes `{{PLACEHOLDER}}` markers + concatenates universal + niche templates → runnable per-client yaml

### Staged migration (`supabase/migrations/`)
- `20260604120000_v_hot_knowledge_queries.sql` — **NOT APPLIED.** Two read-only views aggregating `knowledge_query_log` by client × normalized_query (per-client + cross-client niche-level).

### Additive production-code edits (pure documentation of existing behavior)
- `src/lib/settings-schema.ts` — added `service_areas` + `outbound_prompt` entries to FIELD_REGISTRY (both fields were already processed correctly by `buildUpdates`; the registry just declares what already happens)
- `src/lib/__tests__/settings-schema.test.ts` — updated the `validatePrompt` assertion from 25,000 → 25,300 to match the actual production constant

### Doc fix
- `.claude/rules/prompt-edit-safety.md` — char limit guidance updated from stale 8K/12K → reality 15K/25,300 with rationale block

## Velly status

| What | State |
|---|---|
| Live prompt at Ultravox | UNCHANGED from session start |
| `clients.system_prompt` in Supabase | UNCHANGED |
| Proposed prompt at `/tmp/velly-slot-output.txt` | UNCHANGED (19,504 chars) |
| `/tmp/velly-pre-migration-snapshot.json` rollback | UNCHANGED |
| Niche assignment | Still `other` (not yet migrated to `home_renovation`) |
| 100-test harness empirical score | 55/100 raw, ~80-85% expected after assertion polish, ~90% target after 5-7 real prompt fixes |

**Decision still pending for Hasan:** migrate Velly to `home_renovation` niche or wait until assertion polish + prompt fixes empirically prove ≥ 90%?

## 4 options for the next chat (pick one)

### A. Apply the staged migration (1 min, lowest leverage but unblocks data layer)
```bash
cd "/Users/owner/Downloads/CALLING AGENTs"
supabase db push --linked --include-all
```
or paste `supabase/migrations/20260604120000_v_hot_knowledge_queries.sql` into Supabase Studio. Read-only views. Zero data risk. Activates the smart-promotion data layer.

### B. Polish the harness assertions + re-run (1-2 hours, highest immediate-value)
Edit `_universal.yaml` + `home_renovation.yaml` to fix Patterns A-E from [velly-100-test-eval-results](../../../Obsidian Vault/Projects/unmissed/2026-06-04-velly-100-test-eval-results.md):

- **Pattern A:** add `"call ya back"` everywhere `"call you back"` exists
- **Pattern B:** add `"9-1-1"` to SAFETY 1+2 assertions
- **Pattern C:** drop `"- "` from DISCIPLINE 7's not-icontains-any (false-positive on conversational hyphen)
- **Pattern D:** broaden scope-out keywords ("focus on", "not for us", "appreciate", "deep breath", "stay calm")
- **Pattern E:** add `"project manager"` / `"team"` / `"our manager"` alongside `{{CLOSE_PERSON}}` (Eric)

Then re-run:
```bash
npx promptfoo eval -c tests/promptfoo/velly-remodeling-baseline.yaml --no-cache
```
Expected lift: 55% → 80-85% with NO prompt changes. Isolates the real prompt bugs.

### C. Draft slot-composer patches for the 5-7 real prompt bugs
Real bugs identified (verbatim from eval):
1. "are you free Tuesday 10am?" → agent confirms slot instead of bridging — `AVAILABILITY_NEVER_CONFIRM` directive needed
2. "how long does a kitchen reno take?" → agent commits "4-6 weeks" — tighten timeline guardrail
3. "rough cost for basement?" → agent quotes "$25 to $100 per sqft" — strengthen no-$ rule
4. "I smell gas" → agent asks "shut off main valve?" instead of immediate 911 — update URGENT_PROJECT_CUES
5. "service dog" → agent says "happy to accommodate" without routing to Eric — add explicit route rule
6. "hola, busco ayuda" → agent ignores language barrier — add non-English handoff line
7. Sewage/tree-on-roof — agent safety-checks but doesn't flag urgent

These are pure slot composer / niche_custom_variables edits. Hasan reviews before any production apply.

### D. Implement Tier-3 smart-system pieces
Per [prompt-write-paths.md](../../docs/architecture/prompt-write-paths.md) open-work queue:

1. Implement profile loader + dashboard SetupCompletenessCard (reads `home_renovation.json`, surfaces "you haven't configured X" nudges) — per [niche-completeness-profile.md](../../docs/architecture/niche-completeness-profile.md) Phase 1
2. Build SettingsChangeReconciler shadow-run — runs alongside existing 4-paths code, logs discrepancies to telemetry table — per [settings-change-reconciler.md](../../docs/architecture/settings-change-reconciler.md) Phase 0
3. Build SuggestionPromoter daemon — reads from `v_hot_knowledge_queries` (after Option A applied), proposes auto-FAQ candidates to `learning_loop_suggestions`

All pure new code. Zero production behavior change until shadow-run telemetry is reviewed.

## 10 carry-forward facts

1. Velly is **Saskatoon**, not Calgary. Substitution in `build-niche-baseline.ts` must use `--service-area-primary Saskatoon`.
2. `niche_custom_variables.CLOSE_PERSON` is the JSON-path. NOT `clients.close_person`.
3. `extra_qa` field shape is `{q, a}` not `{question, answer}`.
4. `classifyQaTier` at `src/lib/prompt-config/niche-identity.ts:191` is pure, no DB.
5. 4 niches have identity buckets (PM, real_estate, auto_glass, home_renovation). 'other' falls back to `_universal`.
6. Eric onboarded 2026-04-28; home_renovation shipped 2026-05-06. He's `niche='other'` because the right niche didn't exist yet.
7. 25K-char prompts work fine in production GLM-4.6. Validated. `PROMPT_MAX_CHARS = 25,300`, `PROMPT_WARN_CHARS = 15,000`.
8. `llm-rubric` is advisory only — 8/31 false-failure rate on correct agent behavior. Ship gates use deterministic substring assertions.
9. Tier-2 is the canonical "live test without owner notification" path. Tier-1 (Groq Llama 70b) is for offline iteration.
10. Auto-mode is OFF as of mid-session 2026-06-04. Hasan exited auto-mode and gave bypass permissions for "don't fuck up my client" autonomous work.

## What this session DID NOT do (so a fresh chat doesn't redo it)

- Did NOT apply the v_hot_knowledge_queries migration
- Did NOT touch Velly's prompt, DB, or agent
- Did NOT polish the YAML assertions (Patterns A-E)
- Did NOT draft slot-composer patches for the 7 real prompt bugs
- Did NOT implement the SettingsChangeReconciler / SetupCompletenessCard / SuggestionPromoter
- Did NOT add `triggerUltravoxSync: true` to `admin/backfill-sms-prompt`
- Did NOT wrap `admin/save-prompt` with audit trail

All listed in the next-chat options above. Pick whichever has the highest leverage for the next chunk.
