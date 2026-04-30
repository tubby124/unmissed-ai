---
type: tracker
status: open
priority: P1
phase: Phase-7-Onboarding
related:
  - Features/Provisioning
  - Clients/velly-remodeling
opened: 2026-04-30
---

# D-NEW — `niche=other` provision path silently skips `agent_name` DB write

## Status
**OPEN** — surfaced 2026-04-30 PM during Velly state check. Patched manually (DB UPDATE setting `velly-remodeling.agent_name = 'Eric'`) but the underlying provisioning bug remains.

## Problem
When a client provisions with `niche='other'`, the `agent_name` field never makes it into the `clients` table. The intake form collects an agent name (or one is generated from the niche default), but the `niche=other` branch in the provision route does not include `agent_name` in its `clients.insert()` call.

Effect: dashboard shows agent name as null, prompt patcher (`patchAgentName`) has nothing to anchor on if name is later edited via Settings, and any UI surface that reads `agent_name` (Overview AgentSpeaksCard, etc.) renders `—` until manually patched in Supabase.

## Reproduction
1. Run `/onboard-client [slug]` with niche='other' (or "haiku-suggested-other" path)
2. Complete activation
3. Query `select agent_name from clients where slug = 'X'` → returns `null`

## Likely fix surface
Provision routes — investigate:
- `src/app/api/provision/trial/route.ts`
- `src/app/api/provision/route.ts`
- `src/lib/intake-transform.ts` — `toIntakePayload()` may not be propagating `agent_name` for niche='other'
- `src/lib/activate-client.ts` — `clients.insert()` block

Expected: `agent_name` from the intake (or `NICHE_DEFAULTS.other.agentName` fallback) should always land in the row at provision time.

## Why this is a separate D-item (not bundled into Phase A concierge-status)
Phase A scope is schema additions + helpers + skill. This is a provisioning correctness bug — different concern. One-line fix expected once root cause is located.

## Acceptance criteria
- [ ] New `niche=other` client → `clients.agent_name` is non-null after provision
- [ ] Existing legacy clients with null `agent_name` get a one-shot backfill (or are documented as known-snowflake in `Tracker/`)
- [ ] Test: provision a fake client with niche='other' via test-activate, assert `agent_name` is set

## Connections
- → [[Features/Provisioning]]
- → [[Clients/velly-remodeling]] (first time the bug was surfaced)
