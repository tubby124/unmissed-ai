---
type: architecture
title: "Test Call Review — Red Swan Pizza (Sofia) 2026-04-01"
status: documented
created: 2026-04-01
tags: [call-review, restaurant, knowledge, intelligence-pipeline]
related:
  - "[[Architecture/Onboarding-Live-Test-2026-04-01]]"
  - "[[Tracker/D340]]"
---

# Test Call Review — Red Swan Pizza (Sofia)

**Call ID**: 513c3578-97ce-431d-bc59-78bb7095c07d
**Medium**: WebRTC (browser test call from dashboard)
**End reason**: agent_hangup (agent closed after collecting order)
**Duration**: ~3 minutes

## Transcript Summary

1. Sofia opens with the intelligence-generated greeting (capability signal: orders, menu, delivery area)
2. Caller asks about specials → queryKnowledge returns empty → Sofia correctly says she doesn't have that info and offers callback
3. Caller asks about drink prices → **queryKnowledge finds exact prices** → Sofia reads them naturally
4. Caller asks about pepperoni slice → **queryKnowledge finds exact price ($4.75)** → Sofia gives clean answer
5. Caller places order (pepperoni slice, garlic bread, onion rings) → Sofia confirms, asks pickup/delivery
6. Caller asks total → **queryKnowledge finds appetizer prices** → Sofia calculates total ($18.73) correctly
7. Tax question → Sofia correctly says "before tax" and defers to team for final total
8. Collects name (Hassan), pickup time (now)
9. Closes with callback confirmation → agent_hangup

## What Worked Well

| Aspect | Rating | Notes |
|--------|--------|-------|
| Greeting | ✅ GREAT | Intelligence seed greeting, names business, signals capabilities |
| Knowledge retrieval | ✅ GREAT | 3 successful queryKnowledge calls — drinks, slices, appetizers all found with correct prices |
| Natural voice | ✅ GREAT | "gotcha", "four seventy-five", "i'll have the team call ya" — sounds human |
| Order flow | ✅ GOOD | Confirmed items, asked pickup/delivery, collected name and time |
| Price calculation | ✅ GREAT | Added 3 prices correctly ($4.75 + $5.99 + $7.99 = $18.73) |
| Tax handling | ✅ GOOD | Correctly said "before tax" — didn't make up a tax amount |
| NEVER rules | ✅ PASS | Didn't promise delivery time, didn't offer refunds |

## What Needs Improvement

| Issue | Severity | Details |
|-------|----------|---------|
| Specials gap | MEDIUM | No specials/promotions data uploaded → correct "I don't know" but this is the #1 question for restaurants. Should be in FAQ or knowledge. |
| Lag on knowledge queries | HIGH | User reported noticeable lag when Sofia pauses to search knowledge. The tool call takes 1-2 seconds. See D352. |
| No order read-back before close | MEDIUM | D343 added the read-back instruction to the seed, but this call was on the OLD prompt (before the fix was deployed). New agents will have it. |
| "the team'll call ya back" | LOW | Should say owner's name (but CLOSE_PERSON = "Red" — D347 bug). Would sound better as "I'll have Red call ya back" if name were correct. |
| Call not logged | HIGH | WebRTC test calls from dashboard don't appear in call_logs. User can't see test call history or transcript in the dashboard. D353. |
| No Telegram notification | MEDIUM | Test user didn't set up Telegram, but the system should at least show what the notification WOULD look like as a preview. |

## Knowledge Query Performance

| Query | Found? | Latency feel | Source |
|-------|--------|-------------|--------|
| "current specials promotions deals offers" | ❌ No results | Fast (empty) | — |
| "drink prices soft drinks beverages cost" | ✅ 1 result | Noticeable lag | compiled_import |
| "pepperoni slice price single slice cost" | ✅ 2 results | Noticeable lag | compiled_import |
| "garlic bread price onion rings price sides cost" | ✅ 1 result | Noticeable lag | compiled_import |

## D340 Verdict: PASS ✅
The agent successfully answered menu/price questions using uploaded knowledge. The intelligence pipeline + knowledge pipeline work end-to-end. The gaps are UX (lag, logging, notifications) not data.
