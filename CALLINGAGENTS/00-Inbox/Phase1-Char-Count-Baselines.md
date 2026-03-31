---
type: research
tags: [baseline, prompt-size, phase-1]
date: 2026-03-31
status: logged
---

# Prompt Char Count Baselines (Pre-Phase 3)

> Measured 2026-03-31 from golden test Layer 3 runs.
> These are the "before" numbers for Phase 3 (D265, D268, D269, D272) shrinking work.

## Baseline Counts (default mode, no features enabled)

All prompts currently exceed the 8K GLM-4.6 target and the 12K validatePrompt() limit.
The niche FAQ sections (PRODUCT KNOWLEDGE BASE) are the primary bloat source.

| Niche | Approx Chars | vs 8K Target | vs 12K Limit |
|-------|-------------|-------------|-------------|
| auto_glass | ~20,000 | +150% | +67% |
| hvac | ~18,200 | +128% | +52% |
| plumbing | ~17,900 | +124% | +49% |
| dental | ~18,000 | +125% | +50% |
| legal | ~18,400 | +130% | +53% |
| salon | ~18,400 | +130% | +53% |
| real_estate | ~18,400 | +130% | +53% |
| property_management | ~19,000+ | +138% | +58% |
| barbershop | ~18,000 | +125% | +50% |
| restaurant | ~18,000 | +125% | +50% |
| print_shop | ~18,500 | +131% | +54% |
| other | ~17,500 | +119% | +46% |

## Shrinking Targets (Phase 3)

| Target | Chars | How |
|--------|-------|-----|
| GLM-4.6 optimal | 6,000 | D265 (remove KB) + D272 (remove constraints) + D268 (dynamic sections) |
| Hard max | 8,000 | Same but allow some niche-specific triage/FAQ |
| Current validatePrompt() | 12,000 | Intermediate milestone before full shrink |

## Primary Bloat Sources

1. **PRODUCT KNOWLEDGE BASE** (~1,500-2,000 chars per niche) — D265 removes this entirely (pgvector serves it via queryKnowledge tool)
2. **Niche FAQ defaults** (~1,000-1,500 chars) — Move to knowledge_chunks
3. **Inline examples** (~600-800 chars) — Keep for GLM-4.6 behavioral anchoring
4. **Conversation flow** (~2,000-3,000 chars) — Trim unused filter cases, simplify

## Expected Post-Phase 3 Budget

```
Static bread: ~1,800 chars
Dynamic filling: ~2,000-3,000 chars (without KB section)
Conditional: 0-1,600 chars
TOTAL: 3,800-6,400 chars ← within GLM-4.6 optimal range
```