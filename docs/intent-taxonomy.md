# Intent Taxonomy — unmissed.ai

Every caller intent maps to a handler. Currently all handled by monoprompt. Refactor to explicit routing only when a category consistently underperforms.

## Intent Categories

| Intent | Examples | Current Handler | Refactor Trigger |
|--------|----------|----------------|-----------------|
| **knowledge** | "What are your hours?", "Do you do ADAS?", "Where are you located?" | Prompt rules + queryKnowledge RAG | RAG hit rate < 80% on a category |
| **record** | "My name is...", "The VIN is...", "It's a 2019 Honda Civic" | Prompt field-collection flow | Field extraction accuracy < 90% |
| **action** | "Book me in for Tuesday", "Transfer me", "Send me a text" | HTTP tools (calendar/transfer/SMS) | Tool failure rate > 5% |
| **summary** | "Can you repeat that?", "What did we discuss?" | Prompt rules (COMPLETION CHECK) | Model forgets mid-call context |
| **escalation** | "Let me speak to someone", "This is an emergency" | Prompt rules → transfer/hangUp tool | False-positive escalation > 10% |

## Measurement

- **knowledge**: Track via `knowledge_query_log` — empty_result rate per category
- **record**: Track via transcript analysis — field capture accuracy (planned)
- **action**: Track via tool response status codes — failure rate per tool
- **summary**: Track via transcript — "I already told you" or repeated questions
- **escalation**: Track via transfer logs — was transfer warranted?

## Current Architecture

All 5 intent types are handled by the monoprompt (system prompt). The prompt contains:
- SERVICE FLOW section: handles record + action intents
- QUICK RESPONSES / FAQ: handles knowledge intent
- COMPLETION CHECK: handles summary intent
- EMERGENCY / TRANSFER rules: handles escalation intent
- queryKnowledge tool: augments knowledge intent with RAG

No explicit router exists yet. The GLM-4.6 model implicitly routes based on prompt instructions.

## When to Add an Explicit Router

Only when:
1. A single intent category's failure rate exceeds its threshold (see table above)
2. Prompt-level fixes have been tried and failed
3. The router can be implemented as a call stage (Track H) or pre-call classifier

Do NOT build a router preemptively.
