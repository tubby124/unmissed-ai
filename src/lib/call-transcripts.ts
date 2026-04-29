/**
 * Call Transcripts — Learning Bank
 *
 * Helpers for fetching, persisting, and analyzing call transcripts.
 * Used by the completed webhook to feed the learning bank pipeline.
 *
 * - fetchUltravoxTranscript() — wrapper around getTranscript() returning the raw turn array
 * - persistTranscript() — upserts a row into call_transcripts (keyed on ultravox_call_id)
 * - analyzeTranscriptForRobotics() — pure heuristic analysis used by the lesson generator
 */
import { getTranscript } from '@/lib/ultravox'

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Shape of a single transcript turn returned by getTranscript().
 * NOTE: Ultravox messages come back with role 'agent'/'user' (lowercase) after
 * getTranscript() normalizes them. The DB schema doc references 'AGENT'/'USER'
 * but we store whatever getTranscript() produced (lowercase) and analyze using
 * lowercase too. The DB jsonb is opaque so format choice is internal.
 */
export interface TranscriptTurn {
  role: string
  text: string
  startTime?: number
  endTime?: number
}

export interface RoboticsAnalysis {
  avgAgentTurnChars: number
  longestAgentTurn: number
  hollowAffirmationCount: number
  repeatedSentencePairs: number
  didHangupSameTurn: boolean
  didDenyBeingAI: boolean
}

interface PersistTranscriptParams {
  callId: string | null | undefined
  ultravoxCallId: string
  clientId: string
  slug: string
  transcript: TranscriptTurn[]
}

// Loose Supabase type — call_transcripts isn't in database.types.ts yet (migration pending).
// Service-client typing is intentionally permissive here to avoid coupling to the typed schema
// and to remain compatible with both createServiceClient() and createTypedServiceClient().
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

// ── Constants for robotics analysis ───────────────────────────────────────────

/** Phrases that signal hollow / filler affirmations from the agent. */
const HOLLOW_AFFIRMATIONS = [
  'great question',
  'good question',
  'excellent question',
  'that\'s a great question',
  'that\'s a good question',
  'absolutely',
  'i totally understand',
  'i completely understand',
]

/** Phrases that may indicate the agent denied being an AI. */
const DENY_AI_PHRASES = [
  'i am a real person',
  "i'm a real person",
  'i am not an ai',
  "i'm not an ai",
  'i am not a bot',
  "i'm not a bot",
  'i am human',
  "i'm human",
  'i am a human',
  "i'm a human",
  'no i am not ai',
  'no i\'m not ai',
]

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch the transcript for an Ultravox call.
 * Returns the raw turn array exactly as getTranscript() produced it (role lowercase).
 * Empty array on failure — never throws.
 */
export async function fetchUltravoxTranscript(
  ultravoxCallId: string,
): Promise<TranscriptTurn[]> {
  try {
    const turns = await getTranscript(ultravoxCallId)
    return turns as TranscriptTurn[]
  } catch (err) {
    console.error(
      `[call-transcripts] fetchUltravoxTranscript failed for ${ultravoxCallId}:`,
      err,
    )
    return []
  }
}

/**
 * Persist a transcript into call_transcripts. Upserts on ultravox_call_id (unique idx).
 * Returns the row id, or null on failure (best-effort — never throws).
 */
export async function persistTranscript(
  supabase: AnySupabase,
  params: PersistTranscriptParams,
): Promise<string | null> {
  const { callId, ultravoxCallId, clientId, slug, transcript } = params

  if (!ultravoxCallId || !clientId || !Array.isArray(transcript)) {
    console.warn('[call-transcripts] persistTranscript: missing required params')
    return null
  }

  try {
    const turn_count = transcript.length
    let total_chars = 0
    let agent_chars = 0
    let caller_chars = 0

    for (const turn of transcript) {
      const text = typeof turn.text === 'string' ? turn.text : ''
      const len = text.length
      total_chars += len
      const role = String(turn.role || '').toLowerCase()
      // Accept both 'agent'/'user' (getTranscript normalized) and the
      // 'AGENT'/'USER' shape referenced in the table schema.
      if (role === 'agent') agent_chars += len
      else if (role === 'user') caller_chars += len
    }

    const row: Record<string, unknown> = {
      ultravox_call_id: ultravoxCallId,
      client_id: clientId,
      slug,
      full_transcript: transcript,
      turn_count,
      total_chars,
      agent_chars,
      caller_chars,
      fetched_at: new Date().toISOString(),
      source: 'ultravox',
    }
    if (callId) row.call_id = callId

    const { data, error } = await supabase
      .from('call_transcripts')
      .upsert(row, { onConflict: 'ultravox_call_id' })
      .select('id')
      .single()

    if (error) {
      console.error(
        `[call-transcripts] persistTranscript upsert failed for ${ultravoxCallId}: ${error.message}`,
      )
      return null
    }
    return data?.id ?? null
  } catch (err) {
    console.error(
      `[call-transcripts] persistTranscript error for ${ultravoxCallId}:`,
      err,
    )
    return null
  }
}

/**
 * Pure heuristic analysis of a transcript — used by the lesson generator
 * to surface "robotic" or brand-critical agent failures.
 * No DB calls, no side effects. Always returns numbers (0 for edge cases).
 */
export function analyzeTranscriptForRobotics(
  transcript: TranscriptTurn[],
): RoboticsAnalysis {
  if (!Array.isArray(transcript) || transcript.length === 0) {
    return {
      avgAgentTurnChars: 0,
      longestAgentTurn: 0,
      hollowAffirmationCount: 0,
      repeatedSentencePairs: 0,
      didHangupSameTurn: false,
      didDenyBeingAI: false,
    }
  }

  // Normalize roles once for consistent matching.
  const turns = transcript.map(t => ({
    role: String(t.role || '').toLowerCase(),
    text: typeof t.text === 'string' ? t.text : '',
  }))

  const agentTurns = turns.filter(t => t.role === 'agent')

  let totalAgentChars = 0
  let longestAgentTurn = 0
  let hollowAffirmationCount = 0
  let didDenyBeingAI = false

  // Track agent sentences across turns to detect repeated sentence pairs.
  const agentSentences: string[] = []

  for (const turn of agentTurns) {
    const text = turn.text
    const len = text.length
    totalAgentChars += len
    if (len > longestAgentTurn) longestAgentTurn = len

    const lower = text.toLowerCase()
    for (const phrase of HOLLOW_AFFIRMATIONS) {
      if (lower.includes(phrase)) hollowAffirmationCount++
    }
    if (!didDenyBeingAI) {
      for (const phrase of DENY_AI_PHRASES) {
        if (lower.includes(phrase)) {
          didDenyBeingAI = true
          break
        }
      }
    }

    // Split into sentences for repeat detection.
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim().toLowerCase())
      .filter(s => s.length > 12) // ignore short fillers
    agentSentences.push(...sentences)
  }

  const avgAgentTurnChars =
    agentTurns.length === 0
      ? 0
      : Math.round((totalAgentChars / agentTurns.length) * 100) / 100

  // Repeated sentence pairs = number of sentences that appeared 2+ times.
  const sentenceCounts = new Map<string, number>()
  for (const s of agentSentences) {
    sentenceCounts.set(s, (sentenceCounts.get(s) ?? 0) + 1)
  }
  let repeatedSentencePairs = 0
  for (const count of sentenceCounts.values()) {
    if (count >= 2) repeatedSentencePairs++
  }

  // didHangupSameTurn — heuristic: did the agent end on a turn that also asked
  // a question or made an offer the caller never answered? We approximate by
  // checking whether the FINAL turn was an agent turn that ended in '?' (caller
  // never got to respond).
  const lastTurn = turns[turns.length - 1]
  const didHangupSameTurn =
    !!lastTurn && lastTurn.role === 'agent' && /\?\s*$/.test(lastTurn.text.trim())

  return {
    avgAgentTurnChars,
    longestAgentTurn,
    hollowAffirmationCount,
    repeatedSentencePairs,
    didHangupSameTurn,
    didDenyBeingAI,
  }
}
