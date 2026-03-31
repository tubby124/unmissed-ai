---
type: decision
date: 2026-03-31
status: accepted
tags: [decision, architecture, prompt, north-star]
related: [[Tracker/D280]], [[Tracker/D285]], [[Tracker/D273]], [[Tracker/D278]], [[Tracker/D283]]
---

# Decision: Prompt Sandwich Ownership Model

## Context
We're rebuilding the prompt architecture from monolithic 18K templates to composable slots. This decision defines WHO owns each part of the prompt.

## The Core Principle

**To us, it's variables. To them, it's fields they populate.**

The user never sees a "system prompt." They see:
- What's your business name?
- What do you do?
- What should the agent ask callers?
- Do you want call transfer? (toggle)
- Do you want booking? (toggle)
- What's your voicemail greeting?
- Today's update?

Each of those fields maps to a template variable. When they fill it in, the prompt rebuilds itself. They're designing the prompt without knowing it.

## Ownership Split

### Bread (us, non-negotiable)
Safety preamble, forbidden actions, voice naturalness, grammar, returning caller handling.
- Slots 1-4, 11 in the sandwich spec
- The user NEVER sees these
- We control them for safety, compliance, and voice quality
- Changes are versioned and tested, never client-specific

### Filling (them, their data)
Identity, tone, goal, conversation flow, triage, FAQ, knowledge, after-hours, transfer, booking, SMS, VIP.
- Slots 5-10, 12-19 in the sandwich spec
- **Every one of these is a field they populate**
- Fields don't conflict because each maps to exactly one slot
- Toggle booking on → Slot 17 appears. Toggle off → Slot 17 disappears. No interference.

## Three Tiers of Onboarding Effort

All three produce the same output: a set of populated variables that the sandwich assembles into a prompt.

### 1. "Decide for me"
Pick your niche, we pre-fill everything from NICHE_DEFAULTS + buildNicheFaqDefaults(). Click through. Done. 90% of the agent is ready.

### 2. "Let me tweak"
We show the pre-filled values ("Based on your industry, here's what most callers ask..."). They edit what's wrong, confirm the rest. Their edits become authoritative.

### 3. "Here's my stuff"
They upload a Word doc, a pricing sheet, paste their website. The system (Haiku, scraper, AI compiler) extracts structured data and populates the same variables. Owner confirms.

## Variable Population Priority
When filling a variable, sources are used in this priority order:

1. **Owner's explicit input** (always wins)
2. **AI-extracted from their uploaded docs/website** (D246 context extractor, AI compiler)
3. **Haiku-inferred from their business description** (D247 TRIAGE_DEEP)
4. **Niche defaults** (our fallback — NICHE_DEFAULTS)

The owner's confirmed data becomes the template variables. The variables become the prompt. **The prompt is a derived artifact — never hand-edited.**

## What This Means for D273

D273 ("Collect what matters for prompt building") is reframed:

**D273 = pre-populate the filling from the best available source, then let the owner confirm or override.**

Not "collect more onboarding data." The data is the same — the source and confirmation flow changes.

## What Phase 6 (D280) Delivers

The "Agent Brain" dashboard (D278) is literally this: a page where every variable is visible, labeled by what it does ("What your agent asks callers", "How your agent greets people"), and editable inline. When they save, `recomposePrompt()` rebuilds the sandwich from their variables.

## The 6-Phase Path

| Phase | What | Delivers |
|-------|------|----------|
| 1 (Foundation) | Define slots, build tests | The contract (this doc + sandwich spec) |
| 2 (Named Slots) | One function per slot | Composable pieces |
| 3 (Shrink+Clean) | Remove duplication, trim bread | < 8K prompts |
| 4 (Gap Wiring) | Wire disconnected fields to slots | Service edits, name changes work |
| 5 (Variable Visibility) | Show every variable on dashboard | Owner can see + edit everything |
| 6 (North Star) | recomposePrompt(), Agent Brain, no raw editor | **"User designs the prompt"** |

## Consequences
- No one ever touches raw prompt text (for new clients)
- Every architectural decision traces back to: "does this help the user populate their variables?"
- Features that can't be expressed as slot variables need a new design pattern (tool instructions, per-call context)
- The sandwich spec (`docs/architecture/prompt-sandwich-spec.md`) is the contract between "their fields" and "our prompt"