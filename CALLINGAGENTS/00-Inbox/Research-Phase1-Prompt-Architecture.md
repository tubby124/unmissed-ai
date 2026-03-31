---
type: research
tags: [research, prompt-architecture, sonar, phase-1]
date: 2026-03-31
source: Perplexity Sonar Pro via OpenRouter
status: logged
---

# Research — Phase 1: Prompt Architecture Foundations

> 3 Sonar Pro queries run 2026-03-31 for Phase 1 of the prompt architecture refactor.

## Query 1: Slot-Based Prompt Composition Patterns

**Finding:** Industry has shifted decisively toward **modular, layered prompt architectures**.

### Key Patterns Discovered
- **Prompt-Layered Architecture (PLA):** 4 core layers — Composition, Orchestration, Response Interpretation, Domain Memory. Treats prompts as modular, orchestratable first-class citizens. Built on OpenAI GPT APIs with modularity metrics and reusability benchmarks.
- **Modular prompt composition:** Components include tone fragments, logic modules, format templates, and constraint blocks. Production benchmarks: **92% first-draft acceptance rate with 18-second assembly vs 76% and 4 minutes for mega-prompts (13x speed improvement)**.
- **Dynamic context injection** via templating (Jinja2) is standard practice — inject context at call time, not build time.
- **AgentForge:** Open-source Python framework with composable skill abstraction, formal input-output contracts, YAML-based config separating agent logic from implementation.
- **Industry consensus: "layering beats cleverness."** Invest in architectural patterns for composable, testable prompt construction.

### Relevance to Our Architecture
- Directly validates D274 (named slots) and D268 (minimal base + dynamic sections)
- Our `templateContext` injection at call time aligns with dynamic context injection best practice
- PLA's "versioning" matches our `prompt_versions` table pattern

---

## Query 2: Ultravox Prompt Size and Performance

**Finding:** Ultravox recommends shorter prompts but has **no official character limit**.

### Key Facts
- **No official maximum** character limit stated by Ultravox — our 12K enforcement is a self-imposed guard
- Ultravox docs recommend **simple, focused system prompts** — "less is often more"
- **Inline tool instructions** preferred over verbose monoprompts (reduces cognitive load, maintains low latency)
- No direct metrics on first-token time vs prompt length in published docs
- Key resources: Guiding Agents guide, Prompting Guide, How Ultravox Works page
- **Deferred messages** and **inline tool instructions** are the recommended patterns for step-specific guidance

### Relevance to Our Architecture
- Our 12K limit is reasonable but not externally imposed — can adjust based on testing
- Validates D265 (remove hardcoded PRODUCT KNOWLEDGE BASE) and D269 (knowledge base as primary info source via queryKnowledge tool)
- Ultravox's preference for inline tool instructions validates our Pattern A (Tool Response Instructions) approach

---

## Query 3: Minimal Base Prompt + Dynamic RAG Pattern

**Finding:** ⚠️ **CAUTIONARY** — No direct academic proof that minimal base + RAG outperforms monolithic for voice agents.

### Key Facts
- One study found shorter "improved" prompt templates **degraded** task-specific metrics:
  - RAG compliance: 93.3% → 80% (Llama 3 8B)
  - Extraction pass rate: 100% → 90%
- **Eval-driven iteration** (Define-Test-Diagnose-Fix) is the recommended approach
- Industry standard: validate with **golden test sets (50-200 cases, 20% edge cases)**
- No specific voice AI or real-time chatbot research on minimal base + RAG pattern
- 2026 trend: shift toward real-world task outcomes and tool-use validation, not prompt engineering specifics

### Relevance to Our Architecture
- **Golden tests are NON-NEGOTIABLE** before any prompt shrinking — validates our Phase 1 approach of building tests FIRST
- Cannot assume shorter is better — must regression test against real call scenarios
- Supports the gated phase approach: build tests → establish baseline → then shrink
- 50-200 golden cases is the target (we currently have 5 Layer 1 + ~15 Layer 2 = ~20 total)

---

## Summary: No Conflicts with Our Approach

| Finding | Impact on Our Plan |
|---------|-------------------|
| Slot-based composition is industry standard | Validates D274 (named slots) |
| "Layering beats cleverness" | Validates our phased decomposition |
| Ultravox prefers shorter prompts, no hard limit | Validates D265, D269 (knowledge → RAG) |
| Inline tool instructions preferred | Validates Pattern A (tool response instructions) |
| Shorter prompts can DEGRADE performance | Golden tests MUST expand before Phase 3 shrinking |
| 50-200 golden cases recommended | We need 30+ more test cases before Phase 3 |

**No finding conflicts with the execution plan. Proceed with Phase 1 as designed.**