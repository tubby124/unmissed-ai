/**
 * Website scraping via direct fetch + Claude Haiku extraction (OpenRouter).
 *
 * Phase 5 architecture: separates URL fetching from extraction.
 *   Step 1: fetch() the URL directly → get real HTML
 *   Step 2: strip HTML to plain text
 *   Step 3: pass text to Claude Haiku via OpenRouter for structured extraction
 *
 * This replaced Perplexity Sonar Pro which answered from its search index
 * instead of the actual URL, producing wrong-location data (e.g. California
 * franchise instead of the Saskatoon business at windshieldhub.ca).
 *
 * Cost: ~$0.001 per scrape (haiku: $0.80/M in + $4/M out).
 *
 * Failure buckets (mutually exclusive):
 *   missing_api_key       — OPENROUTER_API_KEY not set
 *   invalid_url           — URL failed validation
 *   fetch_failed          — direct HTML fetch returned non-200 or empty
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
  | 'fetch_failed'
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
  /** Whether extraction used actual page content (true) vs search index (false) */
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

// ── HTML fetch + strip ────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 15_000

async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; unmissed-scraper/1.0; +https://unmissed.ai)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    clearTimeout(timer)

    if (!res.ok) {
      console.warn(`[website-scraper] HTML fetch failed: ${res.status} ${res.statusText} | url=${url}`)
      return null
    }

    const html = await res.text()
    const finalUrl = res.url || url

    if (!html || html.length < 100) {
      console.warn(`[website-scraper] HTML fetch returned very short content (${html.length} chars) | url=${url}`)
      return null
    }

    console.log(`[website-scraper] HTML fetched: ${html.length} chars | finalUrl=${finalUrl}`)
    return { html, finalUrl }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[website-scraper] HTML fetch error: ${msg} | url=${url}`)
    return null
  }
}

function stripHtml(html: string): string {
  return html
    // Remove script and style blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // Replace block-level tags with newlines for readability
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article|header|footer|main|nav|blockquote)>/gi, '\n')
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim()
}

// ── Layered JSON parser ───────────────────────────────────────────────────────

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

// ── Extraction prompts (text-based, not URL-based) ────────────────────────────

function buildAutoGlassExtractionPrompt(pageText: string, url: string): string {
  return `You are extracting structured business information from a website's plain text content.

SOURCE URL: ${url}
PAGE TEXT:
---
${pageText.slice(0, 6000)}
---

Extract the following as structured JSON. Only include facts explicitly stated in the text above — never invent, assume, or fill in from general knowledge:

{
  "rawContent": "Plain-text summary of the business's substantive content (max 1500 chars). Focus on services, location, pricing, and unique selling points.",
  "businessFacts": [
    "Each fact is one sentence about the business: services, locations, certifications, insurance partners, fleet size, warranty, years in business, staff count, etc.",
    "Prioritize: SGI/ICBC/MPI direct billing, mobile service availability, ADAS calibration capability, OEM vs aftermarket glass, warranty terms, areas served, starting prices."
  ],
  "extraQa": [
    { "q": "Do you offer mobile windshield replacement?", "a": "Answer from the text or 'Not mentioned on website'" },
    { "q": "Do you do direct insurance billing (SGI, ICBC)?", "a": "..." },
    { "q": "Do you offer ADAS recalibration after replacement?", "a": "..." },
    { "q": "What types of glass do you replace?", "a": "..." },
    { "q": "What areas do you serve?", "a": "..." },
    { "q": "Do you offer a warranty on your work?", "a": "..." },
    { "q": "What are your starting prices?", "a": "..." },
    { "q": "Do you handle chip repairs as well?", "a": "..." }
  ],
  "serviceTags": ["windshield replacement", "chip repair", "ADAS calibration", "...only tags confirmed in the text"],
  "warnings": ["List anything that looks like a legal guarantee, insurer-specific promise, or speculative turnaround time that should NOT be put in a voice agent prompt."]
}

IMPORTANT RULES:
- Extract ONLY from the text provided above. Do NOT use outside knowledge.
- Do NOT extract exact legal guarantees or warranty language verbatim — paraphrase.
- Do NOT extract insurer-specific promises (e.g. "we guarantee SGI will cover 100%").
- If a fact is not mentioned in the text, answer "Not mentioned on website".
- Return valid JSON only — no markdown fences, no commentary outside the JSON object.`
}

function buildGenericExtractionPrompt(pageText: string, url: string, niche: string): string {
  const nicheLabel = niche.replace(/_/g, ' ')
  return `You are extracting structured business information from a ${nicheLabel} website's plain text content.

SOURCE URL: ${url}
PAGE TEXT:
---
${pageText.slice(0, 6000)}
---

Extract the following as structured JSON. Only include facts explicitly stated in the text above — never invent, assume, or fill in from general knowledge:

{
  "rawContent": "Plain-text summary of the business's substantive content (max 1500 chars). Focus on services, location, pricing, and unique selling points.",
  "businessFacts": [
    "Each fact is one sentence about the business: services offered, location, years in business, team size, certifications, awards, specialties, hours, pricing info, unique selling points."
  ],
  "extraQa": [
    { "q": "What services do you offer?", "a": "Answer from the text or 'Not mentioned on website'" },
    { "q": "What are your hours of operation?", "a": "..." },
    { "q": "How can I contact you?", "a": "..." },
    { "q": "Do you have any certifications or awards?", "a": "..." },
    { "q": "What areas do you serve?", "a": "..." },
    { "q": "What is your pricing?", "a": "..." },
    { "q": "Do you offer free estimates or consultations?", "a": "..." },
    { "q": "What makes you different from competitors?", "a": "..." }
  ],
  "serviceTags": ["...only service/product tags confirmed in the text"],
  "warnings": ["List anything that looks like a legal guarantee, exact quote, or speculative claim that should NOT be put in a voice agent prompt."]
}

IMPORTANT RULES:
- Extract ONLY from the text provided above. Do NOT use outside knowledge.
- Do NOT extract exact legal guarantees or warranty language verbatim — paraphrase.
- If a fact is not mentioned in the text, answer "Not mentioned on website".
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

  // ── Step 1: Fetch actual HTML from URL ──────────────────────────────────
  const fetched = await fetchHtml(url)
  if (!fetched) {
    console.warn(`[website-scraper] Direct HTML fetch failed for ${url} | bucket=fetch_failed`)
    return fail('fetch_failed')
  }

  // ── Step 2: Strip HTML to plain text ────────────────────────────────────
  const plainText = stripHtml(fetched.html)
  console.log(`[website-scraper] Stripped text: ${plainText.length} chars from ${fetched.html.length} HTML chars | url=${url}`)

  if (plainText.length < 50) {
    console.warn(`[website-scraper] Stripped text too short (${plainText.length} chars) — site may be JS-rendered | bucket=fetch_failed | url=${url}`)
    return fail('fetch_failed')
  }

  // ── Step 3: Extract structured data via Claude Haiku ────────────────────
  // Normalize niche — DB stores "auto-glass" but code uses "auto_glass"
  const nicheNormalized = niche.replace(/-/g, '_')

  const extractionPrompt =
    nicheNormalized === 'auto_glass'
      ? buildAutoGlassExtractionPrompt(plainText, url)
      : buildGenericExtractionPrompt(plainText, url, niche)

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
        model: 'anthropic/claude-haiku-4.5',
        messages: [{ role: 'user', content: extractionPrompt }],
        max_tokens: 2000,
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '(unreadable)')
      console.warn(
        `[website-scraper] OpenRouter returned ${res.status} for extraction | bucket=provider_http_error | body=${body.slice(0, 500)}`
      )
      return fail('provider_http_error')
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }

    const raw = data?.choices?.[0]?.message?.content?.trim() ?? ''

    if (!raw) {
      console.warn(`[website-scraper] Empty extraction response for ${url} | bucket=empty_content`)
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

    const result: WebsiteScrapeResult = {
      rawContent: parsed.rawContent.slice(0, 1500),
      businessFacts: parsed.businessFacts.filter(
        (f): f is string => typeof f === 'string' && f.length > 0
      ),
      extraQa: parsed.extraQa.filter(
        (qa) => qa.q.length > 0 && qa.a.length > 0 &&
          !qa.a.toLowerCase().includes('not mentioned on website')
      ),
      serviceTags: parsed.serviceTags.filter(
        (t): t is string => typeof t === 'string' && t.length > 0
      ),
      warnings: parsed.warnings.filter(
        (w): w is string => typeof w === 'string' && w.length > 0
      ),
      failureBucket: 'success',
      citedTargetUrl: true, // Always true — we fetched the actual page
    }

    console.log(
      `[website-scraper] bucket=success | ${result.businessFacts.length} facts, ${result.extraQa.length} QA, ${result.serviceTags.length} tags | method=fetch+haiku | url=${url}`
    )
    return result
  } catch (err) {
    console.error('[website-scraper] Extraction error | bucket=timeout_or_crash:', err)
    return fail('timeout')
  }
}
