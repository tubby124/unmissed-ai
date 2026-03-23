# UI/UX Overhaul Tracker — unmissed.ai Dashboard

> Living document. Cross items off as we go. Each pass runs through `/ui-ux-pro-max` + Sonar Pro research before implementation.
> Design aesthetic: **Notion + Apple + Linear** — clean, minimal, organized. No clutter.
> Created: 2026-03-23

---

## Design System Foundation (DONE)

- [x] Unified CSS vars in `globals.css` — light + dark tokens
- [x] `card-surface` utility class (bg + border + shadow)
- [x] `.t1/.t2/.t3` text hierarchy utilities
- [x] `.bg-surface`, `.bg-raised`, `.bg-page`, `.bg-hover` utilities
- [x] Semantic color tokens (success/warning/error/info + tints)
- [x] Shadow scale (xs/sm/md/lg) — multi-layer for light mode depth
- [x] `--color-primary` / `--color-accent-tint` brand tokens

---

## PASS 1 — Light Mode Fix (every page/component gets CSS var migration)

Goal: Make light mode look as polished as dark mode. Replace all hardcoded `dark:` Tailwind, inline `rgba()`, and `bg-white/[` patterns with CSS vars.

### Priority 1 — Client-Facing Pages (what paying users see)

| # | File | Lines | Issues | Status |
|---|------|-------|--------|--------|
| L1 | `Sidebar.tsx` | 566 | 6x `dark:`, hardcoded `bg-indigo-50`, `hover:bg-gray-50` | DONE |
| L2 | `MobileNav.tsx` | ~200 | Match to Sidebar after L1 | DONE |
| L3 | `StatusBadge.tsx` | 47 | 6x `dark:`, hardcoded status colors | DONE |
| L4 | `CallDetail.tsx` | 701 | inline `rgba(255,255,255,0.07)` in QualityGauge SVG, mixed patterns | DONE |
| L5 | `CallRow.tsx` | 378 | 1x `dark:`, 3x `rgba`, 1x `bg-white/[` | DONE |
| L6 | `CallsList.tsx` | ~300 | 5x `dark:` | DONE |
| L7 | `CallEventsPanel.tsx` | 210 | 10x `dark:` — heaviest dark: usage | DONE |
| L8 | `InsightsView.tsx` | 672 | 1x `dark:`, 9x `rgba`, 1x `bg-white/[` — big file | DONE |
| L9 | `login/page.tsx` | 423 | 10x `bg-white/[`, 2x `rgba` — card invisible in light | DONE |
| L10 | `notifications/page.tsx` | 401 | 8x `rgba`, 4x `bg-white/[` | DONE |
| L11 | `calendar/page.tsx` | 481 | 5x `rgba`, 5x `bg-white/[` | DONE |
| L12 | `OnboardingChecklist.tsx` | 220 | Mostly done, verify text colors | DONE |
| L13 | `ClientHome.tsx` | 346 | Mostly done | DONE |
| L14 | `AgentTestCard.tsx` | 362 | Mostly done | DONE |
| L15 | `UpgradeCTA.tsx` | 68 | Done | DONE |
| L16 | `TrialBadge.tsx` | 17 | Done | DONE |

### Priority 2 — Settings Cards (19 total, these need fixes)

| # | File | Issues | Status |
|---|------|--------|--------|
| L17 | `RuntimeCard.tsx` | 9x `bg-white/[` | DONE |
| L18 | `AlertsTab.tsx` | 7x `bg-white/[`, 1x `rgba` | DONE |
| L19 | `VoiceTab.tsx` | 6x `bg-white/[`, 1x `rgba` | DONE |
| L20 | `VoicePicker.tsx` | 5x `bg-white/[` | DONE |
| L21 | `VoiceStyleCard.tsx` | 1x `bg-white/[` | DONE |
| L22 | `AgentVoiceTest.tsx` | 2x `bg-white/[`, 4x `rgba` | DONE |
| L23 | `AgentOverviewCard.tsx` | 1x `bg-white/[`, 1x `rgba` | DONE |
| L24 | `LearningLoopCard.tsx` | 2x `bg-white/[` | DONE |
| L25 | `PromptVersionsCard.tsx` | 1x `bg-white/[` | DONE |
| L26 | `ImprovementHints.tsx` | 1x `bg-white/[` | DONE |
| L27 | `PromptEditorCard.tsx` | 2x `rgba` | DONE |
| L28 | `TestCallCard.tsx` | 2x `rgba` | DONE |
| L29 | `GodModeCard.tsx` | 1x `dark:` | DONE |
| L30 | `ActivityLog.tsx` | 1x `bg-white/[` | DONE |

### Priority 3 — Admin Pages

| # | File | Issues | Status |
|---|------|--------|--------|
| L31 | `voices/page.tsx` | 17x `bg-white/[`, 2x `rgba` — worst file | DONE |
| L32 | `admin/costs/page.tsx` | 16x `bg-white/[` | DONE |
| L33 | `admin/test-lab/page.tsx` | 17x `bg-white/[` | DONE |
| L34 | `admin/insights/page.tsx` | 9x `bg-white/[` | DONE |
| L35 | `admin/clients/page.tsx` | 1x `bg-white/[` | DONE |
| L36 | `admin/numbers/page.tsx` | 1x `bg-white/[` | DONE |

### Priority 4 — Other Dashboard Components

| # | File | Issues | Status |
|---|------|--------|--------|
| L37 | `StatsGrid.tsx` | 9x `dark:` — KEEP (dark: works with @custom-variant, provides correct light+dark values) | SKIP |
| L38 | `KanbanBoard.tsx` | 8x `dark:`, 2x `rgba` | DONE |
| L39 | `LiveCoachingPanel.tsx` | 3x `dark:` | DONE |
| L40 | `LeadsView.tsx` | 3x `dark:` | DONE |
| L41 | `RevenueAtRisk.tsx` | 3x `dark:` | DONE |
| L42 | `ClientHealthBar.tsx` | 3x `dark:` | DONE |
| L43 | `CampaignCard.tsx` | 2x `dark:`, 1x `rgba` | DONE |
| L44 | `UsageSummary.tsx` | 1x `dark:` | DONE |

### Priority 5 — Onboarding Flow

| # | File | Issues | Status |
|---|------|--------|--------|
| L45 | `step6-review.tsx` | 41x `dark:` — worst single file | DONE |
| L46 | `step1.tsx` | 8x `dark:` | DONE |
| L47 | `step4.tsx` | 5x `dark:` | DONE |
| L48 | `step5-handling.tsx` | 5x `dark:` | DONE |
| L49 | `WebsiteScrapePreview.tsx` | 26x `dark:` | DONE |
| L50 | `TrialSuccessScreen.tsx` | 5x `dark:` | DONE |

### Priority 6 — Shared/Marketing Components

| # | File | Issues | Status |
|---|------|--------|--------|
| L51 | `StatsSection.tsx` | 4x `dark:` | DONE |
| L52 | `DemoCallVisuals.tsx` | 4x `rgba` | SKIP — WebRTC orb color maps, dynamic status gradients |
| L53 | `DemoCall.tsx` | 3x `rgba` | SKIP — glass card on dark-only marketing overlay |
| L54 | `DemoAudioPlayer.tsx` | Rewritten Wave 2 — uses CSS vars | DONE (Wave 2 rewrite) |
| L55 | `HeroCallMockup.tsx` | 4x `rgba` | SKIP — accent tints in animated shadow/badge |
| L56 | `TalkToAgentWidget.tsx` | Rewritten Wave 2 — uses CSS vars | DONE (Wave 2 rewrite) |
| L57 | `TryItNowWidget.tsx` | DELETED — dead code | DONE (Wave 3 cleanup) |
| L58 | Advisor components (5 files) | Mixed `dark:` + `rgba` | DONE |
| L59 | `ui/input.tsx` | 2x patterns | DONE |
| L60 | `ui/textarea.tsx` | 1x pattern | DONE |
| L61 | `ui/select.tsx` | 1x pattern | DONE |
| L62 | `ui/button.tsx` | 4x patterns | DONE |
| L63 | `ui/badge.tsx` | 2x patterns | DONE |
| L64 | `ui/chart.tsx` | 1x pattern | DONE |
| L65 | `auth/set-password/page.tsx` | 3x patterns | DONE |

---

## PASS 2 — Dark Mode Polish (DONE)

Goal: Verify dark mode still looks great after Pass 1 changes. Fix any regressions.

Audited 2026-03-23: 8 pages screenshotted in light mode (Command Center, Overview, Client Home, Settings, Notifications, Login, Insights, Onboarding). Dark mode regression verified. Screenshots in `light-mode-audit/`.

| # | Item | Status |
|---|------|--------|
| D1 | Full Playwright screenshot audit — every page in both themes | DONE |
| D2 | Verify card borders have enough contrast (`#1e1e1e` on `#111111`) | DONE |
| D3 | Verify status badges readable in dark | DONE |
| D4 | Verify sidebar active/hover states | DONE |
| D5 | Verify onboarding flow dark mode | DONE |

---

## PASS 3 — Consistency & Template System

Goal: Every page follows the same visual template. No page looks "different" from the others.

| # | Item | Status |
|---|------|--------|
| C1 | Page template: `p-3 sm:p-6 space-y-6` on all pages. `PageHeader` component for titles. | DONE |
| C2 | Sidebar — consistent active state, hover, group separators (CSS vars not Tailwind) | DONE — `bg-blue-500` logo icon → `var(--color-primary)` in Sidebar.tsx; MobileNav.tsx already using CSS vars throughout; all active/hover/divider states confirmed on CSS vars in both files |
| C3 | All cards use `card-surface` + `rounded-2xl`. Migrated: calendar, ClientHome, OperatorActivity, OutcomeCharts (3), AudioWaveformPlayer (2), TranscriptTimeline (2), MinuteUsage, OnboardingChecklist, CallsList processing bar. | DONE |
| C4 | All section headers: unified `tracking-[0.15em]` across 54 files. Calendar `tracking-widest`, ClientHome `tracking-wide`, 72 instances of `tracking-[0.2em]` all normalized. | DONE |
| C5 | All page titles: `text-lg font-semibold tracking-tight t1` via `PageHeader`. Calendar `text-2xl font-bold` fixed. Campaigns inline header → `PageHeader`. | DONE |
| C6 | All "View all" / action links: `text-[12px]` + `var(--color-primary)` | DONE |
| C7 | Consistent hover: rows use `hover:bg-hover transition-colors`, cards use `hover:shadow-sm`. Calendar `hover:border-indigo-500/20` fixed. ClientHome JS `onMouseEnter/Leave` → CSS `hover:bg-hover`. | DONE |
| C8 | StatusBadge used everywhere. ClientHome inline `STATUS_COLORS` map removed → `StatusBadge` component. | DONE |
| C9 | Loading: all page/component skeletons use shimmer `SkeletonBox`. Fixed: calendar, ClientHome, OperatorActivity, InsightsView, CallsList, CallEventsPanel, ActionItems, UsageSummary. | DONE |
| C10 | Empty states: old `EmptyState.tsx` already unused (0 imports). All pages use `EmptyStateBase` variants. | DONE |
| C11 | Error states: `ErrorCard` component created. ClientHome inline error → `ErrorCard`. | DONE |
| C12 | Mobile: all pages `p-3 sm:p-6`. Calendar `p-6 max-w-5xl mx-auto` → `p-3 sm:p-6`. Leads admin `p-6` → `p-3 sm:p-6`. Campaigns `p-6` → `p-3 sm:p-6`. | DONE |

### Pass 3 New Components Created
- `src/components/dashboard/PageHeader.tsx` — standardized page title + optional subtitle + action slot
- `src/components/dashboard/SectionLabel.tsx` — standardized section header (11px semibold uppercase)
- `src/components/dashboard/ErrorCard.tsx` — standardized error card (title + message + retry)
- `CalendarSkeleton` added to `src/components/dashboard/SkeletonLoader.tsx`
- `SkeletonBox` exported from `SkeletonLoader.tsx` for reuse

### Pass 3 Files Modified (pages)
- `calendar/page.tsx` — padding, PageHeader, CalendarSkeleton, card-surface, tracking, hover, rounded-2xl
- `calls/page.tsx` — added space-y-6
- `leads/page.tsx` — admin path p-6 → p-3 sm:p-6
- `campaigns/page.tsx` — p-6 → p-3 sm:p-6, inline header → PageHeader
- `dashboard/page.tsx` — PageHeader + SectionLabel (done in earlier session)

### Pass 3 Files Modified (components — inner)
- `ClientHome.tsx` — padding, SkeletonBox, ErrorCard, StatusBadge, rounded-2xl, tracking, hover:bg-hover
- `OperatorActivity.tsx` — SkeletonBox shimmer, SummaryCard card-surface + rounded-2xl, tracking
- `InsightsView.tsx` — SkeletonBox shimmer, tracking
- `CallsList.tsx` — SkeletonBox shimmer, processing bar card-surface + rounded-2xl, tracking
- `OutcomeCharts.tsx` — 3 cards inline styles → card-surface, tracking
- `AudioWaveformPlayer.tsx` — 2 cards inline styles → card-surface, tracking
- `TranscriptTimeline.tsx` — 2 cards inline styles → card-surface, tracking
- `MinuteUsage.tsx` — card-surface, tracking
- `OnboardingChecklist.tsx` — card-surface
- `CallEventsPanel.tsx` — SkeletonBox shimmer, tracking
- `ActionItems.tsx` — SkeletonBox shimmer
- `UsageSummary.tsx` — SkeletonBox shimmer, tracking
- `AgentTestCard.tsx` — tracking
- 47 files total: `tracking-[0.2em]` → `tracking-[0.15em]` bulk normalization
- `ClientHome.tsx` — "View all" link: inline style → Tailwind `text-[var(--color-primary)]` + `font-medium hover:opacity-75`
- `settings/AgentConfigCard.tsx` — "Change voice →": `text-blue-400 hover:text-blue-300` → action link standard
- `settings/AgentTab.tsx` — "Carrier instructions": `text-blue-500 hover:text-blue-400` → action link standard
- `LeadQueue.tsx` — "Add your first lead": `text-blue-400 hover:text-blue-300` → action link standard + `cursor-pointer`
- `LeadsView.tsx` — "View full call": `text-blue-500 dark:text-blue-400 hover:*` → action link standard
- `KnowledgeBaseTab.tsx` — "Select/Deselect all" (×2): `text-[10px] text-blue-400 hover:text-blue-300` → action link standard + `cursor-pointer`
- `OnboardingChecklist.tsx` — step action button: `text-blue-500 hover:text-blue-400 underline` → action link standard

---

## PASS 4 — Dead UI Cleanup

Goal: Remove buttons, links, and components that don't go anywhere or don't make sense.

| # | Item | Status |
|---|------|--------|
| X1 | Audit all sidebar nav items — which ones actually work for clients? | TODO |
| X2 | "Agent" sidebar label — rename to "Setup" or "Go Live" (conflicts with Settings > Agent tab) | TODO |
| X3 | Remove/hide nav items that link to empty/broken pages for non-admin users | TODO |
| X4 | Audit all action buttons — do they all have working onClick/href? | TODO |
| X5 | Remove "Secured by Supabase Auth" from login page | TODO |
| X6 | Check all Settings tab links (`?tab=knowledge`, `?tab=agent`, etc.) resolve correctly | TODO |
| X7 | Find and remove dead/unused components (not imported anywhere) | TODO |
| X8 | Clean up duplicate status badge implementations (inline vs StatusBadge component) | DONE (C8 in Pass 3) |

---

## PASS 5 — Dynamic & Motion (LATER — after Pass 1-4)

Goal: Add subtle, purposeful micro-interactions. Not decorative — functional.

| # | Item | Priority | Status |
|---|------|----------|--------|
| M1 | Page transitions — smooth fade between dashboard pages | Medium | TODO |
| M2 | Card hover elevation — subtle shadow lift on hover | Medium | DONE — KanbanCard/CampaignCard already had hover:shadow-md/lg; focus-visible rings added to all user-facing buttons in CallRow, LeadsView, AgentTestCard, OperatorActivity |
| M3 | Data refresh indicator — subtle pulse when realtime data updates | Low | TODO |
| M4 | Loading skeletons — unified shimmer animation across all pages | Medium | DONE (Pass 3 C9) |
| M5 | Voice orb improvements — smoother energy visualization | Low | TODO |
| M6 | Number counters — animate stat changes (NumberTicker already exists) | Low | TODO |
| M7 | Sidebar collapse/expand — already has spring animation, verify smoothness | Low | TODO |
| M8 | Toast notifications — consistent entrance/exit animation | Low | TODO |
| M9 | Call status transitions — animate badge color changes | Low | TODO |
| M10 | Progress bars — animate fill changes (minutes usage, onboarding) | Low | DONE (onboarding has it) |

---

## PASS 6 — Future Enhancements (revenue-generating, not cosmetic)

Goal: Features that help convert trial users or retain active clients. Do after Pass 1-5.

| # | Item | Priority | Status |
|---|------|----------|--------|
| F1 | Trial hero badge — amber "Trial" not green "Live" for trial users | High | TODO |
| F2 | Inline mini-editors — quick FAQ add, hours toggle without settings nav | Medium | TODO |
| F3 | Website scrape hint — "Add your website to teach your agent more" | Medium | TODO |
| F4 | Post-call quality signal — color-coded call quality on call list | Medium | TODO |
| F5 | Mobile onboarding fallback — inline card for <1024px (tour doesn't work) | Medium | TODO |
| F6 | Settings search/filter | Low | TODO |
| F7 | Cost-per-call widget | Low | TODO |
| F8 | Conversation flow visualization | Low | TODO |

---

## PASS 7 — Missing Patterns (from Sonar Pro research — things we haven't built)

Things top SaaS dashboards have that we're missing entirely. Prioritized by revenue impact.

### HIGH — Table Stakes We're Missing

| # | Item | Why | Status |
|---|------|-----|--------|
| N1 | **Command palette (`Cmd+K`)** | Jump to any page, search calls, filter leads. Linear/Retool standard. 30% power-user retention boost. | TODO |
| N2 | **Conversion funnel visualization** | Calls → Leads → Bookings visual. Single most useful chart for non-tech owners. Answers "is my agent making me money?" | TODO |
| N3 | **Agent health score (0-100)** | One number that answers "is it working?" — combines quality score, booking rate, sentiment. Gauge + trend arrow. | TODO |
| N4 | **Contextual tooltips on all metrics** | Hover any stat to see "what this means" + "how to improve it". Non-tech users don't know what "Avg Quality 7.2" means. | TODO |
| N5 | **Threshold alerts** | "No calls in 24h — test agent?" / "3 missed bookings this week" — contextual, not spammy. Banner near relevant metric. | TODO |
| N6 | **Keyboard shortcut cheat sheet (`?`)** | Show all shortcuts on `?` press. Standard in premium SaaS. | TODO |

### MEDIUM — Engagement & Retention

| # | Item | Why | Status |
|---|------|-----|--------|
| N7 | **Pre-filled demo data for new users** | Show fake calls/transcripts/bookings on first login so dashboard doesn't look empty. Transitions to real data after first call. | TODO |
| N8 | **"Today's Wins" card** | "5 bookings (+20%)" with play buttons for top calls. Positive reinforcement. Owners scan in 5 seconds. | TODO |
| N9 | **Inline "Fix now" CTAs on metrics** | When a stat is bad (e.g., low quality score), show "Fix: Update greeting →" right there. Data without actions = "So what?" | TODO |
| N10 | **Progressive notifications** | Start with in-app dot badges, escalate to email/SMS only after 2 ignores. Personalized by niche. | TODO |
| N11 | **Export to CSV/PDF** | Let owners export call logs, analytics for accountants/partners. `e` keyboard shortcut. | TODO |
| N12 | **Transcript playback with voice** | Play call recording synced to transcript highlighting. Currently separate. | TODO |

### LOW — Power User / Future

| # | Item | Why | Status |
|---|------|-----|--------|
| N13 | **Customizable dashboard widgets** | Drag-drop cards to build personalized layout. Heavy lift but expected in enterprise. | TODO |
| N14 | **Voice query** | "/show calls from today" or "how many bookings this week?" in the advisor chat. | TODO |
| N15 | **Role-based views** | Different dashboard for admin vs client owner vs staff. Currently just admin/client split. | TODO |
| N16 | **Collaborative comments on calls** | Tag team members on specific calls. "Listen to this one — great booking example." | TODO |
| N17 | **WCAG 2.2 full audit** | Keyboard-navigable grids, screen-reader labels on charts, high-contrast mode. EU Digital Accessibility Act compliance. | TODO |
| N18 | **Gesture navigation on mobile** | Swipe for transcripts, pinch-zoom charts. Currently basic responsive. | TODO |

---

## Marketing Visual Overhaul

$1M MRR strategy: make the "hear it yourself" phone input the centerpiece. PLG conversion engine.

### Wave 1 — Conversion Multipliers (DONE)

| # | Component | What Changed | Status |
|---|-----------|-------------|--------|
| V1 | `HeroCallMockup.tsx` | Elevated: max-w-xs → max-w-sm, ambient glow backdrop that shifts color per stage (ringing=subtle, live=indigo, hot=red, summary=indigo), premium multi-layer shadows, p-5 → p-6. | DONE |
| V7 | `StatsSection.tsx` → `TrustBar.tsx` | Replaced fear stats (62% miss calls) with proof stats (8,400+ calls handled, 2,100+ leads, <1s answer, 24/7). Icon+label layout. Stats woven into hero subtitle instead. | DONE |
| V8a | `page.tsx` hero | Split layout: 2-col grid (copy left, mockup right on lg+). Phone input is now THE primary hero CTA with "Hear it yourself" label. Removed "Get My Agent" button. Added ambient glow behind right column. | DONE |
| V8b | `page.tsx` final CTA | Phone input bookend replaces "Start Trial" button. Separated trust signals (trial / price / no contracts) with dividers. Secondary "sign up" text link below. | DONE |
| V8c | `HeroContent.tsx` | Rewrote: pain stats in subtitle, phone CTA as primary action, trust line with pricing, removed competing CTAs. Left-aligned on desktop, centered on mobile. | DONE |
| V6 | `TryItNowWidget.tsx` | Already dead code (0 imports). Confirmed for cleanup in Pass 4. | DEAD CODE |

### Wave 2 — Engagement Deepeners (DONE)

| # | Component | What Changed | Status |
|---|-----------|-------------|--------|
| V2 | `DemoAudioPlayer.tsx` | Componentized into 4 files: `demo-data.ts` (types/data), `DemoCallCard.tsx` (call transcript + VoicePoweredOrb avatar + waveform), `DemoOutcome.tsx` (lead card + telegram toast + pipeline steps), `DemoAudioPlayer.tsx` (orchestrator + tabs). VoicePoweredOrb replaces static letter avatar — energy reacts to call stage (ringing=0.15, speaking=0.75, idle=0.2, ended=0.05). Large centered orb during ringing state. Dynamic card shadow glows indigo during live calls. 3 demo niches (auto-glass, property-mgmt, real-estate). | DONE |
| V5 | `TalkToAgentWidget.tsx` | AnimatePresence for open/close transitions. VoicePoweredOrb mini-orb replaces Mic icon in floating button. Overlay slide-up with spring animation. Branded header with orb + agent name. Escape key to close. Body scroll lock during overlay. | DONE |
| V3 | `DemoCallVisuals.tsx` | Deferred — shared with dashboard WebRTC calls, changes need careful testing. | DEFERRED |
| V4 | `DemoCall.tsx` | Deferred — functional infrastructure, not marketing presentation. | DEFERRED |

### Wave 3 — Polish (IN PROGRESS)

| # | Item | Status |
|---|------|--------|
| W3a | Full responsive audit — hero on mobile, trust bar, CTA | TODO |
| W3b | Dark/light mode verification on all marketing sections | TODO |
| W3c | Performance — lazy load DemoAudioPlayer, NicheSelectorGrid below fold | TODO |
| W3d | Dead component cleanup — remove TryItNowWidget.tsx, StatsSection.tsx | DONE |

---

## Reference Components (styles we like — adapt for implementation)

| # | Component | Source | Notes | Status |
|---|-----------|--------|-------|--------|
| R1 | **Full-Screen Calendar** | originui/shadcn | Proper grid with events, clean month nav. Replace `calendar/page.tsx`. | TODO |
| R2 | **Sign-In Page** | originui/shadcn | Glass morphism inputs, hero + testimonials, Google OAuth. **DONE** — rebuilt as split-layout login. | DONE |
| R3 | **Dropdown Menu** | shadcn radix | Full dropdown-menu.tsx primitive. **DONE** — created. | DONE |
| R4 | **Button variants** | originui | focus-visible outline offset pattern. Already in our button.tsx. | DONE |
| R5 | **File Upload** | originui/shadcn | Drag-and-drop zone, file preview card with remove, progress. Dashed border, muted bg preview. Uses Button, Label. For knowledge doc uploads, scrape file imports, etc. | TODO |
| R6 | **Separator** | shadcn radix | separator.tsx primitive. **DONE** — created. | DONE |

---

## Architecture / Navigation (separate sessions)

Items that need their own focused session — not CSS polish, but structural changes.

| # | Item | Why | Status |
|---|------|-----|--------|
| A1 | **Consolidate `/admin` into `/dashboard` with role gating** | 4 pages exist in both routes (calls, insights, calendar, clients). 3 admin pages already linked from dashboard sidebar (Cost Intel, Numbers, Lab). Users cross route boundaries without knowing. Need: merge into `/dashboard` with admin-only gating, remove `/admin` layout. ~15 files. | TODO |
| A2 | **Agent/Setup page: replace pill grid with dropdown picker** | Current client selector is scattered pill chips in a grid. Replace with the dropdown picker that already exists elsewhere (search filter + Active/Unassigned grouping + niche badge + phone number per row). Much cleaner selection UX. | TODO |

---

## Execution Rules

1. **Every pass starts with Sonar Pro research** for that specific topic
2. **Every pass runs through `/ui-ux-pro-max`** for design validation
3. **Run `npm run build`** after every file change — no regressions
4. **Playwright screenshot** before/after each pass for visual diff
5. **One pass at a time** — don't start Pass 2 until Pass 1 is done
6. **Within Pass 1**: work Priority 1 files first, then 2, then 3...
7. **Commit after each priority group** within a pass

---

## Stats

- **Pass 1 COMPLETE** — all 5 target pattern categories at ZERO across `src/`
  - `bg-white/[0.0X]`: 0
  - `border-white/[0.0X]`: 0
  - `hover:bg-white/[*]`: 0
  - `divide-white/[*]`: 0
  - `dark:(bg|border|text)-(zinc|gray|slate)-*`: 0
- **Files fixed**: ~58 (P1-P6 all DONE, StatsGrid SKIP, L52-L57 SKIP — marketing components)
- **Playwright verified**: login dark, dashboard dark + light, settings light — all look clean
- **Pass 2 residue** (legitimate usage mixed with fixable): text-white (217), text-zinc (112), text-gray (108), bg-gray (7), border-zinc (56), rgba (216)

### CSS Var Mapping Reference (for consistency across all files)
```
bg-white/[0.01-0.03]  →  bg-page
bg-white/[0.04-0.08]  →  bg-hover
bg-white/[0.1+]       →  bg-[var(--color-border)]
hover:bg-white/[*]    →  hover:bg-hover
border-white/[0.04-12] →  b-theme
divide-white/[*]      →  divide-[var(--color-border)]
dark:text-gray-200    →  t1
dark:text-gray-400    →  t3
dark:bg-zinc-800      →  bg-hover
dark:border-zinc-700  →  b-theme
text-white (primary)  →  t1
text-zinc-300         →  t2
text-zinc-400/500     →  t3
```
Note: `dark:` on COLORED elements (dark:text-red-400, dark:border-blue-500/20) is CORRECT and should be KEPT — provides explicit light+dark values.

---

## Sonar Pro Research Log

| Date | Topic | Key Findings |
|------|-------|-------------|
| 2026-03-23 | Light/dark theme consistency | Use semantic tokens, off-black #121212 not #000, off-white #E0E0E0 not #FFF, 4.5:1 contrast min, shape+icon not just color for status |
| | | Light mode harder than dark — prioritize it. Card shadows + bg separation = key to light mode depth |
| | | Next: need specific research per pass (sidebar patterns, status badge approaches, etc.) |
| 2026-03-23 | SaaS dashboard patterns we're missing | Cmd+K palette = table stakes (30% retention). Conversion funnel viz = #1 chart for non-tech owners. |
| | | Agent health score (0-100 gauge) answers "is it working?" in 1 second. Threshold alerts > scheduled notifications. |
| | | Empty states: demo shimmer data + personalized CTA = 3x activation vs "No data". Pre-fill with fake calls. |
| | | Anti-patterns: data without actions, no tooltips on metrics, aggressive modals, blank empty states, no mobile adaptation |
| | | Keyboard: `?` cheat sheet, `Cmd+K` palette, `space` play transcript, `e` export. Power users 2x stickier. |
| | | Accessibility: WCAG 2.2 now mandatory (EU Digital Accessibility Act). Screen-reader labels on charts, keyboard nav on grids. |
