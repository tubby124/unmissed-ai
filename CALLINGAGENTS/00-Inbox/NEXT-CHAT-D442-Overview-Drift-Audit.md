# Next Chat — D442 Overview Drift Audit

## Cold start
Brian (Urban Vibe owner) flagged Overview greeting tile shows different copy than what the agent actually says on calls. He also asked "if I change the greeting here, will it work there?" — meaning he can't tell if any Overview control is wired to runtime. Scope expanded 2026-04-30 to audit **every tile/pill on Overview**, not just greeting.

## Plan
`~/.claude/plans/inherited-foraging-shore.md` — read first. Has full surface inventory, drift table per tile, and ranked fixes.

## Tracker
[[Tracker/D442]] — full context, root cause, plan ref.

## Start commands
1. Read `~/.claude/plans/inherited-foraging-shore.md`
2. Run Phase 1 audit — dispatch `drift-detector` subagent for each of: hasan-sharif, exp-realty, windshield-hub, urban-vibe, manzil-isa
3. Augment with Bash script that pulls extra fields drift-detector doesn't cover (slot markers, GREETING_LINE raw, last_agent_sync_*, twilio_number presence, niche_custom_variables)
4. Output: `CALLINGAGENTS/00-Inbox/overview-drift-audit-2026-04-30.md`
5. Bring findings back, propose Fix 1-4 implementation order

## Critical files
- [src/app/api/dashboard/variables/route.ts](../src/app/api/dashboard/variables/route.ts) lines 218-228 — silent regen failure
- [src/app/api/dashboard/settings/route.ts](../src/app/api/dashboard/settings/route.ts) — `needsAgentSync` boolean (Fix 3 target)
- [src/components/dashboard/home/AgentIdentityCard.tsx](../src/components/dashboard/home/AgentIdentityCard.tsx) — Greeting tile (Fix 1, Fix 2 target)
- [src/components/dashboard/home/QuickConfigStrip.tsx](../src/components/dashboard/home/QuickConfigStrip.tsx) — 8 pills (Fix 1, Fix 4 target)
- [src/lib/prompt-slots.ts](../src/lib/prompt-slots.ts) lines 1166-1191 — GREETING_LINE resolution priority
- [src/lib/ultravox.ts](../src/lib/ultravox.ts) — `updateAgent()` + `buildAgentTools()` (runtime authoritative)

## Architecture refs
- [[Architecture/Control-Plane-Mutation-Contract]] — Section 7 risk #1, #2 directly relevant
- [[Architecture/Call-Path-Capability-Matrix]] — Section 6 UI truth obligations (Transfer/IVR phone-only)

## Constraints
- No-redeploy rule for hasan-sharif, exp-realty, windshield-hub, urban-vibe — Fix 5 blocked without explicit approval
- Fix 1-4 are display/plumbing, do not redeploy prompts

## Brian's secondary complaint (separate ticket)
Plan/upgrade UI scattered. Acknowledged in plan but NOT in this scope. Open as Phase 8 D-item if/when you address.
