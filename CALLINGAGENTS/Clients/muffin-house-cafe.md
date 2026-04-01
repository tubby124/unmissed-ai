---
type: client
slug: muffin-house-cafe
status: active (trial)
niche: restaurant
agent_name: Sofia
ultravox_agent_id: 8a97e54c-9a29-42e2-9b19-b9a68a04fc28
agent_voice_id: aa601962-1cbd-4bbd-9d96-3c7a93c3414a
voice_name: Jacqueline
plan: core
created: 2026-04-01
trial_expires: 2026-04-08
contact_email: muffin.house.test@unmissed.ai
updated: 2026-04-01
tags: [test-client, restaurant, gbp-test, phase6-test]
---

# Muffin House Cafe

> **Purpose:** End-to-end onboarding test for Phase 6 prompt architecture. First client provisioned through the NEW `buildPromptFromIntake()` pipeline with 19 named slots, variable registry, and section markers.

## Test Context
- **Real business:** Muffin House Cafe, 6 locations in Massachusetts (Hopkinton, Medway, Mendon, Natick, Walpole, Westwood)
- **GBP data:** 4.4 stars, 326 reviews, photo URL from Google Places API
- **Website:** https://www.muffinhousecafe.com/westwood
- **Niche auto-detected:** `restaurant` from GBP types `cafe`, `food`
- **Agent name default:** Sofia (restaurant niche default)

## Architecture Verification

### What passed
- 15 named slots generated via `buildPromptFromIntake()`: safety_preamble, forbidden_actions, voice_naturalness, grammar, identity, tone_and_style, goal, conversation_flow, after_hours, escalation_transfer, returning_caller, inline_examples, call_handling_mode, faq_pairs, knowledge
- `{{callerContext}}`, `{{businessFacts}}`, `{{contextData}}` template placeholders present on Ultravox agent
- 2 tools registered (hangUp + queryKnowledge)
- Trial mode active (180s max duration)
- knowledge_backend = pgvector
- Auth user created, password set

### What failed (bugs found → fixed)
1. **GBP provenance save failed silently** — `void` fire-and-forget in provision route. Fixed: [[Tracker/D311]]
2. **Website scrape returned no content** — scraper timed out or failed on muffinhousecafe.com. Not fixed (scraper reliability, not architecture)
3. **business_facts = null** — no knowledge extracted (no scrape, no GBP description, no manual FAQ). Manually seeded via SQL.
4. **Prompt = 16,651 chars** — over 12K target. Allowed because S12-V18-BUG7 changed hard max to warning.

## Login
- **Email:** muffin.house.test@unmissed.ai
- **Password:** QWERTY123
- **Dashboard:** http://localhost:3001/dashboard (dev)

## GBP Data (manually saved)
- place_id: ChIJiXh9eeeB5IkR0XfHuufzYQM
- rating: 4.4
- review_count: 326
- photo_url: (Google Places reference)
- business_facts: 4 facts about locations, hours, specialty, custom cakes
