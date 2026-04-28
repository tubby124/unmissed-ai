# Session Handoff — 2026-04-27 (Calls & Leads strip-down)

## Completed This Session
- Stripped `/dashboard/calls` down to **Call Log (left 2/3) + Contacts (right 1/3)**. Nothing else.
- Removed from page: AgentConfigCard, TestCallCard orb, LearningLoopCard, CalendarEventsCard, LeadQueue (and its `campaign_leads` query), StatsGrid, OutcomeCharts, RevenueAtRisk banner, ClientHealthBar, full-width MinuteUsage bar.
- Added `hideAnalytics` and `hideMinuteUsage` props to `<CallsList>` so other pages keep the full surface.
- Moved minutes counter to the global `<TopBar>` as a tiny pill (`Min 3 / 250`) before the ⌘K trigger. Threaded `minutesUsed / minuteLimit / bonusMinutes` from `dashboard/layout.tsx` → `DashboardShellClient` → `TopBar`. Color shifts amber at 75%, red at 90%.
- Cleaned up unused agent-config plumbing (`afterHoursBehavior`, `outbound_*`, etc.) from the calls page since nothing on the page consumes them anymore.
- Vault note: [CALLINGAGENTS/Dashboard/2026-04-27-calls-leads-strip-down.md](CALLINGAGENTS/Dashboard/2026-04-27-calls-leads-strip-down.md).

## Decisions Made
- Call log + contacts side-by-side beats stacking — user wanted them aligned at the top, not the call log full-width with a row underneath.
- Minutes counter belongs in the global TopBar, not the page header — visible everywhere, frees the page header to be plain title + subtitle.
- Outbound Queue is dropped from this page entirely. User's words: "they can go back to the main page" to dial.
- Analytics gone from this page — Overview already owns that surface; this page is now task-focused (review calls, manage contacts).
- `<CallsList>` stays monolithic but gains opt-out props rather than getting refactored into header + table sub-components. Narrow change, no blast radius on Overview/other consumers.

## Current State
- Dev server running on port **3001** (Next.js 16.1.6).
- TypeScript: `npx tsc --noEmit` clean.
- Branch: `chore/go-live-vault-shipped` — chained on top of the v2 modal migration work (5d5b7cd).
- About to commit + push.
- No prompt files touched. No live agents redeployed. Settings/Overview/Knowledge pages untouched.

## Pending / Next Steps
- [ ] Click-a-row → slide-in context panel on the right (currently right column is always Contacts). Requires splitting `<CallsList>` into header + table.
- [ ] Inbound/Outbound toggle inside `AgentConfigCard` — only reachable via Settings now, not urgent. User wanted it relocated/cleaned but de-prioritized.
- [ ] Maintenance-request widget that sometimes appears on this page — not touched.
- [ ] "Other" tab in nav — not touched.
- [ ] After Railway deploy, confirm minutes pill renders in production TopBar for non-admin clients.

## Files Changed
- [src/app/dashboard/calls/page.tsx](src/app/dashboard/calls/page.tsx) — full strip-down + 2-col layout
- [src/app/dashboard/layout.tsx](src/app/dashboard/layout.tsx) — minutes columns added to `client_users.clients(...)` select; props threaded
- [src/components/dashboard/DashboardShellClient.tsx](src/components/dashboard/DashboardShellClient.tsx) — accept + forward minutes props
- [src/components/dashboard/TopBar.tsx](src/components/dashboard/TopBar.tsx) — render minutes pill before ⌘K
- [src/components/dashboard/CallsList.tsx](src/components/dashboard/CallsList.tsx) — `hideAnalytics` + `hideMinuteUsage` props
- [CALLINGAGENTS/Dashboard/2026-04-27-calls-leads-strip-down.md](CALLINGAGENTS/Dashboard/2026-04-27-calls-leads-strip-down.md) — vault doc

## How to Continue
Open the next chat from this repo. Read `CALLINGAGENTS/Dashboard/2026-04-27-calls-leads-strip-down.md` for the full context. The two natural next pieces are: (1) slide-in selected-call detail panel that replaces the static Contacts column when a row is clicked, and (2) deciding whether the inbound/outbound surface inside `AgentConfigCard` should move to its own Settings sub-page or get folded into existing Settings tabs. Local dev runs on `http://localhost:3001`.
