# Outbound Voice-AI Platform — MVP Design

**Date:** 2026-05-05
**Status:** Spec draft — awaiting review before writing-plans
**Scope:** Real-estate first · `intermediary` persona only (initially) · AB/SK only · single-recipient booking · MVP excludes lead distribution, Quebec, caller-ID pool

---

## 1. Goals & Non-Goals

### Goals (MVP ships when these all true)
- Operator can bulk-import contacts from iPhone/Android vCard or CSV into `client_contacts`.
- Operator can create one or more `outbound_campaigns` with AI-Compiler-generated scripts in either `self` or `intermediary` persona.
- Operator can run campaigns: agent dials contacts, qualifies, books appointments to a connected calendar, captures disposition.
- Compliance gates enforced server-side: DNCL scrub, recipient-local-time curfew, internal DNC list, EBR attestation, AB/SK area-code allowlist.
- Plan entitlements gate outbound activation, contact count, monthly minutes.
- One realtor (Hasan, `hasan-sharif` slug) runs a real campaign in `intermediary` persona end-to-end.

### Non-goals (deferred)
- Quebec area codes (514/438/450/579/418/581/367/873/263) → `dial-out` rejects with `area_code_blocked` until Phase 2.
- Lead distribution to multiple recipients (round-robin / geo-match / first-claim) → Phase 2.
- Twilio Trust Hub API integration → manual setup; admin sets `clients.attestation_level` after Hasan completes Trust Hub flow.
- Caller-ID pool / multi-DID per tenant → Phase 2.
- Branded calling / CNAM → Phase 2.
- Predictive / power dialer → MVP is preview-dial only (operator triggers, agent dials).
- Outbound-specific A/B testing of scripts → Phase 2.
- Lead-source CSV provenance UI (just stored, not surfaced) → Phase 2.
- Per-campaign retry ladder config → MVP uses one hardcoded ladder.

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│ /dashboard/outbound  (NEW page)                                          │
│  ├── ContactsTab       — list/import/edit client_contacts                │
│  ├── CampaignsTab      — list/create/edit/run outbound_campaigns         │
│  ├── ComplianceTab     — DNCL scrub status, attestation, EBR attestation │
│  └── HistoryTab        — outbound call history + dispositions            │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ API surface (under /api/dashboard/outbound/)                             │
│  ├── contacts/route.ts          — CRUD (replaces /api/dashboard/contacts)│
│  ├── contacts/import/route.ts   — vCard + CSV bulk upload                │
│  ├── campaigns/route.ts         — CRUD outbound_campaigns                │
│  ├── campaigns/compile/route.ts — AI Compiler outbound-script mode       │
│  ├── campaigns/[id]/dial/route.ts — preview dial single contact          │
│  ├── campaigns/[id]/bulk/route.ts — enqueue all eligible contacts        │
│  ├── compliance/dncl/route.ts   — upload monthly DNCL CSV                │
│  └── compliance/attestation/route.ts — admin sets attestation_level      │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Dispatcher (single chokepoint for all outbound dials)                    │
│  src/lib/outbound-dispatcher.ts (NEW)                                    │
│    1. acquire dispatch_lock for tenant DID                               │
│    2. compliance gate (DNCL + curfew + DNC + AB/SK + EBR + dnc field)    │
│    3. write outbound_attempts row (attempt_n, eligible_at)               │
│    4. createCall(Ultravox) with templateContext                          │
│    5. twilioClient.calls.create() with MachineDetection branched         │
│    6. release lock on completed/failed status callback                   │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Twilio webhook callbacks                                                 │
│  /api/webhook/[slug]/outbound-status  (NEW — status callbacks)           │
│    handles: queued/initiated/ringing/answered/completed/busy/no-answer   │
│             /failed/canceled — drives retry scheduler                    │
│  /api/webhook/[slug]/outbound-connect (EXISTS — TwiML connect/play VM)   │
│    branches on AnsweredBy: human → Ultravox stream                       │
│                            machine_end_beep → <Play> recorded VM         │
│                            machine_end_silence/other → drop, log         │
│  /api/webhook/[slug]/completed (EXISTS — extend to handle outbound)      │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Cron jobs (Railway scheduled tasks)                                      │
│  /api/cron/dncl-scrub             daily   → idempotent rescan if stale   │
│  /api/cron/outbound-retry-scan    every 5 min  → eligible_at <= now()    │
│  /api/cron/scheduled-callbacks    EXISTS — extend to read client_contacts│
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Model

### 3.1 New table: `outbound_campaigns`

```sql
CREATE TABLE outbound_campaigns (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id              uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name                   text NOT NULL,
  status                 text NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft','active','paused','completed','archived')),
  caller_persona         text NOT NULL DEFAULT 'self'
                           CHECK (caller_persona IN ('self','intermediary')),
  intermediary_brand     text,        -- e.g. "HomeMatch" — used in scripts when persona=intermediary
  goal                   text NOT NULL,        -- "qualify and book a 15min meeting"
  tone                   text NOT NULL DEFAULT 'warm'
                           CHECK (tone IN ('warm','professional','direct')),
  prompt                 text,                 -- the assembled outbound system_prompt template
  opening                text,                 -- first-line opener template (uses {{LEAD_NAME}} etc)
  vm_script              text,                 -- voicemail drop script (uses {{LEAD_NAME}} etc)
  contact_filter         jsonb NOT NULL DEFAULT '{}',
                                             -- { tags: ['buyer-q2'], status: 'queued', source: 'open-house' }
  ebr_attested           boolean NOT NULL DEFAULT false,
                                             -- operator confirms all targeted contacts have EBR
  ebr_attested_at        timestamptz,
  ebr_attested_by        uuid REFERENCES auth.users(id),
  dncl_scrub_required    boolean NOT NULL DEFAULT true,
  total_dialed           int NOT NULL DEFAULT 0,
  total_connected        int NOT NULL DEFAULT 0,
  total_voicemail        int NOT NULL DEFAULT 0,
  total_booked           int NOT NULL DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid REFERENCES auth.users(id),
  archived_at            timestamptz
);

CREATE INDEX idx_outbound_campaigns_client_status ON outbound_campaigns(client_id, status);

-- RLS: same client_users pattern as client_contacts.
```

**Activation gate (server-side check before status='draft' → 'active'):**
- `clients.attestation_level = 'A'` (admin manually sets after Trust Hub)
- `clients.recording_consent_acknowledged_at IS NOT NULL`
- `ebr_attested = true` OR `dncl_scrub_required = true` AND DNCL scrub fresh (<31 days)
- `prompt IS NOT NULL` (script generated/approved)

### 3.2 New table: `outbound_attempts` (retry ledger — single source of truth)

```sql
CREATE TABLE outbound_attempts (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id            uuid NOT NULL REFERENCES outbound_campaigns(id) ON DELETE CASCADE,
  contact_id             uuid NOT NULL REFERENCES client_contacts(id) ON DELETE CASCADE,
  attempt_n              int NOT NULL,                  -- 1, 2, 3
  scheduled_for          timestamptz NOT NULL,          -- when to dial
  eligible_at            timestamptz NOT NULL,          -- = scheduled_for, copied for index efficiency
  dispatched_at          timestamptz,
  call_log_id            uuid REFERENCES call_logs(id),
  ultravox_call_id       text,
  twilio_call_sid        text,
  last_status            text,                          -- queued/ringing/in-progress/completed/busy/no-answer/failed/canceled
  answered_by            text,                          -- human/machine_start/machine_end_beep/machine_end_silence/machine_end_other/fax/unknown
  duration_seconds       int,
  outcome                text,                          -- booked/qualified/dnc_requested/voicemail_left/no_answer/failed/wrong_number
  notes                  text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  completed_at           timestamptz,
  UNIQUE (campaign_id, contact_id, attempt_n)
);

CREATE INDEX idx_outbound_attempts_eligible
  ON outbound_attempts(eligible_at) WHERE dispatched_at IS NULL;
CREATE INDEX idx_outbound_attempts_contact ON outbound_attempts(contact_id);
```

**Hardcoded retry ladder (MVP — `src/lib/outbound-retry.ts`):**
```
attempt 1 → immediate when triggered
no_answer / busy → +4 hours within curfew, else next 9am local
voicemail_left → +24 hours, attempt 2
attempt 2 voicemail → mark contact status=attempted, stop
attempt 2 no_answer → +next-day-different-time-of-day = attempt 3
attempt 3 anything-but-connected → mark status=exhausted, stop
human-answered + qualified/booked/dnc → stop attempts
```

### 3.3 New tables: `dnc_list` + `dncl_scrub_runs`

```sql
-- Internal DNC list per client (14-day suppression window per CRTC)
CREATE TABLE client_dnc_list (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  phone        text NOT NULL,                    -- E.164
  source       text NOT NULL,                    -- 'caller_request' | 'sms_optout' | 'manual' | 'campaign_complaint'
  added_at     timestamptz NOT NULL DEFAULT now(),
  added_by     uuid REFERENCES auth.users(id),
  notes        text,
  UNIQUE (client_id, phone)
);
CREATE INDEX idx_client_dnc_phone ON client_dnc_list(client_id, phone);

-- National DNCL scrub runs — store loaded numbers + last scrub timestamp
CREATE TABLE dncl_numbers (
  phone        text PRIMARY KEY,                 -- E.164 normalized
  loaded_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE dncl_scrub_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by     uuid REFERENCES auth.users(id),
  uploaded_at     timestamptz NOT NULL DEFAULT now(),
  source          text NOT NULL DEFAULT 'manual_csv',  -- future: 'cron_download'
  numbers_loaded  int NOT NULL,
  numbers_added   int NOT NULL,
  numbers_removed int NOT NULL,
  notes           text
);
```

**DNCL scrub flow:** Hasan downloads monthly CSV from `lnnte-dncl.gc.ca` (login-gated, no API), uploads via `/api/dashboard/outbound/compliance/dncl`. Server normalizes phones, computes diff vs current `dncl_numbers`, writes new rows + removes stale ones, inserts `dncl_scrub_runs` audit row. `dial-out` checks `EXISTS (SELECT 1 FROM dncl_numbers WHERE phone=$1)` per call (sub-ms with PRIMARY KEY).

### 3.4 `client_contacts` column additions

```sql
ALTER TABLE client_contacts
  ADD COLUMN IF NOT EXISTS dnc                  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dnc_reason           text,
  ADD COLUMN IF NOT EXISTS dnc_added_at         timestamptz,
  ADD COLUMN IF NOT EXISTS consent_source       text,            -- 'open_house' | 'web_inquiry' | 'referral' | 'purchased_list' | 'manual'
  ADD COLUMN IF NOT EXISTS consent_date         date,            -- when consent obtained
  ADD COLUMN IF NOT EXISTS ebr_basis            text,            -- 'inquiry_6mo' | 'transaction_18mo' | 'none'
  ADD COLUMN IF NOT EXISTS ebr_expires_at       date,
  ADD COLUMN IF NOT EXISTS status               text NOT NULL DEFAULT 'active'
                                                  CHECK (status IN ('active','attempted','exhausted','converted','dnc')),
  ADD COLUMN IF NOT EXISTS scheduled_callback_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_outbound_at     timestamptz,
  ADD COLUMN IF NOT EXISTS imported_run_id      uuid;            -- references contact_imports(id)

-- The phone uniqueness gap (CRITICAL — bulk import will dupe without this):
ALTER TABLE client_contacts
  ADD CONSTRAINT client_contacts_client_phone_unique UNIQUE (client_id, phone);
```

**`contact_imports` audit table:**
```sql
CREATE TABLE contact_imports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  imported_by     uuid REFERENCES auth.users(id),
  source_format   text NOT NULL,                    -- 'vcard' | 'csv'
  source_filename text,
  records_total   int NOT NULL,
  records_added   int NOT NULL,
  records_updated int NOT NULL,
  records_skipped int NOT NULL,
  records_invalid int NOT NULL,
  invalid_log     jsonb,                            -- [{ row: 5, reason: 'invalid_phone' }, ...]
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

### 3.5 Migration off `campaign_leads` (8 files affected)

**Phase A — additive (no breaking changes):**
1. Add new columns to `client_contacts` + new tables.
2. Backfill: copy `campaign_leads` rows into `client_contacts` (`source = 'legacy_campaign_leads'`), dedupe by `(client_id, phone)` — keep newer `last_called_at`, merge notes.
3. Map: `campaign_leads.status` → `client_contacts.status`, `disposition` → `last_outcome`, `scheduled_callback_at` → `scheduled_callback_at`, `call_count` → `call_count`.

**Phase B — flip read paths behind a feature flag (`OUTBOUND_V2_ENABLED`):**
- `/dashboard/leads/page.tsx` reads from `client_contacts` filtered by `status IN ('active','attempted')`.
- `/api/dashboard/leads/dial-out` becomes a thin shim → calls new `outbound-dispatcher.ts` with default-campaign.
- `cron/scheduled-callbacks` reads `client_contacts.scheduled_callback_at` instead of `campaign_leads.scheduled_callback_at`.

**Phase C — kill (after 30-day quiet period + zero `campaign_leads` writes detected):**
- Drop `campaign_leads` table.
- Remove `LeadQueue` component (replaced by new `CampaignContactsTable`).
- Remove `OutboundAgentConfigCard` from `AgentTab.tsx:691-696` AND `/dashboard/leads/page.tsx` (replaced by `/dashboard/outbound/campaigns/[id]` editor).
- Remove `clients.outbound_prompt`, `outbound_goal`, `outbound_opening`, `outbound_vm_script`, `outbound_tone`, `outbound_notes` columns (replaced by `outbound_campaigns` per-row fields). Backfill last-known values into a default-campaign per client first.

### 3.6 `clients` column additions (compliance + telephony)

```sql
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS attestation_level    char(1) DEFAULT 'B'
                                                  CHECK (attestation_level IN ('A','B','C')),
  ADD COLUMN IF NOT EXISTS attestation_set_at   timestamptz,
  ADD COLUMN IF NOT EXISTS attestation_set_by   uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS outbound_enabled     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS outbound_minutes_used int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS licensee_name        text,
  ADD COLUMN IF NOT EXISTS licensee_number      text,
  ADD COLUMN IF NOT EXISTS licensee_brokerage   text;
```

### 3.7 Plan entitlement additions (`src/lib/plan-entitlements.ts`)

```ts
interface PlanEntitlements {
  // ...existing fields...
  outboundEnabled: boolean
  contactsMax: number
  outboundCampaignsMax: number
  outboundMinutesMonthly: number
}

LITE:  { outboundEnabled: false, contactsMax:   250, outboundCampaignsMax: 0, outboundMinutesMonthly:    0 }
CORE:  { outboundEnabled: true,  contactsMax:  2500, outboundCampaignsMax: 5, outboundMinutesMonthly:  200 }
PRO:   { outboundEnabled: true,  contactsMax: 25000, outboundCampaignsMax: 50,outboundMinutesMonthly: 1000 }
TRIAL: { outboundEnabled: false, contactsMax:    50, outboundCampaignsMax: 0, outboundMinutesMonthly:    0 }
```

Outbound is **gated behind `outboundEnabled`** at three points: `outbound_campaigns.insert`, `dispatcher` (per-call check), UI surface (hide CampaignsTab if disabled).

---

## 4. Execution Trace

### 4.1 Bulk Import (vCard + CSV)

**Trigger:** Operator uploads `.vcf` or `.csv` via `<input type="file">` on `/dashboard/outbound/contacts`.

**Route:** `POST /api/dashboard/outbound/contacts/import` (NEW)

**Pipeline:**
1. Auth: `client_users` lookup → `clientId`.
2. Plan gate: count existing `client_contacts WHERE client_id=$1`. If `count + uploaded > entitlements.contactsMax` → 402 with `{ error: 'plan_limit', current, max }`.
3. Parse:
   - `.vcf` → use `vcf` npm package (vCard 3.0+4.0). For multi-phone records, prefer `TYPE=CELL` then `TYPE=HOME` then first `TEL`.
   - `.csv` → Papa Parse. Column auto-detect: `phone`/`mobile`/`cell`/`number`, `name`/`first_name`+`last_name`, `email`, `notes`, `tags` (semicolon-split).
4. Per row:
   - Normalize phone via `normalizePhoneNA()` (existing). NA-only — non-NA → mark invalid.
   - Validate phone non-empty.
   - **Reject Quebec area codes server-side** (per Quebec deferral).
5. Upsert into `client_contacts` ON CONFLICT (`client_id`, `phone`):
   - Insert: full row, `source='vcard_import'` or `'csv_import'`, `imported_run_id=$run`.
   - Update: merge tags array (union), append notes (don't overwrite), don't touch `is_vip` / `dnc` / `consent_source`.
6. Insert `contact_imports` audit row with counts.
7. Return `{ imported: 200, updated: 15, skipped: 3, invalid: 2, invalid_log: [...] }`.

**Failure surfaces:**
- File >5MB → reject upfront with `413 payload_too_large`. Phase 2: streaming parse + background job.
- Malformed vCard → catch per-record, add to `invalid_log`, continue. Don't fail the whole import.
- Plan limit hit mid-import → DB constraint catches; we pre-check at step 2 to surface cleanly.

**State changes:** `client_contacts` rows inserted/updated, `contact_imports` row inserted. No agent sync, no Ultravox call, no Twilio touch.

### 4.2 Campaign Create + AI Compiler Script Generation

**Trigger:** Operator clicks "New Campaign" on `/dashboard/outbound/campaigns`.

**Sub-trigger:** Operator pastes unstructured text ("We're calling open-house signups from last weekend at 1230 Maple Ave, qualifying serious buyers, booking a 15-min sit-down…") and clicks "Compile."

**Route:** `POST /api/dashboard/outbound/campaigns/compile` (NEW)

**Pipeline:**
1. Auth + plan gate (`outboundEnabled`).
2. Body: `{ raw_text, persona, intermediary_brand?, niche, contact_filter }`.
3. Call Haiku (`claude-haiku-4-5-20251001`) with extraction prompt:
   - Inputs: raw_text + persona + niche.
   - Outputs JSON: `{ goal, tone, opening, vm_script, prompt, qualifying_questions[], booking_push_after_n_questions, listening_for_keywords[], confidence, requires_review_reasons[] }`.
   - **Persona-specific prompt instructions:**
     - `self`: include `LICENSEE: {{LICENSEE_NAME}}, {{LICENSEE_BROKERAGE}}, License #{{LICENSEE_NUMBER}}` injection at opening.
     - `intermediary`: write opening as third-party assistant ("Hi, this is {{AGENT_NAME}} calling from {{INTERMEDIARY_BRAND}} about your home search…"). NO licensee identification.
   - **Governance** (reuse `BLOCKED_KINDS` + `HIGH_RISK_KINDS` pattern from existing AI Compiler):
     - HIGH_RISK: any pricing claim, "guaranteed sold in X days", market predictions → flag + require manual review checkbox.
     - BLOCKED: language that promises specific market outcomes → reject.
4. Return draft to UI for review.
5. Operator edits inline if needed → clicks "Save campaign as draft" → `POST /api/dashboard/outbound/campaigns` writes row with `status='draft'`.

**Activation:** Separate `PATCH /campaigns/[id]` to set `status='active'` — runs `assertCampaignActivatable()`:
- `clients.attestation_level = 'A'`
- `clients.recording_consent_acknowledged_at IS NOT NULL`
- `prompt NOT NULL`
- If `dncl_scrub_required AND ebr_attested=false`: latest `dncl_scrub_runs.uploaded_at > now() - 31 days`
- If `ebr_attested=true`: `ebr_attested_at NOT NULL` AND `ebr_attested_by NOT NULL`
- Plan gate: `count(active campaigns) < outboundCampaignsMax`

If any fails → 400 with structured `blockers: ['no_attestation', 'dncl_stale']`. UI shows checklist to user.

### 4.3 Outbound Dial Cycle

**Trigger:** Operator clicks "Dial" on a contact in `/dashboard/outbound/campaigns/[id]` (preview-dial), OR "Bulk Dial Eligible" (enqueues to `outbound_attempts` with `eligible_at=now()`).

**Single dispatch entry point:** `src/lib/outbound-dispatcher.ts::dispatchAttempt(attemptId)` (NEW)

This is the **only** path that creates outbound calls. UI routes and cron retry scanner both call into this.

**Pipeline:**
1. Load `outbound_attempts` row + `outbound_campaigns` + `client_contacts` + `clients` (single JOIN query).
2. **Compliance gate (sequential — fail fast):**
   - `clients.outbound_enabled = true` (per-tenant kill switch) AND plan `outboundEnabled = true` (class default) → else `outbound_disabled`. Both required: plan gates eligibility, tenant flag is a per-client kill switch admins can toggle without a plan change.
   - `clients.attestation_level = 'A'` → else `attestation_required`.
   - `clients.outbound_minutes_used < entitlements.outboundMinutesMonthly` → else `minutes_exhausted`.
   - Recipient area code IN allowlist (AB: 403/587/780/825, SK: 306/639) — Quebec/non-NA already rejected at import → else `area_code_blocked`.
   - Recipient curfew: compute recipient local time from area code → 9:00–21:30 weekday or 10:00–18:00 weekend → else `outside_curfew` and reschedule `eligible_at` to next-window-open.
   - `EXISTS dncl_numbers WHERE phone = contact.phone` AND `campaign.ebr_attested = false` → else `dncl_listed` and mark `client_contacts.dnc=true`, `dnc_reason='dncl'`.
   - `EXISTS client_dnc_list WHERE client_id AND phone` → else `internal_dnc`.
   - `client_contacts.dnc = false` → else `contact_dnc`.
   - `client_contacts.sms_opted_out = false` (treat SMS opt-out as voice opt-out for safety) → else `contact_opted_out`.
3. **Acquire dispatch lock** for `clients.twilio_number` (table `dispatch_locks(twilio_number, locked_until)` — Postgres advisory lock or short row lock with 90s TTL). If can't acquire → reschedule `eligible_at = now() + 1 minute`, return `{ status: 'lock_busy' }`.
4. Build `templateContext`:
   - `callerContext`: contact name, contact preferences JSON (compact key:value), prior call summary if exists, today's date+time, qualifying questions from campaign.
   - `businessFacts`: standard knowledge summary.
   - `contextData`: campaign `intermediary_brand` if persona=intermediary, else `clients.business_name`.
5. Substitute template vars into `campaign.prompt`: `{{LEAD_NAME}}`, `{{LEAD_PHONE}}`, `{{LEAD_NOTES}}`, `{{INTERMEDIARY_BRAND}}` (if persona=intermediary), `{{AGENT_NAME}}`, `{{LICENSEE_*}}` (if persona=self).
6. `createCall()` (Ultravox):
   - `systemPrompt: resolvedPrompt`
   - `voice: clients.agent_voice_id`
   - `tools: [hangUp, ...clients.tools]` (booking, knowledge, transfer, sms — already plan-gated by `client.tools` build)
   - `firstSpeakerSettings: { user: {} }` (recipient says "Hello?" first — ANSWER QUALITY)
   - `recordingEnabled: true` (skip if Quebec area code — already blocked anyway)
   - `metadata: { source:'outbound', campaign_id, contact_id, attempt_id, client_id }`
   - `callbackUrl: signedUrl(/api/webhook/[slug]/completed)`
7. `twilioClient.calls.create()`:
   - `from: clients.twilio_number`, `to: contact.phone`
   - `statusCallback: signedUrl(/api/webhook/[slug]/outbound-status)`, `statusCallbackEvent: ['initiated','ringing','answered','completed']`
   - `machineDetection`:
     - If `campaign.vm_script` set (we want to drop a recording on machine) → `'DetectMessageEnd'`. Use `/outbound-connect?t=<token>` route which branches on `AnsweredBy` from the connect-time webhook.
     - If no `vm_script` → `'Enable'` for fast hangup on machine.
   - `url: signedUrl(/api/webhook/[slug]/outbound-connect?t=<token>)` — token row in `outbound_connect_tokens` carries `joinUrl`, `vm_script`, `ultravox_call_id`.
8. Update `outbound_attempts`: `dispatched_at=now()`, `ultravox_call_id`, `twilio_call_sid`, `last_status='queued'`.
9. Insert `call_logs` row: `call_status='live'`, `call_direction='outbound'`, link `campaign_id`, `attempt_id`.
10. Return `{ ok: true, attempt_id, ultravox_call_id, twilio_sid }`.

**Failure surfaces (each writes structured outcome on `outbound_attempts.outcome`, releases lock, MAY reschedule):**
- Compliance gate fail → `outcome=<reason>`, `completed_at=now()`. NO retry. NO call.
- `outside_curfew` → reschedule, no outcome.
- `lock_busy` → reschedule +1min, no outcome.
- `createCall` fail → `outcome='ultravox_failed'`, log error, retry per ladder.
- `twilio.calls.create` fail → `outcome='twilio_failed'`, log error, decrement Ultravox call (`POST /v1/calls/{callId}/cancel` if API supports), retry per ladder.

### 4.4 AMD + Voicemail Branch

**Route:** `POST /api/webhook/[slug]/outbound-connect?t=<token>` (EXISTS — extend)

**Twilio sends AnsweredBy on this connect webhook when `MachineDetection` is set.**

**Pipeline:**
1. Validate Twilio signature (existing pattern).
2. Load `outbound_connect_tokens` row by `t`. Verify `expires_at > now()`. Single-use → mark consumed.
3. Read `AnsweredBy` from form body:
   - `human` → return `<Response><Connect><Stream url="${joinUrl}"/></Connect></Response>` (bridge to Ultravox).
   - `machine_end_beep` → return `<Response><Play>${ttsRecordingUrl(vm_script)}</Play></Response>` (or pre-recorded MP3 if Hasan uploaded one). Update `outbound_attempts.outcome='voicemail_left'`.
   - `machine_end_silence` / `machine_end_other` → return `<Response><Hangup/></Response>`. Update `outbound_attempts.outcome='voicemail_no_beep'`.
   - `fax` → `<Hangup/>`. Outcome `fax`.
   - `unknown` → connect to Ultravox anyway (degrade gracefully — agent says "Hello?" and adapts).

**TTS recording:** First MVP iteration uses Twilio `<Say voice="Polly.Joanna">{vm_script}</Say>`. Phase 2: pre-render via Ultravox/ElevenLabs and serve MP3.

### 4.5 Booking on Outbound

**Already works mechanically.** `outbound-dispatcher` passes `client.tools` which already includes `bookAppointment` if `clients.booking_enabled=true`. Booking tool route `/api/calendar/[slug]/book` is direction-agnostic.

**Verify before ship:**
- `buildAgentContext()` for outbound writes `templateContext.businessFacts` containing hours/timezone — confirm the `dispatcher` calls it (per-call-context-contract.md says it should).
- Booking tool calls back to the SAME `clients.calendar_*` tokens — for `intermediary` persona, this means the booking goes to whoever owns the slug (Hasan's calendar for `hasan-sharif`). That's correct for Phase 1.
- Telegram alert fires on `bookAppointment` success (existing path) — extend message to include `[OUTBOUND]` prefix + campaign name.

### 4.6 Disposition + Notification

**Trigger:** Twilio `completed` status callback fires.

**Route:** `POST /api/webhook/[slug]/outbound-status` (NEW — separate from existing `/completed` because this is Twilio status, not Ultravox call ended)

**Pipeline:**
1. Twilio sig validation.
2. Load `outbound_attempts` by `twilio_call_sid` from form body `CallSid`.
3. Update `last_status` from `CallStatus`.
4. If `CallStatus='completed'`:
   - Increment `clients.outbound_minutes_used` by `ceil(CallDuration/60)`.
   - Increment campaign counters: `total_dialed += 1`, `total_connected += 1` if `AnsweredBy IN (null, 'human')`, etc.
   - If outcome NOT yet set by AMD branch → wait for Ultravox `/completed` webhook to set outcome from AI summary classification.
   - Release `dispatch_locks` row.
5. If `CallStatus IN ('busy','no-answer')`:
   - Set `outcome='no_answer'` or `'busy'`.
   - Compute next attempt per retry ladder → insert NEW `outbound_attempts` row with `attempt_n+1`, `eligible_at=<computed>`.
   - Release lock.
6. If `CallStatus='failed'`:
   - Read `ErrorCode`. If 30xxx (carrier reject, often spam-flag) → log + DON'T retry + alert admin (number reputation issue).
   - Else → retry per ladder.
7. Update `client_contacts.last_outbound_at = now()`.

**Ultravox `/completed` extension** (existing route, add branch):
- If `metadata.source='outbound'`: instead of standard call classification, read AI summary. Classify outcome:
  - Booking confirmed in summary → `outcome='booked'`
  - Caller said "remove me" / "don't call" → `outcome='dnc_requested'`, write to `client_dnc_list`, set `client_contacts.dnc=true`
  - Caller engaged + qualified → `outcome='qualified'`
  - Else → `outcome='completed_no_action'`
- Update `outbound_attempts` and `client_contacts.last_outcome`.
- Telegram alert per outcome (booked = high-pri, dnc = info, no-show = low).

### 4.7 Retry Scheduler

**Cron:** `/api/cron/outbound-retry-scan` runs every 5 minutes.

**Pipeline:**
1. SELECT `outbound_attempts WHERE dispatched_at IS NULL AND eligible_at <= now() ORDER BY eligible_at LIMIT 50`.
2. For each: call `dispatcher.dispatchAttempt(id)`.
3. Concurrency: each tenant DID limited to 1 active call by lock. If lock busy, attempt re-eligible in 1 min.

### 4.8 DNCL Monthly Scrub

**Trigger:** Hasan downloads CSV from CRTC portal monthly, uploads via UI on `/dashboard/outbound/compliance`.

**Route:** `POST /api/dashboard/outbound/compliance/dncl` (admin-only)

**Pipeline:**
1. Auth + admin role check.
2. Stream-parse CSV (10M rows possible) — Papa Parse with `step` callback.
3. Stage in temp table `dncl_numbers_staging`.
4. After full load: atomic swap (`BEGIN; DELETE FROM dncl_numbers; INSERT INTO dncl_numbers SELECT FROM staging; COMMIT;`).
5. Insert `dncl_scrub_runs` audit row.
6. Optional: also scan all `client_contacts` and set `dnc=true, dnc_reason='dncl'` for matched phones (helps UI show "this contact is DNCL — won't dial").

**Cron `/api/cron/dncl-scrub`** runs daily — checks staleness. If `now() - max(dncl_scrub_runs.uploaded_at) > 25 days` → Telegram alert "DNCL scrub due in 6 days." If >31 days → block all `dial-out` until refreshed.

---

## 5. Compliance Layer Specifics

| Rule | Where enforced | Failure mode |
|------|----------------|--------------|
| DNCL scrub <31 days | `dispatcher` step 2 + activation gate | Block dial, surface in UI |
| Recipient curfew (9–21:30 wkdy / 10–18 wknd, recipient local) | `dispatcher` step 2 | Reschedule attempt |
| Internal DNC 14-day window | `dispatcher` step 2 | Block dial permanently for that contact |
| AB/SK area-code allowlist | `dispatcher` step 2 + import step 4 | Block dial / mark invalid |
| EBR attestation if no scrub | `outbound_campaigns` activation gate | Block campaign activation |
| RECA/SREC licensee ID (persona=self only) | AI Compiler instruction + `templateContext` | N/A — built into prompt |
| STIR-SHAKEN A-attestation | `clients.attestation_level='A'` activation gate | Block campaign activation |
| Recording consent | `clients.recording_consent_acknowledged_at` activation gate | Block campaign activation |
| Per-call traceback log (CRTC 2026-52, eff 2026-06-25) | `outbound_attempts` retains all metadata 10+ days | Retention cron — never delete <11 days old |

---

## 6. UI Surfaces

### 6.1 New: `/dashboard/outbound` (page)
Tabs: **Contacts** (replaces ContactsView) · **Campaigns** · **Compliance** · **History**.

### 6.2 Modified: `/dashboard/leads`
Add deprecation banner: "Leads page is moving to **Outbound**." Link → `/dashboard/outbound`. Keep functional during Phase B (feature-flag `OUTBOUND_V2_ENABLED`).

### 6.3 Removed: outbound block in `AgentTab.tsx:691-696` (settings)
The duplicate `OutboundAgentConfigCard` render in settings → delete in Phase C. For Phase A/B, add a "MOVED" notice that links to `/dashboard/outbound/campaigns/[default-campaign-id]`.

### 6.4 New: `OutboundComplianceCard`
- DNCL scrub status (last run date, days until next, "Upload CSV" button)
- Attestation level badge + "Start Trust Hub onboarding" link to Twilio docs
- EBR attestation flow per campaign
- Internal DNC list viewer

---

## 7. Plan Gating

Already in §3.7. Enforced at:
- API: every `outbound/*` POST checks `entitlements.outboundEnabled`.
- Dispatcher: re-checks per call (defense in depth).
- UI: hides `OutboundTab` when disabled, shows upgrade CTA.
- Activation: `outbound_campaigns` count check.
- Per-call: `outbound_minutes_used` check.

Trial/LITE = visible-but-locked (per existing pattern), upgrade CTA visible.

---

## 8. Phasing & Cutover

**Phase A (week 1) — additive backend:**
- All migrations (10+ ALTER + CREATE).
- New API routes (no UI). Test via curl.
- `outbound-dispatcher.ts`. Smoke-test with one manual contact.

**Phase B (week 2) — UI + AI Compiler outbound mode:**
- `/dashboard/outbound` page + 4 tabs.
- AI Compiler outbound script-gen route + review UI.
- Compliance card.
- Twilio Trust Hub manual setup for `hasan-sharif` slug.

**Phase C (week 3) — first real campaign:**
- Hasan uploads buyer-lead vCard (open-house signups, EBR-exempt).
- Generates "intermediary" script via AI Compiler.
- Activates campaign.
- Dial 5 contacts manually first → verify booking flow + transcripts.
- Bulk-dial remaining.
- Telegram alerts on booking.

**Phase D (week 4) — cleanup:**
- Migrate `campaign_leads` data → `client_contacts`.
- Flip dial-out shim.
- Delete duplicate `OutboundAgentConfigCard` in settings.
- Drop deprecated `clients.outbound_*` columns.

---

## 9. Test Plan

### 9.1 Unit
- vCard parser: 3.0 single-phone, 4.0 multi-phone, malformed, empty TEL.
- CSV parser: column auto-detect across 5 common formats (Google Contacts, Outlook, generic).
- Phone normalize: NA mobile, NA landline, NA toll-free, intl (reject), ext (strip).
- Curfew calculator: AB/SK area codes, DST transitions (Mar/Nov 2026).
- Retry ladder: ladder transitions for each (no_answer, busy, voicemail, completed) outcome.

### 9.2 Integration
- Bulk import dedup: re-import same vCard → 0 added, N updated.
- Plan limit: import 251 contacts on LITE → 402 with structured error.
- Compliance gate: each fail reason produces correct `outcome` + correct UI message.
- AMD branch: simulate `human`, `machine_end_beep`, `machine_end_silence` via Twilio test webhook → correct TwiML returned.
- Lock contention: 2 simultaneous dispatch calls for same DID → second reschedules.

### 9.3 E2E (manual on Hasan's tenant — non-production area-code)
- Create campaign → compile script → activate → dial own iPhone → answer → qualify → book → verify Telegram alert + calendar event.
- Repeat with iPhone declined (voicemail) → verify VM dropped after beep.
- DNCL scrub: upload sample CSV with own number → activation blocks (or `dnc` flag set on contact).

### 9.4 Pre-ship (per repo rules)
1. Silent-save check — every new field has at least one consumer.
2. Phantom data check — every field changes downstream behavior.
3. Orphan code check — every new component reachable from live nav.
4. Dual pipeline check — N/A (outbound bypasses inbound prompt pipeline; verify no slot/voicemail interference).
5. Rule dilution check — outbound campaign prompts are SEPARATE from `system_prompt`, won't bloat.
6. Test coverage check — at least one E2E test asserting bulk-import → dial → booking.
7. Trial/paid parity check — TRIAL blocks outbound, CORE/PRO allows.

---

## 10. Open Risks Accepted (deferred to Phase 2+)

- **No Quebec support** — `dial-out` rejects QC area codes server-side. Accept lost market.
- **No caller-ID pool** — single Twilio number per tenant. At >30 dials/hr, retries queue. Accept until volume requires.
- **No predictive/power dialer** — preview dial only. Slower but compliant.
- **No automated DNCL download** — manual monthly CSV upload. Accept until CRTC adds an API.
- **No lead distribution** — single calendar per campaign. Accept until multi-realtor model is product-validated.
- **RECA s.42 in `intermediary` mode** — Hasan's licensee risk. Accepted per his decision (defensible: not agent-of-record on the deal).
- **No A/B testing of scripts** — one script per campaign. Accept until volume justifies.
- **TTS voicemail via `<Say>` not pre-rendered MP3** — quality is decent but not premium. Accept for MVP.

---

## 11. Prerequisites Hasan must complete before activation

1. **Twilio Trust Hub registration for `hasan-sharif` Twilio number** — multi-day process. Start now. Set `clients.attestation_level='A'` after approval.
2. **DNCL subscription at lnnte-dncl.gc.ca** — login + monthly CSV download access. Confirm cost tier (free under 10K/yr).
3. **Confirm lead source for first campaign** — open-house signups (EBR-exempt) vs cold list (DNCL scrub mandatory). Determines `ebr_attested` vs `dncl_scrub_required`.
4. **Verify Google Calendar wired on `hasan-sharif` slug** — `clients.calendar_auth_status='connected'`. Required for `bookAppointment` tool to fire.
5. **Decide intermediary brand name** — "HomeMatch" / "PropertyPath" / etc. Used in scripts. One field on first campaign.
6. **Set `clients.licensee_*`** even though `intermediary` mode skips injection — needed for any future `self`-mode campaign.
7. **Recording consent acknowledgment** — click the existing UI confirmation if not already done.

---

## 12. Files to be Created / Modified

### NEW (~18 files)
- `supabase/migrations/2026XXXX_outbound_campaigns.sql` (all schema additions + client_contacts column adds + UNIQUE constraint)
- `src/lib/outbound-dispatcher.ts` (single chokepoint)
- `src/lib/outbound-retry.ts` (ladder logic)
- `src/lib/outbound-compliance.ts` (DNCL/curfew/DNC checks)
- `src/lib/timezone-by-area-code.ts` (AB/SK area-code → IANA TZ)
- `src/lib/vcard-parser.ts` + `src/lib/csv-contacts-parser.ts`
- `src/app/api/dashboard/outbound/contacts/import/route.ts`
- `src/app/api/dashboard/outbound/campaigns/route.ts`
- `src/app/api/dashboard/outbound/campaigns/[id]/route.ts`
- `src/app/api/dashboard/outbound/campaigns/compile/route.ts`
- `src/app/api/dashboard/outbound/campaigns/[id]/dial/route.ts`
- `src/app/api/dashboard/outbound/compliance/dncl/route.ts`
- `src/app/api/dashboard/outbound/compliance/attestation/route.ts`
- `src/app/api/webhook/[slug]/outbound-status/route.ts`
- `src/app/api/cron/outbound-retry-scan/route.ts`
- `src/app/api/cron/dncl-scrub/route.ts`
- `src/app/dashboard/outbound/page.tsx` + `layout.tsx`
- `src/components/dashboard/outbound/{ContactsTab,CampaignsTab,ComplianceTab,HistoryTab,CampaignEditor,OutboundComplianceCard}.tsx`

### MODIFIED (~12 files)
- `src/lib/plan-entitlements.ts` (add 4 fields × 4 plans)
- `src/lib/database.types.ts` (regen)
- `src/app/api/webhook/[slug]/outbound-connect/route.ts` (extend AMD branch)
- `src/app/api/webhook/[slug]/completed/route.ts` (outbound metadata branch)
- `src/app/api/dashboard/leads/dial-out/route.ts` (shim → dispatcher; deprecation header)
- `src/app/dashboard/leads/page.tsx` (deprecation banner)
- `src/components/dashboard/settings/AgentTab.tsx` (remove duplicate `OutboundAgentConfigCard`)
- `src/components/dashboard/LeadQueue.tsx` (read from `client_contacts`)
- `src/app/api/cron/scheduled-callbacks/route.ts` (read from `client_contacts`)
- `src/lib/agent-context.ts` (verify outbound `templateContext` parity — likely no change)
- `src/components/dashboard/Nav.tsx` (add Outbound entry, gate by `outboundEnabled`)
- `tests/` (new test files per §9)

### TO DELETE (Phase C/D, after 30-day quiet period)
- `src/app/api/dashboard/leads/*` (replaced)
- `src/components/dashboard/LeadQueue.tsx` (replaced)
- `src/components/dashboard/OutboundAgentConfigCard.tsx` (replaced)
- `clients.outbound_prompt`, `outbound_goal`, `outbound_opening`, `outbound_vm_script`, `outbound_tone`, `outbound_notes` columns
- `campaign_leads` table

---

## 13. Failure Surface Map (the "if it breaks, here's what dies" view)

| Component | Fails how | Blast radius | Recovery |
|-----------|-----------|--------------|----------|
| vCard parser | Malformed file | Single import — bad rows in `invalid_log` | Re-upload after fix |
| AI Compiler outbound mode | Haiku timeout / bad JSON | Single compile request | Operator retries or hand-writes script |
| Dispatch lock | Lock TTL too short | Concurrent calls on same DID → spam-flag | Tune TTL up; alert on >2 simultaneous |
| Compliance gate (DNCL stale) | Cron didn't run / Hasan forgot upload | All outbound calls blocked | Telegram alert at day 25; UI banner |
| Twilio AMD wrong branch | False-positive on human | VM plays over greeting; recipient hangs up | Switch to `Enable` per campaign override |
| `outbound-dispatcher` race | Two cron runs pick same attempt | Same contact called twice | `UNIQUE(campaign_id,contact_id,attempt_n)` constraint catches |
| Trust Hub revoked | Twilio drops attestation | Spam flag returns | Block activation until re-attested |
| Calendar disconnect | OAuth token expired mid-campaign | `bookAppointment` tool fails gracefully | Telegram alert; campaign continues but no bookings |
| Booking tool fires for wrong calendar (`intermediary` mode) | Calendar = campaign owner not actual realtor | Booking lands on Hasan's calendar (correct for Phase 1) | Phase 2 distribution layer fixes |
| `outbound_minutes_used` race | Concurrent calls increment same value | Off-by-N | Use `UPDATE clients SET m = m + $delta` not read-then-write |

---

## 14. What I'm NOT going to do (anti-scope)

- Build any UI for the lead-distribution layer.
- Touch any of the 4 active production prompts (Hasan, Omar, Mark, Alisha) per repo rule.
- Implement Quebec recording consent — area code rejected at import + dispatch.
- Build CNAM / branded calling integration.
- Build a predictive dialer.
- Build per-recipient login/auth (Phase 2 distribution work).
- Touch the existing inbound flow's `client_contacts` lookup — already working; outbound additions are additive.

---

**End of spec.** Awaiting Hasan's review.
