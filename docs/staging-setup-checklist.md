# Staging Environment Setup Checklist

## Prerequisites
- Railway Pro plan (supports multiple services per project)
- Supabase project with branching enabled

## Step 1: Supabase Branch
1. Go to Supabase Dashboard → Project `qwhvblomlgeapzhnuwlb` → Branches
2. Create branch named `staging`
3. Note the staging branch URL and anon/service keys
4. Migrations from `supabase/migrations/` apply automatically to branches

## Step 2: Railway Staging Service
1. In Railway project, click "+ New Service"
2. Connect to same GitHub repo (`tubby124/unmissed-ai`)
3. Set deploy branch to `staging` (or `main` if using env-based separation)
4. Copy all env vars from production service, then override:

```env
# Required overrides for staging
NEXT_PUBLIC_APP_URL=https://unmissed-ai-staging.up.railway.app
NEXT_PUBLIC_SITE_URL=https://unmissed-ai-staging.up.railway.app
RAILWAY_ENVIRONMENT_NAME=staging

# Supabase — staging branch credentials
NEXT_PUBLIC_SUPABASE_URL=<staging-branch-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging-branch-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<staging-branch-service-key>

# Stripe — use TEST keys (not live)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_... (create new webhook for staging URL)

# Twilio — same account, different webhook URLs
# Webhook URLs auto-resolve from NEXT_PUBLIC_APP_URL

# Ultravox — same API key, staging agents are separate
ULTRAVOX_API_KEY=<same-key>
```

## Step 3: Twilio Webhook URLs
Staging Twilio numbers should point to the staging Railway URL:
- `https://unmissed-ai-staging.up.railway.app/api/webhook/{slug}/inbound`
- Assign a dedicated test number for staging (not a production client number)

## Step 4: Stripe Webhook
1. In Stripe Dashboard → Webhooks → Add Endpoint
2. URL: `https://unmissed-ai-staging.up.railway.app/api/webhook/stripe`
3. Events: same as production (checkout.session.completed, etc.)
4. Use TEST mode keys

## Step 5: Verify
```bash
# Health check
curl https://unmissed-ai-staging.up.railway.app/api/health

# Confirm environment detection
# App logs should show [STAGING] prefix (via envPrefix())
```

## What staging gives you
- Safe webhook testing without affecting production clients
- Stripe checkout flow testing with test cards
- Onboarding/provisioning testing without real Twilio charges
- Migration dry-runs on Supabase branch before production
- UI/UX testing without client-visible impact

## What staging does NOT give you
- Separate Ultravox account (agents are shared — use test slugs)
- Separate Twilio account (numbers are shared — assign staging-only numbers)
- Production call traffic (staging is manual testing only)

## Code-level staging support
- `src/lib/environment.ts` — `isProduction()`, `isStaging()`, `isDevelopment()`
- `src/lib/app-url.ts` — `APP_URL` derived from `NEXT_PUBLIC_APP_URL` (auto-resolves per env)
- `requireProductionConfirmation()` — guards destructive admin operations
