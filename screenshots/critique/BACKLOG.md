# Calls Page — Prioritized Implementation Backlog
**Generated:** 2026-03-12 | **Method:** Sequential thinking synthesis of CRITIQUE.md

---

## Wave A — 11 one-liner fixes (~45min, ship as one commit)

All are single CSS class or SVG attribute changes. No logic changes. No new dependencies.

| # | File | Line | Change | Impact |
|---|------|------|--------|--------|
| A1 | `Sidebar.tsx` | ~25 | Setup icon: replace phone SVG with `<Settings>` from lucide-react | HIGH |
| A2 | `CallsList.tsx` | 512 | `text-[10px] text-zinc-600` → `text-xs text-zinc-400 bg-zinc-900/60 px-2 py-0.5 rounded` | HIGH |
| A3 | `OutcomeCharts.tsx` | 187 | `h-1.5 rounded-full` → `h-3 rounded-full` | HIGH |
| A4 | `OutcomeCharts.tsx` | 100 | `gap-1` → `gap-2` on bar wrapper; add `rounded-sm` to bar tops | MED |
| A5 | `CallsList.tsx` | 429 | `bg-green-500/10 text-green-400 border-green-500/20` → `bg-zinc-700/80 text-zinc-200 border-white/10` | MED |
| A6 | `CallsList.tsx` | 457 | `w-full sm:w-44` → `w-full sm:w-56` | MED |
| A7 | `CallsList.tsx` | client tabs | Wrap client tab row in `overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none]` (same as filter pills pattern on line 459) | HIGH |
| A8 | `StatsGrid.tsx` | 106 | Add `hover:border-white/[0.12] transition-colors cursor-pointer` to card div | LOW |
| A9 | `Sidebar.tsx` | ADMIN divider | `text-zinc-700` → `text-zinc-500` | LOW |
| A10 | `ActivityFeed.tsx` | bottom | Clone top fade mask, flip with `bottom-0 bg-gradient-to-t` | MED |
| A11 | `CallsList.tsx` | classifying banner | `border-amber-500/20 bg-amber-500/[0.05] text-amber-400/80` → `border-zinc-700 bg-zinc-800/60 text-zinc-300` | MED |

**Commit message:** `fix: Wave A — 11 UI polish fixes (setup icon, funnel bars, date headers, tabs overflow, dial btn, classifying banner)`

---

## Wave B — Sizing + contrast fixes (~60min, second commit)

| # | File | Change | Impact |
|---|------|--------|--------|
| B1 | `StatsGrid.tsx` | Sparkline SVG: `width={48} height={18}` → `width={64} height={24}` | MED |
| B2 | `OutcomeCharts.tsx` | Donut: find size constant (96 or `w-24 h-24`) → `w-[120px] h-[120px]` | MED |
| B3 | `CallRow.tsx` | Tag pills: `text-zinc-400` → `text-zinc-300` (contrast 3.5:1) | HIGH |
| B4 | `OutcomeCharts.tsx` | Bar chart: add 3 Y-axis tick labels (0, midpoint, max) at left edge | MED |
| B5 | `CallRow.tsx` | Status badges: add small icon before label (flame for HOT, snowflake for COLD, sun for WARM, ban for JUNK) using Lucide | HIGH |

**Commit message:** `fix: Wave B — chart sizing, tag contrast, status icons, Y-axis labels`

---

## Wave C — KPI card replacement (~2hrs, requires data query, third commit)

| # | File | Change | Impact |
|---|------|--------|--------|
| C1 | `StatsGrid.tsx` + parent | Replace "Active Now" card → "Missed Calls" | CRITICAL |
| | | - Query: `call_logs WHERE call_status = 'MISSED' AND created_at > now() - interval '7 days'` | |
| | | - Red accent + pulse dot if count > 0. Zinc/neutral if 0. | |
| | | - Sub label: "in last 7 days" | |
| C2 | `StatsGrid.tsx` + parent | Add "Containment Rate" card | HIGH |
| | | - Formula: `(answered - escalated) / answered * 100` | |
| | | - Proxy: `(HOT + WARM + COLD) / (total - MISSED) * 100` | |
| C3 | `StatsGrid.tsx` | Remove `min-h-[88px]`, let cards size to content | MED |

**Pre-flight for C1:** Check where stats are fetched — likely in `app/dashboard/calls/page.tsx` or a `useCallStats` hook. Add `missedCount` to the query and pass as prop to StatsGrid.

**Commit message:** `feat: Wave C — Missed Calls KPI card, Containment Rate, remove min-h constraint`

---

## Wave D — Chart library evaluation (deferred, separate branch)

**Decision gate:** Ship Waves A+B+C first. If client feedback after those ships still calls out chart quality → evaluate Tremor.

| Option | Pro | Con |
|--------|-----|-----|
| Keep custom SVGs (sized up) | Zero bundle increase, already works | Limited tooltips, animation |
| Tremor `@tremor/react` | DonutChart, BarChart, SparkAreaChart, dark native | +40KB gzip, new dependency |
| Recharts direct | Most flexible | More code, no opinionated theming |

**If proceeding:** `npm install @tremor/react` in `agent-app/`, then replace one component at a time: donut first, then bar chart, then sparklines.

---

## Implementation Order Summary

```
Wave A (45min) → commit → Railway deploys → visual check
Wave B (60min) → commit → Railway deploys → visual check
Wave C (2hrs)  → commit → Railway deploys → screenshot + client feedback
Wave D         → decision gate → separate branch
```

**Single highest-leverage change:** C1 (Missed Calls card) — brand promise as a metric.
**Fastest max-impact batch:** All of Wave A — 11 trivial fixes, massive perceived quality jump.

---

## Files Modified Across All Waves

| File | Waves |
|------|-------|
| `src/components/dashboard/Sidebar.tsx` | A1, A9 |
| `src/components/dashboard/CallsList.tsx` | A2, A5, A6, A7, A11 |
| `src/components/dashboard/OutcomeCharts.tsx` | A3, A4, B2, B4 |
| `src/components/dashboard/StatsGrid.tsx` | A8, B1, C1, C2, C3 |
| `src/components/dashboard/ActivityFeed.tsx` | A10 |
| `src/components/dashboard/CallRow.tsx` | B3, B5 |
| `app/dashboard/calls/page.tsx` (or hook) | C1 data query |
