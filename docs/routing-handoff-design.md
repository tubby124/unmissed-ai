# Call Routing & Handoff Design — unmissed.ai

> Design doc only. No implementation in this phase.
> Generated 2026-03-19.

---

## 1. Current State

### What exists today

| Feature | Status | Implementation |
|---------|--------|---------------|
| Cold transfer to owner | **LIVE** | `coldTransfer` built-in Ultravox tool → SIP INVITE to `forwarding_number` |
| HTTP transfer fallback | **LIVE** | `transferCall` HTTP tool → `/api/webhook/[slug]/transfer` → `redirectCall()` via Twilio `calls.update()` TwiML |
| SMS alert on transfer | **LIVE** | Transfer route sends SMS to owner before redirect |
| Transfer conditions | **LIVE** | `transfer_conditions` text → baked into tool description on Ultravox agent |
| Emergency escalation (prompt) | **LIVE** | `LIFE SAFETY EMERGENCY OVERRIDE` section in prompt template — instructs agent to prioritize safety, provide 911 guidance, then offer transfer |
| Voicemail (prompt) | **PARTIAL** | `voicemail` niche exists — lightweight prompt for recording messages. Not integrated with real voicemail transcription. |
| Hold / music | **NOT BUILT** | `redirectCall()` uses `<Say>Please hold...</Say>` (TTS), not music |
| DTMF / keypad routing | **NOT BUILT** | Ultravox has `playDtmfSounds` API but no IVR menu integration |
| Ring group / sequential dial | **NOT BUILT** | Single `forwarding_number` only |
| Voicemail transcription | **NOT BUILT** | No fallback when transfer fails and owner doesn't answer |

### Transfer flow (current)

```
Caller speaks → Agent decides to transfer → Ultravox coldTransfer tool
  → SIP INVITE to forwarding_number
  → Twilio connects caller to owner's phone
  → If no answer (30s timeout): Twilio <Say> "Sorry, no one was available"
  → Call ends
```

**OR** (HTTP fallback, used in sync-agent/settings routes):

```
Agent calls transferCall HTTP tool → POST /api/webhook/[slug]/transfer
  → SMS alert sent to owner
  → Twilio redirectCall() with TwiML: <Say> announcement + <Dial> to forwarding_number
  → If no answer (30s timeout): <Say> fallback message
  → Call ends
```

### Key gap: When transfer fails, the caller hears a robotic "Sorry, no one was available" and the call drops. The AI agent is no longer in the loop.

---

## 2. Design Questions & Answers

### Q1: What should "press 1 to connect" look like with Ultravox?

**Answer: Don't build an IVR.** Ultravox is a conversational AI — DTMF menus are the opposite of the value proposition. The agent should understand natural language ("connect me to someone") and route accordingly.

However, `playDtmfSounds` could be useful for:
- Playing confirmation tones during transfers
- Navigating the owner's phone system (future: if owner has their own IVR, agent could dial through it)

**Recommendation:** Skip DTMF IVR entirely. Keep voice-first routing.

### Q2: Emergency escalation — separate from transfer? Always-on?

**Current:** The prompt template has a `LIFE SAFETY EMERGENCY OVERRIDE` section (lines 28-35) that:
1. Detects emergency keywords ("I can't breathe", "fire", "I was attacked")
2. Instructs caller to call 911 immediately
3. Offers to transfer to owner if available
4. Takes name/address for follow-up

**Design:** Keep this as a prompt-level instruction (not a tool). Reasons:
- Speed matters — no API round-trip to decide on 911 guidance
- Always-on regardless of `TRANSFER_ENABLED` — emergency response never gates on a feature flag
- No change needed

**One addition:** After the emergency call, automatically flag the call_log as `URGENT` (already happens via classification rules for property_mgmt, should be universal).

### Q3: Sequential dial fallback (try person A, then B)?

**Design: Ring group — phased approach.**

**Phase R1 (next):** Add `forwarding_numbers` (plural) JSON column. UI allows up to 3 numbers. Transfer logic tries them sequentially with configurable ring timeout.

```
TwiML:
<Response>
  <Say>Connecting you now...</Say>
  <Dial timeout="20" action="/api/webhook/[slug]/transfer-status">
    <Number>+1555000001</Number>
  </Dial>
  <!-- If first doesn't answer, action URL returns TwiML to try next -->
  <Dial timeout="20" action="/api/webhook/[slug]/transfer-status">
    <Number>+1555000002</Number>
  </Dial>
  <Say>No one is available right now. Your agent will follow up.</Say>
</Response>
```

**Phase R2 (later):** Simultaneous ring — `<Dial>` with multiple `<Number>` elements (Twilio rings all at once, first to pick up wins).

**Phase R3 (defer):** Time-based routing — route to different numbers by business hours / day of week.

### Q4: Hold / elevator music

**Ultravox capability:** The agent can keep talking while the transfer is happening (the SIP INVITE is async). For the HTTP transfer path, the TwiML `<Play>` verb can stream hold music.

**Design:**

```
<Response>
  <Say voice="Polly.Amy">One moment, I'm connecting you now.</Say>
  <Play loop="0">https://api.twilio.com/cowbell.mp3</Play>  <!-- or custom URL -->
  <Dial timeout="30" action="...">
    <Number>...</Number>
  </Dial>
</Response>
```

**Recommendation:** Use Twilio's built-in hold music URL for now. Allow custom hold music URL in settings later (Phase R2).

### Q5: Voicemail transcription fallback

**Design:** When transfer fails (owner doesn't answer):

```
Transfer fails → Return to AI agent → Agent says "They're not available right now,
  would you like to leave a message?" → Agent records the rest of the call →
  Completed webhook classifies + transcribes → Telegram notification with transcript
```

**Problem:** Ultravox `coldTransfer` via SIP doesn't return control to the agent on failure. The call either connects or drops.

**Solution for HTTP transfer path:** The `action` URL in `<Dial>` can detect failed transfer (status != 'completed') and return TwiML that reconnects to Ultravox:

```
POST /api/webhook/[slug]/transfer-status
  → If DialCallStatus = 'no-answer' or 'busy':
    → Return <Response><Connect><Stream url="[ultravox-join-url]"/></Connect></Response>
    → Agent resumes conversation: "Hey, looks like they're tied up..."
```

This requires creating a new Ultravox call mid-Twilio-call, which is supported by Twilio's `<Connect><Stream>` verb.

**Recommendation:** Phase R1 implements this for the HTTP transfer path. `coldTransfer` (SIP) remains fire-and-forget for now.

### Q6: What settings does each feature need?

| Feature | Settings field | Type | Default |
|---------|---------------|------|---------|
| Single transfer | `forwarding_number` | string | null |
| Transfer conditions | `transfer_conditions` | text | "emergency or explicit human request" |
| Ring group | `forwarding_numbers` | JSON array | null (falls back to forwarding_number) |
| Ring timeout | `transfer_ring_timeout` | number (seconds) | 20 |
| Hold music | `hold_music_url` | string (URL) | null (uses Twilio default) |
| Transfer failure behavior | `transfer_failure_action` | enum: 'voicemail' | 'message' | 'hangup' | 'message' |

### Q7: What's the failure UX for each?

| Scenario | Current UX | Proposed UX |
|----------|-----------|------------|
| Transfer succeeds | Caller connected, call proceeds normally | Same |
| Transfer fails (no answer) | Robotic "Sorry, no one was available", call drops | Agent resumes: "They're tied up — want me to take a message?" |
| Transfer fails (busy) | Same as no answer | Same as no answer |
| Transfer fails (error) | 500 error, call may drop | Agent: "I'm having trouble connecting you — let me take your info" |
| All ring group numbers fail | N/A (not built) | Same as single transfer failure |
| Emergency + transfer disabled | Agent gives 911 guidance, takes info for callback | Same (no change needed) |

### Q8: Voicemail as a standalone feature?

**Current:** `voicemail` niche exists but is just a lightweight prompt for call-answering. No actual Twilio voicemail integration.

**Future:** Twilio `<Record>` verb could capture voicemail after business hours or when the AI agent can't help. But this competes with the AI agent itself — why have voicemail when the AI answers?

**Recommendation:** Defer standalone voicemail. The AI agent IS the voicemail replacement. Focus on making the "take a message" flow better (structured message capture + immediate Telegram notification).

---

## 3. Recommended Implementation Order

| Phase | Feature | Effort | Dependencies |
|-------|---------|--------|-------------|
| **R1** | Transfer failure recovery (HTTP path) | Medium | New `/transfer-status` route, TwiML reconnect to Ultravox |
| **R1** | Transfer failure UX in prompt | Low | Add prompt template section for failed transfer recovery |
| **R2** | Ring group (sequential, 2-3 numbers) | Medium | `forwarding_numbers` column, UI, TwiML chain |
| **R2** | Hold music (Twilio default) | Low | TwiML `<Play>` in transfer route |
| **R3** | Custom hold music URL | Low | Settings field + UI |
| **R3** | Simultaneous ring | Low | `<Dial>` with multiple `<Number>` |
| **R4** | Time-based routing | Medium | Business hours logic already exists in agent-context.ts |
| **Defer** | DTMF IVR menu | N/A | Against product philosophy |
| **Defer** | Standalone voicemail recording | N/A | AI agent replaces voicemail |
| **Defer** | Transfer through owner's IVR (agent dials DTMF) | High | Complex, niche use case |

---

## 4. Blockers & Unknowns

| Item | Status | Impact |
|------|--------|--------|
| Ultravox `coldTransfer` SIP doesn't return control on failure | **Confirmed limitation** | HTTP transfer path must be used for failure recovery |
| Twilio `<Connect><Stream>` mid-call reconnect to Ultravox | **Untested** | Core dependency for R1 — needs spike test |
| Ultravox call mid-stream resume after Twilio redirect | **Unknown** | May need to create a new Ultravox call entirely |
| Ring group concurrent ring + first-pickup-wins with Twilio | **Twilio supports it** | `<Dial>` with multiple `<Number>` children |
| Hold music licensing for custom URLs | **N/A for now** | Twilio default is royalty-free |

---

## 5. Architecture Sketch (Phase R1)

```
                                     ┌─────────────────────┐
                                     │   Owner's Phone     │
                                     │   (forwarding_num)  │
                                     └──────────┬──────────┘
                                                │
                                          answers? ──── YES → connected
                                                │
                                               NO (30s timeout)
                                                │
                                                ▼
┌──────────────┐    coldTransfer    ┌───────────────────────┐
│  Ultravox    │ ──── SIP ────────►│  Twilio Dial          │──► call drops (current)
│  AI Agent    │                   │                       │
│              │    transferCall   │  /transfer route      │
│              │ ──── HTTP ───────►│  → redirectCall()     │
│              │                   │  → <Dial timeout=30>  │
│              │                   │  → action=/transfer-  │
│              │                   │    status              │
└──────────────┘                   └──────────┬────────────┘
                                              │
                                        DialCallStatus
                                        = 'no-answer'
                                              │
                                              ▼
                                   ┌──────────────────────┐
                                   │ /transfer-status     │
                                   │ route (NEW)          │
                                   │                      │
                                   │ Creates new Ultravox │
                                   │ call + returns       │
                                   │ <Connect><Stream>    │
                                   │ to resume AI agent   │
                                   └──────────────────────┘
```

**Key decision:** Phase R1 only works for the HTTP transfer path (transferCall tool). The coldTransfer (SIP) path remains fire-and-forget. This is acceptable because:
- New clients use the HTTP path by default (it's what `sync-agent` configures)
- The HTTP path already sends an SMS alert
- The SIP path is a fallback/optimization, not the primary

---

## 6. Settings UI Changes (Phase R1)

No new UI in R1. The existing forwarding_number + transfer_conditions settings are sufficient.

**Phase R2 UI additions:**
- Ring group: Multi-number input (up to 3 numbers, drag to reorder)
- Ring timeout: Slider (10-60 seconds, default 20)
- Hold music: Toggle + optional custom URL input
- Transfer failure action: Radio group (Take message / Hang up)
