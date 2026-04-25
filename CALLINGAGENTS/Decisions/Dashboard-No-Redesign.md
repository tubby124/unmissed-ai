---
type: decision
status: accepted
date: 2026-04-25
deciders: [Hasan]
supersedes: [D286 original tier-collapse scope]
related:
  - "[[Architecture/Dashboard-Hardening-Plan]]"
  - "[[Tracker/D286]]"
tags: [decision, dashboard, scope]
---

# Dashboard No-Redesign Decision

## Context
After Phase 6 Wave 2 shipped (D266, D278, D288, D290, D306, D308, D341), the Settings tab still has 47 cards in a flat 1-2-3 column grid. Initial D286 plan was to wrap them in 6 collapsible tier sections.

Hasan reviewed the proposal and rejected the scope: "I don't need to remove this entire fucking dashboard that I just built."

## Decision

**Do NOT reorganize the dashboard layout.** The visual structure stays as-is.

Instead, three functional priorities:
1. **Inline edit for paying users' friction points** (SMS template, greeting) — Urban Vibe complaint
2. **Fix dead/broken buttons** — trust gap from non-functional UI
3. **Componentize cards as a manifest** — no visual change, future flexibility

## Why
- Dashboard already shipped and Hasan likes the look
- Real complaints are functional (buttons don't work, SMS template uneditable), not layout
- Urban Vibe is a paying customer asking for something specific
- Tier-collapse is a structural answer to a behavioral problem
- Componentizing without redesigning preserves option value for future drag/reorder

## Consequences
- D286 is REWRITTEN. Old scope archived. New scope = `Architecture/Dashboard-Hardening-Plan.md`
- The "AI Compiler as primary on Settings" idea is REJECTED. Stays on Knowledge page (per Sonar Pro 2026-04-25 + ownership model).
- The "left-side menu MVP" idea is REJECTED. Hasan clarified: he was reminiscing, not asking.

## Sonar-validated rationale
- Inline edit on overview for paid-user complexity complaints = best practice (2026 B2B SaaS)
- Re-sync button should auto-fire on save, not require manual click
- Hash-based deep-linking is fine with ARIA focus management
- AI Compiler primary placement would confuse non-technical owners
