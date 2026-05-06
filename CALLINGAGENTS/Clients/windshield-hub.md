---
type: client
status: active
slug: windshield-hub
ultravox_agent_id: 00652ba8
voice_id: b28f7f08
plan: core
tags: [client, auto-glass]
related: [Features/SMS, Features/Transfer]
updated: 2026-03-31
---

# Windshield Hub — Mark / Sabbir (Auto Glass)

## Identity
| Field | Value |
|-------|-------|
| Slug | `windshield-hub` |
| Ultravox Agent | `00652ba8` |
| Voice | Blake `b28f7f08` (Cartesia) |
| Plan | Core |
| Niche | `auto_glass` |

## Active Features
- [ ] Booking
- [x] SMS → [[Features/SMS]]
- [x] Transfer → [[Features/Transfer]]
- [ ] IVR
- [x] Knowledge RAG → [[Features/Knowledge RAG]]

## Prompt Notes
- Telegram format: 6-section rich format for Sabbir (see `memory/auto-glass-telegram-format.md`)
- D206: Live quote lookup feature planned — price range toggle ("$250-400 for most sedans")

## D445 Migration — APPLIED 2026-05-06 02:46:44 UTC ✅
- ✅ Phase A dryrun: 8,586 → 14,526 chars (+69%)
- ✅ Phase B backfill: `services_offered` (14 services), `fields_to_collect` (5 fields)
- ✅ Promptfoo 26-scenario battery: staged 23/26 (88.5%) > baseline 21/26 (80.8%). Fixed Google Ads spam, chip triage, closing flow, SGI routing.
- ✅ Real-call study: 20 production calls analyzed at `CALLINGAGENTS/00-Inbox/windshield-real-calls-study.md`. Patterns mined into promptfoo.
- ✅ **Phase E APPLIED**: prompt_versions v29 id `7fd3e4c7-3216-4078-aa1a-967cab3e26df`. system_prompt now 14,526 chars. Ultravox PATCHed: "Sabbir"=0, "the team"=20 occurrences. hand_tuned=true preserved.
- ✅ Active pointer manually fixed (`active_prompt_version_id` → v29). Filed `Tracker/D-NEW-recompose-active-pointer.md` for code fix.
- ✅ **Phase F validated 2026-05-06** — Hasan made post-migration test calls. Result: "works perfect tbh."
- ✅ **Phase G applied 2026-05-06** — `hand_tuned=false`. Mark now fully self-serve: dashboard edits auto-regenerate the right slot section on next save. Burn-in window waived per Hasan ("just flip it"). System prompt untouched at 14,526 chars.

## Rollback (emergency)
Pre-deploy snapshot: `docs/refactor-baseline/snapshots/2026-04-30-pre-d442/windshield-hub-system-prompt-pre-d445-2026-05-06.txt`
Prior version row: v28 id `09e07a3c-d936-40a9-b060-f451c9a622e9`
SQL: see [scripts/phase-e-windshield-apply.ts](../../scripts/phase-e-windshield-apply.ts) output

## Open Issues
- D206 — Live quote lookup (HIGH priority — converts "the team will call you" to booking)
- D215 — promptfoo spam/solicitor test fix (add solicitor rejection line to EDGE CASES)

## Connections
- → [[Features/Transfer]] (forwarding to Sabbir's cell)
- → [[Tracker/D206]] (live pricing feature)
