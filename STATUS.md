# WHERE WE ARE — Pick Up From Here
> Last updated: March 7, 2026

---

## Current Phase: Phase 1 — Template Hardening + First New Client

**What's working right now:**
- Windshield Hub Auto Glass — live, 35 nodes, R1-R10 hardened, tested ✅
- Hasan Sharif Voicemail (Aisha) — live, 32 nodes
- Manzil Realty ISA (Fatima) — TEST MODE, v4.18 live

**What we just completed:**
- Full template hardening (DOC1) — 4 hardening nodes pushed + verified working
- Property management niche in `prompt_builder.py`
- `/provision` slash command + `onboard-client` skill built
- PROPERTY MANAGER SYSTEM client folder ready

**What's next:** Property manager client deployment

**Note — PIPEDA disclosure ("I'm an AI assistant"):** Template has the fix but NOT being applied to live prompts yet. Deferred — do not bring this up unless user asks.

---

## Next Actions

| # | Action | Who | Detail |
|---|--------|-----|--------|
| 1 | Property manager intake | Human | Fill 9 fields in `PROPERTY MANAGER SYSTEM/CLIENT_ONBOARDING_CHECKLIST.md` |
| 2 | Run `/provision <slug>` | Claude | Generates prompt + guides through Twilio, Sheets, n8n clone |
| 3 | Set n8n env vars (optional) | Human | `TWILIO_AUTH_TOKEN` + `N8N_WEBHOOK_URL` — activates HMAC blocking on WinHub when ready |

---

## Live System Credentials (Quick Reference)

| System | Workflow ID | Sheet ID | Twilio # |
|--------|-------------|----------|----------|
| Windshield Hub | `sbztgErD8MV3WMOn` | `1AJvwGoAglaNQawjfhKBPBptKktxya4YAJoE7YAKJXnQ` | +1 (587) 355-1834 |
| Hasan Sharif (Aisha) | `hjDvPPSMhlKKxSdN` | `1fE9_d5FSRzBVdbLgJt0sWaNTXAbtn1OgnuDTOKLGelk` | +1 (587) 742-1507 |
| Manzil ISA (Fatima) | `sKh2bzwPtpDCWVKO` | `1yNnDaG4OkWe6jIPQqWgO_sXDkvQ24bzSUrvvO-NmUf8` | +1 (587) 801-4602 |

**n8n host:** `https://n8n.srv728397.hstgr.cloud`
**API key:** `HASAN SHARIF VOICE MAIL SYSTEM N8N ULTRAVOX TWILIO SETUP /n8n_api_helper.sh`
**Twilio Account SID:** `ACff197fc7fe95e12ea8ac1c635f5e57ab`

---

## Key File Map

```
CALLING AGENTs/
│
├── STATUS.md                              ← YOU ARE HERE
├── PROPERTY_MANAGER_MASTER_PLAN.md        ← Full phase-by-phase deployment plan
├── CLAUDE.md                              ← Session rules + file map
│
├── DOC1-Template-Hardening-Checklist.md  ← R1-R11 hardening spec (source of truth)
├── DOC2-Per-Client-Deployment-Runbook.md ← Step-by-step client deployment
├── DOC3-Scale-Infrastructure-Spec.md     ← /provision + onboard-client spec
│
├── BUILD_PACKAGES/                        ← CANONICAL TEMPLATES for all new clients
│   ├── INBOUND_VOICE_AGENT/
│   │   ├── PROMPT_TEMPLATE_INBOUND.md    ← v3.1, PIPEDA-compliant
│   │   └── INTAKE_FORM_INBOUND.md        ← Q0-Q22 intake questions
│   └── OUTBOUND_ISA_AGENT/
│       └── PROMPT_TEMPLATE_ISA.md
│
├── WINDSHIELD HUB AUTO GLASS SYSTEM/
│   ├── winhub_hardened.json              ← PUSH THIS — 35 nodes, all R1-R10 done
│   ├── winhub_march4_post4fixes.json     ← Previous live backup (31 nodes)
│   ├── DEPLOYMENT_GOTCHAS.md             ← 38 gotchas — read before any deploy
│   └── SYSTEM_DOCUMENTATION.md
│
├── PROVISIONING/
│   └── app/prompt_builder.py             ← Generates prompts for 9 niches
│
├── clients/                              ← Per-client config JSONs
│   ├── manzil-realty.json
│   ├── hasan-sharif.json
│   └── windshield-hub-template.json
│
├── PROPERTY MANAGER SYSTEM/              ← NEXT CLIENT — waiting on intake
│   ├── SAMPLE_TRANSCRIPTS.md             ← 4 scenarios ready
│   ├── CALL_FORWARDING_INSTRUCTIONS.md   ← Carrier-specific instructions ready
│   └── CLIENT_ONBOARDING_CHECKLIST.md    ← Fill in Step 0 fields
│
├── MANZIL REALTY ISA SYSTEM/
│   ├── FATIMA_SYSTEM_PROMPT.txt          ← v4.18 live (49,364 bytes)
│   └── PROMPT_CHANGELOG.md
│
├── HASAN SHARIF VOICE MAIL SYSTEM N8N ULTRAVOX TWILIO SETUP /
│   └── n8n_api_helper.sh                 ← n8n API key lives here
│
└── agent-app/                            ← Next.js platform (Railway deployed)
    └── src/app/onboard/                  ← 7-step client onboarding wizard
```

---

## PIPEDA Changes Needed on Live Sheets

Both live systems need their opening line updated to disclose AI:

**WinHub — find this in Sheet A2 and update:**
```
OLD: "hey there, Windshield Hub Auto Glass — this is Mark, how can i help ya?"
NEW: "Windshield Hub Auto Glass — this is Mark, an AI assistant. How can I help ya today?"

OLD (robot handler): "nah, i'm Mark at the front desk!"
NEW: "yeah, I'm an AI assistant here at Windshield Hub Auto Glass — how can I help ya?"
```

**Hasan Sharif — same pattern, find + update in Sheet `1fE9_...` → "Assistant System Prompt":**
```
OLD: any greeting that doesn't say "AI assistant"
NEW: "[Business] — this is Aisha, an AI assistant. How can I help ya today?"
```

---

## Dev Commands

```bash
# Start Next.js platform
cd "/Users/owner/Downloads/CALLING AGENTs/agent-app"
npm run dev  # → http://localhost:3001

# Generate property manager prompt (once intake is complete)
cd "/Users/owner/Downloads/CALLING AGENTs/PROVISIONING"
python3 app/prompt_builder.py --niche property_management --client ../clients/<slug>.json

# Push hardened WinHub workflow
N8N_URL="https://n8n.srv728397.hstgr.cloud"
API_KEY="<from n8n_api_helper.sh>"
curl -s -X PUT -H "X-N8N-API-KEY: $API_KEY" \
  -H "Content-Type: application/json" \
  -d @"WINDSHIELD HUB AUTO GLASS SYSTEM/winhub_hardened.json" \
  "$N8N_URL/api/v1/workflows/sbztgErD8MV3WMOn"
```
