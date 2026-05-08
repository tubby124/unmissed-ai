import anchorTerms from '@/data/anchor-terms-canada.json'

type AnchorPack = Record<string, string[] | { _meta?: unknown }> & {
  _meta?: unknown
}

const PACK = anchorTerms as AnchorPack

// Niches whose agents benefit from neighborhood vocabulary anchoring.
// Other niches (auto_glass, restaurant, home_renovation, etc.) don't gain
// meaningful accuracy from neighborhood spelling lists and shouldn't pay
// the ~3.5K char/city budget for nothing.
export const VOCAB_NICHES: ReadonlySet<string> = new Set([
  'property_management',
  'real_estate',
])

export function isVocabNiche(niche: string | null | undefined): boolean {
  return !!niche && VOCAB_NICHES.has(niche)
}

// Cap is defensive against future runaway data, not a curation tool.
// Raised 80 → 300 after the test for "Nolan Hill" failed: the entry that triggered
// this whole change sits at Calgary index 124 (alphabetical), past the 80 cap.
// Calgary list is currently 213, Edmonton 252. 300 covers all current cities with headroom.
// Char budget at 300/city is ~3.5K per city (well under the 21K hard cap on injected prompt).
const MAX_TERMS_PER_CITY = 300

export function buildKnownVocabularyBlock(serviceAreas: string[] | null | undefined): string {
  if (!serviceAreas || serviceAreas.length === 0) return ''

  const sections: string[] = []
  const unmapped: string[] = []
  for (const rawCity of serviceAreas) {
    const city = rawCity?.trim()
    if (!city) continue
    const list = PACK[city]
    if (!Array.isArray(list) || list.length === 0) {
      // Track cities the client serves but the pack doesn't cover. Logged below
      // so unmapped Canadian cities (Lethbridge, Red Deer, Saskatoon, etc.)
      // surface in Railway logs and we know what to add to the pack on the
      // next quarterly refresh. Without this, a Lethbridge realtor onboards
      // and silently gets zero benefit from the feature.
      unmapped.push(city)
      continue
    }
    const trimmed = list.slice(0, MAX_TERMS_PER_CITY)
    sections.push(`${city}: ${trimmed.join(', ')}`)
  }

  if (unmapped.length > 0) {
    console.warn(
      `[anchor-pack] unmapped cities (no neighborhood data): ${unmapped.join(', ')}`,
    )
  }

  if (sections.length === 0) return ''

  return (
    `## Known Vocabulary (service-area neighborhoods)\n` +
    `When the caller mentions a community or neighborhood, prefer these spellings if the audio is unclear:\n` +
    sections.map(s => `- ${s}`).join('\n')
  )
}
