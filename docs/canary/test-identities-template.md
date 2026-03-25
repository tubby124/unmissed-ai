# Test Identities Template

Fill in one identity per canary type before running the smoke checklist.
Do NOT commit filled-in versions with real credentials. Keep a local copy only.

---

## Identity 1 — Gmail / Google OAuth Canary

```
label:                  gmail-canary
email:                  (fill in — must be a real Google account you control)
login_method:           google_oauth
created_at:             (fill in after run)
client_id:              (fill in after run)
stripe_customer_id:     (fill in after run)
plan_state:             trial
expected_outcome:       Dashboard loads after Google consent. No Twilio number. Agent visible.
notes:                  Use a dedicated test Google account, not a personal one.
```

---

## Identity 2 — Non-Google Email Canary

```
label:                  email-canary
email:                  (fill in — use a real inbox you can read; consider Gmail + alias trick: foo+canary@gmail.com)
login_method:           email_password
created_at:             (fill in after run)
client_id:              (fill in after run)
stripe_customer_id:     (fill in after run)
plan_state:             trial
expected_outcome:       Set-password email arrives. Password set. Dashboard loads. No Twilio number.
notes:                  Confirm email deliverability before starting. Magic link expires — act within 60 min.
```

---

## Identity 3 — Trial → Paid Upgrade Canary

```
label:                  upgrade-canary
email:                  (fill in — can reuse Identity 2 after Scenario 1-5 pass)
login_method:           email_password
created_at:             (same as Identity 2 if reused)
client_id:              (same as Identity 2 if reused)
stripe_customer_id:     (fill in — assigned during trial activation)
stripe_subscription_id: (fill in after upgrade)
plan_state:             trial → lite (or core/pro)
stripe_test_card:       4242 4242 4242 4242  exp: any future  cvv: any
expected_outcome:       After checkout: subscription_status='active', selected_plan set, monthly_minute_limit updated.
notes:                  Use Stripe test mode. Confirm webhook fires within 30s. Check Railway logs if delayed.
```

---

## Notes

- Never use production Stripe cards for canary runs.
- Never use `admin@unmissed.ai` for canary runs (admin bypasses normal flow).
- Canonical test client slug for automated tests is `e2e-test-plumbing-co` — this is separate from canary identities.
- If an identity gets stuck, run: `npx tsx scripts/canary-truth-snapshot.ts --email <email>` to inspect state before retrying.
