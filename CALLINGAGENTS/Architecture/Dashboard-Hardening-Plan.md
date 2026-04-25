---
type: architecture
status: in-progress
priority: critical
tags: [dashboard, hardening, settings, ui, mvp, urban-vibe]
related:
  - "[[Tracker/D286]]"
  - "[[Tracker/D341]]"
  - "[[Tracker/D376]]"
  - "[[Tracker/D378]]"
  - "[[Tracker/D298]]"
  - "[[Architecture/Phase6-Wave2-Dashboard-Matrix.md]]"
  - "[[Decisions/Brian-Manual-Provision-2026-04-25]]"
created: 2026-04-25
updated: 2026-04-25
---

> **Progress 2026-04-25:** Tracks 1, 2, 3 shipped. Tracks 4 + 5 still open.
> Implementation note: Omar's call notes (see [[Decisions/Brian-Manual-Provision-2026-04-25]]) directly answered Q1 → went with option (c) Overview surface (NOT plan-recommended option (b)).

# Dashboard Hardening Plan — Functional Fixes Over Redesign

> **Decision (2026-04-25, Hasan):** The dashboard built in Wave 2 is the dashboard. Do NOT reorganize 47 cards into tiers. Do NOT strip to a left-side-menu MVP. Make existing buttons work. Componentize without changing visuals. Add the few missing features that paying users actually asked for.

## Why this exists

The previous plan (D286 settings reorg) was scoped as "tier the cards into 6 collapsible sections." Hasan rejected that scope: "I don't need to remove this entire fucking dashboard that I just built."

The real complaints are functional, not structural:
- Buttons exist that do nothing or break (D376/D378 partially fixed; more remain)
- Urban Vibe specifically asked for inline edit of SMS follow-up message
- AI Compiler ("type-to-teach") is the killer feature and is buried in Knowledge
- The agent should echo back "here's what I now know" after a compiler save
- Tracker has 100+ items, many duplicates or already-shipped

## Three independent tracks

These can ship in any order. They do not depend on each other.

### Track 1 — Inline edit for paid-user friction (HIGHEST PRIORITY) ✅ DONE 2026-04-25

**Why first:** Real customer complaint from Urban Vibe (Alisha). Single feature, one-card scope. Ships value immediately.

**Deliverables (shipped):**
1. ✅ SMS follow-up template — inline editable on Overview via `AgentSpeaksCard.tsx`
2. ✅ Greeting line — inline editable on Overview via `AgentSpeaksCard.tsx` (uses `/api/dashboard/variables` GREETING_LINE)
3. ✅ After-call SMS toggle exposed prominently — paired with template field; auto-hidden when no Twilio number
4. ✅ Voice picker moved from buried hero right column → top band paired with AgentSpeaksCard
5. ✅ Voice picker header renamed `How {Mark} Sounds` → `Choose Voice`

**Decision:** Picked (c) Overview surface, NOT plan-recommended (b). Omar's 2026-04-25 call explicitly required Greeting + Voice + SMS at the TOP of Overview ("the first thing visible when you log in") with advanced stuff demoted deeper. See [[Decisions/Brian-Manual-Provision-2026-04-25]].

**Files:** new `AgentSpeaksCard.tsx`; edits `UnifiedHomeSection.tsx`, `VoicePickerDropdown.tsx`.

### Track 2 — Fix dead/broken buttons (PARTIAL — Re-sync deleted ✅ 2026-04-25)

**Shipped 2026-04-25:**
- ✅ Re-sync Agent button DELETED from `AgentTab.tsx`. Sonar verdict (delete or auto-only) executed. Auto-sync runs on every PATCH that touches `needsAgentSync` fields — manual button was redundant + confusing.

**Still open:**

**Why second:** Trust loss. Dead buttons = "this product is half-built."

**Method (autonomous):**
1. Run e2e-test skill or Playwright sweep across every clickable element on /dashboard, /dashboard/settings, /dashboard/calls, /dashboard/knowledge
2. Categorize each: works / dead-click / errors / partial
3. Triage in parallel agents — assign one fix per button to a sub-agent
4. Verify each fix with the same e2e test

**Known broken/partial as of 2026-04-25 (from tracker scan):**
- D376 — Telegram gating at onboarding (partial)
- D378 — Live call End button (closed, verify still works)
- D375 — Backfill recompose for existing agents (open)
- D365 — ClientHome banners full-width regression (open)
- D366 — Call-Me card mobile layout (open)
- "Re-sync Agent" button — semantically wrong; auto-sync already runs via `needsAgentSync`. Sonar verdict: delete the button entirely OR rename to "Push current prompt to agent" with explicit "this does not rebuild" subtitle (already in line 670 of AgentTab.tsx). Decision pending — Hasan, do you want to keep it for admin debugging?

### Track 3 — Componentize without redesigning (PRIMITIVE LANDED ✅ 2026-04-25)

**Why third:** Future you will want to drag/reorder/show-hide. Today the layout is hardcoded JSX in AgentTab.tsx (869 lines).

**Shipped 2026-04-25 (additive — zero visual change):**
- ✅ `src/components/dashboard/DashboardCard.tsx` — thin role+data-attr wrapper
- ✅ `src/lib/dashboard-card-manifest.ts` — single source of truth: id, title, surface (overview/settings), defaultVisible, planGate, niches, adminOnly
- ✅ `cardsForSurface()` helper ready for future filtered-render consumers
- Manifest includes Omar's split: Greeting/Voice/SMS = `surface: 'overview'`; everything else (agent-identity, IVR, knowledge engine, webhooks, god-mode, etc.) = `surface: 'settings'`.

**NOT YET DONE (deferred, low risk):** AgentTab.tsx + UnifiedHomeSection.tsx still hardcode JSX. Migration to manifest-driven render is a separate PR — no rush, primitives are in place.

**No UI change today.** Same look. But future "show/hide cards" or "drag to reorder" is a one-day feature instead of a refactor.

### Track 4 — AI Compiler elevation + echo-back

**Why fourth:** Hasan flagged this as the "most valuable feature." Already exists at `/api/dashboard/knowledge/compile` + `/compile/apply`. Just needs:

1. **Prominent textarea on Knowledge page header**: "Type anything your agent should know — pricing, policies, FAQs."
2. **Live preview before apply**: "Here's what we'll add to the agent's knowledge." Show extracted chunks classified by trust tier.
3. **Echo-back after save**: "Your agent now knows: [3 pricing facts, 2 policies, 1 FAQ]." Inline confirmation, fades after 5s.
4. **Show full agent knowledge digest**: a "What your agent knows right now" panel that renders the assembled `businessFacts` + approved chunks. Read-only. Already partially exists as AgentKnowsCard on Overview — extend or link to a fuller view on Knowledge page.

**Sonar verdict (validated 2026-04-25):** AI Compiler should be a SECONDARY entry point on Knowledge, NOT primary on Settings. Manual structured fields first, compiler as smart-assist. This matches Notion AI / Glean pattern.

## What's NOT in scope

- D286 tier-collapse settings reorg → REJECTED. Settings stays as-is.
- Left-side menu MVP rewrite → REJECTED.
- Removing any existing card → unless verified dead/orphan.
- Onboarding flow changes → handled by Phase 7 separately.

## Tracker cleanup (Track 5, parallel)

100+ tracker items. Many already done but not closed. Many duplicates. Many obsolete after Wave 2 ship.

**Method:**
1. Spawn parallel sub-agents to scan tracker files in 4 chunks (D100-D250, D251-D350, D351-D420, D420+)
2. Each agent compares tracker status vs git log + actual code state
3. Output: list of items to close (status: done), items to merge (duplicates), items still real (verified open)
4. Hasan reviews list, then bulk-update.

## Sequencing for new chat

```
Chat 2 (new) — start with Track 1 (Urban Vibe SMS inline edit)
              decide placement question (a/b/c above)
              ship 1-card change
              verify with e2e test
              close Urban Vibe complaint

Chat 3        — Track 2 (button audit + parallel fixes)

Chat 4        — Track 3 (componentize) + Track 5 (tracker cleanup) in parallel agents

Chat 5        — Track 4 (AI Compiler elevation + echo-back)
```

## Sonar-validated decisions baked in

| Decision | Source | Date |
|---|---|---|
| Re-sync button: delete or auto-only, do not redesign | Sonar Pro 2026-04-25 | This plan |
| Inline edit on overview = best practice for paid-user complexity complaints | Sonar Pro 2026-04-25 | This plan |
| AI Compiler = secondary entry point, manual fields primary | Sonar Pro 2026-04-25 | This plan |
| Hash deep-linking is fine if ARIA focus management is honored | Sonar Pro 2026-04-25 | This plan |
| Collapsed-by-default settings = ❌ NOT applied here. Hasan rejected the tier-collapse approach. | Hasan override | This plan |

## Files most likely touched per track

| Track | Files |
|---|---|
| 1 | `src/components/dashboard/settings/PromptVariablesCard.tsx`, possibly new `AgentSpeaksCard.tsx`, `src/app/dashboard/settings/SettingsView.tsx` |
| 2 | Discovered via audit — likely `LiveCallBanner.tsx`, `CallRoutingCard.tsx`, `BookingCard.tsx`, telegram pill component |
| 3 | New `src/components/dashboard/DashboardCard.tsx`, new `src/lib/dashboard-card-manifest.ts`, `AgentTab.tsx` (rewrite as map, no visual change) |
| 4 | `src/app/dashboard/knowledge/page.tsx`, new `KnowledgeCompilerHeader.tsx`, `AgentKnowsCard.tsx` extension |
| 5 | `CALLINGAGENTS/Tracker/*.md` (status field updates only) |

## Open questions for new chat

1. **Where does inline SMS/greeting edit live?** (a) PromptVariablesCard top-pin, (b) new strip above Capabilities, (c) on Overview
2. **Re-sync button — keep, hide, delete, rename?** Sonar says delete or auto-only.
3. **Track 3 componentize NOW or defer?** Hasan said "tonight" — confirm willingness for invisible refactor before functional fixes are done.
4. **Tracker cleanup — agent-driven bulk close OK, or human review per item?**
