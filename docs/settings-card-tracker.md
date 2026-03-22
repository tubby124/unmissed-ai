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

### SET-1: Voice Style filler contradiction (MEDIUM-HIGH)

**Problem:** `patchVoiceStyleSection()` only replaces the TONE & STYLE / VOICE STYLE section. But filler instructions (backchannels, "uh"/"um" usage) also live in other parts of hand-crafted prompts. Switching presets creates contradictory instructions.

**Example (demo-auto-glass after switching to professional_warm):**
- Top of prompt: `Start every response with a quick backchannel: "mmhmm...", "gotcha..."` + `Use "uh" or "um" once or twice per call`
- TONE section: `No filler words like "uh", "um", "mmhmm", and casual fillers entirely.`

**Scope:** All 5 clients have patchable headers (CAN PATCH). Currently safe because all real clients are on `casual_friendly` which matches their hand-crafted fillers. Bug triggers when anyone switches presets.

**DB evidence:**
```
demo-auto-glass: has_casual_fillers=true, has_no_fillers_rule=true  -- CONTRADICTION
hasan-sharif:    has_casual_fillers=true, has_no_fillers_rule=false -- OK (casual)
windshield-hub:  has_casual_fillers=false, has_no_fillers_rule=true -- OK (consistent)
urban-vibe:      has_casual_fillers=true, has_no_fillers_rule=false -- OK (casual)
exp-realty:      has_casual_fillers=false, has_no_fillers_rule=true -- OK (consistent)
```

**Fix options:**
- A) `patchVoiceStyleSection()` also patches the filler block above the tone section (regex for the "Start every response..." / backchannel block)
- B) Move all filler instructions INTO the TONE section during prompt generation, so one patch covers everything
- C) Flag a warning in the UI when switching styles: "This will update your tone section. Other filler instructions in your prompt may need manual editing."

**Files:** `src/lib/prompt-patcher.ts`, `src/lib/prompt-builder.ts`

---

### SET-2: Voice Style preset not shown on page load (LOW-MEDIUM)

**Problem:** When the settings page loads, no preset button has `[active]` state. The DB has `voice_style_preset = 'professional_warm'` but the VoiceStyleCard doesn't read this initial value to highlight the correct preset.

**Evidence:** Playwright snapshot on page load shows all 4 preset buttons without `[active]`. Only after clicking does the active state appear.

**User impact:** Client can't see which voice style is currently active. They might re-save the same preset thinking nothing is set, or accidentally switch without knowing what the current one is.

**Fix:** Pass `initialPreset` from the DB row to VoiceStyleCard. Initialize local state from it. Highlight the matching preset button on mount.

**Files:** `src/components/dashboard/settings/VoiceStyleCard.tsx`, `src/components/dashboard/settings/AgentTab.tsx`

---

### SET-3: Prompt char count stale after prompt-modifying saves (LOW)

**Problem:** The agent capabilities section shows "3,453 / 12,000" chars. After Voice Style or SectionEditor saves modify `system_prompt`, the count doesn't update until full page reload.

**User impact:** Client could unknowingly push past the 12K limit without seeing the count change. Related to tracked item D15 (validatePrompt not called on style/calendar patches — NOW FIXED).

**Fix:** After any save that returns a modified `system_prompt`, update the char count in the parent AgentTab state. Or return `new_char_count` from the API response and propagate.

**Files:** `src/components/dashboard/settings/AgentTab.tsx`, `src/app/api/dashboard/settings/route.ts`

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

### SET-7: SectionEditorCard save doesn't update parent prompt state (MEDIUM)

**Problem:** SectionEditorCard modifies `system_prompt` server-side via `replacePromptSection()`, but the parent AgentTab `prompt` state is never updated. After a section save, PromptEditorCard still shows the OLD prompt text. If admin then opens the prompt editor and saves, they overwrite the section edit with the stale version.

**Scope:** Only affects admin users who use both SectionEditorCard and PromptEditorCard in the same session without refreshing.

**Fix:** SectionEditorCard needs an `onPromptChange` callback prop. After successful save, API should return `new_system_prompt` in the response body. SectionEditorCard calls `onPromptChange(newPrompt)` which flows up to AgentTab's `setPrompt`. Also fixes SET-3 (stale char count).

**Files:** `SectionEditorCard.tsx`, `AgentTab.tsx`, `settings/route.ts`

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

## Priority Order

```
SET-1 (filler contradiction)   -- MEDIUM-HIGH, affects call quality on preset switch
SET-7 (stale parent prompt)    -- MEDIUM, admin prompt overwrite risk after section edit
SET-2 (preset not shown)       -- LOW-MEDIUM, UX confusion
SET-4 (duplicate sections)     -- LOW-MEDIUM, data integrity
SET-3 (stale char count)       -- LOW, cosmetic (fixed by SET-7)
SET-10 (double accordion)      -- LOW, admin UX friction (may be intentional)
SET-8 (dead props)             -- LOW, code cleanliness
SET-9 (section state resets)   -- LOW, admin convenience
SET-11 (duplicate admin btn)   -- LOW, code duplication
SET-5 (runtime 404)            -- LOW, missing feature
SET-6 (hydration error)        -- LOW, cosmetic
```
