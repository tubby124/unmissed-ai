# Unmissed Frontend Refactor Runbook

## Purpose

This file is the single source of truth for decomposing the unmissed.ai frontend god-components.

Use it to:
- break 3,044-line SettingsView and other monoliths into maintainable files
- keep the frontend refactor isolated from the backend safe-refactor (Phases 0-8)
- execute one phase at a time with build verification between phases
- produce zero visual changes — pure component extraction

This is **not** a redesign. It is a controlled decomposition of oversized components.

---

## Non-Negotiable Rules

1. Execute **one phase at a time only**
2. Start with **Phase F0 Baseline Audit**
3. **Never** change any file in `app/api/` — API routes are backend territory
4. **Never** change any file in `lib/` unless extracting a pure UI helper FROM a component
5. **Never** change visual output — pixel-identical before and after
6. **Never** change data flow — same API calls, same state management patterns
7. `npm run build` must pass after every phase (TypeScript strict mode catches missed props)
8. Keep diffs narrow and reviewable — one god-component per phase
9. Stop after every phase and summarize:
   - files changed (created, modified, deleted)
   - line count delta (old file lines vs new file lines total)
   - build status
   - exact next phase to run

---

## Branch / Merge Strategy

### Branch

```
refactor/frontend
```

Branched from `main` after backend Phase 4 is complete.

### File Ownership Boundaries

| Track | Owns | Does NOT Touch |
|-------|------|----------------|
| Backend refactor (main) | `lib/*.ts`, `app/api/**/*.ts` | `components/`, `app/dashboard/`, `app/onboard/` |
| Frontend refactor (refactor/frontend) | `components/**/*.tsx`, `app/dashboard/**/*.tsx`, `app/onboard/**/*.tsx` | `lib/*.ts` (except new UI helpers), `app/api/` |

### Merge Rules

1. Backend continues on `main` (Phases 5-8)
2. Frontend lives on `refactor/frontend`
3. After each backend phase completes on main, rebase frontend branch onto main
4. Merge frontend into main ONLY when:
   - All backend phases (5-8) are complete and stable
   - All frontend phases (F0-F4) are complete and stable
   - Both pass `npm run build`
   - Manual smoke test of dashboard settings, setup, onboarding confirms no visual regression

---

## God-Component Inventory

These are the files that justify this refactor:

| File | Lines | Hooks | Primary Problem |
|------|-------|-------|----------------|
| `app/dashboard/settings/SettingsView.tsx` | 3,044 | 92 | 6 tabs + tab router + 20 inline helpers in one file |
| `app/dashboard/setup/SetupView.tsx` | 1,297 | 14 | Full setup wizard in one file |
| `app/onboard/status/page.tsx` | 1,101 | 39 | Activation polling + progress UI in one file |
| `components/dashboard/settings/AgentOverviewCard.tsx` | 927 | 29 | Agent overview sub-card with embedded logic |
| `app/dashboard/lab/LabView.tsx` | 858 | 25 | Test lab controls + results in one file |
| **Total** | **7,227** | **199** | |

### SettingsView Tab Map (lines are approximate)

| Tab | Lines | JSX Location | Notes |
|-----|-------|-------------|-------|
| Shell (state, effects, tab bar) | ~1,008 | 1-1004, 3039-3044 | 92 hooks, most shared across tabs |
| Agent (general) | ~1,375 | 1005-1947 + 2078-2510 | Split across 2 JSX blocks (SMS sandwiched between) |
| SMS | ~127 | 1948-2075 | Small, clean extraction |
| Voice | ~126 | 2513-2639 | Small, clean extraction |
| Notifications (Alerts) | ~212 | 2640-2852 | Medium, self-contained |
| Billing | ~153 | 2855-3008 | Medium, self-contained |
| Knowledge | ~27 | 3011-3038 | Trivial — wraps existing KnowledgeBaseTab |

### Inline Helpers to Extract

Found in SettingsView.tsx, reusable elsewhere:
- `CopyButton` (lines 67-91) — clipboard copy with feedback
- `UrlRow` (lines 93-100) — label + monospace URL + copy button
- `fmtDate` (lines 62-65) — date formatter (move to `lib/settings-utils.ts`)
- `TIMEZONES` constant (lines 30-42) — timezone picker options
- `KNOWN_VOICES` constant (lines 47-52) — voice ID → name map
- `RELOAD_OPTIONS` constant (lines 54-58) — minute reload tiers
- Tab definitions array (lines 954-958) — tab config objects

---

## Phase Execution Prompts

---

### Phase F0 — Baseline Audit (docs only)

```text
I need a complete audit of the frontend god-components before decomposing them.

Read and follow this file strictly:
- docs/unmissed-frontend-refactor-runbook.md

Your job:
1. Create branch `refactor/frontend` from current main
2. Run `npm run build` in agent-app/ — verify green baseline
3. For each of these 5 files, document:
   - All useState hooks (name, type, initial value)
   - All useEffect hooks (dependencies, what they do)
   - All useCallback/useRef/useMemo hooks
   - All fetch() calls (method, URL, what triggers them)
   - All child components rendered
   - All props received from parent
   - All inline helper functions/components
   - All inline constants
4. Write `docs/frontend-refactor/baseline-component-audit.md`
5. Write `docs/frontend-refactor/decomposition-targets.md` with:
   - For each god-component: proposed new files and what moves into each
   - State ownership: which state stays in parent, which moves to child
   - Props interface for each new child component
6. Commit docs to the `refactor/frontend` branch

Files to audit:
- agent-app/src/app/dashboard/settings/SettingsView.tsx (3,044 lines)
- agent-app/src/app/dashboard/setup/SetupView.tsx (1,297 lines)
- agent-app/src/app/onboard/status/page.tsx (1,101 lines)
- agent-app/src/components/dashboard/settings/AgentOverviewCard.tsx (927 lines)
- agent-app/src/app/dashboard/lab/LabView.tsx (858 lines)

Important:
- Do NOT change any code — documentation only
- Do NOT touch any file in lib/ or app/api/
- Stop after completing F0 and summarize:
  1. files created
  2. build status
  3. exact next phase to run
```

---

### Phase F1 — SettingsView Decomposition

```text
I want to decompose SettingsView.tsx (3,044 lines) into separate tab components.

Read and follow this file strictly:
- docs/unmissed-frontend-refactor-runbook.md
- docs/frontend-refactor/decomposition-targets.md (from Phase F0)

Your job:
1. Create these new files under components/dashboard/settings/:
   - AgentTab.tsx — the "general" tab content (lines 1005-1947 + 2078-2510)
   - SmsTab.tsx — SMS settings (lines 1948-2075)
   - VoiceTab.tsx — voice browser + preview (lines 2513-2639)
   - AlertsTab.tsx — Telegram + notification config (lines 2640-2852)
   - BillingTab.tsx — usage, reload, subscription (lines 2855-3008)
2. Extract shared inline helpers to components/dashboard/settings/shared.tsx:
   - CopyButton, UrlRow
3. Extract constants to components/dashboard/settings/constants.ts:
   - TIMEZONES, KNOWN_VOICES, RELOAD_OPTIONS, tab definitions
4. Reduce SettingsView.tsx to a thin shell:
   - Keep all useState/useEffect that are shared across tabs
   - Tab bar rendering
   - AnimatePresence wrapper
   - Import and render the 5 tab components + existing KnowledgeBaseTab
   - Target: ~200-300 lines
5. Each tab component receives props for the state it needs
6. Run `npm run build` — must pass with zero errors
7. Visually verify: open /dashboard/settings in dev — must look identical

Important:
- Do NOT change any API call URLs or request shapes
- Do NOT change any visual styling or layout
- Do NOT add new features or change behavior
- If a useState is used by only one tab, move it INTO that tab component
- If a useState is used by multiple tabs, keep it in the parent shell and pass as props
- Stop after completing F1 and summarize:
  1. files changed
  2. line count: old SettingsView lines vs new total lines across all files
  3. build status
  4. exact next phase to run
```

---

### Phase F2 — SetupView + Onboard Status

```text
I want to decompose SetupView.tsx (1,297 lines) and onboard/status/page.tsx (1,101 lines).

Read and follow this file strictly:
- docs/unmissed-frontend-refactor-runbook.md
- docs/frontend-refactor/decomposition-targets.md (from Phase F0)

Your job:
1. SetupView.tsx — extract logical sections into sub-components:
   - Identify the major sections (carrier forwarding, call forwarding cards, status cards, etc.)
   - Create files under components/dashboard/setup/
   - Reduce SetupView to a composition shell
2. onboard/status/page.tsx — extract sub-components:
   - Identify polling logic, progress indicators, status cards
   - Create files under components/onboard/
   - Keep polling logic in the parent page, extract rendering into children
3. Run `npm run build` — must pass
4. Visually verify both pages look identical

Important:
- Do NOT change polling intervals, API calls, or data flow
- Do NOT change onboarding behavior or step sequencing
- Keep changes to these two files only — do not touch SettingsView (already done in F1)
- Stop after completing F2 and summarize:
  1. files changed
  2. line count delta
  3. build status
  4. exact next phase to run
```

---

### Phase F3 — AgentOverviewCard + LabView

```text
I want to decompose AgentOverviewCard.tsx (927 lines) and LabView.tsx (858 lines).

Read and follow this file strictly:
- docs/unmissed-frontend-refactor-runbook.md
- docs/frontend-refactor/decomposition-targets.md (from Phase F0)

Your job:
1. AgentOverviewCard.tsx — break into logical sub-cards:
   - Identify sections (voice picker, persona config, status indicators, etc.)
   - Create files under components/dashboard/settings/
   - Reduce AgentOverviewCard to a composition of sub-cards
2. LabView.tsx — break into panels:
   - Test scenario selector
   - Test results viewer
   - Call trigger controls
   - Create files under components/dashboard/lab/
3. Run `npm run build` — must pass
4. Visually verify both views look identical

Important:
- AgentOverviewCard is imported by SettingsView (now the AgentTab after F1) — ensure imports still work
- Do NOT change any test execution logic in LabView
- Stop after completing F3 and summarize:
  1. files changed
  2. line count delta
  3. build status
  4. exact next phase to run
```

---

### Phase F4 — Shared Primitives + Cleanup

```text
I want to extract remaining shared primitives and clean up imports.

Read and follow this file strictly:
- docs/unmissed-frontend-refactor-runbook.md

Your job:
1. Audit all components created in F1-F3 for duplicated patterns:
   - Loading states / skeleton patterns
   - Section header patterns
   - Status badge patterns
   - Motion wrapper patterns
2. Extract genuinely reusable primitives to components/ui/ or components/shared/
   - Only extract if used in 3+ places — do not over-abstract
3. Clean up import paths:
   - Ensure no circular dependencies
   - Add barrel exports (index.ts) ONLY where it reduces import noise meaningfully
4. Run final `npm run build` — must pass
5. Run `git diff --stat refactor/frontend...HEAD` — review total file count and line changes
6. Visually verify all affected pages:
   - /dashboard/settings (all 6 tabs)
   - /dashboard/setup
   - /onboard/status
   - /dashboard/lab

Important:
- This is cleanup only — no new features, no behavior changes
- Do NOT create abstractions for one-time patterns
- Prefer 3 similar lines over a premature abstraction
- Stop after completing F4 and summarize:
  1. files changed
  2. total line count: before vs after (across all modified files)
  3. build status
  4. ready to merge status
```

---

## Ship / No-Ship Gate

Do not ship a phase if:

- `npm run build` fails
- TypeScript reports any errors
- Visual output differs from before the phase (layout, spacing, colors, content)
- An API call is added, removed, or changed
- A file in `lib/` or `app/api/` was modified (except adding pure UI helper to lib/settings-utils.ts)
- Props are dropped (data that was previously rendered is now missing)
- State management pattern changed (e.g., useState replaced with Context without explicit approval)

---

## Frontend Refactor Checklist

### Phase Progress

* [ ] Phase F0 — Baseline audit (docs only)
* [ ] Phase F1 — SettingsView decomposition
* [ ] Phase F2 — SetupView + onboard/status decomposition
* [ ] Phase F3 — AgentOverviewCard + LabView decomposition
* [ ] Phase F4 — Shared primitives + cleanup

### Safety

* [ ] `refactor/frontend` branch created from main
* [ ] Build passes on branch before any changes
* [ ] Build passes after every phase
* [ ] No files in `lib/` modified (except settings-utils.ts if needed)
* [ ] No files in `app/api/` modified
* [ ] No visual regressions

### Merge Readiness

* [ ] All 5 phases complete
* [ ] Backend Phases 5-8 complete on main
* [ ] Rebase onto latest main — no conflicts
* [ ] Final `npm run build` passes
* [ ] Visual smoke test of all affected pages
* [ ] Ready to merge

---

## First Command to Run in Claude Code

Paste this into a **separate Claude Code session**:

```text
Read and follow `docs/unmissed-frontend-refactor-runbook.md` strictly.

Rules:
- execute one phase at a time
- start with Phase F0 Baseline Audit
- this is a DOCS-ONLY phase — no code changes
- work on the `refactor/frontend` branch
- stop after completing F0 and summarize:
  1. files created
  2. build status
  3. exact next phase to run

Begin now with Phase F0 Baseline Audit.
```

---

## Final Reminder

This refactor produces **zero behavior change** and **zero visual change**.

If a decomposition requires changing how data flows, stop and reconsider. The goal is to move JSX and local state into separate files, not to redesign the architecture.

The backend safe-refactor (Phases 0-8) and this frontend refactor are **independent tracks**. Do not mix them. Do not merge one until the other is also stable.
