---
name: Voice Agent Research 2026
description: Comprehensive research on voice agent naturalness, TTS providers, VAD tuning, and prompt engineering — apply universally when hasan-sharif tests pass
type: project
---

# Voice Agent Research 2026

Compiled Mar 14 2026. All findings from the voice agent improvement research session. Use this document to apply improvements universally to all clients once hasan-sharif pilot testing passes.

---

## 1. Platform Comparison

| Platform | Human-Likeness | Latency | Cost/min | Key Strength |
|----------|---------------|---------|----------|--------------|
| **Retell AI** | High — multi-voice, node-based conversation flow | 800ms avg | $0.07-0.15 | No-code wizard + pre-built niche templates (healthcare, RE, scheduling). "3 minutes to deploy" claim. |
| **Vapi AI** | Medium-High — Prompt Composer guided editor | 500-900ms | $0.05 base + LLM/TTS costs | Developer-first API, composable pipeline (pick your own LLM + TTS). 4 starter templates. |
| **Synthflow AI** | High — drag-and-drop BELL loop builder | 600-1000ms | $0.08-0.12 | No-code industry packages (HVAC, dental, coaching, retail). 200+ integrations. 3-week typical deployment. |
| **Bland AI** | Medium — Conversational Pathways (node + prompt hybrid) | 400-700ms | $0.09-0.14 | Enterprise stack — no Twilio needed (Bland owns telephony). $15/mo per number. API-first. |
| **Ultravox** (our stack) | High — speech-native (frozen Llama 3.3 70B), no STT/TTS pipeline | 200-400ms (best-in-class) | $0.04-0.06 | Lowest latency. Speech-native model = no STT-to-LLM-to-TTS chain. BYOK TTS. Per-call VAD tuning. |
| **Air AI** | Unknown — enterprise-gated | Unknown | Enterprise pricing | Fully managed enterprise deployments (airlines, banks, hospitality). No self-serve. Sales cycle = weeks-months. |

**Why we stay on Ultravox:** Latency is the single most important factor for human-likeness in phone conversations. Ultravox's speech-native architecture avoids the 3-step STT/LLM/TTS pipeline that adds 300-600ms per turn in other platforms. At 200-400ms response time, callers perceive the agent as "thinking at normal human speed." Combined with BYOK TTS (see Section 3), we get both fast responses AND natural voice quality.

---

## 2. SSML Support — NOT Available in Ultravox

### Why SSML Does Not Apply

Ultravox is a **speech-native model** — a frozen Llama 3.3 70B backbone that generates speech tokens directly, not a traditional STT-to-LLM-to-TTS pipeline. This architecture means:

- **No `<break>` tags** — the model does not parse XML mid-generation
- **No `<emotion>` tags** — no prosody control via markup
- **No `<prosody>` tags** — pitch, rate, and volume are not controllable via SSML
- **No laughter tags or sound effects** — the model generates speech, not audio effects

### How Voice Control Actually Works in Ultravox

1. **Prompt engineering** — The primary lever. Instructing the model to "speak naturally with pauses" or "use backchannels like mmhmm" affects output because the speech model was trained on natural conversational data.
2. **Voice selection** — Different Ultravox voices (or BYOK voices via ElevenLabs/Cartesia) have different inherent warmth, pace, and emotional range.
3. **"..." for pauses** — Per the Ultravox prompting guide, using ellipsis in the system prompt creates natural pauses in speech output. This is the correct approach and is already implemented in all our client prompts.
4. **Filler words in prompt** — Writing "uh", "um", "mmhmm" directly in the prompt causes the model to produce them vocally. Already implemented.

### What We Cannot Do (And Alternatives)

| Desired Effect | SSML Approach (unavailable) | Our Approach |
|---------------|---------------------------|--------------|
| Pause mid-sentence | `<break time="500ms"/>` | Use "..." in prompt examples |
| Slow down for emphasis | `<prosody rate="slow">` | Prompt: "slow down when confirming names or addresses" |
| Sound empathetic | `<emotion type="empathy">` | Prompt: "if the caller sounds frustrated, slow down and acknowledge first" |
| Laugh naturally | `<say-as interpret-as="interjection">haha</say-as>` | Not achievable — avoid attempting |
| Whisper | `<amazon:effect name="whispered">` | Not achievable — avoid attempting |

---

## 3. External TTS — BYOK Supported

Ultravox supports Bring Your Own Key (BYOK) TTS providers. This lets us use higher-quality voices while keeping Ultravox's low-latency speech-native architecture for understanding and reasoning.

### Provider Comparison

| Provider | Input Streaming | Word Timing | Emotion Control | Notes |
|----------|----------------|-------------|-----------------|-------|
| **Cartesia** (sonic-2) | Yes | Yes | Yes — neutral, calm, angry, content, sad, scared per utterance | Lowest latency (150-300ms). Emotion tags in prompt. Best price/performance ratio. |
| **ElevenLabs** | Yes | Yes | No — voice inherits tone from training data | Most natural voices (95% human-like in blind tests). Turbo v2.5 for low latency. Highest quality but no emotion steering. |
| **LMNT** | Yes | Yes | No | Fast, affordable. Good for high-volume deployments. Limited voice library. |
| **PlayHT** | Yes | Yes | Partial — emotion via voice cloning | Play3.0-mini model. Voice cloning is strong. Latency higher than Cartesia. |
| **Google Cloud TTS** | No | Yes | No | Most language coverage. Not competitive for conversational use. |
| **Inworld** | Yes | No | Yes — context-aware emotion | Gaming-focused. Not production-ready for phone agents. |

### Setup Process (BYOK in Ultravox)

1. Ultravox Console -> Settings -> BYOK
2. Add API key for chosen provider (e.g., Cartesia API key)
3. Reference provider voice definition in agent config:
   ```
   voice: "cartesia://sonic-2/voice-id-here"
   ```
4. Test via dashboard test call before pushing to production

### Recommendation

**Cartesia sonic-2** is the best fit for our use case:
- Emotion control per utterance (can sound calm for property mgmt, energetic for auto glass)
- Lowest TTS latency (150-300ms) — preserves our speed advantage
- Competitive pricing
- Input streaming + word timing = no degradation of Ultravox's turn-taking

**ElevenLabs** is the fallback if Cartesia voices don't match our persona requirements (ElevenLabs has the deepest voice library).

---

## 4. VAD Tuning — Per-Call Configurable

### What VAD Controls

Voice Activity Detection (VAD) determines when the AI thinks the caller has finished speaking. Getting this wrong causes either:
- **Too short (agent cuts off caller)** — caller feels interrupted, gets frustrated
- **Too long (agent waits too long to respond)** — dead air, caller thinks line dropped

### Parameters

| Parameter | What It Controls | Default | Unit |
|-----------|-----------------|---------|------|
| `turnEndpointDelay` | How long to wait after caller stops speaking before responding | 640ms | seconds (e.g., "0.64s") |
| `minimumTurnDuration` | Minimum length of caller speech to count as a real turn | 100ms | seconds (e.g., "0.1s") |
| `minimumInterruptionDuration` | How long caller must speak during agent's turn to count as an interruption | 200ms | seconds (e.g., "0.2s") |
| `frameActivationThreshold` | Audio energy level required to trigger speech detection | (Ultravox default) | 0.0-1.0 |

### Per-Client VAD Profiles — APPLIED Mar 14 2026

Different niches have fundamentally different caller behavior:

| Profile | turnEndpointDelay | Use Case | Rationale |
|---------|-------------------|----------|-----------|
| **Fast** | 400ms | Auto glass (windshield-hub) | Callers are often stressed, want quick answers. Fast response = competent shop. |
| **Balanced** | 480ms | Real estate (hasan-sharif) | Mixed caller types — some chatty, some terse. Balanced timing handles both. |
| **Patient** | 608ms | Property management (urban-vibe) | Emotional callers (maintenance emergencies, billing disputes). Need space to think and explain. Hesitant callers trail off — 608ms prevents cutting them off. |

### Implementation (inbound/route.ts)

The per-client VAD map is defined in `/agent-app/src/app/api/webhook/[slug]/inbound/route.ts`:

```typescript
const CLIENT_VAD: Record<string, Record<string, string>> = {
  'hasan-sharif': { turnEndpointDelay: '0.480s' },
  'windshield-hub': { turnEndpointDelay: '0.400s' },
  'urban-vibe': { turnEndpointDelay: '0.608s' },
}
const clientVad = CLIENT_VAD[slug]
```

The `vadSettings` are passed to `callViaAgent()` as a per-call override — they do not modify the persistent agent profile. This means:
- Different clients get different VAD on every call automatically
- No Ultravox agent PATCH needed
- Can be tuned per-call in the future (e.g., returning caller = more patient)

### Default VAD (ultravox.ts)

The global defaults in `ultravox.ts` remain unchanged for the `createCall` fallback path:
```typescript
const DEFAULT_VAD = {
  turnEndpointDelay: '0.64s',
  minimumTurnDuration: '0.1s',
  minimumInterruptionDuration: '0.2s',
}
```

---

## 5. Prompt Engineering Improvements — Applied to hasan-sharif (Pilot)

### 5a. Grammar-Breaking Rules (APPLIED)

**Research finding:** LLMs default to grammatically correct output. On a phone call, grammatically correct speech sounds robotic — humans do not speak in perfect sentences. Every major voice agent prompting guide (Ultravox, ElevenLabs, Vapi) recommends explicitly instructing the model to break grammar.

**Section added to hasan-sharif SYSTEM_PROMPT.txt:**

```
# GRAMMAR AND SPEECH PATTERNS — SOUND HUMAN, NOT SCRIPTED

Break grammar naturally — humans do not speak in perfect sentences. Follow these patterns:
Start sentences with "And", "But", "So", or "Like" regularly.
Use "gonna" instead of "going to", "kinda" instead of "kind of", "wanna" instead of "want to."
Drop words the way people do: "sounds good" instead of "that sounds good to me."
Use "like" as a filler occasionally: "so like, what property are you looking at?"
Trail off naturally mid-thought: "yeah so he's... he's really good at getting back to people."
Repeat a word when shifting gears: "okay okay, so what's your name?"
Use sentence fragments: "For sure." "No worries." "Totally." "Makes sense."
Never speak in complete, grammatically perfect paragraphs — it sounds robotic.
```

**Why this works:** The Ultravox speech model was trained on conversational data. When the prompt explicitly models broken grammar patterns, the model follows them. Without this section, the model defaults to its LLM training data bias (formal, grammatically correct prose).

### 5b. Expanded Inline Examples (APPLIED)

**Research finding:** Every behavioral rule needs 3+ example sentences scattered across multiple sections. A single example per rule is insufficient — the model treats one example as a suggestion, but 3+ examples as a pattern to internalize.

**7 new examples added to hasan-sharif:**

| Example | Scenario | Why Added |
|---------|----------|-----------|
| **A** | Caller gives info unprompted | Teaches model to skip steps when info is volunteered. Shows natural "got it [Name]" acknowledgment + immediate follow-up question. |
| **B** | Caller asks about multiple service areas | Demonstrates answering a coverage question then narrowing. Models "so like... which city are you focused on right now?" |
| **C** | Islamic greeting | Cultural sensitivity — "Wa Alaikum Assalam!" then continue naturally. Critical for Hasan's client base. |
| **D** | Caller wants a CMA or property valuation | Never give a valuation. Shows "yeah totally, Hasan can do that for you" deflection + info collection. |
| **E** | Returning caller with context | Shows how to use injected caller history naturally — reference prior interaction without reading back full history. |
| **F** | Caller wants to text instead | Validates texting as the fast path. Shows "you can text this same number" encouragement without pushing for more info. |
| **G** | Spam robocall | Quick disposal — "thanks, but we're all set" + immediate hangUp. No engagement with pre-recorded messages. |

**Previous state:** hasan-sharif had 0 inline examples. windshield-hub and urban-vibe had 3-6 each. The research shows 7+ is the minimum for reliable behavioral adherence across diverse call scenarios.

### 5c. Per-Client VAD (APPLIED)

See Section 4 above. The code change was made in `inbound/route.ts` — a `CLIENT_VAD` map that passes `vadSettings` to `callViaAgent()` per call. Applied to all 3 production clients on Mar 14 2026.

---

## 6. Planned Improvements — For Universal Rollout After Testing

These improvements are staged for rollout after hasan-sharif pilot calls confirm the prompt engineering and VAD changes are working well. Do NOT apply these until pilot testing passes.

### 6a. urban-vibe — New Inline Examples

Add after pilot passes. Target: 4 new examples covering gaps in current prompt.

| Example | Scenario | Why Needed |
|---------|----------|------------|
| Pest issue report | Tenant calls about mice/roaches/bedbugs | High-frequency call type for Calgary rentals. Model needs to know: collect unit + description, do NOT advise on pest control, route to Ray. Flag bedbugs as [URGENT]. |
| Lease renewal question | Tenant asking about renewal terms | Model must deflect all lease terms to Ray. "Ray can walk you through your options — what's your name and unit?" |
| Caller with language barrier | Caller speaks broken English | Current prompt says "sorry, I only speak English" but needs a softer approach — try to work with them, collect name if possible, note language preference. |
| Viewing request with specific property | Prospect names a specific address or Kijiji listing | Model should acknowledge the property, collect name, route to Ray. Never confirm availability or price. |

### 6b. windshield-hub — New Inline Examples

Add after pilot passes. Target: 4 new examples covering gaps in current prompt.

| Example | Scenario | Why Needed |
|---------|----------|------------|
| ADAS calibration question | Caller asks "do you do calibration?" or "my car has lane assist" | High-value upsell — model should explain calibration is needed for windshields with cameras, collect vehicle info. |
| Price comparison caller | "I'm getting quotes from a few places" | Model should not quote prices. "I can get the boss to call ya back with a quote — what year make and model?" Keep it fast — comparison shoppers are impatient. |
| Mobile service request | "Can you come to my house/work?" | Windshield Hub does mobile service. Collect address + vehicle info. "yeah we do mobile — lemme grab your vehicle info and location." |
| Tint inquiry | "Do you do window tinting?" | Windshield Hub offers tinting. Collect vehicle info. "yeah we do tint too — what year make and model?" |

### 6c. Grammar-Breaking Section — Universal

Add the `GRAMMAR AND SPEECH PATTERNS` section (see 5a above) to:
- [ ] windshield-hub SYSTEM_PROMPT.txt
- [ ] urban-vibe SYSTEM_PROMPT.txt
- [ ] PROMPT_TEMPLATE_INBOUND.md (canonical template for new clients)
- [ ] prompt_builder.ts (inject as a standard section in all generated prompts)
- [ ] prompt_builder.py (same — keep in sync)

### 6d. Template v4.0 Upgrade Checklist

When rolling out universally, upgrade the canonical template to v4.0 with:
- [ ] Add GRAMMAR BREAKING section (standardized text, niche-agnostic)
- [ ] Expand inline examples to 10 minimum (3 niche-agnostic + 7 niche-specific)
- [ ] Add VAD_PROFILE variable (`fast` / `balanced` / `patient`) — prompt_builder maps to turnEndpointDelay
- [ ] Document BYOK TTS option in template comments (for clients who want premium voices)
- [ ] Add a `SPEECH PATTERNS` section replacing the current `VOICE NATURALNESS` section (more specific, with contractions list + filler word guidance)
- [ ] Standardize backchannel vocabulary per niche (auto glass: "gotcha", "right on"; real estate: "got it", "mm-hmm"; property mgmt: "yes", "right", "got it")

---

## 7. Cartesia TTS Pilot — Planned

### Target Setup

| Parameter | Value |
|-----------|-------|
| Provider | Cartesia |
| Model | sonic-2 |
| Target client | hasan-sharif (Aisha) |
| Emotion control | Per-utterance: calm (default), content (when confirming info), neutral (information delivery) |
| Setup method | Ultravox Console -> BYOK -> Cartesia API key |

### Voice Selection Criteria

The current Aisha voice (Ultravox voice ID `87edb04c-...`) is warm and friendly. The Cartesia replacement must match:
- **Gender:** Female
- **Warmth:** High — office assistant, not call center
- **Pace:** Moderate — not rushed, not drawn out
- **Age:** Mid-20s to early 30s
- **Accent:** Neutral North American

### Steps to Execute

1. Add Cartesia API key to Ultravox Console BYOK settings
2. Browse Cartesia voice library for warm female voices matching criteria above
3. Create a test agent with Cartesia voice + current hasan-sharif prompt
4. Run 3 test calls comparing Cartesia voice vs current Ultravox voice
5. If Cartesia passes: update `clients.agent_voice_id` in Supabase + PATCH Ultravox agent
6. If Cartesia fails: try ElevenLabs BYOK as fallback

### Emotion Control Integration

Cartesia sonic-2 supports per-utterance emotion tags in the text sent to TTS. If the system prompt includes emotional context cues, the TTS can adjust:
- Empathetic acknowledgment: `[calm]` "i hear you, that's frustrating... let's get this sorted"
- Upbeat greeting: `[content]` "hey! this is Aisha from Hasan's office..."
- Neutral info delivery: `[neutral]` "Hasan covers Saskatoon, Prince Albert, Calgary, and Edmonton"

**Note:** The emotion tag format depends on Ultravox's BYOK integration specifics. Test in sandbox before production. The emotion tags may need to be embedded in the system prompt examples or handled at the TTS layer.

---

## 8. Potential Skill: /prompt-upgrade

If hasan-sharif pilot tests pass (target: 5+ test calls with positive quality scores), create a `/prompt-upgrade` skill that automates the improvements for any client.

### Proposed Skill Flow

```
/prompt-upgrade [client-slug]

1. Read current client prompt from clients/{slug}/SYSTEM_PROMPT.txt
2. Check for GRAMMAR BREAKING section — inject if missing
3. Check inline example count — if < 7, add niche-specific examples from catalog
4. Check VAD profile — if not in CLIENT_VAD map, add with niche-appropriate delay
5. Optionally configure Cartesia BYOK (if --tts flag passed)
6. Write updated prompt to SYSTEM_PROMPT.txt
7. Remind to run /prompt-deploy [client] to push live
```

### Example Catalog (per niche)

The skill would pull from a catalog of pre-written examples per niche:

| Niche | Example Count | Coverage |
|-------|--------------|----------|
| `real_estate` | 7 | Unprompted info, service areas, Islamic greeting, CMA request, returning caller, text preference, spam |
| `auto_glass` | 7 | ADAS calibration, insurance question, mobile service, tint inquiry, price comparison, delivery, returning caller |
| `property_mgmt` | 7 | Emergency maintenance, rental prospect, escalation to manager, billing question, gas leak, pest report, lease renewal |
| `voicemail` | 3 | (Lightweight — greeting, message, goodbye) |
| `other` | 5 | Generic business inquiry, wrong number, spam, returning caller, text preference |

### VAD Profile Mapping

| Niche | Profile | turnEndpointDelay | Rationale |
|-------|---------|-------------------|-----------|
| `auto_glass` | fast | 400ms | Stressed callers, want quick answers |
| `real_estate` | balanced | 480ms | Mixed caller types |
| `property_mgmt` | patient | 608ms | Emotional/hesitant callers |
| `outbound_isa_realtor` | balanced | 480ms | Outbound — need to give prospect time to respond |
| `print_shop` | balanced | 480ms | Mixed — design questions can be complex |
| `voicemail` | patient | 608ms | Callers leaving messages — let them finish |
| `other` | balanced | 480ms | Default |

---

## 9. Twilio Number Audit — Mar 14 2026

### All Numbers

| Number | Client | Status | Voice Webhook | SMS Webhook | Action |
|--------|--------|--------|---------------|-------------|--------|
| +15877421507 | hasan-sharif (Aisha) | **Active** | Railway `/api/webhook/hasan-sharif/inbound` | n8n (legacy) | Port SMS webhook to Railway |
| +15873551834 | windshield-hub (Mark) | **Active** | Railway `/api/webhook/windshield-hub/inbound` | Railway | None |
| +15873296845 | urban-vibe (Alisha) | **Active** | Railway `/api/webhook/urban-vibe/inbound` | Railway | None |
| +15878014602 | manzil-isa (Fatima) | **Stale** | n8n (TEST MODE) | n8n | Decision needed: activate on Railway or release |
| +1587XXXXXXX | (unknown/idle) | **Idle** | Unknown | Unknown | Review — likely purchased during testing. Release if unused. |
| +1587XXXXXXX | (unknown/idle) | **Idle** | Unknown | Unknown | Review — likely purchased during testing. Release if unused. |
| +1587XXXXXXX | (unknown/idle) | **Idle** | Unknown | Unknown | Review — likely purchased during testing. Release if unused. |
| +1587XXXXXXX | (unknown/idle) | **Idle** | Unknown | Unknown | Review — likely purchased during testing. Release if unused. |

**Note:** The 4 idle/unknown numbers need to be identified via Twilio console. They were likely purchased during dev/testing and are accruing monthly charges ($1.15/mo CAD each). Run `twilio phone-numbers list` to get the full inventory.

### Summary

| Status | Count | Monthly Cost |
|--------|-------|-------------|
| Active (production) | 3 | ~$3.45/mo |
| Stale (manzil-isa, test mode) | 1 | ~$1.15/mo |
| Idle (unknown, review needed) | 4 | ~$4.60/mo |
| **Total** | **8** | **~$9.20/mo** |

### Action Items

1. **hasan-sharif SMS webhook** — Still pointing to n8n. Port to Railway `/api/webhook/hasan-sharif/sms` endpoint (needs to be created). This is the last n8n dependency for a production client.
2. **manzil-isa** — Decide: if Manzil is going to launch, switch to Railway. If not, release the number.
3. **4 idle numbers** — Audit via Twilio console. Release any that are not tied to a client or test plan. Saves ~$4.60/mo.
4. **Next billing cycle review** — Set calendar reminder to re-audit Twilio numbers monthly. Each unused number is $1.15/mo wasted.

---

## 10. Research Sources and Methodology

This document was compiled from:
- Ultravox API documentation (agents, calls, VAD settings, BYOK TTS)
- Ultravox prompting guide (speech-native model behavior, "..." pause technique, filler words)
- Cartesia sonic-2 documentation (emotion control, input streaming, word timing)
- ElevenLabs Conversational AI documentation (BYOK integration, voice quality benchmarks)
- Competitor platform documentation (Retell, Vapi, Synthflow, Bland, Air)
- Prior research in `memory/competitor-research-onboarding-2026-03-09.md`
- Production call quality analysis across hasan-sharif, windshield-hub, and urban-vibe
- Live code review of `inbound/route.ts`, `ultravox.ts`, and all 3 client SYSTEM_PROMPT.txt files

---

## Appendix: Quick Reference — What Was Applied vs What Is Planned

| Change | hasan-sharif | windshield-hub | urban-vibe | Template v4.0 |
|--------|-------------|----------------|------------|---------------|
| Grammar-breaking section | APPLIED | Planned | Planned | Planned |
| Expanded inline examples (7+) | APPLIED (7 new) | Planned (4 new) | Planned (4 new) | Planned (10 min) |
| Per-client VAD | APPLIED (480ms) | APPLIED (400ms) | APPLIED (608ms) | Planned (variable) |
| Cartesia BYOK TTS | Planned (pilot) | After pilot | After pilot | Documented |
| /prompt-upgrade skill | After pilot | After pilot | After pilot | N/A |

**Gate for universal rollout:** 5+ test calls on hasan-sharif with quality_score >= 7 and no regression in caller satisfaction or call completion rate.

---

## 11. Canadian Regulatory Compliance (CRTC)

*Research date: March 14, 2026*

### 11.1 Does Operating an AI Receptionist in Canada Require a CRTC License?

**Short answer: No specific AI license exists. Obligations depend entirely on call direction.**

| Call Type | Regulatory Obligation |
|-----------|----------------------|
| **Inbound** (AI answers calls the business receives) | No DNCL registration. No CRTC license. The business is receiving calls it did not initiate — DNCL rules do not apply. |
| **Outbound** (AI dials leads/customers) | Must register with National DNCL. Must comply with CRTC Unsolicited Telecommunications (UT) Rules. Cannot call DNCL-listed numbers without an exemption. Internal DNC list required (add within 14 days, retain 3 years). |

**unmissed.ai use case:** All 3 production clients are inbound-only. No DNCL registration is required for the platform or for clients under the current product.

If a client ever launches an outbound AI calling campaign, they (or unmissed.ai on their behalf) must register with National DNCL before the first outbound call.

---

### 11.2 Who Holds the Telecom License When We Provision a Phone Number?

Under CRTC Telecom Regulatory Policy 2019-354, any entity reselling local telephone, local VoIP, wireless voice, or interexchange services **must register as a telecommunications provider** with the CRTC.

**Twilio** is the CRTC-registered telecom carrier/reseller. They hold regulatory standing to provision Canadian numbers and publish Canadian Voice Guidelines confirming their compliance obligations.

**unmissed.ai** operates at the **application layer**, not the carrier layer. We purchase numbers from Twilio's inventory and route calls through Twilio's infrastructure. We are not a telecom reseller — we sell a software application that runs on top of a licensed carrier. No CRTC registration is required of unmissed.ai for this.

**Regulatory liability stack:**

```
Twilio (CRTC-registered carrier)
  — holds the number, responsible for telecom layer, 911 routing
    ↓
unmissed.ai (software platform)
  — routes calls, runs AI, stores call data (PIPEDA obligations)
    ↓
Client business
  — responsible for call content, DNCL compliance if outbound, CASL for follow-up SMS/email
```

---

### 11.3 Other Compliance Obligations (All Clients)

| Obligation | Who It Applies To | Notes |
|-----------|------------------|-------|
| **PIPEDA** | unmissed.ai + every client | Applies to collection/storage of call recordings and caller data. Callers must be informed if the call is recorded. Our agent templates already disclose this. |
| **CASL** | Outbound follow-up SMS/email | AI sends SMS after call — commercial electronic messages require consent. Inbound callers who initiated contact = implied consent (low risk). Cold outbound SMS requires express consent. |
| **CRTC UT Rules / DNCL** | Outbound AI calls only | Not applicable to current inbound-only clients. Required if any client launches outbound cold-calling campaigns. |
| **CRTC AI Disclosure** | Not yet mandated in Canada | No current CRTC rule requires "this is an AI" disclosure (unlike emerging FCC direction in the US). Best practice: disclose anyway. Our template already does ("Hi, I'm [Name], a virtual assistant for..."). |
| **9-1-1 obligations** | Twilio (carrier layer) | Twilio is responsible for 911 routing on provisioned numbers. Not unmissed.ai's obligation. |

---

### 11.4 Key Sources

- CRTC Telecom Regulatory Policy 2019-354 — reseller registration obligation
- CRTC Unsolicited Telecommunications Rules — National DNCL (telemarketing compliance)
- CRTC Responsibilities — Non-Facilities-Based Providers (reseller exemptions)
- Twilio Canada Voice Guidelines (twilio.com/en-us/guidelines/ca/voice)
- CRTC Broadcasting Regulatory Policy 2025-299 — AI in broadcasting (not telecom, but signals regulatory direction)
- NLPearl AI legal landscape guide (AI phone agents — inbound/outbound compliance overview)
