---
type: decision
status: accepted
date: 2026-04-25
deciders: [Hasan]
related:
  - "[[Architecture/Dashboard-Hardening-Plan]]"
  - "[[Tracker/D286]]"
tags: [decision, demo, onboarding, brian-zinco]
---

# Brian Zinco demo — manual provision via live onboarding

## Context

Omar (Urban Vibe owner, 2026-04-25 phone call) flagged a 65-year-old property manager named **Brian Zinco** who would be a high-leverage demo recipient. Goal: Brian calls a phone number and experiences the AI agent firsthand.

Original plan in this chat: spin up an automated provisioning skill that scrapes Brian's website, configures the leasing-inquiry + maintenance scenarios, reuses an idle Twilio number, and hands a ready-to-test number back to Hasan.

## Decision

**Provision Brian manually by going through the live onboarding flow as a real client would.**

Hasan: "I want to provision Brian, who has a property management company, manually and see if everything works. I just want to make sure the system was able to do what it does. So maybe I'll go through a random test that way."

Reuse the **existing True Color Twilio number** (already attached to a previous prototype account; easy to repurpose).

## Why

- The onboarding flow IS the product. A scripted bypass would mask its real friction.
- Manual run = end-to-end smoke test of the path a real customer hits — especially Track 1's new Overview surface (Greeting + Voice + After-call SMS inline edit).
- True Color's old number is already on the account; no idle-inventory provisioning needed.
- Validates Phase 7 onboarding work indirectly (D291 GBP autocomplete, D292 forwarding wizard, D375 Zara WebRTC fix).

## Consequences

- No automated `calgary-property-leasing` provisioning skill is built tonight.
- Pricing copy ($100/mo entry tier) is **NOT** added to the landing page tonight (per Hasan: "We don't have to add any of that").
- This chat scope contracts to: Track 1 + Track 2 (Re-sync delete) + Track 3 (manifest primitive) + vault updates only.
- After Brian demo: feed back any onboarding friction to Phase 7 tracker (D291/D292/D316/D318 etc.).

## Open follow-ups for the post-demo retro

1. Did Greeting + Voice + After-call SMS show on Overview as the first edit surface?
2. Did the True Color number reuse have any drift (old prompt? old agent? old voice?)
3. Did the website scrape pull the rent guarantee facts cleanly?
4. Did the agent handle the "9302 98th Street NW, 3-bedroom" scenario (callback to caller phone, names "Brian")?
5. Did the agent handle the leak/maintenance scenario (route to "Eric")?
