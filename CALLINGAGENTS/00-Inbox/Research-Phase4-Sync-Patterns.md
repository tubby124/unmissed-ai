---
type: research
phase: 4
date: 2026-03-31
source: Perplexity Sonar Pro via OpenRouter
---

# Phase 4 Research — Service Catalog Sync Patterns

## Query
How do SaaS platforms sync service catalog/menu changes to live AI voice agents in real-time? Best practices for event-driven sync between dashboard edits and deployed AI agent configuration.

## Key Findings

### 1. Event-driven > Polling
Event-driven systems (webhooks, message queues, pub/sub) are preferred. Sub-second updates vs 30-60s polling intervals.

### 2. Hybrid Pattern Validated
| Pattern | Pros | Cons | Use Case |
|---------|------|------|----------|
| Prompt Injection | Instant, no indexing | Token limits | Small catalogs (<50 items) |
| RAG Knowledge Base | Scalable, searchable | Indexing delay (seconds) | Large/dynamic catalogs |
| Hybrid | Best of both | Complexity | Business services with menus |

### 3. Trigger Both on Edit
Service catalog edits should rebuild prompt section AND re-index knowledge chunks. Use idempotent updates with diff checks.

### 4. Fetch Latest Config at Call Start
Agents fetch latest config at call start via telephony webhook headers. Gap is typically <5 seconds.

### 5. No Platform-Specific Docs
Vapi/Retell/Bland.ai config sync internals not publicly documented. General patterns consistent with our approach.

## Alignment with Our Architecture
- **Hybrid confirmed**: pgvector for knowledge, template slots for prompt — exactly the recommended pattern
- **Event-driven sync**: D260 implements fire-and-forget sync on service CRUD — matches recommendation
- **Call-time fetch**: `buildAgentContext()` + `templateContext` already fetches fresh config per call
- **No conflicts** with our approach
