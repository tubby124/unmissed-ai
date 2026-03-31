---
type: operations
status: active
tags: [operations, leads, classification, ai]
related: [Dashboard/Dashboard Architecture, Operations/Cron Jobs]
updated: 2026-03-31
---

# Lead Classification System

## Overview
Every call is classified by AI in the `/completed` webhook after it ends.
Two classification dimensions:

| Dimension | Field | Values |
|-----------|-------|--------|
| Call type | `classification` | `BOOKING / INFO / TRANSFER / CALLBACK / COMPLAINT / JUNK` |
| Lead quality | `lead_status` | `HOT / WARM / COLD / JUNK` |

## Classification Logic (in `/completed` route)

```
AI prompt → GPT/Claude classifies:
  BOOKING  → caller wanted to / did book appointment
  INFO     → caller asked questions, got answers
  TRANSFER → caller was transferred to staff
  CALLBACK → caller left callback preference
  COMPLAINT → caller expressed dissatisfaction
  JUNK     → spam, solicitor, wrong number, <10s call

lead_status:
  HOT  → BOOKING or CALLBACK with contact info captured
  WARM → INFO with contact info captured
  COLD → call completed but minimal info
  JUNK → JUNK classification OR <10s duration
```

## Where It's Used

- **Dashboard calls table** — color-coded tier badges on call rows
- **D220 lead queue** — HOT/WARM leads surfaced in dedicated follow-up view
- **D229 "call back now" button** — shows for HOT/WARM rows with phone number
- **D219 missed call auto-SMS** — fires for JUNK/short calls when phone known
- **Telegram alert** — lead tier included in notification format (6-section rich format for Windshield Hub)

## Key Files

- `src/app/api/webhook/[slug]/completed/route.ts` — classification prompt
- `src/components/dashboard/calls/` — calls table with tier badges
- `src/lib/notification.ts` — Telegram formatting

## D216 Migration (DONE 2026-03-31)
- Added `call_logs.lead_status` column (enum: HOT/WARM/COLD/JUNK)
- Added `campaign_leads.lead_status` column
- Both migrations applied to live DB

## Intent vs Classification Gap (D244)
Current classification tells us WHAT happened (booking/info/junk).
Missing: DID THE INTENT GET FULFILLED? A caller wanting booking who got info = missed conversion.
D244 adds `detected_intent` + `intent_fulfilled` to close this gap.
