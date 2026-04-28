---
type: handoff
status: ready
target_session: next chat
opened: 2026-04-28
related:
  - Clients/velly-remodeling
  - Decisions/Manual-Concierge-Velly-2026-04-28
  - 00-Inbox/NEXT-CHAT-Velly-Provisioning
---

# Next Chat — Kausar / Velly Remodeling Activation (Path B locked)

> Hasan locked Path B 2026-04-28 PM: **$29/mo Stripe price + Core feature gates (transfer enabled) + 100-minute hard cap.** Custom three-way combo. The plan gate fix from PR #40 + smart transfer recovery (already shipped) make this clean.

## What's already shipped
- ✅ PR #39 — Manual "Take this call" button on LiveCallBanner + `POST /api/dashboard/calls/[id]/transfer-now`
- ✅ PR #40 — Lite fake-control fix (Overview Transfer chip now plan-gated)
- ✅ Smart transfer recovery — when owner doesn't answer, AI reconnects with explicit failure context + scripted opener "Hey, looks like they're tied up right now. Would you like to leave a message…" ([transfer-status/route.ts:220-245](src/app/api/webhook/[slug]/transfer-status/route.ts#L220-L245))
- ✅ Vault corrections — [[Decisions/Manual-Concierge-Velly-2026-04-28]] + [[Clients/velly-remodeling]] + [[00-Inbox/NEXT-CHAT-Velly-Provisioning]]
- ✅ Railway deployed — main is at `a51ea82` (PR #40)

## The pricing combo for Kausar
| Lever | Value | Source of truth |
|---|---|---|
| Stripe price (what Kausar pays) | $29/mo CAD | Stripe Dashboard — needs new price object |
| `selected_plan` (feature gates) | `core` | `clients` table |
| `monthly_minute_limit` (cap) | `100` | `clients` table |

**Why these three are independent:** `selected_plan` controls features (`buildAgentTools` reads it for transfer/booking/SMS/knowledge gating). `monthly_minute_limit` is a plain integer column — Trial uses this same lever to cap at 50 regardless of plan. Stripe price is just billing — the webhook sets `selected_plan` based on which Stripe product the price belongs to. Set up correctly, no DB hack needed.

## Pre-flight: Create the $29 Core Stripe price
**Do this once in Stripe Dashboard, then reuse for any future $29 Core founding clients:**

1. Open Stripe Dashboard → Products → "AI Receptionist" (`prod_UCl8nni05Nk9lB` — Core's product, see [pricing.ts:77](src/lib/pricing.ts#L77))
2. Add a new price under that product:
   - Type: Recurring, monthly
   - Currency: CAD
   - Amount: $29.00
   - Description: "Core Founding $29 (concierge / 100min cap)"
3. Copy the new `price_xxx` ID — call it `CORE_FOUNDING_29_PRICE_ID`
4. Save it in `pricing.ts` STRIPE_IDS section + memory + this handoff

**Why a new price, not the FOUNDING29 coupon:** the existing `i0s7bCCd` coupon is "$20 off forever" applied to Lite ($49 → $29). Applied to Core ($119) it'd give $99, not $29. We need a price-level discount on Core's product so the Stripe webhook auto-sets `selected_plan='core'`.

## Provisioning order (in next chat)

### Step 1 — Submit intake (Path A unchanged)
```bash
curl -X POST "https://unmissed-ai-production.up.railway.app/api/provision" \
  -H "Content-Type: application/json" \
  --data-binary @"/Users/owner/Downloads/CALLING AGENTs/CALLINGAGENTS/Clients/velly-intake-payload.json" \
  -w "\n---HTTP:%{http_code}\n"
```
Expected: 202 with `jobId`. Telegram pings Hasan.

### Step 2 — Admin: Generate Prompt
- /dashboard/clients → Velly Remodeling → **Generate Prompt**
- ✅ Tick **"Enrich with Sonar Pro"** (niche=other has no template)
- Wait for Ultravox agent creation, `clients` row inserted with `status='pending'`

### Step 3 — Admin: Apply Kausar's combo (BEFORE activation)
God Mode → Velly's row → set:
```
selected_plan         = 'core'
forwarding_number     = '+13062416312'
monthly_minute_limit  = 100
transfer_conditions   = (paste 4-rule block from Clients/velly-remodeling.md "Transfer rule" section — name-specific routing for Kausar)
```
Save.

### Step 4 — Admin: Activate + get Stripe URL
- /dashboard/clients → Velly → **Activate**
- The activation flow generates a Stripe checkout URL using whatever `STRIPE_SUBSCRIPTION_PRICE_ID` env var is set to. **This may be the wrong price for Kausar.**
- Two paths:
  - **Path 4a — env var swap (cleanest):** before clicking Activate, temporarily set `STRIPE_SUBSCRIPTION_PRICE_ID=<CORE_FOUNDING_29_PRICE_ID>` on Railway → redeploy → Activate → get $29 URL → revert env var → redeploy. Fragile, requires two redeploys.
  - **Path 4b — manual Stripe URL (faster):** ignore the auto-generated URL. Build a Stripe Payment Link manually in Stripe Dashboard pointing to the $29 Core price. Send that to Kausar instead.

**Recommend 4b for Kausar specifically** — one-off concierge client, no need to flip env vars. For future $29 Core founding clients, build a proper admin route that takes a `stripe_price_id` override.

### Step 5 — Browser test BEFORE Kausar pays
1. Hold the Stripe URL — don't send to Kausar yet
2. /dashboard/clients → impersonate Velly → Talk to Your Agent
3. Verify Eric:
   - Greets correctly: "Thanks for calling Velly Remodeling, this is Eric…"
   - Asks for project type
   - Stays in lead-capture for general quote
   - **Transfers when test caller insists on Kausar by name** (the 4-rule block firing)
   - Verify the smart recovery: hang up while transferring → confirm Eric returns with "Hey, looks like they're tied up right now…"
4. If anything off: tweak `transfer_conditions` or `/prompt-deploy velly-remodeling`

### Step 6 — Live PSTN test
After Kausar pays → activation chain → Twilio number assigned. Different phone:
1. Call new Twilio number → Eric answers
2. Scenario A (no transfer): "I want a quote for a basement suite" → intake collected, NO transfer
3. Scenario B (name-specific): "I need to talk to Kausar, I paid him a deposit last month" → transfers to +13062416312
4. Scenario C (manual override): while live, click "Take this call" on dashboard → bridges to Kausar within 3s
5. Scenario D (recovery): transfer triggered, decline on Kausar's phone → confirm Eric resumes with the recovery opener

### Step 7 — Hand off to Hasan
Send Hasan: Twilio number + Stripe URL (from Step 4b) + carrier-forwarding instructions for 306-241-6312. He emails Kausar himself.

## Authorization scope (per CLAUDE.md standing autonomy)
- ✅ Hasan-owned `unmissed-ai` repo: PR merges + pushes pre-authorized
- ✅ Supabase `qwhvblomlgeapzhnuwlb` migrations + queries pre-authorized
- ✅ Railway redeploys pre-authorized (needed for Path 4a env var swap)
- ❌ **Sending emails / Stripe URLs to Kausar — REQUIRES explicit ask** (Hasan handles client comms)
- ❌ **Creating Stripe products/prices in Stripe Dashboard — REQUIRES explicit ask** (touches billing)

## What NOT to do
- ❌ Do NOT use FOUNDING29 coupon for Kausar — it's a Lite coupon, would give $99 on Core
- ❌ Do NOT email Kausar — Hasan handles all client comms
- ❌ Do NOT set `selected_plan='lite'` — that strips the transfer tool, defeats the entire point of Path B
- ❌ Do NOT skip the browser test in Step 5 — Velly is the first production transfer + first concierge client on a custom price combo

## Risk callouts
- **First production client to exercise `transferCall`.** Watch first 5 transfer events. If `transfer_status` stuck at `'transferring'`, check `/transfer-status` callback logs.
- **First production client on the Core-feature + Lite-price + custom-cap combo.** If billing webhook misroutes, Kausar might get bumped to standard Core ($119) on next renewal. Verify Stripe subscription's price ID matches `CORE_FOUNDING_29_PRICE_ID` after first invoice.
- **`niche=other` may produce a thinner prompt** than templated niches. Sonar enrichment partially compensates. If Eric sounds generic, consider scaffolding a `renovation` niche before more contractors sign on.

## Reference docs
- [[Clients/velly-remodeling]] — full client spec, transfer rule
- [[Clients/velly-intake-payload.json]] — exact JSON for /api/provision
- [[Decisions/Manual-Concierge-Velly-2026-04-28]] — 6 decisions + 6 reality corrections (now includes smart-recovery confirmation)
- [[Product/Concierge-Onboarding-SOP]] — D380 manual onboarding flow
