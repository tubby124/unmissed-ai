---
type: decision
status: shipped
date: 2026-04-28
tags: [settings, ux, non-admin, simplification]
related:
  - "[[2026-04-27-overview-simplification-option1]]"
  - "[[Settings-Simplification-Followups]]"
---

# Settings page simplification (non-admin) — 2026-04-28

## Why

Hasan flagged `/dashboard/settings` as cluttered for non-admin clients:
- Tab bar showed 4 tabs (Agent / SMS / Alerts / Billing) but 3 of them were redirect stubs ("X has moved → /dashboard/X")
- `CapabilitiesCard` rendered twice (Overview hero + inside Agent grid)
- `AgentModeCard` (4 personalities) and `CallHandlingModeCard` (3 modes) both visible — same setting expressed twice
- QuickSetupStrip Voice/Alerts/Knowledge buttons set `activeTab` instead of navigating to the dedicated page (would land non-admin on a redirect stub)

## Decision

Strip the non-admin Settings page to one column of real Agent settings. No tab chrome, no duplicate Capabilities card, no duplicate mode card. SMS / Alerts / Billing / Knowledge already live on dedicated pages — the tab bar was just a corridor to redirect stubs.

## Files changed

| File | Change |
|------|--------|
| [[../../src/app/dashboard/settings/SettingsView]] | Hide tab bar for non-admin (`{isAdmin && <nav>...</nav>}`); force `activeTab='general'` for non-admin on init; QuickSetup items use `href` (window.location) for Voice/Alerts/Knowledge instead of `tab` |
| [[../../src/components/dashboard/settings/AgentTab]] | Wrap inner CapabilitiesCard in `{isAdmin && ...}` (non-admin sees it in Overview hero only); wrap CallHandlingModeCard in `{isAdmin && ...}` (non-admin uses AgentModeCard which auto-syncs `call_handling_mode` via recompose) |

## Source-of-truth resolution

**Mode setting** — `agent_mode` (DB column written by `AgentModeCard`) is canonical. The card's preview→apply flow calls `recomposePrompt()` which auto-syncs `call_handling_mode` to match (see line 153 of AgentModeCard.tsx: "switching also updates it to match"). `CallHandlingModeCard` is downstream/derived UI and only useful for admin override.

**Capability display** — `CapabilitiesCard` belongs in the Overview hero ([[../../src/app/dashboard/settings/SettingsView]] line 351). The duplicate inside `AgentTab.tsx` was leftover from before the Overview hero shipped.

## Verified

- `npm run build` ✓ Compiled successfully (197/197 pages)
- No DB migrations
- No prompt-affecting changes
- No deploy-time risk — pure UI

## Kept (per Hasan's keep list)

VoicemailGreetingCard · PromptVariablesCard (Agent Variables) · ServicesOfferedCard · ContextDataCard (PM only) · AgentKnowledgeCard (What Your Agent Knows) · CallRoutingCard · VoiceStyleCard · AgentModeCard · NotificationsWidget (with footer link to /dashboard/notifications since the tab is gone)

## Followups (deferred)

See [[../Tracker/Settings-Simplification-Followups]] for the gap-check items not addressed in this pass.
