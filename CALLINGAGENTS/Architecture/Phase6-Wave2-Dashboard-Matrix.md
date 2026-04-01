---
type: architecture
status: planning
tags: [phase6, wave2, dashboard, ui, layout]
related: [[Phase6-Wave2-Tracker]], [[D278]], [[D286]], [[D266]]
updated: 2026-03-31
---

# Phase 6 Wave 2 — Dashboard Overview Matrix

> This is the **single source of truth** for what lives where on the Overview page, how each component renders for trial vs paid users, and what links to what.

## Design Principles

1. **Expand, don't navigate.** Click a card → expand downward for inline edit. "View all →" for deep page.
2. **3-col hero is sacred.** Capabilities | Orb/Test | Today's Update+Stats — this stays.
3. **Rich call cards.** Same quality as Calls & Leads page — badges, tags, action items, sentiment.
4. **Everything in TWO places.** Compact preview on Overview + full editor on dedicated page.
5. **No side sheets for critical settings.** Hours, voice, notifications — all inline expandable.
6. **Trial users see value immediately.** Setup progress + "your agent learned this" even with 0 calls.

---

## Component Hierarchy Matrix

### TIER 1 — Always Visible (above the fold on desktop)

| # | Component | Overview Behavior | Dedicated Page | Trial User | Paid User | Edit Style |
|---|-----------|-------------------|----------------|------------|-----------|------------|
| 1.1 | **Banners** (activation, trial expiry, minutes, sync error, booking gap) | Full width, conditional, auto-dismiss | — | Shows activation + trial expiry | Shows minutes warning, sync error | Dismiss or CTA link |
| 1.2 | **What Your Agent Can Do** (capabilities grid) | Left column of 3-col hero. 7/11 progress bar. ✓/●/→ status per capability. | Settings (each capability has its own card) | Same — shows what's configured vs not | Same | Click a capability → expand inline OR link to Settings card |
| 1.3 | **Talk to Your Agent** (orb + test call) | Center column of 3-col hero. WebRTC orb, "Try asking" prompts, "Or call me on my phone" | — | Same (uses trial test call) | Same (uses dashboard agent test) | Tap orb to start call |
| 1.4 | **Today's Update + Stats** | Right column of 3-col hero. Today's Update text input + calls this month + minutes bar | Settings > Today's Update card | Shows "0 calls this month" + minutes bar (trial limit) | Shows real call count + minutes | Today's Update: inline edit, saves on blur |

### TIER 2 — Core Identity & Readiness (first scroll)

| # | Component | Overview Behavior | Dedicated Page | Trial User | Paid User | Edit Style |
|---|-----------|-------------------|----------------|------------|-----------|------------|
| 2.1 | **How Your Agent Sounds** | Full width bar. Shows personality + voice name. **Expand reveals voice picker dropdown (all voices) + personality selector (casual/professional/formal/energetic/empathetic).** "Full settings →" link. | Settings > Voice card | Same | Same | Inline expand: voice dropdown + personality pills. Save button. Link to Settings for advanced. |
| 2.2 | **Agent Readiness** (pills) | Full width. "3/5" progress. [✓ Hours] [● Routing] [● Services] [✓ FAQs(9)] [✓ Knowledge(81)]. CTA for worst gap. | — (each pill links to its setting) | Shows setup gaps prominently + links to fill them | Shows completion status | Click pill → deep link to that Settings section |
| 2.3 | **Agent Setup Progress** (ring) | Full width bar when < 100%. "25% — Get started by adding business facts and hours." | — | **VISIBLE** — primary CTA. Shows progress ring + next step. | **HIDDEN** when 100% complete. Shows if degraded. | Click → opens next incomplete step inline or navigates |

### TIER 3 — Call Activity (main content)

| # | Component | Overview Behavior | Dedicated Page | Trial User | Paid User | Edit Style |
|---|-----------|-------------------|----------------|------------|-----------|------------|
| 3.1 | **Call Log** (rich cards) | Full width. Filter tabs: All / HOT / WARM / COLD / JUNK / MISSED. Shows top 5 calls with: caller, badges (HOT/WARM), type (EMERGENCY/APPOINTMENT), direction (Inbound), summary, action items, topic tags, sentiment, duration. Click card → **expand inline** with full summary + fields collected + "add to agent" actions. "View full call →" for deep page. | Calls & Leads > Calls tab | Shows "No calls yet — forward your number to get started" + test call results | Full call log with filters | Inline expand per call. "View all calls →" links to Calls & Leads |
| 3.2 | **Unanswered Questions** | Full width. Shows top 5 HOT questions with frequency. "Answer" expands inline with KB suggestion + "Generate AI answer" + "Use this answer" button. | Knowledge page > Unanswered tab | **VISIBLE even with 0 calls** — shows "Your agent will track questions callers ask that it can't answer" | Shows real questions ranked by frequency | Inline answer flow (expand, suggest, generate, save) |

### TIER 4 — Configuration Surfaces (mid-page)

| # | Component | Overview Behavior | Dedicated Page | Trial User | Paid User | Edit Style |
|---|-----------|-------------------|----------------|------------|-----------|------------|
| 4.1 | **Call Routing** | Left column of 2-col. IVR on/off badge. "Pre-call menu" expandable. "Voicemail greeting" expandable. | Settings > Call Menu / Voicemail sections | Shows setup CTAs | Shows current config, inline toggle IVR | Expand sections inline. IVR toggle syncs to agent immediately. |
| 4.2 | **Bookings This Month** | Right column of 2-col. Calendar grid. "Set up booking →" if not connected. Shows booked dates if connected. | Bookings page (dedicated) | Shows "Connect Google Calendar" CTA | Shows calendar with booking dots | CTA to connect, or "View all" to Bookings page |
| 4.3 | **After Calls** (SMS follow-up) | Below Call Routing in left column. Toggle + message template preview. | Settings > SMS card | Shows feature preview + "Upgrade →" if not on plan | Toggle on/off, edit template inline | Inline toggle + expand template editor |

### TIER 5 — Knowledge & Intelligence (lower page)

| # | Component | Overview Behavior | Dedicated Page | Trial User | Paid User | Edit Style |
|---|-----------|-------------------|----------------|------------|-----------|------------|
| 5.1 | **Knowledge Base** (source list) | Left column of 2-col. Expandable source rows: Website, Facts & Q&A, Text Imports, AI Compiler, Documents, Google Profile. Count badges. | Knowledge page (full editor) | Shows empty sources with "Add" CTAs | Shows counts, expand to see items | Expand source → see items. "View all ↗" for Knowledge page. |
| 5.2 | **Plan + Notifications** | Right column of 2-col. PLAN badge (CORE/PRO), minutes, "Upgrade →". Below: Notifications compact (Telegram: Connected, Email: On). Click ">" to expand or link to Settings. | Billing page / Settings > Notifications | Shows trial badge + days left + "Upgrade →" | Shows plan + minutes + upgrade CTA | Plan: link to Billing. Notifications: quick toggle or link to Settings. |

### TIER 6 — What Your Agent Knows (knowledge detail)

| # | Component | Overview Behavior | Dedicated Page | Trial User | Paid User | Edit Style |
|---|-----------|-------------------|----------------|------------|-----------|------------|
| 6.1 | **Google Listing** | Left column of 2-col. Shows connection status. "Connect Google listing" CTA if not connected. If connected: business info summary. | Knowledge page > Google Profile section | Shows CTA to connect | Shows GBP data summary | CTA to connect or "Review →" |
| 6.2 | **Business Facts** | Right column of 2-col. Bullet list of facts (truncated to ~8). "+ Add a fact" inline. Edit icon. | Knowledge page > Facts section | Shows empty state: "Add business facts so your agent can answer questions" | Shows facts list with inline add/edit | Inline add. Edit icon → expand for full edit. |

### TIER 7 — Utilities (bottom of page)

| # | Component | Overview Behavior | Dedicated Page | Trial User | Paid User | Edit Style |
|---|-----------|-------------------|----------------|------------|-----------|------------|
| 7.1 | **Business Hours** | Left column of 2-col. Weekday hours, Weekend hours, After-hours behavior. **Inline editable** — NOT a side sheet. | Settings > Hours card | Shows empty fields with placeholder text | Shows current hours, inline edit | Inline text fields + radio buttons. Save on change. |
| 7.2 | **Ask Your Agent** | Right column of 2-col. Text input: "Type a question a caller might ask." Simulates how agent would respond from its knowledge base. | — (unique to Overview) | Shows even for trial — demonstrates knowledge capability | Shows with real answers from KB | Type question, get answer. Shows sources. |

---

## Trial vs Paid User Experience

### Trial User (no phone number, limited calls)

```
WHAT THEY SEE (top to bottom):
1. [Activation Required] banner — 3 steps to go live
2. 3-col hero — Capabilities (gaps highlighted) | Orb (trial test) | Today's Update (0 calls, trial minutes)
3. Agent Setup Progress — 25% ring, "Get started by adding business facts and hours"
4. How Your Agent Sounds — voice picker (they chose during onboarding, can change)
5. Agent Readiness — 3/5, setup gaps prominent
6. Call Log — "No calls yet" empty state + test call results if any
7. Unanswered Questions — empty state: "Your agent will track questions..."
8. Call Routing + Bookings — setup CTAs
9. Knowledge Base (sources) + Plan (Trial badge, days left, Upgrade CTA) + Notifications
10. Google Listing + Business Facts — CTAs to add
11. Hours + Ask Your Agent

KEY: Trial users see the SAME layout, just with:
- Setup progress ring visible
- Empty states with helpful CTAs instead of data
- "Upgrade" CTAs where features are plan-gated
- Trial badge + days remaining in Plan card
```

### Paid User (active, phone number, real calls)

```
WHAT THEY SEE (top to bottom):
1. [Conditional banners only] — minutes warning, sync error, etc.
2. 3-col hero — Capabilities (7/11) | Orb (agent test) | Today's Update + 52 calls + 10% minutes
3. How Your Agent Sounds — current voice + personality
4. Agent Readiness — 5/5 or gaps if any
5. Call Log — RICH cards with filters, today's calls with badges/tags/actions
6. Unanswered Questions — top 5 HOT questions with Answer/Skip
7. Call Routing + Bookings (calendar with dots)
8. Knowledge Base (83 chunks) + Plan (CORE, 400 min) + Notifications (Connected/On)
9. Google Listing + Business Facts (populated)
10. Hours (filled) + Ask Your Agent

KEY: Same layout. Setup progress ring HIDDEN. Data replaces empty states.
```

---

## Navigation Matrix — Where Things Link

| Overview Component | Click/Tap Action | Expand Inline? | Deep Link Target |
|---|---|---|---|
| Capability pill (e.g., "Transfer calls") | Opens side sheet or inline expand with setup | Yes | Settings > Transfer card |
| Orb | Starts WebRTC test call | — | — |
| Today's Update | Edit text, save on blur | Yes | — |
| How Your Agent Sounds | Expand: voice dropdown + personality | Yes | Settings > Voice card |
| Agent Readiness pill | Link to corresponding Settings section | No | Settings > [section] |
| Call Log card | Expand: full summary, fields, actions | Yes | /dashboard/calls/[id] |
| Unanswered Question "Answer" | Expand: KB suggestion + AI generate | Yes | Knowledge page |
| Call Routing section | Expand: IVR toggle, greeting editor | Yes | Settings > Call Menu |
| Bookings calendar | Link to Bookings page | No | /dashboard/bookings |
| Knowledge Base source | Expand: show items in source | Yes | /dashboard/knowledge |
| Plan card | Link to Billing | No | /dashboard/billing |
| Notifications ">" | Link to Settings | No | Settings > Notifications |
| Google Listing | Link/CTA to connect | No | Knowledge > Google Profile |
| Business Facts | Inline add, edit icon | Yes | Knowledge > Facts |
| Hours fields | Inline edit, save | Yes | Settings > Hours card |
| Ask Your Agent | Type + get answer | Yes | — |

---

## Activity Tab (kept separate)

The Activity tab keeps its current behavior — a chronological feed of:
- Call events (started, completed, voicemail)
- Agent sync events
- Knowledge updates
- Notification delivery status

**Future improvement (not Wave 2):** Toast notifications when new activity arrives. Activity badge count on the tab.

---

## D-Item Mapping

| D-Item | What it covers | Row in matrix |
|--------|---------------|---------------|
| D278 | Agent Brain dashboard page (this IS the overview redesign) | All rows |
| D308 | Agent Brain nav placement | Top nav tab naming |
| D283b | PromptVariablesCard (read-only) | Tier 5 — Knowledge detail |
| D305-fe | Diff preview UI | Settings page (not Overview) |
| D307 | Recompose warning UX | Settings page (not Overview) |
| D306 | Empty states for every card | All tiers — trial user column |
| D288 | Capability preview card | Tier 1.2 — What Your Agent Can Do |
| D290 | "What Your Agent Knows" surface | Tier 6 — Google Listing + Business Facts |
| D286 | Dashboard settings reorganization | Settings page layout (separate from Overview) |
| D266 | Recent calls parity | Tier 3.1 — Call Log uses same component |

---

## Open Items (resolve before building)

- [ ] **Voice picker UX**: Dropdown of all voices, or grid with preview play button? How many voices are there currently?
- [ ] **Call Log filter bar width**: Full filter bar (All/HOT/WARM/COLD/JUNK/MISSED/Outbound) may be too wide on the Overview. Maybe collapse to just "All | HOT | WARM | More ▾"?
- [ ] **Inline expand animation**: Smooth accordion expand-down, or instant? Need consistent pattern across all expandable sections.
- [ ] **Mobile layout**: All 2-col and 3-col collapse to 1-col on mobile. What's the mobile priority order? Hero stays 1-col stack?
- [ ] **Settings page reorg (D286)**: Settings still needs its own layout pass — some cards are broken ("isn't working" per user). Separate from Overview work.
