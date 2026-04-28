---
type: dashboard-change
status: shipped
tags: [overview, recent-calls, quick-add, agent-readiness]
related:
  - "[[Dashboard Architecture]]"
  - "[[v2-Modal-Migration-2026-04-27]]"
  - "[[2026-04-27-calls-leads-strip-down]]"
pr: 31
commit: 277f9f4
deploy: "main → Railway 2026-04-27 ~02:37Z"
updated: 2026-04-27
---

# Overview — Quick Add → Recent Calls swap + readiness 2-col (2026-04-27)

## What changed

Restructured the non-admin Overview surface (`UnifiedHomeSectionV2.tsx`) per Hasan's request:

- **Hero right column:** `<V2CallList>` (Recent Calls, limit 5, click row → call modal) replaces `<KnowledgeQuickAddCard>` (Upload / Scrape / AI Compile / Browse tiles). Quick Add lives only on `/dashboard/knowledge` now.
- **"What your agent knows" card removed** — the full-width `<AgentKnowsCard>` (Facts / FAQ / Services / KB grid) is gone. Users go to `/dashboard/knowledge` directly for that view.
- **Agent Readiness** — full-width with internal 2-col grid on md+. Rows fill in source order: Hours / Services / FAQs in left column, Booking / Knowledge / Gaps in right column. Mobile collapses to single column.
- **Bottom-row duplicate Recent Calls removed** — was rendering twice once V2CallList moved to the hero.

## Why

Hasan: dashboard felt overwhelming with Quick Add right next to the orb. Recent Calls is the higher-value surface to see at a glance. Agent Knows card duplicated info already reachable via the readiness band's Knowledge row.

## Files touched

- [src/components/dashboard/home/UnifiedHomeSectionV2.tsx](../../src/components/dashboard/home/UnifiedHomeSectionV2.tsx) — only file changed (+16 / -31)

## Imports trimmed

Removed: `AgentKnowsCard`, `KnowledgeQuickAddCard`. Kept: `V2CallList` (now in hero AND as the source for the inline edit modal).

## Test plan

- [x] Pre-push hooks (1700 tests) pass
- [x] Phase D prompt fixture drift within tolerance
- [ ] Visual check on Railway after deploy

## Deploy

- Branch: `chore/go-live-vault-shipped`
- PR: [#31](https://github.com/tubby124/unmissed-ai/pull/31) (squash-merged to main 2026-04-27 02:37Z)
- Commit on main: 277f9f4 → squash on main pending Railway pickup
