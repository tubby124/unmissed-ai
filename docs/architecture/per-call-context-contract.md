# Per-Call Context Contract

> Reference architecture document — derived from code as of 2026-03-25.
> All claims are traced to actual source files. Unverified assumptions are marked [UNVERIFIED].

---

## 1. Call Type Inventory

### 1.1 Live Inbound Phone Call

**Initiator:** Twilio → POST `/api/webhook/[slug]/inbound/route.ts`

A real caller dials the client's Twilio number. Twilio sends a signed form-encoded webhook. The inbound route:
1. Validates the Twilio HMAC signature
2. Applies rate limiting, minute enforcement, grace period, and trial expiry guards
3. Looks up the `clients` row for the slug
4. Runs `buildAgentContext()` with the caller's phone and up to 5 prior call rows
5. Creates a call via either the Agents API (`callViaAgent`) or `createCall` fallback
6. Returns TwiML with a `<Stream>` pointing to the Ultravox `joinUrl`
7. Inserts a `call_logs` row with `call_status='live'` (fire-and-forget)

Medium: Twilio WebSocket stream.

### 1.2 Browser Demo Call (WebRTC — anonymous visitor, standard niche demo)

**Initiator:** Frontend → POST `/api/demo/start/route.ts`

An anonymous visitor on the marketing page clicks to talk to a niche demo agent (auto_glass, property_mgmt, real_estate). The demo route:
1. Checks global + per-IP rate limits
2. Looks up the demo agent from `DEMO_AGENTS` by `demoId`
3. Optionally fetches the live prompt from Supabase if `demo.useLivePrompt` is set
4. Builds a flat context block appended to the prompt (`[DEMO MODE — BROWSER\nCALLER NAME: ...\nCALLER PHONE: ...]`)
5. Calls `createDemoCall()` with WebRTC medium (no `medium: { twilio: {} }`)
6. Logs to `demo_calls` table
7. Returns `joinUrl` to the browser

Medium: Ultravox WebRTC (browser SDK joins directly).

### 1.3 Browser Demo Call (WebRTC — onboarding preview)

**Initiator:** Frontend → POST `/api/demo/start/route.ts` with `mode: 'preview'`

A prospective client in the onboarding flow tests a prompt built live from their `OnboardingData`. The route:
1. Receives `onboardingData` in the request body
2. Calls `buildPromptFromIntake()` inline with approved scrape data
3. Appends a flat `[PREVIEW MODE — The business owner is testing their own agent]` block with caller name
4. Creates via `createDemoCall()`, no Twilio medium
5. Logs to `demo_calls` with `source='onboard-preview'`

Medium: Ultravox WebRTC.

### 1.4 Phone Demo Call — Outbound ("Call Me" widget)

**Initiator:** Frontend → POST `/api/demo/call-me/route.ts`

A visitor on the marketing page enters their phone number to receive an outbound demo call. The route:
1. Validates the phone as E.164 North America
2. Fetches the live prompt from Supabase if `demo.useLivePrompt` is set, and resolves templateContext placeholders inline
3. Appends `[DEMO MODE — PHONE\nCALLER NAME: ...\nCALLER PHONE: ...]`
4. Creates an Ultravox call with `useTwilio: true`
5. Makes a Twilio outbound call from `DEMO_TWILIO_NUMBER` to the visitor's phone with the TwiML stream

Medium: Twilio outbound.

### 1.5 Phone Demo Call — IVR Inbound

**Initiator:** Caller dials the demo Twilio number → POST `/api/webhook/demo/inbound/route.ts`

A caller dials the public demo number directly. The demo IVR route:
1. First hit: plays a digit menu (1=auto_glass, 2=property_mgmt, 3=real_estate)
2. Second hit (digits present): routes to the chosen demo agent
3. Resolves live prompt if configured, appends `[DEMO MODE — IVR PHONE. Tools: hangUp only. CALLER PHONE: ...]`
4. Creates via `createDemoCall()` with `useTwilio: true`
5. Returns TwiML stream

Medium: Twilio WebSocket stream (inbound phone call).

### 1.6 Trial Post-Provision Test Call (WebRTC)

**Initiator:** Trial success screen → POST `/api/trial/test-call/route.ts`

A trial user who has just signed up sees the trial success screen and tests their freshly provisioned agent. No auth session exists yet. The route:
1. Checks per-IP and per-clientId rate limits (unauthenticated)
2. Fetches `system_prompt` and `agent_voice_id` directly from `clients` by `clientId`
3. Calls `createDemoCall()` with the raw `system_prompt` — **no templateContext placeholder resolution, no callerContext injection**
4. Returns `joinUrl`

Medium: Ultravox WebRTC. Does not log to `call_logs`.

### 1.7 Dashboard Agent Test Call (WebRTC — authenticated owner/admin)

**Initiator:** Dashboard "Talk to Your Agent" card → POST `/api/dashboard/agent-test/route.ts`

An authenticated client owner or admin tests their configured agent from the dashboard. The route:
1. Authenticates via Supabase session, looks up `client_users`
2. Fetches full client config
3. Runs `buildAgentContext()` with synthetic caller phone `+15555550100` and empty prior calls
4. Calls `callViaAgent()` via Agents API with WebRTC medium and full `templateContext`
5. Inserts a `call_logs` row with `call_status='test'` and `caller_phone='webrtc-test'`

Medium: Ultravox WebRTC via Agents API (same code path as production inbound).

### 1.8 Dashboard Browser Test Call / Prompt Lab (WebRTC — authenticated)

**Initiator:** Dashboard prompt lab → POST `/api/dashboard/browser-test-call/route.ts`

An authenticated user tests either the live prompt or a draft prompt from the prompt editor. The route:
1. Authenticates via Supabase session
2. Resolves the prompt from DB (slot='live') or from request body (slot='draft')
3. Runs `buildAgentContext()` with synthetic phone `+15555550100` and empty prior calls
4. Resolves `{{templateContext}}` placeholders inline via string `.replace()`
5. Calls `createDemoCall()` — **not via Agents API**, no `call_logs` entry, no completed webhook

Medium: Ultravox WebRTC. Ephemeral — no billing, no logging.

### 1.9 Admin Raw Test Call (WebRTC)

**Initiator:** Admin panel → POST `/api/admin/test-call/route.ts`

An admin directly tests a raw prompt string. The route:
1. Verifies admin role via `client_users`
2. Passes the prompt directly to `createDemoCall()` — **no context injection at all**
3. Uses `maxDuration: '180s'`

Medium: Ultravox WebRTC. No logging, no context.

### 1.10 Outbound Call [UNVERIFIED — not found in codebase]

No outbound production call creation path was found during this audit. The "call-me" demo widget creates outbound Twilio calls, but there is no production outbound call flow (e.g. campaign dialer) in the current codebase.

---

## 2. Per-Call Context Contract (by call type)

### 2.1 Live Inbound Phone Call

| Dimension | Detail |
|-----------|--------|
| **From persistent DB config** | `system_prompt`, `agent_voice_id`, `tools` (JSONB array), `knowledge_backend`, `business_facts`, `extra_qa`, `context_data`, `context_data_label`, `business_hours_weekday`, `business_hours_weekend`, `after_hours_behavior`, `after_hours_emergency_phone`, `timezone`, `injected_note`, `niche`, `business_name` |
| **From live agent sync (Ultravox agent state)** | When `ultravox_agent_id` is present: voice, selectedTools, systemPrompt template with `{{callerContext}}` / `{{businessFacts}}` / `{{contextData}}` placeholders are live in Ultravox |
| **Injected per-call at call creation time** | `callerContext` (phone, time, date, after-hours flag, returning caller data, injected_note), `businessFacts` (KnowledgeSummary + retrieval instruction + plan disclaimer), `contextData` (CSV/reference data block), `initialMessages` (hidden returning caller text for createCall path), `metadata` (caller_phone, client_slug, client_id), signed `callbackUrl`, `overrideTools` (X-Tool-Secret injection) |
| **Should NEVER be persisted as long-lived config** | Caller's phone number, today's date/time, after-hours status, returning caller name/summary, plan capability disclaimers |
| **UI surfaces that can edit it** | Settings cards (all 19) via `usePatchSettings` PATCH → `clients` row → `updateAgent()` redeploy |
| **How it affects runtime** | Agents API: `templateContext` resolves `{{callerContext}}` etc. inside the stored prompt. createCall fallback: context appended directly to `systemPrompt` string. |

### 2.2 Browser Demo Call (standard)

| Dimension | Detail |
|-----------|--------|
| **From persistent DB config** | Live prompt fetched from Supabase if `demo.useLivePrompt` is set (optional) |
| **From live agent sync** | Not used — `createDemoCall()` always creates ephemeral calls, never uses an agent ID |
| **Injected per-call at call creation time** | Flat inline block appended to prompt: `DEMO MODE — BROWSER`, `CALLER NAME`, `CALLER PHONE` (if provided), `CALLER EMAIL` (if provided), capability note if no phone |
| **Should NEVER be persisted** | Visitor name, phone, email — all ephemeral |
| **UI surfaces** | None — demo is stateless |
| **How it affects runtime** | Flat string append to `systemPrompt`. Tools built via `buildDemoTools()` based on capability flags, not DB config. |

### 2.3 Onboarding Preview Call

| Dimension | Detail |
|-----------|--------|
| **From persistent DB config** | None — prompt is generated live from `OnboardingData` |
| **From live agent sync** | Not used |
| **Injected per-call at call creation time** | `[PREVIEW MODE — The business owner is testing... CALLER NAME: ...]` appended inline. Explicit HANG-UP RULES block also appended. |
| **Should NEVER be persisted** | The entire prompt is ephemeral — generated from form state |
| **UI surfaces** | Onboarding step form |
| **How it affects runtime** | Full prompt generated via `buildPromptFromIntake()` and passed directly to Ultravox |

### 2.4 Trial Post-Provision Test Call

| Dimension | Detail |
|-----------|--------|
| **From persistent DB config** | `system_prompt`, `agent_voice_id` |
| **From live agent sync** | Not used — `createDemoCall()` path |
| **Injected per-call at call creation time** | **Nothing injected.** The raw `system_prompt` (which still contains `{{callerContext}}` etc. as unresolved placeholders) is passed directly to Ultravox |
| **Should NEVER be persisted** | N/A |
| **UI surfaces** | Trial success screen |
| **How it affects runtime** | Placeholder strings appear literally in the prompt if not resolved. This is a known gap for the trial/test-call path. |

### 2.5 Dashboard Agent Test Call

| Dimension | Detail |
|-----------|--------|
| **From persistent DB config** | Full client config (same columns as inbound webhook) |
| **From live agent sync** | Uses Agents API via `callViaAgent()` — requires `ultravox_agent_id` |
| **Injected per-call at call creation time** | `callerContext` (synthetic phone `+15555550100`, real date/time, no prior calls), `businessFacts`, `contextData`, `metadata` with `source: 'dashboard-agent-test'`, `overrideTools` from `clients.tools` |
| **Should NEVER be persisted** | Synthetic caller phone, current time |
| **UI surfaces** | Dashboard "Talk to Your Agent" card |
| **How it affects runtime** | Agents API `templateContext` resolves placeholders. Closest to production behavior of any test path. |

### 2.6 Dashboard Browser Test Call / Prompt Lab

| Dimension | Detail |
|-----------|--------|
| **From persistent DB config** | Full client config (same columns) |
| **From live agent sync** | Not used — `createDemoCall()` bypasses Agents API |
| **Injected per-call at call creation time** | `callerContext` (synthetic phone, real time), `businessFacts`, `contextData` — resolved via inline `.replace()` before calling Ultravox |
| **Should NEVER be persisted** | Synthetic caller phone, current time, draft prompt content |
| **UI surfaces** | Prompt lab / settings test panel |
| **How it affects runtime** | Ephemeral call. No call_logs entry. No billing. Used to test prompt changes before deploying. |

### 2.7 Phone Demo — Outbound / IVR

These share the same context contract as the standard browser demo (section 2.2) except:
- Medium is `useTwilio: true`
- `CALLER PHONE` is always present (required for outbound, taken from Twilio `body.From` for IVR)
- `transferEnabled` is `true` for call-me (outbound knows phone), `false` for IVR (tools stripped to hangUp only)

---

## 3. Context Field Reference

All fields injected into `callerContextBlock` by `buildAgentContext()` in `src/lib/agent-context.ts`.

### callerContext fields (injected via `templateContext.callerContext` on Agents API, or appended to `systemPrompt` on createCall)

| Field | Source | Injected via | Persisted? | Call types |
|-------|--------|--------------|------------|------------|
| `TODAY` (YYYY-MM-DD) | `new Date()` at request time, client timezone | callerContextBlock | No | All production + test calls |
| `CURRENT TIME` | `new Date()` at request time, client timezone | callerContextBlock | No | All production + test calls |
| `CALLER PHONE` | Twilio `body.From` (E.164) or request body | callerContextBlock | No (also written to `call_logs.caller_phone`) | Inbound phone, demo phone, call-me, IVR |
| `CALLER NAME` | Prior `call_logs.caller_name` for returning callers | callerContextBlock | No (source is persisted in call_logs) | Inbound when returning caller data exists |
| `RETURNING CALLER` | Derived from prior `call_logs` rows for same phone+client | callerContextBlock | No | Inbound phone when phone is known |
| `OFFICE HOURS` (weekday/weekend) | `clients.business_hours_weekday`, `clients.business_hours_weekend` | callerContextBlock | Yes — in clients table | All production calls |
| `OFFICE STATUS` (after-hours) | Derived at call time via `detectAfterHours()` | callerContextBlock | No (derived, not stored) | All production calls, conditionally |
| `RIGHT NOW` (injected_note) | `clients.injected_note` dashboard toggle | callerContextBlock | Yes — in clients table | All production calls when set |
| Last call summary (120 chars) | `call_logs.ai_summary` of most recent prior call | callerContextBlock | No (source persisted in call_logs) | Inbound phone when returning caller |
| `initialMessages` (returning caller context) | Same prior call data as above | `initialMessages` array (createCall path only) | No | Inbound phone, createCall fallback path |

### businessFacts fields (injected via `templateContext.businessFacts`)

| Field | Source | Injected via | Persisted? | Call types |
|-------|--------|--------------|------------|------------|
| Knowledge summary (hours, facts, Q&A) | `clients.business_facts`, `clients.extra_qa` assembled by `buildKnowledgeSummary()` | businessFacts | Yes — source in clients table | All production + dashboard test |
| Retrieval instruction | Derived from `clients.knowledge_backend` + corpus availability | businessFacts | No — generated at call time | Production + dashboard test when pgvector enabled |
| Plan disclaimer | Derived from `clients.selected_plan` + `clients.subscription_status` at call time | businessFacts | No | Inbound phone only (not in test paths) |

### contextData fields (injected via `templateContext.contextData`)

| Field | Source | Injected via | Persisted? | Call types |
|-------|--------|--------------|------------|------------|
| Reference data block (tenant table, CSV, etc.) | `clients.context_data`, `clients.context_data_label` | contextData | Yes — in clients table | All production calls when set |

### Call-state fields (injected via `initialState` — createCall path only)

| Field | Source | Injected via | Persisted? | Call types |
|-------|--------|--------------|------------|------------|
| `workflowType` | `defaultCallState(niche)` — niche → workflow mapping | `body.initialState` on Ultravox POST /calls | No (runtime state, shadowed in call_logs.call_state as JSON) | Inbound phone — createCall path only. NOT supported on Agents API |
| `step`, `fieldsCollected`, `slotAttempts`, etc. | Initialized to defaults, mutated by tool responses via `X-Ultravox-Update-Call-State` | `body.initialState` | No | Same as above |

Note: On the Agents API path, `initialState` is not supported. Call state is read from `call_logs.call_state` (written at insert time) via the DB fallback in tool routes.

### Demo-specific fields (inlined into systemPrompt, not templateContext)

| Field | Source | Injected via | Persisted? | Call types |
|-------|--------|--------------|------------|------------|
| `DEMO MODE` marker | Hardcoded string | Direct systemPrompt append | No | All demo/test calls |
| `CALLER NAME` | Request body `callerName` | Direct systemPrompt append | No | Demo/preview/test calls |
| `CALLER EMAIL` | Request body `callerEmail` | Direct systemPrompt append | No | Demo/call-me calls |

### Metadata (not in prompt — stored in Ultravox call metadata)

| Field | Source | Injected via | Persisted? | Call types |
|-------|--------|--------------|------------|------------|
| `caller_phone` | Twilio `body.From` | `metadata` dict on call creation | No (also in call_logs) | Inbound phone |
| `client_slug` | Route param | `metadata` dict | No | Inbound phone, agent-test |
| `client_id` | DB lookup | `metadata` dict | No | Inbound phone, agent-test |
| `source` | Hardcoded string ('dashboard-agent-test', etc.) | `metadata` dict | No | Agent test calls |
| `userId` | Supabase auth session | `metadata` dict | No | Agent test calls |

---

## 4. Anti-Patterns

### 4.1 Prompt stuffing for per-call state (partially present)

The trial/test-call route (`/api/trial/test-call/route.ts`) passes `client.system_prompt` directly to `createDemoCall()` without resolving the `{{callerContext}}`, `{{businessFacts}}`, and `{{contextData}}` placeholders:

```ts
// src/app/api/trial/test-call/route.ts — lines 61-65
const { joinUrl, callId } = await createDemoCall({
  systemPrompt: client.system_prompt,  // contains unresolved {{templateContext}} placeholders
  voice: client.agent_voice_id || undefined,
  maxDuration: '180s',
})
```

The placeholders will appear literally in the prompt text. The agent will see `{{callerContext}}` as a string, not actual caller data. This is a known gap unique to the trial success screen flow.

### 4.2 Storing transient test context in persistent config (not observed)

No instances were found of ephemeral per-call data (caller phone, current time, returning caller notes) being written back to the `clients` table during call creation. The architecture correctly keeps these in the call-time injection path.

One borderline case: `clients.injected_note` is a semi-ephemeral "today's update" field (dashboard toggle, intended to be temporary). It is persisted in the DB and injected at every call via `callerContextBlock` as `RIGHT NOW: ...`. This is by design but it carries the risk of stale notes persisting if the owner forgets to clear them.

### 4.3 UI-only toggles with no runtime effect

The `sms_enabled` flag with no `twilio_number` silently produces no SMS tool. `buildAgentTools()` in `src/lib/ultravox.ts` (line 581) gates SMS tool injection on `opts.sms_enabled && opts.twilio_number`:

```ts
const smsTools = (opts.sms_enabled && opts.twilio_number && plan.smsEnabled && opts.slug)
  ? buildSmsTools(opts.slug) : []
```

Trial clients have `sms_enabled=true` set at activation but have no `twilio_number`. The UI may show SMS as enabled, but the tool is never injected, so the agent cannot send texts. This is documented behavior — not a bug — but the UI should ideally indicate this.

### 4.4 Hard-coding per-call behavior in the persistent prompt

The demo routes intentionally append behavioral overrides (HANG-UP RULES, PREVIEW MODE, tool restrictions) directly to the prompt string at call creation time:

```ts
// src/app/api/demo/start/route.ts — lines 91-97 (preview mode)
const promptWithContext = prompt + `\n\n[PREVIEW MODE — The business owner is testing...
HANG-UP RULES (mandatory — follow exactly):
- When the caller says "bye" ... invoke hangUp in the SAME response.`
```

This is intentional for demos (the behavioral override is always appropriate for a preview), but would be an anti-pattern for production calls where runtime conditions should vary.

For production calls, the after-hours behavior (`OFFICE STATUS`) and returning caller context are correctly injected at call time via `callerContextBlock`, not baked into `system_prompt`. The `system_prompt` stored in the DB and in the Ultravox agent profile has `{{callerContext}}` as a placeholder — never literal caller metadata.

---

## 5. Handoff Points

### Settings truth → Provisioned agent truth

**Location:** `src/lib/ultravox.ts` — `updateAgent()` / `createAgent()`

When a settings card saves (via `usePatchSettings` PATCH to `/api/client/settings`), the server calls `updateAgent(agentId, updates)`. This rebuilds the entire `callTemplate` (PATCH = full replacement in Ultravox) with the new system prompt (stripped of section markers, with `{{templateContext}}` placeholders ensured), voice, and a fresh `selectedTools` array from `buildAgentTools()`.

After this point, the Ultravox agent profile is the live source of truth for the base prompt, voice, and tool set. What's in `clients.system_prompt` must match what was sent to Ultravox — drift is possible if `updateAgent()` failed silently.

### Provisioned agent truth → Per-call context injection

**Location:** `src/app/api/webhook/[slug]/inbound/route.ts` — `callViaAgent()` call

At call creation time, the inbound route:
1. Reads the current `clients` row from Supabase
2. Runs `buildAgentContext()` to produce time-sensitive data
3. Passes `templateContext` to `callViaAgent()` — Ultravox substitutes these into the stored prompt's `{{...}}` placeholders

The agent profile supplies the template. The inbound route supplies the values that fill it. Neither is sufficient alone.

### Per-call context injection → Tool execution

**Location:** `src/lib/call-state.ts` — `defaultCallState()` / `readCallStateFromDb()` / `persistCallStateToDb()`

Tool routes (`/api/calendar/[slug]/book`, `/api/webhook/[slug]/transfer`, `/api/webhook/[slug]/sms`, `/api/knowledge/[slug]/query`) receive the call context in two ways:

1. `X-Call-State` header — auto-injected by Ultravox from the `initialState` set at call creation (createCall path only)
2. DB fallback — `readCallStateFromDb()` reads `call_logs.call_state` (Agents API path — `initialState` is not supported there)

Tool routes use `KNOWN_PARAM_CALL_ID` to identify the call, `X-Tool-Secret` for auth, and `X-Call-State` to understand workflow context. They respond with `X-Ultravox-Update-Call-State` to advance state.

---

## 6. Future-Safe Checklist: Adding a New Runtime-Only Behavior

Use this when you need something that should vary per call (not per client configuration).

**Step 1 — Confirm it is truly per-call**

Ask: Does this vary based on the caller, the time, or the specific call's circumstances? If yes, it belongs in call-time injection. If it varies per client business configuration, it belongs in `clients` table and the persistent agent prompt.

**Step 2 — Add the field to `CallerContext` or `AssembledContextBlocks` in `agent-context.ts`**

- If it requires computation from DB data or runtime state, add it as a field on `CallerContext` (e.g. `isAfterHours`, `isReturningCaller`)
- If it produces an injectable string, add it to `AssembledContextBlocks`
- Run `buildAgentContext()` pure — no DB calls inside it. DB lookups happen in the calling routes before `buildAgentContext()` is invoked.

**Step 3 — Inject via `templateContext`, not `systemPrompt`**

- For Agents API calls: add to the `templateContext` object passed to `callViaAgent()`
- For createCall fallback: append to `promptFull` after `callerContextBlock`
- Do NOT modify `clients.system_prompt` at call time

**Step 4 — Add the corresponding `{{placeholder}}` to the agent prompt template**

- `updateAgent()` in `src/lib/ultravox.ts` ensures `{{callerContext}}`, `{{businessFacts}}`, `{{contextData}}` are present. Adding a new placeholder requires updating `updateAgent()` to ensure it is appended/present.
- The `contextSchema` on the agent's `callTemplate` must also list the new key (see `createAgent()` / `updateAgent()` in `src/lib/ultravox.ts`)

**Step 5 — Backfill the contextSchema on existing agents**

Any new `templateContext` key must be declared in the agent's `contextSchema`. Existing deployed agents need an `updateAgent()` call to pick up the new schema entry.

**Step 6 — Handle the createCall fallback path**

The inbound webhook falls back to `createCall()` when the Agents API fails. The createCall path appends context as a flat string, not via template substitution. Ensure your new field is also appended in the `promptFull` assembly block in `src/app/api/webhook/[slug]/inbound/route.ts` (lines 238–241).

**Step 7 — Handle non-production call paths**

- Dashboard agent-test (`/api/dashboard/agent-test/route.ts`): uses `callViaAgent()` — will automatically get the new `templateContext` key if you add it there
- Dashboard browser-test-call (`/api/dashboard/browser-test-call/route.ts`): resolves placeholders via inline `.replace()` — must add a corresponding `.replace(/\{\{yourKey\}\}/g, value)` call (line ~145)
- Demo/call-me and demo/start (live prompt mode): same inline `.replace()` pattern — update these too
- Admin test-call: passes raw prompt directly, no context injection — acceptable for raw testing

**Step 8 — Do not write runtime data to the `clients` row**

The `clients` row is config, not state. Never write caller phone, current time, after-hours flags, or any call-specific data to `clients` as a way to "pass it to the agent". Use `templateContext` or `initialMessages`.

**Step 9 — Verify the field does not appear in the stored `system_prompt`**

Run a check: after your change, fetch `clients.system_prompt` and confirm it contains only the `{{placeholder}}`, not a resolved value. Any live caller data baked into `system_prompt` at call time would be served to all future callers until the next `updateAgent()` call.
