# Provisioning Flow — Phase 6 Reference

> Comprehensive map of the provisioning/activation system for unmissed.ai.
> Covers all three provisioning paths, the shared activation chain, 18 identified failure points, and manual recovery procedures.

---

## Table of Contents

1. [State Machine](#state-machine)
2. [Provisioning Paths](#provisioning-paths)
   - [Path A: Admin-Assisted](#path-a-admin-assisted)
   - [Path B: Self-Serve](#path-b-self-serve-most-common)
   - [Path C: Trial](#path-c-trial)
3. [activateClient() — Shared Activation Chain](#activateclient--shared-activation-chain)
4. [Post-activateClient (Stripe Webhook Only)](#post-activateclient-stripe-webhook-only)
5. [Provisioning Guards (Phase 6)](#provisioning-guards-phase-6)
6. [Failure Points (18 Identified)](#failure-points-18-identified)
7. [Recovery Procedures](#recovery-procedures)
8. [Key File Map](#key-file-map)

---

## State Machine

```
                        +-----------+
                        |  (none)   |  No clients row exists yet
                        +-----+-----+
                              |
                              | generate-prompt / create-public-checkout / provision/trial
                              | (creates clients row with status='setup')
                              v
                        +-----------+
                    +-->|   setup   |<--+
                    |   +-----+-----+   |
                    |         |         |
                    |         | activateClient() succeeds
                    |         |
                    |         v
                    |   +-----------+
                    |   |  active   |<---------- trial_convert
                    |   +-----+-----+            (re-enters via Stripe webhook)
                    |         |
                    |         | customer.subscription.deleted
                    |         v
                    |   +-----------+
                    |   |  paused   |  (agent stops answering calls)
                    |   +-----+-----+
                    |         |
                    |         | (manual re-onboarding only)
                    |         v
                    |   +-----------+
                    +---|  churned  |  (terminal — cannot auto-activate)
                        +-----------+

Subscription substates (clients.subscription_status):
  null → 'trialing' → 'active' → 'past_due' → 'canceled'
                          ^                        |
                          +---- renewal succeeds --+

Grace period: 7 days on invoice.payment_failed → subscription_status='past_due'
```

**Valid state transitions enforced by `provisioning-guards.ts`:**

| From | To | Trigger | Allowed? |
|------|----|---------|----------|
| setup | active | stripe / trial / trial_convert | Yes |
| active | active | trial_convert (trial upgrading) | Yes (if trial_expires_at set, trial_converted=false) |
| active | active | stripe (Stripe retry) | Deferred to idempotency check |
| active | paused | customer.subscription.deleted | Yes (Stripe webhook) |
| paused | active | (any auto-activation) | NO — manual reactivation only |
| churned | active | (any) | NO — re-onboard required |

---

## Provisioning Paths

### Path A: Admin-Assisted

**Route:** `POST /api/dashboard/generate-prompt`
**Auth:** Admin only (client_users.role = 'admin')
**Source:** `agent-app/src/app/api/dashboard/generate-prompt/route.ts`

```
Admin clicks "Generate Prompt" in dashboard
       |
       v
1. Load intake_submissions by intakeId
2. Guard: intake.status !== 'provisioned' (409 if already done)
3. Preserve existing agent_name if client is active (re-gen case)
4. Optional: Sonar Pro enrichment (if enrichWithSonar=true in body)
5. Optional: Website scraping via firecrawl (if website_url present)
6. Fetch client_knowledge_docs by intake_id
7. buildPromptFromIntake(intakeData, websiteContent, knowledgeDocs)
8. validatePrompt(prompt) — rejects if invalid (422)
9. createAgent({ systemPrompt, name }) — Ultravox API call
10. Upsert clients row:
    - Existing slug? UPDATE (system_prompt, ultravox_agent_id, classification_rules)
    - New? INSERT with status='setup'
11. Seed prompt_versions (deactivate old, insert new with is_active=true)
12. Mark intake status='provisioned', client_id=clientId
       |
       v
Returns { clientId, agentId, clientSlug, charCount, warnings }
```

Then admin triggers payment:

**Route:** `POST /api/stripe/create-checkout`
**Auth:** Admin only
**Source:** `agent-app/src/app/api/stripe/create-checkout/route.ts`

```
1. Verify admin auth
2. Load intake + client (guard: client.status !== 'active')
3. Create Stripe checkout session (mode='payment', $25 CAD one-time)
   - metadata: { intake_id, client_id, client_slug }
4. Return { url } — admin sends to client
       |
       v
Client completes payment → Stripe fires checkout.session.completed
       |
       v
Stripe webhook → activateClient() (see below)
```

### Path B: Self-Serve (most common)

**Route:** `POST /api/stripe/create-public-checkout`
**Auth:** None (public, rate-limited: 10/hr/IP)
**Source:** `agent-app/src/app/api/stripe/create-public-checkout/route.ts`

```
Client submits onboarding wizard → frontend POSTs { intakeId, selectedNumber?, tier? }
       |
       v
1. Rate limit check (in-memory Map, 10/hr/IP)
2. Load intake_submissions by intakeId
3. Guard: intake.progress_status !== 'activated' (409 if already done)
4. If selectedNumber: reserve in number_inventory
   - Atomic claim: status='available' OR (status='reserved' AND reserved_at < 30min ago)
   - 409 if number taken
5. Resolve unique client slug (collision check via loop: slug, slug-2, slug-3...)
6. Find or create Stripe customer by email
7. Check if intake already linked to a client (intake.client_id)
   |
   +-- Existing client? → Use it. Guard: status !== 'active' (409)
   |                       Update stripe_customer_id if present.
   |
   +-- No client? → AUTO-PROVISION:
       a. Optional: website scraping (firecrawl)
       b. Fetch client_knowledge_docs by intake_id
       c. buildPromptFromIntake()
       d. validatePrompt() — 422 on failure
       e. Voice ID resolution: direct picker > gender fallback > niche default
       f. createAgent() — Ultravox API (agent created HERE, before payment)
       g. INSERT clients row (status='setup')
       h. Seed prompt_versions (version 1)
       i. Mark intake status='provisioned', client_id=clientId
       |
       v
8. Resolve tier price ID (starter/growth/pro from env vars)
9. Create Stripe checkout session (mode='subscription')
   - line_items: [setup fee ($20 inventory / $25 fresh), tier subscription]
   - subscription_data.trial_period_days: 30
   - metadata: { intake_id, client_id, client_slug, reserved_number, tier }
10. Return { url }
       |
       v
Client completes payment → Stripe fires checkout.session.completed
       |
       v
Stripe webhook → activateClient() (see below)
```

### Path C: Trial

**Route:** `POST /api/provision/trial`
**Auth:** None (public, rate-limited: 3/hr/IP, 1 trial/email)
**Source:** `agent-app/src/app/api/provision/trial/route.ts`

```
Client clicks "Start Free Trial"
       |
       v
1. Rate limit check (in-memory Map, 3/hr/IP)
2. Validate: businessName + niche required, email format validated
3. Email uniqueness: intake_submissions query (progress_status != 'abandoned')
4. Insert intake_submissions row (status='pending', progress_status='pending')
5. Insert clients row (status='setup')
6. Link intake to client (UPDATE intake_submissions SET client_id)
7. activateClient({ mode: 'trial', trialDays: 7 }) — DIRECTLY, no Stripe
       |
       v
8. Fire-and-forget: admin Telegram alert
9. Return { success, clientId, trialExpiresAt, setupUrl, telegramLink }
```

**Trial differences:** No Twilio number purchased. No onboarding SMS. `subscription_status='trialing'`. `trial_expires_at` set to 7 days. Dashboard access + WebRTC demo calls only.

---

## activateClient() — Shared Activation Chain

**Source:** `agent-app/src/lib/activate-client.ts`
**Modes:** `stripe` | `trial` | `trial_convert`

All three provisioning paths converge here. Steps execute sequentially with individual try/catch blocks. Non-critical failures are logged but do not abort activation.

```
activateClient(params) {
  |
  v
  FETCH client row for business_name, niche, guard fields
  |
  v
  PHASE 6 GUARDS: runActivationGuards(client, mode)
  - validateActivationMode()
  - checkStateTransition()
  - checkIdempotency()
  If blocked + alreadyActivated → return { success: true } (silent no-op)
  If blocked + not allowed → return { success: false, error }
  |
  v
  Step result tracking initialized (StepResult[])
  |
  v
  FETCH admin Telegram config (hasan-sharif row — hardcoded slug)
  FETCH intake (contact_email, intake_json → area_code, callback_phone, etc.)
  GENERATE telegramRegToken (UUID)
  |
  v
  ┌─── STEP 1: ASSIGN TWILIO NUMBER ──────────────────────────────┐
  │ Skipped entirely for mode='trial'                               │
  │                                                                  │
  │ ┌── Inventory path (reservedNumber present): ──────────────────┐ │
  │ │ 1. Lookup number_inventory by phone_number → get twilio_sid  │ │
  │ │ 2. PATCH Twilio IncomingPhoneNumbers (VoiceUrl, FallbackUrl) │ │
  │ │ 3. Mark number_inventory status='assigned' (ALWAYS, even if  │ │
  │ │    PATCH fails — client paid for it)                          │ │
  │ └──────────────────────────────────────────────────────────────┘ │
  │                                                                  │
  │ ┌── Fresh path (no reservedNumber): ──────────────────────────┐  │
  │ │ 1. Determine country: CA if province in PROVINCE_AREA_CODES │  │
  │ │ 2. Search AvailablePhoneNumbers by area code                 │  │
  │ │ 3. Fallback: any number in same country                      │  │
  │ │ 4. Buy IncomingPhoneNumbers (VoiceUrl, FallbackUrl baked in) │  │
  │ └──────────────────────────────────────────────────────────────┘  │
  │                                                                  │
  │ CRITICAL FAILURE CHECK: hasCriticalFailure(steps, mode)          │
  │ If Twilio failed in non-trial mode → abort, write partial        │
  │ activation_log, return { success: false }                        │
  └──────────────────────────────────────────────────────────────────┘
  |
  v
  ┌─── STEP 2: AUTH USER + WELCOME EMAIL ──────────────────────────┐
  │ Skipped for mode='trial_convert' (user already exists)          │
  │ Skipped if no contact_email on intake                           │
  │                                                                  │
  │ 1. createUser(email, email_confirm=true)                        │
  │    - On failure: listUsers({ perPage: 1000 }) → find by email   │
  │    - Resolved user ID or null                                    │
  │ 2. Upsert client_users (user_id, client_id, role='owner')      │
  │ 3. Update intake with supabase_user_id                          │
  │ 4. Generate recovery link #1 → setupUrl for SMS                 │
  │ 5. Generate recovery link #2 → emailSetupUrl for email body     │
  │ 6. Send welcome email via Resend (branded HTML)                  │
  │    - Fallback: Supabase resetPasswordForEmail (unbranded)        │
  └──────────────────────────────────────────────────────────────────┘
  |
  v
  ┌─── STEP 3: ONBOARDING SMS ────────────────────────────────────┐
  │ Skipped for mode='trial' (no Twilio number)                     │
  │ Skipped if no twilioNumber or no callbackPhone                  │
  │                                                                  │
  │ Send SMS from twilioNumber to callbackPhone:                     │
  │   "Your AI agent is live! Setup: {setupUrl} Number: {number}    │
  │    Telegram: {telegramLink} Reply STOP to opt out."              │
  └──────────────────────────────────────────────────────────────────┘
  |
  v
  ┌─── STEP 4: UPDATE CLIENTS ROW ────────────────────────────────┐
  │ SET status='active', setup_complete=false                       │
  │ SET telegram_registration_token, sms_enabled                    │
  │ SET bonus_minutes (50 for paid, 0 for trial)                    │
  │ SET monthly_minute_limit (from getNicheMinuteLimit)             │
  │ SET contact_email, twilio_number (if purchased)                 │
  │ SET sms_template (if callerAutoTextMessage provided)            │
  │                                                                  │
  │ Trial-specific: subscription_status='trialing',                  │
  │                 trial_expires_at=now+trialDays                   │
  │ Trial-convert:  trial_converted=true, trial_expires_at=null      │
  └──────────────────────────────────────────────────────────────────┘
  |
  v
  ┌─── STEP 5: MARK INTAKE ACTIVATED ─────────────────────────────┐
  │ UPDATE intake_submissions SET progress_status='activated'       │
  └──────────────────────────────────────────────────────────────────┘
  |
  v
  ┌─── STEP 6: LINK KNOWLEDGE DOCS ───────────────────────────────┐
  │ UPDATE client_knowledge_docs SET client_id WHERE intake_id      │
  │ AND client_id IS NULL                                           │
  └──────────────────────────────────────────────────────────────────┘
  |
  v
  ┌─── STEP 7: PERSIST FAQ PAIRS ─────────────────────────────────┐
  │ Parse niche_faq_pairs from intake_json → UPDATE clients.extra_qa│
  └──────────────────────────────────────────────────────────────────┘
  |
  v
  ┌─── STEP 8: TELEGRAM ALERT ────────────────────────────────────┐
  │ Send detailed status message to admin Telegram                  │
  │ Includes: business name, number, Telegram setup link,           │
  │ SMS/email delivery status                                       │
  └──────────────────────────────────────────────────────────────────┘
  |
  v
  ┌─── STEP 9: WRITE ACTIVATION_LOG ──────────────────────────────┐
  │ JSONB audit trail in clients.activation_log:                    │
  │ { activated_at, mode, stripe_session_id, stripe_amount,         │
  │   twilio_number_bought, telegram_link, telegram_token,          │
  │   contact_email, callback_phone, sms_sent, sms_skip_reason,    │
  │   email_sent, email_skip_reason, intake_id, trial_days }        │
  └──────────────────────────────────────────────────────────────────┘
  |
  v
  return { success: true, twilioNumber, telegramLink, setupUrl }
}
```

---

## Post-activateClient (Stripe Webhook Only)

**Source:** `agent-app/src/app/api/webhook/stripe/route.ts` (lines 331-358)

After `activateClient()` returns, the Stripe webhook handler performs two additional steps:

```
1. Override tier-based minute limit
   - Reads session.metadata.tier (starter=100, growth=250, pro=500)
   - UPDATE clients SET monthly_minute_limit (overrides niche default from activateClient)

2. Store subscription info
   - Retrieve Stripe subscription object
   - UPDATE clients SET:
     - stripe_customer_id
     - stripe_subscription_id
     - subscription_status (e.g. 'trialing' for 30-day trial)
     - subscription_current_period_end
```

**Other Stripe webhook event handlers:**

| Event | Action |
|-------|--------|
| `invoice.payment_succeeded` (subscription_cycle) | Reset minutes_used, seconds_used. Set subscription_status='active'. Telegram alert. |
| `invoice.payment_failed` | Set subscription_status='past_due', grace_period_end=now+7d. Telegram alert. |
| `customer.subscription.deleted` | Set subscription_status='canceled', status='paused'. Telegram alert. |
| `checkout.session.completed` (type=minute_reload) | Add to bonus_minutes. Telegram alert. |
| `checkout.session.completed` (product=advisor_credits) | RPC add_advisor_credits. Idempotent via stripe_session_id check in ai_transactions. |

---

## Provisioning Guards (Phase 6)

**Source:** `agent-app/src/lib/provisioning-guards.ts`

Pure functions, no side effects, unit-testable. Run at the top of `activateClient()` before any work begins.

**Guard chain (runs in order, first failure blocks):**

| # | Guard | What It Prevents |
|---|-------|-----------------|
| 1 | `validateActivationMode()` | trial_convert without trial_expires_at; trial on already-active client |
| 2 | `checkStateTransition()` | paused/churned clients auto-activating; invalid status values |
| 3 | `checkIdempotency()` | Stripe webhook retries creating duplicate resources when client is already active with activation_log |

**Critical failure detection (`hasCriticalFailure`):**
- Non-trial mode: Twilio step failed AND not skipped → abort
- Any mode: client_update step failed → abort
- On abort: partial `activation_log` written (aborted=true, abort_reason, step summary)

---

## Failure Points (18 Identified)

### CRITICAL — Orphan Resources

| # | Failure | Location | Impact | Detection |
|---|---------|----------|--------|-----------|
| 1 | **Orphan Ultravox agents** | `create-public-checkout` line 230 | Agent created BEFORE Stripe checkout. Abandoned checkout = orphan agent forever. No cleanup cron. | Query Ultravox API for agents with no matching `clients.ultravox_agent_id`. Or: `SELECT ultravox_agent_id FROM clients WHERE status='setup' AND created_at < now() - interval '24h'` |
| 2 | **Orphan clients row** | `create-public-checkout` line 244 | Client row created with `status='setup'`. Abandoned checkout = zombie row. No cleanup. | `SELECT * FROM clients WHERE status='setup' AND created_at < now() - interval '24h'` |
| 3 | **Fresh Twilio number with no rollback** | `activate-client.ts` line 241 | If activation fails AFTER buying a $1.15/mo number, it stays purchased and unassigned. Phase 6 guards now abort early on Twilio failure, but the purchased number itself is not released. | `SELECT * FROM clients WHERE twilio_number IS NOT NULL AND status != 'active'` |
| 4 | **Orphan number reservation** | `create-public-checkout` line 101 | 30-min expiry via filter, no cron. Actually self-healing: next checkout's `.or()` filter reclaims expired reservations. | Low risk. Check: `SELECT * FROM number_inventory WHERE status='reserved' AND reserved_at < now() - interval '1h'` |

### CRITICAL — Idempotency

| # | Failure | Location | Impact | Detection |
|---|---------|----------|--------|-----------|
| 5 | **activateClient() idempotency (PARTIALLY FIXED)** | `activate-client.ts` line 65 | Phase 6 added `runActivationGuards()` — catches most Stripe retries when `status='active' AND activation_log IS NOT NULL`. Gap: if activation fails BETWEEN setting status='active' (step 4) and writing activation_log (step 9), the guard sees active+no log and allows a retry. | Check for clients with `status='active'` but `activation_log IS NULL` |
| 6 | **Stripe webhook returns 200 on activateClient failure** | `webhook/stripe/route.ts` line 327-329 | Stripe webhook logs the error but returns 200. Stripe won't retry. Activation is incomplete with no automatic recovery. | Search Railway logs for `activateClient failed`. Cross-ref with `SELECT * FROM clients WHERE status='setup' AND stripe_customer_id IS NOT NULL` |
| 7 | **create-public-checkout doesn't check existing Ultravox agent** | `create-public-checkout` line 230 | Called twice for same intake (e.g., browser refresh before redirect) = 2 Ultravox agents created. Only the second one is stored in `clients.ultravox_agent_id`. | Compare Ultravox agent count with clients row count. Check: intake rows where `status='provisioned'` but user never completed checkout. |

### HIGH — Error Handling

| # | Failure | Location | Impact | Detection |
|---|---------|----------|--------|-----------|
| 8 | **activateClient() always returns success (PARTIALLY FIXED)** | `activate-client.ts` line 268-287 | Phase 6 added `hasCriticalFailure()` — now returns `{ success: false }` on Twilio failure. BUT: non-critical steps (auth, email, SMS, FAQ) still silently succeed, and caller can't distinguish partial from full success. | Check `activation_log` for `email_sent: false` or `sms_sent: false` on active clients. |
| 9 | **Twilio number marked assigned even if PATCH fails** | `activate-client.ts` line 159-169 | In the inventory path, `number_inventory.status` is set to 'assigned' regardless of whether the Twilio PATCH (VoiceUrl/FallbackUrl) succeeded. Client has a number in DB that may not route calls. | Call the Twilio number and see if it rings through. Or: check Railway logs for `Twilio PATCH failed`. |
| 10 | **listUsers({ perPage: 1000 })** | `activate-client.ts` line 305 | Linear scan of ALL Supabase auth users to find one by email. Works fine now (<50 users). Will degrade at scale. | Monitor: when auth user count exceeds 500, refactor to use Supabase admin getUserByEmail or similar. |

### MEDIUM — State Machine

| # | Failure | Location | Impact | Detection |
|---|---------|----------|--------|-----------|
| 11 | **No "activating" intermediate state** | `activate-client.ts` | Between `checkout.session.completed` arriving and `activateClient()` completing, `clients.status='setup'`. If two webhooks arrive concurrently, both pass the guard (setup→active allowed). Phase 6 idempotency guard mitigates MOST cases but not the exact race window. | Extremely rare in practice (Stripe sends one webhook per event). Monitor via duplicate `activation_log.activated_at` timestamps. |
| 12 | **clients.status transitions are unconstrained at DB level** | Supabase clients table | No CHECK constraint or trigger enforcing `setup→active→paused→churned`. Any UPDATE can set any status. Guards exist in application code (`provisioning-guards.ts`) but only for `activateClient()`. | Add Supabase trigger or CHECK constraint in future hardening phase. |
| 13 | **intake progress_status can regress** | Supabase intake_submissions table | No guard against `activated→pending`. Any raw UPDATE can revert status. | Low risk — only `activateClient` writes this, and only forward. |

### MEDIUM — Duplicate Logic

| # | Failure | Location | Impact | Detection |
|---|---------|----------|--------|-----------|
| 14 | **Three prompt+agent creation paths** | `generate-prompt`, `create-public-checkout`, `test-activate` | All independently call `buildPromptFromIntake` + `createAgent`. Drift risk if one path is updated but not the others. | Code review: grep for `createAgent(` and ensure all call sites pass consistent parameters. |
| 15 | **Duplicate slugify()** | `create-public-checkout` line 61, `intake-transform.ts` | Two independent implementations of the same slug function. If one changes, slugs may diverge. | Low impact — both are simple `toLowerCase().replace()`. Consolidate to single export. |

### LOW — Operational

| # | Failure | Location | Impact | Detection |
|---|---------|----------|--------|-----------|
| 16 | **In-memory rate limiting** | `create-public-checkout` line 38, `provision/trial` line 15 | `Map<string, number[]>` resets on every Railway deploy. Effectively no rate limit during deploy cycles. | Acceptable for now. Future: Redis or Supabase-backed rate limiter. |
| 17 | **No cleanup cron** | N/A | Orphan agents, zombie `setup` rows, expired reservations accumulate. Number reservation self-heals, but agents and rows do not. | Run recovery queries (see Recovery Procedures) monthly. |
| 18 | **Recovery link generated twice** | `activate-client.ts` lines 336 and 358 | Two separate `generateLink('recovery')` calls — one for SMS setupUrl, one for email body. Both consume a Supabase auth token. Tokens may expire independently. | Low impact — both links work. Consolidate to one `generateLink` call in future cleanup. |

---

## Recovery Procedures

### 1. Abandoned Checkout (Orphan Agent + Clients Row)

**Symptoms:** Client started checkout but never paid. Ultravox agent exists but `clients.status='setup'` indefinitely.

**Detection:**
```sql
-- Find orphan setup clients older than 24 hours
SELECT id, slug, business_name, ultravox_agent_id, created_at
FROM clients
WHERE status = 'setup'
  AND created_at < now() - interval '24h'
  AND stripe_subscription_id IS NULL;
```

**Recovery:**
```bash
# 1. Delete orphan Ultravox agent
curl -X DELETE "https://api.ultravox.ai/api/agents/{AGENT_ID}" \
  -H "X-API-Key: $ULTRAVOX_API_KEY"

# 2. Delete orphan clients row (cascade-safe: no call_logs reference setup clients)
```
```sql
-- Delete client_users links first (if any)
DELETE FROM client_users WHERE client_id = '{CLIENT_ID}';

-- Delete prompt_versions
DELETE FROM prompt_versions WHERE client_id = '{CLIENT_ID}';

-- Reset intake link
UPDATE intake_submissions SET client_id = NULL, status = 'pending'
WHERE client_id = '{CLIENT_ID}';

-- Release any reserved numbers
UPDATE number_inventory SET status = 'available', reserved_intake_id = NULL, reserved_at = NULL
WHERE assigned_client_id = '{CLIENT_ID}' OR reserved_intake_id IN (
  SELECT id FROM intake_submissions WHERE client_id = '{CLIENT_ID}'
);

-- Delete the orphan client
DELETE FROM clients WHERE id = '{CLIENT_ID}';
```

**Verify:** `SELECT * FROM clients WHERE id = '{CLIENT_ID}'` returns 0 rows. Ultravox dashboard shows agent deleted.

---

### 2. Twilio Number Purchased But Activation Failed

**Symptoms:** Client has a Twilio number in `clients.twilio_number` but `status != 'active'`. Calls to the number may or may not route correctly.

**Detection:**
```sql
SELECT id, slug, twilio_number, status, activation_log
FROM clients
WHERE twilio_number IS NOT NULL
  AND status != 'active';
```

**Recovery — Option A: Complete activation manually**
```sql
-- Check what steps succeeded in activation_log
SELECT activation_log FROM clients WHERE slug = '{SLUG}';

-- If activation_log.aborted = true, fix the root cause (usually Twilio PATCH failure)
-- then re-run activation:
-- POST /api/webhook/stripe with a manually constructed event body
-- OR: directly update the client to active state:

UPDATE clients SET
  status = 'active',
  setup_complete = false,
  updated_at = now()
WHERE slug = '{SLUG}';

UPDATE intake_submissions SET progress_status = 'activated'
WHERE client_id = (SELECT id FROM clients WHERE slug = '{SLUG}');
```

**Recovery — Option B: Release the number**
```bash
# Get the Twilio SID for the number
curl "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/IncomingPhoneNumbers.json?PhoneNumber={NUMBER}" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN"

# Release (delete) the number from Twilio
curl -X DELETE "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/IncomingPhoneNumbers/{SID}.json" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN"
```
```sql
-- Clear number from client row
UPDATE clients SET twilio_number = NULL WHERE slug = '{SLUG}';

-- If from inventory, reset
UPDATE number_inventory SET status = 'available', assigned_client_id = NULL
WHERE phone_number = '{NUMBER}';
```

**Verify:** Call the Twilio number — should get standard Twilio "not in service" message (released) or route to agent (fixed).

---

### 3. Auth User Exists But client_users Not Linked

**Symptoms:** Client has a Supabase auth account (can receive password reset emails) but no `client_users` row — they log in and see an empty dashboard or get 403.

**Detection:**
```sql
-- Find clients with contact_email but no client_users link
SELECT c.id, c.slug, c.contact_email
FROM clients c
LEFT JOIN client_users cu ON cu.client_id = c.id
WHERE c.contact_email IS NOT NULL
  AND c.status = 'active'
  AND cu.id IS NULL;
```

**Recovery:**
```sql
-- Find the auth user ID (check Supabase Auth dashboard, or):
-- In Supabase SQL editor:
SELECT id, email FROM auth.users WHERE email = '{CONTACT_EMAIL}';

-- Link them
INSERT INTO client_users (user_id, client_id, role)
VALUES ('{AUTH_USER_ID}', '{CLIENT_ID}', 'owner')
ON CONFLICT (user_id, client_id) DO NOTHING;
```

**Verify:** Client logs in at `/login` and sees their dashboard with agent data.

---

### 4. SMS Not Sent But Activation Succeeded

**Symptoms:** Client is active but never received the onboarding SMS with their setup link and Telegram registration link.

**Detection:**
```sql
SELECT slug, business_name, activation_log->>'sms_sent' AS sms_sent,
       activation_log->>'sms_skip_reason' AS skip_reason,
       twilio_number,
       activation_log->>'callback_phone' AS callback_phone,
       activation_log->>'telegram_link' AS telegram_link
FROM clients
WHERE status = 'active'
  AND (activation_log->>'sms_sent')::boolean = false;
```

**Recovery:**
```bash
# Manually send the onboarding SMS
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  --data-urlencode "From={TWILIO_NUMBER}" \
  --data-urlencode "To={CALLBACK_PHONE}" \
  --data-urlencode "Body=Your AI agent is live!

Set up your dashboard:
https://unmissed-ai-production.up.railway.app/login

Your AI number: {TWILIO_NUMBER}

Connect Telegram for instant call alerts:
{TELEGRAM_LINK}

Reply STOP to opt out."
```

**Verify:** Ask client to confirm SMS received. Check Twilio dashboard for message delivery status.

---

### 5. Number Assigned But Webhooks Not Configured

**Symptoms:** Calls to the Twilio number do not reach the agent. Twilio returns a default message or error. The number exists in `clients.twilio_number` and `number_inventory.status='assigned'`.

**Detection:**
```bash
# Check current webhook configuration on Twilio
curl "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/IncomingPhoneNumbers.json?PhoneNumber={NUMBER}" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" | jq '.incoming_phone_numbers[0] | {voice_url, voice_fallback_url}'
```

Expected output:
```json
{
  "voice_url": "https://unmissed-ai-production.up.railway.app/api/webhook/{SLUG}/inbound",
  "voice_fallback_url": "https://unmissed-ai-production.up.railway.app/api/webhook/{SLUG}/fallback"
}
```

**Recovery:**
```bash
# Get the Twilio SID
SID=$(curl -s "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/IncomingPhoneNumbers.json?PhoneNumber={NUMBER}" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" | jq -r '.incoming_phone_numbers[0].sid')

# PATCH the webhooks
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/IncomingPhoneNumbers/$SID.json" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  --data-urlencode "VoiceUrl=https://unmissed-ai-production.up.railway.app/api/webhook/{SLUG}/inbound" \
  --data-urlencode "VoiceMethod=POST" \
  --data-urlencode "VoiceFallbackUrl=https://unmissed-ai-production.up.railway.app/api/webhook/{SLUG}/fallback" \
  --data-urlencode "VoiceFallbackMethod=POST"
```

**Verify:** Call the number. Should connect to the AI agent. Check Railway logs for `[inbound]` log lines.

---

### 6. Subscription Stored But Minute Limit Not Set

**Symptoms:** Client is active with a valid Stripe subscription, but `monthly_minute_limit` is set to the niche default instead of their tier limit (e.g., 100 for starter but has growth subscription).

**Detection:**
```sql
SELECT c.slug, c.monthly_minute_limit, c.stripe_subscription_id
FROM clients c
WHERE c.status = 'active'
  AND c.stripe_subscription_id IS NOT NULL;

-- Cross-reference with Stripe: retrieve subscription → check metadata.tier
```

**Recovery:**
```sql
-- Set the correct tier limit
-- starter=100, growth=250, pro=500
UPDATE clients SET monthly_minute_limit = {CORRECT_LIMIT}
WHERE slug = '{SLUG}';
```

**Verify:**
```sql
SELECT slug, monthly_minute_limit, minutes_used_this_month FROM clients WHERE slug = '{SLUG}';
```

---

### 7. Batch Cleanup (Monthly Maintenance)

Run these queries on the 1st of each month (or as part of `/intelligence-update`):

```sql
-- Orphan setup clients (older than 48h, no subscription)
SELECT id, slug, ultravox_agent_id, created_at
FROM clients
WHERE status = 'setup'
  AND created_at < now() - interval '48h'
  AND stripe_subscription_id IS NULL
  AND stripe_customer_id IS NULL;

-- Expired number reservations (should self-heal, but verify)
SELECT * FROM number_inventory
WHERE status = 'reserved'
  AND reserved_at < now() - interval '1h';

-- Clients with activation failures (activation_log.aborted=true)
SELECT slug, activation_log
FROM clients
WHERE (activation_log->>'aborted')::boolean = true;

-- Active clients missing activation_log (idempotency gap)
SELECT slug, status, created_at
FROM clients
WHERE status = 'active'
  AND activation_log IS NULL
  AND slug NOT IN ('hasan-sharif', 'windshield-hub', 'urban-vibe');
-- Note: legacy clients (pre-Phase 6) may not have activation_log — that's expected.
```

---

## Key File Map

| File | Role |
|------|------|
| `agent-app/src/app/api/dashboard/generate-prompt/route.ts` | Path A: Admin prompt generation + Ultravox agent creation |
| `agent-app/src/app/api/stripe/create-checkout/route.ts` | Path A: Admin creates Stripe payment session |
| `agent-app/src/app/api/stripe/create-public-checkout/route.ts` | Path B: Self-serve auto-provision + Stripe checkout |
| `agent-app/src/app/api/provision/trial/route.ts` | Path C: Trial provisioning (no Stripe) |
| `agent-app/src/app/api/webhook/stripe/route.ts` | Stripe webhook: activation trigger + subscription lifecycle |
| `agent-app/src/lib/activate-client.ts` | Shared activation chain (all paths converge here) |
| `agent-app/src/lib/provisioning-guards.ts` | Phase 6: Idempotency + state transition guards (pure functions) |
| `agent-app/src/lib/prompt-builder.ts` | Prompt generation from intake data |
| `agent-app/src/lib/ultravox.ts` | Ultravox API wrapper (createAgent, updateAgent) |
| `agent-app/src/lib/niche-config.ts` | Per-niche voice IDs, minute limits |
| `agent-app/src/lib/intake-transform.ts` | Intake data normalization + slugify |
| `agent-app/src/lib/phone.ts` | PROVINCE_AREA_CODES for Canadian number search |
| `agent-app/src/lib/firecrawl.ts` | Website scraping for prompt enrichment |
| `agent-app/src/lib/sonar-enrichment.ts` | Perplexity Sonar Pro business enrichment |
