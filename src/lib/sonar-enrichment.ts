/**
 * Sonar Pro enrichment via OpenRouter.
 * Fetches local business facts to inject into system prompts,
 * making agents sound like local experts rather than generic scripts.
 *
 * Returns empty string on failure — never blocks prompt generation.
 */

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY

export async function enrichWithSonar(
  businessName: string,
  city: string,
  niche: string,
  websiteUrl?: string
): Promise<string> {
  if (!OPENROUTER_KEY) {
    console.warn('[sonar-enrichment] OPENROUTER_API_KEY not set — skipping enrichment')
    return ''
  }

  const siteHint = websiteUrl ? ` Their website is ${websiteUrl}.` : ''
  const prompt = `Search for "${businessName}" in ${city}.${siteHint} I need SPECIFIC local facts to make an AI phone agent sound like a local expert for this ${niche.replace(/_/g, ' ')} business:
1. Any notable projects, success stories, or reviews mentioning specific jobs they've done
2. Unique specialties or services that local competitors don't offer
3. Named staff, certifications, or awards if publicly mentioned
4. Anything that makes this business distinctly local (not generic industry facts)

Return 3-5 concrete sentences. No generic industry advice. Cite only what you can verify. If no useful local data is found, say "No local-specific data found."`

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'perplexity/sonar-pro',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
      }),
    })

    if (!res.ok) {
      console.warn(`[sonar-enrichment] OpenRouter returned ${res.status} — skipping`)
      return ''
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = data.choices?.[0]?.message?.content?.trim() ?? ''

    if (!content || content.toLowerCase().includes('no local-specific data found')) {
      console.log(`[sonar-enrichment] No useful local data found for "${businessName}" in ${city}`)
      return ''
    }

    console.log(`[sonar-enrichment] ${content.length} chars found for "${businessName}" in ${city}`)
    return content
  } catch (err) {
    console.error('[sonar-enrichment] Fetch threw:', err)
    return ''
  }
}
