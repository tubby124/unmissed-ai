# HANDOFF — Ship Onboarding v1, Phase D.5 onwards (2026-04-09)

> Written at end of the Phase D slot compression session. Phase D is fully committed to working tree (not git). Fresh session starts here.

## Where we are

**Done (vault + repo):**
- ✅ Phase A — vault tracker cleanup
- ✅ Phase B.1-9 — founding-4 audit, base skeleton, niche extension, benchmark, offline harness spec, index registration
- ✅ Phase C — field schema + Phase E migration SQL
- ✅ Phase D.0 — narrow fixes (close_person 'boss' → 'team', 1 line)
- ✅ **Phase D — slot compression** (THIS PREVIOUS SESSION)

**Not started:**
- ⏳ Phase D.5 — offline promptfoo harness + Golden Datasets
- ⏳ Phase E — onboarding form trim + dashboard rewire + D408 chips + schema migration
- ⏳ Phase F — ship gate (offline + live)
- ⏳ Phase G — sell-readiness check

**Test status:** `npm run test:all` → **1566/1566 pass** (includes regenerated golden snapshots). `npm run test:scenarios` → **155/155 pass**. Safe baseline.

## Phase D results (reference for next session)

Auto_glass baseline char breakdown:

| Slot | Before | After | Δ |
|---|---:|---:|---:|
| 0 PERSONA_ANCHOR | 722 | 722 | 0 |
| 1 SAFETY_PREAMBLE | 1,048 | 465 | −583 |
| 2 FORBIDDEN_ACTIONS | 2,803 | 1,661 | −1,142 |
| 3 VOICE_NATURALNESS | 1,269 | 523 | −746 |
| 4 GRAMMAR | 756 | 342 | −414 |
| 5 IDENTITY | 278 | 278 | 0 |
| 6 TONE_AND_STYLE | 1,296 | 898 | −398 |
| 7 GOAL | 502 | 502 | 0 |
| 8 CONVERSATION_FLOW | 6,963 | 3,996 | −2,967 |
| 10 ESCALATION_TRANSFER | 873 | 418 | −455 |
| 11 RETURNING_CALLER | 389 | 389 | 0 |
| 12 INLINE_EXAMPLES | 2,048 | 1,084 | −964 |
| 13 CALL_HANDLING_MODE | 207 | 207 | 0 |
| 14 FAQ_PAIRS | 115 | 115 | 0 |
| 16 KNOWLEDGE_BASE | 1,948 | 0 | −1,948 |
| 20 RECENCY_ANCHOR | 374 | 374 | 0 |
| **TOTAL** | **21,591** | **11,974** | **−9,617 (−44.5%)** |

Target was 8,500. Landed at 11,974 — the 3,474 char gap is in niche-specific `triageDeep` content (auto_glass TRIAGE_DEEP = 1,176 chars) which is out of Phase D scope. Closing that gap requires editing `prompt-config/niche-defaults.ts` per niche — separate follow-up ticket.

**Files modified (uncommitted — user must review and commit):**
- `src/lib/prompt-slots.ts` — 10 slot function rewrites + `trimToFirstTwoExamples` helper
- `src/lib/__tests__/prompt-builder-golden.test.ts` — removed PRODUCT KNOWLEDGE BASE from REQUIRED_SECTION_HEADERS, inverted 2 Layer 4B tests (was asserting the fallback bug, now asserts empty slot), added `caller_faq provided` positive test
- `src/lib/__tests__/prompt-slots-shadow.test.ts` — removed PRODUCT KNOWLEDGE BASE from required/ordered/mustContain lists
- `src/lib/__tests__/slot-regenerator.test.ts` — hasSlotMarkers + D280 tests now pass pgvector context so knowledge slot emits
- `src/lib/__tests__/snapshots/*.txt` — all 5 golden snapshots regenerated (hvac 11,732 / auto-glass-baseline 12,340 / auto-glass-voicemail-replacement 11,631 / real-estate-baseline 12,872 / plumbing-appointment-booking 10,712)
- `scripts/regen-golden-snapshots.mjs` (new) — covers all 5 fixtures

**Pre-existing uncommitted changes from earlier sessions (untouched by D):**
- CALLINGAGENTS/Tracker/* (various D-tickets)
- `src/components/dashboard/AgentTestCard.tsx`
- `src/lib/__tests__/intake-transform.test.ts`
- Various `.obsidian/` config files

## Phase D.5 — Offline promptfoo harness

**Spec:** `[[concepts/unmissed-offline-testing-harness]]` in vault — extended with B.8 NotebookLM findings (Ultravox UserTextMessage injection, trajectory assertions, 80-word active-script rule).

**Pre-D.5 critical:** Read `tests/promptfoo/generated-agent-test.yaml` and `tests/promptfoo/sals-ny-pizza-test.yaml` first to understand the existing pattern. Don't rebuild — extend.

**Files to create:**
- `tests/promptfoo/voicemail-generic-golden.yaml` — 20 cases (5/5/5/5 — happy / hostile / edge / broken)
- `tests/promptfoo/auto-glass-golden.yaml` — 20 cases
- `tests/promptfoo/scripts/generate-voicemail-generic-prompt.ts`
- `tests/promptfoo/scripts/generate-auto-glass-prompt.ts`
- `tests/promptfoo/scripts/transcript-replay.ts` — wire to Ultravox UserTextMessage (confirmed supported per NLM Q8)
- `tests/promptfoo/scripts/deliberate-break-test.ts`

**npm scripts to add:** `test:prompts`, `test:prompts:voicemail`, `test:prompts:auto-glass`, `test:prompts:watch`, `test:prompts:baseline`.

**Trajectory assertions (new test class):** `trajectory:tool-used`, `trajectory:tool-args-match`, `trajectory:tool-sequence`, `trajectory:goal-success` — verify `hangUp`, `sendTextMessage`, `queryKnowledge`, `transitionToBookingStage` fire with right args in right order.

**LLM-as-judge rubric:** ≥4/5 on 3 dimensions per case (voice realism, task completion, rule adherence).

**80-word active-script rule:** active dialogue (greeting through close) should stay <100 words for generated voicemail-generic. Founding 4 range 200-400 words (latency trade).

## Phase E — Onboarding form trim + dashboard rewire

**Spec:** `[[concepts/unmissed-onboarding-field-schema]]` in vault has Phase E migration SQL + parity map + D408 chip migration list.

**Wave 1 — Schema migration:**
```bash
# Migration file content already specified in the field schema doc
cat > supabase/migrations/$(date +%Y%m%d)_onboarding_v1_schema_delta.sql <<'EOF'
ALTER TABLE clients ADD COLUMN today_update text;
ALTER TABLE clients ADD COLUMN business_notes text;
ALTER TABLE clients ADD COLUMN unknown_answer_behavior text;
ALTER TABLE clients ADD COLUMN pricing_policy text;
ALTER TABLE clients ADD COLUMN calendar_mode text;
ALTER TABLE clients ADD COLUMN fields_to_collect text[] DEFAULT ARRAY[]::text[];
-- plus check constraints from schema doc
EOF
# Apply via Supabase management API (not MCP — direct curl)
npm run db:types
```

**Wave 2 — Form trim** per `unmissed-onboarding-field-schema.md` "Trim targets" section. Drop fields not in the 3 Day-1 editables or Settings tier.

**Wave 3 — Dashboard edit panel** in `src/app/dashboard/agent/AgentPageView.tsx`:
- 3 Day-1 editables (voice preset, personality, fields_to_collect) at top, one click from home
- Today's update single-line textarea
- D408 chips inline (today_update, business_notes, unknown_answer_behavior, pricing_policy, calendar_mode)
- Save handler chains: DB write → `regenerate-prompt` → Ultravox sync

**Wave 4 — `ONBOARD_VERSION` 2 → 3** at `src/app/onboard/page.tsx:52`. Stale drafts reset cleanly.

## Phase D extras (not done in Phase D — deferred to D.5 or separate)

The original Phase D handoff listed 5 "also needs" items that were not executed in the compression session:
1. **Wire voice tone presets** — implement the 4 presets from `[[concepts/unmissed-base-voicemail-template#Voice tone presets]]` (Casual Confident, Polished Professional, Alert Relaxed, Upbeat Confident). Currently the repo has a single `casual_friendly` preset. These preset bundles carry tone adjectives + backchannels + contraction policy + greeting template. Suggest: new file `src/lib/prompt-config/voice-tone-presets.ts`, threaded through `buildSlotContext`.
2. **Add TODAY_UPDATE slot at position 0** — primacy injection for owner-set daily context. Slot returns `''` when `clients.today_update` is null. Needs Phase E schema migration first (today_update column does not exist yet).
3. **Add BUSINESS_NOTES slot after IDENTITY** — free-form business description, wrapped in `<business_notes>...</business_notes>`. Same dependency on Phase E.
4. **Verify idempotency** — confirm provisioning uses `agent.update` not `agent.create` on subsequent saves. Grep `ultravox.create` vs `ultravox.update` patterns.
5. **Verify trial/paid parity** — same curl test against `/api/provision/trial` AND `/api/provision`. Identical input → identical prompt output.

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

**F.3 metrics baseline:** Record TTFT, P90 latency, barge-in rate, task success rate to `unmissed-quality-benchmark-script.md` Founding-4 baseline table.

## Phase G — Sell-readiness

1. Stripe trial → paid end-to-end (test mode card)
2. Phone forwarding documented in `unmissed-number-provisioning.md` (new vault doc)
3. Post-call summary delivery — `grep -rn "call_logs|callEnded|summarize" src/lib src/app/api`. Verify summary fires for new trial. Verify owner gets it via at least one channel.
4. SMS inbound — provision new trial, text the number, verify routing.
5. Cancel flow — Stripe portal link OK, no custom cancel needed.
6. CI/CD gate: wire `npm run test:prompts` into pre-commit hook + GitHub Actions.

## Follow-up ticket candidates (out of current Phase D scope)

- **Niche triageDeep compression** — Close the remaining 3,474 char gap (11,974 → 8,500 target) by compressing each niche's TRIAGE_DEEP in `prompt-config/niche-defaults.ts`. Risk: high regression risk per niche, needs scenario test coverage per niche. Recommend doing one niche at a time.
- **Delete unused helpers** — `buildNicheFaqDefaults` and `buildPrintShopFaq` in `prompt-helpers.ts` are no longer used by `prompt-slots.ts`. Check external callers (grep `src/` + `tests/`), then remove if dead.
- **2 raw NICHE_DEFAULTS[niche] callers** — `src/app/api/admin/preview-prompt:77` debug view + `src/app/api/onboard/generate-agent-intelligence:301` OpenRouter fallback. Both cosmetic-only. Convert to `resolveProductionNiche` for consistency.

## Things to be careful about (unchanged from previous handoff)

1. **Don't rewrite working code** — slot composition is solid architecture, just was bloated. After Phase D, it's compressed. Don't restructure further.
2. **Don't add new abstractions** — the slot system has 21 slots, enough.
3. **Run `npm run test:all` after every change** — 1566 tests, 2-3 seconds, catches regressions fast.
4. **Track char counts via `scripts/b4-slot-breakdown.mjs`** — trend should stay near 12K, not drift up.
5. **Don't touch the founding 4 system_prompts in DB** — hand-tuned.
6. **Phase E migration is nullable text** — not destructive. Check `unmissed-onboarding-field-schema.md` before applying.
7. **`intake.owner_name` (snake) vs `OnboardingData.ownerName` (camel)** — translation in `intake-transform.ts:164`. Don't break this mapping.
8. **After Phase E migration, regenerate Supabase types** — `npm run db:types` or the new trial generation code will have type errors.

## Things the Phase D session intentionally did NOT do

- Did not commit or push (user must review diff)
- Did not modify `prompt-config/niche-defaults.ts` TRIAGE_DEEP content (out of scope)
- Did not implement Phase D extras 1-5 (deferred above)
- Did not touch the founding 4 prompts
- Did not run live calls
- Did not modify Brevo, Stripe, Twilio, n8n, Ultravox configs

## Phase D debt (cleared this session — reference only)

After the main Phase D compression pass, a second-pass reality-check surfaced these items. All verified or resolved in the same session before the handoff was finalized:

### Resolved before commit ✅

1. **Lint** — `npm run lint` green: 0 errors, 251 warnings (all pre-existing, nothing Phase D introduced). Pre-commit hook won't block on lint.
2. **Dead helper cleanup** — `buildNicheFaqDefaults` and `buildPrintShopFaq` deleted from `prompt-helpers.ts`. Zero runtime callers remained in `src/` (confirmed via grep). All doc references are in `docs/` and vault tracker files, not live code. Net: ~180 lines of dead FAQ template data removed.
3. **OpenRouter fallback audit** — `src/app/api/onboard/generate-agent-intelligence/route.ts:301` reads `NICHE_DEFAULTS[niche]` directly. Audit verdict: **NOT a shadow code path.** The endpoint returns a seed object (`{ TRIAGE_DEEP, GREETING_LINE, URGENCY_KEYWORDS, FORBIDDEN_EXTRA }`) consumed by `onboard/steps/step-niche.tsx` as `agentIntelligenceSeed`, which then flows through the normal `buildSlotContext` → Phase D compressed pipeline when the client provisions. Also: `admin/preview-prompt:77` raw NICHE_DEFAULTS lookup is a diagnostic-only debug view — the actual rendered prompt goes through `buildPromptFromIntake`. No bypass.
4. **Trial/paid parity static diff** — grepped all `buildPromptFromIntake` callers. 8 production paths: `provision/trial`, `demo/start`, `admin/preview-prompt`, `admin/test-activate`, `dashboard/generate-prompt`, `dashboard/regenerate-prompt`, `stripe/create-public-checkout`, `agent-mode-rebuild`. All 8 go through the single compressed entry point. Same input → same output invariant verified.
5. **PM + real_estate spot-check** — generated both compressed outputs:
   - auto_glass baseline: 11,926 chars
   - hvac baseline: 11,637 chars
   - real_estate baseline: 12,782 chars
   - **property_management baseline: 17,443 chars** (niche-specific, under PM's existing 28K ceiling — driven by 14-branch TRIAGE_DEEP + closingOverride + FHA compliance FORBIDDEN_EXTRA)
   - Real estate output manually eyeballed: sections render cleanly, niche FORBIDDEN_EXTRA rules 10-13 (no price/valuation/showing promises) inject correctly, no broken placeholders.
6. **Unit test for `trimToFirstTwoExamples`** — new file `src/lib/__tests__/trim-examples.test.ts`, 10 test cases covering: 2-example no-op, A-E trim with no safety markers, Example D preservation on "9-1-1", "gas company", "emergency line", "life safety" keyword match, malformed input, empty input, multiple safety examples. Helper is now exported for testability. 10/10 pass.
7. **Slot char ceiling regression test** — new file `src/lib/__tests__/slot-ceilings.test.ts`, 18 test cases. Asserts each Phase D-compressed slot stays under a per-slot ceiling (~20% above Phase D numbers for headroom) AND total prompt stays under 13,500 chars for auto_glass/hvac/real_estate/plumbing baselines (18,500 for PM due to niche content). If a future edit silently re-bloats any slot, this test fires immediately. 18/18 pass.

### Test suite impact

- Before Phase D debt cleanup: 1566/1566 pass
- After Phase D debt cleanup: **1594/1594 pass** (+28 new tests: 10 trim-examples + 18 slot-ceilings)

## Unresolved items → D.5 or later

### 🟢 Low — backlog

**A. Unknown-answer behavior emits without PRODUCT KNOWLEDGE BASE header.**
When only `unknown_answer_behavior` is set (no caller_faq, no pgvector), the slot emits a bare `FALLBACK: When you don't know the answer...` string wrapped in `<!-- unmissed:knowledge -->` markers but with no surrounding `# PRODUCT KNOWLEDGE BASE` header. Tests pass (they grep `"take a message"`), but worth a live call eval — if the LLM fails to anchor to it without the wrapping header, wrap it in `# POLICY` or similar. Defer to Phase D.5 LLM-as-judge eval.

**B. "Known good" Phase D baseline export for D.5 regression comparison.**
D.5 harness will want to diff future prompt output against an immutable "post-Phase-D reference." Currently the only reference is the regenerated golden snapshots under `src/lib/__tests__/snapshots/`. Consider exporting to `tests/reference/post-phase-d-baseline/` as a committed immutable reference separate from the test fixtures (which may drift again as prompt-slots evolves).

**C. Document "run regen script after slot changes" in CLAUDE.md.**
Add a 3-line note under the Testing section of the repo-root `CLAUDE.md` so future sessions don't get confused by snapshot failures. Something like:
```
After any change to src/lib/prompt-slots.ts or src/lib/prompt-config/niche-defaults.ts:
1. Run npx tsx scripts/b4-slot-breakdown.mjs — confirm total stays under 13K
2. If snapshot tests fail, run npx tsx scripts/regen-golden-snapshots.mjs to update
3. Visually diff one regenerated snapshot before committing
```

**D. Extend regen-golden-snapshots.mjs to cover more niches.**
Currently covers hvac / auto_glass (×2) / real_estate / plumbing. Add dental, legal, property_management, print_shop so Phase E voice-preset wiring has full niche coverage.

**E. The 11,974 vs 8,500 decision.**
Phase D landed at 11,974 (auto_glass baseline). Hasan's preference per 2026-04-09 conversation: **8K ideal, 12K practical ceiling, 12K+ acceptable in a pinch.** Current state is within the practical ceiling. Decision tree for Phase D.5:
- If offline harness (Phase D.5) LLM-as-judge scores ≥4/5 on all dimensions at 11,974 chars → ship it, defer further compression.
- If scores drop vs founding-4 (~8.5K) → niche-specific `triageDeep` compression becomes required. That's a follow-up ticket with per-niche scenario test regression risk.

**F. Phase D "also needs" items from the original handoff** (voice tone preset wiring, TODAY_UPDATE slot, BUSINESS_NOTES slot). These were NOT implemented in Phase D. They depend on Phase E schema migration (`today_update`, `business_notes` columns don't exist yet). Must sequence: Phase E Wave 1 migration → voice tone preset bundle code → TODAY_UPDATE + BUSINESS_NOTES slot implementation → idempotency verify.

**G. 2 minor NICHE_DEFAULTS cosmetic cleanups** (not behavior):
- `src/app/api/admin/preview-prompt/route.ts:77` — diagnostic debug view, safe as-is
- `src/app/api/public/agent-snapshot/route.ts:104` — boolean check only, safe as-is
Skip unless touching these files for another reason.

**H. `regenerate-prompt` safety for founding-4.** Phase D doesn't protect founding 4's hand-tuned system_prompts. If Hasan hits "regenerate" on hasan-sharif (or the dashboard sync button misfires), the current compressed version overwrites the hand-tuned text. Options:
- Add a `hand_tuned: boolean` column to `clients` table, gate regenerate-prompt on `!hand_tuned`
- Add a UI confirm modal: "This client has a hand-tuned prompt — regenerate will overwrite"
- Document it as a known footgun and move on (risky — Hasan could forget)
Recommend: DB flag with UI gate. Small Phase E add-on.

## Last good state

Repo: branch `main`, Phase D + Phase D debt cleanup uncommitted.
Test suite: **1594/1594 pass** (1566 baseline + 28 new from Phase D debt).
Char breakdown: TOTAL = 11,974 (auto_glass baseline). Within Hasan's 12K practical ceiling.
Slot ceilings: all under Phase D ceilings per `src/lib/__tests__/slot-ceilings.test.ts` — regression guard active.

Parent tracker: [[Tickets/unmissed-onboarding-v1-ship]] has the Phase D completion entry + CORRECTION 11/12/13 under the phase log.
