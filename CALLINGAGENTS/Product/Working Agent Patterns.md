---
type: product
status: done
tags: [product, prompt, patterns, onboarding]
related: [Tracker/D247, Product/Intent Classification, Architecture/Prompt Generation]
updated: 2026-03-31
source: memory/working-agent-patterns.md
---

# Working Agent Patterns

> Full analysis: `memory/working-agent-patterns.md` (D253 output)
> Purpose: What makes the 4 manually-tuned agents work → systematize via D247 onboarding

## The 8 Patterns (summary)

| # | Pattern | Template Gap |
|---|---------|-------------|
| 1 | Lead with capability signal, not a question | Template opens with "how can I help?" |
| 2 | ONE critical niche question per intent | Template has generic `FIRST_INFO_QUESTION` |
| 3 | Explicit outcome per intent (book/quote/message) | Template says "team will call back" |
| 4 | Urgency detection + auto-skip | Template has no urgency concept |
| 5 | Niche-specific NEVER list | Template has generic NEVER list |
| 6 | queryKnowledge mandatory before deferring | Template doesn't enforce this |
| 7 | Tiered info collection by caller type | Template collects same fields for everyone |
| 8 | One redirect close (never chase) | Template unclear |

## The 6 Onboarding Questions That Replicate This

These are the questions the auto-template never asks but Hasan answered manually for each agent:

1. "What are the top 2-3 things callers ask?" → intent buckets
2. "For each — what's the ONE thing you need to know first?" → Collect + critical question
3. "What makes a call urgent vs. routine?" → URGENT block + auto-skip
4. "When a call ends well, what happened?" → Outcome per intent (book/quote/message)
5. "What should your agent NEVER say?" → NEVER block
6. "Are there different types of callers?" → tiered info collection

→ These 6 questions go into onboarding step 3: [[Tracker/D247]]

## Connections
- → [[Tracker/D247]] — implement the 6 questions in onboarding
- → [[Product/Intent Classification]] — the structural fix (TRIAGE rewrite)
- → [[Tracker/D243]] — TRIAGE template structure needs to match this
