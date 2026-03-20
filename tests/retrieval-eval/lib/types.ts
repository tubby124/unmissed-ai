/**
 * types.ts — Retrieval eval harness type definitions
 */

export type SourceType = 'fact' | 'qa' | 'page_content' | 'manual' | 'niche_template' | 'call_learning' | 'none'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type Category = 'pricing' | 'hours' | 'services' | 'coverage' | 'insurance' | 'process' | 'general' | 'out_of_scope'

export type EvalQuestion = {
  id: string
  question: string
  expected_answer_theme: string
  expected_source_type: SourceType
  should_use_tool: boolean
  difficulty: Difficulty
  category: Category
  expected_chunk_substring?: string
  notes?: string
}

export type QueryResult = {
  content: string
  chunk_type: string
  source: string
  similarity: number
  source_run_id: string | null
}

export type QueryResponse = {
  results: QueryResult[]
  count: number
  query_id: string | null
  error?: string
}

export type Verdicts = {
  /** Did retrieval return a relevant result? null if should_use_tool=false or expected_source_type='none' */
  retrieval_hit: boolean | null
  /** Did retrieval return ONLY irrelevant results? null if no results or expected_source_type='none' */
  wrong_source: boolean | null
  /** Did retrieval return 0 results when answer exists? null if expected_source_type='none' */
  empty_when_should_have: boolean | null
  /** Did retrieval return results when summary should handle it? null if should_use_tool=true */
  unnecessary_call: boolean | null
  /** Did retrieval correctly return 0 results for unanswerable question? null if expected_source_type!='none' */
  correct_silence: boolean | null
}

export type EvalResult = {
  id: string
  question: string
  expected: EvalQuestion
  response: QueryResponse | null
  latency_ms: number
  verdicts: Verdicts
}

export type Scorecard = {
  retrieval_hit_rate: number
  wrong_source_rate: number
  empty_result_rate: number
  unnecessary_tool_rate: number
  correct_silence_rate: number
  latency_p50: number
  latency_p95: number
  latency_max: number
  total_questions: number
  pass: boolean
  threshold_failures: string[]
}

export type EvalMetadata = {
  slug: string
  date: string
  base_url: string
  match_threshold: number
  eval_set_path: string
  duration_ms: number
}

export type EvalReport = {
  metadata: EvalMetadata
  scorecard: Scorecard
  results: EvalResult[]
}

export type Thresholds = {
  retrieval_hit_rate_min: number
  wrong_source_rate_max: number
  empty_result_rate_max: number
  unnecessary_tool_rate_max: number
  correct_silence_rate_min: number
  latency_p50_max: number
  latency_p95_max: number
}

export const CANARY_THRESHOLDS: Thresholds = {
  retrieval_hit_rate_min: 0.80,
  wrong_source_rate_max: 0.15,
  empty_result_rate_max: 0.20,
  unnecessary_tool_rate_max: 0.30,
  correct_silence_rate_min: 0.80,
  latency_p50_max: 850,
  latency_p95_max: 1500,
}

export const PRODUCTION_THRESHOLDS: Thresholds = {
  retrieval_hit_rate_min: 0.90,
  wrong_source_rate_max: 0.10,
  empty_result_rate_max: 0.10,
  unnecessary_tool_rate_max: 0.20,
  correct_silence_rate_min: 0.90,
  latency_p50_max: 800,
  latency_p95_max: 1500,
}
