---
type: decision
status: active
date: 2026-03-31
tags: [architecture, prompt, north-star]
related: [[Tracker/D280]], [[Tracker/D285]], [[Tracker/D278]], [[Architecture/Prompt Generation]]
updated: 2026-03-31
---

# Decision: The User Designs the Prompt

## Context
Auto-generated agents were broken because the system prompt was treated as a static template with sprinkled user data. Hardcoded rules ("NEVER quote prices") overrode data the user explicitly provided (pricing in context_data). The agent's personality ("energetic, capable, efficient") couldn't be changed from the UI.

## Decision
**The user IS the prompt builder — they just don't know it.**

Every detail the user provides through the UI (FAQs, prices, services, caller reasons, hours, emergency words, tone preference) becomes a template variable injected into the system prompt. The prompt is a DERIVED ARTIFACT, not a manually crafted document.

## Principles
1. **User's data is authoritative** — if the user entered pricing, the agent uses pricing. No hardcoded rules override user-provided data.
2. **Hard constraints = safety only** — no impersonation, no medical advice, hang-up rules. Nothing else.
3. **Every UI field = template variable** — agent_name, personality, services, triage script, hours, emergency words, close_person.
4. **Dashboard = prompt builder** — no user ever needs to see raw prompt text.
5. **Prompt sandwich** — Bread (safety/identity, us) + Filling (user's data as variables) + Bread (edge cases, GLM rules).

## Consequences
- `buildPromptFromIntake()` becomes a pure template renderer — no hardcoded business logic
- Niche defaults provide starting values, but user overrides always win
- Every settings card maps to one or more template variables
- "Agent Brain" dashboard (D278) shows everything the agent knows, editable inline
- Self-improving loop: calls → gaps → suggestions → user confirms → agent improves

## Tracker Items
- D280 (UI-driven composition), D285 (sandwich framework), D278 (Agent Brain), D283 (variables visible), D275 (personality fix — DONE)
