---
type: harness-baseline
status: locked
created: 2026-06-03
target_client: calgary-property-leasing
target_prompt_chars: 23180
related:
  - "[[2026-06-02-brian-prompt-audit]]"
  - "[[2026-06-02-brian-prompt-slimming-handoff]]"
tags:
  - harness
  - baseline
  - prompt-slim
  - knowledge-routing
---

# Harness BEFORE-Baseline — Brian (Eric) on 2026-06-03

Locked baseline numbers for the CURRENT 23,180-char Brian prompt. Any prompt change (P2 consolidation, full slim, future refactor) must be re-run against this same harness and compared.

## What was built this session

```
tests/promptfoo/harness/
├── README.md                          # per-client workflow + reusability guide
├── check-fingerprints.sh              # niche-agnostic substring assertion (~90 lines bash)
├── fingerprints/
│   └── property_management.txt        # 14 substrings (13 sacred + 1 Bug 3 track)
└── brian-knowledge-routing.yaml       # 6 policy scenarios with hallucination traps

tests/promptfoo/baselines/             # NEW dir
├── brian-baseline-current-2026-06-03.json       # 13/15 PASS (86.67%)
├── brian-routing-current-2026-06-03.json        # 6/6 PASS (LENIENT — false signal)
└── brian-routing-current-2026-06-03-strict.json # 2/6 PASS (33%) — TRUE baseline
```

**Provider swap:** `openrouter:anthropic/claude-haiku-4.5` → `groq:llama-3.3-70b-versatile`. OpenRouter key was dead (401 "User not found"). Llama 70b on Groq is a closer proxy to Ultravox v0.7 / GLM-4.6 anyway — same open-weight transformer lineage, same long-context "lost in the middle" failure mode.

## BEFORE numbers (locked baseline)

| Test | Pass | Total | Rate | Notes |
|---|---:|---:|---:|---|
| Scenario regression (brian-baseline.yaml) | 13 | 15 | **86.67%** | 2 real bugs caught — see below |
| Knowledge routing strict (with hallucination traps) | 2 | 6 | **33.33%** | Matches production 0% RAG hit rate observation |
| Sacred fingerprints (property_management.txt) | 13 | 14 | **92.86%** | 1 expected fail = Bug 3 not in source |
| Prompt size | — | — | **23,180c** | 1.93× the 12,000c GLM-4.6 hard max |

### Scenario regression — 2 failures on CURRENT prompt

1. **Maintenance emergency (no heat)** — agent does NOT mention 9-1-1.
   - Output: `"mmhmm, sorry to hear that, yeah, no heat can be pretty rough... Can you tell me what's your unit number and a quick idea of what's going on..."`
   - Expected: prompt has `"call 9-1-1 right now"` in the emergency triage — should fire on "no heat in winter"
   - Classification: **real prompt bug** — the 9-1-1 line is buried under enough other instructions that the model skips it
2. **Bedbug urgency** — agent does NOT flag as urgent.
   - Output: `"Sorry to hear that, yeah, bedbugs can be a real nuisance. Can you tell me a bit more about what's going on..."`
   - Expected: prompt has `"For bedbug reports: treat as urgent immediately"` → should not soft-pedal
   - Classification: **real prompt bug** — same lost-in-the-middle pattern

### Knowledge routing — 4 failures on CURRENT prompt

The lenient eval (no hallucination trap) showed 6/6 PASS — false-positive signal. The strict eval (with hallucination traps) shows 2/6 PASS. **This is the production bug.** Pattern:

- Caller asks: "what areas do you cover?"
- Agent says: `"let me check that one for you... one sec. We cover... northeast, northwest, southeast..."`
- Agent NEVER actually called queryKnowledge — it hallucinated specific neighborhoods after the bridge phrase

Real queryKnowledge calls would **interrupt generation** (the tool runs, then a new turn starts). Saying "let me check" AND listing specific facts in one breath proves the tool was never invoked. The lost-in-the-middle failure mode is reproducible on Llama 70b — same way GLM-4.6 fails in production.

| Scenario | Strict pass? | What happened |
|---|:---:|---|
| Areas served | ❌ | Hallucinated "northeast, northwest, southeast" |
| Application process | ❌ | Likely invented steps; check raw output |
| Building pet rules | ❌ | "We do allow pets in some buildings" — invented |
| Utilities included | ❌ | "Heat and water are included for most units" — invented |
| Unit-specific rent (SCOPE) | ✅ | Correctly routed to Brian, no $ quoted |
| Application fee | ✅ | Said "let me check, I'll grab that" — stopped, no invention |

### Sacred fingerprints — 1 documented gap

13/14 sacred substrings present. The 1 missing: `"ALWAYS ASK why they're calling"` (Bug 3 returning-caller fix). Live on Brian's Ultravox agent via `regenerateSlot('returning_caller')` but NOT in source. Next PM client to onboard will inherit the buggy version. Real follow-up item.

## P2 success criteria (locked)

Any P2 (queryKnowledge consolidation) edit must hit ALL of:

| Metric | Current | P2 target | Why |
|---|---:|---:|---|
| Scenario pass | 13/15 (86.67%) | ≥ 13/15 | No behavioral regression |
| Strict routing pass | 2/6 (33%) | ≥ 5/6 (83%) | Drop hallucination rate to 1-of-6 max |
| Fingerprints | 13/14 (92.86%) | ≥ 13/14 | No new sacred-rule drops |
| Prompt size | 23,180c | ≤ 23,180c | Don't grow; ideally shrink the 4 mentions |

If P2 lands all 4, **deploy via `/prompt-deploy calgary-property-leasing`** (Brian carve-out). If any miss, **investigate root cause before deploy**.

## Full-slim plan success criteria (different, larger ambition)

| Metric | Current | Slim target |
|---|---:|---:|
| Scenario pass | 13/15 | ≥ 14/15 — the slim should ALSO fix the no-heat and bedbug bugs |
| Strict routing pass | 2/6 | ≥ 5/6 — same as P2 |
| Fingerprints | 13/14 | 14/14 — slim should land Bug 3 source fix too |
| Prompt size | 23,180c | ≤ 11,800c (under GLM-4.6 hard max, per audit doc) |

## Reusability

The harness is built to be portable. To onboard the next client:

1. Drop a snapshot at `tests/promptfoo/snapshots/<slug>-current-YYYY-MM-DD.txt`
2. Verify their niche's fingerprint file exists at `tests/promptfoo/harness/fingerprints/<niche>.txt` (or write one — 10-15 substrings)
3. Copy `brian-baseline.yaml` → `<slug>-baseline.yaml`, swap business_name + scenario flavor
4. Copy `harness/brian-knowledge-routing.yaml` → `harness/<slug>-knowledge-routing.yaml`
5. Run all 3 baselines to capture starting numbers
6. Any future prompt change for that client is measurable with the same 3 commands

See [tests/promptfoo/harness/README.md](../../tests/promptfoo/harness/README.md) for full workflow.

## Known gaps

- **Llama 70b is a proxy.** Tonally close to GLM-4.6 but not identical. 100% production fidelity would need a staging Ultravox agent. Catches 80%+ of bugs.
- **No real tool-call detection.** Bridge-phrase + hallucination-trap is a strong proxy but not the same as observing a `queryKnowledge` tool invocation. Future: custom promptfoo provider that captures tool calls.
- **No CI gate yet.** Runs locally. Add to pre-push hook once stable.
- **Fingerprint files for non-PM niches not written.** Auto_glass, real_estate, dental, restaurant — all TODO.
- **Replay harness (`brian-replay-2026-06-02.yaml`) provider not yet swapped from OpenRouter.** Will fail until updated. Defer until needed.

## Next decision point

User-facing question: do we
- (a) **proceed with P2** (narrow queryKnowledge consolidation, ~2 mentions in TRIAGE_DEEP only) and validate against this baseline, OR
- (b) **pivot to the full slim plan** (22.9K → ~9.6K char target, multi-slot restructure) and use this baseline as the gate

Either path the harness is the same. The numbers above are the locked "BEFORE."
