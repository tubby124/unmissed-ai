# Baseline Known Risks
_Frozen: 2026-03-18 — risks present before refactor begins_

## R1 — Monolith prompt-builder.ts (HIGH)

`agent-app/src/lib/prompt-builder.ts` is 2,439 lines. It contains:
- The full 22-variable template body (embedded string, ~300 lines)
- All 15 niche NICHE_DEFAULTS entries
- Insurance preset tables
- After-hours logic
- Transfer post-processing
- FAQ injection
- Validation logic
- SMS template builder

**Risk:** Any change to this file can silently affect all niches. No snapshot tests exist to catch regressions. Must add snapshot tests before any refactor of this file.

---

## R2 — Dual Prompt Truth (HIGH)

Prompts live in two places:
1. `clients/{slug}/SYSTEM_PROMPT.txt` — local file, source of truth for deploys
2. Supabase `clients.system_prompt` — live runtime source

If `deploy_prompt.py` is not run after editing the local file, the live agent runs stale content. If Supabase is edited directly (e.g., via Settings UI), the local file becomes stale.

**Current state of hasan-sharif specifically:**
- `SYSTEM_PROMPT.txt` = old prod prompt (v30 or earlier)
- `SYSTEM_PROMPT_TEST.txt` = v31 draft, NOT deployed
- **Do not deploy SYSTEM_PROMPT_TEST.txt without explicit instruction**

---

## R3 — No Capability Flags (HIGH)

Booking, transfer, and tool capabilities are assumed globally. The only guard is:
- `TRANSFER_ENABLED` — a string variable in the template ("true"/"false"), enforced by prompt text
- No code-level gate preventing a niche without booking from receiving booking instructions in the prompt

**Risk:** Adding booking to a voicemail-only client silently, or failing to strip booking language from a non-bookable niche.

Must be fixed in Phase 1A before any prompt refactor.

---

## R4 — property_management is Prompt-Only (HIGH)

Urban Vibe (property_management niche) handles:
- Maintenance request intake
- Viewing inquiries
- Billing questions
- Tenant routing

All of this is encoded in `triage_script_override`, `caller_faq`, and `agent_restrictions` in `config.json` — injected as text into the prompt. There is no structured data model, no tenant lookup, no request write path.

**Risk:** Agent can hallucinate tenant/unit data, cannot reliably distinguish emergency vs routine, cannot write structured requests to a system of record.

Phase 7 addresses this. Do not touch urban-vibe before that.

---

## R5 — Ultravox PATCH Wipes callTemplate (CRITICAL GOTCHA)

Ultravox PATCH is a full replace of `callTemplate`. If any field is omitted, it is silently wiped.

`deploy_prompt.py` always sends all required fields (voice, tools, model, maxDuration, firstSpeakerSettings, etc.) and does a post-PATCH read-back verification. **Never make a partial PATCH.**

If `updateAgent()` in `ultravox.ts` is refactored, it must also always send the full payload. This is documented in `memory/patterns.md` Gotcha #34.

---

## R6 — No Snapshot Tests for Prompt Output (HIGH)

Zero automated tests exist that:
- Generate a prompt from intake data
- Compare it against a known-good snapshot

Any refactor of `buildPromptFromIntake()` or `NICHE_DEFAULTS` could silently change prompt content without detection.

**Must add snapshot tests in Phase 2 before any prompt builder refactor.**

---

## R7 — PROVISIONING/app/prompt_builder.py Path is Stale (MEDIUM)

`CLAUDE.md` references `PROVISIONING/app/prompt_builder.py` as a key file.
Actual location: `archive/PROVISIONING/app/prompt_builder.py`

The directory `PROVISIONING/` does not exist at the project root. The Python build path is now superseded by the Railway-native `buildPromptFromIntake()` in `prompt-builder.ts`.

**Risk:** Confusion during onboarding or documentation about which builder is authoritative. TS version is authoritative for Railway. Python version in archive is reference-only.

---

## R8 — hasan-sharif Canary Split State (MEDIUM)

hasan-sharif has two local prompt files:
- `clients/hasan-sharif/SYSTEM_PROMPT.txt` — old prod (what is currently live on Supabase/Ultravox)
- `clients/hasan-sharif/SYSTEM_PROMPT_TEST.txt` — v31 draft (awaiting live call test results)

Do not:
- Delete `SYSTEM_PROMPT_TEST.txt`
- Run `deploy_prompt.py` for hasan-sharif during Phase 0

When v31 is approved: copy TEST → SYSTEM_PROMPT.txt, run `deploy_prompt.py`, then run promptfoo.

---

## R9 — manzil-isa on n8n Legacy (LOW for refactor, HIGH for ops)

manzil-isa is not managed by `deploy_prompt.py` or the Railway webhook system. It runs via a legacy n8n workflow (test mode). It is the ONLY remaining n8n voice client.

**Refactor impact:** Skip manzil-isa in all phases. Do not add it to the Agents API or Railway webhook system during this refactor without a separate explicit plan.

---

## R10 — Telegram chat IDs incomplete (LOW)

- windshield-hub: `telegram_chat_id = null` — Sabbir's chat ID not configured. Telegram alerts are not delivered.
- This is a known gap, not introduced by the refactor. Do not try to fix during Phase 0.
