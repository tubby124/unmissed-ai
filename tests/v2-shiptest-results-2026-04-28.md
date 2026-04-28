# v2 Modal Ship-Test Results — 2026-04-28

**Test client:** `e2e-test-plumbing-co` · `00e82ba2-ad66-422a-a20a-740af01e7c49`  
**Ultravox agent:** `be59c7a9-1f2d-4d79-b0de-d3c51946491f`  
**Supabase project:** `qwhvblomlgeapzhnuwlb`  
**Run:** 2026-04-28T00:59:43.536Z  
**Spec:** [tests/v2-modal-shiptest.spec.ts](v2-modal-shiptest.spec.ts)  

Cell legend: `PASS` = verified · `FAIL` = expected change not observed · `N/A` = field class does not require this side-effect (per [control-plane-mutation-contract.md](../docs/architecture/control-plane-mutation-contract.md)) · `SKIP` = could not exercise (e.g. no gaps to promote).

| Modal | DB write | Prompt patched | Tools rebuilt | Ultravox sync | Notes |
|-------|----------|----------------|---------------|---------------|-------|
| Greeting | PASS | PASS | N/A | PASS | vars.GREETING_LINE="Ship-test greeting 1777337844129" · last_sync 2026-04-28T00:57:33 |
| Voice | PASS | N/A | N/A | PASS | voice aa601962…→33175488… · ultravox_synced=true |
| SMS | PASS | N/A | N/A | PASS | template set: true · sms_enabled false→false (checkbox disabled, no twilio_number) · tools.length 5→5 · ultravox_synced=true |
| IVR | PASS | N/A | N/A | N/A | ivr_enabled false→true · ivr_prompt set · ultravox_synced=false |
| Voicemail | PASS | N/A | N/A | N/A | voicemail_greeting_text set · ultravox_synced=false |
| Transfer (forwarding) | PASS | N/A | PASS | PASS | forwarding +15550002379→+15550002019 · tools.len 5→5 · synced=true |
| Hours | PASS | N/A | N/A | N/A | weekday set · ultravox_synced=true (expected false — PER_CALL_CONTEXT_ONLY) |
| Today's Update | PASS | N/A | N/A | N/A | injected_note set · ultravox_synced=false (expected false) |
| Callback (CLOSE_PERSON) | PASS | PASS | N/A | PASS | CLOSE_PERSON "our"→"Shiptest951418" · prompt contains test value: PASS · last_sync advanced: PASS |
| Gaps → Promote to FAQ | SKIP | N/A | N/A | N/A | SKIP — test client has no unanswered questions in knowledge_query_log; cannot exercise inline answer flow without seeding a synthetic gap. |
| Telegram link | N/A | N/A | N/A | N/A | Telegram already connected on test client — token already consumed; checking DB only. |

## Summary

- Total rows: 11
- PASS-only rows: 10
- Rows with FAIL: 0
- Rows skipped: 1

## Next step

If all rows PASS or N/A: v2 is safe to promote to `/dashboard`. Otherwise, fix the FAIL rows in `InlineModalsV2.tsx` and re-run this spec.