/**
 * firecrawl.ts — Firecrawl scraping + OpenRouter extraction helpers
 *
 * Both functions are fail-safe: they never throw, always return '' on error.
 * Used during prompt generation to auto-enrich agents with website content.
 */

/**
 * scrapeAndExtract — fetches raw markdown from a URL via Firecrawl REST API.
 * Returns '' on any error — never throws.
 */
export async function scrapeAndExtract(url: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) {
    console.warn('[firecrawl] FIRECRAWL_API_KEY not set — skipping website scrape')
    return ''
  }

  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '(unreadable)')
      console.warn(`[firecrawl] scrapeAndExtract: HTTP ${res.status} for ${url} — ${body.slice(0, 200)}`)
      return ''
    }

    const data = await res.json()
    const markdown: string = data?.data?.markdown || ''

    if (!markdown.trim()) {
      console.warn(`[firecrawl] scrapeAndExtract: empty markdown returned for ${url}`)
      return ''
    }

    const truncated = markdown.slice(0, 3000)
    console.log(`[firecrawl] scrapeAndExtract: ${truncated.length} chars from ${url}`)
    return truncated
  } catch (err) {
    console.warn('[firecrawl] scrapeAndExtract: unexpected error —', err)
    return ''
  }
}

/**
 * extractBusinessContent — runs a Claude Haiku pass via OpenRouter to extract
 * useful business info from raw Firecrawl markdown.
 * Returns '' on any error — never throws.
 */
export async function extractBusinessContent(rawMarkdown: string): Promise<string> {
  if (!rawMarkdown.trim()) return ''

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    console.warn('[firecrawl] OPENROUTER_API_KEY not set — skipping content extraction')
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
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://unmissed.ai',
        'X-Title': 'unmissed.ai prompt enrichment',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4.5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract business content from this website text:\n\n${rawMarkdown}` },
        ],
        max_tokens: 600,
        temperature: 0,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '(unreadable)')
      console.warn(`[firecrawl] extractBusinessContent: HTTP ${res.status} — ${body.slice(0, 200)}`)
      return ''
    }

    const data = await res.json()
    const content: string = data?.choices?.[0]?.message?.content?.trim() || ''

    if (!content) {
      console.warn('[firecrawl] extractBusinessContent: empty content in response')
      return ''
    }

    const result = content.slice(0, 1500)
    console.log(`[firecrawl] extractBusinessContent: ${result.length} chars extracted`)
    return result
  } catch (err) {
    console.warn('[firecrawl] extractBusinessContent: unexpected error —', err)
    return ''
  }
}
