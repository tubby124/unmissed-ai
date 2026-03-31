---
type: research
status: done
tags: [phase5, sonar, agent-config, UX]
updated: 2026-03-31
---

# Phase 5 Sonar Research — Agent Config UX Patterns

## Query 1: Agent Configuration UI / Prompt Variable Patterns (2025-2026)

### Variable Registry Patterns
- Platforms organize all template variables in centralized "agent knowledge" panels or card-based registries
- Human-readable lists with live previews, edit via drag-and-drop or searchable tables
- Variables feed directly into prompts without exposing raw text
- Multi-agent systems show specialized agent configs in a unified master dashboard

### Inline Editing UX
- Inline controls dominate: "Edit," "Override," "Pause" buttons in real-time status streams
- Users tweak settings directly in flow without navigating to separate editors
- Proactive nudges suggest edits based on context

### "What Your Agent Knows" Surfaces
- Dedicated transparency pages aggregate: reasoning traces, data sources, decision logs, memory edits
- Chronological "thought logs" with proactive status updates
- Hyper-personalized dashboards adapt views by role

### Editable Field Patterns
- Variables surface as labeled UI fields in modular sections (cards)
- Inline sliders, toggles, text inputs with auto-preview of prompt impact
- No raw templates exposed — natural language summaries link to editable grids

### Dashboard Organization
- Tabbed or modular zones: Overview | Controls | Knowledge | Insights
- Vector DB integration enables semantic search across configs

## Query 2: "Agent Brain" / Knowledge Visibility Dashboard (2025-2026)

### Thunai Brain (Leading 2025 Example)
- Centralized knowledge dashboard = single source of truth
- Unified view: FAQs, business facts, configured behaviors, institutional data
- Real-time knowledge access during simulations, drag-and-drop editing
- Structured data prioritized for fast retrieval; unstructured indexed for querying

### Voiceflow Workbench (Enterprise 2025)
- Single canvas: knowledge bases, intents, business facts, dialog flows as visual "brain map"
- Memory hierarchy: short-term context + long-term knowledge tree view
- Pre-deployment simulator shows exact data sources used
- Structured intents link to unstructured dynamic generation via integration nodes

### Common UI Patterns

| Pattern | Description | Key Decision |
|---------|-------------|-------------|
| Single Source Tree | Expandable nodes for structured + unstructured knowledge | Color-codes types for quick scans |
| Simulation Replay | Timeline view of knowledge accessed during mock calls | Pre-live verification |
| Graph-Based Memory | Visual graphs linking facts to behaviors | Audit trails for compliance |

## Relevance to Phase 5

- **D283 (variable registry):** Industry standard = never expose raw prompts. Every variable = labeled field. Our 19-card architecture is the right skeleton; gap is completeness.
- **D278 (Agent Brain):** Thunai Brain pattern matches our needs. Single page: structured knowledge, unstructured knowledge, configured behaviors, "test it" button.
- **D290 (what agent knows):** Tree/card hybrid with color-coded knowledge types is state of the art.
- **No conflicts** with our current approach. Research validates the direction.
