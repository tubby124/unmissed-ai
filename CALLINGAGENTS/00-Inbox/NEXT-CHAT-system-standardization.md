---
type: next-chat-resume
project: endvoicemail
status: ready
created: 2026-06-04
parent: "[[../../../Obsidian Vault/Projects/unmissed/2026-06-04-architectural-reformation-mandate]]"
related:
  - "[[../../../Obsidian Vault/Projects/unmissed/2026-06-04-tier2-baseline-vs-proposed-velly]]"
  - "[[../../../Obsidian Vault/Projects/unmissed/2026-06-04-velly-deep-study-and-other-niche-strategy]]"
  - "[[../../../Obsidian Vault/Projects/unmissed/2026-06-04-harness-rollout-roadmap]]"
  - "[[../../../Obsidian Vault/Projects/unmissed/2026-06-04-slots-harness-architecture-pair]]"
  - "[[NEXT-CHAT-production-harness-foundation]]"
tags:
  - next-chat
  - system-standardization
  - universal-rails
  - no-production-changes
---

# NEXT-CHAT — System Standardization (No Production Changes)

## Session-start command (paste into the new chat)

```
Read CALLINGAGENTS/00-Inbox/NEXT-CHAT-system-standardization.md
and the parent vault note 2026-06-04-architectural-reformation-mandate.md.

Hasan's directive: stop touching production. The current Velly 4.3K prompt
runs fine. Before any client gets migrated, the universal rails must be
standardized so dashboard edits (add FAQ, change hours, scrape new
website, change niche, flip a feature) produce predictable agent behavior
across all clients.

In priority order for this chat:
1. Audit the dashboard → DB → slot pipeline → prompt → agent flow for
   one specific niche path. Use home_renovation since that's where Eric
   will eventually land. Trace what happens when each settings card is
   edited. Output: a mutation matrix.
2. Build tests/promptfoo/niche-templates/_universal.yaml — 40-50 truly
   universal scenarios with placeholders. This is the floor every client
   gets.
3. Build tests/promptfoo/niche-templates/home_renovation.yaml — 50-55
   home-reno-specific scenarios. Will validate the eventual Eric
   migration.
4. Audit the manual-provisioning code paths. Hasan's rule: every future
   provision must go through the slot pipeline as if onboarded through
   the website. Identify any path that writes clients.system_prompt
   directly. Plan the unification.

Standing rules:
- NO production changes this session unless explicitly authorized
- Velly is the ONLY paying customer — extra-cautious
- Brian (calgary-property-leasing) has Tier-2 carve-out, asked-go for --live
- Product is endvoicemail.ai
- Tier-2 (scripts/test-prompt-live.ts) is canonical for production-fidelity test
- llm-rubric is advisory only; ship gates use deterministic icontains-any
```

## What shipped 2026-06-04 (this session, already on disk)

### Vault (durable knowledge)
- [[../../../Obsidian Vault/Projects/unmissed/2026-06-04-architectural-reformation-mandate]] — 7-track roadmap covering niche backfill, universal first-class, slot-pipeline unification, 100-scenario per-client harness
- [[../../../Obsidian Vault/Projects/unmissed/2026-06-04-tier2-baseline-vs-proposed-velly]] — Tier-2 empirical comparison data
- [[../../../Obsidian Vault/Projects/unmissed/2026-06-04-velly-deep-study-and-other-niche-strategy]] — Velly forensics
- [[../../../Obsidian Vault/Projects/unmissed/2026-06-04-harness-rollout-roadmap]] — Phase 1-6 plan
- [[../../../Obsidian Vault/Projects/unmissed/2026-06-04-slots-harness-architecture-pair]] — architectural rule

### Code artifacts (ready to use, NOT YET RUN against production)
- `tests/promptfoo/niche-templates/property_management.yaml` — Phase 1 ship, 50 scenarios
- `scripts/migrate-velly-to-slots.ts` — 3 bugs fixed (Samantha greeting, niche update, --preview mode). Ready to fire with explicit Hasan go.
- `scripts/backfill-niches.ts` — Niche backfill (read-only default, --apply with per-row confirm). Ready to fire with explicit Hasan go.
- `scripts/test-prompt-live.ts` — Added `--prompt-file <path>` flag for A/B testing without DB writes

### Experimental data
- `tests/promptfoo/live-tests/velly-remodeling-baseline-db-2026-06-04T13-48-28.json` — Velly current prompt, 63s, 0 KB fires
- `tests/promptfoo/live-tests/velly-remodeling-proposed-velly-slot-output-2026-06-04T13-53-32.json` — Velly proposed prompt, 118s, 2 KB fires, full lead intake captured
- `/tmp/velly-slot-output.txt` — Slot-composed home_renovation prompt for Eric (19,344 chars)
- `/tmp/velly-pre-migration-snapshot.json` — Rollback snapshot

## Track priority for next chat

### Track 1 — Settings-to-agent mutation matrix (HIGHEST PRIORITY)

**Why first:** Hasan's exact directive. Before standardizing universal rails, we need to see what's currently inconsistent.

**Reference:** `docs/architecture/control-plane-mutation-contract.md` is the existing source of truth. May be partially outdated.

**Approach:**
1. List every settings card in the dashboard (`src/components/dashboard/settings/`)
2. For each: trace edit → PATCH `/api/dashboard/settings` → DB column → does it trigger `needsAgentSync`? → does it trigger `reseedKnowledgeFromSettings`? → does it trigger `updateAgent()`?
3. Build a matrix: settings card | DB column | prompt impact | tool impact | agent sync triggered? | knowledge reseed triggered? | drift risk
4. Compare actual code behavior against documented behavior in the contract
5. Flag any mismatches

**Output:** Vault note `Projects/unmissed/2026-06-04-settings-mutation-matrix.md` + (if drift found) PR plan to fix.

### Track 2 — `_universal.yaml` niche template

**Why second:** Foundation under everything. Before home_renovation.yaml or any per-client harness can be safely built, the universal floor needs to exist.

**Approach:**
1. Copy structure from `property_management.yaml` (50 scenarios, 7 layers, `{{PLACEHOLDER}}` markers)
2. Replace PM-specific scenarios with truly universal ones:
   - Identity (5): business name, services, hours, location, contact method
   - Conversation discipline (8): goodbye, repetition, prompt injection, AI honesty, no markdown, multi-question stacking, off-topic redirect, hangup behavior
   - Universal policy bridges (8): pricing, timeline, availability, scope-out
   - Universal safety (5): 911, threats, discrimination, harassment, life-safety
   - Edge cases (8): wrong number, non-English, hostile, robocall, silent caller, multi-business confusion, very-long speech, mumble
   - Returning caller (3): name re-asked, prior summary integrated, callback expectations met
   - Knowledge use (5): KB-eligible questions trigger queryKnowledge, KB-empty results recover gracefully, no fabrication when KB silent, niche-typical FAQ asked, "I don't know" with route is acceptable

**Placeholder contract:** same 10 placeholders as `property_management.yaml` (`{{BUSINESS_NAME}}`, `{{CLOSE_PERSON}}`, `{{SERVICE_AREA_PRIMARY}}`, etc.) — every niche template uses the same substitution model.

**Output:** `tests/promptfoo/niche-templates/_universal.yaml` (40-50 scenarios).

### Track 3 — `home_renovation.yaml` niche template

**Why third:** Validates the eventual Velly migration. Should pass against `/tmp/velly-slot-output.txt` (the proposed prompt) at ≥ 90%.

**Approach:**
1. Inherit structure from `_universal.yaml`
2. Add 30-40 home_renovation-specific scenarios:
   - Identity (extends): services list (kitchen, bath, basement, addition, whole-home)
   - Policy (10): cost ranges, timeline, permits, design changes, warranty, financing, payment schedule, deposit, material lead times, crew availability
   - Safety/regulatory (6): active water leak, sewage, structural collapse, fire damage, post-storm, gas leak — all should ask "are you safe" + flag URGENT
   - Scope (8): commercial fit-out, design-only, demolition-only, real estate sales, financing — should all refuse + route
   - Pricing guardrails (4): no $ per sqft over phone, no specific kitchen cost, KB-eligible range OK, route on specific quote
   - Material choices (3): no brand recommendations, no finish picks, route to consult

**Validation:** Run against `/tmp/velly-slot-output.txt` using promptfoo. Expected pass rate ≥ 90% (the proposed prompt should clear the niche bar).

**Output:** `tests/promptfoo/niche-templates/home_renovation.yaml` (50-55 scenarios).

### Track 4 — Manual-provisioning audit

**Why last:** Code refactor, no immediate user-visible impact. Sets the rails for future clients.

**Approach:**
1. `grep -rn "system_prompt:" src/app/api/ src/lib/ | grep -v slot-regenerator` — every direct write
2. For each: should this write happen via slot composer instead?
3. Build the unification plan. Add a CI guard that fails any new direct write.

**Output:** Audit findings in vault + PR plan.

## Things to remember (carried across sessions)

1. `niche_custom_variables.CLOSE_PERSON` is the JSON-path. NOT `clients.close_person` (column doesn't exist).
2. `extra_qa` field shape is `{q, a}` not `{question, answer}`.
3. `classifyQaTier` at `src/lib/prompt-config/niche-identity.ts:191` is pure, no DB.
4. 4 niches have identity buckets (PM, real_estate, auto_glass, home_renovation). 'other' falls back to `_universal`.
5. Eric onboarded 2026-04-28; home_renovation shipped 2026-05-06. He's `niche='other'` because the right niche didn't exist yet.
6. 25K-char prompts work fine in production GLM-4.6. The 12K hard-max guidance is out of date.
7. `llm-rubric` is advisory only — 8/31 false-failure rate on correct agent behavior. Ship gates use deterministic substring assertions.
8. Tier-2 is the canonical "live test without owner notification" path.
9. `migrate-velly-to-slots.ts --preview` is the only safe mode (no DB writes). Default mode and --live both write to production.
10. Auto-mode is on. Auto-execute on low-risk work; ask before production changes.

## Pending decisions for Hasan (next chat)

- Run `scripts/backfill-niches.ts` (report mode — no writes — to see how many 'other' clients would re-classify)
- Confirm `_universal.yaml` scenario list before drafting
- Confirm `home_renovation.yaml` covers his lived experience with renovation contractors
- After templates exist: Tier-2 retest Velly with same canonical questions on both prompts for apples-to-apples comparison
