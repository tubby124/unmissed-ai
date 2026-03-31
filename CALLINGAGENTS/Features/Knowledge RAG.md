---
type: feature
status: live
tags: [feature, knowledge, pgvector, rag]
mutation-class: DB_PLUS_KNOWLEDGE_PIPELINE
plan-gate: core
updated: 2026-03-31
---

# Feature: Knowledge RAG (pgvector)

## How It Works
1. Business content scraped (website) or uploaded (PDF) → embedChunks()
2. Chunks stored in `knowledge_chunks` table with pgvector embeddings
3. At call time: `queryKnowledge` tool → hybrid_match_knowledge() search
4. Results returned to agent mid-call

## Sources
- Website scrape: `source='website_scrape'`, status='approved'
- PDF uploads: `source='pdf'`, status='approved'
- Settings (business_facts, extra_qa): `source='settings_edit'`
- AI Compiler: `source='compiled_import'`, status='approved'

## D235 Known Gap (OPEN)
`reseedKnowledgeFromSettings()` skips reseeding when chunks already exist.
This means updated business_facts/extra_qa don't propagate to pgvector until next full wipe.
Fix: delete 'settings_edit' source chunks before re-embedding (3-line change in lib/embeddings.ts)

## AI Compiler (LIVE)
- Haiku 4.5 extracts structured facts from raw text
- BLOCKED_KINDS: never written (call_behavior_instruction, conflict_flag, etc.)
- HIGH_RISK_KINDS: trust_tier='medium', require verification checkbox

## Key Files
- `src/lib/embeddings.ts` → embedChunks(), reseedKnowledgeFromSettings()
- `src/lib/seed-knowledge.ts` → seedKnowledgeFromScrape()
- `src/app/api/knowledge/[slug]/query/route.ts`
- `src/app/api/dashboard/knowledge/compile/route.ts`

## Connections
- → [[Architecture/Control Plane Mutation]] (DB_PLUS_KNOWLEDGE_PIPELINE)
- → [[Tracker/D235]] (reseed gate bug — open)
