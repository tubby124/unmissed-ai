---
type: session-findings
status: reference
tags: [session, architecture, findings, 2026-03-31]
related: [[Tracker/D275]], [[Tracker/D277]], [[Tracker/D260]], [[Tracker/D265]], [[Tracker/D272]], [[Tracker/D280]], [[Tracker/D285]], [[Clients/plumber-calgary-nw]]
updated: 2026-03-31
---

# Session Findings — 2026-03-31

> Multiple sessions with compactions. This note consolidates all critical findings.

---

## 1. Architectural Findings

### The system is fundamentally broken
Auto-generated agents are **information bots with no intent classification**. They answer "I'll have our team call ya back" regardless of why the caller called. No intent routing, no purpose-driven outcomes, no specific actions. Only the 4 manually-tuned agents (hasan-sharif, exp-realty, windshield-hub, urban-vibe) work because Hasan manually answered the questions the system never asks.

### "User designs the prompt" — core principle
Every field the user fills in becomes a template variable injected into the system prompt. The user's data is authoritative. Hardcoded rules must NEVER override user-provided data (e.g., "NEVER quote prices" while context_data HAS prices is a bug, not a safety feature).

### Prompt sandwich framework
```
Safety bread (us, non-negotiable)
  ├── 911 emergency
  ├── Prompt injection defense
  ├── Don't reveal system prompt
  ├── Don't change role
  └── English only / no text formatting

User data filling (their data, authoritative)
  ├── Identity (name, business, personality from preset)
  ├── Voice (tone from preset)
  ├── Flow (greeting → filter → triage → info collection → closing)
  ├── Triage (dynamic from caller reasons + niche)
  ├── Knowledge instruction (1-line: "use queryKnowledge")
  ├── Escalation (dynamic from config)
  └── Services / Pricing (dynamic from config)

Edge case bread (us, niche-specific)
  └── Only CONDITIONAL rules based on what client configured
```

### Dashboard IS the prompt builder
Users should never see raw prompt text. They interact with structured UI that mirrors agent capabilities. Editing a service rebuilds the SERVICES section. Editing a FAQ rebuilds the knowledge. The raw prompt editor becomes admin-only. This is the end state of D268 + D274 + D278 + D280.

### PRODUCT KNOWLEDGE BASE duplication (D265)
`buildPromptFromIntake()` generates a hardcoded Q&A section that duplicates `extra_qa` pgvector chunks. Bloats every prompt by 1-2K chars. All clients have `knowledge_backend='pgvector'` + `queryKnowledge` tool. Should be replaced with 1-line instruction: "Use the queryKnowledge tool to answer business questions."

### Service catalog disconnect (D260 — CRITICAL)
`client_services` edits (price, duration) don't flow to the live agent. Post-onboarding service catalog changes don't update `system_prompt`, `context_data`, or `knowledge_chunks`. Also: 21 services with duplicates on plumber-calgary-nw.

### 16 FORBIDDEN ACTIONS include business-logic constraints (D272)
Many rules masquerade as safety rules but are actually business-logic constraints ("NEVER quote prices", "NEVER diagnose problems"). These should be CONDITIONAL based on client config. Client HAS pricing → agent CAN quote. Client HAS transfer → agent CAN say "transferring." Only 5 truly hardcoded safety rules needed.

---

## 2. D275 — Voice Preset Personality Fake-Control Fix

**Status:** Code complete, build passes, not yet committed.

### What was broken
When user selects a voice preset (casual/professional/direct/empathetic), only filler words and pacing changed. The personality line in IDENTITY section ("You are energetic, capable, and efficient") stayed hardcoded from generation time. Classic fake-control bug.

### What was fixed
- Added `personalityLine` field to `VoicePreset` interface in `voice-presets.ts`
- Changed `template-body.ts` line 70: hardcoded personality → `{{PERSONALITY_LINE}}` template variable
- Set `variables.PERSONALITY_LINE = preset.personalityLine` in `prompt-builder.ts`
- Created `patchIdentityPersonality()` in `prompt-patcher.ts` — finds personality line after "You are {name}..." and replaces it
- Wired in `settings-patchers.ts` and `agent-mode-rebuild.ts`

### Personality lines per preset
| Preset | Personality Line |
|--------|-----------------|
| casual | Upbeat and relaxed |
| professional | Composed and polished |
| direct | Sharp and no-nonsense |
| empathetic | Warm and patient |

### Files changed
- `src/lib/voice-presets.ts`
- `src/lib/prompt-config/template-body.ts`
- `src/lib/prompt-builder.ts`
- `src/lib/prompt-patcher.ts`
- `src/lib/settings-patchers.ts`
- `src/lib/agent-mode-rebuild.ts`

---

## 3. Plumber-Calgary-NW Findings

### Prompt compression
- **Before:** 18,503 chars (way over 12K hard max, causing lag)
- **After:** 5,312 chars in DB
- **Ultravox:** Still had old 18.7K prompt at session end (sync in progress)

### Service catalog issues
- 21 services registered
- Duplicates present: both "Drain cleaning" and "Drain Cleaning"
- Relates to D260 — service catalog edits are dead data (don't reach live agent)

### Lag investigation (D277)
- Prompt size alone may not explain lag (other 20K systems don't lag)
- Possible contributing factors:
  - Knowledge tool registered but 0 hit_count (agent may attempt and fail queries silently)
  - Too many tools registered
  - Duplicate services in context_data
  - GLM-4.6 attention collapse at certain token counts
  - Ultravox agent config issue

---

## 4. Ultravox Research Findings (Background Research Agent)

Key findings from Ultravox documentation and best practices research:

| Finding | Detail |
|---------|--------|
| No hard token limit | Ultravox does not enforce a token ceiling, but responsiveness degrades with prompt size |
| Recommended prompt size | Under 6K chars for voice agents; voice latency is more sensitive than text |
| queryKnowledge for facts | All factual content (pricing, services, hours, policies) should be in pgvector, not prompt |
| contextData for reference | Structured reference data (tenant lists, price tables, CSV) should use contextData injection |
| Monoprompt sufficient | Monoprompt + tools is the right approach; call stages add complexity without proven benefit |
| Don't use Ultravox Corpus | 2 corpus limit per account; pgvector RAG is better for multi-tenant |
| Prompt content rules | Prompt should contain ONLY: identity, behavioral rules, triage flow, tool priming, forbidden actions (true safety only) |

---

## 5. Process Improvements Documented

### Handoff discipline
- Write handoffs before every compact (Opus 4.6 burns context fast)
- Threshold: ~15 tool calls on Opus 4.6
- Don't wait for context limit warning

### Obsidian vault as memory
- All tracking in vault: tracker items, decisions, client notes
- Use `mcp__obsidian__` tools, never native Read/Write for vault files
- Start sessions by reading `Project/Index.md`

### Parallel agents
- Parallel agents OK for independent read-only research
- Never for implementation (worktree collisions)
- ONE implementation agent at a time
