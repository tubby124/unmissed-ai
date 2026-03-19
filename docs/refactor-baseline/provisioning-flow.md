# Provisioning Flow — Phase 6 Reference

**Created:** 2026-03-18 (Phase 6 — Provisioning Hardening)
**Canary:** hasan-sharif | **Locked:** windshield-hub, urban-vibe

---

## Three Activation Paths

### Path A: Admin-Assisted
```
Admin: generate-prompt → create-checkout → Stripe webhook → activateClient(stripe)
```

1. **`POST /api/dashboard/generate-prompt`** (admin-only)
   - Loads intake → optional Sonar enrichment → optional website scrape
   - Fetches knowledge docs → `buildPromptFromIntake()` → `validatePrompt()`
   - `createAgent()` (Ultravox) → upserts `clients` row → seeds `prompt_versions`
   - Marks intake `progress_status = 'provisioned'`
   - **Orphan risk:** Ultravox agent created before payment — abandoned checkouts leave orphan agents

2. **`POST /api/stripe/create-checkout`** (admin-only)
   - Guards: `client.status !== 'active'`
   - Creates Stripe payment session with metadata: `intake_id`, `client_id`, `client_slug`

3. **`POST /api/webhook/stripe`** (Stripe webhook)
   - Signature verified via `stripe.webhooks.constructEvent()`
   - Guards: already active + has subscription → skip
   - Determines mode: `trial_convert` if `trial_expires_at` exists, else `stripe`
   - Calls `activateClient({ mode, intakeId, clientId, clientSlug, reservedNumber, stripeSession })`
   - Post-activation: stores subscription ID, tier minute limit

### Path B: Self-Serve
```
User: create-public-checkout (auto-provisions) → Stripe webhook → activateClient(stripe)
```

1. **`POST /api/stripe/create-public-checkout`** (public, rate-limited)
   - Auto-provisions if admin hasn't: builds prompt, creates Ultravox agent, inserts clients row, seeds prompt_versions
   - **Phase 6:** Cleans up stale number reservations (>30 min) before reserving
   - Reserves inventory number atomically (30-min expiry via OR clause)
   - Creates Stripe subscription session (setup fee + tier recurring)
   - **Orphan risk:** Same as Path A — agent + client row created before payment

2. Same Stripe webhook as Path A step 3

### Path C: Trial
```
User/Admin: provision/trial → activateClient(trial) [no Twilio]
Later: trial-convert → Stripe webhook → activateClient(trial_convert)
```

1. **`POST /api/provision/trial`**
   - Validates input, checks email uniqueness in `intake_submissions`
   - Creates `clients` row with `status = 'setup'`
   - Links intake to client
   - Calls `activateClient({ mode: 'trial' })` — no Twilio number, no SMS

2. **`GET /api/stripe/trial-convert`** (conversion)
   - Validates `trial_expires_at` exists
   - Creates subscription checkout → Stripe webhook → `activateClient(trial_convert)`

---

## activateClient() — Shared Activation Chain

**File:** `agent-app/src/lib/activate-client.ts`

### Pre-Activation Guards (Phase 6)

Before any work, `runActivationGuards()` checks:
1. **Mode validation** — trial_convert requires trial_expires_at, can't trial an active client
2. **State transition** — paused/churned clients cannot be auto-activated
3. **Idempotency** — if status=active + activation_log exists → early return (Stripe retries safe)

### Step Sequence

| # | Step | Critical? | Modes | Failure Behavior |
|---|------|-----------|-------|------------------|
| 1 | Fetch client row + guard fields | Yes | All | Return `success: false` |
| 2 | Run activation guards | Yes | All | Return early (idempotent) or `success: false` |
| 3 | Fetch admin Telegram config | No | All | Silent — alerts skipped |
| 4 | Load intake data | Yes | All | Defaults used, no abort |
| 5 | Twilio: assign inventory number OR buy fresh | **Yes** (non-trial) | stripe, trial_convert | Abort + partial activation_log |
| 6 | Create auth user (or lookup existing) | No | stripe, trial | Logged, continues |
| 7 | Link client_users | No | stripe, trial | Logged, continues |
| 8 | Generate recovery link for setupUrl | No | stripe, trial | Falls back to /login |
| 9 | Send welcome email (Resend or Supabase) | No | stripe, trial | Logged, continues |
| 10 | Send onboarding SMS | No | stripe, trial_convert | Logged, continues |
| 11 | Update clients row (status=active) | **Yes** | All | Logged (TODO: should abort) |
| 12 | Mark intake progress_status=activated | No | All | Logged, continues |
| 13 | Link knowledge docs | No | All | Logged, continues |
| 14 | Persist FAQ pairs | No | All | Logged, continues |
| 15 | Telegram admin alert | No | All | Logged, continues |
| 16 | Write activation_log (includes step summary) | No | All | Logged, continues |

### Step Result Tracking (Phase 6)

Every step records a `StepResult` in the `steps[]` array:
```ts
{ step: 'twilio_purchase', ok: true }
{ step: 'welcome_email', ok: false, error: 'Resend timeout' }
{ step: 'onboarding_sms', ok: false, skipped: true, skipReason: 'trial mode' }
```

`hasCriticalFailure(steps, mode)` triggers early abort on:
- Twilio failure in non-trial mode
- Client row update failure

Step summary is persisted in `clients.activation_log.steps` for admin visibility.

---

## Known Risks and Accepted Tradeoffs

### R1: Orphan Ultravox Agents (Medium)
**Where:** `generate-prompt` and `create-public-checkout` both create agents before payment.
**Impact:** Orphan agents in Ultravox dashboard. No cost (agents are free, only calls cost).
**Mitigation:** Tracked. Future: add periodic cleanup or deferred agent creation.

### R2: Duplicate Provisioning Logic (Medium)
**Where:** `test-activate` (469 lines) duplicates `activateClient` + `generate-prompt`.
**Impact:** Behavior drift between paths over time.
**Mitigation:** Tracked for future consolidation. Phase 6 scope: guard `activateClient` only.

### R3: listUsers({ perPage: 1000 }) Scaling (Low)
**Where:** `activate-client.ts` line 305 — auth user lookup fallback.
**Impact:** Won't scale past ~1000 users. Currently have <20 clients.
**Mitigation:** Replace with targeted email lookup when Supabase supports it, or query `auth.users` table directly.

### R4: In-Memory Rate Limiting (Low)
**Where:** `create-public-checkout` line 38 — Map-based, resets on every Railway deploy.
**Impact:** Rate limit resets on deploy. Currently acceptable for low-traffic service.
**Mitigation:** Move to Redis or Supabase-based rate limiting when traffic grows.

### R5: Twilio Number Assigned Despite PATCH Failure (Accepted)
**Where:** `activate-client.ts` line 159 — marks number as assigned regardless of PATCH result.
**Rationale:** Client paid for it. Better to assign and fix webhook manually than leave number in limbo.
**Recovery:** Admin Telegram alert sent. Fix VoiceUrl manually in Twilio console.

### R6: test-activate Bypasses Guards (Known Gap)
**Where:** `admin/test-activate/route.ts` — has its own activation logic, does not call `activateClient`.
**Impact:** Admin test activation skips idempotency/state guards added in Phase 6.
**Mitigation:** Acceptable for admin-only endpoint. Future: refactor to use `activateClient`.

---

## Recovery Procedures

### Stuck at "setup" (payment received but activation failed)
1. Check `clients.activation_log` for step details
2. If `activation_log.aborted = true`: Twilio was the failure
   - Check Twilio console for number availability
   - Buy number manually → update `clients.twilio_number`
   - Run `test-activate` to complete remaining steps
3. If no `activation_log`: activation never started
   - Check Stripe dashboard for checkout.session.completed event
   - Replay the webhook or call `test-activate`

### Duplicate Activation (Stripe webhook retry)
Phase 6 idempotency guard prevents this. If status=active + activation_log exists, `activateClient` returns early without re-running steps.

### Orphan Ultravox Agent
1. List agents: `curl -H "Authorization: Bearer $ULTRAVOX_API_KEY" https://api.ultravox.ai/api/agents/`
2. Identify orphans (no matching client slug in `clients` table)
3. Delete: `curl -X DELETE -H "Authorization: Bearer $ULTRAVOX_API_KEY" https://api.ultravox.ai/api/agents/{id}`

### Stale Number Reservation
Phase 6 cleanup releases reservations >30 min old on every `create-public-checkout` call.
Manual: `UPDATE number_inventory SET status='available', reserved_intake_id=NULL, reserved_at=NULL WHERE status='reserved' AND reserved_at < NOW() - INTERVAL '30 minutes'`

### Client Paused by Subscription Cancellation
`customer.subscription.deleted` → sets status='paused', subscription_status='canceled'.
To reactivate: update `clients.status = 'active'` manually + ensure subscription is renewed.
Phase 6 guard prevents auto-reactivation of paused clients.

---

## File Reference

| File | Role |
|------|------|
| `src/lib/activate-client.ts` | Shared activation chain (3 modes) |
| `src/lib/provisioning-guards.ts` | Pure guard functions (idempotency, state, mode) |
| `src/app/api/webhook/stripe/route.ts` | Stripe webhook (checkout, renewal, failure, cancellation) |
| `src/app/api/stripe/create-public-checkout/route.ts` | Self-serve checkout + auto-provisioning |
| `src/app/api/stripe/create-checkout/route.ts` | Admin checkout |
| `src/app/api/provision/trial/route.ts` | Trial provisioning |
| `src/app/api/stripe/trial-convert/route.ts` | Trial-to-paid conversion |
| `src/app/api/dashboard/generate-prompt/route.ts` | Admin prompt generation + agent creation |
| `src/app/api/admin/test-activate/route.ts` | Admin test activation (bypasses guards) |
| `src/app/api/admin/numbers/route.ts` | Number inventory management |
| `src/app/api/webhook/inventory-idle/route.ts` | TwiML for unassigned inventory numbers |
| `src/app/api/public/activation-status/route.ts` | Public polling for activation status |
