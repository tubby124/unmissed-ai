---
type: handoff
status: ready
target_session: next chat
opened: 2026-04-28
related:
  - Clients/velly-remodeling
  - Decisions/Manual-Concierge-Velly-2026-04-28
  - Tracker/D-NEW-mid-call-transfer-button
---

# Next Chat — Provision Velly Remodeling End-to-End

> The dashboard-side feature is shipped. PR [#39](https://github.com/tubby124/unmissed-ai/pull/39) needs to be merged + Railway redeployed before provisioning, otherwise Velly's first login won't have the "Take this call" button.

## What shipped this session (2026-04-28)
- ✅ `POST /api/dashboard/calls/[id]/transfer-now` — manual mid-call transfer endpoint
- ✅ LiveCallBanner: "Take this call" button (blue) between End + Just listen
- ✅ "Open Monitor" renamed → "Just listen" (plain-English concierge UX)
- ✅ Vault: client note + decision + tracker + intake payload + Index entry
- ✅ Local build: `npx tsc --noEmit` + `npm run build` both clean
- ✅ Pre-push hooks: 1700/1700 tests pass
- ✅ PR #39 opened against main from `docs/session-handoff-evening`

## Pre-provisioning (do FIRST in next chat)
1. **Review PR #39** — branch had 3 unrelated commits stacked (telegram + settings + handoff doc). Confirm those were meant to ship along with the transfer feature.
2. **Merge PR #39** to main (squash recommended — clean single commit on main).
3. **Wait for Railway redeploy** — verify `https://unmissed-ai-production.up.railway.app/api/dashboard/calls/test/transfer-now` returns 401 (route exists). If 404, redeploy didn't pick up.

## Provisioning steps (in order)

### Step 1 — Submit intake
**Sandbox-blocked last time. To unblock, run from a permitted shell:**

```bash
curl -X POST "https://unmissed-ai-production.up.railway.app/api/provision" \
  -H "Content-Type: application/json" \
  --data-binary @"/Users/owner/Downloads/CALLING AGENTs/CALLINGAGENTS/Clients/velly-intake-payload.json" \
  -w "\n---HTTP:%{http_code}\n"
```

Expected: `202 Accepted` with `{ "jobId": "<uuid>" }`. Telegram alert pings Hasan.

### Step 2 — Admin: Generate Prompt
1. Open `https://unmissed-ai-production.up.railway.app/dashboard/clients`
2. Find Velly Remodeling row → click **Generate Prompt**
3. ✅ **Tick "Enrich with Sonar Pro"** — niche=other has no template, Sonar fills FAQ + local context for renovation in Saskatoon
4. Wait for prompt generation (creates Ultravox agent, inserts `clients` row with `status='pending'`)

### Step 3 — Admin: Set transfer + minute cap (BEFORE activation)
**FIRST decide plan path (see [[Clients/velly-remodeling]] § Plan tier):**
- **Path A (real Lite, no transfer):** skip `forwarding_number` + `transfer_conditions`. Eric just message-takes. Just set `monthly_minute_limit = 100` and verify `selected_plan = lite`.
- **Path B (DB override for transfer at $29 price):** set `selected_plan = pro` at DB level + `forwarding_number = +13062416312` + `monthly_minute_limit = 100`. `transfer_conditions` is OPTIONAL — leave it null to use the default trigger ("caller asks for a person / VIP / emergency"), or paste the 4-rule block from [[Clients/velly-remodeling]] for name-specific routing.

Save in admin God Mode.

### Step 4 — Admin: Activate + get Stripe URL
1. `/dashboard/clients` → Velly → **Activate**
2. Copy the Stripe checkout URL it returns
3. **Apply FOUNDING29 coupon if not auto-applied** (Stripe Coupon ID: `i0s7bCCd`)
4. **DO NOT email Kausar yet** — Hasan said he'll handle that personally

### Step 5 — Browser test (BEFORE Kausar pays)
1. Hold Stripe URL — don't send to Kausar yet
2. Log in to Velly's dashboard as admin (impersonate via God Mode)
3. Click "Talk to Your Agent" — verify Eric:
   - Greets correctly: "Thanks for calling Velly Remodeling, this is Eric..."
   - Asks for project type
   - Stays in lead-capture mode for general quote
   - Transfers when test caller insists on Kausar by name
4. If anything is off — adjust transfer_conditions or run `/prompt-deploy velly-remodeling`

### Step 6 — Live PSTN test
After Stripe payment lands → activation chain runs → Twilio number assigned. From a different phone:
1. Call the new Twilio number → Eric answers
2. Test scenario A: "I want a quote for a basement suite" → verify intake collected, no transfer
3. Test scenario B: "I need to talk to Kausar, I paid him a deposit last month" → verify Eric transfers to +13062416312
4. Test scenario C: While call is live, hit "Take this call" button on dashboard → verify caller bridges to Kausar's cell within 3s

### Step 7 — Hand off to Hasan
Send Hasan: Twilio number + Stripe URL + carrier-forwarding instructions for 306-241-6312. He'll forward those to Kausar himself.

## Reference docs (read before starting)
- [[Clients/velly-remodeling]] — full client spec, provisioning checklist, transfer rule
- [[Clients/velly-intake-payload.json]] — exact JSON to POST
- [[Decisions/Manual-Concierge-Velly-2026-04-28]] — 6 decisions + 3 reality corrections
- [[Product/Concierge-Onboarding-SOP]] — D380 manual onboarding flow

## Authorization scope for next chat (per CLAUDE.md standing autonomy)
- ✅ Hasan-owned `unmissed-ai` repo: PR merge to main pre-authorized
- ✅ Supabase `qwhvblomlgeapzhnuwlb` migrations + queries pre-authorized
- ✅ Railway redeploys pre-authorized
- ❌ **Sending emails to Kausar — REQUIRES explicit ask each time** (Hasan handles client comms himself)
- ❌ **Stripe checkout URL distribution — REQUIRES explicit ask** (same reason)

## Risk callouts
- **Plan path question is open** — see Step 3. Confirm with Hasan before activation; "this light plan" in his 2026-04-28 PM message is ambiguous.
- **If Path B (DB override):** Velly is the first production client to exercise `transferCall`. Watch first 5 transfer events. If `transfer_status` gets stuck at `'transferring'`, check `/transfer-status` callback logs.
- **`niche=other` may produce a thinner prompt** than templated niches. Sonar enrichment partially compensates.
- **PR #39 already merged + Railway deployed 2026-04-28 PM** — this risk callout is stale, leaving for history.
- **Lite fake-control fix shipped 2026-04-28 PM** (separate PR, branch `fix/transfer-plan-gate`). Confirms Lite users see upgrade modal instead of working-looking toggle.

## What NOT to do
- ❌ Do NOT POST `/api/provision` until PR #39 is merged + redeployed
- ❌ Do NOT email or text Kausar — Hasan handles all client comms
- ❌ Do NOT skip Step 3 (transfer config) — if forwarding_number is null at activation, the agent won't have transferCall registered and Step 6 scenario B will fail
- ❌ Do NOT change Eric's voice without Hasan's explicit ask
