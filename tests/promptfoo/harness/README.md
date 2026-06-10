# Prompt-Slim Harness

Reusable test harness for measuring **before vs after** behavior on any voice-agent client. Originally built for Brian (calgary-property-leasing) prompt slim; designed so every onboarded client can plug in with one fingerprint file and a snapshot.

## What it measures

| Metric | How | Where |
|---|---|---|
| **Prompt size** | `wc -c` on snapshot | bash one-liner |
| **Sacred-rule preservation** | Fixed-string grep for 13+ niche-specific fingerprints | [check-fingerprints.sh](./check-fingerprints.sh) |
| **Scenario regression** | 12+ promptfoo scenarios (greeting, safety, scope, FHA, ESA, bedbug, injection, RTA, etc.) | [../brian-baseline.yaml](../brian-baseline.yaml) |
| **queryKnowledge routing rate** | 6 policy questions, asserts bridge-phrase + intent-to-lookup | [brian-knowledge-routing.yaml](./brian-knowledge-routing.yaml) |
| **Real-caller regression** | 25 production opening lines from real calls | [../brian-replay-2026-06-02.yaml](../brian-replay-2026-06-02.yaml) |

## Required env

```bash
export GROQ_API_KEY=…   # via ~/.secrets, sourced by ~/.zshrc
```

Provider is `groq:llama-3.3-70b-versatile` — open-weight transformer, closest proxy to Ultravox v0.7 / GLM-4.6. Same long-context "lost in the middle" failure mode → catches the bugs that bite in production. Free + ~300 tok/sec.

## Per-client workflow

### Step 1 — Snapshot CURRENT prompt

```bash
# From DB (preferred):
psql "$DATABASE_URL" -c "SELECT system_prompt FROM clients WHERE slug='<slug>'" \
  | tail -n +3 | head -n -2 \
  > tests/promptfoo/snapshots/<slug>-current-$(date +%Y-%m-%d).txt

# Or from a recompose dryrun:
npx tsx scripts/recompose-<slug>.ts --dryrun \
  > tests/promptfoo/snapshots/<slug>-current-$(date +%Y-%m-%d).txt

# Size check:
wc -c tests/promptfoo/snapshots/<slug>-current-*.txt
```

### Step 2 — Run the 3 baselines

```bash
# A. Scenario regression (12 + scenarios)
npx promptfoo eval -c tests/promptfoo/<slug>-baseline.yaml \
  --no-cache \
  --output tests/promptfoo/baselines/<slug>-baseline-current-$(date +%Y-%m-%d).json

# B. Knowledge-routing rate (6 policy questions)
npx promptfoo eval -c tests/promptfoo/harness/<slug>-knowledge-routing.yaml \
  --no-cache \
  --output tests/promptfoo/baselines/<slug>-routing-current-$(date +%Y-%m-%d).json

# C. Fingerprint check (13+ sacred substrings)
./tests/promptfoo/harness/check-fingerprints.sh \
  tests/promptfoo/snapshots/<slug>-current-$(date +%Y-%m-%d).txt \
  tests/promptfoo/harness/fingerprints/<niche>.txt
```

### Step 3 — Make prompt changes

Edit [src/lib/prompt-config/niche-defaults.ts](../../../src/lib/prompt-config/niche-defaults.ts) or [src/lib/prompt-slots.ts](../../../src/lib/prompt-slots.ts).

### Step 4 — Snapshot the proposed prompt

```bash
npx tsx scripts/recompose-<slug>.ts --dryrun \
  > tests/promptfoo/snapshots/<slug>-proposed-$(date +%Y-%m-%d).txt
```

### Step 5 — Run the 3 baselines AGAINST the proposed snapshot

Same 3 commands as Step 2, but with `--var system_prompt=file://…<slug>-proposed-…txt` and `--output …proposed-…json`.

### Step 6 — Compare

| Check | Pass condition |
|---|---|
| Scenario regression | passed-count ≥ baseline (no behavioral drift) |
| Knowledge routing | bridge-phrase rate ≥ baseline + 50% (P2 success criterion) |
| Fingerprints | 100% — no sacred rule dropped |
| Prompt size | ≤ 12,000 chars (GLM-4.6 hard max per [memory/glm46-prompting-rules.md](../../../memory/glm46-prompting-rules.md)) |

If all 4 pass: deploy via `/prompt-deploy <slug>`. If any fail: investigate before deploying.

## Adding a new client

```
1. Identify the niche (property_management, real_estate, auto_glass, dental, ...)
2. Confirm tests/promptfoo/harness/fingerprints/<niche>.txt exists
   - If not, draft one — list the 10-15 substrings the niche prompt MUST contain.
3. Copy tests/promptfoo/brian-baseline.yaml → tests/promptfoo/<slug>-baseline.yaml
   - Swap: business_name, agent_name, slug, snapshot path
   - Add niche-specific scenarios (replace bedbug with auto_glass insurance check, etc.)
4. Copy tests/promptfoo/harness/brian-knowledge-routing.yaml → tests/promptfoo/harness/<slug>-knowledge-routing.yaml
   - Swap business_name + 6 niche-typical policy questions
5. Run Step 2 (Snapshot + Baseline + Fingerprint) to capture a starting point.
6. Commit the new <slug>-baseline.yaml + snapshot. Now the slug is harnessed.
```

## Adding a new niche

```
1. Inventory the niche-defaults.ts block for the new niche.
2. Identify load-bearing rules — safety, scope, completion, regulatory.
3. Write fingerprints/<niche>.txt with 10-15 substrings that MUST appear.
4. Verify against an existing client snapshot from that niche:
   ./check-fingerprints.sh <existing-snapshot.txt> fingerprints/<niche>.txt
5. Commit the fingerprints file. All future clients of this niche inherit.
```

## File layout

```
tests/promptfoo/
├── <slug>-baseline.yaml              # per-client scenario regression suite
├── <slug>-replay-YYYY-MM-DD.yaml     # per-client real-caller replay
├── snapshots/
│   └── <slug>-{current,proposed,slimmed}-YYYY-MM-DD.txt
├── baselines/
│   └── <slug>-{baseline,routing}-{current,proposed}-YYYY-MM-DD.json
└── harness/
    ├── README.md                     # THIS FILE
    ├── check-fingerprints.sh         # niche-agnostic substring assertion
    ├── fingerprints/
    │   ├── property_management.txt   # 14 substrings (13 sacred + 1 Bug 3 track)
    │   ├── real_estate.txt           # TODO
    │   ├── auto_glass.txt            # TODO
    │   └── <niche>.txt
    └── <slug>-knowledge-routing.yaml # per-client KB-routing eval
```

## Known gaps to close

- [ ] **No CI gate.** Right now this runs locally. Add to pre-push hook once stable.
- [ ] **No Ultravox-side eval.** Llama 70b on Groq is a proxy. For 100% production fidelity, need a staging Ultravox agent and replay through it. Optional — proxy catches 80%+ of bugs.
- [ ] **No true tool-call detection.** Bridge-phrase + intent-to-lookup is a strong proxy but not the same as observing an actual `queryKnowledge` tool invocation. To measure that, need a custom provider that exposes tool-call output.
- [ ] **Fingerprint files for non-PM niches not yet written.** Each new niche needs its own substring list. Property_management is the prototype.
- [ ] **Replay tool input format not yet documented here.** See [brian-replay-2026-06-02.yaml](../brian-replay-2026-06-02.yaml) for the pattern.

## Reference

- Slim plan: [CALLINGAGENTS/00-Inbox/2026-06-02-brian-prompt-audit.md](../../../CALLINGAGENTS/00-Inbox/2026-06-02-brian-prompt-audit.md)
- Slim handoff: [CALLINGAGENTS/00-Inbox/2026-06-02-brian-prompt-slimming-handoff.md](../../../CALLINGAGENTS/00-Inbox/2026-06-02-brian-prompt-slimming-handoff.md)
- GLM-4.6 rules: [memory/glm46-prompting-rules.md](../../../memory/glm46-prompting-rules.md)
- Per-call-context contract: [docs/architecture/per-call-context-contract.md](../../../docs/architecture/per-call-context-contract.md)
