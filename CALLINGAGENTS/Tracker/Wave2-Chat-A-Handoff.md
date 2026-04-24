---
type: handoff
status: ready-to-execute
priority: P0
tags: [wave2, phase6, dashboard, overview, handoff]
created: 2026-04-24
owner: Hasan
branch: ship/wave2-overview-surface
pr: none-yet
covers: [D308, D341, D288, D290, D266, D306]
blocks: [D286 goes in separate Chat B]
---

# Wave 2 Chat A — Overview Surface Handoff

> **Fresh-chat prompt:**
> *"Read `CALLINGAGENTS/Tracker/Wave2-Chat-A-Handoff.md` and execute Chat A top-to-bottom. I've pre-approved every decision in this doc. Ship one PR on branch `ship/wave2-overview-surface`. Update the vault when done."*

---

## Context (read first)

- Sprint: [[Project/SPRINT-ROADMAP-2026-04-23]] Wave 2
- Design matrix: [[Architecture/Phase6-Wave2-Dashboard-Matrix]]
- Wave 1 just closed as drift-fix (no code, tracker-only)
- Wave 0 (D292) sits in PR #12, unmerged — **do not touch that branch**
- This branch (`ship/wave2-overview-surface`) is cut from `origin/main`, independent of PR #12

## Pre-approved decisions (no questions to ask user)

1. **D308:** Keep nav label "Overview". Tracker close only.
2. **D341 placement:** Edit surface lives in Settings > Agent tab (existing `PromptVariablesCard.tsx`). Overview gets a NEW read-only preview card (`AgentRoutesOnCard.tsx`). Label deep-links to Settings.
3. **D290 gaps:** Single unified surface. "Gaps (N)" is an inline collapsed section inside the same card, hidden entirely when N=0.
4. **D266 parity:** Extract `useCallLog(clientId, limit)` hook + share existing `CallRow` / `CallRowExpanded` components. Overview and `/dashboard/calls` consume the same hook.
5. **Scope:** All 6 items in ONE PR. D286 (Settings reorg) goes in a separate Chat B afterwards.

## Scope — 6 D-items in this PR

| # | D-item | Summary |
|---|--------|---------|
| 1 | D308 | Lock "Overview" label. Tracker close. |
| 2 | D266 plumbing | Extract `useCallLog(clientId, limit)` hook + reuse existing `CallRow` on Overview. |
| 3 | D290 | New `AgentKnowsCard.tsx` — unify Facts / FAQ / Services / KB chunks / inline-collapsed Gaps (N). |
| 4 | D288 | Reframe `CapabilitiesCard.tsx` copy to "What your agent can do right now" + deep-link inactive capabilities. |
| 5 | D341 | New `AgentRoutesOnCard.tsx` — read-only preview of GREETING_LINE / URGENCY_KEYWORDS / FORBIDDEN_EXTRA / CLOSE_PERSON from `clients.niche_custom_variables`. Deep-link "Edit in Settings →". |
| 6 | D306 | Empty-state sweep on every tile using formula below. |

## Final layout — `/dashboard` top-to-bottom

```
Banners (activation / trial / minutes / sync)   [full width, conditional]

HERO 3-col:
  Capabilities [D288]  │  Orb + Test Call  │  Today's Update + Stats

"How Your Agent Sounds"                         [full width bar]

"What Your Agent Knows" [D290]                  [full width card]
  Facts · FAQ · Services · KB · ⚠ Gaps (N) expand

"What Your Agent Routes On" [D341]              [full width card]
  Opening line · Urgency triggers · Safety rules · Close person
  [Edit in Settings →]   read-only

Call Log [D266]                                 [full width]
  [All | HOT | WARM | MISSED]  shared CallRow, inline expand

Lower 2-col:
  Call Routing + Bookings  │  Plan + Notifications
```

## Empty-state formula (D306)

```
[icon]  [what this will show when populated]
        [specific action CTA →]
```

Never show empty state AND real data — binary switch. Never show "0 calls" — show empty-state message instead. Applied to every Overview tile.

## Design rules (locked)

- **Style:** keep existing Dark Professional / Midnight SaaS / Inter. No palette or font changes.
- **Density:** `p-5` desktop / `p-4` mobile card padding. `gap-4` inside cards, `gap-6` between bands. `max-w-7xl` consistent.
- **Inline expand:** use existing `motion/react` AnimatePresence pattern from `CallRowExpanded.tsx`. 180ms ease-out. Don't add shadcn Accordion.
- **Accessibility:** `aria-expanded` / `aria-controls` on every expand toggle. Filter pills `role="tablist"` + `role="tab"` + `aria-pressed`. 44×44 min touch targets. Focus ring `outline outline-2 outline-offset-2 outline-blue-500/60`.
- **No new shadcn deps.** Everything reuses: `card.tsx`, `badge.tsx`, `progress.tsx`, `button.tsx`, existing `StatusBadge` conventions.

## Execution steps (in order)

### 1. D308 — tracker close (no code)
- Branch is already cut: `ship/wave2-overview-surface`
- Update [[Tracker/D308]] status → `done` with note: "Kept label 'Overview' per decision. Closed 2026-04-24."
- Single docs commit: `docs(tracker): close D308 — keep Overview label`

### 2. D266 plumbing — shared hook
- **New file:** `src/hooks/useCallLog.ts` — `(clientId: string, limit?: number) => { calls, loading, error, refetch }`
- Source existing query logic from wherever `/dashboard/calls` reads calls today (grep `call_logs` + `order by started_at`).
- Replace Overview's current call-log code path to consume this hook with `limit={5}`.
- Keep `/dashboard/calls` list using same hook, no limit.
- Verify both surfaces render identical rows via existing `CallRow` / `CallRowExpanded`.

### 3. D290 — `AgentKnowsCard.tsx`
- **New file:** `src/components/dashboard/home/AgentKnowsCard.tsx`
- Reads: `business_facts`, `extra_qa`, `client_services`, `knowledge_chunks` count, `knowledge_query_log` rows where unresolved.
- API: existing `GET /api/dashboard/settings` + existing `GET /api/dashboard/knowledge/gaps` (or inline select if no route).
- Shows: Facts (N) · FAQ (N) · Services (N) · KB (N chunks). Inline collapsed "⚠ Gaps (N)" section, HIDDEN when N=0. Click to expand.
- Deep link: "View knowledge →" → `/dashboard/knowledge`.
- Replaces existing `AgentKnowledgeTile.tsx` + `KnowledgeInlineTile.tsx` + `KnowledgeSourcesTile.tsx` on Overview (keep files for now, orphan check at end).

### 4. D288 — reframe capabilities
- Edit existing `src/components/dashboard/CapabilitiesCard.tsx`.
- Reword to "What your agent can do right now" with 4-6 plain-english lines.
- Each line: active (green badge) or inactive (amber badge + "Set up →" deep link to Settings card).
- Source: `buildCapabilityFlags()` (already exists in `src/lib/capability-flags.ts`).
- Keep existing card chrome; just copy + deep-link work.

### 5. D341 — `AgentRoutesOnCard.tsx`
- **New file:** `src/components/dashboard/home/AgentRoutesOnCard.tsx`
- Read-only. Reads `clients.niche_custom_variables` via `GET /api/dashboard/settings`.
- Four rows, each a deep link to Settings > Agent tab with anchor:
  - Opening line (`GREETING_LINE`) → `/dashboard/settings#greeting`
  - Urgency triggers (`URGENCY_KEYWORDS`) → chips → `#urgency`
  - Safety rules (`FORBIDDEN_EXTRA`) → `#safety`
  - Close person (`CLOSE_PERSON`) → `#close-person`
- Header button: `Edit in Settings →`
- `text-zinc-300` + `hover:text-white` on labels. No save path.

### 6. D306 — empty-state sweep
Apply formula to every Overview tile. Binary switch — never show empty state + real data together.

| Tile | Empty copy | CTA |
|------|-----------|-----|
| CapabilitiesCard | "Your agent can start answering calls once you forward your number." | Forward my number → |
| AgentKnowsCard | "Add your website or business facts so your agent can answer questions." | Connect website → |
| AgentRoutesOnCard | "Your agent's routing rules will show here after onboarding." | Complete setup → (only if onboarding < 100%) |
| Call Log (D266) | "No calls yet. Test your agent with the orb above, or forward your number to go live." | Test my agent → |
| BookingCalendarTile | "Connect Google Calendar and your agent can book appointments." | Connect calendar → |

### 7. Layout rewire — `ClientHome.tsx`
- Edit `src/components/dashboard/ClientHome.tsx` to the band order above.
- Remove (don't delete files yet) `AgentKnowledgeTile` + `KnowledgeInlineTile` + `KnowledgeSourcesTile` from Overview render path.
- Insert `AgentKnowsCard` and `AgentRoutesOnCard` in correct bands.
- Keep 3-col hero untouched.

### 8. Pre-ship verification
Run all BEFORE committing the main code:

```bash
# Orphan check on every new component
grep -rn "import.*AgentKnowsCard" src/
grep -rn "import.*AgentRoutesOnCard" src/
grep -rn "import.*useCallLog" src/

# TS clean
npx tsc --noEmit

# Build
npm run build

# Test suite
npm run test:all

# Manual keyboard nav check
npm run dev
# Tab through Overview: hero left→right, bands top→bottom. Every expand toggles on Enter/Space.
```

### 9. Orphan cleanup decision
If `AgentKnowledgeTile` / `KnowledgeInlineTile` / `KnowledgeSourcesTile` have ZERO imports after step 7, delete them in the same PR. If still imported elsewhere, leave them and note in PR description.

### 10. Commits (narrow, reviewable)
```
1. docs(tracker): close D308 — keep Overview label
2. feat(dashboard): D266 extract useCallLog hook, share CallRow between Overview and Calls page
3. feat(dashboard): D290 AgentKnowsCard — unified facts/FAQ/services/KB/gaps surface
4. feat(dashboard): D288 reframe capabilities as "what your agent can do right now"
5. feat(dashboard): D341 AgentRoutesOnCard — read-only variable preview on Overview
6. feat(dashboard): D306 empty-state sweep across Overview tiles
7. refactor(dashboard): rewire ClientHome band order for Wave 2
8. chore: remove orphaned AgentKnowledge / KnowledgeInline / KnowledgeSources tiles  (if applicable)
```

### 11. PR open
```bash
gh pr create --title "Wave 2: Overview surface completion (D266 D288 D290 D306 D308 D341)" --body "$(cat <<'EOF'
## Summary
Wave 2 Chat A — Phase 6 Wave 2 Overview surface, 6 D-items in one PR.

- D308: Kept Overview label (tracker close)
- D266: Shared useCallLog hook + CallRow between Overview and Calls page
- D290: New AgentKnowsCard unifies Facts / FAQ / Services / KB / Gaps on Overview
- D288: CapabilitiesCard reframed to "What your agent can do right now"
- D341: New AgentRoutesOnCard shows read-only variable preview on Overview, edit stays in Settings
- D306: Empty-state copy sweep across all Overview tiles

Design review: `/ui-ux-pro-max` gate done (no new shadcn deps, Inter/Midnight SaaS confirmed).
Handoff doc: `CALLINGAGENTS/Tracker/Wave2-Chat-A-Handoff.md`

## Test plan
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run build` green
- [ ] `npm run test:all` passes
- [ ] Manual: tab order matches visual order on `/dashboard`
- [ ] Manual: every expand toggle works on Enter/Space
- [ ] Manual: trial account empty states render correctly
- [ ] Manual: paid account shows real data, no empty states
- [ ] Manual: Gaps section hidden when knowledge_query_log is empty
- [ ] Orphan check: 3 legacy knowledge tiles either deleted or still legitimately imported

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

## Gate checks (must pass before marking Wave 2 Chat A done)

- [ ] All 6 D-item tracker files flipped to `status: done` with date + PR link
- [ ] `[[Project/SPRINT-ROADMAP-2026-04-23]]` Wave 2 row updated to 🟡 or ✅
- [ ] `[[Project/Index.md]]` session note added
- [ ] `.claude/rules/refactor-phase-tracker.md` — update D308/D341/D288/D290/D266/D306 rows
- [ ] PR opened, URL pasted back to Hasan
- [ ] Do NOT merge — Hasan merges manually

## Vault update checklist (do after PR is opened)

1. **Update D-item trackers** (each file in `CALLINGAGENTS/Tracker/`):
   - D308.md → status: done, note "Overview label kept"
   - D288.md → status: done, note component + PR
   - D290.md → status: done, note component + PR
   - D306.md → status: done, note formula applied
   - D341.md → status: done, note component + PR
   - (D266 has no tracker file — skip)

2. **Update `SPRINT-ROADMAP-2026-04-23.md`**:
   - Wave 2 section: ⬜ → 🟡 (if PR open) or ✅ (if merged)
   - Wave status log row: update started date

3. **Update `Project/Index.md`**:
   - Add "Latest Session (2026-04-24 — Wave 2 Chat A)" block
   - Move D308/D288/D290/D341/D306 out of the "Dashboard UX Polish" table

4. **Create decision note** (optional, if D341 placement debate worth preserving):
   - `CALLINGAGENTS/Decisions/D341-Variable-Edit-Placement.md` — "Edit lives in Settings, Overview is read-only preview. Reason: avoid duplicate edit surfaces, but increase discoverability via preview."

5. **Commit vault updates** as separate docs-only commit:
   ```
   docs(vault): close Wave 2 Chat A items, update index + trackers
   ```

## Standing rules (from project)

- No redeploy to hasan-sharif, exp-realty, windshield-hub, urban-vibe
- Keep diffs narrow, one concern per commit
- Never bundle unrelated fixes
- Every prompt-affecting change tested on BOTH voicemail AND slot-pipeline client (N/A here — D341 edit is out of scope)
- Do NOT edit `CLAUDE.md`, `.mcp.json`, `settings.json` during the session

## Stop conditions — write checkpoint instead of pushing through

- Build breaks and root cause is unclear after 15 min
- TS errors cross 10+ files
- `useCallLog` extraction reveals unexpected duplication of query logic in 3+ places
- Trial user render path is fundamentally different from paid (shouldn't be — per decision, one layout)

If any stop condition hits: write `CALLINGAGENTS/Tracker/Wave2-Chat-A-Checkpoint.md` with done/in-progress/blocked, commit WIP, stop the chat.

## After Wave 2 Chat A merges

Next chat → **Wave 2 Chat B** — D286 Settings reorg, separate PR, highest regression risk. New handoff doc when Chat A is green.
