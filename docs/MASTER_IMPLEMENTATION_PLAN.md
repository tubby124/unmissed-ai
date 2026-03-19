# Master Implementation Plan — unmissed.ai Post-Canary Feature Rollout

> Single source of truth for what ships next, in what order, and why.
> Generated: 2026-03-19. Replaces scattered phase docs for forward planning.
> Does NOT replace routing-handoff-design.md or settings-context-propagation.md (those are reference).

---

## 1. Executive Summary

The system is working. Phase 8 canary passed (6/6 hasan-sharif). Frontend refactor merged. Voice style presets wired. Settings audit clean. Routing design complete.

The next work has one goal: **turn working calls into retained clients and recovered leads.**

Priority order:
1. Don't drop callers when transfer fails (transfer recovery — IN PROGRESS)
2. Follow up with hot leads instantly (post-call SMS by classification)
3. Stop knowledge drift before it causes wrong answers (source ownership)
4. Make returning-caller recognition actionable (caller memory enhancement — infrastructure exists)
5. Give clients visibility into what the agent is doing (dashboard insights)

Everything else waits.

---

## 2. Current Confirmed State

### Completed (do not revisit)

| Item | Status | Evidence |
|------|--------|----------|
| Calendar default cleanup (buffer 0, duration 30) | DONE | 4 files + DB row updated |
| v33 universal rules in shared template | DONE | prompt-builder.ts + PROMPT_TEMPLATE_INBOUND.md |
| Voice style presets (4 presets) | DONE | prompt-builder.ts VOICE_PRESETS + SettingsView + AgentTab + settings API |
| Settings context propagation truth audit | DONE | `docs/settings-context-propagation.md` |
| Call routing / handoff design | DONE | `docs/routing-handoff-design.md` |
| Feature roadmap triage | DONE | `docs/feature-roadmap-triage.md` |
| Transfer failure recovery (R1) — code | DONE | `twilio.ts` actionUrl + `transfer-status/route.ts` + `transfer/route.ts` |
| Phase 8 canary (hasan-sharif 6/6) | PASS | `tests/live-eval/results.csv` |
| All 3 prod clients Railway-native | DONE | n8n fully retired |
| Agents API (callViaAgent) | LIVE | All 3 clients use persistent agents |

### In Progress

| Item | Status | Blocker |
|------|--------|---------|
| Transfer failure recovery (R1) | CODE DONE, UNTESTED | Needs live call test with Twilio `<Connect><Stream>` mid-call reconnect |

### Existing Infrastructure (available for use)

| Capability | Where | State |
|------------|-------|-------|
| Post-call SMS | `completed/route.ts` lines 242-264 | LIVE — sends to all non-JUNK when `sms_enabled=true`. Uses `sms_template` with `{{business}}` / `{{summary}}` placeholders. No classification-specific templates yet. |
| Caller memory (priorCallId) | `inbound/route.ts` lines 104-113, `agent-context.ts` | LIVE — already fetches 5 prior calls, injects returning-caller context + name. `priorCallId` passed to `createCall` fallback only (NOT to `callViaAgent` — Ultravox agents API doesn't support it). |
| Corpus/RAG | `api/dashboard/corpus/*` (5 routes) + AgentTab KB section | BUILT — global shared corpus, `corpus_enabled` flag, `queryCorpus` tool injection. hasan-sharif has `corpus_enabled=false`. No freshness UI. |
| Call stages | `ultravox.ts` has types, `api/stages/[slug]/escalate/route.ts` exists | STUB — route exists but not wired into production calls. Ultravox supports it natively. |
| Dashboard calls page | `dashboard/calls/page.tsx` + `dashboard/calls/[id]/` | LIVE — shows call list, individual call detail with transcript, events panel. No aggregated insights/charts. |
| Classification | `classifyCall()` in completed webhook | LIVE — returns `HOT/WARM/COLD/JUNK/MISSED/UNKNOWN` + confidence + sentiment + key_topics + next_steps + quality_score |
| Promptfoo tests | `tests/promptfoo/*.yaml` + `run-all.sh` | LIVE — 3 clients (hasan-sharif, windshield-hub, urban-vibe) + 1 test suite |
| Telegram alerts | Every call → Telegram with classification, summary, niche-specific format | LIVE |

---

## 3. Architecture Constraints (Must Not Violate)

1. **Ultravox PATCH replaces entire callTemplate** — never partial update. Always send all 10 fields in `updateAgent()`.
2. **GLM-4.6 prompt hard max: 8K chars** — reject any change that would push prompts over limit.
3. **Two injection mechanisms**: templateContext (live at call time) vs Agent PATCH (requires sync). Know which you're using.
4. **`callerContext` always includes CALLER PHONE** — agents must NEVER ask for callback number.
5. **No n8n for voice agents** — all webhook routes are Railway-native Next.js API routes.
6. **Promptfoo tests must pass** before any prompt template change ships.
7. **Voice personality lock** — never change voice/tone/identity of approved agents without explicit approval.
8. **One phase at a time** — complete + verify before starting next phase.
9. **Narrow diffs** — each phase changes the minimum files needed. No bundling.
10. **Existing behavior preserved** — unless a phase explicitly changes it with stated justification.

---

## 4. Phased Roadmap with Gates

### Phase S1 — Transfer Failure Recovery (R1) Verification

**Objective:** Verify the transfer-status reconnect works in production.

**Why it matters:** Today, a failed transfer = lost lead. The code is written but the Twilio `<Connect><Stream>` mid-call reconnect to a new Ultravox session is untested.

**Status:** Code DONE. Needs deploy + live test.

**Files touched (already modified):**
- `agent-app/src/lib/twilio.ts` — `redirectCall()` action URL support
- `agent-app/src/app/api/webhook/[slug]/transfer/route.ts` — passes actionUrl
- `agent-app/src/app/api/webhook/[slug]/transfer-status/route.ts` — NEW: handles dial failure, creates new Ultravox call, returns Stream TwiML

**Dependencies:** Railway deploy

**Risks:**
- `<Connect><Stream>` mid-call may not work (Twilio docs say it does, but untested in our stack)
- New Ultravox call creation adds latency (~2-3s) during reconnect — caller hears silence
- Double `call_logs` rows (intentional: two distinct Ultravox calls = two transcripts)
- Infinite reconnect loop — if the recovery call itself triggers another transfer that fails, the cycle repeats. Guard needed: max 1 reconnect per Twilio call SID.
- Double Telegram alerts — two completed webhooks fire (original + recovery), each sends a Telegram alert. Verify this is acceptable or suppress the original's alert.

**Test gate:**
1. Deploy to Railway
2. Call hasan-sharif → trigger transfer → don't answer forwarding number
3. Verify: AI agent resumes ("looks like they're tied up")
4. Verify: call stays connected, no drop
5. `/review-call [call-id]` on recovery call
6. Check call_logs: two rows (original + recovery) with correct statuses
7. Verify no infinite reconnect loop — recovery call must NOT trigger another transfer attempt (check transfer-status route for SID-based guard)
8. Verify Telegram alerts — confirm both original and recovery calls sent alerts, and alerts are not duplicated or misleading
9. Verify both transcripts (original + recovery) are intelligible in the calls dashboard — no garbled audio or empty transcripts

**Stop condition:** If `<Connect><Stream>` fails mid-call, the fallback TwiML says "please call back" — no silent failure. Document the blocker and move to Phase S2 while investigating.

**Phase prompt:**
```
Deploy the current agent-app to Railway. Then call the hasan-sharif Twilio number, trigger a transfer by saying "connect me to Hasan", and let it ring out (don't answer). Verify the AI agent reconnects. Run /review-call on the resulting call ID.
```

---

### Phase S2 — Post-Call SMS by Classification

**Objective:** Send classification-aware SMS after calls. HOT leads get immediate personalized follow-up. WARM gets a softer touch. COLD/JUNK get nothing extra.

**Why it matters:** HOT lead + instant SMS = highest conversion touchpoint. Currently all non-JUNK get the same generic SMS (if `sms_enabled`).

**Files to modify:**
- `agent-app/src/app/api/webhook/[slug]/completed/route.ts` — Replace single SMS block (lines 242-264) with classification-tiered logic
- `agent-app/src/lib/sms-templates.ts` — NEW: export `getSmsTemplate(classification, niche, clientConfig)` that returns the right template per tier

**Schema (no migration needed):** `sms_template` column already exists. We'll add `sms_rules` (JSON) to `clients` table for per-classification overrides.

**Design:**

| Classification | Behavior | Default Template |
|---------------|----------|------------------|
| HOT | Immediate SMS (0 delay) | "Hi {{caller_name}}, thanks for calling {{business}}! {{owner_name}} will call you back within the hour. If urgent, reply to this text." |
| WARM | SMS after 5 min (or immediate, configurable) | "Thanks for calling {{business}}! We got your info and will follow up shortly." |
| COLD | Standard SMS (existing behavior) | "Thanks for calling {{business}}!" |
| JUNK | No SMS | — |
| MISSED | Immediate SMS | "We missed your call at {{business}}. We'll call you back shortly." |

**Dependencies:** None — builds on existing SMS infrastructure.

**Risks:**
- SMS costs per message (~$0.0079 Twilio). HOT volume is low, so cost is negligible.
- `caller_name` might not be available (classification may not extract it). Fallback to no name.

**Test gate:**
1. Build passes
2. Make a test call to hasan-sharif that should classify as HOT
3. Verify: SMS sent with HOT template (includes "call you back within the hour")
4. Make a JUNK call (hang up immediately) — verify: no SMS sent
5. Check call_logs + Twilio SMS logs

**Stop condition:** If SMS sending starts failing, revert to existing single-template behavior.

**Phase prompt:**
```
Implement classification-aware post-call SMS in the completed webhook. Create a new file agent-app/src/lib/sms-templates.ts that exports a function getSmsTemplate(status, niche, config) returning the right SMS body per classification tier. HOT gets immediate personalized follow-up, WARM gets standard follow-up, COLD gets minimal, JUNK gets nothing. Update the SMS block in completed/route.ts to use this function. Add caller_name from classification.caller_data into the template when available. Do not change the Telegram alert logic. Do not add a new DB column yet — use the existing sms_template as a base with classification overrides in code. Build and verify.
```

---

### Phase S3 — Knowledge Source Truth Ownership

**Objective:** Document and enforce which field owns what knowledge. Add UI help text so clients stop putting the wrong data in the wrong field.

**Why it matters:** business_facts vs extra_qa vs context_data vs corpus = 4 places to put knowledge. No client understands the difference. Wrong placement → wrong answers on calls → trust destroyed.

**Files to modify:**
- `agent-app/src/components/dashboard/settings/AgentTab.tsx` — Add help text / descriptions below each knowledge field
- `docs/knowledge-source-ownership.md` — NEW: canonical reference doc

**Design:**

| Field | Owns | Example | Help Text |
|-------|------|---------|-----------|
| `business_facts` | Static identity — hours, address, staff names, services offered | "Open Mon-Fri 9-5, located at 123 Main St" | "Core business info your agent always knows. Hours, location, team members, services." |
| `extra_qa` | Dynamic FAQ — questions callers actually ask | Q: "Do you take insurance?" A: "Yes, we accept all major insurance" | "Common questions and answers. Your agent uses these to answer caller questions directly." |
| `context_data` | Structured reference — pricing tables, inventory, schedules | CSV of services + prices | "Reference data (pricing, inventory, schedules). Your agent can look up specific details here." |
| corpus (KB) | Long-form documents — policies, procedures, manuals | Employee handbook, warranty terms | "Upload documents for your agent to search through. Best for long policies or detailed procedures." |

**Dependencies:** None.

**Risks:** Zero code risk — UI copy changes only.

**Test gate:**
1. Build passes
2. Visual check: each field in AgentTab has clear description text
3. Doc created and accurate

**Stop condition:** N/A — this is documentation + UI copy.

**Phase prompt:**
```
Add descriptive help text below each knowledge field in AgentTab.tsx (business_facts, extra_qa, context_data, Knowledge Base section). Use text-[11px] text-t3 styling consistent with existing helper text in the component. The descriptions should clearly explain what kind of data belongs in each field and give one concrete example. Also create docs/knowledge-source-ownership.md documenting the canonical ownership rules for all 4 knowledge sources. Do not change any data flow or API logic.
```

---

### Phase S4 — Caller Memory Enhancement (Existing Infrastructure)

**Objective:** Enhance the EXISTING returning-caller recognition to be more visible and actionable. The data pipeline is fully built (priorCallId lookup, prior call summaries, name extraction, callerContext injection) — this phase adds prompt instructions so the agent actually USES that data.

**Why it matters:** "Welcome back, Sarah — last time you asked about the 3-bedroom on Oak Street" is a massive trust signal and competitor differentiator. The infrastructure to make this happen is already live — we're just not leveraging it.

**Scope:** Prompt template enhancement only. No new infrastructure, no new API routes, no schema changes.

**Current state:**
- `agent-context.ts` already builds `returningCallerContext` with prior call summaries + name
- `inbound/route.ts` already injects this into `callerContext`
- The prompt template has `{{callerContext}}` placeholder
- BUT: the prompt doesn't instruct the agent how to USE returning-caller context

**Files to modify:**
- `agent-app/src/lib/prompt-builder.ts` — Add a "RETURNING CALLER" instruction block to `INBOUND_TEMPLATE_BODY`
- `BUILD_PACKAGES/INBOUND_VOICE_AGENT/PROMPT_TEMPLATE_INBOUND.md` — Mirror in canonical template

**Design — add to template after the greeting section:**
```
## RETURNING CALLER HANDLING
If callerContext mentions "RETURNING CALLER" or includes prior call summaries:
- Acknowledge them by name if available: "Hey [name], good to hear from you again"
- Reference their prior interaction briefly: "Last time you called about [topic]"
- Do NOT repeat information they already provided (check prior call summary)
- Skip redundant qualification questions if answers are in the prior call data
- If prior call was HOT/WARM, prioritize getting them to the next step quickly
```

**Dependencies:** Phase S1 (transfer recovery) should be verified first — don't stack prompt changes.

**Risks:**
- GLM-4.6 may over-reference prior context ("you called 3 times before") — keep instruction minimal
- Prior call summaries are AI-generated and may be wrong — instruction should say "reference briefly" not "recite details"
- Prompt length: this adds ~300 chars. Well within 8K limit.

**Test gate:**
1. Promptfoo tests pass (`bash tests/promptfoo/run-all.sh`)
2. Generate test prompt for real_estate niche — verify RETURNING CALLER section present
3. Call hasan-sharif twice from same number — second call should reference first call
4. `/review-call` on second call — check for natural returning-caller acknowledgment

**Stop condition:** If GLM-4.6 produces awkward returning-caller references in test calls, reduce the instruction to just "acknowledge by name if available" (one line).

**Phase prompt:**
```
Add a RETURNING CALLER HANDLING section to the shared prompt template in prompt-builder.ts INBOUND_TEMPLATE_BODY. Place it after the greeting section. The instructions should tell the agent to: acknowledge returning callers by name, briefly reference their prior interaction, skip redundant questions, and prioritize getting HOT/WARM returning callers to the next step. Keep it under 300 chars. Mirror in BUILD_PACKAGES/INBOUND_VOICE_AGENT/PROMPT_TEMPLATE_INBOUND.md. Run promptfoo tests to verify. Do not modify any client's live prompt.
```

---

### Phase S5 — Dashboard Call Insights

**Objective:** Add an aggregated insights view so clients can see call volume, classification breakdown, and trends.

**Why it matters:** Clients currently have zero visibility into what the agent is doing. They see individual calls but no patterns. "Am I getting more HOT leads this week?" is unanswerable.

**Files to create/modify:**
- `agent-app/src/app/dashboard/insights/page.tsx` — NEW: server component that fetches aggregated data
- `agent-app/src/components/dashboard/InsightsView.tsx` — NEW: client component with charts
- `agent-app/src/app/api/dashboard/insights/route.ts` — NEW: API endpoint for aggregated call data
- `agent-app/src/app/dashboard/layout.tsx` — Add "Insights" to sidebar nav

**Design:**
- Classification pie chart (HOT/WARM/COLD/JUNK/MISSED distribution)
- Daily call volume line chart (last 30 days)
- Average call duration
- Top 5 caller phones (returning callers)
- Recent trend indicator (more HOT leads this week vs last?)
- Time range selector: 7d / 30d / 90d

**Dependencies:** None — reads from existing `call_logs` table.

**Risks:**
- Large datasets for high-volume clients — use Supabase aggregation queries, not client-side
- Chart library choice — use lightweight (recharts already in package.json if available, otherwise raw SVG)

**Test gate:**
1. Build passes
2. Load insights page for hasan-sharif — charts render
3. Verify data matches call_logs rows
4. Load for admin — cross-client view works

**Stop condition:** If chart rendering is too complex for this phase, ship a table-only view (no charts) and add charts in a follow-up.

**Phase prompt:**
```
Create a dashboard insights page at agent-app/src/app/dashboard/insights/page.tsx. Add an API route at agent-app/src/app/api/dashboard/insights/route.ts that returns aggregated call data (classification distribution, daily volume, avg duration, top callers) for the last 30 days, scoped to the requesting user's client_id (admin sees all). Create a client component InsightsView.tsx with: classification breakdown (count + percentage per status), daily call count for the last 30 days, and average call duration. Use simple HTML/CSS tables and bars initially — no chart library dependency. Add "Insights" link to the dashboard sidebar nav. Build and verify.
```

---

### Phase S6 — Client Self-Serve Prompt Guardrails

**Objective:** Prevent clients from breaking their agent by editing the prompt unsafely.

**Why it matters:** Clients can currently edit `system_prompt` freely. No length check, no forbidden pattern detection, no preview. One bad edit = broken agent.

**Files to modify:**
- `agent-app/src/app/api/dashboard/settings/route.ts` — Add validation for `system_prompt` field
- `agent-app/src/components/dashboard/settings/AgentTab.tsx` — Add character count, warnings

**Design:**
- Max prompt length: 8,000 chars (hard reject in API)
- Warn at 7,000 chars (yellow indicator in UI)
- Forbidden patterns: phone numbers in prompt text (regex check), URLs (they hallucinate), price commitments ("we charge $X")
- Preview: show estimated token count (chars / 4 rough estimate)
- On save: if prompt changed, show diff preview before confirming

**Dependencies:** Phase S3 (knowledge ownership) — clients need to know where to put data before we restrict the prompt field.

**Risks:**
- False positives on forbidden patterns (e.g., "call 911" contains a phone number pattern)
- Overly restrictive validation frustrates power users

**Test gate:**
1. Build passes
2. Try saving a prompt over 8K chars — rejected with clear error
3. Try saving a prompt with a phone number — warning shown
4. Normal prompt save still works

**Stop condition:** If validation causes real friction, soften to warnings only (no hard blocks except 8K limit).

**Phase prompt:**
```
Add prompt validation to the settings API (agent-app/src/app/api/dashboard/settings/route.ts). Reject system_prompt over 8000 chars with a 400 error and clear message. Add a character counter to the prompt editor in AgentTab.tsx that shows current length / 8000 and turns yellow at 7000, red at 8000. Add a soft warning (not a block) if the prompt contains what looks like a phone number (regex: 10+ digit sequences) or a URL (http/https). Do not add diff preview in this phase — just the length check and pattern warnings. Build and verify.
```

---

## 5. Later Phases (Design First / Defer)

These are NOT in the current execution queue. They are documented here for reference only.

### Phase S7 — Ring Group (R2) [DESIGN FIRST]
- Sequential dial to 2-3 numbers
- Requires: `forwarding_numbers` JSON column, multi-number UI, TwiML chain
- Design exists in `docs/routing-handoff-design.md` Q3
- **Spike needed:** Test Twilio `<Dial>` action chaining with multiple numbers before building

### Phase S8 — Capability State Preview [LOW EFFORT]
- Read-only card showing what features are enabled per client
- transfer on/off, calendar on/off, SMS on/off, corpus on/off, voice preset
- Simple component, no API changes

### Phase S9 — A/B Prompt Testing [DESIGN FIRST]
- Traffic splitting between prompt versions
- Requires: `prompt_versions` table, inbound webhook version selection, comparison dashboard
- High complexity. Do after insights dashboard proves the metric pipeline works.

### Phase S10 — Warm Transfer / Attended Transfer [PREMIUM]
- Agent briefs the owner before connecting: "I have Sarah on the line, she's asking about the 3-bedroom listing"
- Requires: Twilio conference leg (agent + owner + caller)
- This is a premium feature differentiator. Design only after R1 is proven.

### Phase S11 — Corpus Freshness UI
- Show when each corpus doc was last updated
- Upload date, file size, staleness indicator
- Low risk, low effort, but low priority (only 1 client has corpus enabled)

### Phase S12 — Retrieval Confidence Fallback
- When `queryCorpus` returns low-confidence results, agent should say "I'm not 100% sure about that, let me have someone confirm and get back to you"
- Requires: confidence score from Ultravox RAG response + prompt instruction
- Design first — need to understand what Ultravox returns for low-quality matches

---

## 6. Risks / Blockers / Unknowns

| Item | Severity | Impact | Mitigation |
|------|----------|--------|-----------|
| `<Connect><Stream>` mid-call to new Ultravox session | HIGH | Core S1 dependency | Live test before proceeding. Fallback TwiML exists. |
| Infinite reconnect loop (transfer → fail → reconnect → transfer → fail) | MEDIUM | Caller stuck in loop | Add max-reconnect guard (1 per Twilio SID) to transfer-status route |
| GLM-4.6 returning-caller over-referencing | LOW | Awkward call experience | Minimal instruction, test with 2 live calls |
| SMS costs at scale | LOW | ~$0.01/message | Only HOT/WARM/MISSED get SMS, JUNK excluded |
| Prompt length pressure | MEDIUM | 8K chars with all features | Monitor per-client. Phase S6 adds hard limit. |
| Dashboard insights query performance | LOW | Slow load for high-volume clients | Use Supabase aggregate queries, not client-side sum |

---

## 7. High-Leverage Ideas Not Yet Planned

These are genuinely promising but need more thought before becoming phases:

1. **Post-call Telegram with "one-tap callback" button** — Telegram inline keyboard with "Call [caller] back" button that triggers an outbound call from the business number. Requires Twilio outbound + Telegram bot callback handler. High leverage for owner response time.

2. **Niche-specific SMS templates** — auto_glass SMS includes "Here's our address for your appointment: [address]". real_estate includes "Here are the listings we discussed: [link]". Requires niche-aware template engine.

3. **Call quality score trending** — the `quality_score` field from classification is already stored. Surface it as a trend line in insights. If quality drops, alert the operator to investigate prompt drift.

4. **Automatic prompt health check** — weekly cron that runs promptfoo tests against all active clients. If any client fails, Telegram alert to operator. Prevents silent prompt regression.

5. **Transfer recovery context persistence** — when the agent resumes after a failed transfer, it currently starts fresh (new Ultravox call). The prior conversation is lost. Could pass the original `ultravox_call_id` as `priorCallId` in the recovery call to maintain conversation history. Low effort, high trust.

6. **Capability Summary Card** — read-only card on the dashboard showing which features are enabled for this client: transfer on/off, calendar on/off, SMS on/off, corpus on/off, voice preset, forwarding number. No toggles — just a clear snapshot. Removes the "wait, is my transfer even turned on?" confusion. Simple component, no API changes, no new data. See also Phase S8 in Section 5.

---

## 8. Deferred Ideas (Ignore for Now)

| Idea | Why Defer |
|------|-----------|
| Multilingual support | GLM-4.6 is English-optimized. Quality cliff in other languages. No non-English clients. |
| Elevator music / hold experience | <5% of calls involve transfer. Twilio default is acceptable. |
| DTMF IVR menu | Against product philosophy. Voice-first. |
| Standalone voicemail recording | AI agent IS the voicemail replacement. |
| Transfer through owner's IVR | Niche use case. Near-zero demand. |
| Call stages for production | Only needed if monoprompt fails for a complex client. Not yet. |
| Outbound calling | Different product. Don't dilute inbound focus. |

---

## 9. Exact Next 5 Prompts to Run

These are ready-to-paste Claude Code prompts, in order. Each assumes the previous phase completed and passed its gate.

### Prompt 1 — Verify Transfer Recovery (S1 Gate)

```
Deploy the current agent-app to Railway (git push). Then I'll make a live test call to hasan-sharif's Twilio number and trigger a transfer. The test: say "can you connect me to Hasan", let it ring out without answering. After the call completes, check:
1. Railway logs for [transfer-status] entries — did it detect no-answer and create a new Ultravox call?
2. call_logs table — are there two rows for this Twilio call SID (original + recovery)?
3. /review-call [recovery-call-id] — did the agent resume naturally?
4. No infinite reconnect loop — confirm transfer-status has a max-reconnect guard (1 per Twilio SID). If not, add one before testing.
5. Telegram alerts — verify both original and recovery calls sent alerts without duplication or misleading content.
6. Both transcripts (original + recovery) are intelligible in the calls dashboard — no garbled audio or empty transcripts.
Report findings. If <Connect><Stream> failed, document the error and propose a workaround.
```

### Prompt 2 — Post-Call SMS by Classification (S2)

```
Implement classification-aware post-call SMS in the completed webhook. Create agent-app/src/lib/sms-templates.ts exporting getSmsTemplate(status, niche, config) that returns the right SMS body per classification tier:
- HOT: immediate, personalized ("{{caller_name}}, thanks for calling {{business}}! {{owner_name}} will call you back within the hour.")
- WARM: standard follow-up
- COLD: minimal
- JUNK: no SMS
- MISSED: immediate ("We missed your call at {{business}}...")
Replace the SMS block in completed/route.ts (lines 242-264) with a call to getSmsTemplate. Include caller_name from classification.caller_data when available. Do not change Telegram logic. Do not add new DB columns. Build and verify.
```

### Prompt 3 — Knowledge Source Ownership (S3)

```
Add descriptive help text below each knowledge field in AgentTab.tsx:
- business_facts: "Core business info your agent always knows — hours, location, team members, services."
- extra_qa: "Common questions and answers. Your agent uses these to answer caller questions directly."
- context_data: "Reference data like pricing tables, inventory, or schedules. Your agent looks up specific details here."
- Knowledge Base section: "Upload documents for your agent to search through — policies, procedures, or detailed guides."
Use text-[11px] text-t3 styling. Also create docs/knowledge-source-ownership.md documenting which field owns what, with examples and anti-patterns (what NOT to put where). Build and verify.
```

### Prompt 4 — Caller Memory Prompt Enhancement (S4)

```
Add a RETURNING CALLER HANDLING section to the shared prompt template in prompt-builder.ts INBOUND_TEMPLATE_BODY. Place after the greeting section, before the ABSOLUTE FORBIDDEN ACTIONS. Content:
"## RETURNING CALLER HANDLING
If callerContext says RETURNING CALLER or includes prior call summaries:
- Greet by name if available: 'Hey [name], good to hear from you again'
- Reference their last topic briefly: 'Last time you called about [topic from summary]'
- Do NOT re-ask questions already answered in prior call data
- For HOT/WARM returning callers, skip small talk and get to next steps fast"
Keep it under 300 chars in the template. Mirror in BUILD_PACKAGES/INBOUND_VOICE_AGENT/PROMPT_TEMPLATE_INBOUND.md. Run promptfoo tests. Do not modify any client's live prompt — template only.
```

### Prompt 5 — Dashboard Call Insights (S5)

```
Create a dashboard insights page:
1. API route: agent-app/src/app/api/dashboard/insights/route.ts — returns aggregated call data for the requesting user's client (admin sees all clients). Queries: classification counts, daily call volume (last 30 days), average duration, top 5 returning callers.
2. Page: agent-app/src/app/dashboard/insights/page.tsx — server component fetching client data.
3. Component: agent-app/src/components/dashboard/InsightsView.tsx — client component showing classification breakdown (count + percentage per status as colored bars), daily call volume as a simple bar chart (CSS-only, no library), and avg duration stat. Use the existing dashboard design patterns (dark theme, card layout).
4. Add "Insights" to the sidebar nav in dashboard/layout.tsx.
Build and verify. No chart library — use CSS width percentages for bars.
```

---

## Execution Contract

```
S1 (verify transfer recovery)
  gate: live call test passes
S2 (post-call SMS by classification)
  gate: build + test call + SMS log check
S3 (knowledge source ownership)
  gate: build + visual review
S4 (caller memory prompt)
  gate: promptfoo pass + test call
S5 (dashboard insights)
  gate: build + data verification
S6 (prompt guardrails)
  gate: build + validation tests

Then reassess: S7-S12 based on client feedback and usage data.
```

Each phase completes fully before the next starts. No parallel execution across phases.
