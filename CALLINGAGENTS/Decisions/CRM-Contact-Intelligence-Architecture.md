---
type: decision
date: 2026-04-01
status: implemented
tags: [crm, contacts, agent-memory, intelligence]
related: [[Phase7-CRM-Contacts-Calendar]], [[Per-Call Context Contract]], [[Control-Plane Mutation Contract]]
---

# CRM Contact Intelligence Architecture

## Decision
Build a unified `client_contacts` table as the single source of truth for caller identity, with call-by-call enrichment from Haiku classification feeding back into the agent's per-call context.

## Why (over alternatives)
- **Alternative 1: Keep deriving contacts from call_logs at read time** — This is what existed before. Problem: no persistent identity, no VIP unification, no accumulated intelligence. Every dashboard load re-aggregates 3000 rows.
- **Alternative 2: Separate CRM table disconnected from agent** — Pure dashboard feature. Problem: misses the biggest win — agent memory across calls.
- **Chosen: Unified table + bidirectional intelligence loop** — Contacts accumulate from calls AND feed back into calls. The agent gets smarter with every interaction.

## Architecture

### Data Flow (bidirectional)
```
Call comes in
  → buildAgentContext() reads client_contacts for this phone
  → Agent sees: name, interests, VIP status, notes, service history
  → Agent has a better conversation
  → Call ends
  → Haiku classifies: name, intent, topics, sentiment, service_requested
  → upsert_client_contact() accumulates into contact record
  → Tags merge (deduplicated), service interest updates, sentiment tracked
  → knowledge_query_log gets unanswered questions (L5→Gaps bridge, already existed)
  → Next call from same person: agent is smarter
```

### Contact enrichment per call (completed webhook)
| Field | Source | Accumulation strategy |
|-------|--------|----------------------|
| `name` | Haiku `caller_data.caller_name` | COALESCE — user-edited wins, then VIP, then agent-heard |
| `tags` | Haiku `key_topics` | Array merge + dedup, cap at 20 |
| `last_outcome` | Classification status (HOT/WARM/COLD/JUNK) | Overwrites — always latest |
| `preferences.last_service_requested` | Haiku `caller_data.service_requested` | Overwrites — always latest |
| `preferences.last_sentiment` | Classification sentiment | Overwrites — always latest |
| `preferences.has_booked` | Haiku `caller_data.booked` | Sticky true — once booked, always flagged |
| `call_count` | Incremented | +1 per completed call |
| `email` | Future: Haiku extraction | COALESCE — first non-null |

### Agent context injection (per-call, not stored in prompt)
When a known contact calls, `buildAgentContext` injects into `callerContextBlock`:
- `CALLER NAME:` — from contact (persistent, corrected)
- `VIP CALLER | relationship | notes | Transfer: enabled` — if VIP
- `CALLER INTERESTS: windshield, emergency, same-day` — accumulated tags
- `LAST SERVICE INTEREST: Emergency windshield replacement` — what they wanted
- `AGENT NOTE: ...` — owner-written guidance for the agent
- `CALLBACK PREFERENCE: afternoon` — scheduling hint
- `CONTACT NOTES: ...` — general notes

This is `PER_CALL_CONTEXT_ONLY` — injected via `templateContext.callerContext`, never stored in `system_prompt`.

### Linking
- `call_logs.contact_id` FK → `client_contacts.id` — direct join, no phone-based lookups
- Set at call completion time in the completed webhook
- Backfilled for all 559 existing call_logs rows

### VIP unification
`client_vip_contacts` → absorbed into `client_contacts` with `is_vip=true`.
3 runtime paths migrated (inbound, transfer-status, agent-test).
Old table kept alive 1 week for safety. Dashboard VIP CRUD routes still read old table (Phase 3 migrates these).

### Knowledge loop (already existed, now linked)
- Unanswered questions from `call_insights` → `knowledge_query_log` (L5→Gaps bridge)
- `bump_knowledge_gap_priority()` function — when caller topics match unresolved gaps, bumps priority
- Future: auto-promote gaps with 3+ occurrences to suggested FAQ

## Ultravox Compatibility
- `templateContext` is the standard Ultravox mechanism for per-call variable injection
- `{{callerContext}}` placeholder in stored `system_prompt` gets replaced at call creation
- No size limit documented, but callerContext stays under 2KB even with full enrichment
- Newlines in templateContext values work correctly (verified in production since March 2026)
- `contextSchema` on the agent's `callTemplate` declares the keys — no change needed (callerContext already declared)

## Files Changed (Phase 0-2)

### New
| File | Purpose |
|------|---------|
| `src/lib/utils/phone.ts` | Shared `normalizePhoneNA()` + `isValidE164NA()` |
| `src/lib/__tests__/phone.test.ts` | 13 unit tests for phone normalization |
| Supabase migration: `create_client_contacts` | Table, RLS, indexes, backfill, VIP migration |
| Supabase migration: `enrich_client_contact_upsert` | Enhanced upsert function + gap priority bumper |

### Modified
| File | Change |
|------|--------|
| `src/lib/demo-visitor.ts` | Re-exports normalizePhoneNA from shared util |
| `src/app/api/demo/start/route.ts` | Import from `@/lib/utils/phone` |
| `src/app/api/demo/call-me/route.ts` | Import from `@/lib/utils/phone` |
| `src/lib/agent-context.ts` | `ContactProfile` type, enriched `CallerContext`, contact intelligence injection |
| `src/app/api/webhook/[slug]/completed/route.ts` | Contact upsert + call_logs.contact_id linking |
| `src/app/api/webhook/[slug]/inbound/route.ts` | Reads `client_contacts` instead of `client_vip_contacts` |
| `src/app/api/webhook/[slug]/transfer-status/route.ts` | Same VIP migration |
| `src/app/api/dashboard/agent-test/route.ts` | Same VIP migration |

## Risks
1. **Tag explosion** — capped at 20 per contact, deduplicated
2. **Contact upsert race** — Postgres `ON CONFLICT` handles concurrent calls from same number
3. **Old VIP routes still hit old table** — acceptable for 1 week overlap; Phase 3 migrates dashboard CRUD
