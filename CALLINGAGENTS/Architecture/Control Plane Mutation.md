---
type: architecture
tags: [architecture, settings, ultravox]
related: [Features/Booking, Features/SMS, Features/Transfer, Features/Knowledge RAG]
source: docs/architecture/control-plane-mutation-contract.md
updated: 2026-03-31
---

# Control Plane Mutation Contract

> Full contract: `docs/architecture/control-plane-mutation-contract.md`

## The Rule
Every field in `clients` table has a **mutation class** that determines what must happen when it changes.

## Mutation Classes
| Class | What it means |
|-------|---------------|
| `DB_ONLY` | Write to clients table. No Ultravox sync needed. |
| `DB_PLUS_PROMPT` | Write + patch system_prompt + updateAgent() |
| `DB_PLUS_TOOLS` | Write + updateAgent() to rebuild selectedTools |
| `DB_PLUS_PROMPT_PLUS_TOOLS` | Write + patch prompt + rebuild tools (booking only) |
| `DB_PLUS_KNOWLEDGE_PIPELINE` | Write + reseedKnowledgeFromSettings() |
| `READ_MODEL_ONLY` | Computed from other fields, no direct write path |
| `PER_CALL_CONTEXT_ONLY` | Injected at call time via templateContext, never in system_prompt |

## needsAgentSync Triggers
These fields in a PATCH /api/dashboard/settings call trigger updateAgent():
- `system_prompt`
- `forwarding_number`
- `transfer_conditions`
- `booking_enabled`
- `agent_voice_id`
- `knowledge_backend`
- `sms_enabled`
- `twilio_number`

## Known Drift Risks
- `twilio_number` NOT in needsAgentSync → SMS tool stale after God Mode change
- `business_name` not re-patched post-provision → manual /prompt-deploy needed
- UI badges (buildCapabilityFlags) ≠ agent tools (buildAgentTools) by design for booking

## Key Files
- `src/app/api/dashboard/settings/route.ts` — main PATCH handler
- `src/lib/ultravox.ts` — buildAgentTools(), updateAgent(), syncClientTools()
- `src/lib/capability-flags.ts` — buildCapabilityFlags() (UI truth)
- `src/lib/prompt-patcher.ts` — patchCalendarBlock(), patchAgentName()

## Connections
- → [[Features/Booking]] (DB_PLUS_PROMPT_PLUS_TOOLS)
- → [[Features/SMS]] (DB_PLUS_TOOLS)
- → [[Features/Transfer]] (DB_PLUS_TOOLS)
- → [[Features/Knowledge RAG]] (DB_PLUS_KNOWLEDGE_PIPELINE)
