# Call-Path Capability Matrix

> Source of truth: derived from code as of 2026-03-25.
> All claims are traced to specific files. Items marked [UNVERIFIED] could not be confirmed from read code.

---

## 1. Call Path Inventory

### Path A — Live Inbound Phone (PSTN production path)
**Initiator:** Twilio receives a PSTN call on a client's purchased number and POSTs to `/api/webhook/[slug]/inbound`.

**Code path:**
1. `src/app/api/webhook/[slug]/inbound/route.ts` — Twilio signature validation, IVR gate check, rate limiting, minute-limit enforcement, grace period and trial-expiry guards.
2. Calls either `callViaAgent()` (Agents API, preferred) or `createCall()` (per-call fallback) from `src/lib/ultravox.ts`.
3. Returns `<Connect><Stream>` TwiML that bridges the PSTN call into the Ultravox WebSocket.
4. If Ultravox call creation fails entirely, falls back to voicemail TwiML via `buildVoicemailTwiml()`.

**Note on sub-variants:**
- If `ivr_enabled=true` on the client, the first POST to `/inbound` returns `<Gather>` TwiML instead of immediately connecting. Caller presses digit at `/api/webhook/[slug]/ivr-gather`. Pressing 1 routes to voicemail; anything else redirects to `/inbound?skip_ivr=1`.
- If the client has `ultravox_agent_id` set (all active Railway-native clients do), the Agents API path is used. If that call fails, `createCall()` is the safety net.

---

### Path B — Browser Demo / Public WebRTC (marketing demo)
**Initiator:** Marketing page visitor clicks "Talk to Agent". The browser calls `POST /api/demo/start` with a `demoId` (one of `auto_glass`, `property_mgmt`, `real_estate`) or `mode=preview` with `onboardingData`.

**Code path:**
1. `src/app/api/demo/start/route.ts` — global demo budget check, per-IP rate limit.
2. Calls `createDemoCall()` from `src/lib/ultravox.ts` with `medium` omitted (no Twilio medium = WebRTC browser call).
3. Returns `joinUrl` to the browser; frontend uses Ultravox Client SDK to connect WebRTC.
4. If `demo.useLivePrompt && demo.clientSlug`, fetches live prompt from Supabase and resolves `{{templateContext}}` placeholders before the call.

**Sub-variant — Preview mode:** Called during onboarding step to let the prospect hear a generated prompt. Prompt is built live from `body.onboardingData` via `buildPromptFromIntake()`. No Supabase client lookup.

---

### Path C — Trial Success Screen WebRTC (post-signup first-listen)
**Initiator:** New trial user lands on the success screen after `POST /api/provision/trial`. Screen calls `POST /api/trial/test-call`.

**Code path:**
1. `src/app/api/trial/test-call/route.ts` — per-IP + per-clientId rate limits, no auth required.
2. Fetches `system_prompt` and `agent_voice_id` from Supabase by `clientId` (supplied in POST body).
3. Calls `createDemoCall()` — no Twilio medium, no tools, 180s max duration.
4. Returns `joinUrl` for the browser Ultravox SDK.

**Key difference from Path A:** Uses the client's real `system_prompt` from Supabase but **no context injection** (no callerContext, no businessFacts, no templateContext resolution). The prompt is used raw.

---

### Path D — Dashboard Owner WebRTC Test Call (in-dashboard live test)
**Initiator:** Authenticated dashboard user (owner or admin) triggers a browser-based test call from the settings panel. Calls `POST /api/dashboard/test-call` with a target phone number.

**Wait — this path actually dials PSTN outbound, not WebRTC.** The route creates an Ultravox call (Agents API or `createCall` fallback), then uses the Twilio REST API (`twilioClient.calls.create`) to make an outbound dial to `toPhone`. Twilio dials the test phone, answers with the Ultravox stream TwiML.

**Code path:**
1. `src/app/api/dashboard/test-call/route.ts` — authenticated (owner or admin via `client_users`).
2. Builds full `buildAgentContext()` — same context injection as Path A.
3. Uses Agents API (`callViaAgent`) if `ultravox_agent_id` exists, else `createCall` fallback.
4. Calls `twilioClient.calls.create` to dial `toPhone` with the stream TwiML.

---

### Path E — Admin Test Call / Prompt Preview (admin-only WebRTC)
**Initiator:** Admin calls `POST /api/admin/test-call` with a raw `prompt` string.

**Code path:**
1. `src/app/api/admin/test-call/route.ts` — requires `role='admin'` in `client_users`.
2. Calls `createDemoCall()` with the supplied prompt, no medium (WebRTC), 180s max, no tools.
3. Returns `joinUrl` for in-browser connection.

**Key difference:** No client config, no context injection, no tools. Pure prompt smoke test.

---

### Path F — Outbound Calling
No outbound calling path was found in the codebase (no `/api/outbound`, no `dialOut` route, no campaign dialer). The only outbound Twilio dial is Path D (admin test call to a specific number), which is a one-off test mechanism, not a calling campaign.

---

## 2. Capability Matrix Table

| Capability | A: Live Inbound (PSTN) | B: Browser Demo (public) | C: Trial Success WebRTC | D: Dashboard Test Outbound | E: Admin Prompt Test WebRTC |
|---|---|---|---|---|---|
| **Prompt/config source** | `clients.system_prompt` from Supabase (live row) | `DEMO_AGENTS[demoId].systemPrompt` hardcoded, or live Supabase prompt if `useLivePrompt=true`; preview mode: generated from onboarding data | `clients.system_prompt` from Supabase by clientId | `clients.system_prompt` from Supabase | Raw `prompt` string from POST body |
| **Ultravox call creation function** | `callViaAgent()` (Agents API) primary, `createCall()` fallback | `createDemoCall()` | `createDemoCall()` | `callViaAgent()` primary, `createCall()` fallback | `createDemoCall()` |
| **Tool builder path** | `buildAgentTools()` — full plan-gated tool assembly stored in `clients.tools`; injected via `overrideTools` at call time | `buildDemoTools()` — capability-driven; calendar and SMS possible; transfer ALWAYS false for browser | None — no tools injected | None — `callViaAgent` without `overrideTools`; Agents API uses the stored agent tools [UNVERIFIED whether stored tools fire] | None |
| **Plan gating enforced** | YES — `buildAgentTools()` gates on `getPlanEntitlements()`; disclaimer injected into prompt for gated capabilities | NO — demo tools are capability-flag driven, not plan-gated | NO — no tools injected | PARTIAL — if Agents API path used, agent tools were built with plan gating at last `updateAgent()` call; no runtime re-check | NO |
| **Caller context injected** | YES — `buildAgentContext()` produces `callerContextBlock`, `businessFacts`, `contextData` blocks; injected as `templateContext` (Agents API) or appended to prompt (createCall fallback) | PARTIAL — name/phone/email from POST body injected as `[DEMO MODE — BROWSER\nCALLER NAME: ...\n...]` inline; no after-hours, no returning caller | NO — prompt used raw, no context blocks | YES — `buildAgentContext()` used; same injection as Path A | NO |
| **Returning caller detection** | YES — queries `call_logs` for prior calls by `caller_phone + client_id`; injects summary | NO | NO | NO (prior calls not queried) | NO |
| **After-hours detection** | YES — `detectAfterHours()` from `agent-context.ts`; injects `OFFICE STATUS:` note | NO | NO | NO | NO |
| **DTMF / IVR available** | YES — if `ivr_enabled=true`, `<Gather>` plays before agent connection; 1=voicemail, else=agent | NO — WebRTC has no DTMF support | NO | NO (PSTN outbound but Ultravox stream; DTMF not wired) | NO |
| **Transfer meaningful** | YES — requires `forwarding_number` + plan entitlement (`pro` plan); `transferCall` tool → `POST /api/webhook/[slug]/transfer` → Twilio `redirectCall()` | NO — `hasPhoneMedium: false` hardcoded; transfer always disabled | NO — no tools | NO — no tools in this path [UNVERIFIED] | NO |
| **Voicemail meaningful** | YES — two entry points: (1) IVR digit 1, (2) Ultravox creation failure fallback; recording stored to Supabase storage | NO | NO | NO | NO |
| **SMS during call meaningful** | YES — requires `sms_enabled=true`, `twilio_number` set, plan entitlement; `sendTextMessage` tool → `POST /api/webhook/[slug]/sms` → Twilio | PARTIAL — `buildDemoTools()` injects SMS tool only when `hasCallerPhone=true` (visitor provided phone in form); requires `sms_enabled` and `twilio_number` on the demo client slug | NO | NO | NO |
| **Booking (calendar) meaningful** | YES — requires `booking_enabled=true`, `calendar_auth_status='connected'`, plan entitlement (`pro`); `checkCalendarAvailability` + `bookAppointment` tools | PARTIAL — injected when `demo.capabilities.calendarEnabled=true` on the demo slug; same real calendar endpoints as production | NO | NO | NO |
| **pgvector knowledge searchable** | YES — requires `knowledge_backend='pgvector'` + approved chunks > 0 + plan entitlement; `queryKnowledge` tool → `POST /api/knowledge/[slug]/query` | NO — `buildDemoTools()` does not include knowledge tool | NO | NO [UNVERIFIED — agent may have stored knowledge tool, but overrideTools is not set in this path] | NO |
| **Coaching tool available** | YES — `checkForCoaching` injected when `plan.learningLoopEnabled=true` | NO | NO | NO [UNVERIFIED — same note as knowledge] | NO |
| **Call recorded** | YES — `recordingEnabled: true` in all Agents API + createCall paths | YES — `recordingEnabled: true` in `createDemoCall()` | YES — `createDemoCall()` has `recordingEnabled: true` | YES — `callViaAgent`/`createCall` both set `recordingEnabled: true` | YES — `createDemoCall()` sets `recordingEnabled: true` |
| **Call logged to call_logs** | YES — fire-and-forget insert after Ultravox call created | YES — inserted to `demo_calls` table (not `call_logs`) | NO — no call_log insert in this route | NO — no call_log insert | NO |
| **Post-call webhook (completed)** | YES — `signCallbackUrl` applied to `/api/webhook/[slug]/completed`; triggers AI summary, billing, Telegram alert | PARTIAL — only if `demo.capabilities` and `demo.clientSlug` set; callback goes to the real client's completed route | NO | NO | NO |
| **Minute limit enforced** | YES — hard block before Ultravox call if `seconds_used_this_month / 60 >= effective_limit` (unless grace period active) | NO | NO | NO | NO |
| **Rate limiting** | YES — `SlidingWindowRateLimiter(30 calls/slug/60s)` | YES — 10/IP/hr (per-IP) + global demo budget | YES — 5/IP/hr + 3/clientId/hr | NO | NO |
| **Twilio signature validation** | YES — validates `X-Twilio-Signature` against `TWILIO_AUTH_TOKEN`; 403 on failure | NO — no Twilio webhook, browser POST | NO | NO | NO |
| **Tool secret auth on tools** | YES — `X-Tool-Secret` static parameter on all HTTP tools | PARTIAL — same tool builders used; secret injected when `WEBHOOK_SIGNING_SECRET` set | NO — no tools | NO | NO |
| **Max duration** | 600s (10 min) — set in agent `callTemplate` or `createCall` body | 600s default via `createDemoCall()` (override unused in standard path) | 180s — hardcoded in `createDemoCall()` call | 600s — `callViaAgent` inherits agent default; or `createCall` uses 600s | 180s — hardcoded |
| **Billing applies** | YES — Ultravox `call.billed` webhook fires to native webhook; `seconds_used_this_month` incremented | NO — demo calls not billed against any client | NO — no billing hookup | PARTIAL — Ultravox may meter the call but `seconds_used_this_month` is not updated [UNVERIFIED] | NO — no billing hookup |
| **Medium** | PSTN via Twilio (`medium: { twilio: {} }`) | WebRTC (`medium` field omitted → Ultravox defaults to WebRTC) | WebRTC | PSTN via Twilio outbound dial | WebRTC |
| **Inactivity messages** | YES — `DEFAULT_INACTIVITY`: 30s warning, 15s hangup | YES — `createDemoCall()` sets `DEFAULT_INACTIVITY` | YES — `createDemoCall()` sets `DEFAULT_INACTIVITY` | YES — via agent template or `createCall` body | YES — `createDemoCall()` sets `DEFAULT_INACTIVITY` |
| **`firstSpeakerSettings`** | YES — `{ agent: { uninterruptible: true, delay: '1s' } }` in agent template; for Agents API path | YES — `{ agent: { uninterruptible: true } }` set in `createDemoCall()` | YES — inherited from `createDemoCall()` | YES — inherits from agent template (Agents API path) or unset (createCall fallback) | YES — `createDemoCall()` default |

---

## 3. Drift Risk Section

### DR-1: Trial Success WebRTC (Path C) uses raw prompt, no context injection
- **Divergence:** Path C calls `createDemoCall(client.system_prompt, ...)` with no `callerContext`, `businessFacts`, or `contextData`. The prompt stored in `clients.system_prompt` contains `{{callerContext}}`, `{{businessFacts}}`, `{{contextData}}` placeholders appended by `updateAgent()`. These are Agents API template variables; in `createDemoCall()` they are never resolved. The caller hears "{{businessFacts}}" spoken literally if the LLM tries to verbalize the placeholder.
- **File:** `src/app/api/trial/test-call/route.ts` line 61-65
- **Classification:** Known gap — this is the post-signup "first listen" experience and the prompt was never intended for raw injection. The placeholder leakage risk is real if the LLM reads prompt text verbatim.

### DR-2: Dashboard Test Call (Path D) does not inject tools via overrideTools
- **Divergence:** Path D creates the Ultravox call via `callViaAgent()` without passing `overrideTools`. The agent's stored tools (built at last `updateAgent()` time) are what fire. This means the tools that run on a dashboard test call may differ from the tools that run on a live inbound call if `clients.tools` was updated but `updateAgent()` has not been called since. It also means the test call never gets a freshly-built `buildAgentTools()` assembly with runtime `overrideTools`.
- **File:** `src/app/api/dashboard/test-call/route.ts` lines 80-99
- **Classification:** Known gap

### DR-3: Demo path (Path B) injects SMS tool but demo clients may lack `twilio_number`
- **Divergence:** `buildDemoTools()` injects `buildSmsTools(slug)` when `hasCallerPhone=true`. The SMS tool points to `/api/webhook/${slug}/sms`, which requires the client to have a Twilio number. If the demo client slug's `sms_enabled` is false or `twilio_number` is null, the tool will be injected but will fail at runtime.
- **File:** `src/lib/ultravox.ts` lines 511-517; `src/app/api/demo/start/route.ts` lines 225-234
- **Classification:** Known gap — `buildDemoTools` does not guard on `sms_enabled` or `twilio_number` presence; it relies on the `hasCallerPhone` flag from the caller.

### DR-4: Live Inbound `createCall` fallback loses Agents API benefits
- **Divergence:** When `callViaAgent()` fails and the inbound route falls back to `createCall()`, several differences apply: (a) `initialState` is injected (call state init), whereas Agents API ignores it. (b) `languageHint: 'en'` is passed; Agents API path omits it. (c) `callerContextBlock` is appended to prompt string directly rather than via `templateContext`. The voice remains from `client.agent_voice_id` in both cases.
- **File:** `src/app/api/webhook/[slug]/inbound/route.ts` lines 265-292
- **Classification:** Intentional — the fallback is a safety net; behavioral differences are documented inline.

### DR-5: Demo mode (Path B) with `useLivePrompt` resolves `{{templateContext}}` with a fake phone number
- **Divergence:** When `demo.useLivePrompt=true`, `buildAgentContext()` is called with a hardcoded phone `'+15555550100'` (not the actual demo visitor's phone). This means the caller context injected into the live prompt uses a placeholder number, not the real visitor phone.
- **File:** `src/app/api/demo/start/route.ts` line 183
- **Classification:** Intentional — demo callers are anonymous; the fake number avoids returning-caller lookups.

### DR-6: Plan gating not re-evaluated at call creation time for Path D
- **Divergence:** Path D (dashboard test call) does not run `buildAgentTools()` or `getPlanEntitlements()` at call time. It relies on the agent's stored call template tools, which were last built during a settings save or `updateAgent()`. If a plan downgrade occurred since the last agent sync, the tools in the stored template may not reflect the current entitlements.
- **File:** `src/app/api/dashboard/test-call/route.ts` (no `buildAgentTools` call); `src/lib/ultravox.ts` `buildAgentTools` (only called by `updateAgent`, `createAgent`, `syncClientTools`)
- **Classification:** Known gap

### DR-7: Coaching tool gating inconsistency between Path A and Path B
- **Divergence:** Path A's `buildAgentTools()` injects `checkForCoaching` when `plan.learningLoopEnabled=true`. Path B's `buildDemoTools()` never injects coaching. Demo calls therefore never generate coaching feedback.
- **File:** `src/lib/ultravox.ts` line 586 vs lines 511-517
- **Classification:** Intentional — demo calls are not associated with a client coaching session.

---

## 4. Medium-Specific Constraints

### WebRTC Browser (`medium` omitted or `{ webRtc: {} }`)
Used by: Path B (demo), Path C (trial success), Path E (admin test).

| Feature | Available | Notes |
|---|---|---|
| DTMF tones | NO | Browser WebRTC does not transmit DTMF digits to Twilio; no SID exists |
| Live call transfer | NO | Transfer requires a Twilio Call SID to invoke `redirectCall()`. No SID exists on browser calls. |
| Recording | YES | Ultravox records independently of Twilio |
| Voicemail fallback | NO | Voicemail requires Twilio to serve `<Record>` TwiML; not applicable to WebRTC |
| Caller ID | NO | No PSTN Caller ID; caller identity supplied via form input only |
| SMS during call | PARTIAL | Tool can be injected if visitor provides phone; requires a Twilio number on the client slug to send FROM |
| Inactivity messages | YES | Controlled by Ultravox `inactivityMessages` config |
| Max duration enforcement | YES | Controlled by Ultravox `maxDuration` |

### PSTN Phone via Twilio (`medium: { twilio: {} }`)
Used by: Path A (inbound), Path D (dashboard test outbound).

| Feature | Available | Notes |
|---|---|---|
| DTMF tones | YES | Twilio `<Gather>` captures keypresses before agent connection (IVR gate) |
| Live call transfer | YES | `redirectCall()` sends new TwiML to the Twilio Call SID; `<Dial>` to forwarding number |
| Recording | YES | Ultravox records; Twilio Call SID also available for separate recording if enabled |
| Voicemail fallback | YES | Twilio serves `<Record>` TwiML when Ultravox creation fails |
| Caller ID | YES | `body.From` on inbound; `to_phone` on outbound |
| SMS during call | YES | Ultravox `sendTextMessage` tool fires to Twilio REST API; requires client Twilio number |
| Inactivity messages | YES | Ultravox `inactivityMessages` |
| Max duration enforcement | YES | Ultravox `maxDuration` |
| Transfer failure recovery | YES | `actionUrl` on `<Dial>` points to `/transfer-status` which rebuilds Ultravox connection |

### SIP
Not present in the codebase. No SIP URI handling found. [UNVERIFIED: whether Ultravox or Twilio SIP trunking is configured at account level]

---

## 5. Checklist: Adding a New Capability Without Breaking Path Parity

When adding a new capability (e.g. a new tool, a new feature flag, a new prompt injection), verify or explicitly exclude each path:

1. **Define the entitlement gate**
   - Add the capability flag to `PlanEntitlements` in `src/lib/plan-entitlements.ts`.
   - Set the correct value for each plan object (`LITE`, `CORE`, `PRO`, `TRIAL_ENTITLEMENTS`).

2. **Add the tool builder**
   - Add a `buildXxxTool(slug)` function in `src/lib/ultravox.ts`.
   - Inject it inside `buildAgentTools()` with the plan gate: `if (opts.xxxEnabled && plan.xxxEnabled && opts.slug)`.
   - Log the tool name in the `gated[]` array when stripped.

3. **Update `updateAgent()` and `createAgent()`**
   - Both call `buildAgentTools()` — no separate changes needed. Verify the new option is included in `AgentConfig` type.

4. **Update `syncClientTools()`**
   - Confirm the new DB flag is read and passed to `buildAgentTools()`. File: `src/lib/sync-client-tools.ts` [UNVERIFIED — file not read; assumed to mirror `buildAgentTools` inputs].

5. **Verify Path A (live inbound)**
   - Confirm `inbound/route.ts` SELECT includes the new DB flag column.
   - Confirm the tool fires correctly when the client has the capability enabled.

6. **Decision on Path B (demo)**
   - Decide whether the demo should expose this capability.
   - If yes: add the capability flag to `DemoToolCapabilities` in `ultravox.ts` and wire it in `buildDemoTools()`.
   - If no: document the intentional omission in Section 3.

7. **Decision on Path C (trial success WebRTC)**
   - This path has no tools. If the capability requires a tool, it will not fire.
   - If the capability is prompt-only, verify the raw prompt won't have unresolved placeholders.
   - Document the gap if applicable.

8. **Decision on Path D (dashboard test outbound)**
   - This path uses stored agent tools (not `overrideTools`). The new capability will appear in test calls only after the agent is re-synced via settings save or `syncClientTools()`.
   - Acceptable for most cases. Document if the gap is misleading.

9. **Add a prompt disclaimer for gated capabilities**
   - In `inbound/route.ts`, the `gatedCapabilities` array already appends a disclaimer when a plan doesn't include a feature. Add the new capability name to this array when `!callPlan.xxxEnabled`.

10. **Run drift detection**
    - After shipping: use the `drift-detector` agent to verify DB vs deployed vs live state for one active client.

---

## 6. Explicitly Deferred Capabilities

### Inactivity Policy Tuning
- **Current state:** `DEFAULT_INACTIVITY` is a module-level constant in `src/lib/ultravox.ts` (30s warning, 15s hang-up soft). Applied to all paths identically.
- **Why deferred:** Per-client or per-niche tuning would require storing `inactivity_config` in `clients` table and passing it through all creation paths. Low priority vs. other work.

### IVR / DTMF Expansion
- **Current state:** IVR is a simple two-choice pre-filter (1 = voicemail, else = agent). No multi-level menu, no mid-call DTMF routing.
- **Why deferred:** Complex IVR logic would require Twilio Studio or multi-step `<Gather>` chains. Tracker: S12 Ph2c (`IVR multi-route call handling — DEFERRED`).

### Voicemail Transcription
- **Current state:** Voicemail recordings are stored to Supabase Storage but not transcribed. `ai_summary` on VOICEMAIL rows contains a static string, not a transcript.
- **Why deferred:** Requires a speech-to-text step in the voicemail route. Not scheduled.

### Call Stages / Advanced Staged Prompts (Pattern D)
- **Current state:** Ultravox call stages feature is NOT implemented. Listed in `memory/advanced-features-plan.md` as Pattern D — "only if monoprompt fails for a complex client".
- **Why deferred:** Current monoprompt approach is sufficient. Adds complexity.

### Outbound Calling Campaigns
- **Current state:** No outbound dialer exists. Path D is a one-off test dial, not a campaign system.
- **Why deferred:** Not on current roadmap. Would require campaign_leads table integration and a separate dialing queue.

### Multi-Language Routing
- **Current state:** `languageHint: 'en'` is passed only in the `createCall` fallback path in inbound. Agents API path does not pass it. No language detection or routing logic.
- **Why deferred:** Single-language English service for current client base. `languageHint` is a 1-line addition when needed.

### SIP / SIP Trunking
- **Current state:** No SIP URI handling in the codebase. Ultravox `cold_transfer` via SIP is not used — a custom HTTP `transferCall` tool + Twilio `redirectCall()` is used instead.
- **Reference:** `memory/free-to-call-barry.md` raises SIP URI question. No implementation planned.

### Deferred Advanced Features (Ultravox Patterns B / Deferred Messages)
- **Current state:** Pattern B (deferred messages / whisper) is NOT implemented. Listed as NOT DONE in `memory/advanced-features-plan.md`.
- **Why deferred:** Pattern A (tool response instructions) and C (call state) are done. Pattern B requires priming lines in all prompts first.
