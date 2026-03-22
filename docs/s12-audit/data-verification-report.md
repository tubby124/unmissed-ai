# S12 Audit: Data Verification Report (Tracks B + C + F)

**Date:** 2026-03-21
**Supabase project:** qwhvblomlgeapzhnuwlb (unmissed-ai)
**Scope:** Settings-to-live sync, integration health, call flow, billing

---

## 1. Sync Matrix (Track B) — Supabase vs Ultravox

### B1 — hasan-sharif

| Field | Supabase | Ultravox | Match? |
|-------|----------|----------|--------|
| Voice ID | `87edb04c` | `87edb04c` | PASS |
| Prompt start | "LIVE VOICE PHONE CALL..." | "LIVE VOICE PHONE CALL..." | PASS |
| Tool count (DB `clients.tools`) | 7 (hangUp + 6 temp) | 7 (hangUp + 6 temp) | PASS |
| Tool names (DB) | hangUp, checkCalendarAvailability, bookAppointment, transferCall, sendTextMessage, queryKnowledge, checkForCoaching | hangUp, bookAppointment, checkCalendarAvailability, checkForCoaching, queryKnowledge, sendTextMessage, transferCall | PASS (order differs, same set) |
| VAD minimumInterruptionDuration | n/a (DB doesn't store) | 0.300s | INFO |
| firstSpeaker delay | n/a | 1s | INFO |
| booking_enabled | true | has bookAppointment + checkCalendarAvailability | PASS |
| sms_enabled | true | has sendTextMessage | PASS |
| forwarding_number | +13068507687 | has transferCall | PASS |
| knowledge_backend | pgvector | has queryKnowledge | PASS |

**Tool parity detail:** DB tools for hasan-sharif are MISSING `X-Call-State` automaticParameters on calendar (slots/book), SMS, and knowledge tools. The Ultravox deployed agent HAS `X-Call-State` on all tools. This means `clients.tools` (written by `buildAgentTools()`) and the Ultravox agent state are out of sync for these parameters. The DB tools were written at an earlier point before the `X-Call-State` automatic param was added to all tool builders.

**Severity: WARNING** -- Does not affect runtime (calls use `toolOverrides` from agent config, not `clients.tools`), but indicates `clients.tools` was not re-synced after the S1a `KNOWN_PARAM_CALL_STATE` fix.

### B1 — exp-realty

| Field | Supabase | Ultravox | Match? |
|-------|----------|----------|--------|
| Voice ID | `441ec053` | `441ec053` | PASS |
| Prompt start | "LIVE VOICE PHONE CALL..." | "LIVE VOICE PHONE CALL..." | PASS |
| Tool count | 7 | 7 | PASS |
| Tool names | hangUp, checkCalendarAvailability, bookAppointment, transferCall, sendTextMessage, queryKnowledge, checkForCoaching | Same set | PASS |
| booking_enabled | true | has bookAppointment + checkCalendarAvailability | PASS |
| sms_enabled | true | has sendTextMessage | PASS |
| forwarding_number | +13067163556 | has transferCall | PASS |
| knowledge_backend | pgvector | has queryKnowledge | PASS |

**Same `X-Call-State` parameter gap as hasan-sharif -- exp-realty DB tools DO have `X-Call-State` on all tools.** PASS -- exp-realty tools are fully in sync.

### B1 — windshield-hub

| Field | Supabase | Ultravox | Match? |
|-------|----------|----------|--------|
| Voice ID | `b28f7f08` | `b28f7f08` | PASS |
| Prompt start | "LIVE VOICE PHONE CALL..." | "LIVE VOICE PHONE CALL..." | PASS |
| Tool count | 4 | 4 | PASS |
| Tool names (DB) | hangUp, sendTextMessage, queryKnowledge, checkForCoaching | hangUp, checkForCoaching, queryKnowledge, sendTextMessage | PASS |
| booking_enabled | false | no bookAppointment/checkCalendarAvailability | PASS |
| sms_enabled | true | has sendTextMessage | PASS |
| forwarding_number | null | no transferCall | PASS |
| knowledge_backend | pgvector | has queryKnowledge | PASS |

**Tool parity detail:** DB tools for windshield-hub are MISSING `X-Tool-Secret` staticParameter and `X-Call-State` automaticParameter on sendTextMessage, queryKnowledge, and checkForCoaching. The Ultravox agent has the full parameters. This is a **stale `clients.tools` issue** -- the DB was written before S1a fixes added these parameters to all tools.

**Severity: WARNING** -- Same runtime mitigation as hasan-sharif (calls use agent config tools, not `clients.tools`).

### B1 — urban-vibe (CRITICAL MISMATCH)

| Field | Supabase | Ultravox | Match? |
|-------|----------|----------|--------|
| Voice ID | `df0b14d7` | `df0b14d7` | PASS |
| Prompt start | "LIVE VOICE PHONE CALL..." | "LIVE VOICE PHONE CALL..." | PASS |
| Tool count (DB) | **1** | **4** | **FAIL** |
| Tool names (DB) | **hangUp only** | hangUp, checkForCoaching, queryKnowledge, sendTextMessage | **FAIL** |
| booking_enabled | false | no bookAppointment/checkCalendarAvailability | PASS |
| sms_enabled | **true** | has sendTextMessage | PASS (Ultravox has it, DB missing) |
| forwarding_number | null | no transferCall | PASS |
| knowledge_backend | **pgvector** | has queryKnowledge | PASS (Ultravox has it, DB missing) |

**Root cause:** `clients.tools` for urban-vibe contains ONLY `[{"toolName":"hangUp"}]`. The Ultravox agent correctly has 4 tools (hangUp + checkForCoaching + queryKnowledge + sendTextMessage). This means `clients.tools` was never rebuilt after the client's SMS and knowledge tools were configured, OR it was rebuilt at a time when `buildAgentTools()` failed to include them.

**Impact:** Currently LOW because Ultravox `callTemplate.selectedTools` (the deployed agent) is correct, and calls use those tools. But any future call to `syncClientTools()` or any deploy path that reads `clients.tools` instead of rebuilding from flags would regress urban-vibe to hangUp-only.

**Fix:** Run `syncClientTools(supabase, urban-vibe-client-id)` to rebuild from current flags.

---

## 2. Integration Health (Track C)

### C1 — Twilio Routing

| Phone | Friendly Name | Voice URL | Expected Slug | Match? |
|-------|---------------|-----------|---------------|--------|
| +15877421507 | (587) 742-1507 | .../webhook/hasan-sharif/inbound | hasan-sharif | PASS |
| +16393850876 | (639) 385-0876 | .../webhook/exp-realty/inbound | exp-realty | PASS |
| +15873551834 | (587) 355-1834 | .../webhook/windshield-hub/inbound | windshield-hub | PASS |
| +15873296845 | (587) 329-6845 | .../webhook/urban-vibe/inbound | urban-vibe | PASS |
| +15878014602 | (587) 801-4602 | .../webhook/unmissed-demo/inbound | unmissed-demo | PASS |
| +15753325085 | (575) 332-5085 | .../webhook/true-color-display-printing-ltd/inbound | true-color | PASS |
| +16393077540 | (639) 307-7540 | .../webhook/e2e-test-business/inbound | e2e-test | **WARNING** |
| +16397393885 | True Color | `https://n8n.srv728397.hstgr.cloud/webhook/true-color-inbound` | (legacy n8n) | **WARNING** |

**Issues:**
- **+16393077540** points to slug `e2e-test-business` but the DB test client slug is `e2e-test-plumbing-co`. Calls to this number will 404 (slug mismatch).
- **+16397393885** still points to the RETIRED n8n webhook (Hostinger). This number is unused but paying monthly Twilio fees.

**Number inventory vs Twilio:** The `number_inventory` table has 3 numbers, all status=`available` with no assigned_client_id:
- +16397393885 (the n8n legacy number)
- +15878014602 (unmissed-demo -- actually in use!)
- +16393077540 (e2e-test -- actually in use!)

All 3 show `status=available` and `assigned_client_id=null` despite being actively routed in Twilio. The `number_inventory` table is completely out of sync with reality.

### C2 — Telegram Bot Health

| Bot | Token Prefix | Status | Clients Using |
|-----|-------------|--------|---------------|
| hassistant (@hassitant_1bot) | `8018224669` | ALIVE | hasan-sharif, exp-realty, true-color, e2e-test |
| urbanvibepptmgmt (@urbanvibepptmgmt_bot) | `8656606210` | ALIVE | urban-vibe |
| WinHUBV1 (@WinHubV1bot) | `8576294303` | ALIVE | windshield-hub |

All 3 Telegram bots respond to `getMe`. All 6 configured clients have both `telegram_bot_token` and `telegram_chat_id` set.

**Observation:** hasan-sharif and true-color-display-printing-ltd share the SAME bot token AND the SAME chat_id (7278536150). This means both clients' call notifications go to the same Telegram chat. This is intentional (same owner) but worth documenting.

### C3 — Calendar OAuth Health

| Client | Has Token | Calendar ID | Auth Status |
|--------|-----------|-------------|-------------|
| hasan-sharif | true | hasan.sharif.realtor@gmail.com | connected |
| exp-realty | true | omarsha@gmail.com | connected |

Only 2 of 4 core clients have calendar integration. windshield-hub and urban-vibe have no calendar (consistent with `booking_enabled=false`).

### C4 — SMS Delivery (Last 7 Days)

| Client | Delivered | Received | Undelivered | Opted Out |
|--------|-----------|----------|-------------|-----------|
| hasan-sharif | 14 | 3 | 0 | 1 |
| urban-vibe | 2 | 2 | 0 | 0 |
| windshield-hub | 3 | 1 | **1** | 0 |
| exp-realty | 1 | 0 | 0 | 0 |

- **1 undelivered SMS** for windshield-hub (should investigate)
- **1 SMS opt-out** total in the system (hasan-sharif)
- SMS volume is low across all clients

### C5 — Knowledge/RAG Health

| Client | Approved Chunks | Pending | Rejected |
|--------|----------------|---------|----------|
| windshield-hub | 55 | 0 | 0 |
| urban-vibe | 33 | 0 | 1 |
| hasan-sharif | 27 | 0 | 1 |
| exp-realty | 18 | 0 | 0 |

All 4 pgvector clients have approved chunks. No pending chunks (good -- no unreviewed content). All clients have `queryKnowledge` tool registered in Ultravox (verified in B1).

### C6 — Notification Delivery (Last 7 Days)

| Channel | Status | Count |
|---------|--------|-------|
| telegram | sent | 4 |
| sms_followup | sent | 1 |

- **0 failed notifications** in the last 7 days
- Total notification volume is surprisingly low (5 total) vs 210 calls in the same period
- No email notifications sent in the last 7 days

**Concern:** 210 calls but only 4 Telegram notifications and 1 SMS follow-up seems very low. Either most calls are JUNK (67 of 210 = 32%) and correctly suppressed, or the notification pipeline has gaps for non-JUNK calls.

### C7 — Call Processing Health

**Stuck calls (processing > 5 min):** NONE. No stuck processing rows detected.

**Call status distribution (last 7 days):**

| Status | Count | % |
|--------|-------|---|
| COLD | 96 | 45.7% |
| JUNK | 67 | 31.9% |
| WARM | 24 | 11.4% |
| UNKNOWN | 22 | 10.5% |
| HOT | 1 | 0.5% |

**Per-client breakdown:**

| Client | COLD | JUNK | WARM | UNKNOWN | HOT | Total |
|--------|------|------|------|---------|-----|-------|
| hasan-sharif | 54 | 28 | 9 | 4 | 0 | 95 |
| urban-vibe | 14 | 17 | 7 | 6 | 1 | 45 |
| exp-realty | 5 | 18 | 1 | 7 | 0 | 31 |
| windshield-hub | 12 | 3 | 5 | 5 | 0 | 25 |
| true-color | 9 | 1 | 0 | 0 | 0 | 10 |
| unmissed-demo | 2 | 0 | 2 | 0 | 0 | 4 |

**exp-realty anomaly:** 58% JUNK rate (18 of 31) is significantly higher than other clients. Also 22.6% UNKNOWN (7 of 31). Only 1 WARM and 0 HOT out of 31 calls. This warrants investigation.

**Call service_type distribution (last 7 days):**

| Type | Count |
|------|-------|
| other | 47 |
| spam | 45 |
| appointment | 38 |
| follow_up | 21 |
| quote_request | 15 |
| wrong_number | 11 |
| emergency | 6 |
| complaint | 3 |
| test | 1 |
| (null) | 23 |

### C9 — Recording Storage Health

- **Storage bucket:** `recordings` (created 2026-03-08)
- **Total recordings:** 418 files
- **Total storage:** ~214 MB
- **Date range:** 2026-03-08 to 2026-03-21 (13 days)
- **Average size:** ~512 KB per recording
- **Growth rate:** ~16.5 MB/day (~500 MB/month)

All 5 most recent recordings have valid Supabase storage URLs. No broken or missing recordings detected.

**Projected concern:** At 500 MB/month, storage will reach 6 GB/year with current volume. No retention policy exists (tracked in S11).

---

## 3. Call Flow Health (Track F)

### F2 — Call Forwarding Setup

| Client | Forwarding Number | Niche |
|--------|-------------------|-------|
| hasan-sharif | +13068507687 | real_estate |
| exp-realty | +13067163556 | real_estate |
| unmissed-demo | +13068507687 | other |

hasan-sharif and unmissed-demo share the same forwarding number (+13068507687). This is intentional (Hasan owns both).

### F3 — Recent Call Chain Completeness (Last 10 Calls)

| Client | Status | Service Type | Recording | Notifications | SMS |
|--------|--------|-------------|-----------|---------------|-----|
| urban-vibe | WARM | quote_request | Yes | **2** | 1 |
| urban-vibe | JUNK | other | Yes | 1 | 0 |
| urban-vibe | JUNK | other | Yes | 1 | 0 |
| exp-realty | JUNK | spam | Yes | 1 | 0 |
| windshield-hub | WARM | quote_request | Yes | **0** | 1 |
| hasan-sharif | JUNK | other | Yes | 0 | 0 |
| hasan-sharif | JUNK | other | Yes | 0 | 0 |
| unmissed-demo | COLD | quote_request | Yes | 0 | 0 |
| hasan-sharif | JUNK | other | Yes | 0 | 0 |
| hasan-sharif | JUNK | other | Yes | 0 | 0 |

**Findings:**
- All 10 recent calls have recordings (PASS)
- WARM calls with 0 notifications: windshield-hub WARM quote_request has **no Telegram notification** but has 1 SMS. This may indicate the Telegram notification failed silently or was suppressed.
- JUNK calls for hasan-sharif consistently have 0 notifications and 0 SMS (correct -- JUNK should be suppressed)
- JUNK calls for urban-vibe have 1 notification each (unexpected -- JUNK calls should not generate notifications unless the notification is just the Telegram alert)

### F3b — Bookings Data

- **Total bookings:** 13 (all for hasan-sharif)
- **Google Event ID linked:** 0 of 13 (0%)
- **Call ID linked:** 0 of 13 (0%)
- **All status:** "booked"
- **All created_at:** same timestamp (2026-03-21 16:58:32)

**CRITICAL:** All 13 bookings have `google_event_id = NULL` and `call_id = NULL`. This means:
1. The S2 `book` route enhancement to write `call_id` and `google_event_id` is NOT working in production, OR
2. These bookings were created before S2 was deployed, OR
3. The booking creation path bypasses the enhanced route

All 13 bookings sharing the exact same `created_at` timestamp is suspicious -- looks like a bulk import or migration artifact, not real bookings from calls.

---

## 4. Billing Consistency (Track D4)

| Client | Status | Sub Status | Stripe Customer | Stripe Sub | Seconds Used | Minutes Used (DB) | Computed Minutes | Minute Limit |
|--------|--------|-----------|-----------------|------------|-------------|-------------------|-----------------|-------------|
| hasan-sharif | active | none | null | null | 8362 | 96 | **139.4** | 500 |
| urban-vibe | active | none | null | null | 5026 | 126 | **83.8** | 500 |
| windshield-hub | active | none | null | null | 2262 | 40 | **37.7** | 500 |
| exp-realty | active | none | null | null | 1327 | 31 | **22.1** | 500 |
| true-color | active | none | null | null | 562 | 3 | **9.4** | 500 |
| unmissed-demo | active | none | null | null | 345 | 0 | **5.8** | 500 |
| extreme-fade | active | trialing | null | null | 0 | 0 | 0 | 100 |
| jane | active | trialing | null | null | 0 | 0 | 0 | 100 |
| e2e-test | active | none | null | null | 0 | 0 | 0 | 500 |

### CRITICAL: minutes_used_this_month vs seconds_used_this_month MISMATCH

The `minutes_used_this_month` column does NOT equal `seconds_used_this_month / 60` for ANY active client:

| Client | seconds / 60 | DB minutes | Discrepancy |
|--------|-------------|------------|-------------|
| hasan-sharif | 139.4 | 96 | **-43.4 min** |
| urban-vibe | 83.8 | 126 | **+42.2 min** |
| windshield-hub | 37.7 | 40 | +2.3 min |
| exp-realty | 22.1 | 31 | +8.9 min |
| true-color | 9.4 | 3 | -6.4 min |
| unmissed-demo | 5.8 | 0 | -5.8 min |

These two columns are being incremented by different code paths and have diverged significantly. Urban-vibe shows 126 minutes but only 83.8 minutes of actual seconds. Hasan-sharif shows 96 minutes but 139.4 minutes of seconds.

### CRITICAL: seconds_counted flag is FALSE on ALL recent calls

All calls in the last 24 hours (and the last 7 days) have `seconds_counted = false`. The S9h guard (`seconds_counted`) was implemented to prevent double-counting, but it appears the flag is NEVER being set to `true`. This means either:
1. The `increment_seconds_used` RPC is not being called at all (seconds are being counted some other way), OR
2. The code that sets `seconds_counted = true` after increment is not executing

### CRITICAL: No Stripe billing integration active

ALL clients have `stripe_customer_id = null` and `stripe_subscription_id = null`. `subscription_status` is "none" for all except 2 trial clients. No paying customers exist in the system.

Two trial clients exist:
- `extreme-fade` (salon niche, trialing, 0 usage) -- no ultravox_agent_id, empty system_prompt
- `jane` (real_estate niche, trialing, 0 usage) -- no ultravox_agent_id, empty system_prompt

**Both trial clients have NO agent created** -- this confirms the S12-BUG1 finding that the trial path does not create Ultravox agents.

---

## 5. Issues Found (Ranked by Severity)

### CRITICAL

| # | Issue | Detail | Impact |
|---|-------|--------|--------|
| 1 | **minutes vs seconds counter divergence** | `minutes_used_this_month` and `seconds_used_this_month` are out of sync across ALL clients. Discrepancies range from -43 to +42 minutes. | Billing/overage alerts use wrong data. Clients could be over-counted or under-counted. |
| 2 | **seconds_counted flag never set to true** | All calls have `seconds_counted = false` in the last 7 days (210 calls checked). The S9h idempotent increment guard is not functioning. | If Ultravox retries the completed webhook, seconds will be double-counted. The guard designed to prevent this is inactive. |
| 3 | **urban-vibe clients.tools has only hangUp** | DB stores 1 tool but Ultravox agent has 4. `sms_enabled=true` and `knowledge_backend=pgvector` but clients.tools has none of these. | Any deploy path reading `clients.tools` instead of rebuilding from flags will regress urban-vibe to hangUp-only. |
| 4 | **Trial clients have no agent/prompt** | `extreme-fade` and `jane` are trialing with no `ultravox_agent_id`, no `system_prompt`. S12-BUG1 confirmed live. | Trial users see an empty dashboard, cannot make demo calls, cannot evaluate the product. |
| 5 | **All 13 bookings missing google_event_id and call_id** | Every booking has NULL for both FK fields. All share the same timestamp. | Booking-to-call correlation is broken. /review-call cannot show booking context. |
| 6 | **No Stripe customers exist** | All active clients have null `stripe_customer_id`. No revenue tracking in DB. | Cannot track revenue, cannot enforce plan limits via Stripe. |

### WARNING

| # | Issue | Detail | Impact |
|---|-------|--------|--------|
| 7 | **hasan-sharif + windshield-hub clients.tools stale** | DB tools missing `X-Call-State` and/or `X-Tool-Secret` parameters that the Ultravox agent has. | No runtime impact (calls use agent config), but creates drift if tools are ever read from DB. |
| 8 | **number_inventory fully desynchronized** | 3 numbers in inventory, all `status=available` with `assigned_client_id=null`, but 2 are actively routed in Twilio. | Number provisioning flow will incorrectly treat in-use numbers as available. |
| 9 | **e2e-test Twilio slug mismatch** | Twilio routes +16393077540 to `e2e-test-business` but DB slug is `e2e-test-plumbing-co`. | Test calls to this number will 404. |
| 10 | **exp-realty 58% JUNK rate** | 18 of 31 calls classified as JUNK. Significantly higher than other clients (hasan: 29%, windshield: 12%). | Either spam targeting or over-aggressive classification. |
| 11 | **Notification volume low vs call volume** | 5 notifications for 210 calls (2.4%). Even excluding JUNK (143 non-JUNK calls), only 3.5% notification rate. | Possible notification pipeline gaps for non-JUNK calls. |
| 12 | **1 undelivered SMS for windshield-hub** | 1 SMS with status `undelivered` in the last 7 days. | Potential phone number or carrier issue. |
| 13 | **Legacy n8n Twilio number still active** | +16397393885 still routes to retired n8n webhook on Hostinger. | Paying monthly Twilio fees for unused number with dead webhook. |

### INFO

| # | Issue | Detail |
|---|-------|--------|
| 14 | hasan-sharif + true-color share Telegram bot + chat_id | Same owner, intentional |
| 15 | hasan-sharif + unmissed-demo share forwarding number | Same owner, intentional |
| 16 | Recording storage at 214 MB / 418 files after 13 days | ~500 MB/month growth. No retention policy. |
| 17 | All notification preferences (telegram/email) set to `true` | Default values confirmed, no client has opted out |
| 18 | VAD at 0.300s on all 4 agents | Consistent with S1c decision |

---

## 6. Recommended Actions (Priority Order)

1. **Fix minutes/seconds divergence** -- Determine which counter is authoritative and reconcile. Add RPC or trigger to keep them in sync.
2. **Fix seconds_counted flag** -- Debug why the flag is never set to `true` after increment. Check if `increment_seconds_used` RPC is being called.
3. **Rebuild urban-vibe clients.tools** -- Call `syncClientTools()` for urban-vibe client ID `42a66c19-e4c0-4cd7-a86e-7e7df711043b`.
4. **Rebuild hasan-sharif + windshield-hub clients.tools** -- Same, to pick up `X-Call-State` and `X-Tool-Secret` parameters.
5. **Fix trial provisioning path** -- Port agent/prompt creation from `create-public-checkout` into `provision/trial` (S12-BUG1).
6. **Fix e2e-test Twilio slug** -- Update webhook URL to `e2e-test-plumbing-co` or update DB slug.
7. **Clean up number_inventory** -- Mark assigned numbers as `assigned`, set `assigned_client_id`.
8. **Release or reassign legacy n8n number** -- +16397393885 is dead weight.
9. **Investigate exp-realty JUNK rate** -- Review recent call transcripts to determine if spam or over-classification.
10. **Investigate booking data** -- Determine if the 13 identical-timestamp bookings are real or test data, and why google_event_id is never populated.
