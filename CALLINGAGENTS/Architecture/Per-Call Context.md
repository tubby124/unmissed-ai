---
type: architecture
tags: [architecture, call-context, ultravox]
related: [Architecture/Control Plane Mutation, Architecture/Call Path Matrix]
source: docs/architecture/per-call-context-contract.md
updated: 2026-03-31
---

# Per-Call Context Contract

> Full contract: `docs/architecture/per-call-context-contract.md`

## The Rule
**NEVER store per-call data in system_prompt.**
Per-call data is injected via `templateContext` at call creation time.

## What Gets Injected Per-Call (NOT in prompt)
- `CALLER PHONE` — from Twilio body.From
- `TODAY` / `CURRENT TIME` — from new Date() in client timezone
- `OFFICE STATUS` — detectAfterHours() result
- `RETURNING CALLER` — from call_logs for same phone+client
- `RIGHT NOW` (injected_note) — clients.injected_note
- `businessFacts` — KnowledgeSummary + retrieval instruction
- `contextData` — reference data (tenant table, CSV)

## Assembly Path
```
inbound webhook
  → buildAgentContext()
  → callerContextBlock + businessFacts + contextData
  → callViaAgent(agentId, { templateContext })
  → Ultravox resolves {{callerContext}} placeholder in stored prompt
```

## Placeholders in system_prompt
Three placeholders that get resolved at call time:
- `{{callerContext}}` — caller phone, time, after-hours, returning caller
- `{{businessFacts}}` — knowledge summary + retrieval instruction
- `{{contextData}}` — reference data block

## Key Files
- `src/lib/agent-context.ts` — buildAgentContext(), detectAfterHours()
- `src/app/api/webhook/[slug]/inbound/route.ts` — call creation + injection
- `src/lib/ultravox.ts` — callViaAgent(), createCall() fallback

## Connections
- → [[Architecture/Control Plane Mutation]] (what's stored vs injected)
- → [[Architecture/Call Path Matrix]] (which paths get full injection)
