---
type: tracker
status: planned
priority: P2
phase: post-PR-87
related:
  - Clients/velly-remodeling
  - Tracker/D445-snowflake-migration-playbook
  - Features/Knowledge-RAG
  - Architecture/Control-Plane-Mutation-Contract
opened: 2026-05-06
spawned-by: PR #87 (home_renovation niche shipped)
---

# D-NEW — Velly Remodeling: KB enrichment + niche migration `other` → `home_renovation`

## Status
**planned (not started).** Spec written 2026-05-06 right after PR #87. Eric is **live** on +1 (306) 988-7699 — any work must avoid disrupting active calls.

## Why
1. Velly currently lives on `niche='other'` because home_renovation didn't exist when he was provisioned. Now it does (PR #87) — he should be on the proper niche to inherit:
   - Renovation-specific TRIAGE_DEEP (URGENT DAMAGE / NEW PROJECT QUOTE / SMALL REPAIR / COMMERCIAL / PERMIT)
   - Kb-aware FORBIDDEN_EXTRA (KB-first for general rates / route specifics for site visit)
   - Site-visit-aware pricing language built into prompt
   - Active water leak / structural / fire damage emergency routing
2. Velly has **0 approved KB chunks** today (verified 2026-05-06 dryrun). Without KB, the kb-aware pattern emits `queryKnowledge` instructions but the tool returns nothing — the agent will see the rule and route everything anyway. KB enrichment is the prerequisite for the niche migration to actually change behavior.

## Pre-flight constraints
- Eric is **live**. Owner is Kausar (Hasan's uncle), founding-29 plan, 100-min cap.
- Telegram notifications go to +1 (306) 241-6312.
- `hand_tuned=true` per memory + DB audit. Recompose requires `forceRecompose=true` to override.
- Concierge hand-tuning may exist in current prompt (8,342 chars). Force-recompose **wipes it**.

## Phased plan

### Phase A — KB enrichment (no agent disruption)
**Goal:** Get Velly to ~15+ approved KB chunks before any prompt change.

1. **Website scrape** — `https://www.vellyremodeling.com/` is in his intake. Trigger via dashboard scrape pipeline OR direct call to `/api/dashboard/scrape-website`. Review extracted chunks → approve relevant ones.
2. **GBP enrichment** — pull Google Business Profile facts (services, hours, service area) and seed via `/api/dashboard/knowledge/compile`.
3. **Manual curation** — add ~8 high-value Q&As covering:
   - Service areas (Saskatoon + radius)
   - Project types Velly takes on (kitchen, bath, basement, addition, whole-home, basement suites)
   - Approximate price ranges if Kausar approves publishing them (per-sq-ft, package tiers)
   - Typical timelines (kitchen 4-6 weeks, basement 6-8 weeks, etc. — get actuals from Kausar)
   - Licensing + insurance status
   - Permit handling (do they pull permits or owner pulls?)
   - Warranty terms
   - Free consultation offer + how site visits are scheduled
4. **Approve all chunks** to `status='approved'`. Verify count via:
   ```sql
   select count(*) from knowledge_chunks
   where client_id = (select id from clients where slug='velly-remodeling')
   and status='approved';
   ```

**Gate:** Don't proceed to Phase B until chunk count >= 15.

### Phase B — Pre-migration audit (read-only)
1. Save current state snapshot:
   ```bash
   npx tsx scripts/dryrun-kb-aware-rollout.ts  # already includes velly
   ```
2. Compare current `clients.system_prompt` to what `home_renovation` niche would produce. Adapt this script:
   - Read current prompt → `/tmp/velly-current.txt`
   - Manually update intake `niche='home_renovation'` in memory + run `buildPromptFromIntake()` → `/tmp/velly-home_renovation.txt`
   - `diff` the two
3. **Diff review with Kausar** (if any concierge phrases worth preserving):
   - Look for any Velly-specific custom phrases in the current 8,342-char prompt that aren't in the home_renovation template
   - Capture them in `niche_custom_variables` so they survive the migration

**Gate:** Don't proceed without explicit Kausar approval if the diff loses anything material.

### Phase C — Niche update + dryrun
1. Update `clients.niche` from `'other'` to `'home_renovation'`:
   ```sql
   update clients set niche='home_renovation', updated_at=now()
   where slug='velly-remodeling';
   ```
   Note: This is a niche change post-provision. Per `docs/architecture/control-plane-mutation-contract.md` Risk #1, niche is `set once at provision; no settings PATCH path`. The DB column update IS supported, but `buildAgentTools()` won't re-run automatically. Need explicit `syncClientTools()` after.
2. Adapt `scripts/recompose-brian.ts` for slug `velly-remodeling` with `forceRecompose=true`. Add a backup snapshot dump before deploy:
   ```ts
   fs.writeFileSync(`/tmp/velly-pre-migration-${Date.now()}.json`, JSON.stringify({
     systemPrompt: currentPrompt,
     niche: 'other',  // pre-migration
     hand_tuned: true,
     timestamp: new Date().toISOString(),
   }, null, 2))
   ```
3. Run dryrun first. Expected:
   - Char count: should be ~14-18K with KB enriched (was +6,456 to 14,231 even with 0 chunks; with chunks the dynamic FORBIDDEN_ACTIONS slot will add the kb-priming block, ~+200 chars)
   - New kb-aware fragments: `queryKnowledge first`, `For typical project timelines`, `For general published rates`
   - Old blanket fragments stripped: 0 (Velly never had any since he was on `other`)
   - Safety guards: should preserve URGENT damage flag

### Phase D — Live deploy
1. Coordinate with Kausar for low-traffic window (evening or weekend, not during work hours).
2. Run live recompose: `npx tsx scripts/recompose-velly.ts --live`.
3. Immediately after, run `syncClientTools()` to rebuild `clients.tools` with the new niche's capability flags (transfer + KB lookup + emergency routing).
4. Verify Ultravox PATCH succeeded:
   ```bash
   curl -H "X-API-Key: $ULTRAVOX_API_KEY" \
     "https://api.ultravox.ai/api/agents/{velly_agent_id}" | jq '.callTemplate.systemPrompt | length'
   ```
5. Fix `active_prompt_version_id` pointer (D-NEW-recompose-active-pointer bug):
   ```bash
   npx tsx scripts/fix-active-prompt-version.ts velly-remodeling
   ```

### Phase E — Validation
1. **Test call** from Hasan's phone to Velly's number. Run through:
   - "I'm looking to renovate my kitchen, can I get a quote?" → expect site-visit framing, name + address + scope collection
   - "What does it usually cost to do a basement?" → expect `queryKnowledge` fire + general range answer (if KB has it)
   - "I've got water leaking from the upstairs bathroom" → expect URGENT flag + emergency routing
   - "Just need someone to patch some drywall" → expect SMALL REPAIR flow
2. Check `tool_invocations` table within 5 min of the test call:
   ```sql
   select tool_name, parameters, response_summary, created_at
   from tool_invocations
   where client_id = (select id from clients where slug='velly-remodeling')
   order by created_at desc limit 10;
   ```
3. Real-call observation window: 7 days. Watch for any regression in Eric's tone or completion rate. Compare to the current concierge prompt.
4. **Burn-in flip:** if Velly stable for 7 days, flip `hand_tuned=false` so future dashboard edits auto-regenerate (matches windshield-hub post-migration pattern from memory).

## Rollback plan
If Phase D causes a problem:
1. Restore prompt from the `/tmp/velly-pre-migration-*.json` snapshot:
   ```sql
   update clients set
     system_prompt = '<saved prompt>',
     niche = 'other',
     hand_tuned = true,
     updated_at = now()
   where slug = 'velly-remodeling';
   ```
2. PATCH Ultravox agent with the restored prompt via `updateAgent()`.
3. Run `syncClientTools()` to rebuild tools matching `niche='other'`.

Rollback should take under 2 minutes. Worst case downside is Eric reverts to the old behavior — no data loss.

## Acceptance criteria
- [ ] KB chunk count >= 15 (Phase A complete)
- [ ] Diff reviewed with Kausar; any concierge phrases preserved in `niche_custom_variables`
- [ ] `clients.niche = 'home_renovation'` in DB
- [ ] `clients.system_prompt` includes `queryKnowledge first` and `home_renovation` TRIAGE_DEEP markers
- [ ] Ultravox agent PATCHed and prompt size matches DB (modulo marker stripping)
- [ ] `tool_invocations` shows `queryKnowledge` fires for KB-shaped questions in test call
- [ ] No regression in 7-day call observation window
- [ ] `hand_tuned` flipped to `false` after burn-in

## Resume keys
- "do velly kb enrichment" — start Phase A
- "velly migration phase B" — pre-migration audit (after KB enriched)
- "velly migration live" — Phases C + D + E (only after Kausar approval)

## Connections
- → [[Clients/velly-remodeling]]
- → [[Tracker/D445-snowflake-migration-playbook]] (same pattern, different client)
- → [[Tracker/D-NEW-recompose-active-pointer]] (will need pointer fix in Phase D)
- → [[Features/Knowledge-RAG]] (Phase A enrichment depends on this pipeline)
