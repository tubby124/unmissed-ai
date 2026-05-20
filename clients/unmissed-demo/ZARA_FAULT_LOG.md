# Zara Fault Log

| Date | Call/source | Symptom | Likely cause | Fix type | Action taken | Verification |
|---|---|---|---|---|---|---|
| 2026-05-20 | audit | Robotic and strict conversation style | Prompt too long and over-scripted | prompt | Zara v14 compression planned | pending |
| 2026-05-20 | audit | Legacy pricing present | Prompt and RAG drift | pricing/product truth | Replace prompt, local knowledge, seeded chunks, and add drift check | pending |
| 2026-05-20 | audit | Demo prompt references direct booking tools | Prompt does not match stage runtime | prompt/runtime truth | Use only transitionToBookingStage in triage prompt | pending |
| 2026-05-20 | audit | Demo can mention Telegram as if live | Demo row missing telegram_bot_token | runtime truth | Prompt says Telegram depends on setup until verified | pending |
| 2026-05-20 | audit | Public demo lacks queryKnowledge tool | Demo route only injects base demo tools | runtime/tooling | Add route-level RAG tool injection with approved chunk gate | pending |
