---
type: decision
status: locked
tags: [onboarding, telephony, gsm, blocker]
related:
  - Product/Concierge-Onboarding-SOP
  - Clients/calgary-property-leasing
  - Clients/velly-remodeling
  - Architecture/Control-Plane-Mutation-Contract
updated: 2026-04-29
---

# Decision — Carrier Voicemail Must Be Fully Removed Before Conditional CF Will Fire

## Context

Hasan was setting up call forwarding on his second Rogers line (403-808-9705) so that unanswered calls would route to his AI receptionist Aisha (`+15877421507` Twilio DID for the `hasan-sharif` client). The standard GSM conditional CF codes returned "Setting Activation Succeeded":

```
*61*15877421507#     ← no answer
*67*15877421507#     ← busy
*62*15877421507#     ← unreachable
```

But test calls always went to Rogers carrier voicemail instead of Aisha. The forward was set on the line but never fired.

## Investigation (validated 2026-04-29)

Two Perplexity Sonar Pro queries plus live testing confirmed:

1. **Carrier voicemail and conditional CF share the same GSM supplementary service slot** (CFNRy / CFB / CFNRc). Voicemail registers as the network's no-answer handler at provisioning time. The `*61` rule is accepted at the iOS/RILD layer (hence "Setting Activation Succeeded") but voicemail is already sitting in that slot and wins on every unanswered call.

2. **Rogers documentation explicitly states:** *"Conditional forwarding will not work when voicemail is activated."*

3. **Why Hasan's 306-850-7687 line worked all along:** voicemail was never enabled on that line. He had no `*611` voicemail box — the slot was empty so his `*61` forward owned it.

4. **Why the 403 line failed despite the codes succeeding:** that line had Rogers Business voicemail provisioned at activation. The voicemail box owned the slot.

## What does NOT work

| Attempted fix | Why it failed |
|---|---|
| iOS Settings → Phone → Visual Voicemail off | iOS layer only — the carrier voicemail box on the network is still alive |
| Resetting voicemail PIN/messages | Reset clears content; does NOT release the supplementary service slot |
| `*61*[NUMBER]**5#` ring-time race trick | Voicemail wins the slot regardless of timer; also frequently rejected with "Error performing request" on Rogers Business lines |
| `*98` voicemail-deactivate code | Only mutes notifications on most Rogers regions |
| MyRogers app voicemail toggle | Disables Visual Voicemail UI only on most plans, not the underlying box |
| Setting `*21*` unconditional forward instead | Bypasses voicemail (different slot) BUT phone never rings — every call goes straight to AI. Wrong UX for personal lines that need to ring the owner first. |

## Decision

**Voicemail removal at the carrier server level is a non-skippable client onboarding step** for any unmissed.ai client whose phone forwards to their AI receptionist DID. Not paused. Not muted. Not reset. **Removed.**

## How to apply

1. Client calls their carrier (numbers below)
2. Says, word-for-word: *"Please fully remove voicemail from this line. Not reset — delete the voicemail box from my line profile. I'm using a third-party answering service and the carrier voicemail is blocking my conditional call forwarding."*
3. Waits for agent confirmation: *"Voicemail has been removed."*
4. Then dials `*61*1[AI_DID]#`, `*67*1[AI_DID]#`, `*62*1[AI_DID]#` (or combo `**004*1[AI_DID]#`)
5. Tests by calling the line from another phone, letting it ring out unanswered → AI receptionist must answer

**Once voicemail is removed, any previously-set conditional CF rules start firing automatically.** No need to re-dial the codes.

## Carrier support numbers

| Carrier | Number |
|---|---|
| Rogers Consumer | `1-800-764-3771` (or `*611` from cell) |
| Rogers Business | `1-866-727-2141` |
| Bell | `1-800-668-6878` |
| Telus | `1-866-558-2273` |
| Fido | `1-888-481-3436` |
| SaskTel | `1-800-727-5835` |

## Where this is enforced

- [[Product/Concierge-Onboarding-SOP]] Step 6a — mandatory pre-step before forwarding codes
- [src/components/dashboard/go-live/CallForwardingCard.tsx](src/components/dashboard/go-live/CallForwardingCard.tsx) — collapsible "Test went to voicemail instead?" disclosure with carrier numbers
- Brian's welcome email ([clients/calgary-property-leasing/welcome-email-brian.html](clients/calgary-property-leasing/welcome-email-brian.html)) — amber callout under Step 1
- Velly's welcome email ([clients/velly-remodeling/welcome-email-kausar.html](clients/velly-remodeling/welcome-email-kausar.html)) — same callout pattern
- Memory: [memory/voicemail-removal-required-for-cf.md](memory/voicemail-removal-required-for-cf.md)
- Global Hasan memory: `~/.claude/projects/-Users-owner/memory/unmissed-carrier-voicemail-removal.md`

## Future client-facing improvements (not blocking)

- [ ] Add a `voicemail_removal_confirmed` boolean to `clients` table; surface as a checkbox in the Go Live page so clients self-attest before the "Forward your phone" step unlocks
- [ ] Add a Telegram-bot or webhook endpoint clients can ping to confirm voicemail is removed (drives the boolean above)
- [ ] Surface as a toast on the Go Live page if `forwarding_self_attested=true` AND the verify-call test never fires successfully → "Did your test call go to voicemail? Read this." (links to the disclosure)

## Related D-items

- D292 — Guided call forwarding wizard (carrier-specific steps + test button) → this Decision must inform the wizard's UX
- D170 — Inbound SMS reply visibility (related telephony pain point)

## Lesson for future Hasan + future Claude

Don't trust "Setting Activation Succeeded" as proof a forward will fire. The carrier accepting the rule at the supplementary service layer is necessary but not sufficient — the slot must also be free. Voicemail provisioning is the most common reason it isn't.
