# Execution Prompt: Other Niche Production-Ready

> Paste this into a fresh Claude Code session with working directory `/Users/owner/Downloads/CALLING AGENTs`

---

## Task

Extend `generate-agent-intelligence` to output 3 new fields (CLOSE_ACTION, INFO_TO_COLLECT, FAQ_DEFAULTS), persist all AI-generated config in a new `custom_niche_config` jsonb column, and wire regen to restore it. This makes `other` niche agents business-specific from day 1 without building a separate niche-generator.ts.

## Plan

Read the full plan first: `/Users/owner/.claude/plans/dapper-beaming-prism.md`
Follow it phase by phase. Do NOT deviate from the file list or invent additional changes.

## Execution order (7 phases, sequential — each depends on the prior)

### Phase 1 — Foundation
1. Create migration: `supabase/migrations/20260413100000_add_custom_niche_config.sql`
   - `ALTER TABLE clients ADD COLUMN IF NOT EXISTS custom_niche_config jsonb;`
2. Add `CustomNicheConfig` type to `src/types/onboarding.ts` (7 fields: triage_deep, greeting_line, urgency_keywords, forbidden_extra, close_action, info_to_collect, faq_defaults)

### Phase 2 — Extend generate-agent-intelligence
File: `src/app/api/onboard/generate-agent-intelligence/route.ts`
1. Add FIELD 5 (CLOSE_ACTION), FIELD 6 (INFO_TO_COLLECT), FIELD 7 (FAQ_DEFAULTS) to the AI prompt after FIELD 4
2. Update the JSON output format string to include the 3 new keys
3. Bump max_tokens from 1500 to 2000
4. Extend `AgentIntelligenceSeed` interface with optional CLOSE_ACTION, INFO_TO_COLLECT, FAQ_DEFAULTS
5. Update `buildFallbackSeed()` to include empty defaults for new fields
6. In the response parser: handle FAQ_DEFAULTS as string OR array (AI sometimes stringifies)

### Phase 2.5 — Frontend merge (CRITICAL — without this, new fields silently drop)
File: `src/app/onboard/steps/step-niche.tsx`
Two merge blocks (lines ~163-177 and ~316-327) copy intelligence seed into nicheCustomVariables. Add to BOTH:
```typescript
if (seed.CLOSE_ACTION) newVars.CLOSE_ACTION = seed.CLOSE_ACTION;
if (seed.INFO_TO_COLLECT) newVars.INFO_TO_COLLECT = seed.INFO_TO_COLLECT;
```
FAQ_DEFAULTS stays in agentIntelligenceSeed only — wired at provision time.

### Phase 3 — Persist in provision/trial
File: `src/app/api/provision/trial/route.ts`
1. After `mergedNicheVars` is built (~line 119), construct a `CustomNicheConfig` from `data.agentIntelligenceSeed` + `data.nicheCustomVariables`
2. Add `custom_niche_config` to the clients INSERT object
3. Wire FAQ_DEFAULTS into `intakeData.niche_faq_pairs` (only when no manual faqPairs exist)
4. Wire CLOSE_ACTION into `mergedNicheVars` (only when not already set)

### Phase 4 — Regen support
File: `src/app/api/dashboard/regenerate-prompt/route.ts`
1. Add `custom_niche_config` to the SELECT field list
2. After existing intakeData merge: if `client.custom_niche_config` exists AND niche is 'other', restore AI vars as baseline with existing niche_custom_variables taking priority (dashboard edits win)

### Phase 5 — Hours fallback
File: `src/lib/client-to-synthetic-intake.ts`
Line 117: change `'Monday-Friday 9 AM-5 PM'` fallback to `'Hours not set - ask the owner'`

### Phase 6 — Verify
1. `npm run build` — must pass
2. `npm test` — all existing tests must pass
3. Confirm no regressions in voicemail-slot-parity tests

## Constraints
- Do NOT create `src/lib/niche-generator.ts` — absorbed into this approach
- Do NOT touch `voicemail-prompt.ts` or `prompt-builder.ts` — already clean
- Do NOT touch `step1-gbp.tsx` or `autofill/route.ts` — GBP hours already work
- Apply the CLAUDE.md pre-ship checklist (phantom-data, dual-pipeline, silent-save)
- Import `CustomNicheConfig` type — don't inline-define it in multiple files

## Context docs (read if needed)
- Planet Snoopy audit: `~/.claude/plans/idempotent-wobbling-dahl.md`
- Original niche-generator plan: `docs/niche-generator-plan.md`
- Combined plan: `~/.claude/plans/dapper-beaming-prism.md`
