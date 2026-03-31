---
type: architecture
tags: [architecture, prompt, onboarding]
related: [Product/Onboarding Flow, Product/Intent Classification, Architecture/Mode Architecture]
source: src/lib/prompt-builder.ts, src/lib/template-body.ts
updated: 2026-03-31
---

# Prompt Generation Architecture

## Two Paths

### 1. Auto-generated (onboarding/provision)
`buildPromptFromIntake(intakeData)` → fills `PROMPT_TEMPLATE_INBOUND.md` sections
- Sources: niche, business_name, services, hours, FAQ pairs, mode
- Called by: `provision/trial/route.ts` at signup

### 2. Manual deploy
`PROVISIONING/app/deploy_prompt.py` — CLI tool
- Used for existing clients when prompt needs full rebuild
- **Must stay in sync with `buildPromptFromIntake()`** — known parity risk

## Template Structure (template-body.ts)
```
1. Identity / Greeting
2. CALL OPENING
3. ## TRIAGE          ← {{TRIAGE_SCRIPT}} — intent routing goes here
4. ## INFO COLLECTION ← name / phone / details
5. ## SCHEDULING
6. ## CLOSING
7. AFTER HOURS
8. ESCALATION/TRANSFER
9. RETURNING CALLER
10. INLINE EXAMPLES
11. ## CALL HANDLING MODE  ← {{CALL_HANDLING_MODE_INSTRUCTIONS}} — mode goes HERE (end)
```

## Critical Bug: Mode at End (D180 — FIXED partially)
Mode instruction is injected at the BOTTOM of the prompt.
TRIAGE section with detailed collection scripts is at position 3.
GLM-4.6 sees competing instructions — in long prompts, the earlier section (TRIAGE) wins unpredictably.

**Fix needed:** Mode instruction must be at the TOP, before TRIAGE.
Or: separate prompt templates per mode (no patches on universal template).

## Modes (clients.call_handling_mode)
| Mode | What it means | Triage behavior |
|------|---------------|-----------------|
| `message_only` | AI Voicemail — collect name/phone/message only | Should skip TRIAGE entirely |
| `info_hub` | Smart Receptionist — answer FAQs, qualify | Full TRIAGE + info collection |
| `booking` | Receptionist + Calendar | TRIAGE + booking flow |

## Key Files
- `src/lib/prompt-builder.ts` — buildPromptFromIntake()
- `src/lib/template-body.ts` — template sections
- `src/lib/prompt-patcher.ts` — post-provision patches (booking, voice, name, mode)
- `PROVISIONING/app/deploy_prompt.py` — CLI deploy (must stay in sync)
- `BUILD_PACKAGES/INBOUND_VOICE_AGENT/PROMPT_TEMPLATE_INBOUND.md` — canonical template

## Connections
- → [[Product/Intent Classification]] (TRIAGE section is the fix target)
- → [[Product/Onboarding Flow]] (onboarding data feeds buildPromptFromIntake)
- → [[Architecture/Mode Architecture]] (mode determines which sections render)
- → [[Architecture/Control Plane Mutation]] (post-provision: patchCalendarBlock, patchAgentName)
