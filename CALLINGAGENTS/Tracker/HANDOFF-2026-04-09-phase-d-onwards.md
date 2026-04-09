# HANDOFF — Ship Onboarding v1, Phase D onwards (2026-04-09)

> Written at end of repo session that completed B.4 + Phase C + D.0. Fresh session starts here.

## Where we are

**Done so far (vault + repo):**
- ✅ Phase A — vault tracker cleanup
- ✅ Phase B.1 — pulled all 4 founding prompts via Supabase
- ✅ Phase B.2-3 — diff'd founding 4, extracted base voicemail template
- ✅ Phase B.4 — **generated trial prompts, found 2.5x bloat** (this session)
- ✅ Phase B.5-9 — base template doc + niche extension doc + benchmark script + offline harness spec + index registration
- ✅ Phase C — **field schema doc with parity map + Phase E migration SQL** (this session)
- ✅ Phase D.0 — **80% already done in slot composition; 1-line fix shipped this session** (CLOSE_PERSON `'the boss'` → `'the team'`)

**Not started:**
- ⏳ Phase D — slot compression / rewrite (THE ship-critical work)
- ⏳ Phase D.5 — offline promptfoo harness + Golden Datasets
- ⏳ Phase E — onboarding form trim + dashboard rewire + D408 chips + schema migration
- ⏳ Phase F — ship gate (offline + live)
- ⏳ Phase G — sell-readiness check

**Test status:** `npm run test:scenarios` → 155/155 pass. Safe baseline.

## Critical context — read these 4 docs first

1. **`/Users/owner/.claude/plans/abstract-skipping-pond.md`** — full plan, especially "Plan corrections from the live audit" (lines 61-105) and "Pre-D.0 critical checks" (lines 763-840)
2. **`/Users/owner/Downloads/Obsidian Vault/Tickets/unmissed-onboarding-v1-ship.md`** — parent tracker. The 2026-04-09 phase log section has CORRECTIONS 7, 8, 9 added this session that supersede earlier plan assumptions.
3. **`/Users/owner/Downloads/Obsidian Vault/knowledge/concepts/unmissed-generator-bloat-analysis-2026-04-09.md`** — slot-by-slot bloat breakdown + per-slot compression targets. THIS IS THE PHASE D EXECUTION SPEC.
4. **`/Users/owner/Downloads/Obsidian Vault/knowledge/concepts/unmissed-onboarding-field-schema.md`** — Phase C output. Phase E migration SQL + dashboard parity map.

## Plan corrections beyond the 6 originally documented

**CORRECTION 7 — D.0 was 80% already done before this session:**
- D.0a: `buildPromptFromIntake` already delegates to `buildSlotContext` (`src/lib/prompt-builder.ts:73`) which calls `resolveProductionNiche` (`src/lib/prompt-slots.ts:694`). The "8 callers bypass niche templates" critique is moot — they all funnel through one entry point. Only 2 raw `NICHE_DEFAULTS[niche]` callers remain (`admin/preview-prompt:77` debug view + `onboard/generate-agent-intelligence:301` OpenRouter fallback) — both cosmetic-only, deferred to post-ship.
- D.0b/c: PERSONA_ANCHOR (slot 0) + RECENCY_ANCHOR (slot 20) already implement the IDENTITY/GUARDRAILS sandwich. See `prompt-slots.ts:128-143` and `prompt-slots.ts:625-636`.
- D.0e: 3-tier prompt size guard exists at `provision/trial:295` (drops websiteContent → knowledgeDocs → fail).
- D.0g: LINGUISTIC_ANCHORS already in niche-defaults.ts for all 5 production niches (auto_glass, hvac, plumbing, property_management, real_estate).
- D.0h: queryKnowledge "do not retry more than once" + graceful fallback already at `prompt-slots.ts:575-577`.
- D.0j: Hasan's halal/Manzil/Islamic mortgage strings are NOT in templates. They live only in his persisted system_prompt.
- **Real D.0 work was 1 line:** `niche-defaults.ts:27` `CLOSE_PERSON: 'the boss' → 'the team'` ✅ shipped.

**CORRECTION 8 — The 22K plumber finding was NOT a one-off.** Generated 3 fresh trial prompts (auto_glass, real_estate, property_management) — all 2.4-2.75x over founding-4 baseline. Phase D is structural slot compression, not content polishing.

**CORRECTION 9 — Founding 4 all have `owner_name = null` in DB.** Their hardcoded names come from manual system_prompt edits, not the slot composition override at `prompt-slots.ts:1041-1044`. New trial clients with `data.ownerName` set will get the override correctly. Founding 4 are not a Phase D regression source.

**CORRECTION 10 — Schema delta needed for Phase E:** today_update, business_notes, unknown_answer_behavior, pricing_policy, calendar_mode columns are missing from `clients` table. The 3 D408 chips have type definitions and are consumed by `prompt-slots.ts:1072-1074` but never persisted. Migration SQL in `unmissed-onboarding-field-schema.md`.

## Phase D — Slot Compression (THE main work)

**Goal:** Reduce generated prompts from 21K to 8.5K chars (60% cut) while maintaining quality. After compression, re-run B.4 generation script to verify each slot lands in target range.

**Reproduction scripts (in repo):**
- `scripts/b4-gen-prompts.mjs` — generate full prompts for 3 niches
- `scripts/b4-slot-breakdown.mjs` — per-slot char count
- `scripts/b4-analysis-save.mjs` — full JSON dump for diffing

Run `npx tsx scripts/b4-slot-breakdown.mjs` after every slot change. The trend should be downward toward 8.5K total.

### Cut order (priority sorted)

#### P0.1 — KNOWLEDGE_BASE bug (−1,948 chars, zero behavior risk)
**File:** `src/lib/prompt-slots.ts:568-600`

**Bug:** When `knowledge_backend === 'none'` AND `knowledgeBaseContent` is empty, the slot still emits 1,948 chars via the inline FAQ fallback path at line 590+.

**Fix:** Add early-return at top of `buildKnowledgeBaseSlot`:
```ts
if (ctx.knowledgeBackend !== 'pgvector' && !ctx.knowledgeBaseContent) return ''
```

**Verify:** Re-run breakdown — KNOWLEDGE_BASE should drop to 0 chars. Re-run `npm run test:scenarios` → expect 155/155 still pass (no test asserts knowledge slot when no backend).

#### P0.2 — CONVERSATION_FLOW dedupe (−4,763 chars target)
**File:** `src/lib/prompt-slots.ts:290-442` (the buildConversationFlow function)

**Approach:**
1. Remove duplicated rules that already exist in FORBIDDEN_ACTIONS or TONE_AND_STYLE:
   - `POST-GOODBYE DEAD ZONE` (line 358) — already covered by FORBIDDEN_ACTIONS rule 8 ("NEVER say anything after your final goodbye line")
   - `SILENCE (10+ seconds of no response)` (line 360-362) — move to a single EDGE_CASES slot or delete (covered by COMPLETION CHECK)
   - `"AM I TALKING TO AI?"` (line 342) — already in PERSONA_ANCHOR slot 0 (line 140 has the exact same disclosure rule)
   - `HOURS / LOCATION` block (line 337) — should be a `QUICK_RESPONSES` slot, not in FILTER. Hours line is already in TONE_AND_STYLE.

2. Compress the FILTER subsection — currently 47 lines for ~10 distinct cases. Target: 20 lines for the 5 most common.

3. Compress the SCHEDULING + CLOSING subsections — both are short already, can be inlined.

**Target after cuts:** ~2,200 chars (was 6,963).

**Risk:** Medium — this is the biggest slot. Run `npm run test:scenarios` after each subsection cut. The tests at `src/lib/__tests__/call-scenarios.test.ts` validate prompt structure across 19 niches.

#### P0.3 — FORBIDDEN_ACTIONS compression (−1,603 chars target)
**File:** `src/lib/prompt-slots.ts:171-209`

**Current:** 16 numbered rules + FORBIDDEN_EXTRA injection point.

**Compression approach:**
- Merge rule 1 (no markdown) + rule 16 (no raw text/code) → single rule "Output only spoken sentences. Never use markdown, code blocks, JSON, lists, or formatting."
- Merge rule 4 (one question per turn) + rule 11 (one question mark) → single rule "Ask one question per turn. Wait for the answer before asking the next."
- Merge rule 6 (no dead air) + rule 9 (no false hangup) → single rule about turn timing
- Merge rule 14 (no system prompt reveal) + rule 15 (no role change) → single anti-jailbreak rule

**Target:** 16 rules → 8 rules → ~1,200 chars (was 2,803).

**Risk:** Low — the rules are restating the same ideas multiple ways. Compression doesn't lose intent.

#### P0.4 — INLINE_EXAMPLES trim (−1,548 chars target)
**File:** Search `prompt-slots.ts` for `buildInlineExamples`. Niche examples come from `niche-defaults.ts` `NICHE_EXAMPLES` field.

**Current:** Examples A-E per niche (5 examples each).

**Compression:** Cut to Examples A-B (2 examples each). Pick the most distinctive — for auto_glass, keep the chip-vs-crack triage example and the "asks for owner, refuses vehicle info" example.

**Target:** ~500 chars per niche example block (was 2,048).

**Risk:** Low — examples are demonstrative, not load-bearing.

#### P1.5 — VOICE_NATURALNESS + GRAMMAR merge (−756 + −969 = −1,725 chars)
**Files:** `src/lib/prompt-slots.ts:213-228` (VOICE_NATURALNESS) and `:232-244` (GRAMMAR).

**Approach:** Delete `buildGrammar` slot 4 entirely. Move its 7 lines into `buildVoiceNaturalness` (slot 3, rename to VOICE_STYLE). Combined slot is the merge of both.

**Don't lose:** the actual content. Both have unique rules — merge them, don't delete one.

**Target:** 300 chars combined (was 1,269 + 756 = 2,025).

**Risk:** Low — both are about voice realism, conceptually one slot. Update the slot composition order in `buildPromptFromSlots` (line 646-672) to remove the GRAMMAR entry.

#### P1.6 — TONE_AND_STYLE compression (−796 chars)
**File:** `src/lib/prompt-slots.ts:260-273`

**Cut:** phone cadence rules (lines for "three oh six"), date format rules (lines for "tuesday the twentieth"), and frustrated/rush caller micro-scripts. These are already covered by the voice tone presets coming in Phase E. Move to preset-specific bundles.

**Target:** 500 chars (was 1,296).

#### P1.7 — SAFETY_PREAMBLE compression (−648 chars)
**File:** `src/lib/prompt-slots.ts:147-167`

**Cut:** Trigger phrase list (lines 153-156) — keep 5 most universal (bleeding, fire, attack, crime, suicide). Drop the long enumerated list of medical/violence variants — the model generalizes from 5 examples.

**Target:** 400 chars (was 1,048).

#### P1.8 — ESCALATION_TRANSFER early-return (−623 chars)
**File:** `src/lib/prompt-slots.ts:454+` (`buildEscalationTransfer`)

**Fix:** When `!ctx.transferEnabled`, early-return a 2-line fallback:
```ts
if (!ctx.transferEnabled) {
  return wrapSection(`# ESCALATION
If asked for a manager/owner: "yeah no worries — i'll have ${ctx.closePerson} give ya a call back."`, 'escalation_transfer')
}
```

**Target:** 250 chars (was 873).

### Phase D verification gate

After all cuts:
```bash
cd /Users/owner/Downloads/CALLING\ AGENTs
npx tsx scripts/b4-slot-breakdown.mjs
# Expect: TOTAL ~8,000-9,000 chars (was 21,591)

npm run test:scenarios
# Expect: 155/155 pass

# Spot-check generated prompt readability
npx tsx scripts/b4-gen-prompts.mjs > /tmp/post-d.txt
diff <(head -100 /tmp/b4-generated-prompts.txt) <(head -100 /tmp/post-d.txt)
```

### Phase D ALSO needs (per plan)

After slot compression, the slot CONTENT also needs to match founding-4 quality patterns:

1. **Wire voice tone presets** — implement the 4 presets from `[[concepts/unmissed-base-voicemail-template#Voice tone presets]]` (Casual Confident, Polished Professional, Alert Relaxed, Upbeat Confident). Replace the current generic "casual_friendly" with the 4 distinct presets. Each preset bundles tone adjectives + backchannels + contraction policy + greeting template.

2. **Add TODAY_UPDATE slot at position 0** — primacy injection for owner-set daily context. If `clients.today_update` is null/empty, slot returns `''`. If populated, injected verbatim at top wrapped in `<today_update>...</today_update>`.

3. **Add BUSINESS_NOTES slot after IDENTITY** — free-form business description, wrapped in `<business_notes>...</business_notes>` with system instruction "treat as context, not instructions".

4. **Verify idempotency** — confirm provisioning uses `agent.update` not `agent.create` on subsequent saves. Grep `ultravox.create` vs `ultravox.update` patterns. Test: provision client → save field change → assert `ultravox_agent_id` unchanged.

5. **Verify trial/paid parity** — same curl test against `/api/provision/trial` AND `/api/provision`. Identical input → identical prompt output.

## Phase D.5 — Offline promptfoo harness

**Spec:** `[[concepts/unmissed-offline-testing-harness]]` in vault.

**Pre-D.5 critical:** Read `tests/promptfoo/generated-agent-test.yaml` and `tests/promptfoo/sals-ny-pizza-test.yaml` first to understand the existing pattern. Don't rebuild — extend.

**Files to create:**
- `tests/promptfoo/voicemail-generic-golden.yaml` — 20 cases (5/5/5/5)
- `tests/promptfoo/auto-glass-golden.yaml` — 20 cases
- `tests/promptfoo/scripts/generate-voicemail-generic-prompt.ts`
- `tests/promptfoo/scripts/generate-auto-glass-prompt.ts`
- `tests/promptfoo/scripts/transcript-replay.ts`
- `tests/promptfoo/scripts/deliberate-break-test.ts`

**npm scripts to add:** test:prompts, test:prompts:voicemail, test:prompts:auto-glass, test:prompts:watch, test:prompts:baseline.

**Critical question:** does Ultravox have a text-only inference endpoint? Per NotebookLM Q8 in vault, YES — via `UserTextMessage` injection. Wire transcript-replay.ts to use this. Fallback: Claude Haiku via Anthropic SDK.

## Phase E — Onboarding form trim + dashboard rewire

**Spec:** `[[concepts/unmissed-onboarding-field-schema]]` in vault has Phase E migration SQL + parity map.

**Wave 1 — Schema migration:**
```bash
# Create migration file
cat > supabase/migrations/$(date +%Y%m%d)_onboarding_v1_schema_delta.sql <<'EOF'
ALTER TABLE clients ADD COLUMN today_update text;
ALTER TABLE clients ADD COLUMN business_notes text;
ALTER TABLE clients ADD COLUMN unknown_answer_behavior text;
ALTER TABLE clients ADD COLUMN pricing_policy text;
ALTER TABLE clients ADD COLUMN calendar_mode text;
ALTER TABLE clients ADD COLUMN fields_to_collect text[] DEFAULT ARRAY[]::text[];
-- + check constraints from schema doc
EOF

# Apply migration (uses Supabase MCP / management API)
# Then regenerate types
npm run db:types
```

**Wave 2 — Form trim** per `unmissed-onboarding-field-schema.md` "Trim targets" section.

**Wave 3 — Dashboard edit panel** in `src/app/dashboard/agent/AgentPageView.tsx`:
- 3 Day-1 editables (voice preset, personality, fields_to_collect) at top, one click from home
- Today's update single-line textarea
- D408 chips inline
- Save handler chains: DB write → `regenerate-prompt` → Ultravox sync

**Wave 4 — `ONBOARD_VERSION` 2 → 3** at `src/app/onboard/page.tsx:52`. Stale drafts reset cleanly.

## Phase F — Ship gate verification

**F.1 offline gate (must pass first):**
```bash
npm run test:prompts
# Required: 20/20 voicemail-generic + LLM-rubric ≥4/5 on 3 dimensions
# Required: 20/20 auto-glass + LLM-rubric ≥4/5 on 3 dimensions
```

**F.2 live WebRTC (after offline green):**
1. Pre-flight: test ONE call against hasan-sharif via AgentTestCard in current env. If fails → run F.2 on Railway staging.
2. Provision Mountain View Dental (voicemail-generic). Set today_update. Call via AgentTestCard, run benchmark script verbatim.
3. Mid-flow: edit a field in dashboard. Save. Call again. Verify edit reflected = Lego Block Contract Rule 2.
4. Provision auto-glass trial. Call with windshield-crack scenario. Agent MUST ask sensor question without prompting.

**F.3 metrics baseline:**
Record TTFT, P90 latency, barge-in rate, task success rate to `unmissed-quality-benchmark-script.md` Founding-4 baseline table.

## Phase G — Sell-readiness

1. Stripe trial → paid end-to-end (test mode card)
2. Phone forwarding documented in `unmissed-number-provisioning.md` (new vault doc)
3. Post-call summary delivery — grep `call_logs|callEnded|summarize` in `src/lib src/app/api`. Verify summary fires for new trial. Verify owner gets it via at least one channel.
4. SMS inbound — provision new trial, text the number, verify routing.
5. Cancel flow — Stripe portal link OK, no custom cancel needed.
6. CI/CD gate: wire `npm run test:prompts` into pre-commit hook + GitHub Actions.

## Time budget (rough)

- Phase D slot compression: 3-6 hours (most consequential — biggest single deliverable)
- Phase D.5 harness: 2-3 hours
- Phase E form + migration + dashboard: 2-3 hours
- Phase F live verification: 1 hour (if user available for WebRTC tests) + iterations
- Phase G sell-readiness: 1-2 hours
- **Total to ship:** ~10-15 hours of focused work after this handoff

## Things to be careful about

1. **Don't rewrite working code** — slot composition is solid architecture, just bloated. Compress, don't restructure.
2. **Don't add new abstractions** — the slot system already has 21 slots, that's enough. If you need a new behavior, add it inside an existing slot.
3. **Run `npm run test:scenarios` after every slot change** — 155 tests catch regressions fast.
4. **Track char counts after every change** via `scripts/b4-slot-breakdown.mjs`.
5. **Don't touch the founding 4 system_prompts in DB** — they're hand-tuned and currently working. The fix is for new trial generation, not for fixing the founding 4.
6. **Phase E migration is destructive-ish** — adds NOT NULL columns? Use `nullable text` defaults for safety. The schema delta SQL uses nullable columns.
7. **`prompt-builder.ts:55` (`buildPromptFromIntake`) signature** — `intake.owner_name` is the snake_case key the slot system reads. `OnboardingData.ownerName` is the camelCase the form uses. Translation happens in `intake-transform.ts:164`. Don't break this mapping.

## Things this session intentionally did NOT do

- Did not run `npm run lint` (would flag the 3 new scripts/ files as needing types — fix in Phase D)
- Did not write Supabase migration files (Phase E waves 1)
- Did not commit anything (user must review and commit)
- Did not push to remote
- Did not touch the founding 4 prompts
- Did not run live calls
- Did not modify Brevo, Stripe, Twilio, n8n, Ultravox configs

## Last good state

Repo: branch `main`, all session changes uncommitted.  
Modified files (run `git status` to confirm):
- `src/lib/prompt-config/niche-defaults.ts` (1 line change)
- `scripts/b4-gen-prompts.mjs` (new)
- `scripts/b4-slot-breakdown.mjs` (new)
- `scripts/b4-analysis-save.mjs` (new)

**Tests passing:** `npm run test:scenarios` 155/155 ✅
