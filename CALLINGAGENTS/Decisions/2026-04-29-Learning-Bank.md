---
type: decision
date: 2026-04-29
status: approved
tags: [decision, learning-bank, prompt-improvement, architecture]
related: [Features/Learning-Bank, Decisions/2026-04-29-Zara-Rewrite]
---

# Decision: Build a Learning Bank, not a one-off Zara fix

## Context
Zara (homepage demo agent) was reported as too robotic and too strict. Audit found:
- 11,991-char prompt (99% of 12K hard cap), 14 NEVER rules at top
- Identity drift in DB (`agent_name='Aria'` while prompt body says Zara)
- Last edit 28 days ago despite 16 logged calls in window
- 4 production agents already producing `call_insights` data (26 rows total) with no consumer

The instinct was to rewrite Zara's prompt and ship. Hasan asked "what would a top-1% developer do?" — that reframed it from a Zara problem into a prompt-platform problem.

## Options Considered

1. **Just rewrite Zara's prompt and ship.** Fast, low-risk, fixes the immediate complaint. But every other agent improvement remains a one-off; cross-niche patterns stay locked in individual prompts; `call_insights` keeps generating data with no consumer.

2. **Build a Learning Bank: extend `call_insights`, add `prompt_patterns` + `prompt_lessons` + `pattern_application_log` + `call_transcripts`. Wire auto-lesson generation into `/completed`. Build admin promotion UI. Gate pattern injection into `recomposePrompt()`.**
   Slower today, but every future call across every client improves the platform. Existing 845+ calls + 261 unresolved knowledge queries become free training data.

3. **Build a Learning Bank but defer auto-injection until validated.** Same as option 2 but ship the data pipeline first, ship pattern injection later. Decouples discovery (lessons) from application (injection) so we can validate which patterns actually move metrics before risking prompt regression.

## Decision
**Option 3.** Build the full pipeline now, gate the injection step behind `LEARNING_BANK_INJECT=true` (default OFF). Tables, seed data, admin UI, and the backfill script all ship. Pattern injection waits for manual validation per-niche.

Reasoning:
- The marginal cost of building the full data pipeline is small once we're already touching the schema. The marginal value compounds across every future agent.
- Pattern auto-injection is the only step with regression risk. Gating it lets us collect data and validate patterns first.
- The new tables `pattern_application_log` enable retrospective A/B without rebuild work later.

## Consequences

**Enables:**
- Every call becomes a candidate lesson via `prompt_lessons` (auto-generated from `call_insights` thresholds).
- Promoted patterns become reusable across all niches via `niche_applicability text[]` + `v_active_patterns_by_niche` view.
- Backfill script turns 845+ existing calls into searchable transcript data ($1 cost, one-time).
- D243/D244/D270 (Phase 9 tracker items) get unblocked — `knowledge_query_log` already has 261 rows ready to surface as lessons.
- Future `/build-prompt-ui` runs can pull battle-tested patterns from the bank.
- Cross-niche transfer learning becomes possible (auto_glass pattern proven, can flag as candidate for property_mgmt).

**Rules out:**
- Single-prompt iteration loops where lessons stay locked in one client's prompt.
- Manual cross-niche pattern porting (now systematized via the table).

**Known risks:**
- `call_insights.loop_rate` doesn't exist as a column — substituted `repeated_questions >= 3 OR agent_confused_moments >= 2` as proxy. Swap when column lands.
- `SUPABASE_DB_URL` not currently in `.env.local` — required for `/learn` skill psql scripts. Documented as gap.
- Auto-lesson generation runs in `/completed` `after()` block, best-effort — silent failure if `prompt_lessons` insert fails. Acceptable: lesson can be re-derived from `call_insights` if needed.
- Seed file uses dollar-quoting (`$$...$$`) for verbatim lines containing apostrophes — verified no escape collisions.

## Related
- [[Features/Learning-Bank]] — full feature reference
- [[Decisions/2026-04-29-Zara-Rewrite]] — companion decision; first prompt to be rewritten using bank patterns
- [[Tracker/D437]] — exists, separate concern (concierge provisioning gate)
- Phase 9 in [[../.claude/rules/refactor-phase-tracker.md]] — D243/D244/D270/D284/D297 all become trivial after this
