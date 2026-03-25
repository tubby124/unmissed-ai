# Post-Fix Smoke Checklist

Fill in "Actual" and "Pass/Fail" during the canary run. IDs go in Notes.

| # | Scenario | Expected | Actual | Pass/Fail | Notes / IDs |
|---|----------|----------|--------|-----------|-------------|
| 1 | Complete trial onboarding (email user) | `/api/provision/trial` → 200, client row created with `status='active'` | | | `client_id:` |
| 2 | First-time auth handoff works | Set-password email arrives, link opens `/auth/set-password`, form renders | | | |
| 3 | Password set succeeds | After submit → redirect to `/dashboard` with session cookie set | | | |
| 4 | Dashboard loads | Agent name visible, trial badge present, no "Live calls" number shown | | | |
| 5 | Logout / login round trip | Logout → `/login` → email+password → `/dashboard` with same agent state | | | |
| 6 | Google login works | Google OAuth → `/auth/callback` → `/dashboard` (no password step) | | | Google email: |
| 7 | Trial has no live Twilio number | `twilio_number = NULL` in DB, setup page reflects "not ready" | | | Snapshot output |
| 8 | Trial test-call (WebRTC playground) works | Browser call connects to Ultravox demo agent, agent speaks | | | call_id: |
| 9 | Dashboard upgrade completes | Stripe test checkout → `subscription_status='active'` after webhook | | | `stripe_sub_id:` |
| 10 | Webhook → Twilio number present | After upgrade webhook fires: `twilio_number IS NOT NULL` (if Twilio provisioning triggered) | | | Verify via snapshot |
| 11 | `/dashboard/setup` shows real ready state | `setup_complete=true` or correct pending state rendered — no stale "pending" if active | | | |
| 12 | Live inbound call reaches runtime | Real call → agent answers → transcript appears in dashboard call log | | | `call_log_id:` |

---

**Run instructions**

```bash
# Before starting — open truth snapshot for each canary identity:
npx tsx scripts/canary-truth-snapshot.ts --email <canary-email>

# After each major step — re-run snapshot and compare output to Expected column above.
```

**Pass gate:** All 12 rows = PASS before declaring auth patch green.
