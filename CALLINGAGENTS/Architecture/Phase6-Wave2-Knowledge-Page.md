---
type: architecture
status: planning
tags: [phase6, wave2, knowledge, ui]
related: [[Architecture/Phase6-Wave2-Dashboard-Matrix]], [[Features/Knowledge RAG]], [[Features/AI Compiler]]
updated: 2026-03-31
---

# Phase 6 Wave 2 — Knowledge Page Redesign

## Design Principles
1. **Inject fast, remove easy.** One-click add, one-click delete, inline edit.
2. **Drawer for complex ops.** Upload/Scrape/Compile open in a slide-over drawer, not inline-expand.
3. **Knowledge Health Score** at top — weighted, niche-aware, motivational.
4. **Granular control over AI-extracted content.** Every chunk is approve/edit/delete individually.
5. **Bulk operations for unanswered questions.** Select many → generate all → review → approve.

---

## Knowledge Health Score Formula

```
Score = (Completeness × 0.35) + (Coverage × 0.25) + (Freshness × 0.20) + (Sources × 0.15) + (Resolution × 0.05)

Where:
  Completeness = min(1, (facts + faqs + approved_chunks) / niche_target)
    niche_target = { auto_glass: 50, plumbing: 40, property_mgmt: 60, real_estate: 80, general: 30 }

  Coverage = niche_keyword_score (0-1)
    Check: does agent know hours, pricing, services, location, FAQ top-5 for this niche?
    Simple version: count of [has_hours, has_pricing, has_services, has_location, has_faqs] / 5

  Freshness = 1 - (stale_items / total_items)
    stale = items not updated in 90+ days
    If no items: freshness = 0

  Sources = min(1, connected_sources / 4)
    connected = count of [website_approved, google_profile, documents, text_imports] where count > 0
    Target: 4 sources = full marks

  Resolution = 1 - (unanswered / (unanswered + answered))
    answered = faqs + skipped_gaps
    unanswered = open gaps
    If no gaps exist: resolution = 1
```

### Display
- **Score badge:** 0-100, color-coded (red <40, amber 40-70, green >70)
- **Progress bar** with label: "Getting started" / "Good" / "Strong" / "Excellent"
- **Next action CTA:** "Answer 5 more questions to reach 85%"
- **Breakdown tooltip:** hover to see individual dimension scores

### Niche-Specific Targets (what "100%" looks like)
| Niche | Facts target | FAQ target | Sources target | Key coverage items |
|-------|-------------|-----------|---------------|-------------------|
| auto_glass | 15+ | 10+ | 3+ | pricing, insurance, mobile service, hours |
| plumbing | 12+ | 8+ | 3+ | emergency policy, service area, pricing, hours |
| property_mgmt | 20+ | 12+ | 3+ | application process, maintenance, hours, fees |
| real_estate | 25+ | 15+ | 4+ | areas served, specialties, process, fees |
| general | 10+ | 5+ | 2+ | hours, services, location |

---

## Page Layout (5 Tiers)

### Tier 1 — Knowledge Health + Quick Add (2-col)
```
┌───────────────────────────┬────────────────────────┐
│ KNOWLEDGE HEALTH  72/100  │ QUICK ADD              │
│ ████████▓▓░░░░ Good       │                        │
│                           │ [📄 Upload] [🌐 Scrape]│
│ ✓ 83 chunks indexed       │ [☆ AI Compile] [📋 Paste]│
│ ✓ 9 FAQs answered        │                        │
│ ⚠ 24 unanswered          │ ┌──────────────────────┐│
│ ⚠ 3 sources need review  │ │ Paste anything —     ││
│                           │ │ facts, pricing, FAQs ││
│ "Answer 5 more questions  │ │ [textarea]           ││
│  to reach 85%"            │ │              [Add →] ││
│                           │ └──────────────────────┘│
└───────────────────────────┴────────────────────────┘
```

**Upload / Scrape / AI Compile buttons** open a **drawer** (slide from right, ~500px wide):
- Drawer maintains context — user can see the main page behind it
- Each drawer has its own form: file picker, URL input, or compile trigger
- Drawer shows progress: "Scraping windshieldhub.ca... 3 pages found"
- When done: drawer shows extracted items as **individual cards** with approve/edit/delete per item
- User can approve 15 of 20, edit 3, delete 2 — granular control
- "Approve all remaining" button for speed
- Drawer closes → health score recalculates

**Paste box** is inline (not drawer) — paste text, click Add, AI chunks it into facts/FAQs automatically.

### Tier 2 — Facts + FAQs (2-col, inline editable)
```
┌───────────────────────────┬────────────────────────┐
│ BUSINESS FACTS     12     │ FAQS  9                │
│                           │                        │
│ • Located at 2435... ✎ ✕ │ ▸ Do you offer mobile  │
│ • Windshield $199    ✎ ✕ │   windshield repair?   │
│ • Chip repair $59    ✎ ✕ │ ▸ Direct insurance     │
│ • ADAS re-cal        ✎ ✕ │   billing (SGI)?       │
│ • RV and heavy       ✎ ✕ │ ▸ ADAS recalibration?  │
│ • Aquapel glass      ✎ ✕ │ ▸ Types of glass?      │
│ • Mobile repair      ✎ ✕ │ ▸ Areas served?        │
│ • 84 Google reviews  ✎ ✕ │ ▸ Warranty?            │
│                           │ ▸ Starting prices?     │
│ [+ Add a fact...]         │ [+ Add FAQ...]         │
│                           │                        │
│ ✎ = click to inline edit  │ ▸ = expand to show     │
│ ✕ = delete with confirm   │   answer + edit/delete  │
└───────────────────────────┴────────────────────────┘
```

**Inline edit flow:**
- Click ✎ → text becomes editable input → Enter to save, Esc to cancel
- Click ✕ → "Delete this fact?" confirm toast → delete
- "+ Add a fact" → empty input appears at bottom, auto-focused
- FAQs: click ▸ → expands to show answer → both Q and A are editable

### Tier 3 — Unanswered Questions (full width, paginated, bulk ops)
```
┌────────────────────────────────────────────────────┐
│ ⊙ Unanswered Questions  24     [☐ Select all] 30d ▾│
│                                                    │
│ ☐ HOT "How much for a 2020 F-150?"        7× [Ans]│
│ ☐ HOT "Is my $300 deductible worth it?"   7× [Ans]│
│ ☐ HOT "Can I drop off at 7 AM?"           7× [Ans]│
│ ☐ HOT "What time do you close today?"     7× [Ans]│
│ ☐     "Can you replace a rear window..."  4× [Ans]│
│ ☐     "Do you guys match Speedy Glass?"   3× [Ans]│
│ ☐     "Can you do window tinting?"        3× [Ans]│
│                                                    │
│ Showing 7 of 24           [← Prev] [Next →]       │
│                                                    │
│ ┌──────────────────────────────────────────────┐   │
│ │ [Answer Selected (3)] [Skip Sel.] [Bulk AI →]│   │
│ └──────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

**Bulk AI flow** (opens drawer):
1. User selects 5 questions → clicks "Bulk AI →"
2. Drawer opens: "Generating answers for 5 questions..."
3. All 5 generate in parallel with streaming preview
4. Each shows: Question, AI Answer, Confidence %, Source citation
5. Per-item actions: [✓ Approve] [✎ Edit] [✕ Reject] [↻ Regenerate]
6. Bottom: [Approve All (4)] when some are pre-approved
7. Approved answers become FAQs → health score recalculates

### Tier 4 — Sources + AI Suggestions (2-col)
```
┌───────────────────────────┬────────────────────────┐
│ KNOWLEDGE SOURCES         │ AI-SUGGESTED ANSWERS   │
│                           │                        │
│ ◉ Website        1    ▸  │ 3 suggestions ready    │
│ ◉ Facts & Q&A    1    ▸  │                        │
│ ◉ Text Imports   1    ▸  │ "Do you do ADAS cal?"  │
│ ☆ AI Compiler  empty  ▸  │ ✓ Yes, we do, we have  │
│ ☐ Documents    empty  +  │   a machine onsite.    │
│ ◎ Google Prof    1    ▸  │ [Use this] 89% match   │
│                           │                        │
│ windshieldhub.ca          │ "How long for chip?"   │
│ Last scraped: 2d ago      │ [Generate AI answer]   │
│ [Re-scrape]               │                        │
│                           │                        │
│ ** ▸ = expand to see **   │ ** Auto-generated from │
│ ** chunks from source **  │ ** call data + KB **   │
└───────────────────────────┴────────────────────────┘
```

**Source expand** (inline, not drawer):
- Click "Website ▸" → shows list of chunks from that source
- Each chunk: content snippet + trust tier badge + [✎ Edit] [✕ Delete]
- This is the granular view: "here's what came from your website"

### Tier 5 — What Callers Search For + Ask Your Agent (2-col)
```
┌───────────────────────────┬────────────────────────┐
│ Q WHAT CALLERS SEARCH FOR │ ASK YOUR AGENT         │
│                    10     │ Type a question a      │
│ Do you do chip repairs? 8×│ caller might ask —     │
│ ADAS calibration?      8×│ see what your agent    │
│ Rear window Tucson?    8×│ knows.                 │
│ Sell wiper blades?     7×│                        │
│ Service Saskatoon?     7×│ [________________________]│
│                           │              [Ask]     │
│ [Show all 10]             │                        │
│                           │ Shows answer + sources │
│ ** Read-only analytics ** │ ** Live KB simulation **│
└───────────────────────────┴────────────────────────┘
```

---

## Unsurfaced Components (built but hidden)

These exist in the codebase but are NOT on the Knowledge page currently:

| Component | File | What it does | Where to surface |
|-----------|------|-------------|-----------------|
| **CallContextPreview** | `knowledge/CallContextPreview.tsx` | Shows exactly what the agent sees at call time — facts, QAs, injected note, context data | Tier 1 — "Preview what your agent sees" button → drawer |
| **PromptPreviewCard** | `knowledge/PromptPreviewCard.tsx` | Shows raw system prompt with char count badge | Settings only — too technical for Knowledge page |
| **BulkImportPanel** | `knowledge/BulkImportPanel.tsx` | JSON bulk import for chunks | Drawer — accessible from "Advanced" in Quick Add |
| **ManualAddForm** | `knowledge/ManualAddForm.tsx` | Combined scrape/upload/manual add with trust tier selector | Drawer — components already used individually |
| **GapAnswerSection** | `settings/knowledge/GapAnswerSection.tsx` | Full gap answering flow with KB suggestion + AI generate | **THIS IS THE ANSWER FLOW** — should be the inline expand in Tier 3 |
| **ChunkBrowserSection** | `settings/knowledge/ChunkBrowserSection.tsx` | Browse all chunks with source/tier filters | Drawer — "View all chunks" from Sources |
| **TestQuerySection** | `settings/knowledge/TestQuerySection.tsx` | Test a query against the knowledge base | This IS "Ask Your Agent" — Tier 5 |

### Key Finding: GapAnswerSection
`GapAnswerSection.tsx` already has the full answer flow:
- Shows the question with frequency
- Suggests matching KB answer with confidence %
- "Use this answer" button
- "Generate AI answer" button
- Edit field for custom answer
This is exactly what the Unanswered Questions inline expand needs — but it's buried in Settings, not on the Knowledge page.

### Key Finding: CallContextPreview
Shows the EXACT context block the agent receives at call time — facts, QAs, hours, injected note. This is the "what does my agent actually see?" question answered. Should be a "Preview agent context" button in the header that opens a drawer.

---

## Drawer vs Modal Decision (Sonar-validated)

**Drawer** (slide from right, 500-600px wide) for:
- Upload document (multi-step: select → upload → AI processes → show extracted items → approve/edit/delete)
- Scrape website (enter URL → scrape → show pages → approve content)
- AI Compiler (trigger → show extracted knowledge → approve/edit/delete per item)
- Bulk AI answer (select questions → generate all → review per-item → approve)
- View all chunks from a source (browse, search, filter)
- Preview agent context (CallContextPreview)

**Inline** for:
- Add a fact (text input at bottom of facts list)
- Add a FAQ (Q+A fields at bottom of FAQ list)
- Quick paste (textarea in Tier 1 Quick Add)
- Edit a fact/FAQ (click-to-edit in place)
- Delete a fact/FAQ (click ✕, confirm toast)
- Expand an unanswered question to see/answer it
- Expand a source to see its chunks

**Why drawer over modal (Sonar research):**
- Drawer maintains context — user sees main page behind it
- Modal blocks entire view — bad for multi-step ops where you need to reference existing data
- Drawer works well for streaming AI output (scrape progress, compile progress, bulk answer generation)
- Pattern used by Intercom, ChatGPT Custom GPTs, Notion AI for knowledge operations

---

## Bulk Operations Spec

### Unanswered Questions — Bulk Answer
1. User checks 3-10 questions via checkboxes
2. Clicks "Bulk AI →" in the action bar
3. Drawer opens with all selected questions
4. System generates answers in parallel (streaming, all at once)
5. Each card shows: Question | AI Answer | Confidence % | Source
6. Per-item: [✓ Approve] [✎ Edit answer] [✕ Reject] [↻ Regenerate]
7. Bottom bar: [Approve All (N)] [Close]
8. Approved answers → saved as FAQs → health score recalculates
9. Drawer closes → unanswered list refreshes

### AI-Extracted Content — Granular Control
When Upload/Scrape/Compile produces N items:
1. Drawer shows all N items as cards
2. Each card: content snippet + confidence badge + source
3. Per-item: [✓ Approve] [✎ Edit] [✕ Delete]
4. Toolbar: [Approve All] [Delete Low Confidence (<70%)] [Select All]
5. Edit: click ✎ → card becomes editable → save/cancel
6. Items can be approved one-by-one — no all-or-nothing

---

## Mobile Considerations
- 2-col grids collapse to 1-col
- Drawer becomes full-screen slide-up sheet on mobile
- Health score collapses to just the number + bar (no breakdown)
- Quick Add buttons become a horizontal scroll strip
- Unanswered questions: no checkboxes on mobile, swipe-to-answer instead
