# Data Boundaries — unmissed.ai

Defines what is RAG vs structured lookup vs workflow state. The agent NEVER writes to any data source during a call.

## Data Sources

| Data Source | Trust Level | Injected Via | Agent Can Modify? | Example |
|-------------|------------|-------------|-------------------|---------|
| `business_facts` (clients table) | HIGH — operator-set | `templateContext.businessFacts` | NO | Hours, address, services offered |
| `extra_qa` (clients table) | MEDIUM — operator-curated | `templateContext.extraQa` | NO | "Do you do mobile service?" → "Yes, within 50km" |
| `knowledge_chunks` (pgvector) | MIXED — requires trust tier | `queryKnowledge` tool result | NO (read-only) | Website FAQ, PDF content, transcript-inferred |
| `context_data` (clients table) | REFERENCE — structured lookup | `templateContext.contextData` | NO | Service area list, vehicle makes covered |
| `call_logs` (previous calls) | REFERENCE — system-generated | `initialMessages` (B2a) / `callerContext` | NO | Returning caller context |
| Tool results (calendar, transfer) | EPHEMERAL — per-call | Tool response body | NO | "Booked for Tuesday 2pm" |

## Trust Tiers (knowledge_chunks)

| Tier | Source | Auto-Approve? | High-Risk Categories |
|------|--------|--------------|---------------------|
| `high` | Manual entry, operator-curated FAQ, confirmed website content | Yes (standard categories) | NO — always requires admin |
| `medium` | Website scrape, PDF extraction, enrichment | No — requires admin/owner approval | NO |
| `low` | Transcript inference, gap detection suggestion | No — requires admin approval | NO |

## High-Risk Categories

These categories NEVER auto-promote from transcript inference, regardless of confidence:
- **pricing** — wrong price = legal liability
- **warranty** — warranty claims have contractual implications
- **legal** — legal advice requires professional qualification
- **hours** — incorrect hours = missed revenue
- **certifications** — false cert claims = regulatory violation

## Boundary Rules

1. Agent NEVER writes to any data source during a call
2. All data flows are read-only during a call
3. Post-call transcript analysis may SUGGEST new knowledge chunks
4. Suggestions enter the approval workflow (Track A1) — never auto-approved for high-risk
5. Structured operational data (lead status, appointments, payments) belongs in tables, not RAG
6. Real-time state (callback queue, task status, live CRM) is NEVER in RAG

## What Belongs in RAG

- FAQs and business policies
- Process explanations and service descriptions
- Approved website knowledge
- Approved PDF content (manuals, brochures)
- Niche templates and curated Q&A
- Service/process education

## What Does NOT Belong in RAG

- Lead status, callback queue, tenant balances
- Appointment state, payment status
- Live CRM state or task lists
- Any real-time operational state
- Pricing (unless operator-verified and high-trust)
