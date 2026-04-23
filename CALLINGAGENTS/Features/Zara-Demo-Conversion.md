---
type: feature
status: active-gaps
tags: [feature, zara, demo, conversion, analytics]
related: [Tracker/D383, Tracker/D384, Tracker/D385, Tracker/D386, Tracker/D387, Tracker/D391, Tracker/D392]
updated: 2026-04-15
---

# Zara Demo Agent — Conversion System

## Current State (as of 2026-04-15)
- **Agent:** Zara — `unmissed-demo` slug, agent `74ccdadb`
- **Prompt:** ~3,500 words. NICHE KNOWLEDGE table. Feature showcase. Objection handling. DEMO MOMENT.
- **D375 fixed:** Zara now knows she's a browser widget when [DEMO MODE] in callerContext

## Conversion Data (all-time)
| Date | Caller | Duration | Converted |
|------|--------|----------|-----------|
| 2026-04-14 | Hasan (testing) | null | false |
| 2026-04-03 | +1306... | 11s | false |
| **2026-03-26** | **Emon +1403...** | **null** | **true ✅** |

Only 3 calls logged. One conversion. **Transcripts not stored — conversion path unknown.**

## Critical Gaps

### 1. No Transcript Storage (D383 — CRITICAL)
Ultravox records all calls. demo_calls table has no transcript column. We cannot study:
- What Zara said that converted Emon
- Where the 11-second drop-off happened
- Which objection handling lines work

Fix: store transcript JSONB in demo_calls via completed webhook.

### 2. SMS Is Still Permission-Seeking (D384)
Current: "Alright, hold on — I'm gonna send you a text right now"
Better: Just fire it. Say "I just sent you something while we're talking" AFTER the fact.
If phone not in context: ask for number immediately, don't offer as optional.

### 3. No ROI Anchor (D385)
Niche lines give cost-of-miss stats but don't personalize:
"shops miss 30-40% of calls — that's $200-400/day"
Better: calculate THEIR specific number.
"How many calls do you miss per week? ...At that rate, that's about $X/month in missed jobs vs $29/month for us."

### 4. No Returning Lead Path (D386)
Emon is converted=true. If he calls back:
- He hears the same cold opening
- There's no "hey you came back — let's get your trial set up"
Fix: check demo_calls for converted=true by caller phone → warm re-engagement opening

### 5. No Analytics (D387)
demo_calls currently tracks: demo_id, caller_name, caller_phone, duration, converted
Missing: niche_detected, demo_moment_fired, sms_sent, drop_off_step, feature_steps_shown, objections_raised

### 6. DEMO MOMENT Is One-Shot (D391)
"By the way — you're literally on a call with unmissed.ai right now" fires once.
If caller doesn't react, it's gone. Need a recovery:
"Like... the reason this works is — you're feeling exactly what your customers would feel when they call your business."

### 7. Flat Tone Across All Niches (D392)
Zara is "sharp and confident" for everyone.
- Dental/medical callers need warmer/slower
- HVAC/trades need direct/energetic  
- Legal needs credibility-first
Add NICHE_TONE variant that adjusts persona based on detected niche.

## What's Working Well
- The NICHE KNOWLEDGE table — industry-specific cost-of-miss lines are potent
- Objection handling coverage is solid
- The self-referential "you're on a call with unmissed.ai" DEMO MOMENT concept is powerful
- Feature showcase sequence (text → booking → transfer) is logical
- Founding member pricing + no-card trial is strong close

## Linked D-items
- [[Tracker/D383]] — Transcript storage
- [[Tracker/D384]] — Proactive SMS
- [[Tracker/D385]] — ROI calculator
- [[Tracker/D386]] — Returning lead path
- [[Tracker/D387]] — Analytics fields
- [[Tracker/D391]] — DEMO MOMENT recovery
- [[Tracker/D392]] — Niche-adaptive tone

[[Project/Index]]
