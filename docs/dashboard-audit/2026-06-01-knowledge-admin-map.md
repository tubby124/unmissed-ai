# Dashboard Surface Map — Knowledge + Admin Command Center + Admin Notifications

**Date:** 2026-06-01. **Method:** read end-to-end from page entry files; column traces via `grep -r src/`. **Scope:** descriptive — no keep/remove/score.

---

## A. KNOWLEDGE — `/dashboard/knowledge`

Entry: [src/app/dashboard/knowledge/page.tsx](src/app/dashboard/knowledge/page.tsx) (server auth + ~70-column `SELECT` from `clients`). Layout: [src/app/dashboard/knowledge/KnowledgePageView.tsx](src/app/dashboard/knowledge/KnowledgePageView.tsx) — 4 tiers + slide-over `KnowledgeDrawer` (variants `upload`/`scrape`/`compile`/`bulk-ai`/`context-preview`/`chunks`) + conflict modal. URL deep-links: `?quickAdd=upload|scrape|compile|chunks` opens drawer; `?source=<source_key>` opens chunks drawer pre-filtered.

### 1. Conflict banner
**File:** [KnowledgePageView.tsx](src/app/dashboard/knowledge/KnowledgePageView.tsx) (inline + `ConflictModal` same file).
**Section:** above header (only when `conflicts.length > 0`).
**What you see:** amber banner "N potential conflict(s) found in your knowledge — review before approving". Modal lists each conflict (`compiled fact text` + `review_reason`).
**What you can do:** click → modal. `Dismiss all` → `PATCH /api/dashboard/knowledge/conflicts { run_ids:[...] }`.
**Reads:** `compiler_runs` (rows with conflict-flag items) via `GET /api/dashboard/knowledge/conflicts`.
**Writes:** flips per-run conflict-dismissed state on `compiler_runs`.
**Sync side-effect:** none.
**Cross-surface:** conflicts originate in `POST /api/dashboard/knowledge/compile/apply` (FileUploadPanel + KnowledgeCompiler both go through it).
**Visible-to:** both. **Conditional:** only when conflicts > 0.

### 2. Header bar (Preview / Export / Talk-to-Agent)
**File:** inline in `KnowledgePageView`.
**Section:** top of page. Admin sees `AdminDropdown`; non-admin sees "Knowledge / What your agent knows".
**What you see:** `Preview`, `Export`, `Talk to Agent` (red "End Call" when active).
**What you can do:** Preview → `openDrawer('context-preview')`. Export → `window.open('/api/dashboard/knowledge/export?format=csv[&client_id=...]')`. Talk to Agent → `POST /api/dashboard/agent-test` → `joinUrl` → `CallContext.startCall` (Path E live agent via `callViaAgent`).
**Reads:** `clients` row.
**Writes:** `call_logs` row (`call_status='test'`) from agent-test route.
**Cross-surface:** same Talk-to-Agent pattern in [TestCallCard.tsx](src/components/dashboard/settings/TestCallCard.tsx) on Settings and Calls/Leads.

### 3. KnowledgeHealthScore — Tier 1 LEFT
**File:** [KnowledgeHealthScore.tsx](src/components/dashboard/knowledge/KnowledgeHealthScore.tsx).
**What you see:** score 0–100 (red/amber/green), label ("Getting started"/"Building up"/"Good"/"Strong"/"Excellent"), progress bar, stat strip "✓ N chunks indexed · N FAQs · ⚠ N unanswered", CTA based on lowest dimension, then 5 dimension rows (Completeness/Coverage/Freshness/Sources/Resolution).
**What you can do:** read-only.
**Reads (props composed in `KnowledgePageView`):** `client.business_facts`, `client.extra_qa` for `facts/qa`; `GET /api/dashboard/knowledge/stats` for `approved` chunks + `bySource` (→ `connectedSources`); `GET /api/dashboard/knowledge/gaps?days=90` for `total_unanswered_queries`. Coverage flags derived from `clients.business_hours_weekday`, facts regex (`/price|cost|\$|\d+\.\d{2}/i`), `services_offered`, `city`/`state`. `staleItemCount` exists in props but is never set (always 0).
**Writes:** none. **Sync side-effect:** N/A.
**Cross-surface:** score is local; Overview shows knowledge state through [AgentKnowsCard.tsx](src/components/dashboard/home/AgentKnowsCard.tsx) instead.
**Visible-to:** both.

### 4. TestCallCard — Tier 1 CENTER (orb)
**File:** [src/components/dashboard/settings/TestCallCard.tsx](src/components/dashboard/settings/TestCallCard.tsx).
**What you see:** pulsing orb with niche emoji, agent name, "Talk to Agent". Same component reused on Settings + Calls/Leads.
**Reads:** `clients.agent_name/niche/business_name/ultravox_agent_id`. **Writes:** `call_logs` (`call_status='test'`). **Endpoint:** `POST /api/dashboard/agent-test`.

### 5. Quick Add — Tier 1 RIGHT
**File:** inline + [KnowledgeTextInput.tsx](src/components/dashboard/knowledge/KnowledgeTextInput.tsx).
**What you see:** 2×2 button grid (Upload/Scrape/AI Compile/Browse) + collapsed "Paste knowledge text".
**What you can do:** each button → `openDrawer('upload'|'scrape'|'compile'|'chunks')`. Paste → `POST /api/dashboard/knowledge/ingest-text` (text split, embedded, auto-approved, trust_tier='high').
**Writes:** `knowledge_chunks`; `syncClientTools()` runs server-side (registers `queryKnowledge` if first chunk; `clients.tools` updated; no `updateAgent()` from this route).
**Cross-surface:** `KnowledgeTextInput` also rendered inside [AgentKnowledgeCard.tsx](src/components/dashboard/settings/AgentKnowledgeCard.tsx).

### 6. Business Facts — Tier 2 LEFT (`InlineFactsEditor`)
**File:** [InlineFactsEditor.tsx](src/components/dashboard/knowledge/InlineFactsEditor.tsx).
**What you see:** bulleted list with hover edit/delete, count pill, Add input.
**What you can do:** add/edit (Enter or blur)/delete (2-click confirm) → `PATCH /api/dashboard/settings { business_facts: [...] }`.
**Reads/Writes:** `clients.business_facts`.
**Sync side-effect (settings route step 8):** if `knowledge_backend='pgvector'` → `reseedKnowledgeFromSettings()` (awaited) deletes prior `source='settings_edit'` chunks in `knowledge_chunks` and re-embeds (`trust_tier='high'`). Step 6 schedules `scheduleAutoRegen('auto:settings_update')` (fire-and-forget prompt rebuild) because `business_facts ∈ LOW_STAKES_REGEN_FIELDS`. `computeNeedsSync` does NOT fire for `business_facts` alone → no `updateAgent()`.
**Cross-surface (grep-confirmed):** `business_facts` read/written by [PromptEditorCard.tsx](src/components/dashboard/settings/PromptEditorCard.tsx), [PromptEditorModal.tsx](src/components/dashboard/settings/PromptEditorModal.tsx), [AdvancedContextCard.tsx](src/components/dashboard/settings/AdvancedContextCard.tsx), [AgentKnowledgeCard.tsx](src/components/dashboard/settings/AgentKnowledgeCard.tsx), [AgentTab.tsx](src/components/dashboard/settings/AgentTab.tsx), [SetupProgressRing.tsx](src/components/dashboard/settings/SetupProgressRing.tsx), [AgentIntelligenceSection.tsx](src/components/dashboard/AgentIntelligenceSection.tsx), [KnowledgeSheet.tsx](src/components/dashboard/home/sheets/KnowledgeSheet.tsx), [AgentKnowsCard.tsx](src/components/dashboard/home/AgentKnowsCard.tsx). Runtime: `buildKnowledgeSummary()` reads it directly per [per-call-context-contract.md](docs/architecture/per-call-context-contract.md) §3.
**Known issue ([knowledge-three-store-consolidation.md](docs/architecture/knowledge-three-store-consolidation.md) §2.1):** facts edited while `knowledge_backend=NULL` never seed into `knowledge_chunks`; on later pgvector migration the settings_edit chunks are missing until the next save.

### 7. FAQs — Tier 2 CENTER (`InlineFaqEditor`)
**File:** [InlineFaqEditor.tsx](src/components/dashboard/knowledge/InlineFaqEditor.tsx).
**What you see:** collapsible Q/A rows, hover edit/delete, "+ Add FAQ".
**What you can do:** add/edit/delete → `PATCH /api/dashboard/settings { extra_qa: [...] }`.
**Reads/Writes:** `clients.extra_qa` (`[{q,a}]`).
**Sync side-effect:** identical reseed branch to facts; `scheduleAutoRegen` does NOT fire (`extra_qa` not in LOW_STAKES set).
**Cross-surface:** [QuickAddFaq.tsx](src/components/dashboard/QuickAddFaq.tsx), [CallDetail.tsx](src/components/dashboard/CallDetail.tsx), [CallGapReview.tsx](src/components/dashboard/CallGapReview.tsx), [GapAnswerSection.tsx](src/components/dashboard/settings/knowledge/GapAnswerSection.tsx), [KnowledgeEngineCard.tsx](src/components/dashboard/settings/KnowledgeEngineCard.tsx), [AgentKnowledgeCard.tsx](src/components/dashboard/settings/AgentKnowledgeCard.tsx), [AdvancedContextCard.tsx](src/components/dashboard/settings/AdvancedContextCard.tsx), [UnifiedHomeSection.tsx](src/components/dashboard/home/UnifiedHomeSection.tsx)/V2, [AgentKnowsCard.tsx](src/components/dashboard/home/AgentKnowsCard.tsx), [InlineModalsV2.tsx](src/components/dashboard/home/InlineModalsV2.tsx). AI Compiler apply also appends to `extra_qa`.

### 8. Unanswered Questions — Tier 2 RIGHT (`KnowledgeGaps`) + Bulk AI button
**File:** [KnowledgeGaps.tsx](src/components/dashboard/knowledge/KnowledgeGaps.tsx).
**What you see:** collapsible card with amber count pill. Each row: `HOT` pill at ≥3 occurrences, quoted query, "Asked Nx", date, `Skip`/`Answer` buttons. Expanded: AI suggestion card ("N% match · Use this answer"), `Generate AI answer` button, 5000-char textarea, `Save Answer`. Cascade banner "Auto-resolved N similar question(s)". Filter strip with 7/30/90 day dropdown + `Clear all` (≥3 gaps).
**What you can do:**
- `Skip` → `PATCH /api/dashboard/knowledge/gaps { resolution_type:'dismissed' }`.
- `Generate AI answer` → `POST /api/dashboard/knowledge/suggest-answer`.
- Suggestion: `POST /api/dashboard/knowledge/suggest`.
- `Save Answer` → `POST /api/dashboard/knowledge/chunks { chunk_type:'qa', trust_tier:'medium', auto_approve:true }` then `PATCH .../gaps { resolution_type:'faq' }`; resolve returns `auto_cascade_count` + `auto_cascade_queries`.
- `Clear all` → loop dismiss.
- `Bulk AI Answers` button → `openDrawer('bulk-ai')` (currently a Coming Soon empty state).
**Reads:** `knowledge_query_log` rolled up (normalized query + count + first_seen/last_seen).
**Writes:** new `knowledge_chunks` row (status='approved', tier='medium'); `knowledge_query_log` resolution_type updates.
**Sync side-effect:** chunks POST calls `syncClientTools()` (registers `queryKnowledge` if first chunk).
**Cross-surface:** `knowledge_query_log` also feeds Health Score, TopQueriesCard, CallDetail gap pills.

### 9. KnowledgeProvenanceCard — Tier 3 (full-width band)
**File:** [KnowledgeProvenanceCard.tsx](src/components/dashboard/knowledge/KnowledgeProvenanceCard.tsx).
**What you see:** collapsible "KNOWLEDGE SOURCES — Where your agent's knowledge was imported from" with Google/Website/AI Compiler chips. Expanded sub-cards: Google (logo, rating stars, review count, summary, photo), Website (globe, scraped date, "N pages scanned · N facts · N Q&A", `Re-scrape →` link), AI Compiler (star, model name pill, last-run date, chunk count, `Add more →`).
**What you can do:** expand/collapse; deep-link `Re-scrape`/`Add more` via `knowledgeRoutes.add()`.
**Reads:** `clients.gbp_place_id/gbp_summary/gbp_rating/gbp_review_count/gbp_photo_url`; `clients.website_knowledge_approved` (`businessFacts[]`+`extraQa[]`), `website_scrape_pages`, `website_last_scraped_at`; `compiled_import` count + `lastCompilerRun` via `GET /api/dashboard/knowledge/stats`.
**Writes:** none. **Conditional:** returns `null` when no GBP + no approved website + zero compiled chunks.
**Cross-surface:** GBP fields appear in onboarding [step1-gbp.tsx](src/app/onboard) and `KnowledgeSourceRegistry`. Website fields read by `WebsiteKnowledgeCard`.

### 10. KnowledgeSourceRegistry — Tier 3 LEFT
**File:** [KnowledgeSourceRegistry.tsx](src/components/dashboard/knowledge/KnowledgeSourceRegistry.tsx).
**What you see:** "N chunks live · N% coverage" badge. 2-col grid: Website / Facts & Q&A (`settings_edit`) / Text Imports (`bulk_import|dashboard_manual|manual|manual_text`) / AI Compiler (`compiled_import`) / Documents (`knowledge_doc`) / Google Profile (`gbp`). Active tiles green "N chunks active · Updated 2 days ago"; inactive amber "Not added yet" + plus. URL strip + `Re-scrape` button when `websiteUrl`. GBP profile-only tile triggers import.
**What you can do:** active tile → `onSourceClick(id, sourceKeys, label)` → opens chunks drawer (single-key auto-filters; multi-key opens unfiltered). Inactive → `Link` to `knowledgeRoutes.add()`. GBP profile-only → `POST /api/dashboard/knowledge/ingest-gbp`. Re-scrape → `POST /api/dashboard/scrape-website`.
**Reads:** `knowledge_chunks` aggregations (`bySource`/`lastUpdatedBySource`/`approved`/`coverage`/`sourceCount`/`maxSources`) via stats.
**Writes:** GBP ingest writes `knowledge_chunks` (source='gbp', tier='medium') + `syncClientTools()`; re-scrape kicks pipeline.
**Plan gates:** `maxSources` enforces per-plan source limit.

### 11. PendingSuggestions — Tier 3 CENTER
**File:** [PendingSuggestions.tsx](src/components/dashboard/knowledge/PendingSuggestions.tsx).
**What you see:** "Pending Review" with yellow count pill. Each row: 300-char content preview, source mono label, trust tier badge, Reject/Approve buttons.
**What you can do:** Approve/Reject → `POST /api/dashboard/knowledge/approve { chunkId, action }` → flips `knowledge_chunks.status`. Dispatches `knowledge-chunks-refresh` custom event so listeners refetch.
**Reads:** `GET /api/dashboard/knowledge/chunks?status=pending&limit=20`.
**Writes:** `knowledge_chunks.status`; approve route may run `syncClientTools()`.
**Cross-surface:** ChunkBrowser reads the same table.

### 12. TopQueriesCard — Tier 3 RIGHT
**File:** inline in `KnowledgePageView`.
**What you see:** "WHAT CALLERS SEARCH FOR" list with `Nx` badges. "Based on the last 90 days of calls".
**Reads:** `knowledge_query_log` 90-day rollup via `GET /api/dashboard/knowledge/top-queries`. **Writes:** none.

### 13. AskYourAgent — Tier 4 (full width)
**File:** inline in `KnowledgePageView`.
**What you see:** "ASK YOUR AGENT" input + `Ask` + answer + sources list.
**What you can do:** `POST /api/dashboard/preview-question` → server runs same retrieval logic as runtime `queryKnowledge`.
**Reads:** `knowledge_chunks` (hybrid match) + `business_facts` + `extra_qa`. **Writes:** none.

### 14. Drawer panels

**14a. `upload`** — [FileUploadPanel.tsx](src/components/dashboard/knowledge/FileUploadPanel.tsx) + [DocumentList.tsx](src/components/dashboard/knowledge/DocumentList.tsx).
- Quota bar ("N of M documents used"), drag-drop (PDF/TXT/DOCX/CSV/MD, ≤5MB), file queue, batch progress strip across files. Per file: extracting → analyzing → review (AI-classified `NormalizedItem[]` with kind badge, confidence dot, HIGH_RISK verification checkbox) → applying → done. Fallback "manual review" raw paragraph selector if AI returned 0 items. Dedup warning (Replace / Keep both). Below: existing docs with delete.
- Flow: `POST .../upload-preview` → `POST .../compile` → `POST .../compile/apply` (or fallback `POST .../bulk-import`). Delete doc: `DELETE .../docs?id=...`.
- Reads `client_knowledge_docs` (+ stats for quota). Writes `client_knowledge_docs`, `knowledge_chunks` (`compiled_import` or `knowledge_doc`), `clients.extra_qa` (FAQ items appended), `compiler_runs` (provenance + conflicts).
- Sync side-effect (per [control-plane-mutation-contract.md](docs/architecture/control-plane-mutation-contract.md) AI Compiler row): `embedChunks() + syncClientTools()`. When `extra_qa` appended and `knowledge_backend='pgvector'`, `reseedKnowledgeFromSettings` also fires. BLOCKED_KINDS (`call_behavior_instruction`/`unsupported_or_ambiguous`/`conflict_flag`) never written as approvable; HIGH_RISK kinds default to `trust_tier='medium'` and require checkbox.
- Plan gates: `maxSources` from stats blocks at limit.

**14b. `scrape`** — [WebsiteSourcesList.tsx](src/components/dashboard/settings/WebsiteSourcesList.tsx) + [WebsiteKnowledgeCard.tsx](src/components/dashboard/settings/WebsiteKnowledgeCard.tsx) (note: live under `settings/` but rendered inside Knowledge drawer).
- SourcesList: list of saved URLs with status pills (Pending/Scraping/Ready to approve/Live/Failed), per-URL Re-scrape/Delete, "N of M URLs used", Add URL input.
- KnowledgeCard: single-URL state + preview/approve flow. Extracted facts + Q&A as checkboxes; Approve writes selected items to `clients.business_facts`/`extra_qa` + flips `website_scrape_status='approved'`.
- Endpoints: `PATCH /api/dashboard/settings` (URL), `POST /api/dashboard/scrape-website`, `GET/DELETE /api/dashboard/website-sources`, `POST /api/dashboard/scrape-approve`.
- Reads: `website_sources`; `clients.website_url/website_scrape_status/website_knowledge_preview/website_knowledge_approved/website_last_scraped_at/website_scrape_pages/website_scrape_error/knowledge_backend`.
- Writes: `website_sources`; on approval `clients.business_facts/extra_qa/website_scrape_status/website_knowledge_approved` + `knowledge_chunks` (source='website_scrape') via `seedKnowledgeFromScrape()` + `syncClientTools()`. No `updateAgent()` from this path — tools sync is DB-only.
- Plan gates: `maxWebsiteUrls`.
- Known issue (mutation contract): saving `website_url` does NOT auto-trigger a scrape — they're decoupled (UX gap, not data integrity).

**14c. `compile`** — [KnowledgeCompiler.tsx](src/components/dashboard/knowledge/KnowledgeCompiler.tsx).
- 3-step indicator (Paste → Review → Done). Same `compile` → `compile/apply` flow as FileUploadPanel; saving state shows pulsing green orb with currently-learning carousel.
- Same writes / sync side-effects as 14a.

**14d. `chunks`** — [ChunkBrowser.tsx](src/components/dashboard/knowledge/ChunkBrowser.tsx).
- Filters: status (all/approved/pending/rejected/revoked) × trust tier (all/high/medium/low) × source (optional `initialSourceFilter`). Paginated 50/page. Per-row content preview + trust tier + status + source + `hit_count` + `last_hit_at`. Expanded: full content + edit textarea + tier selector + Save/Approve/Reject/Delete + Clear-all per filter.
- Endpoints: `GET/PATCH/DELETE /api/dashboard/knowledge/chunks`, `POST .../approve`.
- Approve/delete may run `syncClientTools()` (`clients.tools` rebuild).

**14e. `context-preview`** — [CallContextPreview.tsx](src/components/dashboard/knowledge/CallContextPreview.tsx).
- Collapsible "CALL-TIME CONTEXT — What your agent sees on every call" + "Live preview" pill. Expanded: rendered preview matching `buildAgentContext()` output — TODAY/CURRENT TIME/CALLER PHONE/RIGHT NOW header, `## Business Facts` bullets, `## Q&A` lines, `## Reference Data` block, and a `queryKnowledge` line (active vs none).
- Reads (props): `business_facts`, `extra_qa`, `injected_note`, `context_data`, `context_data_label`, `knowledge_backend`, `timezone`. Writes: none. Client-side simulation only.

**14f. `bulk-ai`** — empty state "Coming soon" placeholder inline in `KnowledgePageView`.

---

## B. ADMIN COMMAND CENTER — `/dashboard/admin` and legacy `/dashboard` branch

Routing in [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx) (lines 30–178). [src/lib/feature-flags.ts](src/lib/feature-flags.ts) `isAdminRedesignEnabled()` reads env `ADMIN_REDESIGN_ENABLED` or `NEXT_PUBLIC_ADMIN_REDESIGN_ENABLED` (`1|true|yes|on`). **Default OFF.** Flag OFF → legacy `/dashboard` admin branch renders inline; `/dashboard/admin` redirects to `/dashboard`. Flag ON → admin landing on `/dashboard` without `?client_id=` sees "Pick a client" CTA; with `?client_id=` renders `ClientHomeV2` scoped to that client. Admin Command Center only at `/dashboard/admin` in that mode.

Both pages render the same components, but legacy adds `MonthlySpendCard` + `TalkToZaraAdminButton`; redesign adds the Admin-tools tile strip.

### 15. SystemPulse
**File:** [SystemPulse.tsx](src/components/dashboard/SystemPulse.tsx).
**What you see:** single pill polling every 60s. Green "All systems operational" with timestamp, amber "N issues detected" with expanded per-issue list, red "System check failed".
**Reads:** `GET /api/dashboard/system-pulse` (server pings Ultravox per active `ultravox_agent_id` + Supabase ping). **Writes:** none. Per `core-operating-mode` slugs/IDs aren't leaked.
**Visible-to:** admin (both branches).

### 16. MonthlySpendCard — **LEGACY only**
**File:** [MonthlySpendCard.tsx](src/components/dashboard/MonthlySpendCard.tsx).
**What you see:** "Platform Spend — This Month", `$X.XX`, "N billable calls · M.Mm billed", top-5 client list with %-bar.
**Reads (page server component):** `call_logs(client_id, billed_cost_cents, billed_duration_seconds, clients(business_name, slug)) where started_at >= monthStart and billed_cost_cents > 0`, limit 5000, summed per client. **Writes:** none.
**Cross-surface:** `billed_cost_cents` written by Ultravox `call.billed` webhook ([webhook-security-and-idempotency.md](docs/architecture/webhook-security-and-idempotency.md) §4). Rates from `lib/pricing-rates.ts`. Same source as `/dashboard/costs`.
**Conditional:** rendered on legacy `/dashboard` admin branch only — redesign `/dashboard/admin/page.tsx` omits it.

### 17. TalkToZaraAdminButton — **LEGACY only**
**File:** [TalkToZaraAdminButton.tsx](src/components/dashboard/TalkToZaraAdminButton.tsx).
**What you see:** "Zara — Admin Mode" card describing admin tools (`adminCallsReport`/`adminSpendReport`/`adminClientLookup`) + "Start admin call".
**What you can do:** `POST /api/admin/zara` → `joinUrl` → renders `BrowserTestCall`.
**Cross-surface:** same browser rig as TestCallCard, different agent.

### 18. ActionItems
**File:** [ActionItems.tsx](src/components/dashboard/ActionItems.tsx).
**What you see:** list of red/amber pill rows; empty state "No action items — all clear". Each row → deep-link.
**Polled every 60s, browser Supabase queries:**
- `call_logs(call_status='HOT', started_at < 1h ago)` count → red "N HOT lead(s) unactioned for >1h" → `/dashboard/leads`.
- `call_logs(transfer_status in (no_answer/busy/failed/canceled), transfer_updated_at >= 24h ago)` count → amber → `/dashboard/live`.
- `clients(status='active')` per-row: usage > 90% (red ≥100%, amber otherwise) → `/dashboard/settings?client_id=...`; `booking_enabled && !google_calendar_id` → amber; `forwarding_number && 0 successful transfers in 7d` (`call_logs.transfer_status='completed'` per client) → amber.
- `call_logs(call_status='live')` count → amber → `/dashboard/live`.
**Writes:** none. **Cross-surface:** same tables read by ClientHealthBar/LiveCallBanner/LeadQueue.

### 19. LiveCallBanner
**File:** [LiveCallBanner.tsx](src/components/dashboard/LiveCallBanner.tsx).
**What you see:** green-on-black banner per live call: business_name, formatted caller_phone, ticking `LiveDuration`, waveform equalizer. Buttons: `End`, `Take this call` (hidden when `transfer_status='transferring'` and replaced by "Transferring to owner..." overlay), `Just listen` → `/dashboard/calls/[ultravox_call_id]`.
**Endpoints:** `DELETE /api/dashboard/calls/[ultravox_call_id]/whisper` (also terminates), `POST /api/dashboard/calls/[ultravox_call_id]/transfer-now` → seeds `transfer_status='transferring'` and a realtime channel propagates.
**Reads (page server component):** `call_logs(id, ultravox_call_id, caller_phone, started_at, transfer_status, clients(business_name)) where call_status='live'`.

### 20. ClientHealthBar
**File:** [ClientHealthBar.tsx](src/components/dashboard/ClientHealthBar.tsx).
**What you see:** per-row status dot + business_name + niche + minute-usage bar + percent + "N hot · Nh" SLA pill (emerald <1h, amber 1-3h, red+pulse ≥3h).
**Reads (server):** `clients(id, slug, business_name, niche, status, twilio_number, seconds_used_this_month, monthly_minute_limit, bonus_minutes) where status='active' order by business_name`; `call_logs(client_id, started_at) where call_status='HOT' and started_at >= monthStart`.
**Cross-surface:** `seconds_used_this_month` written by Ultravox `call.billed` webhook; same column drives ActionItems >90% row and per-client MinuteUsage. Uses `DEFAULT_MINUTE_LIMIT` from `niche-config` when null.

### 21. Admin tools tile strip — **redesign only**
**File:** inline in [src/app/dashboard/admin/page.tsx](src/app/dashboard/admin/page.tsx) (lines 93–135).
**What you see:** three tile links — `Notifications` → `/dashboard/admin/notifications`, `Harness Findings` → `/dashboard/admin/harness`, `Learning Bank` → `/dashboard/admin/learning-bank`.

---

## C. ADMIN NOTIFICATIONS — `/dashboard/admin/notifications`

Entry: [src/app/dashboard/admin/notifications/page.tsx](src/app/dashboard/admin/notifications/page.tsx). Admin-only. Fetches up to 500 `notification_logs` rows joined to `clients(slug, business_name)` filtered by URL searchParams (channel/status/window/q). Aggregates client-side after text search, passes to `StatsRibbon`, renders one `NotificationRow` per row.

### 22. Page header
"Notifications / Every email, Telegram, and SMS your platform sent out — and whether it landed".

### 23. StatsRibbon
**File:** [StatsRibbon.tsx](src/components/admin/notifications/StatsRibbon.tsx).
**What you see:** "Window: 24h · N total · M failures" line. 4 channel tiles (email indigo / telegram sky / sms green / system slate): channel cap label + large total + ✓ success (delivered+opened+clicked, +sent for telegram/sms) / ⋯ pending (email sent-but-not-delivered) / ✕ fail (failed+bounced+complained).
**Reads:** roll-up computed server-side from `notification_logs(channel, status)` into `StatsByChannel`.
**Cross-surface:** `notification_logs` is the same idempotency source `notificationsAlreadySent()` checks in the completed webhook (per [webhook-security-and-idempotency.md](docs/architecture/webhook-security-and-idempotency.md) §4) and the table `LifecycleDrawer` joins on.

### 24. FilterStrip
**File:** [FilterStrip.tsx](src/components/admin/notifications/FilterStrip.tsx).
**What you see:** pill rows for Channel (all/email/telegram/sms/system), Status (all/sent/delivered/opened/clicked/failed/bounced/complained/delayed), Window (1h/24h/7d/30d/all); search input "search client / recipient / content…" + Go/Clear.
**What you can do:** clicking pills → `router.push(?channel=...&status=...&window=...&q=...)` via `setParam` (clears the key for `all` or default `24h`). State is URL-driven so views are deep-linkable. Re-runs server fetch via `force-dynamic`.

### 25. Notification row list
**File:** [NotificationRow.tsx](src/components/admin/notifications/NotificationRow.tsx).
**What you see:** "N of M notifications" header (and "showing first 500 — narrow the window for older rows" at the limit). Each row collapsed: timestamp ("Apr 12 14:33"), business_name, colored channel pill, colored status pill (green delivered/opened/clicked; red failed/bounced/complained; amber delayed; neutral sent/other), recipient, 120-char content preview. Expanded: full content + error + `external_id` (Resend message ID / Telegram update ID) + `View lifecycle` button.
**Reads:** `notification_logs(id, client_id, channel, recipient, content, status, error, external_id, created_at) join clients(slug, business_name)`.
**Cross-surface:** rows are inserted by `/api/webhook/[slug]/completed` post-call notifies (`notificationsAlreadySent` guards re-deliveries — see webhook-security §4), `/api/webhook/[slug]/voicemail` Telegram alerts (no `RecordingSid` dedup — duplicate-Telegram risk noted §6), Resend webhook handlers updating `status`, and cron jobs for minute-usage warnings (75%/90%) and trial midpoint nudges (refactor-phase-tracker D218/D222).

### 26. LifecycleDrawer
**File:** [LifecycleDrawer.tsx](src/components/admin/notifications/LifecycleDrawer.tsx).
**What you see:** slide-in panel for one client — business_name + slug header, status pill (active/trialing/past_due/canceled/expired), fields: subscription_status, trial_converted, selected_plan, stripe_customer_id, stripe_subscription_id, trial_expires_at, subscription_current_period_end, contact_email, monthly_minute_limit, minutes_used_this_month. Below: recent notifications list (timestamp, channel, status pill, content, error).
**Reads:** `public.client_lifecycle(p_slug)` RPC via `/api/admin/hermes/lifecycle-proxy` (proxy hides the anon key from the browser). Returns aggregated `clients` lifecycle + recent `notification_logs` rows.
**Cross-surface:** same RPC powers Hermes / Zara operator skills (`concierge-status`, lifecycle lookups).

---

## Knowledge data flow — when you edit X here, Y also changes

- **Add a fact (InlineFactsEditor)** → `PATCH /api/dashboard/settings { business_facts }` → step 4 writes `clients.business_facts`; step 6 schedules `scheduleAutoRegen('auto:settings_update')` (in `LOW_STAKES_REGEN_FIELDS`); step 8 — IF `knowledge_backend='pgvector'` — `reseedKnowledgeFromSettings()` deletes `source='settings_edit'` chunks and re-embeds; `computeNeedsSync=false` so NO `updateAgent()`. Visible downstream: KnowledgeHealthScore counts, CallContextPreview drawer (live recomputed), Overview `AgentKnowsCard`, Settings `AgentKnowledgeCard`/`AdvancedContextCard`/`PromptEditorCard` preview. At runtime `buildKnowledgeSummary()` reads `business_facts` directly so the next call gets new bullets.
- **Add/edit/delete a FAQ (InlineFaqEditor)** → same PATCH for `extra_qa`. `scheduleAutoRegen` does NOT fire (not in low-stakes list). Reseed fires identically. Same downstream surfaces as facts plus `QuickAddFaq`, call-detail FAQ promote.
- **AskYourAgent** → `POST /api/dashboard/preview-question` reads facts + qa + `knowledge_chunks` via the same hybrid match as runtime `queryKnowledge`. No DB write.
- **Save a gap answer (KnowledgeGaps)** → `POST /api/dashboard/knowledge/chunks { chunk_type:'qa', auto_approve:true, trust_tier:'medium' }` writes a new approved `knowledge_chunks` row + `syncClientTools()` (registers `queryKnowledge` first time). Then `PATCH .../gaps { resolution_type:'faq' }` flips `knowledge_query_log` rows; response includes `auto_cascade_count` for similar queries auto-resolved. KnowledgeHealthScore unanswered count drops; TopQueriesCard rollup shifts. Note: this path does NOT write to `extra_qa`.
- **Approve / Reject pending chunk (PendingSuggestions)** → `POST .../approve` flips `knowledge_chunks.status` and may call `syncClientTools()`. ChunkBrowser, source tile counts, and `KnowledgeHealthScore.approvedChunkCount` update. `knowledge-chunks-refresh` event fans out.
- **Paste text / upload doc / compile text** → ingest routes write `knowledge_chunks` (`compiled_import`/`knowledge_doc`/`manual_text` etc.), append FAQ items to `clients.extra_qa`, write `compiler_runs` provenance. `embedChunks() + syncClientTools()`. For pgvector clients with FAQ items appended, `reseedKnowledgeFromSettings` also fires in the compile/apply path. KnowledgeSourceRegistry tile counts update; KnowledgeProvenanceCard AI Compiler section appears; ChunkBrowser shows the new rows.
- **Add a website URL + approve scrape** → `PATCH settings { website_url }`; `POST scrape-website` writes `website_sources` + `clients.website_scrape_status/preview`; approval writes `clients.business_facts`/`extra_qa`/`website_knowledge_approved`/`website_scrape_status='approved'`, then `seedKnowledgeFromScrape()` (deletes prior `source='website_scrape'` chunks → embeds new) + `syncClientTools()`. KnowledgeProvenanceCard Website badge, KnowledgeSourceRegistry Website tile + count, Tier 2 facts/FAQs (overwritten), runtime `buildKnowledgeSummary()`, and `buildCapabilityFlags().hasWebsite` for the Overview CapabilitiesCard.
- **Import GBP (KnowledgeSourceRegistry GBP tile)** → `POST .../ingest-gbp` writes `knowledge_chunks` (`gbp`, `medium`) + `syncClientTools()`. KnowledgeProvenanceCard Google card and Tier 3 GBP tile activate.
- **Dismiss conflicts (Conflict banner modal)** → `PATCH .../conflicts` flags conflict items on `compiler_runs` so the banner stays hidden on next fetch.

## Admin data flow

- **ActionItems** rows clear when their source state changes: HOT pile → `call_logs(HOT, >1h)` resolved by leads page or natural expiry; failed transfers → resolved by next successful transfer or 24h window; >90% minute usage → resolved by monthly cron reset or admin bumping `monthly_minute_limit`/`bonus_minutes`; "booking enabled but no calendar connected" → owner completes Google Calendar OAuth (sets `calendar_auth_status='connected'` + `google_calendar_id`); "transfer configured but no successful transfers in 7d" → at least one `call_logs.transfer_status='completed'` row; live calls → entry transitions `live → processing → DONE/HOT/...` via the completed webhook.
- **ClientHealthBar HOT counts** → `call_logs(call_status='HOT', this month)` grouped by client_id — same source feeding the per-client Overview "leads this month" tile and ActionItems HOT row (with the 1h cutoff).
- **ClientHealthBar minute usage** ← `clients.seconds_used_this_month` incremented by Ultravox `call.billed` webhook (`/api/webhook/ultravox`). Same column drives per-client MinuteUsage card and Settings billing.
- **LiveCallBanner** mirrors `call_logs(call_status='live')` (same source as ActionItems live-call row) and surfaces `transfer_status` changes via realtime channel. `End` writes whisper-DELETE; `Take this call` triggers `transfer-now` which seeds `transfer_status='transferring'` and the realtime overlay activates.
- **MonthlySpendCard** (legacy only) → `call_logs(billed_cost_cents > 0, this month)` summed per client. The same `billed_cost_cents` written by the Ultravox `call.billed` webhook drives `/dashboard/costs`. The redesign `/dashboard/admin` does not render this card.
- **SystemPulse** → `/api/dashboard/system-pulse` aggregates Ultravox per active agent + Supabase. No user data read or written.
- **TalkToZaraAdminButton** (legacy only) → `POST /api/admin/zara` returns a WebRTC `joinUrl` for the Zara admin agent (tools `adminCallsReport`/`adminSpendReport`/`adminClientLookup`).
- **Admin tools tile strip** (redesign only) → static `<a>` links to `/dashboard/admin/notifications|harness|learning-bank`.
- **Notifications page** (StatsRibbon, rows, drawer) all read `notification_logs`. Rows are written by `/api/webhook/[slug]/completed` (post-call alerts, idempotency-guarded), `/api/webhook/[slug]/voicemail` (voicemail alerts), Resend webhook handlers (status transitions sent → delivered → opened → clicked or → bounced/complained), and cron jobs for minute-usage warnings + trial midpoint nudges.
- **LifecycleDrawer** → `client_lifecycle(slug)` RPC returns `clients` lifecycle fields + most recent `notification_logs` rows. Same RPC powers Hermes / Zara operator skills (`concierge-status`, lifecycle lookups).
