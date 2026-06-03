---
type: prompt-audit
status: ready-for-edits
created: 2026-06-02
target_client: calgary-property-leasing
target_agent: Eric
target_owner: Brian
current_chars: 22922
preview_chars: 24303
target_chars: 11800
hard_max_chars: 12000
stretch_target_chars: 8000
related:
  - "[[2026-06-02-brian-prompt-slimming-handoff]]"
  - "[[Clients/calgary-property-leasing]]"
  - "[[Architecture/prompt-architecture-execution-plan]]"
  - "[[memory/glm46-prompting-rules]]"
tags:
  - prompt-slimming
  - phase-6
  - slot-pipeline
  - property-management
---

# Brian (Eric) — Prompt Audit & Slim Plan

## Baseline measurements (2026-06-02)

| Source | Chars | Status |
|---|---:|---|
| DB `clients.system_prompt` (live) | 22,922 | drift from May trim baseline |
| `recomposePrompt()` dryrun | 24,303 | **slot pipeline produces MORE than live** |
| May 2026-05-05 PR #78 trim baseline | 18,998 | regressed +4K via faq_pairs + forbidden_actions regrow |
| GLM-4.6 hard max (memory/glm46-prompting-rules.md) | 12,000 | handoff target — **doable** |
| GLM-4.6 stretch (real_estate baseline) | 8,000 | aggressive — possible if conversation_flow rewritten |

**Why preview is bigger than live:** the slot pipeline reseeded `faq_pairs` (115 → 1,496 chars) from `clients.extra_qa`. The live prompt was patched (likely via D305 `recomposePrompt` previously then `extra_qa` edited without re-running through the slot pipeline). Either way — faq_pairs do not belong in stored prompt (per-call-context-contract: `extra_qa` injects via `businessFacts` templateContext at call time, NOT into `system_prompt`).

## Per-section audit table

Sections sorted by current size descending. Sacred = MUST preserve verbatim per handoff. Action follows the handoff's 5 verbs: KEEP / REPLACE / COMPRESS / MOVE / DROP.

| # | Section | Current | Target | Δ | Sacred | Action | Reason |
|---|---|---:|---:|---:|:---:|---|---|
| 1 | `conversation_flow` | 9,892 | 3,500 | -6,392 | partial | **COMPRESS** | 13 TRIAGE branches → 6 categories sharing one closing pattern. Move bridge phrases (3 duplications) to a single voice_naturalness line. Drop INTERNAL P1 trigger list (duplicate of forbidden #13/#15). Keep: GREETING verbatim, 911 line verbatim, submitMaintenanceRequest flow, urgency_tier mapping. |
| 2 | `forbidden_actions` | 5,835 | 1,800 | -4,035 | yes | **COMPRESS + merge dup rules** | 25 rules → 8 grouped (May trim baseline was 6). Rules 18-25 are 8 restatements of existing rules. Merge: 18+22 (rate guarantees), 19+23 (background checks), 20+24 (RTA advice), 21 → in SCOPE rule 12, 25 → in WRONG NUMBER branch. Keep FHA $150k, ESA, bedbug urgent, P1/P2/P3 internal-tags, S16e prompt-injection defense verbatim. |
| 3 | `faq_pairs` | 115 (live) / 1,496 (preview) | 0 | -1,496 | no | **DROP from stored prompt** | Violates per-call-context-contract §1 (PER_CALL_CONTEXT_ONLY). `extra_qa` already injects via `businessFacts` block. Use `__SKIP__` sentinel in niche template, same pattern PR #78 used for NICHE_EXAMPLES (see niche-defaults.ts:719 + prompt-slots.ts:484). |
| 4 | `tone_and_style` | 979 | 300 | -679 | no | **MERGE into voice_naturalness** | Overlaps heavily with voice_naturalness (523) — both teach calm/confident/conversational register. Pick the better one, fold unique lines from the other in, delete the slot. |
| 5 | `persona_anchor` | 782 | 400 | -382 | partial | **COMPRESS** | Trim redundant warmth markers ("warm, calm, conversational" said 3x). Keep "Never say you are an AI unless directly asked" verbatim (sacred). |
| 6 | `returning_caller` | 666 | 450 | -216 | yes | **COMPRESS + Bug 3 fix** | Add the topic-presumption rule from handoff step 4: *"When greeting a returning caller, acknowledge familiarity by name but ALWAYS ASK why they're calling. Never presume the topic from the prior call summary."* Drop redundant pacing language. |
| 7 | `knowledge` | 664 | 400 | -264 | no | **COMPRESS** | The queryKnowledge "bridge first, share naturally" guidance is restated in conversation_flow QUESTION INTAKE and forbidden #9 (ANSWER-FIRST). Pick one home, reference from others. |
| 8 | `goal` | 532 | 250 | -282 | no | **COMPRESS** | Often goals slot is short directive lines; current has narrative paragraphs. |
| 9 | `voice_naturalness` | 523 | 600 | +77 | no | **KEEP + receive tone merge** | Will grow slightly when absorbing tone_and_style. |
| 10 | `safety_preamble` | 465 | 350 | -115 | yes | **COMPRESS verbatim phrases** | Tighten framing language but keep all safety substrings the call-scenarios.test.ts checks for. |
| 11 | `sms_followup` | 413 | 250 | -163 | no | **COMPRESS** | Trim wording; SMS body template is short by nature. |
| 12 | `escalation_transfer` | 403 | 300 | -103 | partial | **COMPRESS** | Keep P1 transfer-fallback contract; drop preamble. |
| 13 | `recency_anchor` | 385 | 200 | -185 | no | **COMPRESS** | Recency framing is one line; rest is fluff. |
| 14 | `call_handling_mode` | 350 | 200 | -150 | no | **COMPRESS** | Already short; just tighten. |
| 15 | `identity` | 343 | 343 | 0 | yes | **KEEP** | Identity slot is already minimal. |
| 16 | `grammar` | 342 | 0 | -342 | no | **DROP** | All grammar guidance is duplicated in voice_naturalness ("contractions, no markdown, no emojis"). Same DRY rule the May trim applied to TRIAGE_DEEP SHORT/1-WORD block. |
| 17 | `after_hours` | 201 | 201 | 0 | no | **KEEP** | Already minimal. |
| — | _outside slots_ | 32 | 32 | 0 | — | KEEP | preamble glue text. |

## Totals

| | Current | After plan | Hard max | Stretch |
|---|---:|---:|---:|---:|
| Slotted | 22,890 | 9,544 | 12,000 | 8,000 |
| Outside slots | 32 | 32 | | |
| **TOTAL** | **22,922** | **9,576** | **12,000** | **8,000** |
| Savings | | -13,346 (-58%) | | |

Lands at **9,576 chars** — 80% of hard max, 120% of stretch. If conversation_flow compresses to 2,800 instead of 3,500, hits 8,876 (stretch territory).

## Sacred-section preservation checklist (verbatim substring tests)

These 12 fingerprints MUST grep-match after compose. Same list call-scenarios.test.ts enforces (per [[Projects/unmissed/2026-05-05-niche-template-trim-and-brian-recompose]]):

- [ ] `Fair Housing Act violations carry penalties up to $150,000`
- [ ] `NEVER reject or question service animal or ESA`
- [ ] `flag as [P1 URGENT] immediately` *(or contemporary equivalent — check current wording)*
- [ ] `NEVER confirm or deny rent amounts` *(or contemporary "NEVER quote unit-specific rent")*
- [ ] `demographic language`
- [ ] `do NOT downplay` *(bedbug rule)*
- [ ] `9-1-1 right now`
- [ ] `no heat`
- [ ] `CALLER ENDS CALL` *(Gotcha #56 — filter branch)*
- [ ] `COMPLETION CHECK`
- [ ] `hangUp`
- [ ] `Never reveal` *(S16e prompt-injection defense)*

Plus the new Bug 3 rule (handoff step 4):
- [ ] `ALWAYS ASK why they're calling` *(topic-presumption fix, returning_caller slot)*

## Execution plan (next session)

### Step 1 — Niche template edits (`src/lib/prompt-config/niche-defaults.ts`)

Same file the May trim touched. Three changes:

1. **FORBIDDEN_EXTRA for `property_management`** — rewrite 25 rules → 8 grouped, preserving every sacred substring listed above. Target output: ~1,800 chars (was 5,835).
2. **Drop FAQ_PAIRS injection** — wherever the slot pipeline pulls `extra_qa` into `faq_pairs` slot for the property_management niche, set `__SKIP__` sentinel (same mechanism as NICHE_EXAMPLES). Verify `buildFaqPairs()` in prompt-slots.ts respects the sentinel (it should, per the May change at `prompt-slots.ts:484`).
3. **CONVERSATION_FLOW for `property_management`** — collapse 13 TRIAGE branches into 6: MAINTENANCE, RENTAL_INQUIRY, BILLING_OR_LEASE, MOVE_IN_OUT, PROPERTY_OWNER, MESSAGE_OR_UNCLEAR. Each branch one line: "[trigger] → collect [fields] → tool/route". Move emergency-911 line into a shared SAFETY-FIRST preamble at top of TRIAGE. Drop the INTERNAL P1 list (duplicate of forbidden rule for emergency phrases).

### Step 2 — Slot defaults trims (`src/lib/prompt-slots.ts`)

1. **DROP `grammar` slot** for all niches that have voice_naturalness (all do). Remove the slot from the composer order. Existing `grammar` defaults move into voice_naturalness as a one-liner.
2. **MERGE `tone_and_style` into `voice_naturalness`** — keep voice_naturalness as the canonical voice slot. Audit other niches to confirm no slot-specific tone overrides.
3. **Compress `recency_anchor`, `goal`, `knowledge`, `sms_followup`** to lean defaults.

### Step 3 — Returning-caller Bug 3 fix (`src/lib/prompt-config/niche-defaults.ts` or shared `RETURNING_CALLER_GREETING`)

Add the rule from handoff step 4. Suggested wording:

> When greeting a returning caller by name, acknowledge familiarity but ALWAYS ASK why they're calling today. Do not presume the topic from prior call context — that summary is reference only, not the agenda for this call.

### Step 4 — Ceilings (`src/lib/prompt-config/slot-ceilings.test.ts`)

Drop ceilings to match new targets:
- `property_management`: 16,000 → **11,000** (gives 1K headroom under 12K hard max)
- `PROMPT_CHAR_HARD_MAX`: 20,000 → **12,000** (aligns code with GLM-4.6 rules)

### Step 5 — Validate before deploy

1. `npm test` — confirm 1839+ tests pass, all 13 safety fingerprints intact (12 May + 1 new Bug 3 rule).
2. `npx tsx scripts/recompose-brian.ts` (dryrun) — confirm preview is under 12,000 chars.
3. Manually inspect /tmp/brian-audit dryrun output for the 13 fingerprints.
4. Browser-test via `POST /api/dashboard/browser-test-call` (slot=draft) — Hasan plays returning-caller turn + maintenance-emergency turn. No billing, no Twilio.
5. `npx tsx scripts/recompose-brian.ts --live` only after Hasan signs off on the browser test.
6. `/prompt-deploy calgary-property-leasing` if `--live` didn't already PATCH Ultravox (the script does, but the slash command is the canonical deploy path).
7. Tail `notification_logs` + `call_logs` for Brian for 24h after first live call.

## Drift-prevention notes

The May trim shipped multiple defenses (PR #78 + D451 + D452). They did NOT prevent today's regrow because:

- **`faq_pairs` regrow path:** `extra_qa` edits in dashboard flow into the prompt every recompose because slot pipeline reseeds the `faq_pairs` slot from DB. Fix: `__SKIP__` sentinel per Step 1.2 above.
- **`forbidden_actions` regrow path:** Either a niche-defaults.ts edit added rules 18-25 since May 5, OR a snowflake patcher wrote them. Check `git log src/lib/prompt-config/niche-defaults.ts` since 2026-05-05 to identify when rules 18-25 reappeared.
- **No `clients.system_prompt` write log:** prompt_versions table should show the regression. Pull `SELECT created_at, length(prompt_text), author FROM prompt_versions WHERE client_id='2c186f70-84cc-4253-a3ab-6cd0e9064d39' ORDER BY created_at DESC LIMIT 10;` to identify the source.

## ROOT CAUSE (Hasan's diagnosis, confirmed by section data)

> *"Every time we actually pull website data and anything else using this slots pipeline thing, that's when it becomes twenty thousand plus characters."*

This is the load-bearing finding. Per the **per-call-context-contract**, three datasets must NEVER be baked into the stored `system_prompt`:

| DB column | Class | Correct injection path | Stored-prompt leak (today) |
|---|---|---|---|
| `clients.business_facts` | `DB_PLUS_KNOWLEDGE_PIPELINE` (PER_CALL on injection side) | `businessFacts` templateContext at call time | LEAKING into `knowledge` slot (664 chars) |
| `clients.extra_qa` | `DB_PLUS_KNOWLEDGE_PIPELINE` (PER_CALL on injection side) | `businessFacts` templateContext at call time | LEAKING into `faq_pairs` slot (1,496 chars in preview) |
| `knowledge_chunks` (website scrape, PDFs) | `DB_PLUS_KNOWLEDGE_PIPELINE` | `queryKnowledge` tool at runtime | LEAKING into `knowledge` slot + possibly inflating `conversation_flow` QUESTION INTAKE wording |

Every recompose pulls these in fresh. The May trim attacked the **niche template** (FORBIDDEN_EXTRA + NICHE_EXAMPLES) but did NOT close the **scrape/extra_qa → slot pipeline** path. That's why Brian's prompt regrew from 18,998 → 22,922 in 4 weeks: every `extra_qa` edit OR re-scrape inflates it again.

### Fix (architectural — not just a trim)

In **`src/lib/prompt-slots.ts`** (the 21-slot composer), audit every slot that calls `clientRow.extra_qa`, `clientRow.business_facts`, or `seedKnowledgeFromScrape()` output. For each:

- If the data already injects via `templateContext.businessFacts` at call time → **`__SKIP__`** in stored prompt (same sentinel as NICHE_EXAMPLES, PR #78).
- If the data is reachable via `queryKnowledge` (pgvector chunks) → **`__SKIP__`** in stored prompt; agent will fetch on demand.

The only knowledge text that belongs in the stored prompt is the **retrieval instruction** (e.g. "call queryKnowledge for general policy questions") — that's a 1-line directive, not an inlined dataset.

Add a unit test asserting: after `recomposePrompt()`, `system_prompt` MUST NOT contain any substring from `clients.business_facts` or `clients.extra_qa` for niches where these are runtime-injected. This is the regression that bit us — make the test gate it permanently.

## Step 6 — Behavior validation (live-call comparison)

**Goal:** confirm the slim doesn't regress real behavior. The prompt is shorter — does Eric still pull knowledge correctly, triage correctly, hangup correctly?

**A. Baseline — pull Brian's last 20 calls (pre-slim):**

```bash
cd ~/Downloads/CALLING\ AGENTs
# Either via Supabase MCP or a one-off script:
psql "$DATABASE_URL" -c "
  SELECT id, ultravox_call_id, started_at, duration_seconds,
         classification, ai_summary,
         (call_state->'fieldsCollected') AS fields,
         (call_state->'toolCalls') AS tools
  FROM call_logs
  WHERE client_id='2c186f70-84cc-4253-a3ab-6cd0e9064d39'
    AND call_status IN ('COMPLETED','VOICEMAIL')
  ORDER BY started_at DESC LIMIT 20;"
```

For each baseline call, score on the 5 dims `review-call` skill uses:
- Greeting + identity (10)
- Recovery / flexibility (10)
- Brevity (10)
- Completion check (10)
- Tool use (10) — especially `queryKnowledge` and `submitMaintenanceRequest`

Save to `CALLINGAGENTS/00-Inbox/2026-06-02-brian-baseline-scores.md`.

**B. Knowledge-trigger audit:**

For the 20 baseline calls, count:
- How many callers asked a general policy question (areas, pricing, screening, services)?
- How many calls fired `queryKnowledge`?
- How many returned non-empty results?
- How many callers received an actual answer vs a "Brian will call you back" deflection?

This is the test Hasan wants: *is knowledge actually being pulled or triggered?* If `queryKnowledge` fires 2 times in 20 calls but 12 calls asked policy questions, the issue isn't prompt size — it's the prompt's QUESTION INTAKE branch not routing to the tool.

**C. Post-slim comparison:**

After Step 5 ships and Brian has another 20 calls (or after browser-tested replays), re-run B. Same 5-dim score table, side by side. Required gates:

- Brevity score ≥ baseline (compression payoff must show up)
- queryKnowledge hit rate ≥ baseline (slim didn't kill knowledge tool routing)
- Completion check pass rate ≥ baseline (name collection still works)
- Zero safety-fingerprint regressions on call transcripts (no FHA/ESA/bedbug drift)

**D. Knowledge corpus health check:**

Independent of prompt size, validate the corpus itself:

```bash
psql "$DATABASE_URL" -c "
  SELECT source, status, COUNT(*) AS chunks,
         AVG(length(content)) AS avg_chunk_chars
  FROM knowledge_chunks
  WHERE client_id='2c186f70-84cc-4253-a3ab-6cd0e9064d39'
  GROUP BY source, status;"
```

If `status='approved'` count is low or chunks are short/incoherent, queryKnowledge will return empty even with a perfect prompt. The slim won't fix that — re-running `/api/dashboard/knowledge/compile` will.

## Files written this session

- `/tmp/brian-audit/brian-current.md` (22,922 chars — live DB prompt)
- `/tmp/brian-audit/brian-preview.md` (24,303 chars — slot-pipeline dryrun output)
- `/tmp/brian-audit/sections/*.{current,preview}.md` (per-slot dumps for inspection)
- `CALLINGAGENTs/00-Inbox/recompose-brian-dryrun.json` (raw recompose result + DB row snapshot)
- `scripts/audit-brian-sections.ts` (reusable section-size table generator)
- this file

## Don't forget

- Cache-break protection: do NOT edit CLAUDE.md, .mcp.json, or settings.json mid-session.
- Standing rule: no redeploys to hasan-sharif, exp-realty, windshield-hub, urban-vibe. calgary-property-leasing is explicitly allowed (it's Brian's, the trialing customer).
- Trial expires 2026-06-15 — test before deploy; broken calls = paid trust loss.
- After deploy, run `/review-call [ultravox-call-id]` on the first live returning-caller and the first maintenance-emergency to confirm both behaviors.
