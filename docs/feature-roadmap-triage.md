# Feature Roadmap Triage — unmissed.ai

> Generated 2026-03-19. Sorted by revenue impact, trust/UX impact, risk, and dependency order.

---

## Triage Categories

| Category | Meaning |
|----------|---------|
| **DO NOW** | High leverage, low risk, unblocked. Ship this sprint. |
| **DO NEXT** | High leverage but depends on a DO NOW item or needs a spike first. |
| **DESIGN FIRST** | Valuable but needs design/architecture work before code. |
| **DEFER** | Low leverage now, or blocked by something bigger. Revisit quarterly. |

---

## DO NOW (Top 3)

| # | Feature | Revenue Impact | Trust/UX Impact | Risk | Effort | Why Now |
|---|---------|---------------|-----------------|------|--------|---------|
| 1 | **Transfer failure recovery (R1)** | Medium — prevents lost leads when owner doesn't answer | **High** — today the caller hears robotic TTS and the call drops | Low — HTTP path only, SIP unchanged | Medium | Design complete (routing-handoff-design.md). Key gap: every failed transfer = lost lead. The `/transfer-status` route + Ultravox reconnect is the single highest-trust improvement available. |
| 2 | **Post-call SMS by classification** | **High** — HOT/WARM leads get immediate follow-up text, reduces lead leakage | High — caller feels remembered | Very Low — completed webhook already has classification + phone | Low | All infrastructure exists: `completed` webhook has classification, caller phone, and SMS sending via Twilio. Just needs a `sms_followup_rules` config per classification tier (HOT=immediate, WARM=5min delay, COLD=none). |
| 3 | **Knowledge source truth ownership** | Medium — prevents FAQ/context_data/business_facts drift causing wrong answers | **High** — wrong answers on calls = trust destroyer | Very Low — documentation + minor UI labels | Low | No code risk. Write a doc defining which field owns what (business_facts = static identity, extra_qa = dynamic FAQ, context_data = structured reference, corpus = long docs). Add help text to each field in AgentTab. |

---

## DO NEXT (Top 3)

| # | Feature | Revenue Impact | Trust/UX Impact | Risk | Effort | Depends On |
|---|---------|---------------|-----------------|------|--------|------------|
| 4 | **Caller memory (priorCallId)** | **High** — returning callers get recognized ("Welcome back, Sarah") | **High** — massive trust signal, competitor differentiator | Medium — needs call_logs lookup + prompt injection | Medium | Ultravox supports `priorCallId` in call creation. Need: (1) lookup caller phone in call_logs, (2) inject prior call summary into callerContext, (3) add "returning caller" handling rules to prompt template. |
| 5 | **Dashboard call insights** | Medium — clients see call volume, classification breakdown, peak hours | High — clients currently have zero visibility into call performance | Low — read-only queries on existing call_logs | Medium | Supabase call_logs table already has all data. Build: classification pie chart, daily volume line chart, avg duration, top caller phones. Admin gets cross-client view. |
| 6 | **Client self-serve prompt guardrails** | Medium — reduces support load, enables client autonomy | Medium — clients can currently edit prompt freely and break it | Medium — need to define safe vs unsafe edit zones | Medium | Depends on knowledge source ownership (DO NOW #3). Once fields are clearly defined, add validation: max char limits, forbidden patterns (no phone numbers in prompt, no price promises), preview before save. |

---

## DESIGN FIRST

| # | Feature | Revenue Impact | Trust/UX Impact | Risk | Effort | Design Needed |
|---|---------|---------------|-----------------|------|--------|---------------|
| 7 | **Ring group (sequential dial, 2-3 numbers)** | Medium — multi-person businesses need this | Medium | Low | Medium | Phase R2 in routing-handoff-design.md. Needs `forwarding_numbers` JSON column, UI for multi-number input, TwiML chain with sequential dial. Design exists, needs spike on Twilio `<Dial>` action chaining. |
| 8 | **A/B prompt testing** | **High** — data-driven prompt improvement instead of gut feel | Low (internal tool) | Medium — needs traffic splitting logic | High | Need: (1) prompt_versions table with traffic split %, (2) inbound webhook selects version by weight, (3) call_logs tracks which version was used, (4) dashboard comparison view (classification rates, duration, booking rate per version). Complex — design the schema + splitting logic before building. |
| 9 | **Voicemail-to-text fallback** | Medium — captures messages when AI can't help or after hours | Medium | Medium — competes with AI agent itself | Medium | Design question: is this Twilio `<Record>` → transcription → Telegram? Or does the AI agent handle "take a message" flow (already partially works)? Routing-handoff-design.md recommends the AI agent IS the voicemail replacement. Design the "structured message capture" flow instead. |
| 10 | **Client capability state preview** | Low | High — clients don't know what features they have enabled | Very Low | Low | Simple read-only card showing: transfer (on/off), calendar (on/off), SMS (on/off), corpus (on/off), voice preset, after-hours behavior. Needs design for where it lives (dashboard home? settings overview?). |

---

## DEFER

| # | Feature | Why Defer |
|---|---------|-----------|
| 11 | **Multilingual support** | Ultravox GLM-4.6 is English-optimized. Non-English = quality cliff. French-Canadian is the only viable near-term target (Quebec market), but no Quebec clients yet. Revisit when Ultravox ships a multilingual model or when a non-English client signs up. |
| 12 | **Elevator music / hold experience** | Low impact — transfer calls are rare (<5% of volume). Twilio default hold TwiML is acceptable. Custom hold music URL is Phase R3 in routing design. Only build when ring group (R2) ships. |
| 13 | **DTMF IVR menu** | Against product philosophy. Ultravox is conversational AI — DTMF menus are the opposite of the value prop. See routing-handoff-design.md Q1. Never build this. |
| 14 | **Standalone voicemail recording** | The AI agent IS the voicemail replacement. Building a separate voicemail system competes with the core product. Focus on making "take a message" flow better instead (DO NOW #1 handles the failure case). |
| 15 | **Transfer through owner's IVR** | Niche use case. Agent would need to dial DTMF tones through the owner's phone system. High complexity, near-zero demand. Only revisit if an enterprise client specifically needs this. |

---

## Completed (This Sprint)

| Feature | Status | Phase |
|---------|--------|-------|
| Calendar default cleanup (buffer 0, duration 30) | DONE | Phase 1 |
| v33 universal rules in shared template (anti-repeat, one-question, phone guard, English-only) | DONE | Phase 2 |
| Voice style presets (4 presets, prompt-builder + settings UI + API) | DONE | Phase 3 |
| Settings context propagation truth audit | DONE | Phase 4 |
| Call routing / handoff design pass | DONE | Phase 5 |

---

## Dependency Graph

```
Knowledge source ownership (#3)
  └── Client self-serve guardrails (#6)

Transfer failure recovery (#1)
  └── Ring group (#7)
      └── Hold music (#12)

Post-call SMS (#2)
  └── (standalone — no downstream deps)

Caller memory (#4)
  └── (standalone — enhances all call quality)

Dashboard insights (#5)
  └── A/B prompt testing (#8) — needs the insights infrastructure
```

---

## Recommended Execution Order

```
Sprint 1 (now):
  #1  Transfer failure recovery (R1)
  #2  Post-call SMS by classification
  #3  Knowledge source truth ownership (doc + UI labels)

Sprint 2:
  #4  Caller memory (priorCallId)
  #5  Dashboard call insights
  #10 Client capability state preview

Sprint 3:
  #6  Client self-serve prompt guardrails
  #7  Ring group (R2) — spike first
  #9  Voicemail flow design

Backlog:
  #8  A/B prompt testing (after insights infra exists)
  #11-15  Deferred items (revisit quarterly)
```
