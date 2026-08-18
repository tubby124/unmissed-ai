export const BOWNESS_CANONICAL_AREA = 'Bowness' as const
export const BOWNESS_PRONUNCIATION_HINT = 'Bowness = BOH-ness' as const
export const BOWNESS_CLARIFICATION_QUESTION = 'Just to confirm, did you mean Bowness (BOH-ness), or somewhere else?' as const

const APPROVED_CANONICAL_AREAS = new Map<string, typeof BOWNESS_CANONICAL_AREA>([
  ['bowness', BOWNESS_CANONICAL_AREA],
])

export type CalgaryPlaceEvidence = {
  raw: string | null
  canonicalArea: typeof BOWNESS_CANONICAL_AREA | null
  needsConfirmation: boolean
  spokenClarification: typeof BOWNESS_CLARIFICATION_QUESTION | null
  pronunciationHints: string[]
}

function cleanPlace(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/\s+/g, ' ')
  return trimmed ? trimmed : null
}

/**
 * Narrow Calgary place allow-list.
 *
 * Intentionally not a city database: only exact approved tokens may become
 * canonical CRM/writeback area. Near-misses from speech/classifier drift stay
 * raw evidence and must be confirmed by the caller.
 */
export function normalizeCalgaryPlace(value: string): typeof BOWNESS_CANONICAL_AREA | null {
  const cleaned = cleanPlace(value)
  if (!cleaned) return null
  return APPROVED_CANONICAL_AREAS.get(cleaned.toLowerCase()) ?? null
}

export function buildCalgaryPlaceEvidence(value?: string | null): CalgaryPlaceEvidence {
  const raw = cleanPlace(value)
  if (!raw) {
    return {
      raw: null,
      canonicalArea: null,
      needsConfirmation: false,
      spokenClarification: null,
      pronunciationHints: [],
    }
  }

  const canonicalArea = normalizeCalgaryPlace(raw)
  if (canonicalArea === BOWNESS_CANONICAL_AREA) {
    return {
      raw,
      canonicalArea,
      needsConfirmation: false,
      spokenClarification: null,
      pronunciationHints: [BOWNESS_PRONUNCIATION_HINT],
    }
  }

  return {
    raw,
    canonicalArea: null,
    needsConfirmation: true,
    spokenClarification: BOWNESS_CLARIFICATION_QUESTION,
    pronunciationHints: [],
  }
}

const TRANSCRIPT_PLACE_TOKEN_PATTERN = /\b(Bowness|Bonita|Bonas)\b/i
const TRANSCRIPT_PLACE_PHRASE_PATTERN = /\b(Bowness|Bonita|Bonas)\s+(Heights|Hill|Hills|Ridge|Park|Lake|Lakes|Meadows|Valley|View|Woods|Creek|Springs|Crossing|Landing|Point|Pointe|Estates|Glen|Grove|Village|Gardens|Green|Greens|Bay|Terrace|Place|Ranch|Rise)\b/i

export function extractCalgaryPlaceEvidenceFromTranscript(transcriptText: string): CalgaryPlaceEvidence {
  const cleaned = cleanPlace(transcriptText)
  if (!cleaned) return buildCalgaryPlaceEvidence(null)

  const phraseMatch = cleaned.match(TRANSCRIPT_PLACE_PHRASE_PATTERN)
  if (phraseMatch?.[0]) {
    return buildCalgaryPlaceEvidence(phraseMatch[0])
  }

  const match = cleaned.match(TRANSCRIPT_PLACE_TOKEN_PATTERN)
  return buildCalgaryPlaceEvidence(match?.[1] ?? null)
}
