---
type: decision
status: decided
date: 2026-03-31
tags: [dashboard, navigation, naming]
related: [[Tracker/D308]], [[Architecture/Phase6-Wave2-Dashboard-Matrix]]
---

# Decision: Dashboard Main Tab Naming

## Context
Phase 6 Wave 2 redesigns the Overview page into a denser, more capable control surface. Question: rename the tab?

## Research (Sonar Pro, 2026-03-31)

### What competitors call their main page
| Product | Main Tab Name |
|---------|--------------|
| Bland.ai | **Home** |
| HubSpot | **Home** |
| Freshdesk | **Home** / Dashboard |
| Zendesk | **Home** |
| Intercom | **Home** |

### Pattern
"Home" is the dominant convention. "Overview" is used by some analytics-heavy products. "Dashboard" is used as the page URL but rarely as the visible tab name. "Agent Brain" has no precedent.

### Analysis
- **"Home"** — universally understood, works on mobile (4 chars), no learning curve
- **"Overview"** — slightly more descriptive, common in B2B, but longer (8 chars)  
- **"Agent Brain"** — cool but untested. Risk: non-technical users (plumbers, auto glass) may find it confusing. Sounds AI-techy. No competitor uses it.
- **"Dashboard"** — redundant (they're already IN the dashboard)

## Decision
**Keep "Overview"** for now. It's descriptive, fits mobile, and doesn't confuse non-technical users. Revisit "Home" if user research suggests it.

"Agent Brain" is better as a marketing term than a nav label. Can be used in onboarding copy ("Your Agent Brain — everything your agent knows and does") without it being the tab name.

## Rationale
- Non-technical SMB owners need zero cognitive overhead on navigation
- "Overview" communicates "see everything at a glance" which matches the redesign intent
- Renaming to something unfamiliar adds friction for existing users
- Mobile bottom tab: "Overview" fits, "Agent Brain" does not (too long)
