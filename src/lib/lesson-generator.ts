/**
 * Lesson Generator — Learning Bank
 *
 * Threshold-driven extraction of `prompt_lessons` rows from:
 *   1. A single call's call_insights row + transcript (generateLessonsFromInsight)
 *   2. Aggregated knowledge_query_log rows (generateLessonsFromKnowledgeGaps)
 *
 * All inserts are best-effort (try/catch, log errors, never throw) — these
 * functions are invoked from the `after()` block of the completed webhook
 * and from cron jobs, where throwing would crash the webhook handler.
 */
import { analyzeTranscriptForRobotics, type TranscriptTurn } from '@/lib/call-transcripts'

// ── Types ─────────────────────────────────────────────────────────────────────

/** Subset of call_insights columns we actually read. */
export interface InsightLike {
  loop_rate?: number | null
  repeated_questions?: number | null
  caller_frustrated?: boolean | null
  feature_suggestions?: unknown
  agent_confidence?: number | null
  duration_seconds?: number | null
  agent_confused_moments?: number | null
  unanswered_questions?: unknown
  call_status?: string | null
}

interface GenerateFromInsightParams {
  clientId: string
  callId: string
  insight: InsightLike
  transcript: TranscriptTurn[]
}

type ObservationType = 'failure' | 'success' | 'edge_case' | 'knowledge_gap'
type Severity = 'low' | 'medium' | 'high'
type LessonSource =
  | 'manual'
  | 'call_insights_threshold'
  | 'knowledge_query_log'
  | 'call_review'

interface LessonRow {
  client_id: string
  call_id: string | null
  observation_type: ObservationType
  what_happened: string
  recommended_change: string | null
  severity: Severity
  status: 'open'
  source: LessonSource
  metadata?: Record<string, unknown>
}

// Loose Supabase type — prompt_lessons / knowledge_query_log aren't in
// database.types.ts yet (migration in flight).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return fallback
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

/** Lowercase + collapse whitespace — used to cluster knowledge gap queries. */
function normalizeQuery(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ')
}

async function insertLesson(
  supabase: AnySupabase,
  row: LessonRow,
): Promise<void> {
  try {
    const { error } = await supabase.from('prompt_lessons').insert(row)
    if (error) {
      console.error(
        `[lesson-generator] insert failed (type=${row.observation_type} severity=${row.severity}): ${error.message}`,
      )
    }
  } catch (err) {
    console.error('[lesson-generator] insertLesson exception:', err)
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run threshold rules against a single call's insight + transcript and insert
 * `prompt_lessons` rows for any rule that fires. Idempotency is NOT enforced
 * here — repeated calls will produce duplicate rows. Caller is expected to
 * invoke once per call (post-insight write in the completed webhook).
 *
 * Best-effort: never throws. Each insert is independently try/caught.
 */
export async function generateLessonsFromInsight(
  supabase: AnySupabase,
  params: GenerateFromInsightParams,
): Promise<void> {
  const { clientId, callId, insight, transcript } = params

  if (!clientId || !callId || !insight) {
    console.warn('[lesson-generator] generateLessonsFromInsight: missing params')
    return
  }

  try {
    const lessons: LessonRow[] = []

    const loopRate = safeNumber(insight.loop_rate, 0)
    const repeatedQuestions = safeNumber(insight.repeated_questions, 0)
    const agentConfidence = safeNumber(insight.agent_confidence, 1)
    const durationSeconds = safeNumber(insight.duration_seconds, 0)
    const confusedMoments = safeNumber(insight.agent_confused_moments, 0)
    const unansweredQuestions = arrayLength(insight.unanswered_questions)
    const callStatus = (insight.call_status ?? '').toString()

    // Rule: high loop rate
    if (loopRate > 0.2) {
      lessons.push({
        client_id: clientId,
        call_id: callId,
        observation_type: 'failure',
        severity: 'high',
        what_happened: `Agent looped — ${repeatedQuestions} repeated questions, loop_rate=${loopRate}`,
        recommended_change:
          'Strengthen the no-repeat-sentence rule or add explicit memory of what was already covered.',
        status: 'open',
        source: 'call_insights_threshold',
      })
    }

    // Rule: caller frustrated
    if (insight.caller_frustrated === true) {
      const featureSuggestions = insight.feature_suggestions
      const featureSummary = featureSuggestions
        ? `Suggested: ${typeof featureSuggestions === 'string'
            ? featureSuggestions
            : JSON.stringify(featureSuggestions)}`
        : ''
      lessons.push({
        client_id: clientId,
        call_id: callId,
        observation_type: 'failure',
        severity: 'high',
        what_happened: `Caller frustrated. ${featureSummary}`.trim(),
        recommended_change: null,
        status: 'open',
        source: 'call_insights_threshold',
      })
    }

    // Rule: low agent confidence on substantive call
    if (agentConfidence < 0.5 && durationSeconds > 30) {
      lessons.push({
        client_id: clientId,
        call_id: callId,
        observation_type: 'failure',
        severity: 'medium',
        what_happened: 'Agent low-confidence on substantive call',
        recommended_change: null,
        status: 'open',
        source: 'call_insights_threshold',
      })
    }

    // Rule: agent confused multiple times
    if (confusedMoments > 2) {
      lessons.push({
        client_id: clientId,
        call_id: callId,
        observation_type: 'failure',
        severity: 'medium',
        what_happened: `Agent confused ${confusedMoments} times.`,
        recommended_change: null,
        status: 'open',
        source: 'call_insights_threshold',
      })
    }

    // Rule: knowledge gap from unresolved questions
    if (unansweredQuestions > 0) {
      lessons.push({
        client_id: clientId,
        call_id: callId,
        observation_type: 'knowledge_gap',
        severity: 'medium',
        what_happened: `${unansweredQuestions} unanswered question(s) detected during the call.`,
        recommended_change: null,
        status: 'open',
        source: 'call_insights_threshold',
      })
    }

    // ── Transcript-derived rules ──────────────────────────────────────────────
    const robotics = analyzeTranscriptForRobotics(transcript)

    if (robotics.hollowAffirmationCount > 2) {
      lessons.push({
        client_id: clientId,
        call_id: callId,
        observation_type: 'failure',
        severity: 'low',
        what_happened: 'Used hollow affirmations like "great question" 3+ times',
        recommended_change: null,
        status: 'open',
        source: 'call_insights_threshold',
        metadata: { hollow_affirmation_count: robotics.hollowAffirmationCount },
      })
    }

    if (robotics.didDenyBeingAI) {
      lessons.push({
        client_id: clientId,
        call_id: callId,
        observation_type: 'failure',
        severity: 'high',
        what_happened: 'Agent denied being an AI — brand-critical failure.',
        recommended_change:
          'Reinforce identity disclosure rules in the system prompt.',
        status: 'open',
        source: 'call_insights_threshold',
      })
    }

    // ── Success rule ──────────────────────────────────────────────────────────
    if (durationSeconds > 90 && callStatus === 'HOT') {
      lessons.push({
        client_id: clientId,
        call_id: callId,
        observation_type: 'success',
        severity: 'low',
        what_happened: 'Long HOT call — examine for promotable patterns',
        recommended_change: null,
        status: 'open',
        source: 'call_insights_threshold',
      })
    }

    // Fire all inserts in parallel — each is independently best-effort.
    await Promise.all(lessons.map(l => insertLesson(supabase, l)))

    if (lessons.length > 0) {
      console.log(
        `[lesson-generator] inserted ${lessons.length} lesson(s) for callId=${callId} clientId=${clientId}`,
      )
    }
  } catch (err) {
    console.error('[lesson-generator] generateLessonsFromInsight error:', err)
  }
}

/**
 * Cluster recent unresolved knowledge_query_log entries by normalized query
 * text and emit ONE prompt_lessons row per cluster of 3+ matches.
 * Idempotent: skips clusters that already have an OPEN lesson with the same
 * normalized query in metadata.cluster_key.
 *
 * Designed to be invoked from a cron route — best-effort, never throws.
 */
export async function generateLessonsFromKnowledgeGaps(
  supabase: AnySupabase,
  clientId: string,
): Promise<void> {
  if (!clientId) {
    console.warn('[lesson-generator] generateLessonsFromKnowledgeGaps: missing clientId')
    return
  }

  try {
    // Pull unresolved queries from the last 7 days.
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: queries, error: queryErr } = await supabase
      .from('knowledge_query_log')
      .select('query_text')
      .eq('client_id', clientId)
      .eq('resolution_type', 'unresolved')
      .gte('created_at', cutoff) as {
        data: Array<{ query_text: string }> | null
        error: { message: string } | null
      }

    if (queryErr) {
      console.error(
        `[lesson-generator] knowledge_query_log fetch failed for clientId=${clientId}: ${queryErr.message}`,
      )
      return
    }

    if (!queries || queries.length === 0) return

    // Cluster by normalized query text.
    const clusters = new Map<string, string[]>()
    for (const q of queries) {
      const text = typeof q.query_text === 'string' ? q.query_text : ''
      if (!text) continue
      const key = normalizeQuery(text)
      if (!key) continue
      const arr = clusters.get(key) ?? []
      arr.push(text)
      clusters.set(key, arr)
    }

    // Fetch existing OPEN knowledge_gap lessons for this client to dedupe.
    const { data: existing, error: existingErr } = await supabase
      .from('prompt_lessons')
      .select('metadata')
      .eq('client_id', clientId)
      .eq('status', 'open') as {
        data: Array<{ metadata: { cluster_key?: string } | null }> | null
        error: { message: string } | null
      }

    if (existingErr) {
      console.error(
        `[lesson-generator] existing lessons fetch failed: ${existingErr.message}`,
      )
      // Continue anyway — duplicates are tolerable.
    }

    const existingKeys = new Set<string>()
    for (const row of existing ?? []) {
      const key = row?.metadata?.cluster_key
      if (typeof key === 'string') existingKeys.add(key)
    }

    let inserted = 0
    for (const [key, samples] of clusters.entries()) {
      if (samples.length < 3) continue
      if (existingKeys.has(key)) continue

      const row: LessonRow = {
        client_id: clientId,
        call_id: null,
        observation_type: 'knowledge_gap',
        severity: 'medium',
        what_happened: `${samples.length} unresolved knowledge queries clustered around: "${samples[0].slice(0, 120)}"`,
        recommended_change: null,
        status: 'open',
        source: 'knowledge_query_log',
        metadata: {
          cluster_key: key,
          query_count: samples.length,
          sample_queries: samples.slice(0, 5),
        },
      }
      await insertLesson(supabase, row)
      inserted++
    }

    if (inserted > 0) {
      console.log(
        `[lesson-generator] inserted ${inserted} knowledge-gap cluster lesson(s) for clientId=${clientId}`,
      )
    }
  } catch (err) {
    console.error('[lesson-generator] generateLessonsFromKnowledgeGaps error:', err)
  }
}
