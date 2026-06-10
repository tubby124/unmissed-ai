# Knowledge-Routing Harness

Universal harness for diagnosing and regression-testing whether unmissed.ai voice agents correctly route policy questions to the `queryKnowledge` tool instead of deflecting to manager callback.

Works for **any client**, parameterized by `--slug` (or `--all` for fleet mode). Niche-templated scenarios live in `scenarios.ts` and are looked up at runtime from `clients.niche` with automatic canonicalization (handles `auto_glass` / `auto-glass` / `property_management` / `property-management` interchangeably).

## Files

- `scenarios.ts` — niche-templated scenario library + `canonicalNiche()` + `scenariosFor()`
- `audit.ts` — Layer 1 diagnostic (4 checks, $0 per run, fleet mode supported)
- `corpus-inspect.ts` — companion for catching `reseedKnowledgeFromSettings()` never-ran / partial bugs
- `normalize.test.ts` — regression fixtures for the audit's prompt normalizer (catches 2 known bug classes)
- `reports/` — auto-written markdown reports per `<slug>-<date>`

## Layers

| # | Tool | Cost | Tests what |
|---|---|---|---|
| **1** | `audit.ts` | $0 | Tool registration, pgvector content, prompt drift, prompt-bloat fatigue. Pure diagnostic. |
| **1b** | `corpus-inspect.ts` | $0 | Catches "settings have content but pgvector doesn't" — the most common Layer 1 root cause. |
| **2** | `text-grade.yaml` (TBD) | ~$0.04/run | Haiku grades whether agent's response SHARES KB content vs deflects. Cheap regression gate. |
| **3** | `live-replay.yaml` (TBD) | ~$0.50/run | Real Ultravox call, asserts queryKnowledge ACTUALLY fires + returns chunks. Pre-merge gate for recompose-class changes. |

Built in order: Layer 1 first (diagnostic before regression). Layers 2-3 added when Layer 1 results justify the spend.

## Production-grade features (audit.ts v1.1.0+)

- **Exit codes** — `0` PASS/SKIP, `1` FAIL (or WARN with `--strict`), `2` bad args, `3` fatal. Wire into CI.
- **Embedding 429 fallback** — tries OpenAI direct, falls back to OpenRouter on quota exhaustion. Audit completes even when primary embed provider is rate-limited.
- **Fleet mode (`--all`)** — iterates every client with an `ultravox_agent_id`, summary table at end, single exit code = worst-status across fleet.
- **Git provenance** — every report records `gitSha`, `gitBranch`, `gitDirty` so a finding can be tied back to a specific commit.
- **Audit version** — `AUDIT_VERSION` bumps when check logic changes; consumers can detect stale findings.
- **Niche canonicalization** — `auto-glass` vs `auto_glass` no longer silently falls through to `other` scenarios.

## Layer 1 — Audit

```bash
# Single client
npx tsx tests/promptfoo/knowledge-routing/audit.ts --slug <slug>

# Fleet mode — every client with ultravox_agent_id
npx tsx tests/promptfoo/knowledge-routing/audit.ts --all

# CI gate — fails on WARN as well as FAIL, no report files written
npx tsx tests/promptfoo/knowledge-routing/audit.ts --slug <slug> --strict --no-report

# Machine-readable
npx tsx tests/promptfoo/knowledge-routing/audit.ts --all --json > fleet.json
```

Runs 4 checks, ranks suspects, recommends next action. Writes a markdown report to `reports/<slug>-<date>.md` by default.

## Layer 1b — Corpus inspect

```bash
npx tsx tests/promptfoo/knowledge-routing/corpus-inspect.ts --slug <slug>
npx tsx tests/promptfoo/knowledge-routing/corpus-inspect.ts --all
```

Lists every approved chunk grouped by source, every `business_facts` entry, every `extra_qa` pair, diffs settings-against-chunks, and outputs a `reseed-state` flag:

- `never-ran` — settings have content but ZERO chunks of any source. `reseedKnowledgeFromSettings()` never fired.
- `partial` — some settings content reached pgvector, some entries missing. Reseed needed or specific entries failed to embed.
- `complete` — settings fully reflected in pgvector.
- `no-settings-content` — nothing to reseed.

Exit code `1` if any audited client is `never-ran` or `partial` (actionable).

### Env required
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — DB access
- `OPENAI_API_KEY` or `OPENROUTER_API_KEY` — embeddings for pgvector content check
- `ULTRAVOX_API_KEY` — agent fetch for tool-registration + drift checks

All sourced from `.env.local` automatically.

### Checks

1. **Tool registration** — `queryKnowledge` (or `queryCorpus` if `knowledge_backend='ultravox'`) is present in BOTH `clients.tools` AND Ultravox agent's `callTemplate.selectedTools`. Per [drift-detection-pattern.md](../../../.claude/rules/drift-detection-pattern.md), `clients.tools` is runtime-authoritative; Ultravox stored config is overridden by `toolOverrides` at call time.
2. **pgvector content** — For each scenario from `scenariosFor(niche)`, embeds query via OpenAI text-embedding-3-small → `hybrid_match_knowledge` RPC → applies the same filters as the live query route (`SIMILARITY_FLOOR=0.45`, `RRF_MIN_SCORE=0.005`, `status='approved'`). Reports per-query result count, top similarity, and whether top chunk content matches expected `mustMatchAny` patterns.
3. **Prompt drift** — Normalizes (strips `<!-- unmissed:* -->` markers + whitespace) both `clients.system_prompt` and Ultravox `callTemplate.systemPrompt` → SHA256 compare. Mismatch indicates failed `updateAgent()` propagation or manual edit.
4. **Prompt-bloat instruction fatigue** — Heuristic: prompts >15K chars containing 4+ instructions for the same tool are at high risk of GLM-4.6 long-context degradation ("lost in the middle"). The model can recite the rules but fails to apply them at inference time. Locates every line that mentions the tool name with line number.

### Suspect ranking

Outputs an ordered list with `probability` (CRITICAL / HIGH / MEDIUM / LOW / cosmetic) and a concrete `fix` per suspect. Ranking respects dependencies (no point reseeding corpus if tool isn't even registered).

## Niche scenarios

`scenarios.ts` exports:

- `nicheScenarios: Record<string, Scenario[]>` — property_management, real_estate, auto_glass, service_other / other
- `universalScenarios: Scenario[]` — applied to every niche (hours question, etc.)
- `scenariosFor(niche)` — niche lookup with `other` fallback + universal append

Each `Scenario` has:

```ts
{
  id: string                  // 'rent-guarantee'
  question: string            // 'how does the rent guarantee program work'
  mustMatchAny: string[]      // ['90%', 'market value', '12 month']  — ≥1 must appear in top chunk OR response
  mustNotMatch?: string[]     // ['have brian call', "i don't have"]  — deflection patterns that signal failure
  notes?: string              // human reminder
}
```

### Adding a niche

Add a new key under `nicheScenarios` with 4-8 scenarios. Anchor scenarios to recurring questions for that niche — not edge cases. Each scenario should:
- Be a question a CALLER would actually ask (not internal jargon)
- Have factual content that SHOULD live in the KB for any client in that niche
- Have `mustMatchAny` substrings loose enough to survive paraphrase

### Per-client overrides (future)

Some scenarios need client-specific anchors (e.g. Brian serves Calgary + Edmonton, but a future Vancouver PM client serves the Lower Mainland). Current design uses niche-wide anchors that work for most clients. Layer 2 (text-grade) and Layer 3 (live-replay) will add per-client scenario merging when needed.

## Reports directory

`reports/<slug>-<YYYY-MM-DD>.md` is gitignored by convention (audit reports are session artifacts, not source-of-truth). For durable findings, save to the Obsidian vault under `Projects/unmissed/`.

## Why this exists

Built 2026-06-02 after the master plan (`2026-06-02-night-system-fix-master-plan`) identified that Brian's deployed agent has a 71% Bug 3 rate AND a 0% queryKnowledge hit rate on policy questions despite a 16-chunk corpus. The fix path requires diagnosing WHY routing fails before patching wording.

Phases B1 (contract gate) and B2 (niche-aware baselines) in the master plan are both implemented by this harness — B1 by Layer 1's tool/drift checks, B2 by `scenarios.ts`.
