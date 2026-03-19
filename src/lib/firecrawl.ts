/**
 * Website scraping via Perplexity Sonar (OpenRouter) + Haiku extraction.
 *
 * Replaces Firecrawl (no credits) with Sonar's built-in web access.
 * Sonar reads the URL directly — no separate scraper needed.
 * Cost: ~$0.002 per scrape (perplexity/sonar: $1/M in + $1/M out).
 *
 * Both functions are fail-safe: they never throw, always return '' on error.
 * Used during prompt generation to auto-enrich agents with website content.
 */

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY

/**
 * scrapeAndExtract — uses Perplexity Sonar to read a URL and return raw business content.
 * Returns '' on any error — never throws.
 */
export async function scrapeAndExtract(url: string): Promise<string> {
  if (!OPENROUTER_KEY) {
    console.warn('[website-scraper] OPENROUTER_API_KEY not set — skipping website scrape')
    return ''
  }

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
        model: 'perplexity/sonar',
        messages: [{
          role: 'user',
          content: `Visit this URL and extract ALL the business content from the page: ${url}

Return the full text content of the page, focusing on:
- Services or products offered (with any prices)
- Business hours
- Location and contact info
- Staff names or certifications
- FAQ content
- Any unique selling points

Exclude: navigation menus, footer links, cookie notices, privacy policies, social media buttons, ads, and generic boilerplate. Return only the substantive business content as plain text.`,
        }],
        max_tokens: 1500,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '(unreadable)')
      console.warn(`[website-scraper] scrapeAndExtract: HTTP ${res.status} for ${url} — ${body.slice(0, 200)}`)
      return ''
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = data?.choices?.[0]?.message?.content?.trim() ?? ''

    if (!content) {
      console.warn(`[website-scraper] scrapeAndExtract: empty response for ${url}`)
      return ''
    }

    const truncated = content.slice(0, 3000)
    console.log(`[website-scraper] scrapeAndExtract: ${truncated.length} chars from ${url}`)
    return truncated
  } catch (err) {
    console.warn('[website-scraper] scrapeAndExtract: unexpected error —', err)
    return ''
  }
}

/**
 * extractBusinessContent — runs a Claude Haiku pass via OpenRouter to extract
 * useful business info from scraped website content.
 * Returns '' on any error — never throws.
 */
export async function extractBusinessContent(rawContent: string): Promise<string> {
  if (!rawContent.trim()) return ''

  if (!OPENROUTER_KEY) {
    console.warn('[website-scraper] OPENROUTER_API_KEY not set — skipping content extraction')
    return ''
  }

  const systemPrompt = `You extract structured business information from website content for use in AI voice agent prompts.

Extract ONLY content that would be useful for a phone agent answering calls. Include:
- Top 10 services or products offered (with any prices mentioned)
- FAQ items found on the page (question + answer pairs)
- Business hours if found
- Staff names, certifications, or awards if mentioned
- Any unique selling points or local specialties

IMPORTANT: Do NOT include navigation menus, footer links, cookie notices, privacy policy text, social media follow prompts, or generic site boilerplate. Focus only on real business content that callers would ask about.

Write in plain text. No markdown formatting. No bullet points. Use short paragraphs or run-on sentences. This output will be injected into a voice agent prompt.`

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://unmissed.ai',
        'X-Title': 'unmissed.ai prompt enrichment',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4.5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract business content from this website text:\n\n${rawContent}` },
        ],
        max_tokens: 600,
        temperature: 0,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '(unreadable)')
      console.warn(`[website-scraper] extractBusinessContent: HTTP ${res.status} — ${body.slice(0, 200)}`)
      return ''
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = data?.choices?.[0]?.message?.content?.trim() ?? ''

    if (!content) {
      console.warn('[website-scraper] extractBusinessContent: empty content in response')
      return ''
    }

    const result = content.slice(0, 1500)
    console.log(`[website-scraper] extractBusinessContent: ${result.length} chars extracted`)
    return result
  } catch (err) {
    console.warn('[website-scraper] extractBusinessContent: unexpected error —', err)
    return ''
  }
}
