---
type: SOP
status: active
tags: [revenue, onboarding, concierge]
related: [[April-14-Audit-Pivot]]
updated: 2026-04-15
---

# Concierge Onboarding SOP — $29/mo Smart Voicemail

> Manual onboarding process for signing first clients at $29/mo.
> Target: collect info → working agent → payment in < 2 hours.

## Who This Is For

Local service businesses who called you, answered your ad, or came through referral.
Starting niche: **smart voicemail / message-only** (simplest, fastest to set up).

---

## Step 1 — Intake (15 min, phone or form)

| Field | Why you need it |
|-------|----------------|
| Business name | Agent introduction, prompt |
| Owner first name | CLOSE_PERSON slot |
| Agent name preference | What should the AI call itself? |
| Main phone number | Twilio number to buy / point to |
| Business hours | Weekday + weekend hours (or "24/7") |
| 3 most common caller questions | FAQ seeds for the prompt |
| Urgency keywords | Pipe leaks, no heat, locked out, etc. |
| What to do with after-hours callers | Message only / emergency forward |

Optional but valuable:
- Website URL (for knowledge scraping)
- Short description of services (2–3 sentences)

---

## Step 2 — Provision Twilio Number (10 min)

1. Log in to Twilio Console → Phone Numbers → Buy a Number
2. Choose local area code matching the client's city
3. Cost: ~$1/month (billed to your Twilio account)
4. Copy the number in E.164 format: `+1XXXXXXXXXX`

---

## Step 3 — Create Client in Supabase (15 min)

### 3a — Provision via admin API

```bash
curl -X POST https://unmissed-ai-production.up.railway.app/api/admin/provision \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "...",
    "slug": "...",
    "niche": "general_service",
    "agentName": "...",
    "ownerName": "...",
    "callerAutoText": false,
    "callHandlingMode": "message_only"
  }'
```

### 3b — Set Twilio number + webhook

```sql
UPDATE clients SET twilio_number = '+1XXXXXXXXXX' WHERE slug = '...';
```

Twilio Console → Phone Number → Configure:
- Voice URL: `https://unmissed-ai-production.up.railway.app/api/webhook/{slug}/inbound`
- Method: HTTP POST

---

## Step 4 — Build the Prompt (20 min)

### 4a — Populate fields via Settings

Log in as `admin@unmissed.ai` → open client → Settings:
- Paste `business_facts` (hours, services, FAQs)
- Set `agent_name`, `owner_name`, `business_hours_weekday`, `business_hours_weekend`
- Add 3–5 `extra_qa` entries from intake

### 4b — Test call

Dashboard → "Talk to Your Agent" (browser WebRTC test). Confirm:
- Agent introduces itself correctly
- Takes a message when asked
- Doesn't hallucinate a callback number

---

## Step 5 — Collect Payment (10 min)

### Option A — Stripe (preferred)

Send client to: `https://unmissed-ai-production.up.railway.app/pricing`
Promo code: **FOUNDING29** → $20/mo off (Solo $49 → **$29/mo forever**)
Stripe Coupon ID: `i0s7bCCd`

### Option B — Wave Invoice

Log in to Wave → New Invoice → $29 CAD/month
Note: "Smart Voicemail — AI Receptionist — Founding Rate (locks in forever)"

---

## Step 6 — Forward Calls (10 min)

### 6a — MANDATORY: Client removes carrier voicemail FIRST

**This is non-skippable.** Carrier voicemail and conditional call forwarding share the same GSM supplementary service slot — voicemail wins the slot, the forward never fires. The client will see "Setting Activation Succeeded" on the codes below but unanswered calls will still go to carrier voicemail. Validated 2026-04-29 on Hasan's Rogers Business 403-808-9705 line.

**Tell client to call their carrier and say, word-for-word:**

> "Please **fully remove** voicemail from this line. Not reset — delete the voicemail box from my line profile. I'm using a third-party answering service and the carrier voicemail is blocking my conditional call forwarding."

Wait for verbal confirmation: *"Voicemail has been removed."* Free on postpaid plans, takes ~5 min on the call.

**Carrier numbers:**
- Rogers Consumer: `1-800-764-3771` (or `*611` from cell)
- Rogers Business: `1-866-727-2141`
- Bell: `1-800-668-6878`
- Telus: `1-866-558-2273`
- Fido: `1-888-481-3436`
- SaskTel: `1-800-727-5835`

**Things that DO NOT work** (don't waste time on these):
- Toggling iOS Settings → Phone → Visual Voicemail off (iOS layer only)
- "Resetting" voicemail (clears messages, doesn't release slot)
- Ring-time race trick `*61*NUMBER**5#` (voicemail still wins; also frequently rejected with "Error performing request")
- `*98` voicemail-deactivate code (only mutes notifications)
- MyRogers consumer app voicemail toggle (UI layer only)

### 6b — Client dials forwarding codes (after voicemail removal confirmed)

**Best UX — combo unconditional code (no answer + busy + unreachable in one):**
```
**004*1XXXXXXXXXX#
```

Or three separate conditional codes (one at a time, press call after each):
```
*61*1XXXXXXXXXX#     ← no answer
*67*1XXXXXXXXXX#     ← busy
*62*1XXXXXXXXXX#     ← unreachable
```

Each should show "Setting Activation Succeeded".

### 6c — Verify

- Call the client's business phone from another phone, let it ring out unanswered
- Agent should pick up after ~5–6 rings
- If carrier voicemail picks up instead → voicemail wasn't fully removed, client must call carrier back and push harder ("delete the voicemail box from my line profile")
- Confirm with client they hear the agent

---

## Step 7 — Post-Setup Checklist

- [ ] Test call passes (agent answers, takes message)
- [ ] Client's phone forward confirmed working
- [ ] Telegram notification connected (optional)
- [ ] Client received first test call summary
- [ ] Payment confirmed (Stripe active OR Wave invoice sent)
- [ ] Follow-up reminder set for 48 hours

---

## Tracking

Log each client in: [[Concierge-Clients]]
