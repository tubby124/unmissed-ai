---
type: tracker
status: open
priority: P2
discovered_during: Mohammad Emon manual provision trace (slug=emon), 2026-05-21
related:
  - "[[Tracker/D-onboarding-bugs-2026-05-21]]"
  - "[[Architecture/Prompt-Pipeline]]"
tags: [niche-defaults, prompt-pipeline, real-estate, conversation-flow]
updated: 2026-05-21
---

# Phase 4 — Niche-default rework (Bug #1 from onboarding trace)

The previous PR (5 bugs shipped, commits `dc0f45c..4e9f14b`) addressed the tractable onboarding flow issues. **Bug #1** — niche default size — remains open. This file is the plan for that work.

## Current state

| Client | Niche | Prompt size | Plan validation |
|---|---|---|---|
| `emon` (Mohammad Emon) | real_estate | **21,331** | ✓ under new 25K cap |
| `calgary-property-leasing` (Brian) | property_management | **22,922** | ✓ under cap |
| `urban-vibe` | property_management | **22,667** | ✓ under cap |
| `windshield-hub` | auto_glass | **15,483** | ✓ comfortable |
| `hasan-sharif` (Aisha) | real_estate | **8,361** | legacy, no slots |

The 25K cap was bumped from 21K in the prior commit to match operational reality. But the goal of the cap is comfort, not survival — getting prompts down to the documented 15K target gives:
- Faster Ultravox roundtrip per call (smaller context = faster TTFB)
- Cheaper inference token spend
- Headroom for niche-specific custom variables without hitting walls

## Where the bytes go (real_estate breakdown)

From the Emon trace artifact at [[00-Inbox/onboard-emon-trace/STEP-06-build-slot-prompt]]:

```
conversation_flow    8916 chars   (niche default real_estate)
forbidden_actions    3895 chars
inline_examples      1758 chars
tone_and_style        914
persona_anchor        663
returning_caller      597
voice_naturalness     452
goal                  462
business_notes        416
escalation_transfer   374
recency_anchor        312
identity              281
knowledge             303
call_handling_mode    277
grammar               291
after_hours           142
faq_pairs              60
safety_preamble       398
```

`conversation_flow` is **41% of the entire prompt**. That's the trim target.

## Sub-breakdown of `conversation_flow` for real_estate

From `src/lib/prompt-config/niche-defaults.ts:444`:

| Sub-block | Approx chars | Status |
|---|---|---|
| `TRIAGE_DEEP` | **~3500** | 11 intent branches with repetitive language. Top trim target. |
| `NICHE_EXAMPLES` | **~2600** | 7 verbose examples (A-G). Compressible to 4 with tighter prose. |
| `FORBIDDEN_EXTRA` | ~1000 | 8 rules. Each is justified but several can be one-liner. |
| `INFO_FLOW_OVERRIDE` | ~700 | One-line-per-branch sequence. Already tight. |
| `CLOSING_OVERRIDE` | ~700 | Read-back templates per intent. Already tight. |
| `TRIAGE_SCRIPT` | ~300 | 4-branch openers. Already tight. |
| Misc keys (INFO_LABEL etc) | ~500 | Each is one-liner. |
| **Total** | **~9300** | |

(Each sub-block lands in conversation_flow via prompt-slots.ts:buildConversationFlow.)

## Recommended trim sequence (approach next session in this order)

### A. NICHE_EXAMPLES tighten (2.6K → ~1.3K, save ~1.3K)
Compress all 7 examples to 3-4 lines each. Drop redundant "[Buyer with budget + timeline = high-quality lead]" trailers — those teach via the example content itself, not the editorial. Keep 4 essentials (BUY, SELL, EVAL, SHOWING). Move RENT, COLD-CALL, COMMISSION examples to pgvector as "training transcripts" if needed.

### B. TRIAGE_DEEP rewrite (3.5K → ~2K, save ~1.5K)
- Merge SHOWING REQUEST into BUYING branch (it's a sub-state of buyer intent)
- Compress LEGAL / MORTGAGE and INVESTMENT into single "OUT-OF-SCOPE" rule
- Drop VENDOR / JOB INQUIRY / TEAM QUESTION sub-branches — these are edge cases that route to the same hangUp-or-message flow as cold calls. Cover them with one general "off-topic caller" rule.
- Each branch keeps the field-collection sequence (the actual training signal) but drops repetitive prose.

### C. FORBIDDEN_EXTRA condense (1K → ~600, save ~400)
8 rules → 5 rules. Combine related Fair Housing + neighborhood-character rules. Combine MLS price/valuation/comp rules into one. Combine showing-confirmation + listing-availability into one.

### D. Confirm no regression on Brian + Urban Vibe
Both clients are `niche=property_management`, not affected directly by real_estate changes. But the shared slot templates (line 1188-1232 in prompt-slots.ts) ARE shared. Any change there → snapshot test (auto-glass-baseline, hvac-baseline, plumbing-appointment-booking, property_management) should re-run clean.

### E. Re-run Emon's prompt build
Target outcome: real_estate prompt lands 15-17K (down from 21K).

### F. Apply the same B/C trims to property_management, auto_glass, hvac, plumbing
Same patterns, same savings. Brian + Urban Vibe drop from ~23K to ~18K. Windshield Hub drops from 15K to ~13K.

## Standing rules to respect during this work

Per [[Architecture/Prompt-Pipeline]]:
- All 19-slot snapshots in `src/lib/__tests__/snapshots/` need updates AFTER each niche default change
- Run `npm run test:all` after every block edit — the snapshot tests + golden tests catch regressions immediately
- `validatePrompt()` still gates at 25K — if a single client's intake + niche pushes past, something's wrong
- Do NOT redeploy hasan-sharif, exp-realty, windshield-hub, urban-vibe (per refactor-phase-tracker no-redeploy rule on legacy clients)
- DO update Emon's prompt after each meaningful niche-default change (he's the live canary)
- DO update Brian's prompt iff he gets explicit re-deploy approval per refactor-phase-tracker

## Acceptance criteria

- Emon's prompt lands ≤ 17K
- Brian's prompt lands ≤ 18K
- Urban Vibe's prompt lands ≤ 18K
- All snapshot tests pass after updates
- `provisioning-completeness-check.ts --target=emon` returns ✓ ALL PASS
- Test call to Emon's Twilio number sounds equally good or better than current state
