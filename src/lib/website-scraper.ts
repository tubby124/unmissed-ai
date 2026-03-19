/**
 * Website scraping via Perplexity Sonar Pro (OpenRouter).
 *
 * Replaces the old firecrawl.ts two-step flow (scrape + extract) with a single
 * Sonar Pro call that browses the URL AND extracts structured business knowledge
 * in one shot. Niche-aware: auto_glass gets insurance/ADAS-focused extraction;
 * other niches get a generic business extraction prompt.
 *
 * Cost: ~$0.003 per scrape (perplexity/sonar-pro: $3/M in + $15/M out).
 * Cap: 4 pages max (homepage + 3 high-value pages).
 *
 * Fail-safe: never throws, returns EMPTY_RESULT on any error.
 */

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY

export type WebsiteScrapeResult = {
  rawContent: string
  businessFacts: string[]
  extraQa: { q: string; a: string }[]
  serviceTags: string[]
  warnings: string[]
}

const EMPTY_RESULT: WebsiteScrapeResult = {
  rawContent: '',
  businessFacts: [],
  extraQa: [],
  serviceTags: [],
  warnings: [],
}

function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function buildAutoGlassPrompt(url: string): string {
  return `Visit this business website: ${url}

Browse the homepage and up to 3 additional high-value pages (services, about, FAQ, pricing — skip blog posts, privacy policy, terms).

Extract the following as structured JSON. Only include facts you can verify from the site — never invent or assume:

{
  "rawContent": "Plain-text summary of all substantive page content (max 1500 chars). Exclude nav, footer, cookie banners, ads.",
  "businessFacts": [
    "Each fact is one sentence about the business: services, locations, certifications, insurance partners, fleet size, warranty, years in business, staff count, etc.",
    "Prioritize: SGI/ICBC/MPI direct billing, mobile service availability, ADAS calibration capability, OEM vs aftermarket glass, warranty terms, areas served, starting prices."
  ],
  "extraQa": [
    { "q": "Do you offer mobile windshield replacement?", "a": "Answer from the site or 'Not mentioned on website'" },
    { "q": "Do you do direct insurance billing (SGI, ICBC)?", "a": "..." },
    { "q": "Do you offer ADAS recalibration after replacement?", "a": "..." },
    { "q": "What types of glass do you replace?", "a": "..." },
    { "q": "What areas do you serve?", "a": "..." },
    { "q": "Do you offer a warranty on your work?", "a": "..." },
    { "q": "What are your starting prices?", "a": "..." },
    { "q": "Do you handle chip repairs as well?", "a": "..." }
  ],
  "serviceTags": ["windshield replacement", "chip repair", "ADAS calibration", "...only tags confirmed on the site"],
  "warnings": ["List anything that looks like a legal guarantee, insurer-specific promise, or speculative turnaround time that should NOT be put in a voice agent prompt."]
}

IMPORTANT SAFETY RULES:
- Do NOT extract exact legal guarantees or warranty language verbatim — paraphrase.
- Do NOT extract insurer-specific promises (e.g. "we guarantee SGI will cover 100%").
- Do NOT guess turnaround times unless explicitly stated on the site.
- If a fact is ambiguous, skip it rather than speculate.
- Return valid JSON only — no markdown fences, no commentary outside the JSON object.`
}

function buildGenericPrompt(url: string, niche: string): string {
  const nicheLabel = niche.replace(/_/g, ' ')
  return `Visit this ${nicheLabel} business website: ${url}

Browse the homepage and up to 3 additional high-value pages (services, about, FAQ, pricing — skip blog posts, privacy policy, terms).

Extract the following as structured JSON. Only include facts you can verify from the site — never invent or assume:

{
  "rawContent": "Plain-text summary of all substantive page content (max 1500 chars). Exclude nav, footer, cookie banners, ads.",
  "businessFacts": [
    "Each fact is one sentence about the business: services offered, location, years in business, team size, certifications, awards, specialties, hours, pricing info, unique selling points."
  ],
  "extraQa": [
    { "q": "What services do you offer?", "a": "Answer from the site or 'Not mentioned on website'" },
    { "q": "What are your hours of operation?", "a": "..." },
    { "q": "How can I contact you?", "a": "..." },
    { "q": "Do you have any certifications or awards?", "a": "..." },
    { "q": "What areas do you serve?", "a": "..." },
    { "q": "What is your pricing?", "a": "..." },
    { "q": "Do you offer free estimates or consultations?", "a": "..." },
    { "q": "What makes you different from competitors?", "a": "..." }
  ],
  "serviceTags": ["...only service/product tags confirmed on the site"],
  "warnings": ["List anything that looks like a legal guarantee, exact quote, or speculative claim that should NOT be put in a voice agent prompt."]
}

IMPORTANT SAFETY RULES:
- Do NOT extract exact legal guarantees or warranty language verbatim — paraphrase.
- Do NOT guess turnaround times, prices, or capacity unless explicitly stated on the site.
- If a fact is ambiguous, skip it rather than speculate.
- Return valid JSON only — no markdown fences, no commentary outside the JSON object.`
}

function validateShape(data: unknown): data is WebsiteScrapeResult {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  if (typeof obj.rawContent !== 'string') return false
  if (!Array.isArray(obj.businessFacts)) return false
  if (!Array.isArray(obj.extraQa)) return false
  if (!Array.isArray(obj.serviceTags)) return false
  if (!Array.isArray(obj.warnings)) return false
  for (const qa of obj.extraQa) {
    if (!qa || typeof qa !== 'object') return false
    const pair = qa as Record<string, unknown>
    if (typeof pair.q !== 'string' || typeof pair.a !== 'string') return false
  }
  return true
}

export async function scrapeWebsite(
  url: string,
  niche: string
): Promise<WebsiteScrapeResult> {
  if (!OPENROUTER_KEY) {
    console.warn('[website-scraper] OPENROUTER_API_KEY not set — skipping')
    return EMPTY_RESULT
  }

  if (!isValidHttpUrl(url)) {
    console.warn(`[website-scraper] Invalid URL (must be http/https): ${url}`)
    return EMPTY_RESULT
  }

  const prompt =
    niche === 'auto_glass'
      ? buildAutoGlassPrompt(url)
      : buildGenericPrompt(url, niche)

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://unmissed.ai',
        'X-Title': 'unmissed.ai website scraper',
      },
      body: JSON.stringify({
        model: 'perplexity/sonar-pro',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '(unreadable)')
      console.warn(
        `[website-scraper] OpenRouter returned ${res.status} for ${url} — ${body.slice(0, 200)}`
      )
      return EMPTY_RESULT
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const raw = data?.choices?.[0]?.message?.content?.trim() ?? ''

    if (!raw) {
      console.warn(`[website-scraper] Empty response for ${url}`)
      return EMPTY_RESULT
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      console.warn(
        `[website-scraper] Failed to parse JSON from Sonar response for ${url} — first 200 chars: ${raw.slice(0, 200)}`
      )
      return EMPTY_RESULT
    }

    if (!validateShape(parsed)) {
      console.warn(
        `[website-scraper] Response shape mismatch for ${url} — missing required fields`
      )
      return EMPTY_RESULT
    }

    const result: WebsiteScrapeResult = {
      rawContent: parsed.rawContent.slice(0, 1500),
      businessFacts: parsed.businessFacts.filter(
        (f): f is string => typeof f === 'string' && f.length > 0
      ),
      extraQa: parsed.extraQa.filter(
        (qa) => qa.q.length > 0 && qa.a.length > 0
      ),
      serviceTags: parsed.serviceTags.filter(
        (t): t is string => typeof t === 'string' && t.length > 0
      ),
      warnings: parsed.warnings.filter(
        (w): w is string => typeof w === 'string' && w.length > 0
      ),
    }

    console.log(
      `[website-scraper] ${result.businessFacts.length} facts, ${result.extraQa.length} QA pairs, ${result.serviceTags.length} tags from ${url}`
    )
    return result
  } catch (err) {
    console.error('[website-scraper] Unexpected error:', err)
    return EMPTY_RESULT
  }
}
