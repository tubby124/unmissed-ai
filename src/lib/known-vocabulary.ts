import anchorTerms from '@/data/anchor-terms-canada.json'

type AnchorPack = Record<string, string[] | { _meta?: unknown }> & {
  _meta?: unknown
}

const PACK = anchorTerms as AnchorPack

const MAX_TERMS_PER_CITY = 80

export function buildKnownVocabularyBlock(serviceAreas: string[] | null | undefined): string {
  if (!serviceAreas || serviceAreas.length === 0) return ''

  const sections: string[] = []
  for (const rawCity of serviceAreas) {
    const city = rawCity?.trim()
    if (!city) continue
    const list = PACK[city]
    if (!Array.isArray(list) || list.length === 0) continue
    const trimmed = list.slice(0, MAX_TERMS_PER_CITY)
    sections.push(`${city}: ${trimmed.join(', ')}`)
  }

  if (sections.length === 0) return ''

  return (
    `## Known Vocabulary (service-area neighborhoods)\n` +
    `When the caller mentions a community or neighborhood, prefer these spellings if the audio is unclear:\n` +
    sections.map(s => `- ${s}`).join('\n')
  )
}
