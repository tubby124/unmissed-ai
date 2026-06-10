---
type: next-chat-resume
status: ready
created: 2026-06-03
project: unmissed
parent: "[[../../Obsidian Vault/Projects/unmissed/2026-06-03-harness-end-to-end-phase1a-shipped]]"
related:
  - "[[../../Obsidian Vault/Projects/unmissed/2026-06-03-knowledge-routing-audit-layer1-results]]"
  - "[[../../Obsidian Vault/Projects/unmissed/2026-06-02-night-system-fix-master-plan]]"
tags:
  - next-chat
  - prompt-slim
  - fleet-harness
  - system-wide
---

# NEXT-CHAT — System-Wide Prompt Slim Kickoff

## Session-start command (paste this into the new chat)

```
Read CALLINGAGENTS/00-Inbox/NEXT-CHAT-system-wide-slim-kickoff.md and the
parent vault note 2026-06-03-harness-end-to-end-phase1a-shipped.md.

Pick up at Step 0: verify the 3 fleet-baseline agents (urban-vibe,
windshield-hub, hasan-sharif) finished cleanly, then validate that Phase 1a
actually improved queryKnowledge call rate in production via real Brian calls,
then continue with Steps 4-7 of the system-wide slim.

Standing rules: no redeploys to hasan-sharif, exp-realty, urban-vibe,
windshield-hub without explicit owner go. Brian (calgary-property-leasing)
has carve-out — but ask before pushing Phase 1a live.
```

## UPDATE 2026-06-03T21:30Z — Phase 1a SHIPPED LIVE to Brian

`npx tsx scripts/recompose-brian.ts --live` succeeded.

- DB chars: 23,184 → **22,493** (−691)
- `active_prompt_version_id`: `492cd655-c996-4a81-9550-287d88937149`
- Rollback target: `prompt_versions.id=e3d37526-bc1d-4dc8-afd6-20286d93acb1`
- Tools array intact (5 items, queryKnowledge present)
- Production validation = **PENDING one Tier-2 WebRTC test call** (see below)

Vault note: [[../../../Obsidian Vault/Projects/unmissed/2026-06-03-brian-phase1a-pushed-live]]

Known gaps still failing after Phase 1a (queued for Phase 1c, FORBIDDEN_EXTRA rule):
- Utilities scenario — agent hallucinates "heat and water included for most units"
- Application-process scenario — agent invents specific application steps

Step 0 (fleet baselines) complete for all 5 clients including Velly Remodeling (home_renovation niche scaffolded fresh this session).

---

## UPDATE 2026-06-04T05:00Z — SESSION COMPLETE — Brian identity-tier SHIPPED

This kickoff is SUPERSEDED. Identity-tier work shipped live to Brian at 2026-06-04T04:40Z.

**Next session focus:** production-grade harness foundation — see [[NEXT-CHAT-production-harness-foundation]].

Full session summary: [[../../../Obsidian Vault/Projects/unmissed/2026-06-04-big-day-session-summary]]

Production state:
- Brian `prompt_versions.id`: 167076cd-7c3b-4965-bc5a-acf82caa2079 (25,243 chars)
- Rollback: 492cd655-c996-4a81-9550-287d88937149 (Phase 1a, 22,493 chars)
- Tier-2 validated, 31/31 stress, 23/25 real-call replay

---

## UPDATE 2026-06-03T23:30Z — Identity-tier architecture proven on Brian (offline)

Tier-1 results on the new identity-tier prompt draft (NOT yet deployed):
- **Routing strict: 6/6** (Phase 1a was 4/6)
- **Scenario regression: 14/15** (Phase 1a was 13/15)
- Prompt size: 23,813 chars (+1,320 vs Phase 1a, under 25K hard max)

What landed in code (still offline):
- `src/lib/prompt-config/niche-identity.ts` (NEW classifier)
- `src/lib/knowledge-summary.ts` (renders `## Identity` block at top of businessFacts)
- `src/lib/prompt-slots.ts:281` (kbPriming restructured: DEFAULT policy bridge, EXCEPTION = 5 identity topics)
- `src/lib/prompt-config/niche-defaults.ts` (PM SCOPE, TRIAGE_DEEP, FORBIDDEN_EXTRA — added UTILITIES + APPLICATION + PET RULES NEVERs with ESA Fair Housing carve-out)
- `tests/promptfoo/snapshots/brian-identity-tier-2026-06-03.txt` (frozen draft)
- `tests/promptfoo/harness/brian-routing-identity-tier.yaml` (test asserts INSTANT for areas, BRIDGE for policy)
- `tests/promptfoo/baselines/brian-{routing,baseline}-identity-tier-2026-06-03*.json`

Phase 1c utilities + application-process hallucinations BOTH fixed in this iteration. Pet rules safe. ESA Fair Housing preserved. Areas-served answers instantly.

Vault: [[../../../Obsidian Vault/Projects/unmissed/2026-06-03-identity-tier-architecture-plan]]

**Ready to ship to Brian via `recompose-brian.ts --live` pending Hasan go.**

## UPDATE 2026-06-03T23:35Z — Auto-harness onboarding plan written

Research-grounded plan for "harnesses just work when a client is onboarded automatically" — 60-90 scenarios per client (production floor per Hamming AI 2026 + Cekura voice-AI metrics guide), 3 layers (niche template + auto-generated from extra_qa + optional manual). Phased rollout starting with property_management niche template, then `scripts/generate-client-harness.ts` to auto-gen at provision time.

Vault: [[../../../Obsidian Vault/Projects/unmissed/2026-06-03-auto-harness-onboarding-plan]]

## UPDATE 2026-06-03T21:55Z — Tier-2 harness validated by Hasan + perf finding

Hasan ran the harness on Brian, confirmed it works, called it "extremely important" and "clear." Approved as canonical test path.

**New finding to investigate (not blocking):** Hasan reported the Tier-2 WebRTC path "loaded better" than the production inbound system. Possible causes: (1) Twilio bridge setup latency, (2) Agents API `templateContext` substitution vs inline-prompt createCall, (3) `firstSpeakerSettings.agent.delay: '1s'` on production template that Tier-2 omits, (4) `toolOverrides` rebuild at call time. Worth A/B-ing in the optimization pass. See `Projects/unmissed/2026-06-03-live-test-harness-tier2.md` for full finding.

---

## UPDATE 2026-06-03T21:45Z — Tier-2 live-test harness SHIPPED

`scripts/test-prompt-live.ts` + `public/test-prompt-live.html` ship a CLI tool that runs a REAL Ultravox WebRTC call against any client's live config with ZERO owner notifications (no callbackUrl → no completed webhook → no Telegram/SMS/email). This replaces "call the line" as the canonical validation path.

```bash
npx tsx scripts/test-prompt-live.ts --slug calgary-property-leasing
```

Browser opens → click Connect → talk → hang up. CLI auto-pulls transcript + tool invocations from Ultravox, greps for hallucination markers, scores bridge phrases + queryKnowledge fires. Saves report to `tests/promptfoo/live-tests/`.

Vault note: [[../../../Obsidian Vault/Projects/unmissed/2026-06-03-live-test-harness-tier2]]

**Brian Phase 1a validation = run this script, ask "what areas do you guys cover?" — pass condition: zero Edmonton markers, ≥1 bridgePhraseHit.**

Going forward: EVERY phase change is gated on a clean Tier-2 run before any `--live` recompose. No more PSTN calls for testing.

---

## UPDATE 2026-06-03 — Fleet baseline complete, key strategic finding

See [2026-06-03-fleet-baseline-complete.md](2026-06-03-fleet-baseline-complete.md) for full table. Headline:

| Client | Niche | Chars | Routing strict |
|---|---|---:|---:|
| Brian | property_management | 23,184 | 2/6 (33%) |
| Urban Vibe | property_management | 22,903 | 4/6 (67%) |
| Mark | auto_glass | 16,537 | 5/6 (83%) |
| **Hasan** | **real_estate** | **8,415** | **6/6 (100%)** |

**HASAN'S PROMPT IS THE TARGET STATE.** Hand-slimmed, 36% the size of Brian's, beats Brian on every metric. Under the 12K GLM-4.6 max. Proves the slim plan is not aspirational — the slot pipeline CAN produce this. Reference his structure when designing PM/auto_glass slim.

**Caveat:** Hasan's prompt has no FHA / demographic literals (13/17 real_estate fingerprints fail). The agent flagged it as the only regulatory implication. Track for next prompt regen — separate workstream from slim.

**Urban Vibe Phase 1a auto-validation candidate:** 6 of UV's 7 scenario failures are exactly what Phase 1a TRIAGE_DEEP targets ("no heat → asks if emergency" pattern). Recomposing UV dryrun with Phase 1a applied should improve their scores without any UV-specific code change — same niche-defaults, same edit, same niche. Validate this in Step 1b.

## Where we left off

Phase 1a of the prompt slim is **code-applied, not deployed** ([src/lib/prompt-config/niche-defaults.ts](../../src/lib/prompt-config/niche-defaults.ts) — property_management TRIAGE_DEEP). Improved Brian's offline harness:
- Routing strict: 2/6 → **4/6**
- Scenario regression: 13/15 → **13/15** (no regression)
- Fingerprints: 13/14 → **14/14**
- Prompt size: 23,184 → 22,493 chars (−691)

Phase 1b (FORBIDDEN_EXTRA compression) was **reverted** — broke 3 scenarios + 2 routing tests. Lesson locked in: verbose specificity in safety rules is doing real anchoring work for Llama-class models. Don't bytes-compress; restructure.

End of last session: 3 parallel agents launched to capture fleet baselines for the other 4 clients (urban-vibe is the 1st of 4; exp-realty deferred to share real_estate scaffolding with hasan-sharif).

## Step 0 — Verify agent outputs (DO THIS FIRST)

The 3 agents wrote frozen baseline JSON files to `tests/promptfoo/baselines/`. Confirm they exist and pass-rate looks sane:

```bash
ls -la tests/promptfoo/baselines/*2026-06-03*.json
for f in urban-vibe windshield-hub hasan-sharif; do
  for suite in baseline routing; do
    suf=$([ $suite = routing ] && echo "-strict" || echo "")
    F="tests/promptfoo/baselines/${f}-${suite}-current-2026-06-03${suf}.json"
    [ -f "$F" ] && jq -r --arg t "$f $suite" '.results.stats | "\($t): PASS=\(.successes)/\(.successes + .failures)"' "$F"
  done
done
```

Also confirm these new scaffold files exist:
- `tests/promptfoo/harness/fingerprints/auto_glass.txt`
- `tests/promptfoo/harness/fingerprints/real_estate.txt`
- `tests/promptfoo/harness/urban-vibe-knowledge-routing.yaml`
- `tests/promptfoo/harness/windshield-hub-knowledge-routing.yaml`
- `tests/promptfoo/harness/hasan-sharif-knowledge-routing.yaml`

If any are missing, inspect the agent transcripts:
```
ls /private/tmp/claude-501/-Users-owner/*/tasks/ac*.output 2>/dev/null
```

Don't deep-read the transcripts (they're huge). Just look for the final "Report back" summary.

## Step 1b — Validate Phase 1a auto-improves Urban Vibe (5 min, no deploy)

UV is property_management too. Phase 1a's TRIAGE_DEEP edit lives in shared niche-defaults — UV inherits on recompose. Confirm offline:

```bash
# Write a recompose-urban-vibe.ts script if not present (mirror scripts/recompose-brian.ts)
# Or use the existing scripts/snapshot-mark-dryrun.ts pattern.

# Generate Phase 1a snapshot for UV
npx tsx scripts/recompose-urban-vibe.ts --dryrun \
  > tests/promptfoo/snapshots/urban-vibe-phase1a-2026-06-04.txt

# Re-run all 3 harness tests against the new snapshot
./tests/promptfoo/harness/check-fingerprints.sh \
  tests/promptfoo/snapshots/urban-vibe-phase1a-2026-06-04.txt \
  tests/promptfoo/harness/fingerprints/property_management.txt

npx promptfoo eval -c tests/promptfoo/urban-vibe-test.yaml --no-cache \
  --var system_prompt=file://snapshots/urban-vibe-phase1a-2026-06-04.txt \
  --output tests/promptfoo/baselines/urban-vibe-baseline-phase1a-2026-06-04.json

npx promptfoo eval -c tests/promptfoo/harness/urban-vibe-knowledge-routing.yaml --no-cache \
  --var system_prompt=file://../snapshots/urban-vibe-phase1a-2026-06-04.txt \
  --output tests/promptfoo/baselines/urban-vibe-routing-phase1a-2026-06-04-strict.json
```

Expected: scenario goes UP from 7/13. Routing strict stable or up from 4/6. If scenario drops, Phase 1a isn't universally helpful for PM and may need niche-conditional logic.

## Step 1 — Validate queryKnowledge improvement in production (user's explicit ask)

The offline harness shows Phase 1a improves bridge-without-hallucination from 2/6 → 4/6. The user wants to confirm this translates to **actual `queryKnowledge` tool invocations in real calls**.

Two options:
1. **Browser-test (no live impact, no billing):** POST to `/api/dashboard/browser-test-call` with `slot=draft` and the Phase 1a recomposed prompt. Run 3-4 policy-question scenarios (areas served, application process, pet rules, utilities). Check via Ultravox call logs whether `queryKnowledge` actually fired.
2. **Live deploy to Brian (Hasan's call):** Run `npx tsx scripts/recompose-brian.ts --live` → patches Ultravox agent. Then wait for or trigger a real test call. Query `tool_invocations` table in Supabase for `tool_name='queryKnowledge'` against Brian's calls in the last 24h.

**Recommended path:** Browser-test first (free, low-risk, no customer impact). If 3-4 of 4 fire `queryKnowledge`, propose live deploy. If 0-1 fire, the offline Llama proxy isn't predicting GLM-4.6 behavior and Phase 1a may need refinement before deploy.

The browser-test pattern is documented in [docs/architecture/call-path-capability-matrix.md](../../docs/architecture/call-path-capability-matrix.md) Path B/F.

## Step 2 — Capture exp-realty baseline (5 min, copy work)

exp-realty (Omar) is real_estate niche. After hasan-sharif agent shipped real_estate scaffolding in Step 0:

```bash
# Use existing snapshot
ls tests/promptfoo/snapshots/exp-realty-current-2026-06-02.txt

# Fingerprint check (reuse real_estate.txt)
./tests/promptfoo/harness/check-fingerprints.sh \
  tests/promptfoo/snapshots/exp-realty-current-2026-06-02.txt \
  tests/promptfoo/harness/fingerprints/real_estate.txt

# Copy hasan-sharif knowledge-routing yaml → exp-realty, swap names
cp tests/promptfoo/harness/hasan-sharif-knowledge-routing.yaml \
   tests/promptfoo/harness/exp-realty-knowledge-routing.yaml
# Edit: business_name + close_person + snapshot path

# Scenario regression
npx promptfoo eval -c tests/promptfoo/exp-realty-test.yaml --no-cache \
  --output tests/promptfoo/baselines/exp-realty-baseline-current-2026-06-03.json

# Knowledge routing
npx promptfoo eval -c tests/promptfoo/harness/exp-realty-knowledge-routing.yaml --no-cache \
  --output tests/promptfoo/baselines/exp-realty-routing-current-2026-06-03-strict.json
```

After this you have **all 5 clients baselined**. Fleet visibility achieved.

## Step 3 — System-wide slim begins (the actual work)

With 5 frozen baselines as the safety net, attack the shared slot machinery in order of safest-to-riskiest:

### 3a — Drop `grammar` slot (smallest, audit-doc validated)
- Audit doc: pure duplicate of voice_naturalness ("contractions, no markdown, no emojis" overlaps)
- Edit: [src/lib/prompt-slots.ts](../../src/lib/prompt-slots.ts) `buildGrammar()` and remove from composer order
- Optionally fold one-line essence into voice_naturalness if anything is uniquely there
- Recompose all 5 clients → run all 5 harness suites → compare to baselines
- If any client regresses, restore `grammar` slot and investigate

### 3b — Merge `tone_and_style` → `voice_naturalness`
- Audit doc: heavy overlap, both teach calm/conversational register
- Pick the better one, fold unique lines from the other
- Same 5-client validate cycle

### 3c — Compress `kbPriming` in `buildForbiddenActions()`
- The kbPriming block (lines 280-282 of prompt-slots.ts) duplicates Phase 1a TRIAGE_DEEP QUESTION INTAKE guidance for property_management. For other niches, it's the primary queryKnowledge directive.
- Hypothesis: shorten to a 1-line "BEFORE deflecting any factual question, call queryKnowledge first" referring to the niche TRIAGE_DEEP for details
- Same 5-client validate cycle. If real_estate or auto_glass routing-strict drops, kbPriming was load-bearing for them → revert and design differently

### 3d — Compress universal forbidden rules (Rules 1-10) ONE AT A TIME
- Phase 1b lesson: never compress 7 rules in one go
- Take rule 2 ("Never say 'certainly,' 'absolutely'...") — examine. Compress or leave. Test.
- Move to rule 4 ("Ask one question per turn"). Test.
- Etc. Stop and revert any rule whose compression regresses ANY client's harness.

### 3e — Property_management TRIAGE_DEEP 13 branches → 6 (Brian-specific, deferred)
- High risk. Per Phase 1b lesson, branch detail anchors behavior.
- Approach: pick the 2 smallest related branches (LEASE_RENEWAL + MOVE_IN_OUT — both lease-lifecycle) and merge into "LEASE_LIFECYCLE." Validate. If clean, merge another pair.
- Don't attempt the full 13→6 collapse in one go.

## Step 4 — Close the architectural leak (the system-wide fix)

[src/lib/prompt-slots.ts](../../src/lib/prompt-slots.ts) `buildFaqPairs()`:
- Use `__SKIP__` sentinel pattern (same as NICHE_EXAMPLES per PR #78)
- `extra_qa` must inject ONLY via `businessFacts` templateContext at call time, never baked into stored `system_prompt`
- Same for `business_facts` — if it's leaking into stored prompt anywhere, route it to runtime injection

Add a unit test that gates this permanently:
```typescript
test('extra_qa never leaks into stored system_prompt', async () => {
  const client = { /* ... */, extra_qa: [{ question: 'X', answer: 'Y' }] }
  const prompt = await recomposePrompt(client.id, ...)
  assert(!prompt.includes('Y'), 'extra_qa answer leaked into stored prompt')
})
```

**Why this is the actual "every new client" fix:** Without this, every onboarding with populated extra_qa or business_facts re-bloats the prompt on every recompose. Phase 1a's slim is undone the next time the operator edits an FAQ.

## Step 5 — CI gate

Add to pre-push hook (`.husky/pre-push` or equivalent):
```bash
# Regenerate all 5 snapshots
for slug in calgary-property-leasing urban-vibe hasan-sharif exp-realty windshield-hub; do
  npx tsx scripts/recompose-${slug}.ts --dryrun
done
# Run fingerprint check on each
# Char-count gate: any > 12,000 fails
# Run knowledge-routing eval, must beat baseline
```

If pre-push too slow, move to GitHub Actions on PR.

## Step 6 — Onboarding-time gate (the user-facing fix)

In the provision/trial route + activate-client flow:
```typescript
// after prompt generation:
const promptChars = generatedPrompt.length
if (promptChars > 12000) {
  return { error: 'Prompt exceeds 12K char limit', surfaceToOperator: true }
}
const fingerprintsPass = checkFingerprints(generatedPrompt, niche)
if (!fingerprintsPass) {
  return { error: 'Niche fingerprints failed', surfaceToOperator: true }
}
```

When this ships, **every new client onboarded inherits a CLEAN prompt by default** — no more 30K char bloat for future Hasan #2 / Omar #3 / Mark #4.

## Files modified in last session

```
src/lib/prompt-config/niche-defaults.ts  (Phase 1a TRIAGE_DEEP edit — 5 ins, 9 del)
tests/promptfoo/brian-baseline.yaml      (provider swap to Groq Llama 70b)
tests/promptfoo/harness/*                (NEW — full reusable harness)
tests/promptfoo/baselines/*              (NEW — frozen score JSONs)
tests/promptfoo/snapshots/brian-phase1a-2026-06-03.txt  (NEW)
CALLINGAGENTS/00-Inbox/2026-06-03-harness-before-baseline.md  (NEW)
~/Downloads/Obsidian Vault/Projects/unmissed/2026-06-03-harness-end-to-end-phase1a-shipped.md  (NEW)
```

Plus whatever the 3 background agents produced (verify in Step 0).

## Standing rules (reminder)

- **No redeploys** to hasan-sharif, exp-realty, urban-vibe, windshield-hub without explicit owner go
- **calgary-property-leasing (Brian) has carve-out** — but ask before `--live` recompose
- **Brian's trial expires 2026-06-15** — 12 days. Slim should ship before then
- **Auto Mode pattern:** edit → recompose → harness → numbers — wait for go on next phase. Don't bundle phases
- **Phase 1b lesson:** verbose specificity in safety rules anchors behavior — bytes-only compression breaks things even when fingerprints survive
- **Cache-break protection:** do NOT edit CLAUDE.md, .mcp.json, or settings.json mid-session

## Key references

- Audit doc: [CALLINGAGENTS/00-Inbox/2026-06-02-brian-prompt-audit.md](2026-06-02-brian-prompt-audit.md)
- Locked BEFORE numbers: [CALLINGAGENTS/00-Inbox/2026-06-03-harness-before-baseline.md](2026-06-03-harness-before-baseline.md)
- Harness workflow: [tests/promptfoo/harness/README.md](../../tests/promptfoo/harness/README.md)
- GLM-4.6 rules: [memory/glm46-prompting-rules.md](../../memory/glm46-prompting-rules.md)
- Per-call-context contract: [docs/architecture/per-call-context-contract.md](../../docs/architecture/per-call-context-contract.md)
- Vault index: [_MOC](../../../Obsidian%20Vault/_MOC.md)
