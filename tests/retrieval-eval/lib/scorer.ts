/**
 * scorer.ts — Pure scoring functions for retrieval eval
 *
 * No side effects, no I/O. Takes eval results and produces scores.
 */

import type { EvalQuestion, EvalResult, QueryResponse, Verdicts, Scorecard, Thresholds } from './types'

/**
 * Score a single question against its query response.
 */
export function scoreQuestion(q: EvalQuestion, response: QueryResponse | null): Verdicts {
  if (!response || response.error) {
    return {
      retrieval_hit: (q.should_use_tool && q.expected_source_type !== 'none') ? false : null,
      wrong_source: null,
      empty_when_should_have: (q.expected_source_type !== 'none') ? true : null,
      unnecessary_call: null,
      correct_silence: (q.expected_source_type === 'none') ? true : null,
    }
  }

  const hasResults = response.count > 0
  const resultContents = (response.results || []).map(r => r.content.toLowerCase())
  const resultTypes = (response.results || []).map(r => r.chunk_type)

  // Check if any result is relevant
  let hasRelevantResult = false
  if (q.expected_chunk_substring) {
    const needle = q.expected_chunk_substring.toLowerCase()
    hasRelevantResult = resultContents.some(c => c.includes(needle))
  } else if (q.expected_source_type !== 'none') {
    // Fall back to chunk_type matching
    hasRelevantResult = resultTypes.some(t => t === q.expected_source_type)
  }

  return {
    // Retrieval hit: only scored when tool SHOULD be used and answer exists in KB
    retrieval_hit: (q.should_use_tool && q.expected_source_type !== 'none')
      ? hasRelevantResult
      : null,

    // Wrong source: results returned but none relevant (only when answer should exist)
    wrong_source: (hasResults && q.expected_source_type !== 'none')
      ? !hasRelevantResult
      : null,

    // Empty when should have results: answer exists but 0 results
    empty_when_should_have: (q.expected_source_type !== 'none')
      ? !hasResults
      : null,

    // Unnecessary call: summary should handle it but results came back
    unnecessary_call: (!q.should_use_tool)
      ? hasResults
      : null,

    // Correct silence: no answer exists and no results returned
    correct_silence: (q.expected_source_type === 'none')
      ? !hasResults
      : null,
  }
}

/**
 * Compute a rate from a filtered set of results.
 */
function rate<T>(items: T[], predicate: (item: T) => boolean): number {
  if (items.length === 0) return 1.0 // vacuously true
  return items.filter(predicate).length / items.length
}

/**
 * Get percentile from a sorted array.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

/**
 * Aggregate per-question results into a scorecard.
 */
export function aggregateScores(results: EvalResult[], thresholds: Thresholds): Scorecard {
  const retrieval_hits = results.filter(r => r.verdicts.retrieval_hit !== null)
  const wrong_sources = results.filter(r => r.verdicts.wrong_source !== null)
  const empties = results.filter(r => r.verdicts.empty_when_should_have !== null)
  const unnecessary = results.filter(r => r.verdicts.unnecessary_call !== null)
  const silences = results.filter(r => r.verdicts.correct_silence !== null)
  const latencies = results.map(r => r.latency_ms).sort((a, b) => a - b)

  const retrieval_hit_rate = rate(retrieval_hits, r => r.verdicts.retrieval_hit === true)
  const wrong_source_rate = rate(wrong_sources, r => r.verdicts.wrong_source === true)
  const empty_result_rate = rate(empties, r => r.verdicts.empty_when_should_have === true)
  const unnecessary_tool_rate = rate(unnecessary, r => r.verdicts.unnecessary_call === true)
  const correct_silence_rate = rate(silences, r => r.verdicts.correct_silence === true)
  const latency_p50 = percentile(latencies, 50)
  const latency_p95 = percentile(latencies, 95)
  const latency_max = latencies.length > 0 ? latencies[latencies.length - 1] : 0

  // Check thresholds
  const threshold_failures: string[] = []
  if (retrieval_hit_rate < thresholds.retrieval_hit_rate_min)
    threshold_failures.push(`retrieval_hit_rate ${(retrieval_hit_rate * 100).toFixed(1)}% < ${(thresholds.retrieval_hit_rate_min * 100).toFixed(0)}%`)
  if (wrong_source_rate > thresholds.wrong_source_rate_max)
    threshold_failures.push(`wrong_source_rate ${(wrong_source_rate * 100).toFixed(1)}% > ${(thresholds.wrong_source_rate_max * 100).toFixed(0)}%`)
  if (empty_result_rate > thresholds.empty_result_rate_max)
    threshold_failures.push(`empty_result_rate ${(empty_result_rate * 100).toFixed(1)}% > ${(thresholds.empty_result_rate_max * 100).toFixed(0)}%`)
  if (unnecessary_tool_rate > thresholds.unnecessary_tool_rate_max)
    threshold_failures.push(`unnecessary_tool_rate ${(unnecessary_tool_rate * 100).toFixed(1)}% > ${(thresholds.unnecessary_tool_rate_max * 100).toFixed(0)}%`)
  if (correct_silence_rate < thresholds.correct_silence_rate_min)
    threshold_failures.push(`correct_silence_rate ${(correct_silence_rate * 100).toFixed(1)}% < ${(thresholds.correct_silence_rate_min * 100).toFixed(0)}%`)
  if (latency_p50 > thresholds.latency_p50_max)
    threshold_failures.push(`latency_p50 ${latency_p50}ms > ${thresholds.latency_p50_max}ms`)
  if (latency_p95 > thresholds.latency_p95_max)
    threshold_failures.push(`latency_p95 ${latency_p95}ms > ${thresholds.latency_p95_max}ms`)

  return {
    retrieval_hit_rate,
    wrong_source_rate,
    empty_result_rate,
    unnecessary_tool_rate,
    correct_silence_rate,
    latency_p50,
    latency_p95,
    latency_max,
    total_questions: results.length,
    pass: threshold_failures.length === 0,
    threshold_failures,
  }
}

/**
 * Counts for summary display.
 */
export function countVerdicts(results: EvalResult[], key: keyof Verdicts): { pass: number; fail: number; total: number } {
  const applicable = results.filter(r => r.verdicts[key] !== null)
  // For correct_silence and retrieval_hit, true=pass. For wrong_source/empty/unnecessary, false=pass.
  const positiveIsGood = key === 'retrieval_hit' || key === 'correct_silence'
  const pass = applicable.filter(r => r.verdicts[key] === positiveIsGood).length
  const fail = applicable.length - pass
  return { pass, fail, total: applicable.length }
}
