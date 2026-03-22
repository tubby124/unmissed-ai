# S12 Audit — Track A1 + A6: Public Pages Visual Audit

**Date:** 2026-03-21
**Auditor:** Claude (automated Playwright CLI)
**Production URL:** https://unmissed-ai-production.up.railway.app
**Viewports:** 1440x900 (desktop), 768x1024 (tablet), 390x844 (mobile)
**Screenshot dir:** `docs/s12-audit/screenshots/`

---

## Summary

- **14 pages** screenshotted at **3 viewports each** = **42 screenshots** captured
- **All 14 pages return HTTP 200** -- no 404s or server errors
- **Zero console errors, warnings, page errors, or network errors** across all pages
- **3 CRITICAL visual bugs** found (pricing hero, login form, pricing tablet navbar)
- **1 MEDIUM visual issue** found (heading contrast on privacy/terms/demo)

---

## Page-by-Page Results

### 1. Landing Page (`/`)
| Viewport | Screenshot | Status |
|----------|-----------|--------|
| Desktop | `landing-1440.png` | OK |
| Tablet | `landing-768.png` | OK |
| Mobile | `landing-390.png` | OK |

**Notes:** Renders well at all viewports. Full-page scroll captured. Sections visible: hero with phone input + demo card, "See it in action" with phone mockup, "Four steps" process, "I work in..." industry selector, pricing preview, FAQ accordion, CTA footer. Mobile hamburger menu present. Phone FAB (purple call button) visible in bottom-left corner.

---

### 2. Pricing Page (`/pricing`) -- CRITICAL
| Viewport | Screenshot | Status |
|----------|-----------|--------|
| Desktop | `pricing-1440.png` | BUG |
| Tablet | `pricing-768.png` | BUG (CRITICAL) |
| Mobile | `pricing-390.png` | BUG |
| Desktop full | `pricing-1440-fullpage.png` | Partial render |

**CRITICAL BUG — Hero black rectangle:** The top ~50% of the viewport shows a large solid black rectangle. This is likely a video element, canvas animation, or dark gradient hero that renders as pure black in headless Chromium (no GPU/WebGL). On a real browser it may render correctly, but needs manual verification.

**CRITICAL BUG — Tablet (768px) navbar overflow:** At 768px width, the desktop navbar does NOT collapse to hamburger menu. All nav items ("How It Works", "Pricing", "Industries", "Try Free", dark mode toggle, "Log In", "Sign Up Free") are crammed into the bar with text wrapping ("How It / Works", "Log / In", "Sign Up / Free"). This is a serious responsive breakpoint bug -- the hamburger trigger should activate at a wider breakpoint (likely `md` / 768px should use mobile nav, not desktop nav).

**Content below the fold (full-page screenshot):** Below the black hero, pricing content IS present:
- Single plan card: **$75/mo** (partially visible, text very small/faded)
- "$29/mo sounds cheap. Until the phone rings" comparison section
- Competitor pricing table (Dialzara, Rosie, My AI Front Desk, Smith.AI, Davinci, Ask Benny, unmissed.ai)
- "How we stack up" feature comparison matrix
- "The honest comparison" (Part-time receptionist vs Human receptionist vs Answering service vs unmissed.ai)
- "Find out what missed calls are costing you" calculator
- FAQ section
- "Is unmissed.ai right for you?" qualification checklist
- CTA: "Ready to stop missing calls?"
- Full site footer

---

### 3. Login Page (`/login`) -- CRITICAL
| Viewport | Screenshot | Status |
|----------|-----------|--------|
| Desktop | `login-1440.png` | BUG |
| Tablet | `login-768.png` | BUG |
| Mobile | `login-390.png` | BUG |

**CRITICAL BUG — Login form not rendering:** The page shows the Supabase Auth wrapper (dark theme) with:
- "Back to unmissed.ai" link
- 5 stars + "8,400+ calls handled by unmissed.ai"
- unmissed.ai logo
- "Secured by Supabase Auth - unmissed.ai" footer

But the **actual login form (email/password fields, Google OAuth button, submit button) is completely missing**. The entire center of the page is empty dark space. This is likely the Supabase Auth UI component failing to hydrate in headless mode, OR the form elements are rendering but invisible against the dark background. **Needs manual browser verification -- if this is what real users see, nobody can log in.**

---

### 4. Onboard Page (`/onboard`)
| Viewport | Screenshot | Status |
|----------|-----------|--------|
| Desktop | `onboard-1440.png` | OK |
| Tablet | `onboard-768.png` | OK |
| Mobile | `onboard-390.png` | OK |

**Notes:** Clean 6-step wizard (step 1 of 6: "YOUR INDUSTRY"). Shows business search input, 12 industry buttons (Auto Glass Shop, HVAC, Plumbing, Dental Office, Law Firm, Salon/Barbershop, Real Estate Agent, Property Management, Voicemail/Message Taking, Restaurant/Food Service, Print Shop, Other Business), website URL field, Back/Continue navigation. Mobile layout stacks industry buttons vertically -- works well.

---

### 5. For Realtors (`/for-realtors`)
| Viewport | Screenshot | Status |
|----------|-----------|--------|
| Desktop | `for-realtors-1440.png` | OK |
| Tablet | `for-realtors-768.png` | OK |
| Mobile | `for-realtors-390.png` | OK |

**Notes:** Strong niche page. "Your AI that handles calls while you show properties." Hero with Telegram lead card mockup (WARM LEAD badge). Social proof: "Proven: 2,082 calls handled for Hasan Sharif at eXp Realty". Two CTAs: "Get My Realtor Agent" + "Hear a Demo Call". Stats bar: 2,082 / $12,000+ / 24/7. Mobile: CTAs stack to full-width buttons, Telegram card moves below copy. Clean.

---

### 6. For Auto Glass (`/for-auto-glass`)
| Viewport | Screenshot | Status |
|----------|-----------|--------|
| Desktop | `for-auto-glass-1440.png` | OK |
| Tablet | `for-auto-glass-768.png` | OK |
| Mobile | `for-auto-glass-390.png` | OK |

**Notes:** "Stop losing windshield jobs to voicemail." Telegram card shows HOT LEAD with vehicle/damage/ADAS/urgency fields. Stats: $150-$800 avg job / 3 jobs/week / $93,600 annual risk. CTAs: "Get My Auto Glass Agent" + "Try a Live Demo". Clean across all viewports.

---

### 7. For Plumbing (`/for-plumbing`)
| Viewport | Screenshot | Status |
|----------|-----------|--------|
| Desktop | `for-plumbing-1440.png` | OK |
| Tablet | `for-plumbing-768.png` | OK |
| Mobile | `for-plumbing-390.png` | OK |

**Notes:** "Stop losing emergency jobs to voicemail." Telegram card: burst pipe scenario, Red Deer AB. Stats: $200-$600 / 4 calls/week / $124,800. CTAs: "Get My Plumbing Agent" + "Try a Live Demo". Clean.

---

### 8. For HVAC (`/for-hvac`)
| Viewport | Screenshot | Status |
|----------|-----------|--------|
| Desktop | `for-hvac-1440.png` | OK |
| Tablet | `for-hvac-768.png` | OK |
| Mobile | `for-hvac-390.png` | OK |

**Notes:** "Stop losing emergency calls to voicemail." Telegram card: furnace failure, Edmonton AB. Stats: $200-$800 / 5+ calls/week / $156,000. Clean.

---

### 9. For Dental (`/for-dental`)
| Viewport | Screenshot | Status |
|----------|-----------|--------|
| Desktop | `for-dental-1440.png` | OK |
| Tablet | `for-dental-768.png` | OK |
| Mobile | `for-dental-390.png` | OK |

**Notes:** "Stop losing new patients to voicemail." Telegram card: WARM LEAD, toothache scenario, Edmonton AB. Stats: $800-$2,000 / 8+ calls/week / $332,800. CTAs: "Get My Dental Agent" + "Try a Live Demo". Clean.

---

### 10. For Legal (`/for-legal`)
| Viewport | Screenshot | Status |
|----------|-----------|--------|
| Desktop | `for-legal-1440.png` | OK |
| Tablet | `for-legal-768.png` | OK |
| Mobile | `for-legal-390.png` | OK |

**Notes:** "Stop losing clients to voicemail." Telegram card: WARM LEAD, employment dispute, Vancouver BC. Stats: $3,000-$10,000 / 6+ calls/week / $936,000. Clean.

---

### 11. Demo Page (`/demo`)
| Viewport | Screenshot | Status |
|----------|-----------|--------|
| Desktop | `demo-1440.png` | MINOR |
| Tablet | `demo-768.png` | OK |
| Mobile | `demo-390.png` | OK |

**MINOR — Heading contrast:** "Hear it before you buy." heading uses very light text (appears white/near-white on the light gray background). Barely readable. The subheading and body text below are fine. This may be intentional (gradient text effect that didn't capture in screenshot) but should be verified in a real browser.

**Content:** "LIVE DEMO" label, industry tabs (Auto Glass, Property Mgmt), phone mockup showing call with "Tyler" from Crystal Clear Auto Glass. "See it in action" section. Mobile layout works well.

---

### 12. Try Page (`/try`)
| Viewport | Screenshot | Status |
|----------|-----------|--------|
| Desktop | `try-1440.png` | OK |
| Tablet | `try-768.png` | OK |
| Mobile | `try-390.png` | OK |

**Notes:** "Talk to an AI agent right now." Three agent cards:
1. **Auto Glass** — Crystal Clear Auto Glass (Tyler) — purple badge
2. **Property Management** — Maple Ridge Property Management (Nicole) — green badge
3. **Real Estate** — Hasan Sharif - EXP Realty (Aisha) — green badge

Each card shows niche tag, business name, description, and "tap to start" prompt. Clean layout at all viewports. Mobile stacks cards vertically.

---

### 13. Privacy Policy (`/privacy`)
| Viewport | Screenshot | Status |
|----------|-----------|--------|
| Desktop | `privacy-1440.png` | MINOR |
| Tablet | `privacy-768.png` | OK |
| Mobile | `privacy-390.png` | OK |

**MINOR — Heading contrast:** "Privacy Policy" heading appears very faint (white or near-white text on light background). Same issue as demo page -- likely a gradient/colored text effect not rendering in headless. Date shown: "Last updated: March 1, 2026". Content renders fine in the card below. Mobile layout clean.

---

### 14. Terms of Service (`/terms`)
| Viewport | Screenshot | Status |
|----------|-----------|--------|
| Desktop | `terms-1440.png` | MINOR |
| Tablet | `terms-768.png` | OK |
| Mobile | `terms-390.png` | OK |

**MINOR — Heading contrast:** Same as privacy -- "Terms of Service" heading barely visible. Date: "Last updated: March 1, 2026". Content renders fine below. Mobile clean.

---

## A6 — Stripe Checkout Path (Visual Only)

**Pricing page CTA buttons observed (from full-page screenshot):**
- "Get My Agent Set Up" (purple button, mid-page after competitor comparison)
- "Start 7-Day Free Trial" (purple button, bottom CTA section)

**Stripe checkout redirect:** NOT tested -- the pricing page hero bug makes it difficult to identify and click the primary pricing CTA in headless mode. The full-page screenshot shows the $75/mo plan card exists but the "Get Started" button on the card was too small/faded to confirm the exact URL.

**A6 recommendation:** Manually navigate to `/pricing` in a real browser, click "Get Started" on the $75/mo plan, and screenshot the Stripe Checkout page. Note: LIVE Stripe keys are configured on production -- do NOT enter card details.

---

## Console Errors Report

**Script:** `docs/s12-audit/console-errors.js`

| Page | HTTP Status | Console Errors | Console Warnings | Page Errors | Network Errors |
|------|:-----------:|:--------------:|:----------------:|:-----------:|:--------------:|
| landing | 200 | 0 | 0 | 0 | 0 |
| pricing | 200 | 0 | 0 | 0 | 0 |
| login | 200 | 0 | 0 | 0 | 0 |
| onboard | 200 | 0 | 0 | 0 | 0 |
| for-realtors | 200 | 0 | 0 | 0 | 0 |
| for-auto-glass | 200 | 0 | 0 | 0 | 0 |
| for-plumbing | 200 | 0 | 0 | 0 | 0 |
| for-hvac | 200 | 0 | 0 | 0 | 0 |
| for-dental | 200 | 0 | 0 | 0 | 0 |
| for-legal | 200 | 0 | 0 | 0 | 0 |
| demo | 200 | 0 | 0 | 0 | 0 |
| try | 200 | 0 | 0 | 0 | 0 |
| privacy | 200 | 0 | 0 | 0 | 0 |
| terms | 200 | 0 | 0 | 0 | 0 |

**Verdict:** Clean -- zero errors across all 14 pages.

---

## Findings Summary

### CRITICAL (3)

| # | Page | Issue | Impact |
|---|------|-------|--------|
| A1-1 | `/pricing` | Hero section renders as solid black rectangle (~50% of viewport). Content exists below the fold but hero is broken. Likely a video/canvas/WebGL element. | Pricing page looks broken on first load -- visitors will bounce. May be headless-only but MUST verify in real browser. |
| A1-2 | `/login` | Supabase Auth UI form fields (email, password, Google OAuth button) do not render. Page shows wrapper chrome but zero interactive elements. | If this reproduces in real browsers, NO user can log in. Dashboard completely inaccessible. |
| A1-3 | `/pricing` (768px) | Navbar does not collapse to hamburger at tablet width. All nav items crammed horizontally with text wrapping ("How It / Works", "Sign Up / Free"). | Broken navigation on iPad and similar tablet-sized screens. |

### MEDIUM (1)

| # | Page | Issue | Impact |
|---|------|-------|--------|
| A1-4 | `/demo`, `/privacy`, `/terms` | Page headings ("Hear it before you buy", "Privacy Policy", "Terms of Service") render in very faint/white text against light background. Likely a gradient text CSS effect that doesn't render in headless screenshots. | May be fine in real browsers (CSS gradient text). Verify manually. If it reproduces, headings are unreadable. |

### Observations (non-bugs)

- **Phone FAB:** Purple phone icon button appears in bottom-left on landing + pricing pages but not on niche/demo/try pages. Inconsistent but may be intentional.
- **Dark mode toggle:** Present in navbar (moon icon) across all pages. Not tested in dark mode -- separate audit recommended.
- **Footer:** Consistent across all pages with company info, nav links (How it Works, Pricing, Get Started), industry links, newsletter signup, and legal links.
- **Niche pages are strong:** All 6 niche pages (realtors, auto-glass, plumbing, hvac, dental, legal) are well-designed with consistent layout, compelling copy, niche-specific Telegram mockups, and clear CTAs. Best pages on the site.
- **Try page is clean:** Agent cards with industry tags and personality avatars. Good UX for no-signup demo experience.

---

## Mobile Responsiveness Summary

| Page | Mobile (390px) | Notes |
|------|:--------------:|-------|
| Landing | PASS | Hamburger menu, stacked layout, full-width CTAs |
| Pricing | FAIL | Black hero + no visible pricing cards in viewport |
| Login | FAIL | No form rendered |
| Onboard | PASS | Industry buttons stack vertically, clean |
| for-realtors | PASS | CTAs stack, Telegram card below copy |
| for-auto-glass | PASS | Clean stack |
| for-plumbing | PASS | Clean stack |
| for-hvac | PASS | Clean stack |
| for-dental | PASS | Clean stack |
| for-legal | PASS | Clean stack |
| Demo | PASS | Phone mockup scales down |
| Try | PASS | Agent cards stack vertically |
| Privacy | PASS | Body text readable |
| Terms | PASS | Body text readable |

**Pass rate:** 12/14 (86%) -- 2 failures are rendering bugs, not responsive design issues.

---

## Screenshot File Index

```
docs/s12-audit/screenshots/
  landing-1440.png          landing-768.png          landing-390.png
  pricing-1440.png          pricing-768.png          pricing-390.png
  pricing-1440-fullpage.png
  login-1440.png            login-768.png            login-390.png
  login-1440-fullpage.png
  onboard-1440.png          onboard-768.png          onboard-390.png
  for-realtors-1440.png     for-realtors-768.png     for-realtors-390.png
  for-auto-glass-1440.png   for-auto-glass-768.png   for-auto-glass-390.png
  for-plumbing-1440.png     for-plumbing-768.png     for-plumbing-390.png
  for-hvac-1440.png         for-hvac-768.png         for-hvac-390.png
  for-dental-1440.png       for-dental-768.png       for-dental-390.png
  for-legal-1440.png        for-legal-768.png        for-legal-390.png
  demo-1440.png             demo-768.png             demo-390.png
  try-1440.png              try-768.png              try-390.png
  privacy-1440.png          privacy-768.png          privacy-390.png
  terms-1440.png            terms-768.png            terms-390.png
```

---

## Next Steps

1. **VERIFY A1-1 and A1-2 in a real browser** -- the pricing hero black box and login form missing may be headless Chromium rendering artifacts. If they reproduce in Chrome/Safari, they are showstoppers.
2. **Fix A1-3 (tablet navbar)** -- increase the responsive breakpoint for hamburger menu activation. Currently the desktop nav renders at 768px, which is too narrow.
3. **Verify A1-4 heading contrast** -- check if gradient text CSS works in real browsers on demo/privacy/terms pages.
4. **A6 Stripe checkout** -- manually test the pricing page CTA flow in a real browser to capture the Stripe Checkout redirect URL and screenshot.
