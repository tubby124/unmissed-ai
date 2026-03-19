# AgentContext Field Map — Phase 1B

Maps every field in `AgentContext` to its current source in the codebase.

**Source file:** `agent-app/src/lib/agent-context.ts`
**Phase:** 1B — Introduce AgentContext
**Date:** 2026-03-18

---

## business (BusinessConfig)

| AgentContext field | Current source | Source file |
|-------------------|---------------|-------------|
| `business.clientId` | `client.id` | Supabase `clients` row |
| `business.slug` | `client.slug` | Supabase `clients` row |
| `business.niche` | `client.niche` → default `'other'` | Supabase `clients` row |
| `business.businessName` | `client.business_name` → fallback: `client.slug` | Supabase `clients` row |
| `business.timezone` | `client.timezone` → default `'America/Regina'` | Supabase `clients` row |
| `business.hoursWeekday` | `client.business_hours_weekday` | Supabase `clients` row |
| `business.hoursWeekend` | `client.business_hours_weekend` | Supabase `clients` row |
| `business.afterHoursBehavior` | `client.after_hours_behavior` → default `'take_message'` | Supabase `clients` row |
| `business.afterHoursEmergencyPhone` | `client.after_hours_emergency_phone` | Supabase `clients` row |
| `business.businessFacts` | `client.business_facts` | Supabase `clients` row |
| `business.extraQa` | `client.extra_qa` (filtered: non-empty q+a) | Supabase `clients` row |
| `business.contextData` | `client.context_data` | Supabase `clients` row |
| `business.contextDataLabel` | `client.context_data_label` → default `'Reference Data'` | Supabase `clients` row |

---

## caller (CallerContext)

| AgentContext field | Current source | Source file |
|-------------------|---------------|-------------|
| `caller.callerPhone` | Twilio `body.From` → null if `'unknown'` | `api/webhook/[slug]/inbound/route.ts` line 20 |
| `caller.todayIso` | `now.toLocaleDateString('en-CA', { timeZone })` | `api/webhook/[slug]/inbound/route.ts` line 106 |
| `caller.dayOfWeek` | `now.toLocaleDateString('en-US', { weekday: 'long', timeZone })` | `api/webhook/[slug]/inbound/route.ts` line 107 |
| `caller.timeNow` | `now.toLocaleTimeString('en-US', { hour12: true, timeZone })` | `api/webhook/[slug]/inbound/route.ts` line 108 |
| `caller.isAfterHours` | `detectAfterHours()` — parses `business_hours_weekday/weekend` | `api/webhook/[slug]/inbound/route.ts` lines 147–171 |
| `caller.afterHoursBehaviorNote` | `buildAfterHoursBehaviorNote()` — uses `after_hours_behavior` + phone | `api/webhook/[slug]/inbound/route.ts` lines 173–180 |
| `caller.isReturningCaller` | `call_logs` lookup for `caller_phone` + `client_id` | `api/webhook/[slug]/inbound/route.ts` lines 113–136 |
| `caller.priorCallCount` | `priorCalls.length` | `api/webhook/[slug]/inbound/route.ts` line 123 |
| `caller.returningCallerName` | first `caller_name` from prior call_logs rows | `api/webhook/[slug]/inbound/route.ts` line 130 |
| `caller.lastCallDate` | `priorCalls[0].started_at` formatted `'en'` short | `api/webhook/[slug]/inbound/route.ts` line 125 |
| `caller.lastCallSummary` | `priorCalls[0].ai_summary` sliced to 120 chars | `api/webhook/[slug]/inbound/route.ts` line 127 |
| `caller.firstPriorCallId` | `priorCalls[0].ultravox_call_id` | `api/webhook/[slug]/inbound/route.ts` line 133 |

---

## capabilities (AgentCapabilities)

| AgentContext field | Current source | Source file |
|-------------------|---------------|-------------|
| `capabilities.*` | `getCapabilities(niche)` from Phase 1A map | `agent-app/src/lib/niche-capabilities.ts` |

All 8 capability flags: `takeMessages`, `bookAppointments`, `transferCalls`, `useKnowledgeLookup`, `usePropertyLookup`, `useTenantLookup`, `updateTenantRequests`, `emergencyRouting`.

---

## assembled (AssembledContextBlocks)

| AgentContext field | Current source | Source file |
|-------------------|---------------|-------------|
| `assembled.callerContextBlock` | Built from caller fields, wrapped in `[...]` | `api/webhook/[slug]/inbound/route.ts` lines 110–181 + 213–214 |
| `assembled.businessFactsBlock` | `buildContextBlock('Business Facts', client.business_facts)` | `api/webhook/[slug]/inbound/route.ts` lines 197–199 |
| `assembled.extraQaBlock` | `buildContextBlock('Q&A', formatted pairs)` | `api/webhook/[slug]/inbound/route.ts` lines 201–208 |
| `assembled.contextDataBlock` | `buildContextBlock(label, client.context_data)` | `api/webhook/[slug]/inbound/route.ts` lines 189–194 |

---

## What Phase 2 Will Do

Phase 2 will wire the prompt builder to consume `AgentContext` instead of scattered raw inputs.
At that point, the `assembled.*` blocks will be inserted into the prompt directly from `AgentContext`.

The inbound webhook will:
1. Build a `ClientRow` from the DB select
2. Call `buildAgentContext(client, callerPhone, priorCalls, now)`
3. Pass `ctx.assembled.*` blocks to the prompt assembly step

No live behavior changes until Phase 2.

---

## Extracted Helpers

Two helper functions were extracted from `inbound/route.ts` into `agent-context.ts` for testability:

| Helper | Extracted from | Lines in source |
|--------|---------------|-----------------|
| `detectAfterHours()` | `api/webhook/[slug]/inbound/route.ts` | 147–171 |
| `buildAfterHoursBehaviorNote()` | `api/webhook/[slug]/inbound/route.ts` | 173–180 |

These helpers are **pure functions** — no DB calls, no side effects. The inbound webhook behavior is preserved exactly. Phase 2 will update the webhook to call these helpers via `buildAgentContext()` instead of inlining them.
