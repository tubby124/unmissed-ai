# Phase 7 Post-Test Fixes — Master Execution Prompt

Copy this entire prompt into a new Claude Code chat to execute all fixes.

---

## Context

We just completed a full live onboarding test with a real restaurant (Red Swan Pizza - Calgary Saddle Ridge). The intelligence pipeline works, the agent answers menu questions correctly, and the 3-step onboarding flow is functional. But we found **17 issues** ranging from bugs to UX gaps to missing features.

**Test client**: `red-swan-pizza-calgary-saddle-ridge` (slug)
**Test call transcript**: Obsidian `Architecture/Red-Swan-Pizza-Test-Call-Review.md`
**Full test findings**: Obsidian `Architecture/Onboarding-Live-Test-2026-04-01.md`
**All D-items**: D345–D356 in `CALLINGAGENTS/Tracker/`

## Rules
- Read each D-item from Obsidian before starting its fix
- Do NOT touch live clients (hasan-sharif, windshield-hub, urban-vibe, exp-realty)
- Test with `red-swan-pizza-calgary-saddle-ridge` or `e2e-test-plumbing-co`
- Run `npm run build` after each wave
- Mark D-items done in Obsidian after fixing
- Write handoff after ~15 tool calls

---

## Wave 1 — Quick Wins (no UI changes, backend only)

### 1a. D352 — Fix knowledge query lag (5 min)
The `queryKnowledge` tool in `src/lib/ultravox.ts:598` is **missing `defaultReaction`**.
Every other tool that takes time (bookAppointment, checkCalendarAvailability) has `defaultReaction: 'AGENT_REACTION_SPEAKS'` which makes the agent say "let me check on that..." while waiting.

**Fix**: Add `defaultReaction: 'AGENT_REACTION_SPEAKS'` to the `queryKnowledge` temporaryTool object at line 598. One line.

After fix: run `syncClientTools()` for the test client or toggle a setting to trigger `needsAgentSync`.

### 1b. D347 — Fix CLOSE_PERSON fallback (5 min)
`src/app/api/provision/trial/route.ts` line 91:
```ts
const ownerFirstName = (data.ownerName || data.businessName || '').split(' ')[0]?.trim()
```
When no owner name from GBP, this gets "Red" from "Red Swan Pizza".

**Fix**: Change fallback chain to skip CLOSE_PERSON entirely when only business name is available:
```ts
const ownerFirstName = data.ownerName?.split(' ')[0]?.trim()
// Only set CLOSE_PERSON if we have an actual owner name, not business name
```
If `ownerFirstName` is empty, don't add CLOSE_PERSON to mergedNicheVars. The prompt template already handles missing CLOSE_PERSON gracefully.

### 1c. D348 — Accept .md and .txt in document uploader (10 min)
Find the file type accept list in the document upload component (likely `FileUploadPanel.tsx` or the upload route). Add `.md`, `.txt`, `.csv` to accepted types alongside `.pdf` and `.docx`.

Search for: `accept` attribute or MIME type filter in `src/components/dashboard/knowledge/`.

### 1d. D340 — Mark as DONE in Obsidian
The knowledge pipeline test passed. Update `CALLINGAGENTS/Tracker/D340.md` status to `done`.

---

## Wave 2 — Call Logging + Notifications (important for trust)

### 2a. D353 — Log WebRTC test calls to call_logs
The dashboard test calls don't appear in call_logs. User sees "No calls yet" after 3 test conversations.

**Investigate**:
1. Read `src/app/api/dashboard/agent-test/route.ts` — does it insert to call_logs?
2. Read `src/app/api/dashboard/browser-test-call/route.ts` — does it insert?
3. Read the Overview page component — which route does the "Talk to Your Agent" orb use?

**Fix**: Whichever route the orb calls, ensure it inserts a `call_logs` row with `call_status='test'` and `caller_phone='webrtc-test'`. The completed webhook should still fire for these calls to get the transcript/summary.

### 2b. D356 — Telegram notification preview on Overview
After a test call completes, show a "Notification Preview" card on Overview that renders what the Telegram message WOULD look like. This helps owners see the value before setting up Telegram.

**Design**: Read the existing Telegram formatting code (search for `telegram_style` or `formatTelegramMessage` in the codebase). Render the same format in a dashboard card with a "Set up Telegram to get these live →" CTA.

### 2c. Website scrape status confusion
The client has `website_scrape_status = 'extracted'` but the 15 website chunks ARE in `knowledge_chunks` with `status='approved'`. The Overview badge says "Pending" which is misleading.

**Investigate**: Is `website_scrape_status` supposed to track the chunk approval status, or just the scrape extraction? If chunks are approved but scrape status says 'extracted', update the status to 'approved' in the provision pipeline after auto-approving scraped content.

---

## Wave 3 — Overview Page UX (the big one)

### 3a. D354 — Move Unanswered Questions under the test call orb
Currently full-width at the bottom of Overview. Move it to the right 1/3 column, directly under the "Talk to Your Agent" card. This creates a tight feedback loop: see gap → answer it → re-test.

Layout target:
```
[Knowledge Base card    2/3] [Test Call Orb      1/3]
[Recent Calls          2/3] [Unanswered Qs      1/3]
[Bookings calendar     2/3] [Voice Style        1/3]
                             [Today's Update     1/3]
```

### 3b. D351 — Overview Knowledge card should reflect ALL knowledge
Currently shows "10 facts · 4 Q&A" from `business_facts`/`extra_qa` only. Does NOT count the 27 `knowledge_chunks` (12 from AI Compiler + 15 from website).

**Fix**: Query `knowledge_chunks` count grouped by source for the client. Show total: "27 knowledge items" with source breakdown. The "What your agent knows" section should show a representative sample from ALL sources, not just business_facts.

### 3c. D355 — Quick-view modal for knowledge sources
Clicking Website/AI Compiler/Documents on the Overview Knowledge card should open a modal showing the actual chunks. Each chunk: content preview, category badge, edit/delete. "View all in Knowledge →" link at bottom.

### 3d. D346 — Upload CTA on Overview
Add a prominent "Upload menu / price list" button to the Knowledge Base card on Overview. Opens the file upload flow inline or navigates to Knowledge with upload drawer pre-opened.

---

## Wave 4 — Source Drawer + Knowledge Page Fixes

### 4a. D350 — Knowledge source drawers don't expand
On the Knowledge page, clicking a source card (Website, AI Compiler, etc.) should expand to show the chunks from that source. Currently clicking does nothing.

**Investigate**: Read the Knowledge page component. Are the drawers wired up? Is there a click handler? Do the chunks query by source?

### 4b. Knowledge page source counts vs Overview counts
Knowledge page shows "12 chunks active" for AI Compiler, Overview shows "1". The Knowledge page is counting chunks, Overview is counting documents/batches. Standardize on chunk count everywhere.

---

## Wave 5 — Prompt & Agent Quality

### 5a. Prompt length investigation
The generated prompt is 18,847 chars. The `validatePrompt()` 12K limit only applies on settings PATCH, not provision. Ultravox accepts it, but it's way over budget.

**Investigate**: Read the generated prompt for `red-swan-pizza-calgary-saddle-ridge`. What's taking 18K chars? Is TRIAGE_DEEP too verbose? Are there duplicate sections? Can the prompt be compressed without losing intelligence?

The 12K limit exists for a reason (GLM-4.6 attention degradation). If the intelligence seed routinely produces 18K+ prompts, we need to either:
- Compress the intelligence seed output
- Move some content to knowledge retrieval instead of inline prompt
- Raise the limit with a warning

### 5b. D341 — PromptVariablesCard (Settings UI)
Run `/ui-ux-pro-max` first to design the card. Then build:
- Reads `clients.niche_custom_variables`
- Shows: Opening Line (editable), Caller Routing (read-only TRIAGE_DEEP), Urgency Triggers (chip editor), Safety Rules (list), Close Person (text input)
- On save: calls `PATCH /api/dashboard/variables`
- Place on Settings → Agent tab

### 5c. "Specials" gap — auto-prompt for common questions
Every restaurant gets asked "what are your specials?" — it was the FIRST thing our test caller asked. The agent correctly said "I don't have that info" but this is a terrible first impression.

**Fix options**:
1. After onboarding, show a "Quick wins" card: "Your agent got asked about specials but couldn't answer. Add your current specials →"
2. Add niche-specific FAQ prompts to the Knowledge page: "Restaurants typically get asked about: specials, allergens, delivery radius, catering. Add answers for these."
3. The Unanswered Questions feature already caught this ("current specials promotions deals offers" — 1x asked). Make it more prominent (D354).

### 5d. Order read-back verification
D343 added the read-back instruction to the Haiku prompt, but it only affects NEW agents provisioned after the fix. The Red Swan test agent doesn't have it yet.

To verify: provision a NEW test restaurant and check if the TRIAGE_DEEP includes the "Before closing: read back the full order" instruction.

---

## Wave 6 — Polish & Global Patterns

### 6a. D349 — Orb as global loading indicator
Extract a lightweight `ProcessingOrb` from the existing WebGL `FloatingCallOrb`. Use it for:
- AI Compiler "Analyzing with AI..." screen
- Intelligence generation in onboarding
- Provisioning loading state
- Website scrape progress

### 6b. D345 — Intelligence seed loading indicator
On the Launch step, if the intelligence seed hasn't arrived yet, show a skeleton `AgentIntelligenceCard` with shimmer animation: "Personalizing your agent..." → fills in when data arrives.

On the GBP card in step 1, add a subtle status pill: "Configuring..." → "Agent configured ✓"

### 6c. Auto-approve website scrape on provision
Currently the website scrape status stays at `extracted` even though chunks are approved. Either:
- Auto-set `website_scrape_status = 'approved'` when provision auto-approves chunks
- Or remove the "Pending" badge when chunks are already live

---

## Things We Haven't Thought About Yet

### A. What happens Day 2?
The owner comes back to the dashboard. Do they see:
- A "welcome back" state? Or the same blank "No calls yet"?
- Guidance on what to do next? (set up Telegram, review website scrape, answer unanswered questions)
- A progress tracker that updates based on what they've done?

The setup progress bar shows 50% (3/6). What are the 6 items? Are they the RIGHT 6 items for a restaurant? A restaurant owner cares about: menu uploaded, hours correct, delivery area set, specials current, Telegram for kitchen. Not necessarily calendar booking or call transfer.

**D-item needed**: Niche-adaptive setup progress — show the steps that matter for THIS business type.

### B. What happens when trial expires?
Day 7 arrives. The agent stops working (or does it?). What does the owner see? A paywall? A "your agent is paused" message? Can they still access the dashboard to see their call history?

**Check**: Read the trial expiry logic. Is there a grace period? Does the dashboard show a clear upgrade CTA?

### C. Call forwarding is the #1 barrier to going live
The test user saw "Get my number" and "Forward your number to get started" but there's no in-app guide for HOW to forward a number. This is D292 (guided call forwarding wizard) — it's in the Phase 7 roadmap but not in this fix list.

At minimum: show carrier-specific forwarding codes (Rogers: *72, Telus: *72, Bell: *72, etc.) and a "Test forwarding" button.

### D. Multi-item orders need structured capture
The agent took an order (pepperoni slice, garlic bread, onion rings) but it's just free text in the conversation. There's no structured order object. The Telegram notification would say "caller wants pepperoni slice, garlic bread, onion rings for pickup under Hassan" — but it's not machine-parseable.

Future: the agent should build a structured order JSON via call state, so the Telegram message can show a clean receipt-style format that the kitchen can act on.

### E. Returning caller detection won't work for restaurant orders
If Hassan calls back in 20 minutes to add something to his order, the returning caller detection needs his phone number from `call_logs.caller_phone`. But WebRTC test calls don't log to `call_logs` (D353), and even for real phone calls, the system would need to match the phone number to the recent order.

This matters more for restaurants than other niches — repeat orders within hours are common.

### F. Peak hour behavior
What happens when 5 callers call simultaneously at 6pm Friday? Each gets their own Ultravox call, each queries knowledge independently. Are there concurrency limits? Does latency increase under load?

**Check**: Ultravox concurrent call limits. Supabase pgvector query performance under concurrent load.

### G. Menu freshness / seasonal updates
Restaurants change menus seasonally, run weekly specials, and 86 items daily. The current knowledge pipeline requires the owner to:
1. Go to Knowledge page
2. Find the old item
3. Delete or edit it
4. Upload new content

This is too much friction. Future: "Today's Update" (injected_note) could be used for daily specials: "Today's special: large pepperoni + 2L Coke $18.99". This already exists as a dashboard card! Just need to prompt the user to use it for specials.

### H. Allergen liability
The NEVER rules say "NEVER confirm allergen information." But what does the agent DO when asked "is this gluten-free?" — does it just say "I can't confirm that"? Or does it route to the owner?

Test this with a call. The agent should say something like "I'd want to make sure — let me have [owner] confirm the allergen details and call you back." Not just a flat refusal.

### I. The "Pending" website review is a dead end
15 pages were scraped and auto-approved. But the dashboard shows "Pending" and "Review (15)" badge. If the user clicks Review, what do they see? Can they approve/reject individual pages?

The user is unlikely to review 15 website pages. Consider: auto-approve all scraped content and show "15 pages imported ✓" instead of "Pending review".

### J. Post-call callback tracking
The agent told Hassan "the team'll call ya back to confirm." But there's no system to:
1. Alert the owner that Hassan needs a callback
2. Track whether the callback happened
3. Close the loop

This is D220 (lead queue / callback tracking) from Phase 8. For restaurants taking orders, this is critical — the order doesn't happen unless someone calls back.

---

## Execution Order (recommended)

1. **Wave 1** (30 min) — Quick wins: queryKnowledge lag fix, CLOSE_PERSON, .md upload, D340 done
2. **Wave 2** (1 hr) — Call logging + notification preview
3. **Wave 3** (2 hr) — Overview layout: unanswered Qs placement, knowledge counts, quick-view modal, upload CTA
4. **Wave 4** (1 hr) — Knowledge page source drawers
5. **Wave 5** (2 hr) — Prompt length, PromptVariablesCard, specials gap
6. **Wave 6** (1 hr) — Orb loading, intelligence indicator, scrape status

After each wave: `npm run build`, test with Red Swan Pizza client, update Obsidian tracker.

---

## Key files to read first
- `CALLINGAGENTS/Architecture/Onboarding-Live-Test-2026-04-01.md` — full test findings
- `CALLINGAGENTS/Architecture/Red-Swan-Pizza-Test-Call-Review.md` — call transcript review
- `src/lib/ultravox.ts` — queryKnowledge tool (line 594), buildAgentTools
- `src/app/api/provision/trial/route.ts` — CLOSE_PERSON (line 91)
- `src/components/dashboard/knowledge/` — file upload components
- Overview page component — layout restructure target
