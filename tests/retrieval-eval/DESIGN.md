# Retrieval Eval Harness — Design Document

_Created: 2026-03-19_
_Canary client: windshield-hub (auto_glass)_
_RAG backend: pgvector via `match_knowledge` RPC_

---

## 1. Eval Question Set Schema

Each question in an eval set is a JSON object with these fields:

```typescript
type EvalQuestion = {
  id: string                  // e.g. "WH-001" — client prefix + sequential
  question: string            // What a real caller would say (natural speech, not typed)
  expected_answer_theme: string   // Semantic intent of the correct answer (1-2 sentences)
  expected_source_type: 'fact' | 'qa' | 'page_content' | 'manual' | 'none'
  // 'none' = no answer exists in knowledge — agent should route to callback
  should_use_tool: boolean    // false = summary covers it, true = needs queryKnowledge
  difficulty: 'easy' | 'medium' | 'hard'
  category: 'pricing' | 'hours' | 'services' | 'coverage' | 'insurance' | 'process' | 'general' | 'out_of_scope'
  expected_chunk_substring?: string  // Optional: substring that MUST appear in a relevant result
  notes?: string              // Optional: why this question is interesting
}
```

Key design decisions:
- `expected_answer_theme` is semantic, not exact-match. Scored by substring or LLM judge.
- `expected_source_type` tells us what chunk_type the correct hit should have. `'none'` means the knowledge base has no answer.
- `should_use_tool: false` questions test whether the summary is sufficient. If the tool fires anyway, that counts as an unnecessary tool call.
- `expected_chunk_substring` is optional but useful for deterministic pass/fail on retrieval content.

---

## 2. Scoring Dimensions

### 2a. Retrieval Hit Rate
**What:** Of all queries where `should_use_tool=true` AND `expected_source_type != 'none'`, how many returned at least one result whose content matches `expected_answer_theme`?

```
retrieval_hit_rate = relevant_results_returned / total_should_retrieve_queries
```

Relevance check: if `expected_chunk_substring` is set, check `result.content.includes(substring)`. Otherwise, check if any result's `chunk_type` matches `expected_source_type`.

### 2b. Wrong-Source Rate
**What:** Of all queries that returned results, how many returned ONLY irrelevant content?

```
wrong_source_rate = queries_with_only_irrelevant_results / queries_with_any_results
```

A result is irrelevant if: (a) its content does not match `expected_answer_theme` AND (b) `expected_chunk_substring` is set and not found in any result.

### 2c. Empty-Result Rate
**What:** Of queries where `expected_source_type != 'none'` (answer DOES exist), how many returned 0 results?

```
empty_result_rate = zero_result_queries / total_should_have_results_queries
```

This catches threshold too high or embedding drift.

### 2d. Unnecessary-Tool-Call Rate
**What:** Of queries where `should_use_tool=false` (summary covers it), how many returned results anyway?

```
unnecessary_tool_rate = tool_returned_results_when_summary_sufficient / total_should_not_use_tool_queries
```

Note: The query endpoint always runs when called. This metric is about whether the agent SHOULD have called it. In the eval runner, we fire all queries regardless — this metric flags which ones the agent should skip at runtime.

### 2e. Correct-Silence Rate
**What:** Of queries where `expected_source_type='none'` (no answer exists), how many correctly returned 0 results?

```
correct_silence_rate = zero_results_on_no_answer_queries / total_no_answer_queries
```

Target: 100%. If this drops, the model is hallucinating retrieval matches.

### 2f. Latency Distribution

```
latency_p50 = median(all_latency_ms)
latency_p95 = percentile(all_latency_ms, 95)
latency_max = max(all_latency_ms)
```

Pulled from `knowledge_query_log.latency_ms` or measured client-side.

### 2g. Similarity Score Distribution

```
avg_top_similarity   = mean(top_similarity for queries with results)
min_top_similarity   = min(top_similarity for queries with results)
threshold_gap        = avg_top_similarity - MATCH_THRESHOLD (0.72)
```

If `threshold_gap` shrinks over time, embeddings are drifting or chunk quality is degrading.

---

## 3. Windshield Hub Eval Set (25 questions)

### Category: Services (should_use_tool varies)

| ID | Question | Theme | Source | Tool? | Difficulty | Category |
|----|----------|-------|--------|-------|------------|----------|
| WH-001 | "Do you guys do chip repairs?" | Yes, chip repair offered | fact | false | easy | services |
| WH-002 | "Can you replace a rear window on a 2019 Hyundai Tucson?" | Yes, side and rear windows serviced | fact | false | easy | services |
| WH-003 | "Do you do ADAS calibration after windshield replacement?" | Calibration available for vehicles with lane assist | qa | true | medium | services |
| WH-004 | "Is your shop certified? Like AGRA or anything?" | AGRA certified | fact | true | medium | services |
| WH-005 | "Do you guys come to me or do I gotta bring it to the shop?" | Mobile service available, tech comes to you | fact | false | easy | services |

### Category: Hours

| ID | Question | Theme | Source | Tool? | Difficulty | Category |
|----|----------|-------|--------|-------|------------|----------|
| WH-006 | "What time do you close today?" | Hours depend on day: M-F 8:30-5:30, weekends 10-5:30 | fact | false | easy | hours |
| WH-007 | "Are you open on Sundays?" | Weekends 10-5:30, Sundays case-by-case | fact | false | easy | hours |
| WH-008 | "Can I drop off my truck at 7 AM before you open?" | Not standard, route to Sabbir for early drop arrangement | none | true | medium | hours |

### Category: Insurance

| ID | Question | Theme | Source | Tool? | Difficulty | Category |
|----|----------|-------|--------|-------|------------|----------|
| WH-009 | "Does SGI cover windshield replacement?" | Insurance claims assistance offered, route to Sabbir for details | qa | true | medium | insurance |
| WH-010 | "I've got ICBC coverage, can you do a direct bill?" | Insurance handled, route to Sabbir for insurer-specific process | qa | true | medium | insurance |
| WH-011 | "My deductible is $300, is it worth claiming?" | Cannot advise on claim worthiness, route to Sabbir | none | true | hard | insurance |
| WH-012 | "Do you accept all insurance companies or just SGI?" | Most major insurers accepted | fact | false | easy | insurance |

### Category: Pricing

| ID | Question | Theme | Source | Tool? | Difficulty | Category |
|----|----------|-------|--------|-------|------------|----------|
| WH-013 | "How much for a windshield on a 2020 F-150?" | Never quote prices, route to Sabbir for quote | none | true | easy | pricing |
| WH-014 | "Is chip repair cheaper than replacement?" | Never quote prices, Sabbir calls back with quote | none | true | easy | pricing |
| WH-015 | "Do you price match other shops?" | Unknown, route to Sabbir | none | true | medium | pricing |

### Category: Process

| ID | Question | Theme | Source | Tool? | Difficulty | Category |
|----|----------|-------|--------|-------|------------|----------|
| WH-016 | "How long does a windshield replacement take?" | About 1 hour for full replacement | qa | true | easy | process |
| WH-017 | "How long does a chip repair take?" | About 30 minutes for chip repair | qa | true | easy | process |
| WH-018 | "Do I need to leave my car overnight?" | Typically same-day, route to Sabbir for specifics | none | true | medium | process |
| WH-019 | "What info do you need from me to get a quote?" | Year, make, model, glass type, damage type | qa | true | medium | process |

### Category: Coverage / Location

| ID | Question | Theme | Source | Tool? | Difficulty | Category |
|----|----------|-------|--------|-------|------------|----------|
| WH-020 | "Do you service the Saskatoon area?" | Yes, based in Saskatoon area | fact | false | easy | coverage |
| WH-021 | "Can your mobile tech come to Warman?" | Service area question, route to Sabbir if unsure | none | true | hard | coverage |

### Category: Out of Scope / Edge Cases

| ID | Question | Theme | Source | Tool? | Difficulty | Category |
|----|----------|-------|--------|-------|------------|----------|
| WH-022 | "Can you do window tinting too?" | Tinting not confirmed, route to Sabbir | none | true | medium | out_of_scope |
| WH-023 | "Do you sell wiper blades?" | Out of scope, not a glass service | none | true | easy | out_of_scope |
| WH-024 | "My windshield has a rock chip and a long crack from it, is that fixable or does it need full replacement?" | Crack from chip usually means full replacement | qa | true | hard | services |
| WH-025 | "I heard Speedy Glass does free chip repair, do you match that?" | Cannot discuss competitor pricing, route to Sabbir | none | true | hard | out_of_scope |

---

## 4. Eval Runner Design

### 4a. Architecture

```
tests/retrieval-eval/
  DESIGN.md              <- this file
  eval-sets/
    windshield-hub.json  <- 25 questions (schema above)
  run-eval.ts            <- runner script (tsx)
  results/
    windshield-hub-2026-03-19.json   <- timestamped result files
  lib/
    scorer.ts            <- scoring logic (pure functions)
    reporter.ts          <- console + JSON output
```

### 4b. Runner Script (`run-eval.ts`)

```typescript
// Pseudocode — actual implementation follows this flow

import evalSet from './eval-sets/windshield-hub.json'
import { scoreResults, buildReport } from './lib/scorer'

const BASE_URL = process.env.EVAL_BASE_URL || 'http://localhost:3000'
const TOOL_SECRET = process.env.WEBHOOK_SIGNING_SECRET || ''

type EvalResult = {
  id: string
  question: string
  expected: EvalQuestion          // from eval set
  response: QueryResponse | null  // from API
  latency_ms: number
  verdicts: {
    retrieval_hit: boolean | null   // null if should_use_tool=false
    wrong_source: boolean | null
    empty_when_should_have: boolean | null
    unnecessary_call: boolean | null
    correct_silence: boolean | null
  }
}

async function runEval(slug: string, questions: EvalQuestion[]): Promise<EvalResult[]> {
  const results: EvalResult[] = []

  for (const q of questions) {
    const start = Date.now()
    const res = await fetch(`${BASE_URL}/api/knowledge/${slug}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tool-Secret': TOOL_SECRET,
      },
      body: JSON.stringify({ query: q.question }),
    })
    const latency_ms = Date.now() - start
    const data = await res.json()

    // Score this question
    const verdicts = scoreQuestion(q, data)
    results.push({ id: q.id, question: q.question, expected: q, response: data, latency_ms, verdicts })
  }

  return results
}
```

### 4c. Scoring Logic (`scorer.ts`)

```typescript
function scoreQuestion(q: EvalQuestion, response: QueryResponse): Verdicts {
  const hasResults = response.count > 0
  const resultContents = (response.results || []).map(r => r.content.toLowerCase())

  // Check if any result is relevant
  let hasRelevantResult = false
  if (q.expected_chunk_substring) {
    hasRelevantResult = resultContents.some(c => c.includes(q.expected_chunk_substring!.toLowerCase()))
  } else if (q.expected_source_type !== 'none') {
    hasRelevantResult = (response.results || []).some(r => r.chunk_type === q.expected_source_type)
  }

  return {
    // Only score retrieval_hit when tool SHOULD be used and answer exists
    retrieval_hit: (q.should_use_tool && q.expected_source_type !== 'none')
      ? hasRelevantResult : null,

    // Wrong source: results returned but none relevant (only when answer should exist)
    wrong_source: (hasResults && q.expected_source_type !== 'none')
      ? !hasRelevantResult : null,

    // Empty when should have results
    empty_when_should_have: (q.expected_source_type !== 'none')
      ? !hasResults : null,

    // Unnecessary call: summary should handle it but results came back
    unnecessary_call: (!q.should_use_tool)
      ? hasResults : null,

    // Correct silence: no answer exists and no results returned
    correct_silence: (q.expected_source_type === 'none')
      ? !hasResults : null,
  }
}
```

### 4d. Aggregate Scoring

```typescript
function aggregateScores(results: EvalResult[]): Scorecard {
  const retrieval_hits = results.filter(r => r.verdicts.retrieval_hit !== null)
  const wrong_sources = results.filter(r => r.verdicts.wrong_source !== null)
  const empties = results.filter(r => r.verdicts.empty_when_should_have !== null)
  const unnecessary = results.filter(r => r.verdicts.unnecessary_call !== null)
  const silences = results.filter(r => r.verdicts.correct_silence !== null)
  const latencies = results.map(r => r.latency_ms).sort((a, b) => a - b)

  return {
    retrieval_hit_rate: rate(retrieval_hits, r => r.verdicts.retrieval_hit === true),
    wrong_source_rate: rate(wrong_sources, r => r.verdicts.wrong_source === true),
    empty_result_rate: rate(empties, r => r.verdicts.empty_when_should_have === true),
    unnecessary_tool_rate: rate(unnecessary, r => r.verdicts.unnecessary_call === true),
    correct_silence_rate: rate(silences, r => r.verdicts.correct_silence === true),
    latency_p50: percentile(latencies, 50),
    latency_p95: percentile(latencies, 95),
    latency_max: Math.max(...latencies),
    total_questions: results.length,
    pass: false, // set by threshold check
  }
}
```

### 4e. Output

The runner prints a console scorecard:

```
=== Retrieval Eval: windshield-hub ===
Date: 2026-03-19
Questions: 25

SCORES:
  Retrieval Hit Rate:     85.7% (12/14)   [target: >80%]   PASS
  Wrong Source Rate:        7.1% (1/14)    [target: <15%]   PASS
  Empty Result Rate:       14.3% (2/14)    [target: <20%]   PASS
  Unnecessary Tool Rate:   20.0% (1/5)     [target: <30%]   PASS
  Correct Silence Rate:   100.0% (6/6)     [target: >90%]   PASS
  Latency p50:            142ms            [target: <500ms]  PASS
  Latency p95:            380ms            [target: <1000ms] PASS

OVERALL: PASS (7/7 thresholds met)

FAILURES:
  WH-008: Empty result — expected 'none' but should_use_tool=true... (details)
  WH-021: Wrong source — returned unrelated fact about hours... (details)
```

And writes a JSON file to `results/` for tracking over time.

### 4f. Storage

Results are stored as JSON files in `tests/retrieval-eval/results/`:
- Filename: `{slug}-{ISO-date}.json`
- Contains: full `EvalResult[]` array + `Scorecard` + metadata (threshold, slug, date, base_url)
- Git-tracked so regressions are visible in diff

Query logs also persist in `knowledge_query_log` table (already built into the query endpoint). The `query_id` in each response links back to the log row for debugging.

---

## 5. Pass/Fail Thresholds

### Canary Pass (windshield-hub, initial)

| Metric | Target | Rationale |
|--------|--------|-----------|
| Retrieval Hit Rate | > 80% | New system, some chunks may not be embedded yet |
| Wrong Source Rate | < 15% | Cross-client pollution or bad embeddings |
| Empty Result Rate | < 20% | Threshold (0.72) may need tuning |
| Unnecessary Tool Rate | < 30% | Hard to gate perfectly — some overlap is OK |
| Correct Silence Rate | > 90% | Critical — must not hallucinate matches for unknown questions |
| Latency p50 | < 500ms | Embedding + pgvector search + network |
| Latency p95 | < 1000ms | Acceptable for voice agent (tool call budget is 2.5s default) |

### Production Pass (after tuning)

| Metric | Target | When |
|--------|--------|------|
| Retrieval Hit Rate | > 90% | After chunk coverage audit |
| Wrong Source Rate | < 10% | After embedding quality pass |
| Empty Result Rate | < 10% | After threshold tuning |
| Unnecessary Tool Rate | < 20% | After summary expansion |
| Correct Silence Rate | > 95% | Always |
| Latency p95 | < 800ms | After index optimization |

### Threshold Tuning Protocol

If `empty_result_rate` is too high:
1. Lower `MATCH_THRESHOLD` from 0.72 to 0.68 (in query route)
2. Re-run eval
3. Check if `wrong_source_rate` increased (tradeoff)

If `wrong_source_rate` is too high:
1. Raise `MATCH_THRESHOLD` from 0.72 to 0.76
2. Re-run eval
3. Check if `empty_result_rate` increased (tradeoff)

Log every threshold change in eval results metadata.

---

## 6. File Structure

```
tests/
  retrieval-eval/
    DESIGN.md                          <- this document
    run-eval.ts                        <- main runner (npx tsx tests/retrieval-eval/run-eval.ts)
    eval-sets/
      windshield-hub.json             <- 25 questions
      _template.json                  <- empty template for new clients
    lib/
      types.ts                        <- EvalQuestion, EvalResult, Scorecard types
      scorer.ts                       <- scoreQuestion, aggregateScores (pure functions)
      reporter.ts                     <- console output + JSON file writer
    results/
      .gitkeep                        <- tracked, results committed
      windshield-hub-2026-03-19.json  <- example result file
```

### CLI Usage

```bash
# Run against local dev server
npx tsx tests/retrieval-eval/run-eval.ts --slug windshield-hub

# Run against production
EVAL_BASE_URL=https://unmissed-ai-production.up.railway.app \
  npx tsx tests/retrieval-eval/run-eval.ts --slug windshield-hub

# Run with verbose output (per-question details)
npx tsx tests/retrieval-eval/run-eval.ts --slug windshield-hub --verbose

# Compare two result files
npx tsx tests/retrieval-eval/run-eval.ts --compare \
  results/windshield-hub-2026-03-18.json \
  results/windshield-hub-2026-03-19.json
```

### Integration with Existing Test Layers

| Layer | What | Runs When |
|-------|------|-----------|
| Unit tests (`npm run test:all`) | Pure function tests for knowledge-retrieval.ts, knowledge-summary.ts | Every code change |
| Promptfoo (`tests/promptfoo/`) | Prompt-level behavioral regression | Every prompt change |
| **Retrieval eval (this)** | End-to-end pgvector retrieval quality | After knowledge changes, threshold changes, embedding model changes |
| Live eval (`tests/live-eval/`) | Full voice call regression | Runtime-affecting deploys |
| Settings sync (`tests/settings-sync-check.sh`) | DB/prompt/Ultravox consistency | Before deploys |

### When to Run This Eval

| Trigger | Action |
|---------|--------|
| New knowledge chunks embedded for a client | Run for that client |
| `MATCH_THRESHOLD` changed in query route | Run for all clients with pgvector |
| Embedding model changed | Run for all clients |
| Knowledge extractor logic changed | Run for affected client |
| Monthly (with `/intelligence-update`) | Run for all active pgvector clients |

---

## 7. RAGAS-Informed Design Decisions

This harness draws from RAGAS (Retrieval Augmented Generation Assessment) concepts but adapts them for our voice agent context:

**What we took from RAGAS:**
- **Context Relevance** maps to our Retrieval Hit Rate — did we get the right chunks?
- **Answer Faithfulness** maps to Correct Silence Rate — does the system avoid fabricating when it has no data?
- **Context Precision** maps to Wrong Source Rate — are the returned chunks actually useful?

**What we intentionally skipped:**
- **Answer correctness** (RAGAS measures final LLM answer quality) — we test that separately in promptfoo and live-eval. This harness is strictly about retrieval quality, not generation quality.
- **LLM-as-judge for relevance** — too slow and expensive per-question. We use substring matching + chunk_type matching. Can add LLM judge as an optional `--deep` flag later.
- **Noise robustness** (RAGAS tests with injected noise) — our noise comes from real caller speech patterns. The eval questions are written in natural speech, not clinical queries.

**Voice agent-specific additions not in RAGAS:**
- `should_use_tool` dimension — unique to our two-tier system (summary + retrieval)
- Latency as a first-class metric — voice agents have a 2.5s tool budget, retrieval must be fast
- `expected_source_type` as `'none'` — testing that the system correctly returns nothing for unanswerable questions (critical for "I'll have someone follow up" routing)
