# Calls Page Redesign — Session Handoff
**Updated:** 2026-03-12 (post-Wave A) | **Project:** unmissed.ai agent-app (Railway)

---

## What Is Done

### Phase 1 — Screenshots ✅
10 screenshots in `agent-app/screenshots/critique/` (02–09)

### Phase 2 — Critique ✅
Full critique → `agent-app/screenshots/critique/CRITIQUE.md`

### Phase 3 — Backlog ✅
Prioritized 4-wave plan → `agent-app/screenshots/critique/BACKLOG.md`

### Phase 4 Wave A — 11 one-liner fixes ✅ (commit `391b4b8`, pushed + Railway deploying)
| Fix | File |
|-----|------|
| A1: Setup icon → wrench SVG (was copy of Calls phone icon) | Sidebar.tsx |
| A2: Date headers `text-xs text-zinc-400 bg-zinc-900/60` pill | CallsList.tsx:512 |
| A3: Funnel bars `h-1.5` → `h-3` (6px → 12px) | OutcomeCharts.tsx:187 |
| A4: Bar chart `gap-1` → `gap-2` | OutcomeCharts.tsx:100 |
| A5: Dial button green → zinc neutral | CallsList.tsx:429 |
| A6: Search input `w-44` → `w-56` | CallsList.tsx:457 |
| A7: Client tab row overflow scroll (mobile fix) | CallsList.tsx:372 |
| A8: Stat cards hover border + cursor-pointer | StatsGrid.tsx:106 |
| A9: ADMIN divider `text-zinc-700` → `text-zinc-500` | Sidebar.tsx:220 |
| A10: Activity feed bottom fade mask added | ActivityFeed.tsx:225 |
| A11: Classifying banner amber → zinc neutral | CallsList.tsx:356 |

User confirmed Wave A looks good visually.

---

## Immediate Next Step: Wave B (5 fixes, one commit)

Read each file before editing. All targets confirmed below.

### B1 — StatsGrid.tsx — Sparkline size
**File:** `src/components/dashboard/StatsGrid.tsx`
**Location:** `Sparkline` function (~line 53)
```tsx
// CURRENT:
const W = 48, H = 18
// ...
<svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
// CHANGE TO:
const W = 64, H = 24
```

### B2 — OutcomeCharts.tsx — Donut size
**File:** `src/components/dashboard/OutcomeCharts.tsx`
**Location:** `AnimatedDonut` function
```tsx
// CURRENT (empty donut):
<div className="flex items-center justify-center w-24 h-24">
  <svg width="96" height="96" viewBox="0 0 96 96">
// CURRENT (main donut):
<div className="relative flex items-center justify-center w-24 h-24 shrink-0">
  <svg width="96" height="96" viewBox="0 0 96 96" style={{ transform: 'rotate(-90deg)' }}>
    <circle cx="48" cy="48" r={R} ...  (R = 36)

// CHANGE TO: w-[120px] h-[120px], svg 120×120, viewBox "0 0 120 120", cx/cy=60, R=44
```

### B3 — CallRow.tsx — Tag pill contrast
**File:** `src/components/dashboard/CallRow.tsx`
**Change:** Find `text-zinc-400` on tag/topic pill spans → `text-zinc-300`
**Note:** Read file first to find exact class string.

### B4 — OutcomeCharts.tsx — Bar chart Y-axis labels
**File:** `src/components/dashboard/OutcomeCharts.tsx`
**Location:** `StackedBarChart` function, wrap return in relative container
**Change:** Add 3 absolute-positioned tick labels (0, mid, max) on the left edge of the chart.

### B5 — CallRow.tsx — Status badge icons
**File:** `src/components/dashboard/CallRow.tsx`
**Change:** Find where HOT/WARM/COLD/JUNK status badge text is rendered, add small inline SVG icon before label:
- HOT → flame icon (red)
- WARM → sun icon (amber)
- COLD → snowflake icon (blue)
- JUNK → ban/slash icon (zinc)
**Note:** Read file first to find the badge render location.

**Commit message:** `fix: Wave B — chart sizing, tag contrast, status icons, Y-axis labels`

---

## After Wave B: Wave C (~2hrs, separate commit)

### C1 — Replace "Active Now" → "Missed Calls" KPI card (CRITICAL — brand promise)
**Files:** `StatsGrid.tsx` + `CallsList.tsx` (parent that passes props)

**Query needed:** `calls.filter(c => c.call_status === 'MISSED')` — already in the `calls` prop.
The `activeNow` prop on StatsGrid comes from `stats.activeNow` in CallsList.tsx (line ~204):
```tsx
activeNow: calls.filter(c => c.call_status === 'live').length,
```

**Plan:**
1. In `CallsList.tsx`: add `missedCalls: calls.filter(c => c.call_status === 'MISSED').length` to stats
2. Pass `missedCalls` as new prop to `<StatsGrid>`
3. In `StatsGrid.tsx`: replace the `Active Now` card config with `Missed Calls`:
   - Theme: `red` if count > 0, `zinc` if 0
   - Sub label: `'in last 7 days'`
   - Remove `liveOrb` from this card
   - Move "active" pulse to the existing live dot in the Calls nav item (already done)

### C2 — Containment Rate card (HIGH)
- Formula: `(HOT + WARM + COLD) / (total - MISSED) * 100`
- Theme: `blue`
- Replaces or supplements existing cards

### C3 — Remove `min-h-[88px]` from stat cards (MED)
- Cards currently: `min-h-[88px]` at StatsGrid.tsx:106
- Already added hover state in Wave A — just remove `min-h-[88px]` in same line

---

## Wave D (Deferred — decision gate after Wave C)

Evaluate `@tremor/react` for replacing custom SVG charts:
- Donut → `DonutChart`
- Bar → `BarChart`
- Sparklines → `SparkAreaChart`
Decision: ship after Wave C, gather client feedback first.

---

## Key Files

| File | Path |
|------|------|
| Sidebar | `agent-app/src/components/dashboard/Sidebar.tsx` |
| StatsGrid | `agent-app/src/components/dashboard/StatsGrid.tsx` |
| OutcomeCharts | `agent-app/src/components/dashboard/OutcomeCharts.tsx` |
| CallsList | `agent-app/src/components/dashboard/CallsList.tsx` |
| ActivityFeed | `agent-app/src/components/dashboard/ActivityFeed.tsx` |
| CallRow | `agent-app/src/components/dashboard/CallRow.tsx` |
| Critique | `agent-app/screenshots/critique/CRITIQUE.md` |
| Backlog | `agent-app/screenshots/critique/BACKLOG.md` |

## Stack
Next.js 16.1.6 | Tailwind v4 | shadcn v3 | motion/react | Lucide-react 0.575 | custom SVG charts (no chart lib)
Railway auto-deploys from `agent-app` main branch.
Dev server: `npm run dev -- --port 3000` in `agent-app/`
Admin login: admin@unmissed.ai / COOLboy1234
