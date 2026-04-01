---
type: architecture
title: "Phase 7 Fix Session — 2026-04-01 (Evening)"
status: documented
created: 2026-04-01
tags: [phase7, fixes, session-log, restaurant]
related:
  - "[[Architecture/Onboarding-Live-Test-2026-04-01]]"
  - "[[Architecture/Red-Swan-Pizza-Test-Call-Review]]"
---

# Phase 7 Fix Session — 2026-04-01 (Evening)

## What We Shipped (6 fixes, all on localhost)

### D352 — queryKnowledge lag fix ✅
- **File**: `src/lib/ultravox.ts` line 598
- **Change**: Added `defaultReaction: 'AGENT_REACTION_SPEAKS'` to queryKnowledge temporaryTool
- **Effect**: Agent now says "let me check on that..." while searching KB instead of dead silence
- **Deploy note**: Needs `syncClientTools()` or settings toggle to push to live agents

### D347 — CLOSE_PERSON fallback fix ✅
- **File**: `src/app/api/provision/trial/route.ts` line 91
- **Change**: `data.ownerName?.split(' ')[0]?.trim()` — no longer falls back to business name
- **Effect**: Won't get "Red" from "Red Swan Pizza" as CLOSE_PERSON. If no owner name, CLOSE_PERSON is omitted (prompt handles gracefully)

### D348 — .md file upload support ✅
- **Files changed (8 total)**:
  - `src/lib/knowledge-upload.ts` — ALLOWED_EXTENSIONS + extractText handler
  - `src/components/dashboard/knowledge/FileUploadPanel.tsx` — accept attr + ALLOWED_EXTS + 2 error messages
  - `src/app/api/dashboard/knowledge/upload/route.ts` — error message
  - `src/app/api/dashboard/knowledge/upload-preview/route.ts` — error message
  - `src/app/api/client/knowledge/upload/route.ts` — ALLOWED_TYPES + error message
- **Effect**: .md files treated as plain text (same as .txt path)

### D351 — Knowledge card per-source counts ✅
- **Files**: `src/app/api/dashboard/home/route.ts`, `src/components/dashboard/home/KnowledgeInlineTile.tsx`, `src/components/dashboard/ClientHome.tsx`
- **Change**: API now returns `source_counts: Record<string, number>` (e.g. `{ website_scrape: 15, compiled_import: 12 }`). KnowledgeInlineTile uses real counts instead of `isActive ? 1 : 0`
- **Effect**: Source list shows "15" for Website, "12" for AI Compiler instead of "1" everywhere

### Scrape status confusion fix (2c + 6c) ✅
- **File**: `src/components/dashboard/home/KnowledgeInlineTile.tsx`
- **Change**: GbpStrip badge now checks `websiteChunkCount > 0` — shows "15 pages imported" in green even when `website_scrape_status='extracted'`. Only shows amber "Pending" when chunks are actually zero.
- **Effect**: No more misleading "Pending" badge when knowledge is already live

### D354 — Unanswered Questions layout move ✅
- **File**: `src/components/dashboard/home/UnifiedHomeSection.tsx`
- **Change**: Moved `<UnansweredQuestionsTile>` from full-width TIER 4 (bottom) into center column of TIER 1 grid, directly below the TestCallCard orb
- **Effect**: See gap → answer it → re-test feedback loop. Old TIER 4 section removed.

## What We Investigated (no code changes needed)

| Item | Finding |
|------|---------|
| Test call logging (D353) | Already works — `agent-test/route.ts` line 143 inserts `call_logs` with `call_status='test'` and `callbackUrl` to completed webhook |
| Minutes tracking (D11) | Already works — completed webhook fires via `callbackUrl` in agent-test route |
| Hangup (D10) | Already works — call review shows `agent_hangup`. Built-in Ultravox `hangUp` tool registered via `HANGUP_TOOL` constant. 14+ prompt references in prompt-slots.ts |
| Prompt length (18K) | Already OK — `PROMPT_CHAR_TARGET=15000`, `PROMPT_CHAR_HARD_MAX=25000`. 18K passes with warning only |

## New D-Items Created

| # | Title | Priority | Status |
|---|-------|----------|--------|
| D357 | Greeting confidence for new onboardings — opening sounds robotic | HIGH | open |
| D358 | Inline variable editing from Overview/Knowledge — the "lego pieces" UI | HIGH | open |
| D359 | Smart KB→Prompt promotion — 3+ same queries → suggest adding to prompt | HIGH | open |
| D360 | Raise prompt limit — ALREADY AT 25K, no change needed | DONE | done |

## What's Still Open from Original 6 Waves

### Wave 2 — Remaining
- **D356** — Telegram notification preview on Overview (show what Telegram message WOULD look like)

### Wave 3 — Remaining
- **D346** — Upload CTA on Overview Knowledge card ("Upload menu / price list" button)
- **D355** — Quick-view modal for knowledge sources (click → see chunks inline)

### Wave 4 — Remaining
- **D350** — Knowledge source drawer expansion on Knowledge page (click handler exists but may not be working for all sources — needs testing)
- Knowledge page source counts vs Overview counts standardization

### Wave 5 — Remaining
- **D341 / D283b** — PromptVariablesCard (Settings UI) — **THIS IS THE BIG ONE**
  - Backend ready: variable registry (39 vars), `PATCH /api/dashboard/variables`, `recomposePrompt()`
  - Need: frontend component showing editable agent name, business name, opening line, close person, services, urgency triggers, NEVER rules
  - Gate: must go through `/ui-ux-pro-max` first (per `memory/feedback_ui_ux_pro_max_gate.md`)
- Specials gap — niche-specific FAQ prompts for common questions

### Wave 6 — Remaining
- **D349** — Extract ProcessingOrb from FloatingCallOrb for loading states
- **D345** — Intelligence seed loading indicator on Launch step

### "Haven't Thought About" Items (A-J from original doc)
- **A**: Day 2 experience — niche-adaptive setup progress
- **B**: Trial expiry UX — what happens day 7?
- **C**: Call forwarding wizard (D292) — #1 barrier to going live
- **D**: Structured order capture — machine-parseable orders
- **E**: Returning caller for restaurants — repeat orders within hours
- **F**: Peak hour concurrency — 5 callers at 6pm Friday
- **G**: Menu freshness — Today's Update for daily specials (feature exists, just needs prompting)
- **H**: Allergen liability — what agent says when asked "is this gluten-free?"
- **I**: "Pending" website review dead end — PARTIALLY FIXED (badge now shows correct status)
- **J**: Callback tracking (D220) — agent says "we'll call you back" but nothing tracks it

## User's Additional Requests (from session)

1. **Greeting confidence** → D357. The intelligence-generated GREETING_LINE is too templated. Needs more natural, confident delivery.

2. **Knowledge visibility** → The user wants ALL knowledge clearly shown to the end user so they can see what the agent knows (menu section, hours, constraints). Currently the KnowledgeInlineTile shows source cards with counts (fixed this session) and expandable chunk panels — but it's not intuitive enough. The user wants to see the data organized by CATEGORY (what it knows about hours, what it knows about menu, what it knows about policies) not by SOURCE (website vs AI compiler vs manual).

3. **Variable editing ("lego pieces")** → D358. Phase 6 built the prompt as composable slots with variables, but there's NO frontend to edit variables. User expects to edit agent name, business name, services, opening line, etc. from the dashboard. Backend exists (`PATCH /api/dashboard/variables`), frontend does not.

4. **Smart KB promotion** → D359. If agent queries pgvector 3+ times for same topic, suggest promoting to system prompt to eliminate latency.

5. **Prompt limit OK at 25K** → Already set. User prefers shorter prompts + KB queries over long inline prompts.

## Build Status
- `npx tsc --noEmit` passes (only pre-existing test file errors)
- All changes are on localhost, NOT committed
- Zero changes to live clients

## Next Session Priority Order
1. **D358 / D283b — PromptVariablesCard** — highest user frustration, backend ready
2. **D357 — Greeting confidence** — quick Haiku prompt improvement
3. **D346 — Upload CTA on Overview** — quick UI addition
4. **D356 — Telegram notification preview** — trust builder
5. **D359 — KB→Prompt promotion** — intelligence loop feature (bigger scope)
