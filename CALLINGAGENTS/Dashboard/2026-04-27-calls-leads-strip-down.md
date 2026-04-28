---
type: dashboard-change
status: shipped
tags: [calls-leads, simplification, topbar, minutes-counter]
related:
  - "[[Dashboard Architecture]]"
  - "[[v2-Modal-Migration-2026-04-27]]"
updated: 2026-04-27
---

# Calls & Leads — Strip-Down to Call Log + Contacts (2026-04-27)

## What changed

Reduced `/dashboard/calls` to two surfaces only:

- **Left (2/3):** `<CallsList>` with `hideAnalytics` + `hideMinuteUsage` — only the call table, filter bar, and live banner remain
- **Right (1/3):** `<ContactsView>`

Removed from this page entirely:
- `AgentConfigCard` (inbound/outbound toggle was confusing here — surface lives on Settings/Agent tab)
- `TestCallCard` orb (talk-to-agent is on Overview)
- `LearningLoopCard`
- `CalendarEventsCard`
- `LeadQueue` (outbound queue) + the `campaign_leads` query
- `StatsGrid` (5-card analytics row)
- `OutcomeCharts` (donut + 7-day bars + funnel)
- `RevenueAtRisk` urgency banner
- `ClientHealthBar` (admin)
- `MinuteUsage` (full-width bar)

## New global affordance — minutes counter in TopBar

The page-level minutes bar is replaced with a tiny pill inside `<TopBar>`:

```
Min  3 / 250
```

- Hidden on `sm` and smaller, hidden for admins (no client context)
- Color shifts: text-2 → amber (#f59e0b) at ≥75% → red (#ef4444) at ≥90%
- Fed by new `minutesUsed` / `minuteLimit` / `bonusMinutes` props threaded:
  `dashboard/layout.tsx` → `DashboardShellClient` → `TopBar`
- Layout selects `seconds_used_this_month, monthly_minute_limit, bonus_minutes` in the same `client_users` join it already runs — no extra query

## New CallsList props

`hideAnalytics?: boolean` — hides StatsGrid, OutcomeCharts, RevenueAtRisk, ClientHealthBar
`hideMinuteUsage?: boolean` — hides the in-component MinuteUsage block

Default `false` for both — every other page that imports `<CallsList>` keeps the full surface.

## Files touched

- `src/app/dashboard/calls/page.tsx` — strip imports, drop AgentConfigCard / TestCallCard / LeadQueue / LearningLoop / Calendar, drop campaign_leads query, drop unused agent-config field plumbing, 2-col grid layout
- `src/app/dashboard/layout.tsx` — add `seconds_used_this_month, monthly_minute_limit, bonus_minutes` to existing `client_users.clients(...)` select; thread to shell
- `src/components/dashboard/DashboardShellClient.tsx` — accept + forward minutes props
- `src/components/dashboard/TopBar.tsx` — render minutes pill before ⌘K trigger
- `src/components/dashboard/CallsList.tsx` — add `hideAnalytics` + `hideMinuteUsage` props, gate the relevant blocks

## Why

User feedback during this session:
- "this is what they're here for" — call log is the primary task on this page
- "I don't need to click to call from this page. They can go back to the main page"
- "nothing else we don't need other shit for now"
- "lets just move the minutes as a tiny little counter top right"

The call log page had become a kitchen sink. Pulling out analytics and config matches the rest of the IA — Settings owns config, Overview owns analytics + talk-to-agent. Calls & Leads is just calls + the contact table you assign names in.

## What's NOT done (deferred for next chat)

- Click-a-row → context panel slide-in on the right (would require splitting `CallsList` further; right column is currently always Contacts)
- Inbound/Outbound toggle inside `AgentConfigCard` is still there — only relevant when the card is reached via Settings now
- Maintenance-request widget that sometimes appears on this page — not touched
- "Other" tab in nav — not touched

## Validation

- `npx tsc --noEmit` clean after each step
- Local dev server (port 3001) returns 307 (auth redirect) on `/dashboard/calls` after recompile

## Branch

`chore/go-live-vault-shipped` — pushed and merged into the same chain as the v2 modal migration
