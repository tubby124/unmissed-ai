# Control-Plane Mutation Contract

**Created:** 2026-03-25
**Source:** Derived from code inspection of `src/lib/`, `src/app/api/`, and supporting files.
**Purpose:** Authoritative reference for how every dashboard field flows from user edit → DB → Ultravox live agent.

---

## 1. Classification Legend

Each field in the system belongs to exactly one mutation class. The class determines the full set of side effects that must be triggered whenever the field changes.

| Class | What it means |
|-------|---------------|
| **DB_ONLY** | Write to `clients` table. No Ultravox API call required. Change is visible immediately at the DB layer and takes effect on the next call via runtime reads (e.g., templateContext injection, callerContext build). |
| **DB_PLUS_PROMPT** | Write to `clients` table AND the value must be embedded into `clients.system_prompt` (directly or via a patcher). Next call to `updateAgent()` picks up the updated prompt text. Without `updateAgent()`, the live agent runs the stale prompt. |
| **DB_PLUS_TOOLS** | Write to `clients` table AND `updateAgent()` must be called to rebuild `callTemplate.selectedTools` on the live Ultravox agent. Also triggers `clients.tools` resync for call-time `toolOverrides`. |
| **DB_PLUS_PROMPT_PLUS_TOOLS** | Write to DB AND both prompt and tools must sync. Typically occurs when enabling/disabling a feature that has an instruction block in the prompt AND a registered tool. Booking is the only current example. |
| **DB_PLUS_KNOWLEDGE_PIPELINE** | Write to DB AND the knowledge embedding pipeline must re-run (`reseedKnowledgeFromSettings()` or `seedKnowledgeFromScrape()`). Knowledge chunks in `knowledge_chunks` table become the runtime-authoritative source for the `queryKnowledge` tool. |
| **READ_MODEL_ONLY** | Field is computed from other DB fields at read time (e.g., `buildCapabilityFlags()`, `getEffectiveMinuteLimit()`). No direct DB write path for this derived value. Changing upstream fields triggers the derived state. |
| **PER_CALL_CONTEXT_ONLY** | Value is assembled at call-creation time via `buildAgentContext()` → `callerContextBlock` → `templateContext`. It is never stored in `system_prompt`. If the DB value changes, the next call automatically gets the updated value with no agent sync required. |

---

## 2. Field Classification Table

> Notes on columns:
> - **Primary save path(s):** API route(s) that accept writes for this field.
> - **Live agent sync required:** Whether `updateAgent()` must be called for the change to affect in-progress or future calls.
> - **Knowledge reindex required:** Whether `reseedKnowledgeFromSettings()` or `seedKnowledgeFromScrape()` must run.
> - **Per-call context only:** Whether the value bypasses the stored prompt and is injected fresh each call via `templateContext`.
> - **Known drift risk:** Verified discrepancies between UI state and agent runtime state.

| Field | Class | DB source (`clients.*`) | Primary save path(s) | Prompt impact | Tool/runtime impact | Live agent sync required | Knowledge reindex required | Per-call context only | User-visible surfaces | Known drift risk | Current impl status | Recommended owner fn |
|-------|-------|--------------------------|----------------------|---------------|---------------------|--------------------------|----------------------------|-----------------------|-----------------------|-----------------|---------------------|----------------------|
| `agent_name` | DB_PLUS_PROMPT | `clients.agent_name` | `PATCH /api/dashboard/settings` | YES — `patchAgentName()` replaces old name with new name throughout `system_prompt` | None | YES — triggers `needsAgentSync` when `system_prompt` changes | No | No | Settings → Agent Identity card | Low — patcher is word-boundary matched | Implemented | `patchAgentName()` in `lib/prompt-patcher.ts` |
| `business_name` | DB_ONLY | `clients.business_name` | Provision routes (set once) | Baked into generated prompt at provision time; not re-patched on change | None | No — changing post-provision does not trigger prompt update or agent sync | No | No | Dashboard header, Telegram alerts | **MEDIUM** — post-provision edits to `business_name` do NOT update the live prompt or agent | No post-provision PATCH path | Manual `/prompt-deploy` if name changes |
| `niche` | DB_ONLY | `clients.niche` | Provision routes (set once) | Baked into generated prompt at provision time; affects `buildCapabilityFlags()` and tool registration | Affects `buildAgentTools()` via plan/niche defaults | No direct sync path post-provision | No | No | Internal routing, niche-based capabilities | **HIGH** — niche determines tool defaults; no post-provision update path exists | Set once at provision; no settings PATCH path | N/A — treated as immutable after provision |
| `agent_voice_id` | DB_PLUS_TOOLS | `clients.agent_voice_id` | `PATCH /api/dashboard/settings`; set at provision via `resolveVoiceId()` | None | YES — `updateAgent({ voice })` sends new voice ID to Ultravox | YES — in `needsAgentSync` check in settings PATCH | No | No | Settings → Voice card, VoiceStyleCard | Low — direct pass-through | Implemented | `updateAgent()` in `lib/ultravox.ts` |
| `business_hours_weekday` | PER_CALL_CONTEXT_ONLY | `clients.business_hours_weekday` | `PATCH /api/dashboard/settings`; provision/trial writes from `toIntakePayload()` | NOT stored in prompt — injected at call time via `callerContextBlock` | None — hours are informational context only (agent always answers) | No | No | No | Settings → Hours card | Low — after-hours detection reads this live at call time | Implemented via `buildAgentContext()` | `detectAfterHours()` in `lib/agent-context.ts` |
| `business_hours_weekend` | PER_CALL_CONTEXT_ONLY | `clients.business_hours_weekend` | `PATCH /api/dashboard/settings`; provision/trial | Same as weekday | None | No | No | No | Settings → Hours card | Low | Implemented | Same |
| `after_hours_behavior` | PER_CALL_CONTEXT_ONLY | `clients.after_hours_behavior` | `PATCH /api/dashboard/settings`; provision/trial | NOT in prompt — injected via `OFFICE STATUS:` line in `callerContextBlock` at call time | None | No | No | No | Settings → Hours card | Low | Implemented | `buildAfterHoursBehaviorNote()` in `lib/agent-context.ts` |
| `after_hours_emergency_phone` | PER_CALL_CONTEXT_ONLY | `clients.after_hours_emergency_phone` | `PATCH /api/dashboard/settings`; provision/trial | Injected via `callerContextBlock` only when `after_hours_behavior=route_emergency` | None | No | No | No | Settings → Hours card | Low | Implemented | `buildAfterHoursBehaviorNote()` |
| `booking_enabled` | DB_PLUS_PROMPT_PLUS_TOOLS | `clients.booking_enabled` | `PATCH /api/dashboard/settings`; provision/trial via `callHandlingMode` | YES — `patchCalendarBlock()` appends/removes `# CALENDAR BOOKING FLOW` block in `system_prompt` | YES — `buildAgentTools()` adds/removes `checkCalendarAvailability` + `bookAppointment` tools | YES — in `needsAgentSync` | No | No | Settings → Booking card, CapabilitiesCard | **INTENTIONAL GAP**: UI badge requires `calendar_auth_status='connected'`; agent registers tool regardless. Tool fails gracefully when calendar unconnected. | Implemented with post-enable Ultravox verification | `patchCalendarBlock()` + `buildAgentTools()` |
| `calendar_auth_status` | READ_MODEL_ONLY | `clients.calendar_auth_status` | OAuth callback sets this to `'connected'`; no settings PATCH | None | None — affects UI truth only (`buildCapabilityFlags().hasBooking`) | No | No | No | CapabilitiesCard booking badge | See `booking_enabled` drift risk above | Derived | `buildCapabilityFlags()` in `lib/capability-flags.ts` |
| `sms_enabled` | DB_PLUS_TOOLS | `clients.sms_enabled` | `PATCH /api/dashboard/settings`; `activateClient()` sets from intake `callerAutoText` | None | YES — `buildAgentTools()` conditionally includes `sendTextMessage` tool (requires both `sms_enabled=true` AND `twilio_number` set) | YES — in `needsAgentSync` | No | No | Settings → SMS card, CapabilitiesCard | **GAP (active)**: `agentFlags` in settings PATCH fetches `twilio_number` from DB column (see `select()` at line 419), so this is actually passed. But `capability-sync-framework.md` flagged this as potentially missing. Re-verify: `settings/route.ts` line 442 resolves `twilio_number` from `clientRow.twilio_number`. The gap exists if `twilio_number` is not in the `select()` list — confirmed it IS included. | Implemented | `buildAgentTools()` in `lib/ultravox.ts` |
| `twilio_number` | DB_PLUS_TOOLS | `clients.twilio_number` | `ensureTwilioProvisioned()` at activation/upgrade; admin-only God Mode PATCH | None | YES — affects whether `sendTextMessage` SMS tool is registered (requires `twilio_number` non-null) | **GAP**: NOT in `needsAgentSync` in settings PATCH. Admin setting the number via God Mode does NOT trigger agent resync. | No | No | Settings → God Mode (admin), call routing | **GAP**: Admin sets `twilio_number` → SMS tool registration is stale until next `sms_enabled` toggle or manual sync | Documented gap; workaround: toggle `sms_enabled` off+on | Add to `needsAgentSync` + `select()` in settings PATCH |
| `forwarding_number` | DB_PLUS_TOOLS | `clients.forwarding_number` | `PATCH /api/dashboard/settings`; provision/trial for Pro plan | None | YES — `buildAgentTools()` adds `transferCall` HTTP tool when set; tool description uses `transfer_conditions` | YES — in `needsAgentSync` | No | No | Settings → Transfer card, CapabilitiesCard | Low | Implemented | `buildTransferTools()` in `lib/ultravox.ts` |
| `transfer_conditions` | DB_PLUS_TOOLS | `clients.transfer_conditions` | `PATCH /api/dashboard/settings` | None | YES — used as `description` text in `transferCall` tool | YES — in `needsAgentSync` (triggers because `transfer_conditions` is in the updates check at line 409) | No | No | Settings → Transfer card | Low | Implemented | `buildTransferTools()` |
| `voicemail_greeting_text` | DB_ONLY | `clients.voicemail_greeting_text` | `PATCH /api/dashboard/settings` | None | Used by voicemail fallback TwiML at call time (not in agent) | No | No | No | Settings → Voicemail card | Low — read at call time directly from DB | Implemented | Inbound webhook reads this if Ultravox is down |
| `voicemail_greeting_audio_url` | DB_ONLY | `clients.voicemail_greeting_audio_url` | `PATCH /api/dashboard/settings` | None | Same as above | No | No | No | Settings → Voicemail card | Low | Implemented | Same |
| `ivr_enabled` | DB_ONLY | `clients.ivr_enabled` | `PATCH /api/dashboard/settings`; provision/trial | None | Gating logic in inbound webhook — reads `client.ivr_enabled` at call time to decide whether to serve `buildIvrGatherTwiml()` before connecting to agent | No | No | No | Settings → IVR card | Low — gating is runtime DB read, not agent config | Implemented | Inbound webhook gate in `route.ts` line 76 |
| `ivr_prompt` | DB_ONLY | `clients.ivr_prompt` | `PATCH /api/dashboard/settings`; provision/trial | None | Used verbatim in IVR TwiML at call time | No | No | No | Settings → IVR card | Low | Implemented | Same |
| `website_url` | DB_ONLY | `clients.website_url` | `PATCH /api/dashboard/settings`; provision/trial | None — saving URL does not trigger scrape | None — scrape must be triggered separately via `/api/dashboard/scrape-website` | No | No | No | Settings → Knowledge card, scrape nudge | **GAP**: Saving a website URL gives no visible feedback that a scrape must be run separately. Not a data integrity risk — just UX. | Implemented (save is decoupled from scrape) | `PATCH /api/dashboard/settings` (URL only); scrape is separate |
| `website_scrape_status` | DB_ONLY | `clients.website_scrape_status` | Scrape pipeline sets this: `null` → `'extracted'` → `'approved'`; provision/trial sets `'approved'` when scrape result accepted during onboarding | None — status signals pipeline state only | Controls `hasWebsite` in `buildCapabilityFlags()` — only `'approved'` = badge active | No | No | No | CapabilitiesCard website badge | Low — computed correctly from status | Implemented | `buildCapabilityFlags()` |
| Website knowledge approval | DB_PLUS_KNOWLEDGE_PIPELINE | `knowledge_chunks.status` (per-chunk) | Scrape approval route sets chunks to `status='approved'` | None | `buildAgentTools()` checks approved chunk count — tool only registered when `count > 0` | YES — if changing `knowledge_backend` or approving first chunks, must call `updateAgent()` via `syncClientTools()` or settings PATCH | YES — approval pipeline runs `seedKnowledgeFromScrape()` | No | Scrape review UI | **INTENTIONAL**: UI badge shows `knowledge_backend='pgvector'`; agent registers tool only when approved chunks exist | Implemented | `seedKnowledgeFromScrape()` in `lib/seed-knowledge.ts` |
| PDF knowledge upload | DB_PLUS_KNOWLEDGE_PIPELINE | `client_knowledge_docs` table + `knowledge_chunks` | Knowledge upload routes; `activateClient()` seeds docs linked to intake | None | Same as website knowledge — chunks feed `queryKnowledge` tool | Yes (tool re-registration via `syncClientTools()`) | YES — `embedChunks()` in `lib/embeddings.ts` | No | Settings → Knowledge card | Low | Implemented | `embedChunks()` + `syncClientTools()` |
| AI Compiler import | DB_PLUS_KNOWLEDGE_PIPELINE | `knowledge_chunks` (`source='compiled_import'`, `status='approved'`) + `clients.extra_qa` (faq_pair) + `compiler_runs` (provenance) | `POST /api/dashboard/knowledge/compile` (extract) → UI review → `POST /api/dashboard/knowledge/compile/apply` (write) | None | `embedChunks()` writes chunks with `compile_run_id` FK; `syncClientTools()` registers `queryKnowledge` tool when first chunks appear | YES — `syncClientTools()` called after apply | YES — `embedChunks()` writes to `knowledge_chunks`; `reseedKnowledgeFromSettings()` fires for faq_pair items when `knowledge_backend='pgvector'` | No | Knowledge → AI Compiler tab | **GOVERNANCE**: BLOCKED_KINDS (`call_behavior_instruction`, `unsupported_or_ambiguous`, `conflict_flag`) never written; HIGH_RISK_KINDS (`pricing_or_offer`, `hours_or_availability`, `location_or_service_area`, `operating_policy`) get `trust_tier='medium'`; UI requires explicit verification checkbox before approve | Implemented | `embedChunks()` + `syncClientTools()` in `compile/apply/route.ts` |
| `extra_qa` (FAQ entries) | DB_PLUS_KNOWLEDGE_PIPELINE | `clients.extra_qa` | `PATCH /api/dashboard/settings`; provision (from `niche_faq_pairs` in intake); `activateClient()` | NOT in system_prompt directly — injected via `businessFacts` block at call time (as `KnowledgeSummary`) | If `knowledge_backend='pgvector'`, `reseedKnowledgeFromSettings()` fires after save | No (injected per-call via `businessFacts` templateContext) | YES — settings PATCH triggers `reseedKnowledgeFromSettings()` when `extra_qa` changes and `knowledge_backend='pgvector'` | No — businessFacts block is per-call | Settings → FAQ card (quick-add), Knowledge card | Low | Implemented | `reseedKnowledgeFromSettings()` in `lib/embeddings.ts` |
| `business_facts` | DB_PLUS_KNOWLEDGE_PIPELINE | `clients.business_facts` | `PATCH /api/dashboard/settings`; provision/trial via scrape acceptance | Injected via `businessFacts` templateContext block at call time (not stored in `system_prompt`) | Same as `extra_qa` reindex path | No direct prompt sync — per-call injection | YES — same trigger as `extra_qa` | No — per-call via `businessFacts` templateContext | Settings → Facts card | Low | Implemented | Same |
| Notification preferences (`telegram_notifications_enabled`, `email_notifications_enabled`) | DB_ONLY | `clients.telegram_notifications_enabled`, `clients.email_notifications_enabled` | `PATCH /api/dashboard/settings` (indirectly via `notificationMethod`); provision/trial sets from `data.notificationMethod` | None | None — read by post-call webhook to determine alert routing | No | No | No | Settings → Notifications card | Low | [UNVERIFIED - needs code check on actual notification read logic] | Post-call webhook |
| `telegram_style` | DB_ONLY | `clients.telegram_style` | `PATCH /api/dashboard/settings` | None | None — affects notification formatting only | No | No | No | Settings → Notifications card | Low | Implemented | Notification formatting code |
| `weekly_digest_enabled` | DB_ONLY | `clients.weekly_digest_enabled` | `PATCH /api/dashboard/settings` | None | None — read by digest cron job | No | No | No | Settings → Notifications card | Low | Implemented | Digest cron (not yet built) |
| `selected_plan` | DB_PLUS_TOOLS | `clients.selected_plan` | Stripe webhook (`checkout.session.completed`, `customer.subscription.updated`); set at provision/trial | None | YES — `buildAgentTools()` intersects DB capability flags with `getPlanEntitlements(selected_plan)`. Plan change → tools must resync via `syncClientTools()` | YES — Stripe webhook calls `syncClientTools()` on plan change | No | No | Billing card, CapabilitiesCard, upgrade CTAs | **MEDIUM**: Tool-level plan gating is only enforced when `buildAgentTools()` runs. If `selected_plan` changes without `syncClientTools()` call, live agent retains old tool set. | Stripe webhook calls `syncClientTools()` on upgrade | `syncClientTools()` + `updateAgent()` |
| `subscription_status` | DB_ONLY (for most uses) | `clients.subscription_status` | Stripe webhook (`checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.deleted`) | None — runtime reads use this for plan gate bypass (`trialing` → all tools) | Affects `buildAgentTools()` trialing bypass at call time; minute enforcement at call time | No direct agent sync | No | No | Billing card, minute enforcement | **MEDIUM**: `subscription_status='trialing'` bypasses plan gating in `buildAgentTools()`. This is computed at call time from DB — no agent sync needed. But if status changes mid-call, in-progress call is unaffected. | Implemented — Stripe webhook is authoritative | Stripe webhook |
| Test-call settings (`maxDuration` for trial) | READ_MODEL_ONLY | `subscription_status='trialing'` → `maxDuration='180s'` in `createAgent()` | Set at agent creation during provision/trial | None | `createAgent()` hardcodes `maxDuration: '180s'` for trial agents. Paid activation uses default 600s. | No post-provision path to change | No | No | Not user-visible | **INTENTIONAL**: trial agents are capped at 3 min; paid agents at 10 min. No settings surface to change this. | Implemented | `createAgent()` in `lib/ultravox.ts` |
| Browser demo context | PER_CALL_CONTEXT_ONLY | Not persisted — assembled from `localStorage` + Zara demo prompt | Demo call creation routes | Demo prompts assembled from `lib/demo-prompts.ts` — not from `clients` table | Demo tools assembled via `buildDemoTools()` using runtime capability flags | No — ephemeral per demo | No | Yes | Demo page (public) | Low — demo is isolated from production client config | Implemented | `buildDemoTools()` + `createDemoCall()` |
| Live phone call context (`callerPhone`, `TODAY`, `CURRENT TIME`, etc.) | PER_CALL_CONTEXT_ONLY | Computed at call time: `callerPhone` from Twilio `body.From`; date/time from `new Date()` in client timezone | Assembled in inbound webhook via `buildAgentContext()` | NOT in `system_prompt` — injected via `callerContextBlock` → `templateContext.callerContext` | None | No | No | Yes | Agent during call only | Low — assembled fresh every call | Implemented | `buildAgentContext()` in `lib/agent-context.ts` |
| `injected_note` (Today's Update) | PER_CALL_CONTEXT_ONLY | `clients.injected_note` | `PATCH /api/dashboard/settings` | NOT in prompt — injected as `RIGHT NOW: {note}` in `callerContextBlock` | None | No | No | Yes | Settings → Today's Update card | Low — injected live at call time | Implemented | `buildAgentContext()` reads this and appends to `callerContextStr` |
| Transfer behavior (`forwarding_number` + `transfer_conditions`) | DB_PLUS_TOOLS | See `forwarding_number` and `transfer_conditions` above | See above | None | `buildTransferTools()` uses `transfer_conditions` as tool description | YES — both fields are in `needsAgentSync` | No | No | Settings → Transfer card | Low | Implemented | `buildTransferTools()` |
| Voicemail behavior | DB_ONLY | `clients.voicemail_greeting_text`, `clients.voicemail_greeting_audio_url` | `PATCH /api/dashboard/settings` | None | Read at call time by inbound webhook to build `buildVoicemailTwiml()` — only used when Ultravox is unreachable | No | No | No | Settings → Voicemail card | Low — fallback path only | Implemented | `buildVoicemailTwiml()` in `lib/twilio.ts` |
| `context_data` (reference table) | PER_CALL_CONTEXT_ONLY | `clients.context_data` | `PATCH /api/dashboard/settings` | NOT in system_prompt — injected via `contextDataBlock` → `templateContext.contextData` | None | No | No | Yes | Settings → Reference Data card | Low | Implemented | `buildAgentContext()` |
| `knowledge_backend` | DB_PLUS_TOOLS | `clients.knowledge_backend` | `PATCH /api/dashboard/settings` (admin only) | None | `buildAgentTools()` conditionally includes `queryKnowledge` tool when `='pgvector'` AND chunk count > 0 | YES — in `needsAgentSync`; triggers `updateAgent()` with live chunk count check | No (the backend switch itself does not reseed; existing chunks remain) | No | CapabilitiesCard knowledge badge | **INTENTIONAL**: UI shows backend=pgvector; agent only registers tool when chunks exist | Implemented | `buildKnowledgeTools()` in `lib/ultravox.ts` |

---

## 3. How a Change Flows

This walkthrough covers the standard settings-edit path. Other mutations paths (provision, Stripe webhook) are noted where they diverge.

```
User makes a change in dashboard
          │
          ▼
PATCH /api/dashboard/settings
          │
          ├─ [1] Authenticate: createServerClient() → supabase.auth.getUser()
          │        → lookup client_users for client_id (uses .limit(1).maybeSingle())
          │
          ├─ [2] Accumulate updates{} from validated body fields
          │        For each accepted field: type-check + allowlist guard
          │        Admin-only fields: role === 'admin' gate
          │
          ├─ [3] Prompt auto-patches (if applicable):
          │        booking_enabled changed  → patchCalendarBlock() on system_prompt
          │        voice_style_preset changed → patchVoiceStyleSection() on system_prompt
          │        agent_name changed        → patchAgentName() on system_prompt
          │        section_id/content        → replacePromptSection() on system_prompt
          │        All patched prompts go through validatePrompt() (max 12K chars)
          │
          ├─ [4] DB write: supabase.from('clients').update(updates).eq('id', targetClientId)
          │
          ├─ [5] Knowledge reseed (if business_facts or extra_qa changed):
          │        IF knowledge_backend === 'pgvector'
          │          → reseedKnowledgeFromSettings() [fire-and-forget, non-blocking]
          │            → deletes 'settings_edit' source chunks
          │            → re-embeds new facts/QA into knowledge_chunks
          │
          ├─ [6] needsAgentSync check:
          │        Triggered when any of these are in updates:
          │          system_prompt, forwarding_number, transfer_conditions,
          │          booking_enabled, agent_voice_id, knowledge_backend,
          │          sms_enabled, twilio_number
          │
          │        IF needsAgentSync AND ultravox_agent_id exists:
          │          │
          │          ├─ Resolve all flags from DB (fresh SELECT with all relevant columns)
          │          ├─ If knowledge_backend='pgvector': count approved knowledge_chunks
          │          ├─ Build agentFlags{} object (single source of truth for updateAgent)
          │          │
          │          ├─ updateAgent(agentId, agentFlags)
          │          │    → Builds full callTemplate (all defaults must be present — PATCH replaces entirely)
          │          │    → stripPromptMarkers() on system_prompt before send
          │          │    → Ensures {{callerContext}}, {{businessFacts}}, {{contextData}} placeholders present
          │          │    → buildAgentTools(agentFlags) → selectedTools array
          │          │    → PATCH https://api.ultravox.ai/api/agents/{agentId}
          │          │
          │          └─ buildAgentTools(agentFlags) → clients.tools (DB sync for call-time toolOverrides)
          │
          ├─ [7] Prompt version insert (if system_prompt changed):
          │        insertPromptVersion() → prompt_versions table
          │        Update clients.active_prompt_version_id
          │        If non-admin edit: Telegram alert to operator
          │
          └─ [8] Response: { ok, ultravox_synced, ultravox_error?, warnings? }
```

**Branch: Knowledge pipeline** (provision + scrape approval)
```
website_url saved → separate POST /api/dashboard/scrape-website
  → scrapeWebsite() → raw content
  → Knowledge preview shown to user
  → User approves → seedKnowledgeFromScrape()
      → deleteClientChunks() for 'website_scrape' source
      → embedChunks() → knowledge_chunks (status='approved')
      → syncClientTools() → clients.tools rebuild
      → Ultravox agent NOT immediately updated — tools sync is DB-only
        (runtime reads clients.tools via toolOverrides at call time)
```

**Branch: Stripe webhook (plan change / upgrade)**
```
Stripe sends customer.subscription.updated or checkout.session.completed
  → Write selected_plan, subscription_status, monthly_minute_limit to DB
  → syncClientTools() → clients.tools rebuild (plan-gated tools recalculated)
  → Ultravox agent NOT explicitly updated here
    (tools flow through clients.tools → toolOverrides at call time)
  → For trial upgrade: ensureTwilioProvisioned() → twilio_number written to DB
```

**At call time (every inbound call)**
```
POST /api/webhook/{slug}/inbound (Twilio)
  → Fetch client row (includes tools, all context columns)
  → buildAgentContext() → callerContextBlock, businessFacts, contextData
  → callViaAgent(agentId, { overrideTools: client.tools, callerContext, businessFacts, contextData })
      → toolOverrides: { removeAll: true, add: client.tools }
      → templateContext: { callerContext, businessFacts, contextData }
  → [Fallback if Agents API fails]: createCall() with full system_prompt + context appended inline
```

---

## 4. Do Not Do This

### Fake controls (UI toggle with no runtime effect)

Do not build a settings toggle that writes to the DB but never reaches `needsAgentSync`. The agent will keep its stale tool set until something else triggers a sync. The `twilio_number` God Mode field is the one confirmed case of this pattern — it was knowingly deferred because it is admin-only. Any new field that affects tool registration must be added to `needsAgentSync` AND to the `select()` block that builds `agentFlags`.

### Duplicate save logic

Do not implement the same tool registration logic in two places. `buildAgentTools()` in `lib/ultravox.ts` is the single source of truth for tool assembly. `syncClientTools()` calls it. The settings PATCH `needsAgentSync` block calls it. Any third path that assembles tools independently will drift. Do not replicate the `if (booking_enabled && plan.bookingEnabled)` logic outside of `buildAgentTools()`.

### Prompt-only truth

Do not use the content of `system_prompt` as the source of truth for a setting. The system prompt is a derived artifact. The canonical source is the DB column (e.g., `booking_enabled`, `forwarding_number`). Auditing the live prompt to determine whether a feature is enabled is unreliable — patchers can fail, prompts can be manually edited, and the Ultravox-stored version always has markers stripped. Read the DB column.

### Storing transient context in persistent config

Do not put per-call data (caller's phone, current time, after-hours state, returning-caller info) into `system_prompt`. This content is assembled fresh every call via `buildAgentContext()` and injected via `templateContext.callerContext`. Putting it in the stored prompt would make it stale immediately and create drift between DB truth and live agent behavior.

### Assuming tools are set on the agent at call time

The Agents API uses `toolOverrides: { removeAll: true, add: client.tools }` at call time. This means the `callTemplate.selectedTools` stored on the Ultravox agent is overridden on every call by the value in `clients.tools`. The agent's stored tool config is effectively inert for production calls. `clients.tools` is the runtime-authoritative source. Do not audit the Ultravox agent's stored tools to determine what tools run on a live call — read `clients.tools` from Supabase instead.

---

## 5. Future-Safe Checklist: Adding a New Setting

Follow this checklist in order when adding any new field to the settings system.

- [ ] **1. DB migration** — Add column to `clients` table with a sensible default (never `NOT NULL` without a default if existing rows must remain valid).
- [ ] **2. Classify the field** — Assign it one of the 7 classes from Section 1. Determine whether it affects: (a) prompt text, (b) tool registration, (c) per-call context injection, (d) knowledge pipeline.
- [ ] **3. Settings PATCH** — Add an `if (typeof body.field === 'type')` block to the `updates{}` accumulator in `src/app/api/dashboard/settings/route.ts`. Add role guard if admin-only.
- [ ] **4. needsAgentSync** — If the field affects tool registration (class `DB_PLUS_TOOLS`, `DB_PLUS_PROMPT_PLUS_TOOLS`), add it to the `needsAgentSync` boolean expression AND to the `select()` call that builds `agentFlags`.
- [ ] **5. agentFlags** — Add the field to the `agentFlags` object passed to `updateAgent()` and `buildAgentTools()`.
- [ ] **6. buildAgentTools()** — If adding a new tool: add the tool builder function, add gating logic (DB flag AND plan entitlement), update the composite `return` at the bottom.
- [ ] **7. buildCapabilityFlags()** — If there is a user-visible badge for this capability, add it to `ClientCapabilityInput` and the `buildCapabilityFlags()` return value in `lib/capability-flags.ts`.
- [ ] **8. syncClientTools()** — No change needed if `buildAgentTools()` is updated — `syncClientTools()` calls `buildAgentTools()` with a fresh DB fetch. But verify the new column is included in the `select()` inside `syncClientTools()`.
- [ ] **9. Plan entitlements** — If plan-gated: add the entitlement field to `PlanEntitlements` interface and set values per plan in `LITE`, `CORE`, `PRO`, `TRIAL_ENTITLEMENTS` in `lib/plan-entitlements.ts`.
- [ ] **10. Stripe webhook** — Confirm that `syncClientTools()` in the upgrade/plan-change path will pick up the new field (it does a fresh DB select, so it will if the column is in the select list of `syncClientTools()`).
- [ ] **11. Provision routes** — If the field should be written during onboarding: add it to `toIntakePayload()` in `lib/intake-transform.ts` AND to the `clients.insert()` block in `provision/trial/route.ts`.
- [ ] **12. Per-call context** — If the field is `PER_CALL_CONTEXT_ONLY`: add it to `ClientRow` type in `lib/agent-context.ts`, read it in `buildAgentContext()`, and include it in the appropriate context string. Add it to the `select()` in the inbound webhook route.
- [ ] **13. Knowledge pipeline** — If `DB_PLUS_KNOWLEDGE_PIPELINE`: add the reseed trigger to the `if ('business_facts' in updates || ...)` block in the settings PATCH handler.
- [ ] **14. Drift check** — After implementing, confirm that `buildCapabilityFlags()` (UI truth) and `buildAgentTools()` (agent truth) apply the same logic to the same DB field. Mismatched logic = fake-control bug.

---

## 6. Config Layer Separation

These are distinct layers. Do not mix writes or reads across layers.

### Persistent dashboard config
Survives agent restart, upgrade, and new calls. Stored in `clients` table.
- `system_prompt`, `agent_voice_id`, `agent_name`
- `booking_enabled`, `forwarding_number`, `transfer_conditions`, `sms_enabled`, `sms_template`
- `knowledge_backend`, `business_facts`, `extra_qa`, `context_data`, `context_data_label`
- `business_hours_weekday`, `business_hours_weekend`, `after_hours_behavior`, `after_hours_emergency_phone`
- `voicemail_greeting_text`, `voicemail_greeting_audio_url`, `ivr_enabled`, `ivr_prompt`
- `telegram_notifications_enabled`, `email_notifications_enabled`, `telegram_style`, `weekly_digest_enabled`

Write path: `PATCH /api/dashboard/settings`.

### Provision-time config
Set once during trial or Stripe checkout. Rarely changed post-activation. No user-facing settings UI for most of these.
- `niche`, `twilio_number`, `slug`, `ultravox_agent_id`, `selected_plan`
- `subscription_status`, `stripe_subscription_id`, `stripe_customer_id`
- `classification_rules`, `timezone`, `monthly_minute_limit`

Write path: `provision/trial/route.ts` + `activateClient()` + Stripe webhook.

### Live-agent sync config
Fields that, when changed, must trigger `updateAgent()` to reach the Ultravox agent. This is the subset of persistent config that has a live-agent mirror.
- `system_prompt`, `agent_voice_id`
- `booking_enabled`, `forwarding_number`, `transfer_conditions`, `sms_enabled`, `twilio_number`, `knowledge_backend`

Trigger: `needsAgentSync` check in `PATCH /api/dashboard/settings`.
Exception: `clients.tools` is kept in sync separately for use as `toolOverrides` at call time. `clients.tools` is the runtime source — the agent's stored `selectedTools` is overridden by `toolOverrides` on every production call.

### Per-call context
Assembled fresh at call creation. Never stored in `system_prompt`. Injected via `templateContext`.
- Caller phone (`CALLER PHONE:`), today's date, current time, day of week
- After-hours status and behavior note
- Returning caller info (prior call count, last call summary, caller name)
- Office hours (informational block in `callerContextBlock`)
- `injected_note` (Today's Update) — DB column read fresh each call

Assembly: `buildAgentContext()` in `lib/agent-context.ts`.
Injection: `callViaAgent()` `templateContext.callerContext` / `templateContext.businessFacts` / `templateContext.contextData`.

### Knowledge truth
The authoritative source of what the agent "knows" at query time. Separate from the prompt.
- `knowledge_chunks` table (pgvector embeddings) — `status='approved'` chunks are live
- `clients.business_facts`, `clients.extra_qa` — also materialized as `settings_edit` source chunks when `knowledge_backend='pgvector'`
- `client_knowledge_docs` — PDF and other uploaded documents, seeded into `knowledge_chunks`

Write path: `seedKnowledgeFromScrape()`, `embedChunks()`, `reseedKnowledgeFromSettings()`.
Runtime: `queryKnowledge` tool → `POST /api/knowledge/{slug}/query` → hybrid pgvector search.

---

## 7. Known Current Drift Risks

These are confirmed risks derived from reading the actual code. They are ranked by production impact.

### Risk 1: Separate UI and agent tool builders (MEDIUM — active)
`buildCapabilityFlags()` (`lib/capability-flags.ts`) determines what badges show on the dashboard. `buildAgentTools()` (`lib/ultravox.ts`) determines what tools the live agent has. They are independent functions applying similar but not identical logic to the same DB fields.

Example divergence that is intentional and documented:
- UI `hasBooking`: requires `booking_enabled=true` AND `calendar_auth_status='connected'`
- Agent `buildAgentTools()`: adds calendar tools when `booking_enabled=true` (ignores `calendar_auth_status`)

Example divergence that is intentional:
- UI `hasKnowledge`: `knowledge_backend === 'pgvector'`
- Agent: requires `knowledge_backend === 'pgvector'` AND `knowledge_chunk_count > 0`

Risk: Adding a new capability and updating only one of the two builders produces a fake-control bug where the UI badge says "active" but the tool is missing (or vice versa). The checklist in Section 5 addresses this.

### Risk 2: `twilio_number` not in `needsAgentSync` (LOW — admin-only path only)
If an admin sets or changes `twilio_number` via the God Mode settings card, the change is written to the DB but `updateAgent()` is not called and `clients.tools` is not rebuilt. The SMS tool's presence in the agent's `toolOverrides` on the next call will reflect the stale state until `sms_enabled` is toggled (which does trigger the sync) or a manual `syncClientTools()` is run.

Narrow fix: add `'twilio_number' in updates` to the `needsAgentSync` expression in `settings/route.ts` (line 406) and confirm `twilio_number` is in the `select()` for `clientRow` (it already is at line 419).

### Risk 3: Settings PATCH `needsAgentSync` is additive-only (MEDIUM — latent)
The `needsAgentSync` block only fires if one of the listed fields is in `updates`. If a new field that affects agent behavior is added to the settings PATCH accumulator but not added to `needsAgentSync`, the agent will silently not update. There is no test that validates this coupling. Every new DB_PLUS_TOOLS field added to the PATCH route must also be added to `needsAgentSync` — this is a manual discipline, not enforced by the type system.

### Risk 4: Onboarding vs dashboard parity drift (MEDIUM — active)
`provision/trial/route.ts` writes certain fields to `clients` at provisioning that have no corresponding settings PATCH field. For example, `callback_phone`, `owner_name`, `classification_rules`, and `timezone` are written at provision time and are not currently patchable via the settings UI (only `timezone` is patchable). If a user needs to change these post-provision, there is no API path. The settings extraction tracker (`docs/settings-extraction-tracker.md`) is the authoritative source for which fields have been unified.

### Risk 5: Prompt overuse as source of truth (LOW — design smell)
`patchAgentName()` relies on finding the old name in the stored prompt text to replace it. If the prompt was manually edited to remove or change the agent's name, the patcher will not find the old name and will silently skip the replacement. The DB column (`agent_name`) is the source of truth for what the agent's name should be, but the deployed prompt is not guaranteed to match it after repeated manual edits.

### Risk 6: `business_name` not re-patched after provision (LOW — edge case)
`business_name` is baked into the generated prompt at provision time. There is no post-provision path to update the prompt if `business_name` changes in the DB. A business rename requires running `/prompt-deploy` to regenerate and redeploy the full prompt. This is not surfaced in the settings UI.

### Risk 7: `clients.tools` is the runtime source; Ultravox stored tools are overridden (LOW — by design, but confusing)
Every production call overrides the Ultravox agent's stored `selectedTools` with `toolOverrides: { removeAll: true, add: client.tools }`. This means inspecting the live Ultravox agent via the Ultravox API will show stale tools if `clients.tools` was updated after the last `updateAgent()` call. The `drift-detector` agent must compare against `clients.tools` (DB) as the source of truth for runtime tool state, not the Ultravox API agent config.
