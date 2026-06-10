---
type: fleet-baseline
status: locked
created: 2026-06-03
project: unmissed
related:
  - "[[2026-06-03-harness-before-baseline]]"
  - "[[NEXT-CHAT-system-wide-slim-kickoff]]"
  - "[[../../Obsidian Vault/Projects/unmissed/2026-06-03-harness-end-to-end-phase1a-shipped]]"
tags:
  - fleet-baseline
  - prompt-slim
  - harness
  - cross-niche
---

# Fleet BEFORE-Baseline Locked — 2026-06-03

4 of 5 active clients now have frozen harness baselines. Locked numbers below — any future shared-slot edit must compare against these.

## Fleet score table

| Client | Niche | Snapshot chars | Scenario | Routing strict | Fingerprints |
|---|---|---:|---:|---:|---:|
| **calgary-property-leasing** (Brian) | property_management | 23,184 | 13/15 (87%) | 2/6 (33%) | 13/14 (93%) |
| **urban-vibe** (Ray) | property_management | 22,903 | **7/13 (54%)** | 4/6 (67%) | 13/14 (93%) |
| **windshield-hub** (Mark) | auto_glass | 16,537 | 20/26 (77%) | 5/6 (83%) | **18/18 (100%)** |
| **hasan-sharif** (Hasan) | real_estate | **8,415** | 14/16 (87.5%) | **6/6 (100%)** | 4/17 (24%) |
| exp-realty (Omar) | real_estate | — | TODO next chat | TODO next chat | TODO next chat |

## Headline findings

### 1. Hasan's hand-slimmed prompt is a proof-point

8,415 chars, 100% routing strict, 87.5% scenario pass. Under the 12K GLM-4.6 hard max. **This is the target state the slot pipeline should produce.**

Hasan's prompt is custom hand-written, not slot-pipeline output. That's why 13 of 17 real_estate fingerprints fail — the prompt encodes the same intent in different wording. The fingerprint mismatch is a slot-vs-snowflake gap, not a behavioral gap.

**Strategic implication:** The slim plan target isn't aspirational. Hasan shipped a real working prompt at 36% the size of Brian's prompt — better routing, similar scenario pass. The slot pipeline can produce this — it's just bloated by default.

### 2. Property_management is where the bloat lives

Brian (23.2K) + Urban Vibe (22.9K) both run property_management. Same niche-defaults. Both ~2× the GLM-4.6 max. **PM is the primary slim target.**

### 3. Auto_glass is cleaner already

Mark (16.5K) at 83% routing strict + 100% fingerprints. Auto_glass niche-defaults are well-structured — fewer branches, less duplication. Slim work here is incremental, not transformative.

### 4. Real Fair Housing gap in Hasan's prompt

Hasan's snapshot has NO `Fair Housing Act` or `demographic` rule. The agent noted this as the only regulatory implication of the 13 missing fingerprints. **Flag for next prompt regen review.**

### 5. Urban Vibe has live behavior issues Phase 1a should fix

Urban Vibe scored 7/13 scenarios — 6 of those failures are exactly what Phase 1a's TRIAGE_DEEP edit targets:
- "no heat → agent asks 'is this an emergency'" — should immediately route via emergency triage
- General prospect questions not routing to Ray
- Tenant-lookup branching issues

Phase 1a's code edit lives in `niche-defaults.ts` property_management — shared with Urban Vibe. **Recomposing Urban Vibe (dryrun) with Phase 1a applied should improve their scenario score automatically.** Validation in next chat Step 1b.

## Artifacts inventory

```
tests/promptfoo/baselines/                          12 frozen JSON files (4 phases × 3 clients ish)
├── brian-{baseline,routing}-{current,phase1a,phase1b}-2026-06-03[-strict].json
├── urban-vibe-{baseline,routing}-current-2026-06-03[-strict].json
├── windshield-hub-{baseline,routing}-current-2026-06-03[-strict].json
└── hasan-sharif-{baseline,routing}-current-2026-06-03[-strict].json

tests/promptfoo/harness/fingerprints/
├── property_management.txt    14 substrings
├── auto_glass.txt             18 substrings
└── real_estate.txt            17 substrings

tests/promptfoo/harness/
├── README.md                                workflow doc
├── check-fingerprints.sh                    niche-agnostic checker
├── brian-knowledge-routing.yaml             6 scenarios (PM)
├── urban-vibe-knowledge-routing.yaml        6 scenarios (PM, Ray)
├── windshield-hub-knowledge-routing.yaml    6 scenarios (auto_glass, Mark)
└── hasan-sharif-knowledge-routing.yaml      6 scenarios (real_estate, Hasan)

tests/promptfoo/snapshots/
├── brian-current-2026-06-02.txt             23,184 chars
├── brian-phase1a-2026-06-03.txt             22,493 chars (Phase 1a applied)
├── urban-vibe-current-2026-06-02.txt        22,903 chars
├── windshield-hub-current-2026-06-03.txt    16,537 chars (NEW — created by Mark agent)
└── hasan-sharif-current-2026-06-02.txt      8,415 chars

scripts/
└── snapshot-mark-dryrun.ts                  NEW — reusable per-client snapshot pattern
```

## Next-chat priorities (refined with fleet evidence)

1. **exp-realty baseline** (Step 2 of next-chat doc) — 5 min copy work from hasan-sharif scaffold
2. **Validate Phase 1a improves Urban Vibe** (NEW Step 1b) — recompose urban-vibe dryrun + harness, expect scenario score to go UP
3. **Validate Phase 1a in production for Brian** (existing Step 1) — browser-test that queryKnowledge actually fires
4. **Reference Hasan's prompt structure as the slim target** when designing the PM slim (Steps 3a-3e). 8.4K is achievable; aim for under 12K minimum
5. **Flag Hasan's Fair Housing gap** at next prompt regen — regulatory concern, separate workstream

## Standing rules (reminder)

- No redeploys to hasan-sharif, exp-realty, urban-vibe, windshield-hub without explicit owner go
- calgary-property-leasing (Brian) has carve-out — ask before `--live`
- Brian's trial expires 2026-06-15 — 12 days
- Phase 1b lesson: verbose specificity in safety rules anchors behavior — don't bytes-compress
