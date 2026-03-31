---
type: decision
date: 2026-03-20
status: approved
tags: [decision, ultravox, agents-api]
related: [Architecture/Control Plane Mutation, Architecture/Per-Call Context]
---

# Decision: Agents API + toolOverrides over per-call createCall

## Context
Ultravox supports two call creation modes:
1. `POST /api/agents/{agentId}/calls` (Agents API) — uses stored agent as template, overrides at call time
2. `POST /api/calls` (createCall) — builds entire call config inline every time

## Decision
Use Agents API as primary path. createCall as fallback when Agents API fails.

## Key Rules (from memory/feedback-agents-api-guard.md)
- `toolOverrides` format: `{ removeAll: true, add: tools }` — NOT a raw array
- `initialState` is REJECTED by Agents API at runtime (tested, fails) — only works on createCall
- clients.tools is the runtime source of truth for tools — stored agent selectedTools are overridden every call

## Consequences
- clients.tools must be kept in sync via syncClientTools()
- Inspecting live Ultravox agent tools via API shows STALE data — always read clients.tools from Supabase
- Call state (workflow step tracking) only works on createCall path — Agents API falls back to DB (call_logs.call_state)

## Related
- [[Architecture/Control Plane Mutation]] — how clients.tools gets rebuilt
- [[Architecture/Call Path Matrix]] — fallback to createCall on failure
