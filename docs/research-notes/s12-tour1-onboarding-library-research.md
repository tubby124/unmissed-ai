# S12-TOUR1: SaaS Onboarding Tour Library Research

**Date:** 2026-03-21
**Purpose:** Production-quality library recommendation for S12-TOUR2 (step-by-step guided tour)
**Target:** Next.js 15 App Router, React 19, TypeScript, SSR-safe

---

## 1. Library Comparison Matrix

| Library | NPM Weekly DL | GitHub Stars | Gzipped Size | React 19 | Next.js 15 App Router | TypeScript | Last Commit | SSR Safe | License |
|---------|--------------|-------------|-------------|----------|----------------------|-----------|-------------|---------|---------|
| **driver.js** | 394K | 25,505 | ~5 KB | Yes (vanilla JS) | Yes (client component) | Native TS source | Active (2025) | Yes (imperative, client-only) | MIT |
| **react-joyride** | 597K | 7,616 | ~50 KB | **NO** (deprecated APIs) | Broken | JS + @types | Stale (9+ months) | Hydration issues | MIT |
| **shepherd.js** | 109K | 13,679 | ~30 KB | Partial (wrapper) | Manual setup | JS source | Active | Manual DOM handling | MIT |
| **NextStepjs** | 14K | 972 | ~8-12 KB (est.) | Unconfirmed | **Native** (built for it) | Yes | Active (2025) | Yes (built-in) | MIT |
| **Onborda** | 4.9K | 1,358 | ~15 KB + Framer Motion | Unconfirmed | **Native** (built for it) | 100% TS | Dec 2024 | Yes (built-in) | MIT |
| **OnboardJS** | <500 | 49 | Unknown (RC stage) | Unconfirmed | Yes (both routers) | 98.6% TS | Feb 2026 | Yes (headless) | MIT |

### Critical Disqualifications

**react-joyride: ELIMINATED.** Despite highest npm downloads (597K/week), it imports deprecated React DOM APIs (`unmountComponentAtNode`, `unstable_renderSubtreeIntoContainer`) removed in React 19. Open GitHub issue #1122 confirms incompatibility. Peer deps locked to React 16.8-18. No update in 9+ months. Dead for any new Next.js 15 project.

**intro.js: ELIMINATED.** Imperative jQuery-era API. Not React-native. Forces `data-intro` attributes on DOM elements. Commercial license required for production use (not MIT).

**Shepherd.js: DEPRIORITIZED.** The `react-shepherd` wrapper works but you are wrapping a vanilla JS library. No native awareness of React component lifecycle, App Router navigation, or Server Components. Bundle includes Floating UI dependency. Viable but not optimal for Next.js 15.

### Viable Contenders (Ranked)

#### Tier 1: Best Fit for Next.js 15 + Voice Agent Dashboard

**1. driver.js (RECOMMENDED for tour tooltips)**
- Smallest bundle (5 KB gzipped) with zero dependencies
- Vanilla JS = framework-agnostic, no React version coupling
- Clean imperative API works perfectly inside `useEffect` in client components
- 25K+ GitHub stars = battle-tested, well-maintained
- Limitation: no built-in multi-page tour routing (must handle manually)
- Limitation: no persistence layer (must build yourself)

**2. NextStepjs (RECOMMENDED for multi-page tours)**
- Purpose-built for Next.js with navigation adapters
- Each adapter packaged separately (tree-shakeable)
- Multi-page tour support with route navigation built in
- Motion (formerly Framer Motion) for animations
- 972 stars = smaller community but actively maintained
- Limitation: smaller ecosystem, fewer examples
- Limitation: depends on `motion` package (~30 KB)

**3. Onborda (STRONG ALTERNATIVE)**
- Built for Next.js, shadcn/ui integration confirmed
- 100% TypeScript, Framer Motion animations, Tailwind styling
- Custom tooltip components = full design control
- 1.4K stars, shadcn/ui ecosystem alignment
- Limitation: last commit Dec 2024 (4 months gap)
- Limitation: only 2 contributors, 15 open issues
- Limitation: Framer Motion dependency adds weight

#### Tier 2: Different Architecture (Headless)

**4. OnboardJS (WATCH but do not adopt yet)**
- Headless state machine approach = bring your own UI
- Built-in analytics + persistence hooks + plugin system
- 98.6% TypeScript, explicit Next.js support
- Limitation: only 49 GitHub stars, still in RC (1.0.0-rc.4)
- Limitation: zero production track record
- Limitation: "headless" means you build ALL the UI yourself
- Good for: complex multi-step activation flows (not tooltip tours)

---

## 2. Real-World SaaS Onboarding Patterns

### How Top Products Handle First Login

| Product | Approach | Steps | Tour Type | Persistence | Skip/Replay |
|---------|----------|-------|-----------|-------------|-------------|
| **Notion** | Contextual nudges + setup checklist | 3-5 gentle prompts | No forced tour; checklist sidebar | Server-side (workspace state) | Always skippable |
| **Linear** | Clean empty state + contextual hints | Minimal (2-3) | No separate tour; inline hints | Server-side | Implicit (just use it) |
| **Figma** | Interactive workspace with tooltips | 4-6 contextual | Tooltip-based, triggered by action | Server-side | Skippable, re-launchable |
| **Loom** | Immediate action prompt (record first video) | 1-2 before first use | Embedded demo videos | Server-side | Single CTA, skippable |
| **Slack** | Conversational flow in product | 3-4 (invite, channel, message) | In-product tasks | Server-side (workspace config) | Guided but not forced |
| **Intercom** | Role-based paths + in-app surveys | 5-7 personalized | Modal survey then contextual | Server-side + analytics | Skippable per step |

### Key Pattern: Nobody Uses Forced Multi-Step Tours Anymore

The universal trend in 2025-2026:
- **Notion model:** Land in a working workspace with a subtle checklist. Checklist items highlight as the user naturally explores. 60% completion rate, 40% retention bump at 30 days.
- **Figma model:** Hands-on immediately. Tooltips surface ONLY when the user hovers or clicks near a feature for the first time.
- **Linear model:** Trust the UI to be self-evident. Minimal onboarding = minimal friction. Best for power users.

### The Pattern That Works for Our Use Case (Voice Agent SaaS)

Our users are NOT power users. They are small business owners (realtors, auto glass shops). The right pattern is:

**Guided checklist + contextual tooltips + one "wow moment" early.**

1. First login: 3-4 step setup checklist (persistent sidebar or card)
2. Each step: tooltip highlights WHERE to click, 1-sentence explanation
3. Step 1 is ALWAYS the "wow moment" (test your agent via WebRTC orb)
4. Remaining steps: practical setup (Telegram, calendar, forwarding)
5. Checklist persists across sessions (DB-backed via `client_users.onboarding_state`)
6. Re-launchable from help menu or settings
7. Mobile: collapses to bottom sheet, not sidebar

---

## 3. Best Practices (Evidence-Based)

### Optimal Step Count
- **3-5 steps** for the initial tour/checklist (industry consensus)
- Each step under 15 seconds of reading
- Total tour time under 90 seconds
- Over 7 steps: completion drops 30-50%

### Trigger Mechanism
- **First login** triggers the checklist (not a blocking modal)
- **Empty states** trigger contextual hints (no calls yet, no knowledge docs)
- **Feature discovery** triggers tooltips on first visit to a section
- Never: auto-play a full tour on every login

### Persistence
- **Server-side (DB):** `onboarding_completed_steps: string[]` or `onboarding_state: jsonb` on `client_users` table
- **localStorage fallback:** only for session-specific UI state (tooltip dismissed)
- **Never localStorage-only:** user clears browser, tour replays, user is annoyed
- OnboardJS has persistence hooks; driver.js and NextStepjs require custom persistence

### Modal vs Tooltip vs Sidebar vs Checklist
| Pattern | Best For | Worst For |
|---------|----------|-----------|
| **Modal** | Welcome message, 1-time announcements | Multi-step tours (feels trapped) |
| **Tooltip** | Feature discovery, contextual help | Complex workflows (too small) |
| **Sidebar checklist** | Setup progress, multi-session | Mobile (takes too much space) |
| **Inline card** | Empty state guidance | Cluttered dashboards |
| **Bottom sheet** | Mobile-friendly checklist | Desktop (wastes vertical space) |

**Recommendation:** Sidebar checklist on desktop, bottom sheet on mobile. Tooltips for individual feature discovery within each step.

---

## 4. Anti-Patterns (What Users Hate)

### Immediate Skip Triggers
1. **Forced sequential tours** where user must click Next 8+ times before using the product
2. **Blocking modals** that prevent any interaction until dismissed
3. **Tours that restart** after the user already completed them (localStorage-only persistence)
4. **Information overload:** explaining every button on the first visit
5. **No skip button** or hard-to-find dismiss option
6. **Passive tours** (just reading, no doing) - users forget 90% within minutes
7. **Generic tours** that don't adapt to the user's role or setup state
8. **Tours over empty data** - "click here to see your calls" when there are zero calls

### What Actually Works
1. **Interactive steps:** "Click this button to test your agent" beats "This button tests your agent"
2. **Immediate value:** Step 1 should produce a visible result (hear your agent talk)
3. **Progressive disclosure:** Show features as they become relevant, not all at once
4. **Respect completion:** If user has already set up Telegram, skip that step
5. **Celebrate progress:** Visual progress bar, checkmarks, micro-animations on completion

---

## 5. Voice Agent / WebRTC Onboarding Patterns

### How Competitor Platforms Handle "Test Your Agent"

| Platform | Test Mechanism | In-Dashboard | First Login Flow |
|----------|---------------|:------------:|-----------------|
| **Vapi** | "Talk to Assistant" button in dashboard | Yes | Create assistant, click Publish, click Talk. WebRTC in-browser. |
| **Retell AI** | LLM Playground (chat) + Web Call test | Yes | Text playground for quick iteration, web call for voice test. Separate from main dashboard. |
| **Bland AI** | Interactive builder + test call | Yes | Build agent inline, test with real call. Managed onboarding support. |
| **Hamming AI** | SIP/WebRTC test call runner | Separate tool | Onboarding call with team, then first test in under 10 minutes. |

### Key Insight for unmissed.ai

Vapi's pattern is closest to what we need: a single "Talk to your agent" button embedded directly in the dashboard. The user clicks it, WebRTC connects, they hear their own agent. No phone number required, no external tool.

**Our implementation advantage:** We already have the WebRTC orb component on the `/try` demo page. The S12-TRIAL1 task is to reuse that component pointed at the user's own `ultravox_agent_id` instead of a demo agent. The onboarding tour's Step 1 should highlight this orb and prompt the user to try it.

---

## 6. Recommendation for unmissed.ai (S12-TOUR2)

### Architecture Decision

**Use driver.js for tooltip tours + custom React checklist component for the persistent setup progress.**

Rationale:
1. **driver.js** (5 KB) handles the tooltip highlighting, backdrop overlay, and step-by-step element focusing. It is the smallest, most stable, most downloaded option that works with React 19 and Next.js 15.
2. **Custom checklist** (React component + Supabase persistence) handles the 4-step setup progress, completion tracking, and cross-session state. No library needed for this -- it is just a card with checkboxes and state.
3. **Do NOT use** a heavy all-in-one library for this. The total custom code is ~200 lines of React + ~50 lines of driver.js config. A library like Onborda or NextStepjs adds 15-30 KB for features we will not use (multi-page routing, complex animations).

### Why Not NextStepjs or Onborda?

- **NextStepjs:** Good library but 14K weekly downloads = small community. If it breaks with a Next.js update, we are waiting on 1 maintainer. driver.js at 394K downloads is safer.
- **Onborda:** shadcn/ui integration is appealing but last commit was Dec 2024. Framer Motion dependency adds ~30 KB we do not need. 2 contributors.
- **OnboardJS:** Architecturally interesting (headless state machine) but 49 stars and RC status. Not production-ready. Revisit in 6 months.

### Implementation Plan

```
Step 1: "Meet Your Agent" (WebRTC orb)
  - driver.js highlights the embedded WebRTC orb component
  - Tooltip: "Click to talk to your AI agent. Try asking it about your business."
  - Completion: user initiates a WebRTC call (event listener)

Step 2: "Set Up Alerts" (Telegram)
  - driver.js highlights Telegram setup section in Settings
  - Tooltip: "Connect Telegram to get instant alerts when someone calls."
  - Completion: client.telegram_chat_id is set

Step 3: "Train Your Agent" (Knowledge base)
  - driver.js highlights Knowledge tab in Settings
  - Tooltip: "Add FAQs, upload docs, or paste your website to make your agent smarter."
  - Completion: approved_chunk_count > 0

Step 4: "Go Live" (Upgrade CTA)
  - driver.js highlights upgrade button or call forwarding setup
  - Tooltip: "Ready? Get a phone number and start taking real calls."
  - Completion: client.status === 'active' (paid)
```

### Persistence Schema

```sql
ALTER TABLE client_users
ADD COLUMN onboarding_state jsonb DEFAULT '{
  "tour_completed": false,
  "tour_dismissed": false,
  "steps_completed": [],
  "tour_started_at": null,
  "tour_completed_at": null,
  "last_step_seen": null
}'::jsonb;
```

### Bundle Impact

- driver.js: ~5 KB gzipped (zero dependencies)
- Custom checklist component: ~3 KB (estimate)
- Total: ~8 KB vs 30-50 KB for an all-in-one library
- No Framer Motion dependency (we already have it for other components, but the tour does not need it)

### Mobile Handling

- driver.js overlays work on mobile out of the box
- Checklist renders as a dismissible bottom sheet on viewports < 768px
- Steps that reference desktop-only elements (sidebar) adapt to mobile layout targets

---

## 7. Package Installation

```bash
npm install driver.js
```

That is it. One package, 5 KB, MIT licensed, 25K stars, 394K weekly downloads, vanilla JS with TypeScript definitions, SSR-safe (runs in useEffect only).

---

## Sources

- [npm trends: driver.js vs nextstepjs vs onborda vs react-joyride vs shepherd.js](https://npmtrends.com/driver.js-vs-nextstepjs-vs-onborda-vs-react-joyride-vs-shepherd.js)
- [react-joyride React 19 incompatibility (GitHub #1122)](https://github.com/gilbarbara/react-joyride/issues/1122)
- [NextStepjs official site](https://nextstepjs.com/)
- [Onborda GitHub](https://github.com/uixmat/onborda)
- [OnboardJS GitHub](https://github.com/Somafet/onboardjs)
- [driver.js official site](https://driverjs.com)
- [SaaS Onboarding Best Practices 2025 (Flowjam)](https://www.flowjam.com/blog/saas-onboarding-best-practices-2025-guide-checklist)
- [Why Most Product Tours Fail (Screeb)](https://screeb.app/blog/why-most-product-tours-fail-and-what-you-should-do-instead)
- [10 Onboarding Teardowns from top PLG products (GrowthMates)](https://www.growthmates.news/p/10-onboarding-teardowns-from-top)
- [Vapi Web Calls docs](https://docs.vapi.ai/quickstart/web)
- [Retell AI LLM Playground docs](https://docs.retellai.com/test/llm-playground)
- [5 Best React Onboarding Libraries 2026 (OnboardJS blog)](https://onboardjs.com/blog/5-best-react-onboarding-libraries-in-2025-compared)
- [Product Tour UI/UX Patterns (Appcues)](https://www.appcues.com/blog/product-tours-ui-patterns)
- [SaaS Onboarding Flow: 10 Best Practices (DesignRevision)](https://designrevision.com/blog/saas-onboarding-best-practices)
- [Everybody Hates Product Tours (Userpilot)](https://userpilot.com/blog/everybody-hates-product-tours/)
