# SCRAPE1 + SCRAPE2 Architecture Findings

**Date:** 2026-03-22
**Context:** S12-SCRAPE1 (onboarding scrape preview) + S12-SCRAPE2 (knowledge chunk seeding)
**Status:** Research complete, implementation planned

---

## 1. Current Data Flow (Gap Analysis)

### What happens today when a user enters a website URL:

```
Step 1 (intake form)     Step 6 (review)      Trial/Checkout activation
  |                        |                     |
  websiteUrl saved         NO scrape results     scrapeWebsite(url, niche)
  to OnboardingData        shown to user         -> businessFacts[], extraQa[]
  in localStorage                                -> FLATTENED to plain string
                                                 -> injected into prompt
                                                 -> structured data DISCARDED
                                                 -> 0 knowledge_chunks created
                                                 -> queryKnowledge NOT registered
```

### Three critical gaps:

| Gap | Impact | Fix |
|-----|--------|-----|
| User never sees scrape results | No "wow moment", can't verify/correct | SCRAPE1: show editable cards on step 6 |
| Structured data discarded at activation | RAG search impossible for auto-provisioned clients | SCRAPE2: seed knowledge_chunks with embeddings |
| queryKnowledge tool never registered | AI can't look up business facts during calls | SCRAPE2: syncClientTools() after chunk creation |

---

## 2. File-by-File Analysis

### Files that need changes:

| File | Lines | Change Type | What |
|------|-------|-------------|------|
| `src/types/onboarding.ts` | 229 | ADD type field | `websiteScrapeResult` on `OnboardingData` |
| `src/app/onboard/page.tsx` | ~120 | Thread prop | Pass `onUpdate` callback to Step6 |
| `src/app/onboard/steps/step6-review.tsx` | 599 | ADD component | WebsiteScrapePreview cards |
| `src/app/api/onboard/scrape-preview/route.ts` | NEW | NEW route | API endpoint to scrape during review |
| `src/components/onboard/WebsiteScrapePreview.tsx` | NEW | NEW component | Editable scrape cards UI |
| `src/app/api/provision/trial/route.ts` | 263 | MODIFY | Seed knowledge_chunks after activation |
| `src/app/api/stripe/create-public-checkout/route.ts` | 357 | MODIFY | Seed knowledge_chunks after client creation |

### Files that DON'T need changes (reuse as-is):

| File | Why |
|------|-----|
| `src/lib/website-scraper.ts` | `scrapeWebsite()` already returns structured data |
| `src/lib/knowledge-extractor.ts` | `normalizeExtraction()` ready for safety filtering |
| `src/lib/embeddings.ts` | `embedText()` + `embedChunks()` ready for chunk creation |
| `src/lib/sync-client-tools.ts` | `syncClientTools()` handles tool registration |
| `src/lib/prompt-version-utils.ts` | `insertPromptVersion()` for audit trail |

---

## 3. Type Design

### New field on OnboardingData:

```typescript
websiteScrapeResult?: {
  businessFacts: string[]
  extraQa: { q: string; a: string }[]
  serviceTags: string[]
  warnings: string[]
  scrapedAt: string       // ISO timestamp
  scrapedUrl: string      // URL that was scraped
  approvedFacts: boolean[] // per-fact toggle (all true by default)
  approvedQa: boolean[]   // per-QA toggle (all true by default)
} | null
```

**Why this shape?**
- Matches `WebsiteScrapeResult` from `website-scraper.ts` (minus `rawContent` — too large for localStorage)
- `approvedFacts[]` / `approvedQa[]` let users toggle individual items without modifying the arrays
- `scrapedAt` + `scrapedUrl` for staleness detection (re-scrape if URL changed or >1 hour old)
- Stored in localStorage via existing `unmissed-onboard-draft` key

---

## 4. API Route Design: `/api/onboard/scrape-preview`

### Purpose:
Called when user reaches step 6 (review page) and has a `websiteUrl` set. Returns normalized scrape results for preview.

### Request:
```
POST /api/onboard/scrape-preview
Body: { websiteUrl: string, niche: string }
```

### Response:
```json
{
  "businessFacts": ["Open 7 days a week", "Licensed and insured"],
  "extraQa": [{ "q": "Do you do windshields?", "a": "Yes, all makes and models" }],
  "serviceTags": ["windshield", "rock chip", "mobile"],
  "warnings": ["Removed claim: 'We guarantee lowest prices'"],
  "scrapedUrl": "https://example.com",
  "scrapedAt": "2026-03-22T15:30:00Z"
}
```

### Security:
- Rate limited: `SlidingWindowRateLimiter` — 5 scrapes/IP/hour (expensive operation: ~$0.001 OpenRouter + 15s fetch)
- No auth required (public onboarding flow)
- Input validation: URL format check, niche must be valid
- Response sanitized through `normalizeExtraction()` (removes unsafe claims, deduplicates, truncates)

### Error handling:
- Website unreachable: `{ error: "Could not reach website", failureBucket: "fetch_failed" }`
- No useful content: `{ businessFacts: [], extraQa: [], warnings: ["No extractable content found"] }`
- Rate limited: HTTP 429 with `Retry-After`

---

## 5. UI Component Design: WebsiteScrapePreview

### Where it goes in step6-review.tsx:
After the "Ready badge" section (line 393-406), before the "No-FAQ warning" (line 408-426).

### Component behavior:
1. On mount: check if `data.websiteUrl` exists + no cached scrape result → auto-trigger scrape
2. Loading state: skeleton cards with "Analyzing your website..." message
3. Results state: organized cards by category
4. Error state: "Couldn't analyze your website — no worries, your agent will still work great"

### Card categories (visual organization):
- **Business Facts** (checkmark toggles per item) — e.g., "Open 7 days a week", "Licensed and insured"
- **FAQ Pairs** (expandable Q&A cards with toggle) — e.g., Q: "Do you do mobile service?" A: "Yes..."
- **Services Detected** (tag pills, non-editable info) — e.g., "windshield", "rock chip"
- **Warnings** (yellow banner) — items removed for safety, e.g., "Removed: 'We guarantee...'"

### User interactions:
- Toggle individual facts/QAs on/off (checkbox per item)
- Remove item (X button — sets approved to false)
- "Re-scan website" button (re-triggers scrape)
- All changes update `data.websiteScrapeResult` in parent state → persisted to localStorage

### Props interface:
```typescript
interface WebsiteScrapePreviewProps {
  data: OnboardingData
  onUpdate: (partial: Partial<OnboardingData>) => void
}
```

---

## 6. SCRAPE2: Knowledge Chunk Seeding

### Integration points (both routes):

After the client is created and agent is provisioned, seed chunks from the APPROVED scrape data:

```typescript
// After activateClient() or client insert
if (data.websiteScrapeResult) {
  const scrape = data.websiteScrapeResult
  const approvedFacts = scrape.businessFacts.filter((_, i) => scrape.approvedFacts[i] !== false)
  const approvedQa = scrape.extraQa.filter((_, i) => scrape.approvedQa[i] !== false)

  if (approvedFacts.length > 0 || approvedQa.length > 0) {
    const chunks: ChunkInput[] = [
      ...approvedFacts.map(f => ({ content: f, chunkType: 'fact', source: 'website_scrape' })),
      ...approvedQa.map(qa => ({ content: `Q: ${qa.q}\nA: ${qa.a}`, chunkType: 'qa', source: 'website_scrape' }))
    ]
    await embedChunks(clientId, chunks, `onboard-scrape-${Date.now()}`)
    // This creates knowledge_chunks → syncClientTools registers queryKnowledge
    await syncClientTools(supa, clientId)
  }
}
```

### Both routes need this:
1. `provision/trial/route.ts` — after `activateClient()` succeeds (line 246)
2. `create-public-checkout/route.ts` — after client insert (line 283), before Stripe checkout

### Why syncClientTools matters:
- `buildAgentTools()` checks `knowledge_chunk_count > 0` (S5a fix)
- If we seed chunks but don't sync tools, queryKnowledge tool never gets registered
- `syncClientTools()` rebuilds `clients.tools` including queryKnowledge
- Runtime `toolOverrides` at call time reads `clients.tools` — so the tool is immediately available

---

## 7. Existing Patterns to Reuse

### Pattern: approve-website-knowledge/route.ts (lines 85-155)
This route already does exactly what SCRAPE2 needs:
- Embeds facts as `chunk_type: 'fact'`, source `website_scrape`, trust_tier `medium`
- Embeds QAs as `chunk_type: 'qa'`
- Calls `syncClientTools()` after successful inserts
- Upserts with dedup: `onConflict: 'client_id,content_hash,chunk_type,source'`

**Key difference:** That route uses individual `embedText()` calls in a loop. For SCRAPE2, `embedChunks()` is better (handles batching internally).

### Pattern: bulk-import/route.ts (lines 75-113)
Batch embedding with `BATCH_SIZE = 10` via `Promise.allSettled`. Good error handling pattern.

### Pattern: knowledge-extractor.ts normalizeExtraction()
Safety filtering already built:
- Max 12 facts, 8 QAs
- 150 char per fact limit
- Removes unsafe claims ("guarantee", "promise", "we warrant")
- Deduplicates
- Returns warnings for removed items

---

## 8. Edge Cases & Gotchas

### E1: No website URL entered
- Skip scrape entirely. Show nothing. No error.
- ~30% of users won't have a website (new businesses, sole operators)

### E2: Website unreachable or returns empty
- Show friendly message: "We couldn't find info on your website, but that's okay"
- Agent still works — prompt is generated from intake form data only
- Don't block activation

### E3: User changes URL after scrape
- Detect URL change via `scrapedUrl !== data.websiteUrl`
- Show "URL changed — re-scan?" prompt
- Don't auto-re-scrape (costs money, takes time)

### E4: Stale scrape (user returns to step 6 after hours)
- Check `scrapedAt` — if > 24 hours, offer "Re-scan" button prominently
- Don't auto-re-scrape (user may have edited the results)

### E5: Very large website (50+ pages)
- `scrapeWebsite()` already has `FETCH_TIMEOUT_MS = 15_000` and content truncation
- `normalizeExtraction()` caps at 12 facts + 8 QAs
- No additional handling needed

### E6: Duplicate chunks from websiteUrl + knowledgeDocs
- `embedChunks()` upserts with `onConflict: 'client_id,content_hash,chunk_type,source'`
- Same content from different sources = different rows (different `source` value)
- Acceptable — same fact from website + manual doc = higher confidence

### E7: Trial activation fails after chunk seeding
- Chunks are orphaned (clientId exists, client may be deleted on rollback)
- Mitigation: seed chunks BEFORE `activateClient()` but AFTER successful client creation
- Rollback: on activation failure, chunks stay (harmless — tied to clientId that gets deleted)

### E8: Checkout path timing
- In `create-public-checkout`, client is created but not activated (activation happens via Stripe webhook)
- Seed chunks after client creation, not after activation
- Tool registration via `syncClientTools()` happens here
- When Stripe webhook fires `activateClient()`, it calls `syncClientTools()` again (idempotent)

---

## 9. Testing Strategy

### Unit tests:
- `WebsiteScrapePreview` component renders with mock data
- Toggle fact/QA approval updates parent state correctly
- `normalizeExtraction()` edge cases (empty input, all unsafe, duplicates)

### Integration tests:
- `/api/onboard/scrape-preview` returns normalized results for valid URL
- `/api/onboard/scrape-preview` returns graceful error for unreachable URL
- Rate limiting works (6th request in 1 hour → 429)
- Trial provisioning creates knowledge_chunks when scrape data present
- Trial provisioning with no scrape data still works (no chunks, no queryKnowledge tool)

### E2E tests:
- Full onboarding flow: enter URL → step 6 shows scrape cards → toggle items → activate → verify chunks in DB
- Verify queryKnowledge tool registered after activation with scrape data
- Verify agent can answer questions from scraped content during WebRTC test call

---

## 10. Cost Analysis

| Operation | Cost | When |
|-----------|------|------|
| Website fetch | Free | Step 6 mount |
| Claude Haiku extraction | ~$0.001 | Step 6 mount |
| OpenAI embeddings (20 chunks) | ~$0.0002 | Trial activation |
| Total per onboarding | ~$0.0012 | One-time |

At 100 trials/month: ~$0.12/month. Negligible.

---

## 11. Top 1% Builder Considerations

Things not covered in the base plan that separate a good implementation from an exceptional one.

### 11a. Inline Editing (not just toggle)

Users should be able to **edit** scraped facts and QAs, not just toggle them on/off. A fact like "Open 7 days a week" might be wrong — maybe they're closed Sundays. Allow clicking into a fact to edit the text before approval. Same for QA pairs — the answer might be mostly right but need a tweak.

**Implementation:** Each fact/QA card gets an edit icon. Click → inline contenteditable or input field. Save updates `data.websiteScrapeResult.businessFacts[i]` directly. Toggle still controls `approvedFacts[i]`.

### 11b. Add Custom Facts Alongside Scraped Ones

After seeing what the scrape found, users will think "it missed X" and want to add their own facts. Add an "Add a fact" / "Add a Q&A" button at the bottom of each section. Custom additions go into the same arrays with `approved: true` by default.

**Why this matters:** Captures the momentum of "wow, it knows stuff" → "let me teach it more" without making the user navigate to a separate knowledge section.

### 11c. Concurrent Request Race Condition

If the user navigates away from step 6 and back, or changes the URL and clicks "Re-scan", concurrent scrape requests could overlap. The second response overwrites the first mid-render.

**Fix:** Use `AbortController`. On new scrape request, abort the previous one. Store the controller ref in a `useRef`. Clear on unmount.

### 11d. Google Places Data Merge

Step 1 already collects business data via Google Places API (name, address, phone, hours, rating). The website scrape may find overlapping info. Currently these are two separate data sources with no dedup.

**Consideration:** Show Places data alongside scraped data on step 6. "We found this from Google" + "We found this from your website." Conflicts highlighted (e.g., different phone numbers). User picks the correct one. This is the real "wow moment" — two independent sources cross-referenced.

### 11e. Intake FAQ Dedup Against Scraped QAs

Users may have manually entered FAQs in step 4/5 that the website scrape also found. At seeding time, deduplicate: if a scraped QA has >80% content similarity with an intake FAQ, skip it or merge.

**Simple approach:** Normalize both strings (lowercase, strip punctuation), check if one contains the other. `embedChunks` already deduplicates by `content_hash` — but content_hash is exact match, not semantic. Good enough for V1; semantic dedup is V2.

### 11f. Natural Language Preview

After the user reviews the cards, show a preview of how the agent will actually USE this information: "If someone asks about your hours, your agent will say: 'We're open 7 days a week!' If they ask about mobile service, your agent will say: 'Yes, we do mobile service — we come to you.'"

**Why:** Bridges the gap between "data cards" and "voice agent behavior." Makes the abstract concrete. No code complexity — just template the approved facts/QAs into example sentences.

### 11g. Batch Approve/Reject

If the scrape returns 12 facts, toggling each one individually is tedious. Add "Approve all" / "Clear all" buttons per section. Default is all approved — but if the scrape quality is poor, the user needs a fast way to reject everything.

### 11h. Re-scrape Diff

When the user clicks "Re-scan website" (URL changed or stale data), show what changed: new items highlighted green, removed items strikethrough red, unchanged items normal. Prevents confusion when a re-scan produces different results.

**Simple approach:** Compare old `businessFacts[]` vs new by content. New facts not in old array = added. Old facts not in new array = removed. Same content = unchanged.

### 11i. Knowledge Chunk vs Prompt Content Duplication

SCRAPE2 seeds `knowledge_chunks` AND the prompt already has the flattened website content injected by `buildPromptFromIntake()`. Now the same info exists in two places: the prompt (static, baked in) and the knowledge base (searchable via RAG). This is intentional — the prompt gives the agent baseline knowledge, while RAG handles lookup queries. But document this clearly so future developers don't think it's a bug and try to "fix" the duplication.

### 11j. Scrape Failure Analytics

Track scrape outcomes per niche: success rate, average facts extracted, common failure modes. Store in a simple analytics table or log. At 100+ trials/month, this data reveals: "Auto glass websites yield 8 facts on average, but law firm websites only yield 2." Informs: which niches need supplementary questions in the intake form.

**Lightweight approach:** Log scrape outcome to `intake_submissions.intake_json` as `scrapeOutcome: { success, factCount, qaCount, failureReason }`. Query with SQL for dashboards.

### 11k. Multi-page Crawl (Future)

`scrapeWebsite()` currently fetches only the homepage. Many businesses have critical info on subpages: `/services`, `/about`, `/faq`, `/contact`. A multi-page crawl would capture 3-5x more data.

**Not for V1** — adds latency (15s per page × N pages) and cost. But design the data model to support it: `scrapedUrl` becomes `scrapedUrls: string[]`, each fact/QA gets a `sourceUrl` field. Then V2 can add a "Scan more pages" button that crawls linked pages.

### 11l. Accessibility

Scrape preview cards should be keyboard-navigable (Tab between cards, Enter to toggle, Space to expand QA). Screen reader labels for toggle states ("Fact approved" / "Fact excluded"). Color-blind-safe warning indicators (not just yellow — add an icon). This is easy to miss in a card-based UI.

### 11m. Optimistic State During Activation

When the user clicks "Activate" on step 6, chunk seeding takes 2-5 seconds. Show a real-time progress indicator: "Creating your knowledge base... (3/12 facts embedded)". Better than a generic spinner. The user sees their data being processed, reinforcing the "intelligent agent" perception.

### 11n. Error Recovery for Partial Chunk Seeding

If `embedChunks()` partially fails (e.g., 8/12 facts succeed, 4 fail), the current plan wraps it in try/catch and logs. But the user should know: "11 of 12 facts saved. 1 couldn't be processed — you can add it manually in Settings." Return the partial success count in the activation response. The agent still works — just with slightly fewer knowledge chunks.

### 11o. Token Budget Awareness

Each knowledge chunk consumes tokens when retrieved during a call (via `queryKnowledge`). 20 chunks × ~50 tokens each = ~1000 tokens of context per retrieval. At GLM-4.6's context limit, this is fine. But if a user adds 50+ manual chunks on top of 20 scraped chunks, retrieval results could crowd out the system prompt. `queryKnowledge` already limits to top-K results — document the K value and ensure it's tuned for the expected chunk volume post-SCRAPE2.
