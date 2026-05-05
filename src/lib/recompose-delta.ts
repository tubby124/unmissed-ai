/**
 * D451 — Recompose char-delta gate.
 *
 * Pure helpers shared by /api/dashboard/variables/preview (server) and
 * RecomposeConfirmDialog (client) to compute drift between the stored prompt
 * and a recomposed preview, and decide whether the confirm flow needs the
 * "I accept content loss" gate.
 *
 * Uses parsePromptSections() to identify which slot section lost the most
 * content, so the dialog can call out exactly what's at risk.
 */

import { parsePromptSections } from './prompt-sections'

export const DEFAULT_DELTA_THRESHOLD_CHARS = 500
export const DEFAULT_DELTA_THRESHOLD_PCT = 5

export type SectionDelta = {
  sectionId: string
  storedChars: number
  newChars: number
  delta: number
}

export type RecomposeDelta = {
  storedChars: number
  recomposedChars: number
  charsDropped: number
  charsAdded: number
  /** Pure additive recompose = 0. We gate on drop-ratio, not net length change. */
  percentChange: number
  biggestDropSection: string | null
  topDropSections: SectionDelta[]
  thresholdChars: number
  thresholdPct: number
  exceedsThreshold: boolean
}

function readThresholds(): { chars: number; pct: number } {
  const charsRaw = process.env.RECOMPOSE_DELTA_THRESHOLD_CHARS
  const pctRaw = process.env.RECOMPOSE_DELTA_THRESHOLD_PCT
  const chars = charsRaw ? parseInt(charsRaw, 10) : NaN
  const pct = pctRaw ? parseFloat(pctRaw) : NaN
  return {
    chars: Number.isFinite(chars) && chars >= 0 ? chars : DEFAULT_DELTA_THRESHOLD_CHARS,
    pct: Number.isFinite(pct) && pct >= 0 ? pct : DEFAULT_DELTA_THRESHOLD_PCT,
  }
}

export function computeRecomposeDelta(
  stored: string,
  recomposed: string,
  thresholds?: { chars: number; pct: number },
): RecomposeDelta {
  const { chars: thresholdChars, pct: thresholdPct } = thresholds ?? readThresholds()

  const storedSections = parsePromptSections(stored)
  const recomposedSections = parsePromptSections(recomposed)
  const allIds = new Set([...Object.keys(storedSections), ...Object.keys(recomposedSections)])

  const deltas: SectionDelta[] = []
  for (const sectionId of allIds) {
    const s = (storedSections[sectionId] ?? '').length
    const n = (recomposedSections[sectionId] ?? '').length
    if (s === n) continue
    deltas.push({ sectionId, storedChars: s, newChars: n, delta: n - s })
  }

  const charsDropped = deltas.reduce((sum, d) => sum + (d.delta < 0 ? -d.delta : 0), 0)
  const charsAdded = deltas.reduce((sum, d) => sum + (d.delta > 0 ? d.delta : 0), 0)
  // Drop-ratio: how much of the stored prompt would be lost on recompose.
  // We deliberately do NOT use abs(net length change) — pure-additive recomposes are safe.
  const percentChange = stored.length > 0
    ? Number(((charsDropped / stored.length) * 100).toFixed(2))
    : 0

  const drops = deltas.filter(d => d.delta < 0).sort((a, b) => a.delta - b.delta)
  const biggestDropSection = drops.length > 0 ? drops[0].sectionId : null
  const topDropSections = drops.slice(0, 3)

  const exceedsThreshold = charsDropped > thresholdChars || percentChange > thresholdPct

  return {
    storedChars: stored.length,
    recomposedChars: recomposed.length,
    charsDropped,
    charsAdded,
    percentChange,
    biggestDropSection,
    topDropSections,
    thresholdChars,
    thresholdPct,
    exceedsThreshold,
  }
}
