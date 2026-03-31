---
type: decision
date: 2026-03
status: approved
tags: [decision, voice, prompt]
related: [Clients/urban-vibe, Clients/hasan-sharif]
---

# Decision: Voice/Tone Identity is Locked Per Client

## Rule
NEVER change voice_id, agent name, tone, or personality without:
1. Explicit user confirmation
2. Using --voice flag in prompt-deploy

## Why
Ray (Urban Vibe) personally selected Ashley's voice. Tone drift after a prompt change caused friction.
Hasan's Monika voice is specifically chosen for real estate warmth.

## Enforced By
- memory/feedback_voice_personality_lock.md
- memory/feedback_urban_vibe_voice_lock.md

## Affected Clients
- [[Clients/urban-vibe]] — Ashley `df0b14d7` — Ray sensitive to any change
- [[Clients/hasan-sharif]] — Monika `87edb04c` — never change without explicit ask
