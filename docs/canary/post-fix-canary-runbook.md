# Post-Fix Canary Runbook — Unmissed.ai Auth Patch

**Purpose:** Verify the self-serve funnel end-to-end immediately after the auth patch lands.
**Owner:** Operator (run manually, one scenario at a time)
**Prereqs:** Three canary identities filled in per `test-identities-template.md`

---

## Scenario 1 — First-Time Email (non-Google) User

### Step order

1. Open `/try` in incognito
2. Complete onboarding form → Submit
3. Observe redirect destination

### Expected route transitions

```
/try
  → POST /api/provision/trial (200)
  → /onboard?status=provisioning (or /onboard/success)
  → user receives set-password email (Supabase magic link)
  → /auth/set-password (user clicks link)
  → user sets password
  → /auth/callback?code=...
  → /dashboard
```

### Expected visible UI state

| Step | Expected UI |
|------|-------------|
| After submit | Spinner / "Setting up your agent..." |
| After email link | Set-password form renders at `/auth/set-password` |
| After password set | Redirect to `/dashboard` |
| Dashboard load | Agent name visible, trial badge present, no Twilio number field |

### Expected DB truth after onboarding completes

```sql
-- client row
status = 'active'
subscription_status = 'trialing'
trial_expires_at IS NOT NULL
setup_complete = false   -- true only after Twilio provisioned
twilio_number IS NULL    -- trial = no number
ultravox_agent_id IS NOT NULL
stripe_customer_id IS NOT NULL (created at checkout or trial activation)

-- client_users row
user_id = auth.users.id
client_id = clients.id
role = 'owner'

-- auth.users
email = <canary email>
providers = ['email']
last_sign_in_at IS NOT NULL
```

### Fail conditions

| Fail signal | Likely cause | Where to look |
|-------------|--------------|---------------|
| `/api/provision/trial` returns 4xx | Rate limit hit OR duplicate email | Railway logs → `[provision/trial]` |
| Email never arrives | Supabase email not configured | Supabase Dashboard → Auth → Email Templates |
| Set-password link errors | Token expired or already used | `/login?error=auth_callback_failed` in URL |
| Dashboard 401 after set-password | Session cookie not set on `/auth/callback` redirect | Check `x-forwarded-host` header in Railway logs |
| `client_users` row missing | `activateClient()` failed mid-flight | Check `activation_log` on client row |
| `ultravox_agent_id` null | Ultravox provisioning failed | Railway logs → `[activate-client]` |

---

## Scenario 2 — First-Time Google OAuth User

### Step order

1. Open `/try` in incognito (different Google account than operator)
2. Complete onboarding → Submit
3. When prompted, click "Continue with Google"
4. Authorize in Google popup
5. Observe redirect

### Expected route transitions

```
/try
  → POST /api/provision/trial (200)
  → client row created with status='setup'
  → /login (or inline prompt to sign in with Google)
  → handleGoogleSignIn() → supabase.auth.signInWithOAuth({ provider: 'google' })
  → Google OAuth consent screen
  → /auth/callback?code=...
  → /dashboard
```

### Expected visible UI state

| Step | Expected UI |
|------|-------------|
| After Google consent | Redirect to `/dashboard` directly (no set-password) |
| Dashboard | Agent visible, Google email in account header |

### Expected DB truth

```sql
-- auth.users
email = <google email>
providers includes 'google'

-- client_users
linked to correct client_id
```

### Fail conditions

| Fail signal | Likely cause | Where to look |
|-------------|--------------|---------------|
| OAuth redirect error | Redirect URI not registered in Google Cloud Console | Google Cloud → OAuth → Authorized redirect URIs — must include `<APP_URL>/auth/callback` |
| 400 on `/auth/callback` | `exchangeCodeForSession` failed | Railway logs → auth callback route |
| Dashboard shows wrong client | `client_users` linked to wrong row | Run truth snapshot by email |
| Google account already exists in Supabase | Re-use of existing test identity | Use a fresh Google account |

---

## Scenario 3 — Returning Email/Password User

### Step order

1. Use Scenario 1 identity (password already set)
2. Open `/login` in incognito
3. Enter email + password → Submit
4. Observe redirect

### Expected route transitions

```
/login
  → supabase.auth.signInWithPassword()
  → /dashboard (direct, no callback redirect)
```

### Expected visible UI state

Dashboard loads with same agent state as when last seen.

### Expected DB truth

`last_sign_in_at` updated on `auth.users`.

### Fail conditions

| Fail signal | Likely cause | Where to look |
|-------------|--------------|---------------|
| "Invalid credentials" | Wrong password or email case mismatch | Confirm exact email used during signup |
| Redirect loop | Middleware not recognizing valid session | Check `src/middleware.ts` session resolution |
| Dashboard loads empty | `client_users` missing or `client_id` null | Run truth snapshot |

---

## Scenario 4 — Trial State Truth Check

Run immediately after Scenario 1 or 2 completes. No UI action needed.

### Expected truth

```
subscription_status = 'trialing'
twilio_number = NULL
setup_complete = false
monthly_minute_limit = 50 (TRIAL_ENTITLEMENTS value)
trial_expires_at = <~14 days from created_at>
```

### Red flags

- `subscription_status = 'active'` without a real Stripe subscription → billing bug
- `twilio_number` present → provisioning leaked into trial path
- `monthly_minute_limit` > 50 or NULL → entitlements not applied
- `trial_expires_at` null → trial activation bug in `activateClient()`

---

## Scenario 5 — Trial → Paid Dashboard Upgrade

### Step order

1. Log in as trial canary user
2. Navigate to `/dashboard` → click upgrade button (or visit `/dashboard/billing`)
3. Complete Stripe checkout (use test card `4242 4242 4242 4242`)
4. Observe post-checkout redirect
5. Wait up to 30s for Stripe webhook to fire

### Expected route transitions

```
/dashboard/billing (or upgrade modal)
  → POST /api/billing/upgrade → Stripe checkout session
  → Stripe hosted checkout
  → /dashboard?upgraded=1 (success_url)
  → Stripe webhook: POST /api/webhook/stripe (checkout.session.completed)
  → client row updated
```

### Expected DB truth after webhook fires

```sql
subscription_status = 'active'
stripe_subscription_id IS NOT NULL
selected_plan = 'lite' (or whichever tier was chosen)
monthly_minute_limit = 200 (Lite) or 500 (Core) or 1000 (Pro)
```

### Fail conditions

| Fail signal | Likely cause | Where to look |
|-------------|--------------|---------------|
| Stripe checkout errors | Price ID mismatch (test vs live) | Check `PLANS` in `src/lib/pricing.ts` vs Stripe Dashboard |
| Webhook not received | Stripe webhook endpoint not configured for Railway URL | Stripe Dashboard → Webhooks → delivery logs |
| `subscription_status` still `'trialing'` after checkout | Webhook failed or slug lookup failed | Railway logs → `[stripe-webhook]` |
| `stripe_customer_id` null | Checkout created without customer pre-association | Check `planId` in checkout metadata |

---

## Scenario 6 — Live Call Canary

**Prereq:** A fully provisioned (non-trial) client with a real Twilio number.
Use an existing active client (e.g., `windshield-hub`) — do NOT provision a new one for this test.

### Step order

1. Call the Twilio number from a real phone
2. Observe that the call connects to Ultravox
3. Say one sentence → confirm agent responds
4. Hang up
5. Check call log in dashboard

### Expected outcomes

- Call reaches inbound webhook at `/api/webhook/<slug>/inbound` (POST 200)
- Ultravox session created → `call_logs` row inserted with `status='active'`
- Call ends → Ultravox webhook fires → `call_logs.status` updated to `'completed'`
- Call appears in dashboard call log with transcript

### Fail conditions

| Fail signal | Likely cause | Where to look |
|-------------|--------------|---------------|
| Dead air / no answer | Twilio number not routed to webhook | Twilio Console → Phone Numbers → webhook URL |
| Agent doesn't respond | Ultravox provisioning issue | `ultravox_agent_id` null or invalid |
| Call log empty | Inbound webhook not firing | Railway logs → `[inbound]` |
| Transcript missing | Ultravox native webhook not receiving `call.ended` | Ultravox webhook logs (account-level, ID `8451a083`) |

---

## Where to Look — Quick Reference

| Resource | Where |
|----------|-------|
| Railway logs | Railway dashboard → unmissed-ai-production → Deployments → latest → Logs |
| Supabase auth users | Supabase → Auth → Users |
| Supabase DB query | Use `npx tsx scripts/canary-truth-snapshot.ts --email <email>` |
| Stripe webhook delivery | Stripe Dashboard → Developers → Webhooks → endpoint → Recent deliveries |
| Ultravox webhook logs | GET `https://api.ultravox.ai/api/webhooks/8451a083-2af4-4d88-a77e-dd158c764cce` (admin) |
| Twilio call logs | Twilio Console → Monitor → Calls |
