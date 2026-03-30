# Refactor Phase Tracker (Active)

> Completed phases + full DONE history (including all D## completed items): `docs/refactor-completed-phases.md`
> Master operator prompt: `docs/unmissed-master-operator-prompt.md`

## Cross-Phase Gates (apply to EVERY phase)
- **Sonar Pro Fact-Check:** Run 2-3 Perplexity Sonar Pro queries before and after implementation.
- **Research-First Rule:** Read existing research doc first. If none, run Sonar Pro BEFORE writing code.
- **Conflicting Research:** Flag conflicts to user before proceeding.

---

## P0-LAUNCH-GATE (remaining items only)

### GATE-1 — Auth + Email Deliverability (BLOCKED on domain purchase)
| Item | Status |
|------|--------|
| S15-PRE1-7 | NOT STARTED — domain purchase + DNS + external configs |
| S15-ENV1-4 | NOT STARTED — Railway env var updates after domain |
| S15-CODE1-11 | NOT STARTED — brand text + legal pages + SEO metadata |
| S12-V15 | NOT STARTED — email deliverability E2E |
| S12-LOGIN1 | BLOCKED on S15-PRE3 |
| S12-V22 | NOT STARTED — Supabase email template branding |

### GATE-2 — Remaining Items
| Item | Status |
|------|--------|
| S13-REC2 | NOT STARTED — backfill recording_url from full URLs to paths |
| S16a | NOT STARTED — call recording consent disclosure |

> GATE-3: PASS | GATE-4: PASS | GATE-5: PASS

---

## Execution Order

```
DONE → see docs/refactor-completed-phases.md (D1–D96 + D97-D101, D109 — 2026-03-30)

NEXT (in order — priority tier):

  [SECURITY — do first]
  D124 → Fix QWERTY123 hardcoded default password → magic link post-provision

  [Onboarding intelligence — highest user impact]
  D125 → Niche-aware service pre-seeding (infer-niche returns suggested services)
  D126 → Freeform→structured service intake (paste text → Haiku parses services)
  D127 → FAQ capture during onboarding ("what do callers ask you most?")
  D117 → Empty agent name gate in step 1 canAdvance

  [Dashboard agent readiness]
  D129 → Knowledge pending approval in nextAction strip
  D131 → One-click gap closing from home (TeachAgentCard / nextAction)
  D113 → Mode-aware nextAction nudges (booking vs voicemail vs info-hub)
  D128 → Agent setup score / readiness row on home

  [Google Calendar UX]
  D121 → OAuth redirect → /dashboard with success toast (not /settings generic)

  [Agent smarts]
  D110 → Service catalog inline in onboarding capabilities step
  D112 → Wire client_services into standard prompt regen + provision path

  [Lower priority]
  D98  → VIP contacts outbound path (LOW)
  D56  → Transfer recovery smoke test (manual)
  STRIPE-PORTAL → Configure Stripe Customer Portal (manual — Stripe Dashboard step)
  GATE-1 → Domain migration (BLOCKED on domain purchase)

DEFERRED → S11, S12 advanced phases, S13 LOW, S16a-d, S17-S20
```

---

## Active Discovery Items (NOT STARTED / BLOCKED only)

### Outbound / Scheduled Callbacks
| # | Type | Fix | Priority |
|---|------|-----|----------|
| D98 | GAP | VIP contacts siloed from outbound dialing — no "dial this VIP" button or auto-escalation path. | LOW |

### Onboarding UX
| # | Type | Fix | Priority |
|---|------|-----|----------|
| D117 | BUG | Empty agent name slips past `canAdvance` on step 1 — add `!!d.agentName?.trim()` gate. Agent would say "Hi, I'm " on calls. | HIGH |
| D118 | BUG | DOCX accepted in UI (step 5 file upload) but backend knowledge pipeline doesn't handle it. User uploads Word doc, gets silent failure. Drop `.docx` from accepted types until fixed. | HIGH |
| D119 | UX | GBP hours pasted verbatim as long ugly string in schedule input — `"Monday: 8:00 AM – 6:00 PM, Tuesday: 8:00 AM – 6:00 PM, ..."`. Should condense to `Mon–Fri 8am–6pm` format. | MEDIUM |
| D120 | UX | Booking mode picks step 3 but no calendar connection path exists during onboarding → silent drop-off post-activation. Add post-activation nudge or inline "connect after signup" CTA. | HIGH |
| D121 | UX | FAQ defaults (step 5) show pre-filled questions but blank answer fields. Blank boxes are demotivating. Add placeholder example answers so users see what a good answer looks like. | MEDIUM |
| D122 | UX | No "progress is saved" signal anywhere in the onboarding flow. Users who close the tab think they'll lose everything. One line of copy fixes this. | MEDIUM |
| D123 | UX | Left sidebar value props (`hidden lg:flex`) invisible on mobile. Small business owners filling this on their phone see zero reason to keep going. Show value props on mobile. | MEDIUM |
| D124 | SECURITY | `QWERTY123` hardcoded as default password for auto-login after trial provision (`page.tsx:165`). Wide-open account between provision and user setting their own password. Replace with short-lived magic link. | HIGH |

### Dashboard / UX
| # | Type | Fix | Priority |
|---|------|-----|----------|
| D27 | GAP | No feedback loop for call-time injection fields — consider "preview what agent knows" tile. | LOW |
| D56 | VERIFY | Transfer recovery never live-tested. Smoke test: real call to unanswered forwarding number. | MEDIUM |
| D80 | UX | `info_hub` / restaurant mode onboards with empty `context_data`. Add menu input nudge or post-activation card. | LOW |
| D84 | GAP | No UI visibility of call stage transitions. `call_logs` has no `current_stage`. | LOW |
| D113 | UX | Mode-aware agent readiness nudges — nextAction strip + home tiles don't differentiate by `call_handling_mode`. Booking mode clients see generic "add facts" nudge instead of "connect calendar". | HIGH |
| D116 | **DONE 2026-03-30** | `BookingCalendarTile` 3-state + `calendarConnected` prop + nextAction calendar nudge. | HIGH |

### Agent Intelligence
| # | Type | Fix | Priority |
|---|------|-----|----------|
| D110 | UX | Service catalog onboarding gap — `info_hub`/`appointment_booking` modes onboard with no structured services. Need lightweight inline service entry in onboarding (not a new step — inline addition to capabilities step) so agent knows what it offers from day one. | HIGH |
| D111 | BUG | `.docx` upload fails in knowledge pipeline — mammoth or file type handling missing. Only PDF works reliably. | MEDIUM |
| D112 | GAP | `client_services` table populated by deep-mode rebuild only. Standard prompt regen and first provision at onboarding skip it. Agent is dumb at launch even if services were added post-onboarding. Wire into ALL prompt build paths. | HIGH |
| D114 | FEATURE | Staff/team roster for booking businesses — new `client_staff` DB table (name, role, availability), dashboard editor, prompt injection so agent knows who to book with. | MEDIUM |
| D115 | GAP | Duration-aware calendar booking — `checkCalendarAvailability` doesn't accept service duration; defaults to 1hr slots. Should pass service duration from `client_services` so plumbers don't get 1hr for a 30min job. | MEDIUM |
| D125 | UX | No niche-aware service pre-seeding. Blank form in onboarding → nobody fills it. When niche is detected, `infer-niche` should also return 5-8 suggested services as checkboxes. Owner ticks what applies + adds extras. Zero typing for most cases. | HIGH |
| D126 | UX | No freeform→structured service intake. Owner should paste "We do oil changes, brakes, tires, $30-$400" and Haiku parses it into `client_services` rows. Asking for structured input on 10 services one at a time = they don't. Add a "Paste a description of your services" textarea → parse on blur. | HIGH |
| D127 | UX | Onboarding never asks "what questions do callers ask you most?" — highest-signal FAQ data, lowest friction. Single textarea in step 3/5 → Haiku extracts FAQ pairs → seeds `extra_qa` at provision. Agent goes live knowing the top 5 things callers want to know. | HIGH |
| D128 | UX | No agent setup score or readiness indicator on home. Owner can't tell if agent is 30% or 90% ready. Add compact "Agent readiness" row to home: hours ✓/✗, services ✓/✗, FAQs (N) ◐, calendar ✓/✗, knowledge ✓/✗. Each item links to the fix. Drives action better than generic nudges. | MEDIUM |
| D129 | UX | Knowledge pending approval invisible until owner finds the tile. After website scrape, N pending chunks should appear in `nextAction` strip at same priority as calendar connection. Currently only shows as amber badge on knowledge tile. | HIGH |
| D130 | UX | No "share your number" widget post-activation. Owner gets a Twilio number but no clear path to tell customers about it. Need: number display + copy button + carrier forwarding codes + QR code. Welcome wizard covers forwarding instructions but it's dismissible and one-time. Add persistent card until calls start flowing. | MEDIUM |
| D131 | UX | Gap-closing flow broken. `knowledge_gaps` are captured but closing requires navigating Knowledge > Gaps tab. Add one-click resolution from home: "Caller asked: 'do you offer emergency callouts?' [Add answer]" → single textarea → saves to `extra_qa` + seeds knowledge chunk. Should be in `nextAction` strip or TeachAgentCard. | HIGH |
| D132 | UX | After-hours behavior invisible to owner. Agent tells callers "we're closed" but owner has never heard the exact script. No preview of after-hours handling from the Hours card. First time they hear it is from a confused caller. Add "Preview after-hours message" expand in HoursCard. | MEDIUM |
| D133 | UX | No "simulate a caller question" preview. Owner can test call (full WebRTC), but can't type "what do you charge for a drain cleaning?" and get a response without picking up the phone. Chat-style question preview (queries `business_facts` + `knowledge_chunks` inline) makes agent transparent and builds trust before going live. | MEDIUM |

### Performance / Optimization
| # | Type | Fix | Priority |
|---|------|-----|----------|
| D30 | OPT | Realtime re-render storms — debounce/batch 100-250ms for high-volume clients. | LOW |
| D31 | OPT | Unbounded state arrays — `.slice(0, MAX)` after prepend or virtual scroll. | LOW |

### Features (deferred, low priority)
| # | Type | Fix | Priority |
|---|------|-----|----------|
| D33 | PATTERN | Multi-field prompt patch order: identity→voice→operational with validatePrompt() per step. | LOW |
| D34 | FEATURE | Call sentiment deep metrics — frustration/interruption/silence/satisfaction. | MEDIUM |
| D35 | FEATURE | AI-assisted prompt improvement suggestions from failure patterns. | MEDIUM |
| D36 | FEATURE | Weekly failure digest cron. | LOW |
| D37 | FEATURE | Agent personality coherence warning after 5+ patches. | LOW |
| D39 | FEATURE | Demo GA4 events (`demo_start`, `demo_complete`, `demo_agent_selected`). | MEDIUM |
| D40 | FEATURE | Demo follow-up email via Brevo. BLOCKED on domain. | MEDIUM |
| D41 | FEATURE | Demo-to-Brevo contact sync for nurture list. | LOW |
| D42 | UX | "Not {name}?" link for returning demo visitors. | LOW |

### Slice 8 Intelligence UX (remaining, all LOW)
| # | Name | Status |
|---|------|--------|
| 8e | Prompt-Aware Suggestions | NOT STARTED |
| 8f | Change Impact Preview | NOT STARTED |
| 8i | Settings Search/Filter | NOT STARTED |
| 8j | Intent Confidence / Containment Rate | NOT STARTED |
| 8k | Cost-Per-Call Dashboard Widget | NOT STARTED |
| 8l | A/B Prompt Testing | NOT STARTED |
| 8n | Conversation Flow Visualization | NOT STARTED |
| 8p | Prompt Coherence Guard | NOT STARTED |
| 8q | Live Call Duration Timer | NOT STARTED |

---

## Pending Phases

| Phase | Summary | Status |
|-------|---------|--------|
| S12 Slice 1 | Prompt Variable Injection (PROMPT-TEST1+2) | NOT STARTED |
| S12 Slice 3 | Scrape Verify + Harden (SCRAPE10 remaining) | NOT STARTED |
| S12 Ph2 | Setup wizards (Telegram, SMS, Calendar, Knowledge, Forwarding) | NOT STARTED |
| S12 Ph2b | Calendar & call routing UX overhaul | NOT STARTED |
| S12 Ph2c | IVR multi-route call handling | DEFERRED |
| S12 Ph4 | Post-signup communication (welcome email, first-login) | BLOCKED on domain |
| S12 Ph5 | Dashboard visual redesign | LAST |
| S13 remaining | c (log hygiene), d (deprecate deploy_prompt.py), j-l (timeouts), p (rate limit alerts) | Mixed |
| S15 | Domain migration | GATE-1 (BLOCKED) |
| S16 remaining | S16a (GATE-2), S16b (SMS consent), S16c-d (PIPEDA) | Mixed |
| S17 | Operational maturity — staging, backups, logging, monitoring | NOT STARTED |
| S18 remaining | c-TRIAGE, d (CI types), e-VALIDATE, f-l (various) | Mixed |
| S19 remaining | Billing observability — usage alerts | NOT STARTED |
| S20 | Client deprovisioning | NOT STARTED |

---

## Ready-to-Execute Prompts

### PROMPT — Call Recording Consent Disclosure (GATE-2 — S16a)
**Priority:** HIGH — last remaining GATE-2 item
```
Add call recording consent disclosure to all voice agent system prompts.
1. Read memory/glm46-prompting-rules.md (MANDATORY before any prompt edit)
2. Read current system_prompt for each active client from Supabase
3. Add natural disclosure line in GREETING/OPENING section — one sentence, conversational
4. Run validatePrompt() check — no prompt exceeds 12K chars
5. Deploy each with /prompt-deploy [client]
6. Do NOT change any other part of the prompts
```

### PROMPT — Domain Migration (GATE-1 — S15) — BLOCKED
```
Update lib/app-url.ts, Railway env vars, Supabase settings, Resend domain,
Twilio webhook URLs, Ultravox webhook URL, all brand text references. Full E2E test after.
```
