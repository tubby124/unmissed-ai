# S12-TOUR1: SaaS Onboarding Tour Research

**Date:** 2026-03-22
**Context:** Research for S12-TOUR1 (interactive onboarding tour for unmissed.ai dashboard)
**Stack:** Next.js 15 App Router, React 19, Tailwind CSS, dark theme, Supabase auth

---

## 1. Library Comparison Matrix

| Metric | react-joyride | driver.js | react-shepherd | NextStepjs | Onborda |
|--------|:------------:|:---------:|:--------------:|:----------:|:-------:|
| **Latest version** | 2.9.3 | 1.4.0 | 7.0.4 | 2.2.0 | 1.2.5 |
| **Weekly npm downloads** | 596,813 | 393,933 | 19,864 | 14,060 | 4,881 |
| **GitHub stars** | 7,616 | 25,505 | 13,679 | 972 | 1,358 |
| **Open issues** | 28 | 112 | 46 | 9 | 17 |
| **Last updated** | 1 year ago | 4 months ago | 10 days ago | 3 months ago | 1 year ago |
| **Unpacked size** | 498 KB | 83 KB | 155 KB (+656 KB core) | 183 KB | 479 KB |
| **Gzipped (est.)** | ~28 KB | ~5 KB | ~18 KB (with core) | ~12 KB | ~15 KB |
| **Dependencies** | 11 runtime deps | 0 | 1 (shepherd.js) | 0 | 0 |
| **React-native?** | React-native | Vanilla JS + wrapper | Wrapper | React-native | React-native |
| **React 19 support** | NO (peerDeps: 15-18) | N/A (vanilla JS) | YES (^18 or ^19) | YES (>=18) | YES (>=18) |
| **Next.js 15 support** | Requires dynamic import + ssr:false | Client component | Yes | Yes (built for it) | Yes (built for it) |
| **TypeScript** | Yes | Yes | Yes | Yes | Yes |
| **Animation engine** | CSS transitions | CSS transitions | Floating UI | Framer Motion | Framer Motion |
| **Styling** | Inline + overrides | CSS classes | CSS classes | Custom cards | Tailwind CSS |
| **License** | MIT | MIT | MIT | MIT | MIT |

### Key findings per library:

**react-joyride** -- DISQUALIFIED for our stack
- Peer dependencies explicitly state `react: 15 - 18`. Does NOT support React 19.
- GitHub issue #1072 documents compilation failure with React 19: `unmountComponentAtNode` and `unstable_renderSubtreeIntoContainer` removed from react-dom.
- A community fork `react-joyride-react-19` exists but is unofficial.
- The `@next` tag has a pre-release with React 19 support but is not stable.
- 11 runtime dependencies (heaviest of all options).
- Despite having the highest npm downloads, the library has not been updated in over a year.
- Verdict: Too risky. Official React 19 support not yet released.

**driver.js** -- LIGHTWEIGHT BUT LIMITED
- Smallest bundle by far (~5 KB gzipped, zero dependencies).
- Vanilla JavaScript -- no React hooks, no React context, no component lifecycle.
- Community React wrapper `driverjs-react` exists (low adoption, ~200 npm downloads/week).
- No built-in cross-page routing (you have to manage navigation yourself).
- No built-in animation engine -- CSS-only transitions.
- Accessibility: keyboard navigation supported but no ARIA attributes documented.
- For Next.js: must be imported in `'use client'` components, instantiated in useEffect.
- Verdict: Best for simple single-page highlights. Too low-level for multi-step guided onboarding.

**react-shepherd** -- MOST ACTIVELY MAINTAINED
- Core library (shepherd.js) updated 10 days ago. Most active maintenance of all options.
- Explicit React 19 support in peer dependencies (`^18.0.0 || ^19.0.0`).
- Built on Floating UI (successor to Popper.js) for positioning.
- Provides React context and hooks via `useContext(ShepherdTourContext)`.
- Supports keyboard navigation, responsive positioning.
- 13.6K GitHub stars (on shepherd-pro organization).
- Requires CSS import for default styling; customizable via CSS classes.
- Verdict: Solid choice. Most mature React integration with active maintenance and React 19 support.

**NextStepjs** -- PURPOSE-BUILT FOR NEXT.JS
- Built from the ground up for Next.js App Router (default adapter, no config needed).
- Zero runtime dependencies (only peer dep: `motion` for animations).
- Cross-page routing built-in via `nextRoute`/`prevRoute` step properties.
- Custom card components for full UI control.
- Event callbacks: `onNextStepStart`, `onNextStepComplete`, `onNextStepSkip`, `onNextStepStepChange`.
- `useNextStep()` hook: `startNextStep(tourName)`, `closeNextStep()`, `currentStep`, `setCurrentStep()`.
- Multiple tour support (can define separate tours for different features).
- Framer Motion animations (we already use framer-motion elsewhere in the app).
- Pages Router needs `esmExternals: true` config; App Router works out of the box.
- Smallest open issue count (9) -- well-maintained for its age.
- Verdict: STRONGEST CANDIDATE. Purpose-built for our exact stack.

**Onborda** -- NEXT.JS NATIVE, LESS ACTIVE
- Also built specifically for Next.js with Framer Motion animations.
- Requires Tailwind CSS (we use it) and @radix-ui/react-portal as peer dep.
- Cross-page routing supported via `nextRoute`/`prevRoute`.
- Multiple tour support (since v1.2.3).
- Custom card components supported.
- MutationObserver for cross-route animations.
- Only 2 contributors. Last updated 1 year ago (Dec 2024).
- No explicit React 19 compatibility tested (peer dep says `>=18` which should work).
- Higher unpacked size (479 KB) than NextStepjs (183 KB).
- Verdict: Good option but less active than NextStepjs. Similar feature set, higher risk of abandonment.

---

## 2. Recommendation: NextStepjs

**Winner: NextStepjs** for these reasons:

1. **Purpose-built for Next.js App Router** -- no SSR workarounds, no dynamic imports, no `ssr: false` hacks
2. **Zero runtime dependencies** -- only Framer Motion as peer dep (which we already use)
3. **Cross-page routing built-in** -- critical for our multi-page onboarding flow
4. **Custom card components** -- we can match our dark theme exactly
5. **Event callbacks** -- we can persist completion to Supabase via `onNextStepComplete`
6. **Multiple tours** -- we can have a "first login" tour, a "post-setup" tour, a "knowledge base" tour
7. **Active maintenance** -- low issue count (9), updated 3 months ago
8. **Lightweight** -- 183 KB unpacked, ~12 KB gzipped

**Runner-up: react-shepherd** -- more mature (13.6K stars), explicit React 19 support, but not Next.js-native (requires more boilerplate for cross-page routing).

**Avoid: react-joyride** -- React 19 incompatible. Despite highest downloads, it's stale.

---

## 3. Integration Architecture for unmissed.ai

### 3.1 Installation

```bash
npm install nextstepjs motion
```

(`motion` is the Framer Motion v11+ package name. If we already have `framer-motion`, check if `motion` is the same or a rename.)

### 3.2 Provider Setup (layout.tsx)

```tsx
// src/app/layout.tsx or src/app/dashboard/layout.tsx
import { NextStepProvider, NextStep } from 'nextstepjs';

// Wrap the dashboard layout only (not public pages)
<NextStepProvider>
  <NextStep steps={tourSteps}>
    {children}
  </NextStep>
</NextStepProvider>
```

### 3.3 Tour Definition

```tsx
// src/lib/tour-steps.ts
import { Tour } from 'nextstepjs';

export const dashboardTour: Tour = {
  tour: 'welcome',
  steps: [
    {
      icon: '1',
      title: 'Meet Your Agent',
      content: 'This is your AI receptionist. It answers calls, takes messages, and books appointments -- 24/7.',
      selector: '#agent-card',
      side: 'bottom',
    },
    {
      icon: '2', 
      title: 'Test Your Agent',
      content: 'Click here to have a live conversation with your agent. Try asking it about your business.',
      selector: '#test-agent-button',
      side: 'right',
      nextRoute: '/dashboard/settings', // cross-page navigation
    },
    {
      icon: '3',
      title: 'Train Your Agent',
      content: 'Add FAQs, upload documents, or paste your website URL. The more you add, the smarter your agent gets.',
      selector: '#knowledge-tab',
      side: 'bottom',
    },
    {
      icon: '4',
      title: 'Go Live',
      content: 'Ready for real calls? Upgrade to connect a phone number and start receiving calls.',
      selector: '#upgrade-cta',
      side: 'left',
    },
  ],
};
```

### 3.4 Persistence Strategy (Supabase)

None of these libraries include built-in persistence. We need to build it.

**Option A: Supabase `client_users` table (recommended)**

Add columns to `client_users`:
- `onboarding_tour_completed_at` (timestamptz, nullable)
- `onboarding_tour_step` (integer, default 0)
- `onboarding_tour_dismissed` (boolean, default false)

On `onNextStepComplete` callback:
```tsx
const handleTourComplete = async () => {
  await supabase.from('client_users').update({
    onboarding_tour_completed_at: new Date().toISOString(),
  }).eq('user_id', userId);
};
```

On dashboard load:
```tsx
const { data } = await supabase.from('client_users')
  .select('onboarding_tour_completed_at, onboarding_tour_dismissed')
  .eq('user_id', userId)
  .single();

if (!data?.onboarding_tour_completed_at && !data?.onboarding_tour_dismissed) {
  startNextStep('welcome');
}
```

**Option B: localStorage (quick fallback)**

```tsx
if (!localStorage.getItem('tour_welcome_completed')) {
  startNextStep('welcome');
}
// On complete:
localStorage.setItem('tour_welcome_completed', new Date().toISOString());
```

Downside: doesn't persist across devices. For trial users who test on desktop then switch to phone, the tour would replay.

**Recommendation:** Use Supabase for the completion flag (server-persisted, cross-device) and localStorage for the current step index (so refreshing mid-tour doesn't restart).

### 3.5 Custom Card Component (Dark Theme)

```tsx
// src/components/onboarding/TourCard.tsx
'use client';

interface TourCardProps {
  step: { title: string; content: string; icon: string };
  currentStep: number;
  totalSteps: number;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
}

export function TourCard({ step, currentStep, totalSteps, nextStep, prevStep, skipTour }: TourCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 shadow-2xl max-w-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-zinc-400">Step {currentStep + 1} of {totalSteps}</span>
        <button onClick={skipTour} className="text-xs text-zinc-500 hover:text-zinc-300">
          Skip tour
        </button>
      </div>
      <h3 className="text-white font-semibold text-lg mb-2">{step.title}</h3>
      <p className="text-zinc-400 text-sm mb-4">{step.content}</p>
      <div className="flex gap-2">
        {currentStep > 0 && (
          <button onClick={prevStep} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white">
            Back
          </button>
        )}
        <button onClick={nextStep} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg ml-auto">
          {currentStep === totalSteps - 1 ? 'Done' : 'Next'}
        </button>
      </div>
    </div>
  );
}
```

---

## 4. Onboarding UX Patterns Research

### 4.1 What works (data-backed)

| Pattern | Impact | Source |
|---------|--------|--------|
| Onboarding checklist completion | 3x more likely to become paying customers | UserGuiding 2026 |
| Interactive product tours | 42% increase in feature adoption | UserGuiding 2026 |
| Personalized onboarding | 40% higher retention vs generic | UserGuiding 2026 |
| Quick win in onboarding | 80% more users retained | UserGuiding 2026 |
| Timely tooltips | 30% higher retention | UserGuiding 2026 |
| Users who don't engage in first 3 days | 90% chance of churning | UserGuiding 2026 |
| Behavioral triggers vs calendar | 67% higher conversion | 1Capture / shno.co |
| 7-day trials | 40.4% conversion (vs 30.6% for 61+ days) | Userpilot |
| Opt-out trials (CC required) | 48.8% conversion | Userpilot |
| Opt-in trials (no CC) | 18.2% conversion | Userpilot |

### 4.2 Three patterns ranked by effectiveness

**1. Progressive Checklist (BEST for our use case)**

What Notion, Asana, and HubSpot do:
- Present a 4-6 item checklist on first login
- Auto-detect organically completed steps (don't force users to redo things)
- Show progress bar with percentage
- Add time estimates per step ("2 min" reduces cognitive resistance)
- Dismissible but recoverable via persistent sidebar widget

Why it works for unmissed.ai:
- Our dashboard HAS a "GET STARTED" checklist already (S12-V18 confirmed it renders)
- Trial users need to complete specific actions: test agent, add knowledge, connect Telegram
- Each completed step directly increases the agent's value (real activation metric)

**2. Action-First Empty States (COMPLEMENT to checklist)**

What Notion and Stripe do:
- Empty states aren't blank pages -- they ARE the onboarding
- Each empty section shows: what it's for, one clear CTA, a preview of what populated state looks like
- "Users encounter empty states more often than any onboarding modal or tooltip tour"

Why it works for unmissed.ai:
- Trial dashboard currently shows empty calls list, empty knowledge base, no notifications
- Each empty state should have a contextual CTA: "No calls yet -- Test your agent with the orb above"
- Knowledge base empty state: "Your agent starts smart and gets smarter. Add FAQs, upload documents, or paste a URL."

**3. Short Guided Tour (4 steps max) -- ON FIRST LOGIN ONLY**

What Slack and Canva do:
- 3-4 card tour AFTER user context is collected (we have intake data)
- Brief, friendly language
- Points at real UI elements (not overlays or modals)
- Ends with an action CTA, not just "Got it"

Why it works for unmissed.ai:
- Trial user lands on dashboard for first time -- needs orientation
- 4 steps: "Your agent" -> "Test it" -> "Train it" -> "Go live"
- Tour fires once, then the checklist takes over as persistent guide

### 4.3 When to show the tour

| Trigger | Action | Rationale |
|---------|--------|-----------|
| First login after trial activation | Show 4-step welcome tour | User needs orientation |
| Tour completed OR dismissed | Show persistent checklist widget | Long-term activation driver |
| Tour dismissed | Never show tour again | Respect user choice |
| 3+ days with tour not started | Send Telegram/email nudge | Re-engage before churn window |
| All checklist items complete | Show upgrade CTA celebration | Conversion moment |
| Feature first-use | Show contextual 1-step tooltip | Progressive disclosure |

### 4.4 Handling skip/dismiss

- **Skip button visible on every step** ("Skip tour" in subtle text, not primary button)
- **On skip:** persist `onboarding_tour_dismissed: true` to Supabase
- **Never replay dismissed tour** -- user chose to skip, respect that
- **Checklist is separate** -- even if tour is dismissed, checklist persists in sidebar
- **"Restart tour" option** in help menu or settings -- user can voluntarily replay
- **Don't count skip as failure** -- track it, but the checklist is the real activation metric

### 4.5 What top products do

**Notion:**
- Single routing question at signup ("personal/team/school") reshapes entire experience
- 6-card welcome tour with integrated task checklist INSIDE the product
- Empty states show warm copy with keyboard shortcuts and template suggestions
- Progressive disclosure: features appear as usage patterns signal readiness

**Linear:**
- Minimal tour -- trusts power users to explore
- Command palette revealed when usage signals readiness (not day one)
- Feature announcements triggered by behavior, not calendar
- Contextual keyboard shortcut suggestions during natural use

**Slack:**
- 4-card intro tour after workspace setup
- Collects context (email, company, project, colleagues) BEFORE tour
- Friendly, brief language
- Immediate platform access after short tour

**Stripe Dashboard:**
- Empty integration page IS the onboarding -- walks through first setup step-by-step with inline code
- Zero modal tours -- everything is contextual within the page
- Documentation links embedded where relevant

**Key takeaway:** The trend in 2025-2026 is AWAY from modal overlay tours and TOWARD contextual empty states + progressive checklists. Modal tours are the "last resort" for complex products. For our use case (relatively simple dashboard), the checklist + empty state pattern is more effective than a traditional guided tour.

---

## 5. Implementation Recommendation for unmissed.ai

### What to build (in priority order):

**Phase A: Progressive Checklist (S12-TOUR2 prerequisite)**
1. Enhance existing "GET STARTED" checklist on dashboard
2. Auto-detect completed steps (connected Telegram? Has knowledge docs? Tested agent?)
3. Show progress bar (0/5 complete)
4. Time estimates per step
5. Persist completion to `client_users` table
6. Celebration state when all complete ("Your agent is fully trained -- upgrade to go live")

**Phase B: Contextual Empty States (S12-TOUR3)**
1. Replace every "no data" state with actionable empty state
2. Calls: "No calls yet -- Test your agent" with orb CTA
3. Knowledge: "Make your agent smarter" with upload/URL CTA
4. Notifications: "Stay in the loop" with Telegram setup CTA
5. Bookings: "Connect your calendar" with Google OAuth CTA

**Phase C: Welcome Tour (S12-TOUR2, only if needed)**
1. Use NextStepjs with custom dark-themed card component
2. 4 steps: Agent -> Test -> Train -> Upgrade
3. First login only, persisted to Supabase
4. Skip button, never replays
5. Ends with starting the checklist

**Phase D: Feature-Specific Tooltips (everboarding)**
1. On first visit to Settings: "This is where you customize your agent's personality"
2. On first knowledge upload: "Great! Your agent now knows about [topic]"
3. On first call received: "Here's your first real call -- check the transcript"
4. Triggered by behavior, not calendar

### What NOT to build:
- No long multi-page guided tours (data shows these hurt more than help)
- No forced tours that block the UI (always skippable)
- No video tutorials embedded in tooltips (our product is simple enough)
- No third-party paid tools (Appcues, Userpilot, UserGuiding) -- our needs are simple
- No AI-guided onboarding chatbot (over-engineered for 4 clients)

---

## 6. Sources

### Library Documentation
- [react-joyride npm](https://www.npmjs.com/package/react-joyride) -- v2.9.3, 596K weekly downloads
- [react-joyride GitHub](https://github.com/gilbarbara/react-joyride) -- 7.6K stars, React 19 issue #1072
- [react-joyride React 19 compilation failure](https://github.com/gilbarbara/react-joyride/issues/1072)
- [driver.js](https://driverjs.com) -- ~5KB gzipped, zero deps
- [driver.js GitHub](https://github.com/kamranahmedse/driver.js) -- 25.5K stars
- [driverjs-react wrapper](https://github.com/gnvcor/driverjs-react)
- [react-shepherd npm](https://www.npmjs.com/package/react-shepherd) -- v7.0.4, React 19 support
- [shepherd.js docs](https://docs.shepherdjs.dev/) -- v15.2.2, updated 10 days ago
- [NextStepjs](https://nextstepjs.com/) -- v2.2.0, built for Next.js App Router
- [NextStepjs GitHub](https://github.com/enszrlu/NextStep) -- 972 stars
- [Onborda](https://www.onborda.dev/) -- v1.2.5, Framer Motion + Tailwind
- [Onborda GitHub](https://github.com/uixmat/onborda) -- 1.4K stars, last commit Dec 2024

### Comparison Data
- [npm trends: all 5 libraries](https://npmtrends.com/driver.js-vs-react-joyride-vs-react-shepherd-vs-nextstepjs-vs-onborda)
- [Best Open-Source Product Tour Libraries](https://userorbit.com/blog/best-open-source-product-tour-libraries)
- [5 Best React Onboarding Libraries 2026](https://onboardjs.com/blog/5-best-react-onboarding-libraries-in-2025-compared)
- [Top Libraries for Product Tours](https://medium.com/dogus-teknoloji/top-libraries-for-product-tours-highlights-5976077cb3bf)

### UX Patterns & Conversion Data
- [SaaS Onboarding Flows That Convert 2026](https://www.saasui.design/blog/saas-onboarding-flows-that-actually-convert-2026)
- [100+ User Onboarding Statistics 2026](https://userguiding.com/blog/user-onboarding-statistics)
- [Mastering Product Tour UI/UX](https://productfruits.com/blog/product-tour-ui)
- [SaaS Free Trial Conversion Benchmarks](https://userpilot.com/blog/saas-average-conversion-rate/)
- [SaaS Trial Optimization Checklist (67% increase)](https://www.1capture.io/blog/free-trial-optimization-checklist)
- [Free Trial Conversion Statistics 2026](https://www.shno.co/marketing-statistics/free-trial-conversion-statistics)
- [SaaS Onboarding Best Practices 2025](https://www.flowjam.com/blog/saas-onboarding-best-practices-2025-guide-checklist)
- [User Onboarding Best Practices 2026](https://formbricks.com/blog/user-onboarding-best-practices)
- [8 Effective SaaS Onboarding Experiences](https://www.appcues.com/blog/saas-user-onboarding)

### Persistence Patterns
- [OnboardJS Supabase Persistence Plugin](https://docs.onboardjs.com/plugins/supabase)
- [React Joyride Callback Docs](https://docs.react-joyride.com/callback)
- [OnboardJS Next.js Getting Started](https://onboardjs.com/blog/nextjs-onboarding-onboardjs-getting-started)
