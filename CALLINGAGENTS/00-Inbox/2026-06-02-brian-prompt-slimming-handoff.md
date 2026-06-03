---
type: session-handoff
status: ready
created: 2026-06-02
target_client: calgary-property-leasing
target_agent: Eric
target_owner: Brian
related:
  - Clients/calgary-property-leasing
  - Architecture/prompt-architecture-execution-plan
tags:
  - prompt-slimming
  - phase-6
  - slot-pipeline
---

# Handoff — Brian's Eric Prompt Slimming (Next Session)

## Why now
Brian is the only paying customer (trialing, expires 2026-06-15). His Eric prompt is **22,922 chars** — almost 2x the 12K hard max from [memory/glm46-prompting-rules.md](memory/glm46-prompting-rules.md). Bloat is suspected contributor to topic-presumption bug (74% of returning-caller short calls had presumptive openers system-wide). Slim it, then validate behavior on next live call.

## What was just shipped (2026-06-02)
- Commit `9ae6548d` on main: classifier no longer dumps real humans into JUNK. See [[Clients/calgary-property-leasing#2026-06-02 — JUNK classifier fix shipped + prompt-slimming queued]].
- Railway auto-deploy in progress at session-end. Next call on Brian's line should classify and summarize cleanly.

## Plan for this session — follow the slot pipeline

Hasan's direction: *"we gotta follow the slot pipeline like it literally works even with all these words but gotta do full audit."* So this is not a surgical trim — it's a per-section audit comparing current Eric prompt against what `recomposePrompt()` would produce, with explicit decisions on what to keep / compress / drop / move-to-runtime-context.

### Step 1 — Pull current Eric prompt + diff against slot pipeline
1. Read `clients.system_prompt` for `id=2c186f70-84cc-4253-a3ab-6cd0e9064d39` from prod Supabase
2. Compare against output of `recomposePrompt()` (Phase 6 Wave 1 backend, [src/lib/recompose-prompt.ts]) fed with Brian's current `clients` row intake fields
3. Section-by-section diff: identity / safety / scope / triage / knowledge / closing / hangup rules

### Step 2 — Per-section audit table
For each section in current prompt, classify as:
- **KEEP verbatim** (hand-tuned win, not in slot defaults)
- **REPLACE with slot default** (slot output is equivalent or better)
- **COMPRESS** (current is verbose, condense to slot-style brevity)
- **MOVE to runtime context** (per-call data leaked into stored prompt — should be injected via `callerContextBlock` / `businessFacts` / `contextData`)
- **DROP** (dead text, duplicate, hallucinated FAQ, hours block that's now in `business_hours_*`, etc.)

Build the table in markdown so Brian's revision is auditable. Save to `CALLINGAGENTS/00-Inbox/2026-06-XX-brian-prompt-audit.md` when done.

### Step 3 — Sacred sections (preserve)
| Section | Why sacred |
|---|---|
| LIFE SAFETY EMERGENCY OVERRIDE (911) | Cannot be overridden by any prompt change. Required by safety preamble. |
| "Never say you are an AI unless directly asked" | Brian's tone preference, baked into persona anchor. |
| SCOPE rules (no unit-specific rent, no RTA legal advice, no transfer) | Liability — Brian's lawyer would lose it. |
| Returning-caller name use (greet by name) | Hasan's tone preference across all clients. |
| `submitMaintenanceRequest` tool flow + severity triage | Active feature, registered on Ultravox agent. |

### Step 4 — Bug 3 fix candidate
Eric's RETURNING CALLER greeting currently re-uses last call summary as the opener topic — e.g. *"hey Fred ... following up on that wire transfer for 940 Nolan Hill Boulevard?"* This is system-wide (74% of returning short calls). Add a slot rule:
> When greeting a returning caller, acknowledge familiarity by name but ALWAYS ASK why they're calling. Never presume the topic from the prior call summary — the topic in `RETURNING CALLER` context is reference only.

Test target: returning callers should hear *"hey Fred, good to hear from you — what's going on today?"* not *"following up on that wire transfer?"*

### Step 5 — Target size
- Aim under **12K chars** (hard max from glm46-prompting-rules)
- Stretch goal: **8K chars** (Hasan's lean real_estate baseline)
- 22.9K → 10K = ~57% cut. Realistic given Phase 6 slot pipeline produces ~6-8K base before knowledge injection.

### Step 6 — Deploy gate
1. Browser-test the slimmed prompt via `POST /api/dashboard/browser-test-call` (slot=draft path) — no live impact, no billing.
2. Run a simulated returning-caller turn: confirm Eric greets warmly + asks, not presumes.
3. Run a maintenance-emergency turn: confirm SAFETY override + severity triage still fire.
4. Once happy → `/prompt-deploy calgary-property-leasing` to sync to Ultravox agent.
5. Watch `notification_logs` for Brian's next live call. Re-pull `/calls calgary-property-leasing 7d` after 24h to confirm JUNK rate dropped.

## Reference docs (read before starting)
- [memory/glm46-prompting-rules.md](memory/glm46-prompting-rules.md) — MANDATORY before any prompt edit. 12K hard max, rules 12-14, repetition loop risk.
- [docs/architecture/prompt-architecture-execution-plan.md](docs/architecture/prompt-architecture-execution-plan.md) — Phase 6 Wave 1 (D280 recomposePrompt) is shipped and usable.
- [src/lib/recompose-prompt.ts] — slot pipeline output
- [src/lib/prompt-slots.ts] — 21 composable slots
- [src/lib/prompt-patcher.ts] — for surgical section replacements (alternative path if full recompose is too risky)
- [.claude/rules/prompt-edit-safety.md] — never paste prompt manually if /prompt-deploy exists, never claim live until sync confirmed.

## Don't forget
- **Cache-break protection**: do NOT edit CLAUDE.md, .mcp.json, or settings.json mid-session.
- **No redeployment** to hasan-sharif, exp-realty, windshield-hub, urban-vibe (standing rule). calgary-property-leasing is explicitly allowed.
- **Trial status**: Brian's clock runs out 2026-06-15. If prompt change breaks calls, that's a paid-customer trust loss. Test before deploy.

## Session-start command
```
Resume Brian's Eric prompt slimming per [[2026-06-02-brian-prompt-slimming-handoff]].
Pull current prompt from Supabase, diff against recomposePrompt() output, build per-section audit table.
Target under 12K chars. Preserve safety + SCOPE + maintenance tool flow.
```
