# Post-Audit Issue Tracker
**Created:** 2026-03-25 | **Source:** Wave 1–4 trust audit + UI/UX review + Sonar Pro refactor audit (2026-03-26)

---

## DONE THIS SESSION (applied, committed)

| # | Fix | File | What |
|---|-----|------|------|
| ✅ | Trial sidebar no longer auto-collapsed | `src/app/dashboard/layout.tsx:102` | `initialCollapsed` was `true` for trial users — they landed with a collapsed icon-only nav. Now `false` for everyone. |
| ✅ | `key={gap.query}` on gaps list | `KnowledgeEngineCard.tsx` | Was `key={i}` — stable key prevents UI jump on remove |
| ✅ | Stable key on test results | `KnowledgeEngineCard.tsx:586` | Was `key={i}` on query result list — now uses source+type+similarity |
| ✅ | `text-[9px]` on "Add as FAQ" badge | `KnowledgeEngineCard.tsx:488` | Was `text-[8px]` — too small to read |
| ✅ | W1-A: Admin test call tenant isolation | `AgentTestCard.tsx` + `AgentPageView.tsx` | `client_id` now sent in POST body so admin tests the selected client |
| ✅ | W1-B: Trial email dedup dual guard | `provision/trial/route.ts` | Checks both intake_submissions AND Supabase auth for existing email |
| ✅ | W1-C: `daysRemaining` passed to AgentTestCard | `AgentPageView.tsx` | Trial expiry context in upgrade modal |
| ✅ | W2-A: Trial expiry in "Needs Attention" | `AgentPageView.tsx` | ≤7 days triggers attention item with urgency |
| ✅ | Nested `<button>` violation (KnowledgeEngineCard H2) | `KnowledgeEngineCard.tsx` | Outer button split into div + two sibling buttons; `aria-expanded` added |
| ✅ | `twilio_number` in `needsAgentSync` | `settings/route.ts:490` | Already present — confirmed not missing |
| ✅ | Voicemail fallback sig validation | `webhook/[slug]/fallback/route.ts` | Confirmed already fixed in prior session |
| ✅ | P-NEXT HIGH: `patchServicesOffered` + `patchAgentName` silent fail | `settings/route.ts` + `ServicesOfferedCard` + `AgentOverviewCard` | Three `else` branches push PromptWarning; cards surface inline amber/red banners |
| ✅ | P-NEXT MEDIUM: Knowledge reseed timing indicator | `settings/route.ts` + `usePatchSettings` + `AdvancedContextCard` + `AgentKnowledgeCard` | `knowledge_reseeding: true` in response; `knowledgeReseeded` state in hook; blue confirmation note in both cards |
| ✅ | Website Knowledge card — selectable scrape items | `WebsiteKnowledgeCard.tsx` | SelectablePreview with checkboxes, Select All/Deselect All, "Add N items to Agent" |
| ✅ | KnowledgeEngineCard — full chunk browser | `KnowledgeEngineCard.tsx` | Source filter tabs, expandable content, Load More pagination, approve/reject/delete |

---

## P0 — Trust / UX Blockers

### ✅ P0-1: No logged-in user identity visible
### ✅ P0-2: Trial login recovery is broken
### ✅ P0-3: Trial success screen login link

---

## P1 — High Priority / Conversion-Critical

### P1-1: Trial experience validation (manual — end-to-end)
Trial sidebar uncollapsed ✅. Still needed: validate welcome flow with fresh signup, confirm "Go Live" CTA makes sense for users without a Twilio number yet.

### ✅ P1-2: Module-level rate limiter resets on Railway deploy
### ✅ P1-3: Admin login observability — "who's logged in"

---

## P2 — Medium Priority / Ops Hardening

### P2-1: Voicemail duplicate Telegram alert
**File:** `src/app/api/webhook/[slug]/voicemail/route.ts`
**Root cause:** No `RecordingSid` guard. Twilio retries on slow download → duplicate Telegram alert.
**Fix:** After `call_log` lookup, if `call_log.recording_url` already contains the `recordingSid` filename, return 200 early without re-processing. ~4 lines.
```ts
const existingRecordingSid = call_log?.recording_url?.includes(recordingSid)
if (existingRecordingSid) return new NextResponse('already processed', { status: 200 })
```

### P2-2: RLS verification on realtime tables
**Tables:** `call_logs`, `campaign_leads`, `notification_logs`, `bookings`
**Fix:** Run Supabase MCP — `SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename IN ('call_logs','campaign_leads','notification_logs','bookings');` — confirm cross-tenant `SELECT` is blocked by `client_id = auth.uid()` policy.

### P2-3: Knowledge query log — no dedup constraint
**Table:** `knowledge_query_log`
**Fix:** `CREATE UNIQUE INDEX CONCURRENTLY idx_kql_dedup ON knowledge_query_log(client_id, query_text) WHERE resolved = false;`
Low urgency — duplicate gaps are advisory only.

---

## P3 — Deferred / Low Priority

| # | Item | Notes |
|---|------|-------|
| P3-1 | Playwright truth-audit specs | 5 specs in `tests/truth-audit/` — need live app with test client |
| P3-2 | `business_name` not re-patched post-provision | Baked at provision time; post-provision rename = manual `/prompt-deploy` |
| P3-3 | `injected_note` staleness | "Today's update" field stays forever if owner forgets to clear |
| P3-4 | Demo SMS tool injected without `twilio_number` guard | `buildDemoTools()` injects SMS tool when `hasCallerPhone=true` regardless of `twilio_number` |
| P3-5 | Settings PATCH `needsAgentSync` coupling is untyped | New DB_PLUS_TOOLS fields silently miss agent sync if not added manually |
| P3-6 | Retake tour button only in expanded sidebar | Collapsed sidebar → tour button invisible |
| P3-7 | `text-[8px]` remaining instances | `SetupView.tsx:331`, `ImprovementHints.tsx:190`, `AlertsTab.tsx:212`, `KnowledgeGaps.tsx:346` |

---

## P-NEXT — Sonar Pro Refactor Audit (2026-03-26)

Sonar Pro analysis of the hook/card settings architecture identified 4 categories of gaps. Ranked by actual impact on this codebase.

---

### 🔴 REFACTOR-1: `usePatchSettings` — inline `options` object causes stale `patch` ref
**Files:** `usePatchSettings.ts` + 6 callers
**Severity:** Medium-High — correctness bug. `patch` is recreated every render for any card that passes an inline options object.

**Root cause:** `patch` is a `useCallback` with deps `[clientId, isAdmin, options]`. Six cards pass inline objects:
```ts
// These recreate the options ref every render → patch recreated every render
usePatchSettings(clientId, isAdmin, { onSave })           // VoicemailGreetingCard, HoursCard, IvrMenuCard, AdvancedContextCard
usePatchSettings(clientId, isAdmin, { onSave, onPromptChange })  // VoiceStyleCard, BookingCard
```
**Effect:** Every re-render recreates `patch`, which means any stale event handler holding the old `patch` ref will call the old version with its captured state. The serialized queue (`inflightPatches`) is module-level so serialization still works, but `setSaving/setSaved/etc.` closures can be stale on rapid saves.

**Fix — "latest ref pattern" in `usePatchSettings`:**
```ts
// In usePatchSettings, replace options in useCallback deps with a ref:
const optionsRef = useRef(options)
optionsRef.current = options  // update every render, no effect needed

const patch = useCallback(async (body) => {
  // use optionsRef.current.onSave?.() instead of options.onSave?.()
  // ...
}, [clientId, isAdmin])  // remove options from deps
```
This is the React Query pattern for mutation options. One file change (`usePatchSettings.ts`), zero card changes.

---

### 🟡 REFACTOR-2: `router.refresh()` — called on every PATCH, no debounce
**File:** `usePatchSettings.ts:107`
**Severity:** Medium — performance. If two cards save near-simultaneously (e.g., FAQ add + voice change), two `router.refresh()` calls stack, triggering double RSC payload revalidation in Next.js 15.

**Sonar finding:** Next.js 15 App Router partial revalidation cascades when multiple `refresh()` calls hit within the same render cycle — causes hydration mismatches on Turbopack and excess refetch on segment-shared data.

**Fix (minimal — no SWR migration):**
```ts
// In usePatchSettings — debounce the refresh call
const pendingRefresh = useRef<ReturnType<typeof setTimeout> | null>(null)

// Replace router.refresh() with:
if (pendingRefresh.current) clearTimeout(pendingRefresh.current)
pendingRefresh.current = setTimeout(() => { router.refresh(); pendingRefresh.current = null }, 300)
```
300ms debounce absorbs concurrent saves. Pairs with REFACTOR-1 fix in the same file.

**Note:** This is the same documented P-NEXT MEDIUM (`router.refresh() unreliability`). This is the concrete fix.

---

### 🟡 REFACTOR-3: Warning state lifecycle — no user-dismiss, cleared silently at 5s
**File:** `usePatchSettings.ts:114` + `ServicesOfferedCard.tsx`
**Severity:** Low-Medium — UX gap. Prompt patcher warnings (e.g., "services not patched in prompt") auto-dismiss after 5 seconds. If the owner is reading another card when the warning fires, they miss it entirely.

**Current behavior:**
```ts
setTimeout(() => { setSaved(false); setSyncStatus(null); setWarnings([]); setKnowledgeReseeded(false) }, 5000)
```

**Sonar finding:** SaaS settings pages with async feedback should persist warnings until user-dismissed (especially for actionable items like "run /prompt-deploy"). Auto-dismiss is fine for success indicators but not for warnings requiring follow-up.

**Fix options (pick one):**
- Option A (minimal): Extend timeout from 5s → 30s for warnings only (`warnings.length > 0 ? 30000 : 5000`)
- Option B (better): Don't auto-clear warnings in the timeout — let cards clear warnings on next PATCH start (already done via `setWarnings([])` at top of `patch()`) or on user dismiss
- Option C (full): Add `dismissWarning(index)` to hook return, render each warning with an `×` button

**Recommended:** Option B — just remove `setWarnings([])` from the 5s `setTimeout`. Warnings already clear when the user makes a new save (line 66: `setWarnings([])`). This way they persist until the user acts, but don't stack forever.

---

### 🟢 REFACTOR-4: Cross-card warning surfacing — no global toast for patcher failures
**Severity:** Low — nice-to-have
**Sonar finding:** Individual cards handle their own warning banners, but if a patcher warning fires on a card that's not currently visible (collapsed section), the user sees the sonner toast "Saved" but the warning banner is hidden inside the collapsed card.

**Current state:** The `toast.success('Saved')` always fires on successful save, even when `warnings` is non-empty. This can mislead — user sees ✓ Saved in toast but there's a hidden amber "prompt wasn't updated" warning.

**Fix:** In `usePatchSettings`, when `warnings.length > 0` after a successful save, use `toast.warning()` instead of `toast.success()`:
```ts
if (data.warnings?.length) {
  toast.warning('Saved — but check the warning on this card')
} else if (data.ultravox_synced === false && data.ultravox_error) {
  toast.warning('Saved, but agent sync failed — retry from the card')
} else {
  toast.success('Saved')
}
```
One-liner change in `usePatchSettings.ts`. No card changes needed.

---

## Execution Order (updated 2026-03-26)

```
✅ DONE THIS SESSION:
  P0-1, P0-2, P0-3 (auth/UX)
  P1-2, P1-3 (rate limiter, admin login)
  P-NEXT HIGH: patcher silent fails (ServicesOffered + AgentName)
  P-NEXT MEDIUM: knowledge reseed indicator
  WebsiteKnowledgeCard selectable items
  KnowledgeEngineCard full chunk browser

NEXT SESSION (priority order):
  REFACTOR-4 → toast warning when warnings present (1 line, usePatchSettings.ts) — do first, smallest
  REFACTOR-3 → remove warnings from 5s auto-clear timeout (1 line) — pairs with above
  REFACTOR-2 → debounce router.refresh() in usePatchSettings (5 lines)
  REFACTOR-1 → options ref pattern in usePatchSettings (removes stale closure risk)
  P2-1       → voicemail RecordingSid guard (~4 lines in voicemail/route.ts)
  P2-2       → RLS table verification via Supabase MCP (diagnostic, no code change)
  P3-7       → text-[8px] in SetupView/ImprovementHints/AlertsTab/KnowledgeGaps

DEFERRED:
  P1-1  → trial welcome flow end-to-end (manual QA)
  P2-3  → knowledge_query_log dedup index (low urgency)
  P3-1  → Playwright truth-audit specs
  P3-3  → injected_note staleness UX
  P3-4  → Demo SMS twilio_number guard
  P3-5  → needsAgentSync type safety
  P3-6  → tour button in collapsed sidebar
```

---

## Notes on Architecture Decisions (from Sonar audit)

**Why not SWR?** The tracker documents this as the long-term fix for `router.refresh()` unreliability. Sonar confirms SWR + `useSWRMutation` is the industry-standard pattern for optimistic settings cards. However, migrating 19 cards is a full sprint. The debounce fix (REFACTOR-2) is the correct interim solution.

**Why not Zustand/context for shared state?** The 19 cards are intentionally isolated — each owns its own save state. The `inflightPatches` module-level map handles the only cross-card concern (race conditions). Adding a global store would over-engineer this. The `optionsRef` fix (REFACTOR-1) is sufficient.

**Why not `useReducer` for warning history?** Sonar suggests it for warning accumulation. For this app, warnings fire once per save and are tied to a specific card's action. Accumulation without clear ownership would make the UX confusing. The Option B fix (persist until next save) is correct for this use case.
