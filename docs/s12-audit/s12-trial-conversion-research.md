# S12 Trial Conversion & In-App Testing Research

**Date:** 2026-03-22
**Purpose:** Data-driven research for S12 Phase 3c implementation decisions
**Source:** Sonar Pro + web research across 15+ sources

---

## 1. In-App Demo / Test Call Patterns from Voice and Bot Platforms

### How competitors let users test their agent from the dashboard

**Intercom** uses a two-phase approach. After building a chatbot workflow, users click a "Preview" button that opens an interactive Messenger window. A dedicated "Preview User" persona simulates the customer side. Conversations appear in the actual Inbox so the builder sees exactly what support agents would see. Intercom's guided setup literally requires users to send a test message before they can proceed to the next onboarding step -- the test IS the onboarding gate.

**Vapi** provides a WebRTC-based web widget. Users embed a `Talk to Assistant` button (teal, pulsing animation) that expands into a full real-time voice conversation interface with transcript bubbles, role-based coloring (user = right-aligned teal, assistant = dark gray), and animated pulse feedback during speech. The widget is built for React/Next.js and works in development mode for testing before production. The key pattern: a single button that expands into a full conversation UI with minimal friction.

**Retell AI** takes the "live call to your phone" approach. Their homepage has a "Try Our Live Demo" flow where users select a scenario (Receptionist, Appointment Setter, Lead Qualification, Customer Service, Debt Collection, Survey), enter their phone number, and receive an actual outbound call from the AI agent. They also offer "Built-in Simulation Testing" in the dashboard for testing across scenarios before deployment.

**Aircall** lets admins configure an AI Voice Agent directly from the dashboard (name, voice, tone selection, company context), then test it within call flow "Smartflows" -- a drag-and-drop builder where the agent is one widget in a larger routing flow. Testing is embedded in the configuration experience, not separate.

### Pattern for unmissed.ai

The strongest pattern across all competitors is **in-context testing** -- users test the agent from the same interface where they configure it. Not a separate page, not a link to click somewhere else. The test IS part of the setup flow.

Our existing WebRTC orb component on the `/try` page already has this mechanic working. The gap is that it points at demo agents, not the user's own agent. Repointing it at `ultravox_agent_id` from the user's client row is the minimum viable path to S12-TRIAL1.

---

## 2. Trial-to-Paid Conversion Benchmarks

### Hard numbers from 10,000+ SaaS companies analyzed

| Metric | Median | Top Quartile | Elite (Top 1%) |
|--------|--------|-------------|----------------|
| B2B SaaS trial-to-paid | 18.5% | 35-45% | 60%+ |
| Bottom quartile | 8-12% | -- | -- |

### By trial type (86 SaaS companies, Q1 2022 - Q3 2025)

| Model | Visitor-to-Trial | Trial-to-Paid |
|-------|------------------|---------------|
| Opt-in (no card) | 8.5% organic | 18.2% |
| Opt-out (card required) | 2.5% organic | 48.8% |
| Freemium | 13.3% organic | 2.6% |

Source: First Page Sage

### By trial length

| Duration | Adoption | Conversion | Peak Engagement |
|----------|----------|-----------|-----------------|
| 7 days | 22% of SaaS | 24% | Day 3-4 |
| 14 days | 51% of SaaS | 19% | Day 8-10 |
| 30 days | 15% of SaaS | 14% | Day 18-22 |

**Shorter trials (7-14 days) with urgency outperform longer trials by 71%.**

### By ACV (relevant to $77/mo tier)

| ACV Range | Median Conversion | Top Quartile |
|-----------|------------------|-------------|
| Under $500 (our tier) | 22% | 40% |
| $500-$2K | 18% | 32% |
| $2K-$5K | 15% | 28% |

### Activation Rate = #1 Predictor

| Activation Rate | Conversion Rate |
|-----------------|----------------|
| Below 20% | 3-5% |
| 20-40% | 10-15% |
| 60-80% | 28-38% |
| Above 80% | 45-65% |

**Every 10% increase in activation drives 6-10% higher trial conversion.**

### Time to First Value (TTFV)

| TTFV Tier | Companies | Impact |
|-----------|-----------|--------|
| Under 2 minutes | Elite (top 1%) | 60%+ conversion |
| 8-12 minutes | Top quartile | 35-45% |
| 22 minutes | Median | 18.5% |
| Every 10-min delay | -- | Costs 8% in conversion |

---

## 3. "Aha Moment" Design — Specific Examples

| Product | Aha Moment | How They Engineer It | Activation Definition |
|---------|-----------|---------------------|-----------------------|
| **Calendly** | User books a test meeting with themselves | Sign in with Google (1-click calendar sync), then prompted to self-book | 5 meetings booked |
| **Slack** | Team sends 2,000 messages | Onboarding immediately prompts adding team members | 2,000 messages in workspace |
| **Loom** | User records and shares first video | Pre-loaded onboarding videos (uses Loom to teach Loom) | First video created + shared |
| **Typeform** | User sees first survey responses | Template selection for instant personalization | First form sent + first response |
| **Intercom** | User sends test message in preview mode | Preview mode IS a setup requirement | First workflow set live |
| **Canva** | User creates first design | 4-step tooltip sequence | First design completion |
| **Grubhub** | Full page of restaurants appears | Address entry with no login required — value before account | Address entered, restaurants displayed |
| **Airbnb** | User browses matching listings | Delays signup form until AFTER user discovers a property | First search with results viewed |

### Critical design principles from the data

1. **Aha-first, not signup-first.** Show value BEFORE requiring configuration.
2. **The aha moment must be the PRODUCT itself.** Loom uses Loom. Intercom requires chatting with the bot. For voice AI: **hearing your own AI agent answer correctly.**
3. **Time matters exponentially.** 3-step tours: 72% completion. 5-step tours: 21% completion. 92% of users close welcome tours immediately.
4. **Multiple aha moments > one big moment.** Hearing the greeting (mini aha) → having a real conversation (medium aha) → seeing the post-call summary with classification + notification (big aha).

### Our Aha Moment Definition

> **The user talks to their own AI agent from the dashboard and hears it correctly use their business name, services, and personality.**

**Activation definition to track:** "User completes at least one in-dashboard test call within first 24 hours."

---

## 4. Feature Gating UX Patterns

### Pattern A: "Read free, write paid" (BEST for our use case)
Users can VIEW all features. Paywall triggers only on WRITE actions.
- Trial users CAN: hear their agent, edit prompt, add knowledge docs, view call logs, see analytics
- Trial users CANNOT: get a phone number, forward calls, send SMS follow-ups, use transfer
- The gate appears when they try to DO the paid thing, not when they look at it

### Pattern B: "Upgrade to unlock" at point of need (Slack, Canva)
Show the feature, let users interact up to a threshold, then gate. "SMS follow-ups require a phone number. Upgrade to get one."

### Pattern C: Contextual upgrade banner (not blocking)
Non-intrusive prompts appear only at premium features. Informational, not blocking.

### Pattern D: Usage-based gating with progress visibility
"You've used 2 of 3 free test calls this week." Natural urgency without hard blocking.

### Anti-patterns to avoid
- Hard locking entire sections — kills curiosity
- Aggressive modal popups — creates resentment
- Static lock icons with no context — doesn't communicate value
- Gating security or reporting — unpredictable for users

---

## 5. Post-Test CTA Optimization

### What to show after a user tests their agent

**Step 1: Show results, not a paywall (immediate)**
- AI summary of the conversation (proves intelligence)
- Lead classification result (proves business value)
- "Telegram alert sent" confirmation (proves notification pipeline)
- Caller phone number captured (proves lead capture)

**Step 2: Social proof at conversion moment**
- "Hasan's agent handled 185 calls this month" (real data)
- "Average response time: under 1 second"
- Specific outcome: "4 bookings, 12 warm leads captured"

**Step 3: Intent-matched CTA (not generic)**

| Generic (bad) | Contextual (good) | Conversion lift |
|--------------|-------------------|----------------|
| "Start Free Trial" | "Test Campaign Builder" | +23% |
| "Start Free Trial" | "Audit Your Stack" | +41% |
| "Start Free Trial" | "ROI Calculator" | +58% |

Intent-matched CTAs convert **38% more** than generic "Start Free Trial."

For our product:
> "Your agent just handled that call. Get a phone number so real callers can reach it."
> [Get My Phone Number - $77/mo]

**Step 4: "Share with team" viral loop (S12-TRIAL1c)**
Shareable test link → anyone tests the agent via WebRTC, no login. Calendly model: product spreads through usage.

**Step 5: Trial expiration urgency (last 2-3 days)**
"Your agent handled 3 test calls. It goes offline in 48 hours."

---

## 6. Onboarding Tour Library Findings

### Tour completion rates

| Steps | Completion Rate |
|-------|----------------|
| 3 steps | 72% |
| 5 steps | 21% |
| Welcome tours (any) | 8% survive (92% close immediately) |

### Library recommendation from this research

| Library | Stars | Bundle | React 19 | Maintained | Notes |
|---------|-------|--------|----------|------------|-------|
| driver.js | 25K | 5 KB | N/A (vanilla) | Yes | Lightest, zero deps |
| Shepherd.js | 13K | ~30 KB | Yes (wrapper) | Active | Popper.js positioning, React/Vue/Angular wrappers |
| React Joyride | 7K | ~35 KB | **No** (9 months stale) | Stale | NOT React 19 compatible |
| NextStepjs | 972 | 12 KB | Yes | Active | Next.js native, small community |

**This research recommends Shepherd.js** over React Joyride. However, the existing decision doc (`s12-tour-library-decision.md`) recommends **driver.js** over NextStepjs. Both are valid — driver.js is lightest, Shepherd.js has stronger positioning. React Joyride should be eliminated (React 19 incompatible).

**NOTE:** This introduces a third option. User decision still needed between driver.js (5KB, vanilla) vs Shepherd.js (30KB, Popper.js positioning) vs NextStepjs (12KB, Next.js native).

---

## 7. Implementation Priority (data-driven)

| Priority | Item | Why | Expected Impact |
|----------|------|-----|----------------|
| 1 | In-dashboard WebRTC test (S12-TRIAL1) | Every 10-min delay costs 8% conversion | +30-50% activation |
| 2 | Post-test results display | Social proof at conversion moment | +15-25% trial-to-paid |
| 3 | Shareable test link (S12-TRIAL1c) | Viral loop. Calendly model. | 1.5-2x trial signups |
| 4 | "Read free, write paid" gating | Users see value before paywall | +20% activation |
| 5 | 7-day trial with countdown | 71% higher conversion than 30-day | +10-15% conversion |
| 6 | Intent-matched post-test CTA | "Get your phone number" not "Upgrade" | +10% conversion |

---

## Sources

- [First Page Sage - SaaS Free Trial Conversion Rate Benchmarks](https://firstpagesage.com/seo-blog/saas-free-trial-conversion-rate-benchmarks/)
- [1Capture - Free Trial Conversion Benchmarks 2025](https://www.1capture.io/blog/free-trial-conversion-benchmarks-2025)
- [Product Led Alliance - 9 Aha Moments](https://www.productledalliance.com/9-aha-moments-to-inspire-your-user-design/)
- [Appcues - Aha Moment Guide](https://www.appcues.com/blog/aha-moment-guide)
- [Chameleon - Successful User Onboarding](https://www.chameleon.io/blog/successful-user-onboarding)
- [OpenView - SaaS Viral Loops](https://openviewpartners.com/blog/saas-product-viral-loop/)
- [Sankalp Jonna - Paywall Trigger Points](https://www.sankalpjonna.com/posts/finding-the-right-point-in-your-ux-to-trigger-a-paywall)
- [SmartSaaS - Feature Paywalls](https://smartsaas.works/blog/post/saas-feature-paywalls-are-killing-your-margins/189)
- [Beyond Labs - Trial to Paid Tactics](https://beyondlabs.io/blogs/how-to-turn-free-trial-users-into-paying-saas-customers)
- [Vapi Web Calls Docs](https://docs.vapi.ai/quickstart/web)
- [Retell AI](https://www.retellai.com)
- [Intercom - Preview Workflows](https://www.intercom.com/help/en/articles/7836467-preview-and-set-workflows-live)
- [Aircall AI Voice Agent](https://aircall.zendesk.com/hc/en-gb/articles/25979264664221-Aircall-s-AI-Voice-Agent-overview)
- [OnboardJS - React Libraries Compared](https://onboardjs.com/blog/5-best-react-onboarding-libraries-in-2025-compared)
- [Sandro Roth - Tour Libraries Evaluation](https://sandroroth.com/blog/evaluating-tour-libraries/)
- [Grafit Agency - CRO Best Practices](https://www.grafit.agency/blog-post/conversion-rate-optimization-best-practices)
- [Medium - Asim Arman on CTA Optimization](https://medium.com/@asimarman007/how-i-transformed-saas-trial-conversions-by-changing-one-button-d745af6ed25f)
