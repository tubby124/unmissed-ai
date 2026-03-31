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

## Open Issues
- D206 — Live quote lookup (HIGH priority — converts "Sabbir will call you" to booking)
- D215 — promptfoo spam/solicitor test fix (add solicitor rejection line to EDGE CASES)

## Connections
- → [[Features/Transfer]] (forwarding to Sabbir's cell)
- → [[Tracker/D206]] (live pricing feature)
