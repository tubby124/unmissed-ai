import { BRAND_NAME, BRAND_REFERER } from '@/lib/brand'

// Subset of the DB call_insights row fields used by this module
export interface CallInsightRow {
  id: string
  call_log_id?: string | null     // UUID of call_logs row (not Ultravox call ID)
  caller_frustrated: boolean | null
  unanswered_questions: Array<{ question: string }> | null
  agent_confused_moments: number | null
  agent_confidence: number | null   // 8o column (may be null for older rows)
  feature_suggestions: Array<{ feature: string; action?: string }> | null
  repeated_questions: number | null
}

type SuggestionSectionId = 'identity' | 'hours' | 'knowledge' | 'after_hours' | 'tone' | 'flow' | 'technical'
type TriggerType = 'unanswered_question' | 'frustration' | 'feature_gap' | 'low_confidence'

interface FailureCluster {
  type: TriggerType
  call_log_ids: string[]          // internal call_logs.id UUIDs
  sample_evidence: string[]       // top 3 questions/phrases/features
  section_id: SuggestionSectionId
  call_count: number
}

// Supabase client interface (service role only)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServiceClient = any

// ── Lock ──────────────────────────────────────────────────────────────────────

/**
 * Attempts to atomically acquire a 24h suggestion-generation lock for a client.
 * Uses INSERT ... ON CONFLICT DO NOTHING (not check-then-run) to prevent races.
 * Returns true if this call acquired the lock (and should proceed with generation).
 */
export async function tryAcquireSuggestionLock(supabase: ServiceClient, clientId: string): Promise<boolean> {
  // First, remove any expired locks for this client
  await supabase
    .from('suggestion_generation_lock')
    .delete()
    .eq('client_id', clientId)
    .lt('expires_at', new Date().toISOString())

  const { count, error } = await supabase
    .from('suggestion_generation_lock')
    .upsert(
      {
        client_id: clientId,
        locked_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      },
      { onConflict: 'client_id', ignoreDuplicates: true, count: 'exact' }
    )

  if (error) {
    console.error('[8m] lock upsert error:', error.message)
    return false
  }

  return count === 1
}

// ── Recent insights ───────────────────────────────────────────────────────────

export async function fetchRecentInsights(
  supabase: ServiceClient,
  clientId: string,
  days: number
): Promise<CallInsightRow[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data, error } = await supabase
    .from('call_insights')
    .select('id, call_log_id, caller_frustrated, unanswered_questions, agent_confused_moments, agent_confidence, feature_suggestions, repeated_questions')
    .eq('client_id', clientId)
    .gte('created_at', since)
    .limit(50)

  if (error) {
    console.error('[8m] fetchRecentInsights error:', error.message)
    return []
  }

  return data ?? []
}

// ── Failure classification ────────────────────────────────────────────────────

export function isFailedCall(insight: CallInsightRow): boolean {
  return (
    insight.caller_frustrated === true ||
    (Array.isArray(insight.unanswered_questions) && insight.unanswered_questions.length >= 1) ||
    (typeof insight.agent_confused_moments === 'number' && insight.agent_confused_moments >= 2) ||
    (typeof insight.agent_confidence === 'number' && insight.agent_confidence < 0.6)
  )
}

// ── Failure clustering ────────────────────────────────────────────────────────

function clusterFailures(insights: CallInsightRow[]): FailureCluster[] {
  const failed = insights.filter(isFailedCall)

  // Collect unanswered questions across calls
  const questionMap = new Map<string, { call_ids: string[]; questions: string[] }>()
  for (const row of failed) {
    if (!Array.isArray(row.unanswered_questions) || row.unanswered_questions.length === 0) continue
    const callId = row.id
    for (const q of row.unanswered_questions) {
      const key = q.question.toLowerCase().trim().slice(0, 60)
      if (!questionMap.has(key)) questionMap.set(key, { call_ids: [], questions: [] })
      const entry = questionMap.get(key)!
      if (!entry.call_ids.includes(callId)) entry.call_ids.push(callId)
      entry.questions.push(q.question)
    }
  }

  // Collect frustration calls
  const frustrationCallIds = failed
    .filter(r => r.caller_frustrated)
    .map(r => r.id)

  // Collect feature gap calls
  const featureMap = new Map<string, string[]>()
  for (const row of failed) {
    if (!Array.isArray(row.feature_suggestions)) continue
    for (const f of row.feature_suggestions) {
      if (!featureMap.has(f.feature)) featureMap.set(f.feature, [])
      featureMap.get(f.feature)!.push(row.id)
    }
  }

  // Collect low confidence calls
  const lowConfCallIds = failed
    .filter(r => typeof r.agent_confidence === 'number' && r.agent_confidence < 0.6)
    .map(r => r.id)

  const clusters: FailureCluster[] = []

  // Unanswered question clusters (only those spanning >= 2 calls)
  for (const [, entry] of questionMap) {
    if (entry.call_ids.length < 2) continue
    clusters.push({
      type: 'unanswered_question',
      call_log_ids: entry.call_ids,
      sample_evidence: [...new Set(entry.questions)].slice(0, 3),
      section_id: 'knowledge',
      call_count: entry.call_ids.length,
    })
  }

  // Frustration cluster (>= 2 calls)
  if (frustrationCallIds.length >= 2) {
    const agentConfused = failed.filter(r => r.caller_frustrated && (r.agent_confused_moments ?? 0) >= 1)
    clusters.push({
      type: 'frustration',
      call_log_ids: frustrationCallIds,
      sample_evidence: agentConfused.length >= 1 ? ['caller frustration + agent confusion detected'] : ['repeated caller frustration detected'],
      section_id: agentConfused.length >= 1 ? 'flow' : 'knowledge',
      call_count: frustrationCallIds.length,
    })
  }

  // Feature gap clusters (>= 2 calls per feature)
  for (const [feature, callIds] of featureMap) {
    if (callIds.length < 2) continue
    const isRoutingFeature = ['booking', 'transfer', 'calendar'].some(f => feature.toLowerCase().includes(f))
    clusters.push({
      type: 'feature_gap',
      call_log_ids: callIds,
      sample_evidence: [feature],
      section_id: isRoutingFeature ? 'identity' : 'knowledge',
      call_count: callIds.length,
    })
  }

  // Low confidence cluster (>= 2 calls)
  if (lowConfCallIds.length >= 2) {
    clusters.push({
      type: 'low_confidence',
      call_log_ids: lowConfCallIds,
      sample_evidence: [`agent confidence below threshold in ${lowConfCallIds.length} calls`],
      section_id: 'knowledge',
      call_count: lowConfCallIds.length,
    })
  }

  return clusters
}

// ── Haiku suggestion generation ───────────────────────────────────────────────

async function callHaiku(userPrompt: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    console.error('[8m] OPENROUTER_API_KEY not set — cannot generate suggestions')
    return null
  }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': BRAND_REFERER,
        'X-Title': `${BRAND_NAME} prompt suggestion`,
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4.5',
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
    })

    if (!res.ok) {
      console.error(`[8m] Haiku API error: ${res.status}`)
      return null
    }

    const json = await res.json()
    const raw = json?.choices?.[0]?.message?.content ?? ''

    // Parse JSON from response
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0])
    return typeof parsed.suggestion === 'string' ? parsed.suggestion : null
  } catch (err) {
    console.error('[8m] Haiku call failed:', err)
    return null
  }
}

function extractSectionText(systemPrompt: string, sectionId: SuggestionSectionId): string {
  // Simple extraction: look for section header markers
  const markerPart = sectionId.replace(/_/g, ' ').toUpperCase()
  const re = new RegExp(`#+ .*${markerPart}.*\\n([\\s\\S]*?)(?=\\n#+ |$)`, 'i')
  const match = systemPrompt.match(re)
  const text = match?.[1]?.trim() ?? ''
  return text.slice(0, 500)
}

// ── Main entrypoint ──────────────────────────────────────────────────────────

/**
 * Clusters recent failed calls, generates Haiku suggestions, and stores them.
 * Always fire-and-forget — the caller must NOT await this (use .catch only).
 */
export async function generateAndStoreSuggestions(
  supabase: ServiceClient,
  clientId: string,
  insights: CallInsightRow[],
  systemPrompt: string,
): Promise<void> {
  const clusters = clusterFailures(insights)

  if (clusters.length === 0) {
    console.log(`[8m] No clusters found for clientId=${clientId}`)
    return
  }

  console.log(`[8m] Processing ${clusters.length} cluster(s) for clientId=${clientId}`)

  for (const cluster of clusters) {
    try {
      const sectionText = extractSectionText(systemPrompt, cluster.section_id)

      const userPrompt = `You are improving a voice AI agent's system prompt section.

TARGET SECTION: ${cluster.section_id}
CURRENT CONTENT (truncated to 500 chars): ${sectionText || '(no content found for this section)'}

FAILURE PATTERN (${cluster.call_count} calls):
Type: ${cluster.type}
Evidence: ${cluster.sample_evidence.join(' | ')}

Write ONE specific prompt improvement (2-4 sentences). Rules:
- Imperative voice: "Add a line that says..." or "Change the instruction to..."
- Concrete, not generic
- Do NOT suggest enabling features (handled separately)
- Stay within this section's scope
- Output JSON only: { "suggestion": "..." }`

      const suggestionText = await callHaiku(userPrompt)

      if (!suggestionText) {
        console.warn(`[8m] No suggestion generated for cluster type=${cluster.type} section=${cluster.section_id}`)
        continue
      }

      // Upsert: if a pending suggestion already exists for this (client, section, trigger),
      // increment evidence_count and add call_log_ids. Partial unique index enforces dedup.
      const { error } = await supabase.rpc('upsert_prompt_suggestion', {
        p_client_id: clientId,
        p_section_id: cluster.section_id,
        p_trigger_type: cluster.type,
        p_suggestion_text: suggestionText,
        p_call_log_ids: cluster.call_log_ids,
        p_evidence_count: cluster.call_count,
      })

      if (error) {
        // rpc not available yet — fall back to direct upsert
        await supabase
          .from('prompt_improvement_suggestions')
          .upsert(
            {
              client_id: clientId,
              section_id: cluster.section_id,
              trigger_type: cluster.type,
              suggestion_text: suggestionText,
              call_log_ids: cluster.call_log_ids,
              evidence_count: cluster.call_count,
              status: 'pending',
            },
            { onConflict: 'client_id,section_id,trigger_type', ignoreDuplicates: true }
          )
        console.log(`[8m] Stored suggestion type=${cluster.type} section=${cluster.section_id} for clientId=${clientId}`)
      } else {
        console.log(`[8m] Upserted suggestion via rpc type=${cluster.type} section=${cluster.section_id}`)
      }
    } catch (clusterErr) {
      console.error(`[8m] Cluster processing error (non-fatal) type=${cluster.type}:`, clusterErr)
    }
  }
}
