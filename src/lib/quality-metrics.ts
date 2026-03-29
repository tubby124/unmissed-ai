import type { AnalysisMessage } from './transcript-analysis'

// Mirrors HEDGE_PHRASES from transcript-analysis.ts — keep in sync manually
const HEDGE_PHRASES = [
  "i don't have that information",
  "i'm not sure about that",
  "i don't know",
  "i'm not able to",
  "i can't help with that",
  "you'd need to contact",
  "i don't have details",
  "i'm unable to",
  "that's outside",
  "i don't have access to that",
  "i'm not certain",
  "i can't provide that",
  "i wouldn't be able to",
  "you'll have to check",
  "i'm not aware of",
  "unfortunately i don't",
  "i don't have specific",
]

export interface QualityMetrics {
  talk_ratio_agent:     number  // 0.0–1.0 (agent words / total words)
  agent_confidence:     number  // 0.0–1.0 (1 = never hedged)
  short_turn_count:     number  // agent turns with text.length < SHORT_TURN_THRESHOLD
  loop_rate:            number  // 0.0–1.0 (exact-repeat user turns / total user turns)
  avg_agent_turn_chars: number  // mean agent response length in chars
}

const SHORT_TURN_THRESHOLD = 30  // chars; proxy for interruption or empty response

function round2(x: number): number {
  return Math.round(x * 100) / 100
}

export function analyzeQualityMetrics(messages: AnalysisMessage[]): QualityMetrics {
  const agentTurns = messages.filter(m => m.role === 'agent')
  const userTurns  = messages.filter(m => m.role === 'user')

  // --- talk_ratio_agent ---
  const agentWords = agentTurns.reduce((n, m) => n + m.text.split(/\s+/).filter(Boolean).length, 0)
  const userWords  = userTurns.reduce((n, m) => n + m.text.split(/\s+/).filter(Boolean).length, 0)
  const totalWords = agentWords + userWords
  const talk_ratio_agent = totalWords === 0 ? 0 : round2(agentWords / totalWords)

  // --- agent_confidence ---
  // Rate of agent turns that contain at least one hedge phrase
  let hedgedTurns = 0
  for (const m of agentTurns) {
    const lower = m.text.toLowerCase()
    if (HEDGE_PHRASES.some(p => lower.includes(p))) hedgedTurns++
  }
  const hedgeRate = agentTurns.length === 0 ? 0 : hedgedTurns / agentTurns.length
  const agent_confidence = round2(Math.max(0, 1 - hedgeRate))

  // --- short_turn_count ---
  const short_turn_count = agentTurns.filter(m => m.text.trim().length < SHORT_TURN_THRESHOLD).length

  // --- loop_rate ---
  // Exact-match duplicate user turns (normalized). No fuzzy matching in v1.
  const seen = new Set<string>()
  let duplicateUserTurns = 0
  for (const m of userTurns) {
    const normalized = m.text.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
    if (normalized.length === 0) continue
    if (seen.has(normalized)) {
      duplicateUserTurns++
    } else {
      seen.add(normalized)
    }
  }
  const loop_rate = userTurns.length === 0 ? 0 : round2(duplicateUserTurns / userTurns.length)

  // --- avg_agent_turn_chars ---
  const avg_agent_turn_chars = agentTurns.length === 0
    ? 0
    : Math.round(agentTurns.reduce((n, m) => n + m.text.length, 0) / agentTurns.length)

  return {
    talk_ratio_agent,
    agent_confidence,
    short_turn_count,
    loop_rate,
    avg_agent_turn_chars,
  }
}
