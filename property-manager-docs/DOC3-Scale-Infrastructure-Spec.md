# SCALE INFRASTRUCTURE SPEC
*Separate project. Do AFTER first client is live and stable for 1+ week. Goal: 30-min deploys.*

**Prerequisite:** DOC1 (Template Hardening) complete. At least 1 client deployed via DOC2 (Runbook) and live for 7+ days with zero critical issues.

---

## WHY THIS IS SEPARATE

Deploying the property manager client = proving the system works.
Building scale infrastructure = making the system repeatable.

Mixing them guarantees: the client launch slips while you're building tooling, OR the tooling is built on assumptions that break when you hit real deployment edge cases. Ship the client first. Learn from it. Then automate what you learned.

---

## DELIVERABLE 1 — `/provision` Slash Command

**File:** `.claude/commands/provision.md`

**Trigger:** `/provision <client-slug>`

**What it does (autonomous, no human intervention except marked stops):**

1. Reads `clients/<client-slug>.json` — validates all required fields present
2. Checks niche exists in `prompt_builder.py` — errors if missing
3. Runs `prompt_builder.py --niche <niche> --client clients/<slug>.json`
4. Outputs completed prompt (ready to paste into Sheets A2)
5. Outputs pre-filled deployment checklist from DOC2 with client-specific values
6. Outputs remaining **🛑 HUMAN ACTION** steps with exact instructions:
   - Buy Twilio number (area code: `<city>`)
   - Create Google Sheet (structure defined)
   - Authorize Sheets OAuth in n8n UI
   - Create Telegram bot via BotFather
7. After human completes manual steps and provides IDs → updates `clients/<slug>.json`
8. Clones n8n workflow via REST API:
   - Strips 9 read-only fields
   - Updates 6+ client-specific fields
   - Uses unique webhook paths: `<niche>-<slug>-inbound`, `<niche>-<slug>-completed`
9. Activates workflow + toggle fix (R5)
10. HEAD webhook URL → confirms 200
11. Outputs: "Ready for internal testing. Run DOC2 Step 5."

**Acceptance criteria:**
- [ ] `/provision test-client` with a dummy JSON → generates prompt + checklist
- [ ] `/provision` with missing fields → clear error listing which fields are missing
- [ ] `/provision` with unknown niche → clear error, not a crash
- [ ] Cloned workflow passes DOC1 verification checklist automatically

---

## DELIVERABLE 2 — Updated CLAUDE.md File Map

**File:** `CLAUDE.md` (project root) — add this section:

```markdown
## File Map — Quick Reference

### Core Build System
| Asset | Path |
|-------|------|
| Master n8n template | WINDSHIELD HUB AUTO GLASS SYSTEM/winhub_march4_post4fixes.json |
| Prompt template | BUILD_PACKAGES/INBOUND_VOICE_AGENT/PROMPT_TEMPLATE_INBOUND.md |
| Intake form | BUILD_PACKAGES/INBOUND_VOICE_AGENT/INTAKE_FORM_INBOUND.md |
| Prompt generator | PROVISIONING/app/prompt_builder.py |
| Client configs | clients/*.json |
| Deployment gotchas | WINDSHIELD HUB AUTO GLASS SYSTEM/DEPLOYMENT_GOTCHAS.md |

### Credentials & API Keys
| Asset | Path |
|-------|------|
| n8n API key | HASAN SHARIF VOICE MAIL SYSTEM.../n8n_api_helper.sh |
| Ultravox API key | MANZIL REALTY ISA SYSTEM/n8n_api_helper.sh |

### Operational Docs
| Asset | Path |
|-------|------|
| Template hardening checklist | DOC1-Template-Hardening-Checklist.md |
| Per-client deployment runbook | DOC2-Per-Client-Deployment-Runbook.md |
| Scale infrastructure spec | DOC3-Scale-Infrastructure-Spec.md |

### Per-Client Folders
| Client | Path |
|--------|------|
| Windshield Hub | WINDSHIELD HUB AUTO GLASS SYSTEM/ |
| Hasan Sharif | HASAN SHARIF VOICE MAIL SYSTEM.../ |
| [Property Manager] | <CLIENT NAME> SYSTEM/ |
```

---

## DELIVERABLE 3 — `onboard-client` Skill

**File:** `.claude/skills/onboard-client/SKILL.md`

**Trigger:** `/onboard-client <intake-form-answers-file>` OR `/onboard-client` (interactive)

**Autonomous flow:**

```
READ intake answers (from file or interactive prompts)
  → Validate all 22 required variables present
  → Error on any missing with "ask client for: [field]"

GENERATE prompt
  → Run prompt_builder.py
  → Verify PIPEDA compliance in output
  → Verify no {{placeholder}} variables remain

CREATE client config
  → clients/<slug>.json with known fields
  → Blank fields for provisioning outputs

GUIDE operator through 4 manual steps (one at a time):
  🛑 "Buy Twilio number for <city> — enter number when done: "
  🛑 "Create Google Sheet — enter Sheet ID when done: "
  🛑 "Create Telegram bot — enter chat_id when done: "
  🛑 "Authorize Sheets OAuth in n8n UI — confirm when done: "

CLONE n8n workflow via REST API
  → Strip read-only fields
  → Update client-specific fields
  → Unique webhook paths
  → Activate + toggle fix
  → HEAD verify

CREATE Google Sheet structure
  → Tab 1: System Prompt (A1 header, A2 prompt)
  → Tab 2: Call Log (17 columns)

GENERATE 4 sample transcripts
  → Niche-specific scenarios
  → Save to <CLIENT NAME> SYSTEM/SAMPLE_TRANSCRIPTS.md

OUTPUT call forwarding instructions
  → Carrier-specific (Rogers/Bell/Telus/Business)
  → Save to <CLIENT NAME> SYSTEM/CALL_FORWARDING_INSTRUCTIONS.md

CREATE client folder structure
  → <CLIENT NAME> SYSTEM/
  → All artifacts inside

OUTPUT: "Infrastructure ready. Run DOC2 Step 5 for internal testing."
```

**Acceptance criteria:**
- [ ] Interactive mode: prompts for each field, validates, proceeds
- [ ] File mode: reads answers, validates, proceeds
- [ ] Missing field → stops with clear message, doesn't half-deploy
- [ ] Idempotent: running twice with same slug doesn't create duplicates
- [ ] Output folder contains all 3 artifacts (transcripts, forwarding, checklist)

---

## DELIVERABLE 4 — Agent-App Wizard Updates

**Only after Deliverables 1-3 are working.**

### 4a. Add property_management to niche registry
**File:** `agent-app/src/app/onboard/steps/step4.tsx`
- Add to `NICHE_REGISTRY` array
- Display name: "Property Management"
- Required fields: emergency policy, manager callback name, services not offered

### 4b. Create niche-specific questions
**File:** `agent-app/src/app/onboard/steps/niches/property-management.tsx`
- Emergency policy toggle (24/7 or business hours only)
- Manager name for callbacks
- Number of properties/units managed (for prompt context)
- Common maintenance types (pre-populated checklist)

### 4c. Add idempotency
**File:** `agent-app/src/app/api/provision/route.ts`
- Generate UUID at form load (client-side)
- POST UUID to Supabase with `status: pending` BEFORE any provisioning
- Each provisioning step checks: does this UUID already have this step completed?
- Prevents: double Twilio numbers, double workflows, duplicate billing

### 4d. Improve confirmation page
**File:** `agent-app/src/app/onboard/status/page.tsx`
- "What happens next" timeline with steps
- Real-time status updates as provisioning completes
- Clear indication of which steps need human action
- Apply `/frontend-design` skill for client-facing polish

---

## PRIORITY ORDER

| # | Deliverable | Time Est. | Blocks |
|---|-------------|-----------|--------|
| 1 | `/provision` slash command | 2-3 hrs | Nothing (manual still works) |
| 2 | CLAUDE.md file map | 15 min | Nothing |
| 3 | `onboard-client` skill | 3-4 hrs | Deliverable 1 |
| 4 | Agent-app wizard updates | 4-6 hrs | Deliverable 3 + live client feedback |

**Total:** ~10-14 hours of focused build time across 2-3 sessions.

---

## SUCCESS METRIC

**Before this spec:** 4+ hours per client deployment, high error rate, manual checklist tracking.

**After this spec:** 30 minutes operator time per client (4 manual stops), rest is autonomous. Zero duplicate provisioning. Every client inherits all hardening fixes automatically.

---

## WHAT'S NOT IN THIS SPEC (Future)

- Multi-tenant dashboard (view all clients, their call volumes, health)
- Auto-scaling beyond 5 concurrent calls (Ultravox enterprise tier)
- Client self-serve portal (they edit their own prompt/hours)
- Billing integration (auto-invoice clients monthly)
- Call recording + QA scoring
- A/B testing different prompt versions per client

These are real features but they're post-10-client problems. Don't build them before you have 5 paying clients.
