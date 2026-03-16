# unmissed.ai Dashboard — Design Critique
**Date:** 2026-03-12 | **Scope:** Calls page + sidebar + activity feed + mobile
**Method:** Playwright capture → ui-ux-pro-max design system analysis
**Screenshots:** 02–09 in this folder

---

## Summary Verdict

The dashboard is **functionally complete but visually half-finished**. The dark zinc/black palette is the right call for a power-user B2B tool. The information architecture is sound. What fails is *execution depth*: charts are too small to read, sparklines are decorative noise, critical KPI slots are wasted on wrong metrics, and the mobile layout breaks in two places. None of these are hard fixes — no architectural change is required.

**Signal-to-noise ratio: 6/10.** The page shows you data but doesn't tell you what matters.

---

## Section 1 — Visual Hierarchy

**Score: 5/10 — FAIL**

The eye has no clear entry point. Five stat cards compete equally — no card asserts dominance. The HOT LEADS card gets a red border/tint which gives it some priority, but HOT count (6) is competing with TOTAL CALLS (157) for visual weight because both use the same text-4xl or text-5xl size class.

**Specific failures:**
- `ACTIVE NOW: 0` is given equal visual weight to `HOT LEADS: 6`. A zero metric wastes a hero slot.
- `CONVERSION: 7%` has no context — no trend arrow, no benchmark, no color code for good/bad. It's a number floating in space.
- The three-column chart row (Outcomes + 7 Days + Funnel) compresses all three charts into boxes too small to read. The eye can't extract insight — it just registers "there are charts here."
- The "Classifying 1 call..." amber banner mid-page creates false urgency — it looks like an error state.

**Fix:** Promote `HOT LEADS` to hero size. Give `MISSED CALLS` a slot. Demote `ACTIVE NOW` to a live indicator in the header, not a stat card.

---

## Section 2 — Density vs Breathing Room

**Score: 6/10 — MARGINAL**

The main content area (between sidebar and activity feed) is correctly proportioned. Call rows have adequate vertical padding. The three-chart section is the density problem — three charts in a single row, each in a ~360px container, is **too compressed for charts that need to communicate data**.

**Specific failures:**
- Chart section: three panels side-by-side at ~360px each. The donut has no room to breathe. The funnel bars have essentially no length at this width.
- Activity feed right panel: `w-[272px]` fixed. At 1440px this is tight. At 1280px it clips content.
- Stat card subtitles ("per classified call", "HOT / answered calls") are 2-line at current width — causes inconsistent card heights.
- The `gap-1` between bar chart bars makes them look fused rather than discrete.

---

## Section 3 — Color System

**Score: 7/10 — MOSTLY WORKS, gaps exist**

The zinc/near-black palette is correct for a professional B2B tool. The monochrome approach keeps cognitive load low. The accent color system (red=HOT, amber=WARM, blue=COLD, grey=JUNK) is consistent and readable in the call log.

**Confirmed failures:**
- Status relies **only on color** to communicate call outcome (HOT/WARM/COLD/JUNK). This violates `color-not-only` — users with color deficiency can't distinguish COLD (blue) from JUNK (grey) easily. Secondary indicator needed (e.g., icon or text weight difference).
- `text-zinc-600` for date group headers ("TODAY", "YESTERDAY") on `bg-zinc-900/zinc-950` background. Contrast ratio estimated ~2.8:1 — **fails WCAG AA** (minimum 3:1 for large text, 4.5:1 for normal text).
- Tag pills on call rows: `bg-zinc-800` + `text-zinc-400` — approximately 2.5:1 contrast. Unreadable at small size.
- The amber "Classifying 1 call..." banner uses `bg-amber-900/20` which reads as a warning/error state. Not an error — it's operational status. Should be neutral.

---

## Section 4 — Typography Scale

**Score: 5/10 — FAIL on data labels**

The headline numbers in stat cards are correctly sized and readable. Everything below them degrades.

**Confirmed failures:**
- `text-[10px]` on date group headers — **below 11px minimum for any readable UI text**. At 1440px this is barely scannable. On a retina display it might look fine but on standard 1080p monitors it's near-invisible.
- `text-[10px]` also confirmed on chart section labels (bar chart day labels Th/Fr/Sa etc.).
- Card subtitles ("classified calls", "high-intent callers") are `text-xs` or `text-[11px]` in `text-zinc-400` — low contrast, wraps to 2 lines on narrow cards.
- Call row tag pills: very small text, poor contrast (see Section 3).
- The "CALL LOG 195" section header uses uppercase tracking — fine, but `195` count is dim/zinc colored when it should pop (it's the primary data point of that row).

**Fix:** Minimum readable size for any data label: `text-[11px]`. For group headers: `text-xs` (12px). Bump date headers to `text-xs text-zinc-400`.

---

## Section 5 — Chart Quality

**Score: 3/10 — CRITICAL FAIL**

This is the weakest section of the dashboard.

### Donut Chart (OUTCOMES)
- **Size: ~96×96px** — too small. The center label "157 calls" is readable, but the segment arcs are so thin that Hot (6 calls = 4%) renders as a ~3px arc. Functionally invisible.
- No hover tooltip, no click interaction confirmed.
- **Recommended size: 120–140px minimum.**

### Bar Chart (LAST 7 DAYS)
- Bars are correctly stacked and color-coded. The visual is OK at a glance.
- **No Y-axis labels** — you cannot read absolute call volume per day. Is Thursday 5 calls or 35? Unknown.
- The `35 today` label at bottom-left is good — one concrete anchor.
- `gap-1` between bars makes them look fused. Needs `gap-2` + `rounded-sm` caps.
- Bar heights are very short (container is ~180px tall, bars use ~60% of it max).

### Funnel (FUNNEL)
- **Bars are `h-1.5` = 6px.** The red dot for "Hot 6 4%" is approximately 4px wide. **Not a bar chart — it's a line.** This conveys no visual magnitude difference.
- The percentage labels (59%, 35%, 4%) are the only readable element.
- **Recommended: `h-3` minimum (12px), `h-4` preferred (16px).**

### Sparklines (Stat cards)
- **48×18px SVG.** At this size the sparkline is 2–3px tall on retina — a squiggle, not a trend indicator.
- Color-coded but too small to read slope direction confidently.
- **Recommended: 64×24px minimum.**

### Confidence Arc (Call rows)
- The small arc on the right side of call rows (30×16px) is unreadable without magnification.
- No tooltip confirmed on the arc.
- Consider replacing with a `text-[11px]` score number.

---

## Section 6 — Interactive Affordances

**Score: 6/10 — PARTIAL**

**What works:**
- Expanded HOT row: the expansion reveal (recommended action → tags → transcript) is well-structured and information-dense in a useful way.
- Status filter pills have an "All 195" active state (blue pill background) — clear selection state.
- HOT row has a red left border that extends full row height — good visual anchor.

**Confirmed failures:**
- **Stat cards have no hover state.** Nothing signals they might be clickable. Add `hover:border-white/[0.12] transition-colors`.
- **Dial button is green (`bg-green-600`).** Green = "call is live / active" throughout this UI. Using green on the Dial action button creates ambiguity: is this button for initiating a live call, or indicating a call in progress? Should be `bg-zinc-700` or `bg-white/10` — neutral action color.
- The `>` chevron on call rows is low contrast and 12×12px — small touch target.
- Search input `w-44` (176px) is too narrow for a phone number search. Phone numbers with area codes are 12+ characters — the input shows ~15 chars before scrolling. **Minimum `w-56` (224px).**
- CSV button: `bg-zinc-800 border-zinc-700` — nearly invisible against the dark background. Needs either a visible border or a subtle icon.
- The "View full call →" link in expanded rows has no hover underline or color change on hover (not confirmed, but common in this codebase pattern).

---

## Section 7 — Sidebar UX

**Score: 6/10 — FUNCTIONAL, icon issue confirmed**

**Confirmed:** The Setup nav item uses what appears to be an **earphone/phone shape icon**, not a gear/settings icon. This is inconsistent — Setup should use a gear or wrench SVG. Every other nav item icon is semantically correct (phone for Calls, bar chart for Insights, etc.).

**Active state:** "Calls" active state uses a blue-tinted pill/row highlight — readable and clear.

**Other issues:**
- The "ADMIN" section divider label (`text-zinc-700` on dark bg) is essentially invisible. Contrast ratio ~1.5:1. Should be `text-zinc-500` minimum.
- Nav labels use `text-sm` — correct size.
- `Sign out` and `Collapse` at the bottom are separated from the nav group by visual weight but no explicit divider — could be more explicit.
- "All clients" subtext under the logo (`text-zinc-500`) — fine.
- Nav has 10 items + separator + 2 actions = 12 touch targets in ~600px of height. Density is appropriate for admin.

---

## Section 8 — Activity Feed

**Score: 5/10 — USEFUL BUT UNDERDESIGNED**

The right-side "LIVE ACTIVITY" panel shows real-time call arrivals with phone, client name, status badge, and timestamp. Concept is correct — this is the "unmissed" promise visualized.

**Confirmed failures:**
- **"LIVE ACTIVITY" header** — tiny uppercase label, `text-zinc-500` or similar, no visual anchor. A user glancing right doesn't immediately parse this as a live feed.
- **No bottom fade mask.** The top of the feed has a fade mask but the bottom cuts off abruptly. Items appear to just end.
- **Status badges (HOT/COLD/WARM/JUNK) are the only differentiator** between activity items. No phone icon, no direction indicator (inbound vs missed), no client color code.
- **Fixed `w-[272px]`** — at 1280px viewport this compresses the main content unnecessarily.
- **All items look identical** — no visual hierarchy between a HOT lead that just called vs a JUNK spam call from 6 hours ago. They receive equal treatment.
- `–` dash for unclassified calls instead of a subtle spinner/pending indicator.

---

## Section 9 — Mobile Responsiveness (375px)

**Score: 4/10 — TWO HARD BREAKS**

**What works:**
- Stat cards reflow to 2×2 + 1 full-width grid — acceptable.
- Funnel section is readable (horizontal progress bars adapt).
- Call rows compress acceptably.

**Confirmed breaks:**
1. **Client tab row overflows** with no scroll indicator. "E2E Test Plumbing" and all tabs after "All Clients / E2E Test Business" are clipped. User has no affordance to scroll right to other clients. **This is a functional regression** — admin users cannot switch to a client-specific view on mobile.
2. **Status filter pills overflow.** "JUNK" is cut off at the right edge. Only "All 195 / HOT 6 / WARM 49 / COLD 37" are fully visible. UNKNOWN and MISSED filters are inaccessible.
3. **Search input is full-width on mobile** (good) but immediately below the Dial + CSV buttons, so the toolbar wraps to 3 rows — wasteful vertical space.
4. **Activity feed disappears on mobile** — it's hidden, but there's no indication to the user that it exists. A bottom sheet trigger or collapsed feed indicator would help.

---

## Section 10 — KPI Selection

**Score: 4/10 — CRITICAL BRAND MISALIGNMENT**

The product is called **unmissed.ai**. The core promise: *you will never miss a call*. The current stat cards:

| Card | Brand relevance | Verdict |
|------|----------------|---------|
| Total Calls | Supporting metric | OK |
| Hot Leads | Revenue signal | KEEP — hero position |
| Avg Duration | Operational | Move to Insights |
| **Active Now: 0** | **Useless when 0** | **REPLACE** |
| Conversion | Supporting | Reframe with trend |

**Missing entirely:**
- **Missed Calls** — THE metric for this brand. Should be card #1 or #2. If it's 0, that's the success story. If it's 5, that's the alert.
- **Containment Rate** — % of calls fully handled by AI. 80–90% is world-class. Show it.
- **Avg Quality Score** — Already stored in `call_logs.quality_score`. Unused.

**Recommended final 5:**
1. **Missed Calls** (hero — red if >0, green if 0)
2. Hot Leads
3. Containment Rate
4. Avg Quality Score
5. Conversion

Active Now → move to a live dot indicator in the page header (not a stat card).
Avg Duration → move to Insights tab.

---

## Pre-Identified Issues — Confirmed/Denied

| Issue | Status | Notes |
|-------|--------|-------|
| Sidebar Setup icon wrong | **CONFIRMED** | Appears to use phone/earphone shape, not gear |
| StatsGrid min-h-[88px] cramped | **CONFIRMED** | Subtitles wrap, inconsistent heights |
| Sparklines 48×18 invisible | **CONFIRMED** | Decorative noise, not data |
| Donut 96×96 undersized | **CONFIRMED** | Hot segment = 3px arc |
| Funnel bars h-1.5 (6px) | **CONFIRMED** | Cannot read relative magnitude |
| Bar chart gap-1 packed | **CONFIRMED** | Bars appear fused |
| Search input w-44 narrow | **CONFIRMED** | 176px clips phone numbers |
| Date headers text-[10px] zinc-600 | **CONFIRMED** | Fails WCAG AA contrast |
| Dial button green | **CONFIRMED** | Conflicts with live-call green signal |
| Active Now = 0 | **CONFIRMED** | Brand-misaligned KPI slot |

**10/10 confirmed.** No denials.

---

## Top 10 Quick Wins (Ordered by Impact ÷ Effort)

| # | Fix | File | Impact | Effort | Ratio |
|---|-----|------|--------|--------|-------|
| 1 | Replace "Active Now" card with "Missed Calls" | `StatsGrid.tsx` | CRITICAL | S | 10/1 |
| 2 | Date group headers: `text-[10px] text-zinc-600` → `text-xs text-zinc-400` + `bg-zinc-900/60` | `CallsList.tsx` | HIGH | S | 8/1 |
| 3 | Dial button: `bg-green-600` → `bg-zinc-700 hover:bg-zinc-600` | `CallsList.tsx` | HIGH | S | 8/1 |
| 4 | Fix Setup sidebar icon → gear SVG (Lucide `Settings` or `Cog`) | `Sidebar.tsx` | HIGH | S | 8/1 |
| 5 | Funnel bars: `h-1.5` → `h-3` + `rounded-full` | `OutcomeCharts.tsx` | HIGH | S | 7/1 |
| 6 | Sparklines: `48×18` → `64×24` SVG viewport | `StatsGrid.tsx` | MEDIUM | S | 6/1 |
| 7 | Search input: `w-44` → `w-56 sm:w-64` | `CallsList.tsx` | MEDIUM | S | 6/1 |
| 8 | Donut: `96×96` → `120×120` | `OutcomeCharts.tsx` | MEDIUM | S | 5/1 |
| 9 | Bar chart: `gap-1` → `gap-2` + `rounded-sm` bar tops | `OutcomeCharts.tsx` | MEDIUM | S | 5/1 |
| 10 | Stat cards: add `hover:border-white/[0.12] transition-colors` | `StatsGrid.tsx` | LOW | XS | 5/1 |

**Bonus (M effort but HIGH value):**
- Add `Missed Calls` + `Containment Rate` to KPI cards
- Mobile: overflow-x-auto with `scroll-snap-x` on client tabs + filter pills
- Add bottom fade mask to ActivityFeed
- Activity Feed: differentiate HOT items visually (red left border, same as call rows)
- ADMIN sidebar divider: `text-zinc-700` → `text-zinc-500`

---

## New Issues Not in Pre-Identified List

1. **Tag pill contrast failure** — `bg-zinc-800 text-zinc-400` ≈ 2.5:1 contrast on call rows. Fails WCAG AA.
2. **Color-only status communication** — HOT/COLD/WARM/JUNK relies entirely on color. Add icon or weight difference.
3. **Mobile client tab overflow** — No scroll affordance. Functional regression on mobile.
4. **Mobile filter pill overflow** — UNKNOWN + MISSED tabs inaccessible on 375px.
5. **No Y-axis on bar chart** — Can't read absolute call volumes per day.
6. **Confidence arc (30×16px)** — Unreadable without tooltip. Replace with `text-[11px]` number.
7. **ActivityFeed: no bottom fade** — Items cut off abruptly at panel bottom.
8. **ActivityFeed: equal density** — HOT and JUNK items look identical. HOT needs a visual differentiator.
9. **"Classifying 1 call..." banner** — Amber color reads as warning/error. Should be neutral operational status (zinc or blue).
10. **ADMIN divider invisible** — `text-zinc-700` on `bg-zinc-900` is ~1.5:1 contrast.

---

*Next: Phase 3 — Sequential thinking synthesis → prioritized backlog*
