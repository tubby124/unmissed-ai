# Phase 0d — Truth Map & Drift Register

> Generated 2026-03-21 from baseline snapshot `2026-03-21-0858`
> Sources: 4 drift-detector agents + 2 truth-tracer agents + baseline data

---

## 1. DRIFT REGISTER — Cross-Client Mismatches

### CRITICAL (affects call behavior)

| # | Field | All 4 Clients? | DB/File Value | Ultravox Live | Expected (Code) | Failure Class |
|---|-------|----------------|---------------|---------------|-----------------|---------------|
| D1 | systemPrompt — missing `{{businessFacts}}` | YES (all 4) | not in prompt file | NOT present | updateAgent() appends it | propagation bug |
| D2 | systemPrompt — missing `{{extraQa}}` | YES (all 4) | not in prompt file | NOT present | updateAgent() appends it | propagation bug |
| D3 | systemPrompt — missing `{{contextData}}` + INJECTED REFERENCE DATA block | YES (all 4) | not in prompt file | NOT present | updateAgent() appends it | propagation bug |
| D4 | queryKnowledge — missing KNOWN_PARAM_CALL_ID | windshield-hub confirmed, likely all | NOT present on live tools | Code adds `X-Call-Id` automaticParameter | propagation bug |
| D5 | bookAppointment — missing `callerName` description | hasan-sharif confirmed | `schema: { type: "string" }` (no desc) | `{ type: "string", description: "Caller's full name" }` | propagation bug |

### WARNING (suboptimal but not breaking)

| # | Field | All 4 Clients? | Live Value | Expected (Code) | Failure Class |
|---|-------|----------------|------------|-----------------|---------------|
| D6 | VAD minimumInterruptionDuration | YES (all 4) | `0.400s` | `0.2s` (DEFAULT_VAD) | propagation bug |
| D7 | firstSpeakerSettings.delay | windshield-hub, exp-realty | missing | `delay: "1s"` | propagation bug |
| D8 | hangUp tool format | all clients | temporaryTool HTTP definition | built-in `{ toolName: 'hangUp' }` | propagation bug |
| D9 | contextSchema extras | all clients | `additionalProperties: false`, `required: []` | code doesn't set these | propagation bug |

### INFO (cosmetic / non-functional)

| # | Field | Notes |
|---|-------|-------|
| D10 | firstSpeakerSettings.text | Live agents have greeting text baked in; code sets it at call-time via callViaAgent override. Not a bug — different injection point. |
| D11 | VAD string format | Live: `0.640s` vs code: `0.64s` — semantically identical |

---

## 2. SAVED vs GENERATED vs DEPLOYED MATRIX

For each prod client, comparing: **File** (SYSTEM_PROMPT.txt) vs **DB** (clients.system_prompt) vs **Ultravox Live** (agent callTemplate.systemPrompt)

| Client | File bytes | DB prompt_version length | Ultravox prompt length | File=DB? | DB=Ultravox? | File=Ultravox? | Missing placeholders |
|--------|-----------|-------------------------|----------------------|----------|-------------|---------------|---------------------|
| hasan-sharif | 7,174 | 7,124 (v53) | 7,124 | ~MATCH | MATCH | ~MATCH | businessFacts, extraQa, contextData |
| windshield-hub | 7,929 | 7,873 (v20) | 7,873 | ~MATCH | MATCH | ~MATCH | businessFacts, extraQa, contextData |
| urban-vibe | 9,267 | 9,183 (v22) | 9,183 | ~MATCH | MATCH | ~MATCH | businessFacts, extraQa, contextData |
| exp-realty | 9,666 | 9,606 (v15) | 9,606 | ~MATCH | MATCH | ~MATCH | businessFacts, extraQa, contextData |

**Key finding:** DB and Ultravox are in sync (prompt body matches). But the code's `updateAgent()` would append additional template placeholders that are NOT currently on any live agent. This means either:
- (a) The last deploy used `deploy_prompt.py` which doesn't append these, OR
- (b) The prompts were pushed via dashboard edit which bypasses `updateAgent()`, OR
- (c) `updateAgent()` was called but with an older version of the code before placeholder appending was added

---

## 3. TOOL INVENTORY — Per Client

| Tool | hasan-sharif | windshield-hub | urban-vibe | exp-realty |
|------|-------------|---------------|------------|-----------|
| hangUp | YES | YES | YES | YES |
| checkCalendarAvailability | YES | - | - | YES |
| bookAppointment | YES | - | - | YES |
| transferCall | YES | - | - | YES |
| sendTextMessage | YES | YES | YES | YES |
| queryKnowledge | YES | YES | YES | YES |
| checkForCoaching | YES | YES | YES | YES |
| **Total** | **7** | **4** | **4** | **7** |
| Matches expected? | YES | YES | YES | YES |

Tool presence matches DB flags for all clients. No phantom tools, no missing tools.

---

## 4. SETTINGS-TO-RUNTIME MAP

| DB Column | Affects Prompt? | Affects Tools? | Affects Agent Config? | Auto-deploys? |
|-----------|----------------|----------------|----------------------|---------------|
| system_prompt | YES (body) | NO | YES (systemPrompt field) | Only via /prompt-deploy or dashboard save |
| agent_voice_id | NO | NO | YES (voice field) | Via updateAgent() |
| niche | YES (prompt-builder behavior) | YES (tool defaults) | Indirectly | NO — requires prompt regeneration |
| booking_enabled | NO | YES (calendar tools) | YES (tools list) | Via updateAgent() |
| sms_enabled | NO | YES (SMS tool) | YES (tools list) | Via updateAgent() |
| forwarding_number | NO | YES (transfer tool) | YES (tools list + description) | Via updateAgent() |
| knowledge_backend | NO | YES (knowledge tool) | YES (tools list) | Via updateAgent() |
| business_hours_weekday | YES (injected to prompt) | NO | Indirectly | NO — requires prompt regeneration |
| business_hours_weekend | YES (injected to prompt) | NO | Indirectly | NO — requires prompt regeneration |
| hours | YES (prompt context) | NO | Indirectly | NO |
| timezone | YES (prompt context) | NO | Indirectly | NO |
| after_hours_behavior | YES (prompt behavior) | NO | Indirectly | NO |
| transfer_conditions | NO | YES (tool description) | YES | Via updateAgent() |
| voice_style_preset | UNKNOWN | NO | NO | Not traced — may be dead column |
| website_url | NO | NO | NO | Triggers website scraper only |
| google_calendar_id | NO | YES (calendar tool URL) | YES | Via updateAgent() |

**Chain break pattern:** Dashboard saves to DB but does NOT auto-trigger `updateAgent()` for most fields. The user must explicitly run `/prompt-deploy` or hit a "save & sync" button. This is the root cause of most drift.

---

## 5. PATH MATRIX — How Settings Reach the Live Agent

```
┌─────────────┐     ┌───────────────┐     ┌──────────────┐     ┌──────────────┐
│  Dashboard   │────▶│  Server Action │────▶│   Supabase   │     │  Ultravox    │
│  (React UI)  │     │  (Next.js)    │     │  clients DB  │     │  Live Agent  │
└─────────────┘     └───────────────┘     └──────┬───────┘     └──────▲───────┘
                                                  │                    │
                                                  │    ┌───────────┐   │
                                                  └───▶│updateAgent│───┘
                                                       │(ultravox.ts)│
                                                       └─────▲───────┘
                                                             │
                                                    /prompt-deploy
                                                    (deploy_prompt.py)
```

### Path A: Dashboard Edit → DB only (NO auto-deploy)
- User edits field in UI → server action saves to Supabase → DONE
- Agent is NOT updated. Live agent drifts from DB.
- Affected fields: hours, business_hours, timezone, after_hours_behavior, website_url

### Path B: Dashboard "Save & Sync" → DB + updateAgent()
- User edits prompt/voice/tools → server action saves to Supabase → calls updateAgent()
- Agent IS updated. Should stay in sync.
- Affected fields: system_prompt, agent_voice_id, booking_enabled, sms_enabled, forwarding_number

### Path C: /prompt-deploy CLI → DB + Ultravox PATCH
- Developer runs deploy_prompt.py → reads SYSTEM_PROMPT.txt → saves to DB + PATCHes Ultravox
- Bypasses updateAgent() — uses its own tool-building logic
- **Risk:** deploy_prompt.py and ultravox.ts may diverge in what they send

### Path D: Prompt Builder (prompt-builder.ts) → generates prompt text
- Called during onboarding or manual regeneration
- Outputs prompt text only — does NOT deploy
- Must be followed by Path B or C to take effect

---

## 6. CRITICAL FINDINGS SUMMARY

### Finding 1: Template Placeholder Gap (D1-D3) — ALL CLIENTS
**What:** Live agents are missing `{{businessFacts}}`, `{{extraQa}}`, and `{{contextData}}` template placeholders. These were added to `updateAgent()` code but never re-deployed to existing agents.
**Impact:** Business facts, extra Q&A, and context data injected at call-time via templateContext are silently dropped. Callers don't get business-specific context.
**Fix:** Re-run updateAgent() for all 4 clients, or run `/prompt-deploy` with the updated code.

### Finding 2: VAD Interrupt Duration Mismatch (D6) — ALL CLIENTS
**What:** Live agents use 400ms minimum interruption duration, code specifies 200ms.
**Impact:** Callers need to speak longer before they can interrupt the agent. 400ms may actually be better for voice quality — needs evaluation before "fixing."
**Fix:** Decide which value is correct, then either update code or re-deploy agents.

### Finding 3: KNOWN_PARAM_CALL_ID Missing (D4) — WINDSHIELD-HUB+
**What:** Code now adds `X-Call-Id` header to tools for call state tracking, but live agents don't have it.
**Impact:** B3 call state (DB-backed state per call) may not work correctly for tools deployed before this change.
**Fix:** Re-deploy agents to pick up new tool parameter.

### Finding 4: deploy_prompt.py vs ultravox.ts Divergence
**What:** Two separate code paths build tool configs — they may produce different results.
**Impact:** Deploying via CLI vs dashboard could produce different agent configs.
**Fix:** Unify tool-building logic (Phase S1 scope).

### Finding 5: Inline Tool Assembly — Partial Tool Drop + Degraded Transfer (CRITICAL — from truth-tracer, verified 2026-03-21)
**What:** Three API routes build an inline `tools` array (`hangUp` + optional inline `transferCall`) and pass it to `updateAgent()` along with `booking_enabled` and `slug` — but WITHOUT `sms_enabled`, `knowledge_backend`, or `knowledge_chunk_count`:
- [save-prompt/route.ts:82-92](agent-app/src/app/api/admin/save-prompt/route.ts#L82-L92) — admin prompt save
- [prompt-versions/route.ts:118-128](agent-app/src/app/api/dashboard/settings/prompt-versions/route.ts#L118-L128) — version restore
- [voices/assign/route.ts:86-95](agent-app/src/app/api/dashboard/voices/assign/route.ts#L86-L95) — voice change

Because `updateAgent()` uses flag-based builders ([ultravox.ts:566-575](agent-app/src/lib/ultravox.ts#L566-L575)), the actual tools produced are:

| Tool | Status | Reason |
|------|--------|--------|
| hangUp | OK | In passed `tools` array |
| transferCall (inline) | DEGRADED | In passed `tools` array — but missing `CALL_STATE_PARAM`, uses `X-Transfer-Secret` instead of `X-Tool-Secret`, generic description ignores `transfer_conditions` |
| calendar tools | OK | `booking_enabled` + `slug` ARE passed → `updateAgent()` builds them |
| coaching | OK | `slug` IS passed → `updateAgent()` builds it |
| **SMS** | **DROPPED** | `sms_enabled` NOT passed → defaults to undefined → falsy |
| **knowledge** | **DROPPED** | `knowledge_backend` NOT passed → defaults to undefined |

**Mitigating factor:** `inbound/route.ts` passes `overrideTools: client.tools` from the `clients.tools` JSONB column at call time ([ultravox.ts:632](agent-app/src/lib/ultravox.ts#L632)), so live calls use DB tools, NOT Ultravox stored tools. This means the tool drop does NOT affect live calls — but the Ultravox agent state drifts after every admin save, version restore, or voice change.

**Additional gap:** [sync-agent/route.ts:55-66](agent-app/src/app/api/dashboard/settings/sync-agent/route.ts#L55-L66) correctly passes ALL flags to `updateAgent()` (full tool set is built), but does NOT write `clients.tools` to the DB — so if someone uses the sync button without going through settings save, the DB tools column could be stale.

**Fix:** All three routes should pass all tool flags (`sms_enabled`, `knowledge_backend`, `knowledge_chunk_count`, `forwarding_number`, `transfer_conditions`) to `updateAgent()` instead of building inline tools. Remove inline transferCall assembly entirely — let `buildTransferTools()` handle it. The sync-agent route needs to also write `clients.tools`.

### Finding 6: clients.tools Column is Runtime-Authoritative
**What:** The `clients.tools` JSONB column in Supabase — NOT the Ultravox agent's `selectedTools` — is what controls tool availability on live calls. `callViaAgent()` passes `overrideTools: client.tools` on every inbound call.
**Impact:** This means Ultravox agent stored tools are a "cache" that can drift without affecting live calls. But it also means the `clients.tools` column must be kept correct — any route that changes tool config must write BOTH Ultravox AND `clients.tools`.
**Implication for S1:** The unification effort should ensure every deploy path writes both targets atomically.

---

## 7. PHASE 0d COMPLETION CHECKLIST

- [x] System truth map produced (Section 4 + 5)
- [x] Saved vs generated vs deployed matrix produced (Section 2)
- [x] Path matrix produced (Section 5)
- [x] Settings-to-runtime map produced (Section 4)
- [x] Drift register produced (Section 1)
- [x] File/function trace — covered by drift reports in `docs/refactor-baseline/snapshots/2026-03-21-0858/drift-*.md`

**Phase 0 is COMPLETE. Ready for Phase S1.**
