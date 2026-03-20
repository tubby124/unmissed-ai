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
 * Failure buckets (mutually exclusive):
 *   missing_api_key       — OPENROUTER_API_KEY not set
 *   invalid_url           — URL failed validation
 *   timeout               — Promise.race hit the timeout
 *   provider_http_error   — OpenRouter returned non-200
 *   empty_content         — 200 OK but choices[0].message.content is empty/null
 *   json_parse_error      — content exists but all JSON parse layers failed
 *   shape_validation_error— JSON parsed but missing required fields
 *   success               — facts extracted
 */

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY

export type FailureBucket =
  | 'missing_api_key'
  | 'invalid_url'
  | 'timeout'
  | 'provider_http_error'
  | 'empty_content'
  | 'json_parse_error'
  | 'shape_validation_error'
  | 'success'

export type WebsiteScrapeResult = {
  rawContent: string
  businessFacts: string[]
  extraQa: { q: string; a: string }[]
  serviceTags: string[]
  warnings: string[]
  failureBucket: FailureBucket
  /** Whether Sonar cited the target URL (vs answering from search index) */
  citedTargetUrl?: boolean
}

const EMPTY_RESULT: Omit<WebsiteScrapeResult, 'failureBucket'> = {
  rawContent: '',
  businessFacts: [],
  extraQa: [],
  serviceTags: [],
  warnings: [],
}

function fail(bucket: FailureBucket): WebsiteScrapeResult {
  return { ...EMPTY_RESULT, failureBucket: bucket }
}

function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

// ── Layered JSON parser ───────────────────────────────────────────────────────
// Sonar sometimes wraps JSON in markdown fences or adds commentary.
// Try increasingly aggressive extraction before giving up.

function layeredJsonParse(raw: string): { parsed: unknown; layer: string } | null {
  // Layer 1: direct parse
  try {
    return { parsed: JSON.parse(raw), layer: 'direct' }
  } catch { /* continue */ }

  // Layer 2: strip markdown fences
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
  if (stripped !== raw) {
    try {
      return { parsed: JSON.parse(stripped), layer: 'stripped_fences' }
    } catch { /* continue */ }
  }

  // Layer 3: extract first plausible JSON object block
  const match = raw.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      return { parsed: JSON.parse(match[0]), layer: 'regex_extract' }
    } catch { /* continue */ }
  }

  return null
}

// ── Prompts ───────────────────────────────────────────────────────────────────

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

// ── Validation ────────────────────────────────────────────────────────────────

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

// ── Main scrape function ──────────────────────────────────────────────────────

export async function scrapeWebsite(
  url: string,
  niche: string
): Promise<WebsiteScrapeResult> {
  if (!OPENROUTER_KEY) {
    console.warn('[website-scraper] OPENROUTER_API_KEY not set — skipping | bucket=missing_api_key')
    return fail('missing_api_key')
  }

  if (!isValidHttpUrl(url)) {
    console.warn(`[website-scraper] Invalid URL: ${url} | bucket=invalid_url`)
    return fail('invalid_url')
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
        `[website-scraper] OpenRouter returned ${res.status} for ${url} | bucket=provider_http_error | body=${body.slice(0, 500)}`
      )
      return fail('provider_http_error')
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
      citations?: string[]
      search_results?: unknown[]
    }

    // Log citation/search data — tells us if Sonar browsed the URL vs search index
    const citations: string[] = data.citations ?? []
    const hasSearchResults = Array.isArray(data.search_results) && data.search_results.length > 0
    const targetDomain = new URL(url).hostname
    const citedTargetUrl = citations.some(c => c.includes(targetDomain))

    console.log(
      `[website-scraper] Citations: ${citations.length} | citedTarget=${citedTargetUrl} | hasSearchResults=${hasSearchResults} | url=${url}`
    )
    if (citations.length > 0) {
      console.log(`[website-scraper] Citation URLs: ${citations.slice(0, 5).join(', ')}`)
    }

    const raw = data?.choices?.[0]?.message?.content?.trim() ?? ''

    if (!raw) {
      console.warn(`[website-scraper] Empty response for ${url} | bucket=empty_content`)
      return fail('empty_content')
    }

    // Layered JSON parsing
    const parseResult = layeredJsonParse(raw)

    if (!parseResult) {
      console.warn(
        `[website-scraper] All JSON parse layers failed for ${url} | bucket=json_parse_error | first 500 chars: ${raw.slice(0, 500)}`
      )
      return fail('json_parse_error')
    }

    console.log(`[website-scraper] JSON parsed via layer: ${parseResult.layer}`)
    const parsed = parseResult.parsed

    if (!validateShape(parsed)) {
      const keys = parsed && typeof parsed === 'object' ? Object.keys(parsed as object) : []
      console.warn(
        `[website-scraper] Shape validation failed for ${url} | bucket=shape_validation_error | keys=[${keys.join(',')}]`
      )
      return fail('shape_validation_error')
    }

    // Truthfulness check — did Sonar actually read this URL?
    const resultWarnings = [...parsed.warnings]
    if (!citedTargetUrl && citations.length > 0) {
      resultWarnings.push(
        'Model may not have read the target URL — results may be from search index. Verify facts before approving.'
      )
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
      warnings: resultWarnings.filter(
        (w): w is string => typeof w === 'string' && w.length > 0
      ),
      failureBucket: 'success',
      citedTargetUrl,
    }

    console.log(
      `[website-scraper] bucket=success | ${result.businessFacts.length} facts, ${result.extraQa.length} QA, ${result.serviceTags.length} tags | citedTarget=${citedTargetUrl} | url=${url}`
    )
    return result
  } catch (err) {
    console.error('[website-scraper] Unexpected error | bucket=timeout_or_crash:', err)
    return fail('timeout')
  }
}
