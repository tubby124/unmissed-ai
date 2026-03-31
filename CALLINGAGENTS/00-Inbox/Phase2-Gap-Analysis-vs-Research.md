---
type: analysis
status: done
tags: [phase2, gaps, research-synthesis]
created: 2026-03-31
---

# Phase 2 Gap Analysis — What We Haven't Thought Of

Cross-referencing all research (Zero-Config, Phase 2 Sonar, UI Audit) against the current tracker and architecture.

---

## Already Tracked (confirmed by research)

These items exist in the tracker and research validates them:
- D278 Agent Brain — validated as greenfield differentiator
- D280 UI-driven composition — validated by layered card UX research
- D283 Variable visibility — resolved via progressive disclosure
- D273 Collect what matters — validated by "decide for me" defaults pattern
- D270 FAQ promotion from gaps — validated as "killer feature" for Agent Brain
- D276 Calendar auto-updates flow — validated by "just works" booking research
- D271 PDF upload — validated by competitor analysis
- D279 Niche-contextual knowledge — validated as correct approach
- D284 Self-improving loop — validated by gap detection research

## NEW — Not In Tracker (from research)

### D291 — GBP Auto-Import Onboarding (CRITICAL for zero-config)
**What:** User types business name → Apify Google Maps search → pick their business → auto-populate: name, address, hours, phone, services, reviews. Reviews become FAQ seed material.
**Why:** Nobody does this. Would be first "2-minute agent" in the market.
**Phase:** 6 (after architecture is solid)
**Depends on:** D268 (minimal base — need dynamic slots to receive GBP data)
**Effort:** Medium — Apify MCP already configured, $0.05/lookup

### D292 — Guided Call Forwarding Wizard (HIGH — universal pain point)
**What:** Ask carrier → show exact steps + dial codes → "Test it now" button → confirm working.
**Why:** #1 friction point in ALL voice agent platforms. Nobody has solved it. We have carrier data in `memory/canadian-carrier-call-forwarding.md`.
**Phase:** Can be done independently (doesn't depend on architecture refactor)
**Effort:** Low-Medium — data exists, need UI wizard + test call API

### D293 — "Paste URL → Agent Ready" Streamlined Flow
**What:** Paste URL → auto-scrape → show extracted info → user confirms → all data flows into template variables → agent built. Single flow, not multi-step.
**Why:** We're 80% there (scraper + AI compiler + knowledge pipeline). UX needs streamlining.
**Phase:** 6 (builds on D268 + D269)
**Effort:** Medium — pipeline exists, need UX unification

### D294 — Post-Onboarding "Your Agent Is Live" Summary
**What:** After activation: capabilities count, knowledge count, test call CTA, forwarding status, "here's what your agent can do."
**Why:** Users don't know if setup worked. No confirmation page exists.
**Phase:** Can be done independently
**Effort:** Low

### D295 — Audio Preview of Knowledge in Action
**What:** After editing a FAQ or knowledge chunk, user clicks "Hear it" → hears a simulated call snippet where the agent uses that knowledge.
**Why:** Closes the teaching loop. Users hear the impact of their edits. Sonar says no competitor does this.
**Phase:** 6 (after Agent Brain D278)
**Effort:** High — needs TTS call simulation

### D296 — FORBIDDEN_EXTRA Dead Code Bug Fix
**What:** `variables.FORBIDDEN_EXTRA` modifications (dental waitlist, restaurant delivery, legal referral) are silently discarded. Line 573 reads `nicheDefaults.FORBIDDEN_EXTRA` not `variables.FORBIDDEN_EXTRA`.
**Why:** Discovered in Phase 2 golden test expansion. 3 latent bug tests written.
**Phase:** 3 (D268 — slot-based builder fixes this automatically)
**Effort:** Zero — already fixed in prompt-slots.ts

## GAPS IN OUR THINKING (not just missing items)

### 1. No "time to first value" metric
We track D-items and phases but don't have a target for "signup → first real call answered." Research says this is THE competitive metric. Should be < 5 minutes.
**Action:** Add as a standing metric on our Phase 6 gate.

### 2. No post-activation feedback loop
After a client is live, we have no systematic way to know if the agent is WORKING WELL. We have call summaries and gap detection, but no "agent health score" that triggers proactive help.
**Action:** D223 (agent health indicator) partially covers this, but needs to be elevated. Should be CRITICAL, not MEDIUM.

### 3. No onboarding completion rate tracking
We don't know: how many people start onboarding vs finish it. Where they drop off. What step kills conversion.
**Action:** Add GA4 events per onboarding step. New D-item needed.

### 4. No "upgrade moment" detection
We don't detect when a trial user hits a capability wall that a paid plan would solve. E.g., trial user gets a transfer request but transfer isn't on their plan.
**Action:** D190 (feature unlock CTAs) partially covers this. But runtime detection of "user would benefit from X" is missing.

### 5. The forwarding setup is buried
Research says forwarding is the #1 pain point but our forwarding guide is just a static page. No wizard, no test, no confirmation. D292 addresses this.

### 6. No multi-channel intake
Some businesses might prefer to set up via text/WhatsApp instead of web form. Not urgent, but a moat builder for SMB market.

---

## Recommended Tracker Updates

| New D-item | Priority | Phase |
|---|---|---|
| D291 — GBP auto-import | CRITICAL | 6 |
| D292 — Forwarding wizard | HIGH | Independent |
| D293 — URL → agent streamlined | HIGH | 6 |
| D294 — Post-activation summary | HIGH | Independent |
| D295 — Audio knowledge preview | MEDIUM | 6+ |
| D296 — FORBIDDEN_EXTRA bug | CRITICAL | 3 (auto-fixed) |

| Existing D-item | Change |
|---|---|
| D223 (agent health) | Elevate MEDIUM → HIGH |
| D230 (activation smoke test) | Elevate HIGH → CRITICAL |
