# Settings Card Tracker

> Created: 2026-03-22
> Architecture reference: `memory/settings-card-architecture.md`
> Source files: `src/components/dashboard/settings/` + `src/app/api/dashboard/settings/route.ts`

## Verified Working (Playwright 2026-03-22)

All 6 cards save to DB and persist after reload. Tested on production (demo-auto-glass).

| Card | Save | Reload | Sync Path | Notes |
|------|------|--------|-----------|-------|
| Voice Style | PASS | PASS | Ultravox (prompt patched) | Filler contradiction bug — see SET-1 |
| Hours & After-Hours | PASS | PASS | DB-only, call-time inject | Clean |
| Voicemail Greeting | PASS | PASS | DB-only, voicemail-time | Clean |
| Advanced Context | PASS | PASS | DB-only, call-time inject | Button shows "Active on next call" |
| Agent Identity (SectionEditor) | PASS | PASS | Ultravox (prompt section) | Appends duplicate — see SET-4 |
| Today's Update (injected_note) | PASS | PASS | DB-only, call-time inject | Away/Holiday/Promo quick-fill works |

---

## Bugs Found

### SET-1: Voice Style filler contradiction (MEDIUM-HIGH) — FIXED 2026-03-22

**Problem:** `patchVoiceStyleSection()` only replaced the TONE & STYLE section. Standalone filler instructions from `{{FILLER_STYLE}}` (in VOICE NATURALNESS section) remained, creating contradictions on preset switch.

**Fix applied (option A):** `patchVoiceStyleSection()` now strips standalone filler lines outside the TONE section via `stripStandaloneFillers()`. A `STANDALONE_FILLER_RE` regex matches all 4 preset fillerStyle patterns + hand-crafted variants (e.g. "Use backchannels:", "Start with a backchannel when acknowledging:"). Filler content consolidated into TONE section only.

**Files changed:** `src/lib/prompt-patcher.ts`

---

### SET-2: Voice Style preset not shown on page load (LOW-MEDIUM) — FIXED 2026-03-22

**Problem:** Playwright snapshot showed preset buttons without `[active]` state. Visual styling actually worked (blue border + filled dot via `useState(initialPreset)`), but `aria-pressed` attribute was missing — Playwright accessibility check couldn't detect the active state.

**Fix:** Added `aria-pressed={selected}` to each preset button in VoiceStyleCard.

**Files:** `src/components/dashboard/settings/VoiceStyleCard.tsx`

---

### SET-3: Prompt char count stale after prompt-modifying saves (LOW) — PARTIALLY FIXED by SET-13

**Problem:** The agent capabilities section shows "3,453 / 12,000" chars. After Voice Style or SectionEditor saves modify `system_prompt`, the count doesn't update until full page reload.

**SET-13 fixed:** Parent `prompt` state now updates after prompt-modifying saves. PromptEditorCard shows the correct text.

**Still broken:** AgentOverviewCard line 255 reads `client.system_prompt.length` — that's the SSR prop, not the `prompt` state. Need to pass `promptLength` prop or the live `prompt` value so the char count badge updates without page reload.

**Files:** `AgentOverviewCard.tsx`, `AgentTab.tsx`

---

### SET-4: SectionEditorCard appends duplicate identity content (LOW-MEDIUM)

**Problem:** When a prompt has an IDENTITY section without `<!-- unmissed:identity -->` markers (all hand-crafted prompts), saving via SectionEditorCard appends a NEW section with markers at the end. This creates two identity definitions in the same prompt.

**Evidence:** Demo prompt had `IDENTITY\nYou are Tyler...` in body, plus appended `<!-- unmissed:identity -->\nYou are Tyler...<!-- /unmissed:identity -->` at the end.

**Fix options:**
- A) Before appending, search for common section headers (IDENTITY, KNOWLEDGE, etc.) and warn the user
- B) Only allow SectionEditor on prompts that were generated with markers (template prompts)
- C) When appending a new section, strip any existing section with matching header name

**Files:** `src/lib/prompt-sections.ts` (`replacePromptSection()`), `src/components/dashboard/settings/SectionEditorCard.tsx`

---

### SET-5: Agent Runtime endpoint 404 (LOW)

**Problem:** `/api/dashboard/runtime?client_id=...` returns 404. The "Agent Runtime" card in settings shows "Failed to load runtime config."

**Evidence:** Console error on every settings page load.

**Fix:** Either create the endpoint or remove the runtime card from the UI.

**Files:** Need to create `src/app/api/dashboard/runtime/route.ts` or remove runtime card from AgentTab.

---

### SET-6: React hydration error #418 on settings page (LOW)

**Problem:** React error #418 (server/client HTML mismatch) fires on every settings page load.

**Likely cause:** Time-based rendering (timestamps, "4d ago"), theme detection, or browser-only state rendering differently on server vs client.

**Impact:** Cosmetic — page works but React has to reconcile the mismatch, slight performance hit.

**Files:** Likely in AgentTab.tsx or a child component that renders dynamic content without `suppressHydrationWarning`.

---

## Previously Tracked (from prior session)

| ID | Item | Status |
|----|------|--------|
| D11 | voice_style_preset was a no-op | **FIXED** (patchVoiceStyleSection wired in) |
| D12 | injected_note 3-bug fix | **FIXED** (call-time inject) |
| D13 | Settings component extraction | **DONE** (5 cards extracted) |
| D14 | Booking config card still inline in AgentTab | **FIXED** (extracted to BookingCard.tsx) |
| D15 | Voice/calendar prompt patches skip validatePrompt() | **FIXED** (both run validatePrompt before save) |
| D16 | usePatchSettings doesn't surface errors to user | **FIXED** (hook returns error/clearError, all cards display) |

---

### SET-7: SectionEditorCard save doesn't update parent prompt state (MEDIUM) — FIXED by SET-13

**Problem:** SectionEditorCard modifies `system_prompt` server-side via `replacePromptSection()`, but the parent AgentTab `prompt` state is never updated. After a section save, PromptEditorCard still shows the OLD prompt text. If admin then opens the prompt editor and saves, they overwrite the section edit with the stale version.

**Fix:** SET-13 added `onPromptChange` callback to SectionEditorCard. API returns `system_prompt`, card calls `onPromptChange`, AgentTab updates parent state. PromptEditorCard now always has the latest prompt.

---

### SET-8: Dead props in AgentTabProps — 14 unused setters (LOW)

**Problem:** After 8d extraction, AgentTabProps still declares 14 setter props that are no longer used. Cards manage their own local state. Dead setters: `setGodConfig`, `setTelegramTest`, `setHoursWeekday`, `setHoursWeekend`, `setAfterHoursBehavior`, `setAfterHoursPhone`, `setSectionContent`, `setBusinessFacts`, `setExtraQA`, `setBookingDuration`, `setBookingBuffer`, `setForwardingNumber`, `setTransferConditions`, `setVoiceStylePreset`. Their matching getters are still used (as `initialX` props to cards).

**Impact:** No functional bug — just interface bloat. SettingsView still creates and passes these setters unnecessarily.

**Fix:** Remove unused setter props from AgentTabProps. Then remove matching `useState` calls from SettingsView. Keep the getter Records (used for initial values).

**Files:** `AgentTab.tsx`, `SettingsView.tsx`

---

### SET-9: Section open/close state resets on navigation (LOW)

**Problem:** `openSections` is `useState` — resets to defaults on every navigation away and back. Admin who frequently works in "Agent Script" or "Configuration" has to re-expand every time.

**Fix:** Persist to `sessionStorage` keyed by client ID. Read on mount, write on toggle.

**Files:** `AgentTab.tsx`

---

### SET-10: PromptEditorCard has its own collapse — double-accordion (LOW)

**Problem:** PromptEditorCard has an internal `collapsed` state with its own expand/collapse animation. But it's already inside the "Agent Script" SettingsSection which has its own collapse. For admin, opening "Agent Script" section reveals a collapsed PromptEditorCard — user clicks twice to see the prompt. For non-admin, PromptEditorCard sits outside any section and its own collapse is the only one, which is fine.

**Impact:** Admin-only UX friction. Two clicks instead of one.

**Fix options:**
- A) Remove internal collapse from PromptEditorCard when inside a SettingsSection (pass `defaultExpanded` prop)
- B) Keep it — it's intentional since the prompt editor is tall (480px textarea) and admin may want it collapsed while working on ImprovePrompt/Versions below it

**Files:** `PromptEditorCard.tsx`, `AgentTab.tsx`

---

### SET-11: SetupCard rendered both inside and outside SettingsSection (LOW)

**Problem:** In AgentTab, SetupCard is rendered for non-admin users OUTSIDE any section (line 254), plus there's an admin "Mark as done" button inside the Identity section (line 332). SetupCard itself also has an `isAdmin` early return that renders just the "Mark as done" button. This means SetupCard's admin mode is redundant with the inline button in AgentTab. Both exist.

**Impact:** No visual bug (admin never sees SetupCard's full form because of the early return). But the admin "Mark as done" button in AgentTab (lines 332-341) duplicates logic that lives in SetupCard.handleMarkComplete.

**Fix:** Remove the inline admin button from AgentTab Identity section. Admin already has setup controls via the SetupCard component (which early-returns the mark-complete button for admin).

**Files:** `AgentTab.tsx`

---

### SET-12: Concurrent prompt-patch race condition (HIGH) — FIXED 2026-03-22

**Problem:** VoiceStyleCard, SectionEditorCard, agent_name patch, and booking toggle each independently SELECT the current `system_prompt`, patch it, and SAVE. If two fire within milliseconds, the second overwrites the first because it read a stale prompt from DB.

**Fix applied (option B — client-side):** `usePatchSettings` hook now serializes all PATCH requests per client via a module-level promise chain (`serializeForClient()`). When two cards save concurrently, the second request waits for the first to complete. Since the server always re-reads the latest prompt from DB for each patch operation (section edit, voice style, calendar block, agent name), serialization ensures no stale-read overwrites. Combined with SET-13 (prompt returned in response), the parent state stays current between saves.

**Scope:** Prevents same-tab races (the common case — admin clicking two cards quickly). Multi-tab/multi-user races remain possible but are extremely rare; server-side optimistic locking (option A) deferred until needed.

**Files changed:** `src/components/dashboard/settings/usePatchSettings.ts`

---

### SET-13: API doesn't return updated prompt text (MEDIUM) — FIXED 2026-03-22

**Problem:** The PATCH response is `{ ok, ultravox_synced, warnings }` but never returns the new `system_prompt`. This is the root cause of SET-3 (stale char count) and SET-7 (stale parent prompt). Every prompt-modifying save (voice style, section edit, agent name, booking toggle) changes the prompt server-side but the client never gets the result back.

**Fix applied:**
1. API route returns `system_prompt` in the response whenever prompt was modified
2. `usePatchSettings` hook accepts `onPromptChange` callback, calls it when API returns a new prompt
3. `VoiceStyleCard`, `SectionEditorCard`, `AgentOverviewCard` all accept `onPromptChange` prop
4. `AgentTab` wires `handlePromptChange` callback to all prompt-modifying cards → updates parent `prompt` state

**Files changed:** `settings/route.ts`, `usePatchSettings.ts`, `VoiceStyleCard.tsx`, `SectionEditorCard.tsx`, `AgentOverviewCard.tsx`, `AgentTab.tsx`

---

### SET-14: No Ultravox sync retry after transient failure (MEDIUM) — FIXED 2026-03-22

**Problem:** If `updateAgent()` fails (network error, Ultravox downtime), DB has the new data but Ultravox agent config is stale. No background retry, no admin alert (only `console.error`), no manual re-sync button. The only recovery is to save again. Drift accumulates silently.

**Fix applied (A + C):**
1. `usePatchSettings` hook stores failed payload in `lastFailedPayload` ref, exposes `retrySyncFailed()` function + `syncError` string. Cards can now show a "Retry" button when sync fails (wiring individual cards = SET-19 scope).
2. Server-side: `route.ts` sends Telegram alert to operator when Ultravox sync fails (fire-and-forget via `TELEGRAM_OPERATOR_BOT_TOKEN`/`TELEGRAM_OPERATOR_CHAT_ID`).

**Files changed:** `usePatchSettings.ts`, `settings/route.ts`

---

### SET-15: No unsaved changes warning (MEDIUM) — FIXED 2026-03-22

**Problem:** No `beforeunload` handler anywhere in the settings page. If a user edits business facts, FAQs, transfer conditions, or any card field and then navigates away, their edits are silently lost.

**Fix applied:** New `useDirtyGuard` hook with module-level `Set<string>` tracking dirty card keys. `useDirtyGuardEffect()` called once in AgentTab registers `beforeunload`. 5 cards wired: HoursCard, AdvancedContextCard, BookingCard (duration/buffer only, not toggle), VoicemailGreetingCard, AgentOverviewCard (agent name).

**Known limitation:** `beforeunload` only fires on browser-level navigation (tab close, refresh, URL change). Next.js App Router client-side navigation (clicking sidebar `<Link>` to Calls, Calendar, etc.) does NOT trigger `beforeunload`. Full client-side nav guarding would require intercepting `history.pushState` or a custom `NavigationGuard` — deferred.

**Files changed:** New `useDirtyGuard.ts`, `AgentTab.tsx`, `HoursCard.tsx`, `AdvancedContextCard.tsx`, `BookingCard.tsx`, `VoicemailGreetingCard.tsx`, `AgentOverviewCard.tsx`

---

### SET-16: No loading state for settings page (LOW-MEDIUM)

**Problem:** No `loading.tsx` or Suspense boundary for `/dashboard/settings`. The server component fetches all client data (including full prompts) before rendering. Users see a blank/white page during SSR until all data arrives.

**Fix:** Add `src/app/dashboard/settings/loading.tsx` with a skeleton matching the settings layout (tab bar + 3-4 card skeletons).

**Files:** Create `src/app/dashboard/settings/loading.tsx`

---

### SET-17: No ErrorBoundary on settings page (LOW-MEDIUM)

**Problem:** `ErrorBoundary.tsx` exists in the codebase but isn't used in the dashboard settings layout. If any single card component throws a React error (bad data shape, null ref, missing prop), the entire settings page crashes to a white screen instead of gracefully degrading.

**Fix:** Wrap each SettingsSection (or each card) in an ErrorBoundary that shows "This section encountered an error — try refreshing" instead of killing the whole page.

**Files:** `AgentTab.tsx`, `src/components/ErrorBoundary.tsx`

---

### SET-18: Three raw fetch calls bypass usePatchSettings (LOW-MEDIUM)

**Problem:** Three save operations use raw `fetch` instead of the `usePatchSettings` hook, missing error/warning/syncStatus handling:
- `toggleStatus()` in AgentTab (line 193) — manual optimistic update, drops warnings/sync status
- `handleMarkSetupComplete()` in AgentTab (line 207) — no response check at all, optimistic with no rollback on failure
- Knowledge toggle in SettingsView (line 398) — raw fetch, ignores sync status/warnings entirely

**Impact:** If any of these fail silently, user sees stale state. `handleMarkSetupComplete` is worst — it always sets `setup_complete: true` in UI even if the PATCH returns 500.

**Fix:** Convert all three to use `usePatchSettings`, or at minimum add response checking + error display + rollback on failure.

**Files:** `AgentTab.tsx`, `SettingsView.tsx`

---

### SET-19: syncStatus and warnings from hook unused by most cards (LOW)

**Problem:** `usePatchSettings` returns `syncStatus` and `warnings` but only VoiceStyleCard displays them. The other 6 cards using the hook (HoursCard, VoicemailGreetingCard, AdvancedContextCard, BookingCard, GodModeCard, SetupCard) destructure only `saving, saved, error, patch` and ignore sync/warning state. If Ultravox sync fails on a forwarding number change, user just sees "Saved".

**Fix:** Add a shared `<SaveFeedback syncStatus={syncStatus} warnings={warnings} />` component. Include in all cards that trigger Ultravox sync (forwarding_number, booking_enabled, sms_enabled, knowledge_backend changes).

**Files:** All 7 cards using `usePatchSettings`, new shared component

---

### SET-20: Admin page loads all client prompts into browser (LOW)

**Problem:** `page.tsx` SELECTs `system_prompt` for every client in one query. With 10 clients at 10K chars each, that's 100K+ of prompt text in the SSR payload. Only the selected client's prompt is used — the rest sits in React state doing nothing.

**Fix options:**
- A) Exclude `system_prompt` from the initial SELECT for admin. Lazy-load it when a client is selected (add a separate fetch on client switch).
- B) Accept the current approach for <10 clients and revisit at scale.

**Files:** `page.tsx`, `SettingsView.tsx`

---

### SET-21: useState bloat in SettingsView (LOW)

**Problem:** SettingsView has 25+ `useState<Record<string, T>>` hooks, each initialized by iterating all clients. After SET-8 cleanup (removing dead setters from AgentTabProps), ~11 of these Records serve only as `initialX` prop sources — they could be derived directly from the `clients` array via `useMemo` instead of duplicated into state. Extends SET-8.

**Fix:** After SET-8 removes unused setter props, replace the corresponding `useState` calls with `useMemo` derived values. Only keep `useState` for fields that are genuinely written to from child components (prompt, status, setupComplete).

**Files:** `SettingsView.tsx`

---

### SET-22: No deep linking to settings sections (LOW)

**Problem:** `handleScrollTo` works within the page but there's no URL hash support. Users can't bookmark or share links like `/dashboard/settings#voice-style` or `/dashboard/settings?section=hours`. Post-call hint chips could link directly with hash anchors but currently require the page to be already loaded.

**Fix:** Read `window.location.hash` on mount. Map hash to section ID via `SCROLL_TO_SECTION`. Auto-expand parent section and scroll. Update hash on section toggle.

**Files:** `AgentTab.tsx`

---

### SET-23: No confirmation on destructive setting changes (LOW) — PARTIALLY FIXED by SET-25

**Problem:** Toggling `booking_enabled` off removes the CALENDAR BOOKING FLOW block from the prompt immediately. Same for `knowledge_backend` toggle.

**SET-25 fixed:** `booking_enabled` toggle now has `confirm()` dialog: "Disable booking? This removes the calendar booking instructions from your agent's prompt."

**Still needed:** `knowledge_backend` toggle (in SettingsView) still has no confirm dialog.

**Files:** `SettingsView.tsx` (knowledge toggle only)

---

### SET-24: usePatchSettings recreates `patch` on every render (LOW)

**Problem:** `options` is an object literal passed to `usePatchSettings` — new reference every render. It's in the `useCallback` dep array for `patch`, so `patch` gets recreated every render, causing unnecessary child re-renders.

**Fix:** Use `useRef` for options inside the hook, or stabilize with `useMemo` at call sites.

**Files:** `usePatchSettings.ts`

---

### SET-25: booking_enabled toggle missing from extracted cards (MEDIUM) — FIXED 2026-03-22

**Problem:** No card or visible UI toggle sent `booking_enabled: true/false` to the settings API.

**Fix applied:** Added toggle switch to BookingCard with `confirm()` dialog on disable (also partially addresses SET-23). Toggle disabled when calendar not connected (tooltip: "Connect Google Calendar first"). Duration/buffer fields now only show when `enabled && connected`. `onPromptChange` wired so parent prompt state updates after calendar block is patched.

**Files changed:** `BookingCard.tsx`, `AgentTab.tsx`

---

### SET-26: knowledge_backend toggle doesn't propagate prompt change (LOW)

**Problem:** SettingsView line 392-406 toggles `knowledge_backend` via raw `fetch`. This triggers Ultravox tool sync (adds/removes queryKnowledge tool) but doesn't read or propagate the `system_prompt` from the response. Currently the API doesn't modify the prompt for `knowledge_backend` changes, so no data loss — but if prompt patching is added for knowledge in the future, this will silently lose it.

**Files:** `SettingsView.tsx`

---

### SET-3r: Char count badge still reads SSR prop (LOW) — FIXED 2026-03-22

**Problem:** SET-13 fixed the parent `prompt` state but AgentOverviewCard read `client.system_prompt.length` (SSR prop, never updates). Char badge didn't update after prompt-modifying saves.

**Fix:** Added `promptLength?: number` prop to AgentOverviewCard. AgentTab passes `(prompt[client.id] ?? '').length`. Card uses `promptLength` with fallback to `client.system_prompt.length`.

**Files:** `AgentOverviewCard.tsx`, `AgentTab.tsx`

---

## Priority Order

```
--- FIXED ---
SET-13 (API no prompt return)      -- FIXED 2026-03-22, also fixes SET-7
SET-7  (stale parent prompt)       -- FIXED by SET-13
SET-3  (stale char count)          -- PARTIALLY FIXED by SET-13 (prompt state yes, char badge no)
SET-12 (prompt race condition)     -- FIXED 2026-03-22, client-side serialization in usePatchSettings
SET-1  (filler contradiction)      -- FIXED 2026-03-22, stripStandaloneFillers in prompt-patcher
SET-3r (char count badge SSR)      -- FIXED 2026-03-22, promptLength prop on AgentOverviewCard
SET-2  (preset active state)       -- FIXED 2026-03-22, aria-pressed added to VoiceStyleCard
SET-25 (booking_enabled toggle)    -- FIXED 2026-03-22, toggle + confirm + onPromptChange in BookingCard
SET-14 (no sync retry)             -- FIXED 2026-03-22, retrySyncFailed() in hook + Telegram alert
SET-15 (no unsaved warning)        -- FIXED 2026-03-22, useDirtyGuard hook + beforeunload (browser-level only)

--- OPEN ---
SET-4  (duplicate sections)        -- LOW-MEDIUM, data integrity
SET-16 (no loading state)          -- LOW-MEDIUM, blank page during load
SET-17 (no ErrorBoundary)          -- LOW-MEDIUM, one card crash kills page
SET-18 (raw fetch bypasses hook)   -- LOW-MEDIUM, inconsistent error handling
SET-19 (syncStatus unused)         -- LOW, wire retrySyncFailed + syncError into cards
SET-24 (hook re-render churn)      -- LOW, perf optimization
SET-26 (knowledge toggle no prop)  -- LOW, future-proofing
SET-10 (double accordion)          -- LOW, admin UX (may be intentional)
SET-8  (dead props)                -- LOW, code cleanliness
SET-21 (useState bloat)            -- LOW, extends SET-8
SET-9  (section state resets)      -- LOW, admin convenience
SET-11 (duplicate admin btn)       -- LOW, code duplication
SET-20 (admin loads all prompts)   -- LOW, future scale concern
SET-22 (no deep linking)           -- LOW, UX convenience
SET-23 (destructive confirm)       -- LOW, partially fixed by SET-25 (knowledge toggle remaining)
SET-5  (runtime 404)               -- LOW, missing feature
SET-6  (hydration error)           -- LOW, cosmetic
SET-15b (client-side nav guard)    -- LOW, beforeunload doesn't cover Next.js Link navigation
```
