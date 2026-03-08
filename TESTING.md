# Call Simulation Testing — unmissed.ai

## What This Is

A fake-transcript pipeline that exercises the full call-completion flow:
**OpenRouter classify → Supabase write → Telegram alert** — without needing a real phone call or Ultravox session.

## Endpoint

```
POST /api/debug/simulate-call
Authorization: Bearer <ADMIN_PASSWORD>
Content-Type: application/json
```

**Body:**
```json
{
  "slug": "hasan-sharif",
  "caller_phone": "+14031234567",
  "duration_seconds": 120,
  "transcript": [
    { "role": "agent", "text": "Thank you for calling..." },
    { "role": "user",  "text": "Hi I need..." }
  ]
}
```

**Response:**
```json
{
  "ok": true,
  "fake_call_id": "sim-<uuid>",
  "supabase_row_id": "<uuid>",
  "classification": {
    "status": "HOT",
    "summary": "...",
    "serviceType": "follow_up",
    "confidence": 92,
    "sentiment": "positive",
    "key_topics": ["urgent callback", "offer deadline"],
    "next_steps": "Call Sarah back before 5 PM.",
    "quality_score": 88
  },
  "telegram_sent": true,
  "transcript_messages": 5
}
```

---

## Bug Fixed During Initial Testing (2026-03-08)

**Root cause:** OpenRouter routes `anthropic/claude-haiku-4.5` through Amazon Bedrock,
which ignores `response_format: { type: "json_object" }` and wraps responses in
markdown fences. `JSON.parse` was failing on every real call, causing all calls
to classify as UNKNOWN.

**Fix:** `src/lib/openrouter.ts` — strip fences before `JSON.parse`:
```ts
const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
```

**Impact:** All real call classifications were silently UNKNOWN before this fix.

---

## Test Scenarios — Hasan Sharif (hasan-sharif)

Run all with:
```bash
PASS=COOLboyAdmin2026
BASE=https://unmissed-ai-production.up.railway.app/api/debug/simulate-call
```

### HOT — Urgent offer callback
```bash
curl -s -X POST $BASE -H "Authorization: Bearer $PASS" -H "Content-Type: application/json" \
  -d '{
    "slug": "hasan-sharif",
    "caller_phone": "+14035550001",
    "duration_seconds": 185,
    "transcript": [
      {"role":"agent","text":"Thank you for calling, this is Aisha."},
      {"role":"user","text":"Hi I need Hasan urgently. We put in an offer and the deadline is 6 PM today. Need a callback now."},
      {"role":"agent","text":"Flagging this as urgent. Can I get your name and number?"},
      {"role":"user","text":"Sarah Khan, 403-555-0192. Please have him call before 5 PM."},
      {"role":"agent","text":"Got it Sarah, Hasan will call you before 5 PM today."}
    ]
  }'
```
Expected: `status=HOT, confidence≥80, telegram=⚡ ACTION REQUIRED`

### WARM — Spring listing commission inquiry
```bash
curl -s -X POST $BASE -H "Authorization: Bearer $PASS" -H "Content-Type: application/json" \
  -d '{
    "slug": "hasan-sharif",
    "caller_phone": "+14035550002",
    "duration_seconds": 95,
    "transcript": [
      {"role":"agent","text":"Thank you for calling, this is Aisha."},
      {"role":"user","text":"Yeah I was wondering what commission Hasan charges. Thinking about listing in the spring."},
      {"role":"agent","text":"Hasan would love to walk you through that. Can I take your name and number?"},
      {"role":"user","text":"Dave, 403-555-0193. No rush, just exploring options."}
    ]
  }'
```
Expected: `status=WARM, confidence 50-79, telegram=🟡 WARM LEAD`

### COLD — Vague check-in, no contact left
```bash
curl -s -X POST $BASE -H "Authorization: Bearer $PASS" -H "Content-Type: application/json" \
  -d '{
    "slug": "hasan-sharif",
    "caller_phone": "+14035550003",
    "duration_seconds": 30,
    "transcript": [
      {"role":"agent","text":"Thank you for calling. How can I help?"},
      {"role":"user","text":"I was just calling to see if Hasan is still doing real estate."},
      {"role":"agent","text":"Yes, Hasan is active in Saskatoon and Calgary. Can I take your name?"},
      {"role":"user","text":"No its okay, I will call back later. Bye."}
    ]
  }'
```
Expected: `status=COLD, confidence 20-49, telegram=❄️ COLD`

### JUNK — Wrong number
```bash
curl -s -X POST $BASE -H "Authorization: Bearer $PASS" -H "Content-Type: application/json" \
  -d '{
    "slug": "hasan-sharif",
    "caller_phone": "+14035550004",
    "duration_seconds": 12,
    "transcript": [
      {"role":"agent","text":"Thank you for calling Hasan Sharif Real Estate."},
      {"role":"user","text":"Oh sorry, I was trying to reach the pizza place. Wrong number."}
    ]
  }'
```
Expected: `status=JUNK, confidence≥85, telegram=🗑️ JUNK`

### UNKNOWN — Silence / empty
```bash
curl -s -X POST $BASE -H "Authorization: Bearer $PASS" -H "Content-Type: application/json" \
  -d '{
    "slug": "hasan-sharif",
    "caller_phone": "+14035550005",
    "duration_seconds": 5,
    "transcript": [
      {"role":"user","text":"..."}
    ]
  }'
```
Expected: `status=UNKNOWN, telegram=⚠️ UNKNOWN`

---

## First Run Results (2026-03-08)

| Scenario | Expected | Got | Confidence | Telegram |
|----------|----------|-----|------------|----------|
| Urgent offer callback | HOT | **HOT** ✅ | 92% | ✅ |
| Spring listing inquiry | WARM | **WARM** ✅ | 68% | ✅ |
| Vague check-in | COLD | **COLD** ✅ | 35% | ✅ |
| Wrong number | JUNK | **JUNK** ✅ | 99% | ✅ |
| Silence | UNKNOWN | **UNKNOWN** ✅ | 0% | ✅ |

All 5 scenarios classified correctly. Full pipeline confirmed working end-to-end.

---

## Adding New Test Scenarios

As real calls come in with new patterns (price objections, bilingual callers,
voicemails, aggressive callers, Spanish speakers, etc.), add them here with:
1. The real transcript (sanitize PII — first name only, no full phone numbers)
2. The expected classification and why
3. Run it through simulate-call to verify

---

## Planned: Self-Healing Test Suite

See roadmap in `SELF_HEALING_ROADMAP.md` (coming soon):
- Supabase `test_scenarios` table — versioned transcript library per client
- `/api/debug/run-test-suite` — batch runner, pass/fail report
- Daily CRON: analyze last 50 real calls for patterns + generate optimization recommendations
- Admin dashboard `/admin/test-lab` — run suite, view history, approve prompt changes
- Auto re-test after any prompt update to verify improvement
