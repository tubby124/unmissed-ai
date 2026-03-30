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
DONE → see docs/refactor-completed-phases.md (all D1–D96 completed items)
       D92 (calling dedup guard — confirmed in cron 2026-03-30)
       D94 (phantom statuses — 'calling' now real via D92; 'completed' pre-guard, 2026-03-30)
       D95 (Telegram summary — confirmed in cron 2026-03-30)
       D99 (retry cap — confirmed in cron 2026-03-30)
       D100 (vm_script max 500 + char counter — 2026-03-30)
       D101 DB migration (call_direction col + index applied, types updated — 2026-03-30)
       D109 NEW (outbound_connect_tokens cleanup cron hourly — 2026-03-30)

NEXT (in order):
  D97  → Lead lifecycle: auto-advance status='completed' after disposition='answered'
  D101 code → Write call_direction='inbound'/'outbound' at insert in inbound + dial-out routes
  D93  → Add "Scheduled" sub-filter/badge row to lead queue Queued tab
  D101 UI → Outbound filter tab on calls page
  STRIPE-PORTAL → Configure Stripe Customer Portal (manual — Stripe Dashboard step)
  GATE-1 → Domain migration (BLOCKED on domain purchase)

DEFERRED → S11, S12 advanced phases, S13 LOW, S16a-d, S17-S20
```

---

## Active Discovery Items (NOT STARTED / BLOCKED only)

### Outbound / Scheduled Callbacks (highest priority cluster)
| # | Type | Fix | Priority |
|---|------|-----|----------|
| D92 | BUG | No dedup guard — same lead can be dialed twice if cron overlaps. Atomically set `status='calling'` before dial loop, rollback on Twilio fail. | HIGH |
| D93 | UX | No "Scheduled" filter in lead queue. Add sub-filter for `scheduled_callback_at IS NOT NULL`, sorted by time. | MEDIUM |
| D94 | DEBT | Phantom statuses 'calling'/'completed' in cron filter — dead conditions. Fix when D92 adds 'calling' for real. | LOW |
| D95 | GAP | No Telegram summary from scheduled-callbacks cron. Send per-client summary after each run. | MEDIUM |
| D97 | GAP | Lead `status` never advances past 'called' after answered call. After `disposition='answered'`, set `status='completed'`. | MEDIUM |
| D98 | GAP | VIP contacts siloed from outbound dialing — no "dial this VIP" button or auto-escalation path. | LOW |
| D99 | GAP | No retry cap on scheduled-callbacks — bad numbers dialed forever. Cap at 3 → auto-set 'dnc'. | MEDIUM |
| D100 | GAP | `outbound_vm_script` has no char limit. Add `z.string().max(500)` in settings-schema + char counter in UI textarea. | LOW |
| D101 | GAP | No `call_direction` column in `call_logs`. Add 'inbound'/'outbound' at insert time + Outbound filter tab on calls page. | MEDIUM |

### Dashboard / UX
| # | Type | Fix | Priority |
|---|------|-----|----------|
| D27 | GAP | No feedback loop for call-time injection fields — consider "preview what agent knows" tile. | LOW |
| D56 | VERIFY | Transfer recovery never live-tested. Smoke test: real call to unanswered forwarding number. | MEDIUM |
| D80 | UX | `info_hub` / restaurant mode onboards with empty `context_data`. Add menu input nudge or post-activation card. | LOW |
| D84 | GAP | No UI visibility of call stage transitions. `call_logs` has no `current_stage`. | LOW |

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
