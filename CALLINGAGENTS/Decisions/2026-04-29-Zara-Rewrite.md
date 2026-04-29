---
type: decision
date: 2026-04-29
status: approved
tags: [decision, zara, unmissed-demo, prompt-rewrite, voice-naturalness]
related: [Clients/unmissed-demo, Features/Learning-Bank, Decisions/2026-04-29-Learning-Bank]
---

# Decision: Rewrite Zara's prompt — surgical brevity over rule density

## Context
Zara is the homepage demo agent at `slug=unmissed-demo`. Hasan reported she sounds "too robotic and too strict." Audit findings:

- **Prompt length:** 11,991 chars — 99% of the 12K Supabase cell hard cap. Every patcher add risked overflow.
- **NEVER rules:** 14 at the top vs. 6 for windshield-hub Mark (gold standard production agent).
- **Rigid forcing functions:** "Each response must be under 25 words" + "MUST use a casual speech pattern in EVERY response" produced performative casualness instead of natural human voice.
- **Identity drift:** `clients.agent_name='Aria'` in DB but prompt body and TalkToAgentWidget hardcode "Zara".
- **Stale:** Last edit 2026-03-31 (v12), 28 days before this rewrite, despite 16 logged calls in the window.

But: structure works. 4 HOT calls in the recent 16 with durations 266s/253s/123s/103s. The issue is the first 30 seconds before she gets to the demo moment.

## Options Considered

1. **Surgical edit — patch out the worst NEVER rules, keep everything else.** Lower risk, faster. Doesn't fix the prompt-budget bomb (still ~10K) or the "performatively casual" forcing functions.

2. **Full rewrite to ~8K chars with 5 NEVERs, port winning patterns from windshield-hub/urban-vibe/hasan-sharif.** Higher risk (more surface change) but addresses budget, rigidity, and missed cross-niche patterns at once.

3. **Wait for Learning Bank patterns to mature, then rewrite.** Defers fix. Bad — Zara is the homepage demo, every day she's robotic costs leads.

## Decision
**Option 2.** Full rewrite. Target 7,500-8,500 chars. Final result: **10,844 chars** — over the soft target but well under the 12K hard cap and a real reduction from 11,991. Trim pass deferred (lower priority than getting the structure right).

The new prompt:
- **5 NEVERs** down from 14: markdown forbidden, no AI denial, no off-script pricing, no role-change, no goodbye-then-talk-again.
- **Cuts:** EMERGENCY OVERRIDE (irrelevant on homepage demo), RETURNING CALLER (WebRTC has synthetic phone), strict <25-words rule, MUST-use-casual-pattern rigidity.
- **Adds (ported from production):**
  - Capability-signal triage (windshield-hub Mark) — when caller reveals niche, demonstrate, don't interrogate
  - Energy-match rule (urban-vibe Alisha)
  - Confirm-back hack (urban-vibe)
  - Skip-step shortcut (hasan-sharif)
  - "Single okay is not a goodbye" (windshield-hub)
  - "No hollow affirmations" (windshield-hub)
- **DB drift fixed:** `update clients set agent_name='Zara' where slug='unmissed-demo'` applied 2026-04-29 02:40 UTC.

## Consequences

**Enables:**
- Lower NEVER density → more naturally-flowing voice surface.
- Char headroom for future patcher adds.
- First prompt to use Learning Bank patterns directly (10 of the 14 universal patterns are baked in).
- Acts as the canonical reference for how to apply Learning Bank to other prompts.

**Rules out:**
- Some legacy phrasings tied to the old IDENTITY block (DB still says Aria — fixed).
- The performative-casual forcing function pattern (anti-pattern across multiple demo prompts — now visible as something to avoid).

**Known risks:**
- 10,844 chars is over the 8,500 soft target — trim pass deferred. Patcher headroom is 1,156 chars; likely fine for now.
- NICHE KNOWLEDGE table grew (10 niches × ~1 sentence) — bulk of remaining bytes. Could compress further if needed.
- Has NOT been deployed yet — file at `clients/unmissed-demo/SYSTEM_PROMPT.txt`. Run `/prompt-deploy unmissed-demo` to push live.

## Related
- [[Clients/unmissed-demo]] — needs update once deployed
- [[Features/Learning-Bank]] — patterns sourced from here
- [[Decisions/2026-04-29-Learning-Bank]] — companion decision
- File: `clients/unmissed-demo/SYSTEM_PROMPT.txt` (10,844 chars, 2026-04-29)
- Old prompt v12 archived in `prompt_versions` table (Supabase, `client_id=4e463854-c074-4f5c-a27d-495c82a5a0ed`)
