---
type: SOP
status: active
tags: [revenue, onboarding, concierge]
related: [[April-14-Audit-Pivot]]
updated: 2026-06-06
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
curl -X POST https://endvoicemail.ai/api/admin/provision \
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
- Voice URL: `https://endvoicemail.ai/api/webhook/{slug}/inbound`
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

Send client to: `https://endvoicemail.ai/pricing`
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

---

# 2026-06-06 Update — Aman Walia onboarding learnings

These steps refine the post-provision polish phase + the human-touch send phase, learned end-to-end on Aman Walia (walia-family). Apply to every concierge client going forward. Reference: [[2026-06-06-aman-walia-wave-1-shipped]] · [[2026-06-06-aman-walia-wave-1-5-personal-message-shipped]] · [[2026-06-06-universal-personal-message-architecture]].

## Step 4.5 — Aisha-quality prompt polish (always run BEFORE the welcome email)

After Step 4 builds the baseline prompt via slot pipeline, layer two prompt polishes via `niche_custom_variables` (DB-only, hand_tuned stays false, ZERO-SNOWFLAKE preserved):

### 4.5a — GREETING_OVERRIDE (Aisha-shape greeting)
The default niche greeting is robotic and brand-heavy. Replace with the Aisha pattern:
```
"Hey! This is {AGENT}, {OWNER_FIRST}'s virtual assistant — I can take a
message, answer questions about {OWNER_FIRST}'s services, or get a message
to him. What's going on?"
```
Set via `clients.niche_custom_variables.GREETING_OVERRIDE`. Reference script: [scripts/recompose-aman.ts](../../scripts/recompose-aman.ts).

### 4.5b — TRIAGE_DEEP + FORBIDDEN_EXTRA (PERSONAL MESSAGE FLOW trunk)
Every concierge client forwards their personal cell to their AI number → the AI is ALWAYS dual-purpose (business + personal voicemail). Family / friends / service providers / deliveries calling for the owner must get a WARM message-take, NOT "wrong number, this is a [industry] office" hangup.

Override `niche_custom_variables.TRIAGE_DEEP` to PREPEND a PERSONAL MESSAGE FLOW trunk that:
1. Acknowledges warmly: `"for sure — I'll get that to {OWNER_FIRST} right away."`
2. Collects name (skip if given)
3. Collects reason (skip if given)
4. Closes: `"got it — I'll pass that along. take care!"` then hangUp
5. NEVER asks for callback number — CALLER PHONE auto-injected
6. RELATIONSHIP SHORTCUT — `wife / son / brother / mom / friend` = name + reason combined, close immediately

Then APPEND a `FORBIDDEN_EXTRA` rule against hostile wrong-number hangups for off-topic callers.

Reference script: [scripts/recompose-aman-personal.ts](../../scripts/recompose-aman-personal.ts). Pattern lifted from Aisha (hasan-sharif, hand_tuned=true) — see lines 58-66 + 98 of her stored prompt.

### 4.5c — Shorten business_name if it duplicates owner name
GBP often returns concatenated business names like `"{OWNER} — {BRAND}"`. The em-dash gets voiced literally by GLM ("Aman Walia — dash — Walia Family Real Estate"). Patch to just the brand: `"Walia Family Real Estate"`.

### 4.5d — Tier-1.5 ship gate
Before sending the welcome email, run promptfoo Tier-1.5 against the live snapshot:
```bash
npx promptfoo eval -c tests/promptfoo/{slug}-baseline.yaml --no-cache
```
Target ≥ 90% with must-fix scenarios PASS. Aman's pattern of 4 personal-flow scenarios (family/wife, service provider, delivery, wrong-number) is the canonical fixture — clone for each new client and update business/owner names.

### 4.5e — KNOWN LIMITATION (Wave 3 fix in flight)
The literal "wrong number, is this Dr. Singh's office?" scenario STILL fails because `prompt-slots.ts:431` FILTER WRONG NUMBER line lives in code, not in niche_custom_variables. Wave 3 universal slot-pipeline edit will fix fleet-wide. Until shipped, accept this single edge case — rare in practice (most off-topic callers don't literally say "wrong number").

---

## Step 5.5 — Send the branded welcome email via Resend (NOT gmail.py)

Production sending path is `sendBrandedEmail()` in `src/lib/email/send.ts`. It auto-handles:
- List-Unsubscribe + List-Unsubscribe-Post headers (Gmail Feb 2024 bulk-sender compliance)
- Plain-text fallback generation (anti-spam signal)
- Branded footer with CASL mailing address + one-click unsubscribe URL
- Logged to `notification_logs` (Resend webhook updates delivered/bounced status)
- Single brand identity FROM (`notifications@`/`hello@`/`support@`)

### Template script
Use [scripts/send-aman-welcome.ts](../../scripts/send-aman-welcome.ts) as the canonical pattern. Change these constants per client:
```ts
const TO = '{client_email}'
const SUBJECT = 'Your AI receptionist is live, {OWNER_FIRST}'
const CLIENT_ID = '{supabase_client_id}'
const REPLY_TO = 'hasan.sharif.realtor@gmail.com'  // replies hit Hasan's Gmail
const TELEGRAM_DEEP_LINK = '{telegram_registration_link_from_STEP-14}'
```

Run with `--send` flag. Production Resend key required (`re_GTdM1M79_...` — Railway env, NOT local .env.local which may point to a different Resend account without the `endvoicemail.ai` domain verified).

### Email structure (locked 2026-06-06)
ELI12 + hand-hold. Two REPLY-required questions only:
1. **Alert combo** (Telegram only / Telegram+SMS / Telegram+SMS+Email / SMS+Email / Email only) — default recommendation: Telegram+SMS+Email
2. **Carrier** (Rogers/Fido, Telus/Koodo, Bell/Virgin, Freedom, Other) — gates Step 6.5 follow-up

Plus 3 self-serve steps (test call, connect Telegram, dashboard login) and a "what Riley knows + won't do" section. Booking-to-calendar is "coming soon" by default — flip on per-client when Pro plan upgrades.

DO NOT include forwarding codes in the welcome email — they're carrier-specific and the codes look like they worked when they didn't (voicemail collision). Wait for the carrier reply.

### Visual polish
- Section cards on `#FAFAFA` w/ `#E5E7EB` border + uppercase step badges
- Reply-required steps get an amber pill (`#FEF3C7` bg, `#92400E` text)
- Telegram CTA = real blue button (`#229ED9`, Telegram brand)
- Login creds in dedicated white callout w/ monospace code
- Voicemail warning = red left-border callout
- Recap at bottom = green success-tone box
- All inline styles (email-safe, no external CSS)

---

## Step 6.5 — Send carrier-specific follow-up after client replies

After the client replies with their carrier, send the carrier-specific voicemail-removal + forwarding playbook within ~1 business day. Template script: [scripts/send-aman-rogers-codes.ts](../../scripts/send-aman-rogers-codes.ts) — adapt for Telus/Bell/Fido/Koodo/Virgin/Freedom.

### Carrier reference table (memory: ~/.claude/projects/-Users-owner/memory/unmissed-carrier-voicemail-removal.md)
| Carrier | Support # | Notes |
|---|---|---|
| Rogers Consumer | 1-800-764-3771 (*611) | Validated 2026-04-29 |
| Rogers Business | 1-866-727-2141 | |
| Telus Consumer | 1-866-558-2273 (*611) | Validated 2026-05-05; some plans bundle "Premium Voicemail" — escalate to tier 2 retention |
| Bell Consumer | 1-800-668-6878 | |
| Bell Mobility | 1-800-667-0123 | |
| Fido | 1-888-481-3436 | |

### Locked Rogers script (read verbatim to agent)
> "Hi — please **fully remove** voicemail from my line. Not reset, not pause — I need the voicemail box **deleted from my line profile**. I'm using a third-party answering service and the carrier voicemail is blocking my conditional call forwarding. If I have Visual Voicemail, please remove that as well."

iPhone clients: explicitly confirm "Visual Voicemail service is also removed from the line" — Apple VVM is a separate paid carrier feature that wins the same supplementary-service slot.

### Forwarding codes (carrier-agnostic GSM standard, work post-VM-removal)
```
*61*1{AI_DID_E164}#   no answer → AI
*67*1{AI_DID_E164}#   busy → AI
*62*1{AI_DID_E164}#   unreachable → AI
```
Cancel codes:
```
##61#   ##67#   ##62#
```

### Real-world test step
After codes are entered, client has someone call their personal cell, lets it ring out, confirms Riley picks up. If carrier voicemail picks up instead → voicemail wasn't fully removed, push client to call carrier back and escalate to tier 2.

---

## Process map (high level)

```
Step 1  Intake (15m)
Step 2  Provision Twilio (10m)
Step 3  Create client in Supabase (15m)
Step 4  Build prompt — slot pipeline baseline (20m)
Step 4.5  Aisha-quality polish via niche_custom_variables (10m)   ← 2026-06-06
        ├─ 4.5a GREETING_OVERRIDE
        ├─ 4.5b TRIAGE_DEEP + FORBIDDEN_EXTRA (PERSONAL MESSAGE FLOW)
        ├─ 4.5c Shorten business_name if needed
        └─ 4.5d Tier-1.5 ship gate
Step 5  Collect payment (10m)
Step 5.5  Send branded welcome email via Resend (5m)             ← 2026-06-06
Step 6  Carrier voicemail removal (client side, 15m)
Step 6.5  Send carrier-specific follow-up email (5m)             ← 2026-06-06
Step 7  Post-setup checklist + 48h follow-up
```
Total concierge labor per client (assuming smooth flow): ~80 min.

