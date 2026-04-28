---
type: dashboard-audit
status: promoted-to-dashboard
tags: [v2, dashboard, modals, ship-test-pass, promoted]
related: [[Architecture/Dashboard-Hardening-Plan]], [[Decisions/Overview-5-Tier-Layout]], [[Tracker/D286]]
updated: 2026-04-28
shipped_commit: b6274bd
---

# v2 Dashboard — Modal Migration Audit

Mockup-faithful rebuild at `/dashboard/v2` (touches v2 only — v1 untouched). All edits surface as centered inline modals instead of the right-edge `HomeSideSheet` drawer.

Plan source: `/Users/owner/.claude/plans/users-owner-downloads-calling-20agents-validated-origami.md`

## Files shipped (this session)

**New:**
- [src/hooks/useInlineEdit.ts](src/hooks/useInlineEdit.ts) — modal state hook with dirty-discard confirm
- [src/components/dashboard/home/InlineEditModal.tsx](src/components/dashboard/home/InlineEditModal.tsx) — centered overlay primitive (480px / 92vw / 85vh, backdrop blur, Esc + click close, focus trap, body scroll lock) + shared `ModalActions` + `Field` helpers
- [src/components/dashboard/home/InlineModalsV2.tsx](src/components/dashboard/home/InlineModalsV2.tsx) — content router for 19 modals
- [src/components/dashboard/home/V2CallList.tsx](src/components/dashboard/home/V2CallList.tsx) — slim recent-calls list (badge + phone/snippet + meta time)

**Edited:**
- [src/components/dashboard/home/AgentIdentityCardCompact.tsx](src/components/dashboard/home/AgentIdentityCardCompact.tsx) — sheet prop → openModal callback. Avatar/name → callback modal; voice subtitle → voice modal. Added "Synced X ago" badge.
- [src/components/dashboard/home/UnifiedHomeSectionV2.tsx](src/components/dashboard/home/UnifiedHomeSectionV2.tsx) — readiness rows → modals; 2-col grid (readiness | recent calls); InlineModalsV2 mounted; OverviewCallLog removed; "Browse all voices →" footer link removed; "Option 1 — Collapse" staging banner removed.
- [src/components/dashboard/dashboardNav.ts](src/components/dashboard/dashboardNav.ts) — Voices: group 3 → group 1.
- [src/components/dashboard/TabBar.tsx](src/components/dashboard/TabBar.tsx) — Voices added to visible top tab bar between Calls & Leads and Billing.

## Chip → modal map

| Chip | Modal | Save target | Sync? |
|------|-------|-------------|-------|
| Avatar | callback | `/api/dashboard/variables` (CLOSE_PERSON, CALLBACK_PHONE) | YES (variables route auto-syncs prompt) |
| Name | callback | same | YES |
| Voice subtitle | voice | `/api/dashboard/settings { agent_voice_id }` | YES (in needsAgentSync) |
| Greeting | greeting | `/api/dashboard/variables { GREETING_LINE }` | YES |
| SMS | aftercall | `/api/dashboard/settings { sms_enabled, sms_template }` | YES (sms_enabled in needsAgentSync); sms_template untested |
| Telegram | telegram | `POST /api/dashboard/telegram-link` then opens deep link | OOB (Telegram bot consumes token) |
| IVR | ivr | `/api/dashboard/settings { ivr_enabled, ivr_prompt }` | NO (DB_ONLY — read at call time by inbound webhook) |
| Voicemail | voicemail | `/api/dashboard/settings { voicemail_greeting_text }` | NO (DB_ONLY) |
| Booking | calendar | `<a href="/api/auth/google">` (OAuth start) | OAuth redirect |
| Transfer | transfer | `/api/dashboard/settings { forwarding_number }` | YES |
| Website | knowledge | (read-only — link to /dashboard/knowledge) | N/A |
| GBP | gbp | (read-only — shows current data) | N/A |
| Today | today | `/api/dashboard/settings { injected_note }` | NO (PER_CALL_CONTEXT_ONLY) |

## Readiness band → modal map

Hours → hours · Services → services (read-only, links to /dashboard/knowledge) · FAQs → faqs · Booking → calendar · Knowledge → knowledge · Gaps → gaps (inline answer with PATCH `extra_qa`).

## In-flight fixes after first browser shit-test (2026-04-27 PM)

1. **Telegram modal "clientId required" toast** — endpoint expected `clientId` (camelCase), modal sent admin-conditional `client_id`. Fixed: always send `clientId`, read `deepLink` not `url`. ✅
2. **Calendar modal routed to /dashboard/calendar** — user wanted to actually connect. Fixed: now `<a href="/api/auth/google">` (OAuth start). ✅
3. **Gaps modal said "→ Open Knowledge to answer"** — user wanted inline. Rewrote: each gap row expands → write answer → `PATCH /api/dashboard/settings { extra_qa: [...prev, {q, a}] }` → toast "Promoted to FAQ — agent will use this answer next time". ✅
4. **"Option 1 — Collapse" staging meta-block removed.** ✅

## VERIFIED working (manual click-through)

- Greeting modal opens, pre-fills GREETING_LINE from /api/dashboard/variables, shows "Synced X ago"
- Voice modal lists voices, ▶ Play uses `/api/dashboard/voices/[id]/preview` proxy
- Booking row → Calendar modal (no more 404 to /dashboard/actions)
- Recent call row → Call detail modal with summary + classification + "View full transcript →"
- IVR modal renders form correctly
- Transfer modal renders form correctly
- Voices visible in top tab bar
- npx tsc --noEmit clean

## Ship-test results — 2026-04-28 (re-run after promote-fix patches)

Spec: `tests/v2-modal-shiptest.spec.ts` (Playwright, drives every modal via UI on `e2e-test-plumbing-co`, asserts via Supabase service-role queries, reverts each value in `finally`).
Full matrix: `tests/v2-shiptest-results-2026-04-28.md`.

| Button | DB | Prompt | Ultravox sync | Verdict |
|--------|----|----|----|----|
| Greeting save | ✅ | ✅ | ✅ | **PASS** — generalized variables-route sync block fires on any `regenerateSlots(promptChanged=true)`. |
| Callback (CLOSE_PERSON) save | ✅ | ✅ | ✅ | **PASS** — single-word constraint enforced in `CallbackModal` (matches `owner_name.split(' ')[0]` resolver); safety-net block now writes `last_agent_sync_at`. |
| Voice select | ✅ | N/A | ✅ | **PASS** |
| SMS template save | ✅ | N/A | ✅ | **PASS** — `sms_enabled` checkbox correctly disabled (no `twilio_number`). |
| Hours save | ✅ | N/A (PER_CALL_CONTEXT_ONLY) | unexpected `synced=true` | **PASS** with note — over-eager `needsAgentSync`, harmless. |
| Today's update save | ✅ | N/A | N/A | **PASS** |
| IVR enable | ✅ | N/A (DB_ONLY) | N/A | **PASS** |
| Voicemail text save | ✅ | N/A (DB_ONLY) | N/A | **PASS** |
| Forwarding number save | ✅ | N/A | ✅ — `transferCall` registered | **PASS** |
| Telegram link → token | N/A on test client | — | OOB | **SKIP** — test client token already consumed. Test-data setup, not code. |
| Gaps → Promote to FAQ | — | — | — | **SKIP** — `knowledge_query_log` has no unresolved entries. Test-data setup, not code. |

**Tally:** 9 PASS · 0 FAIL · 2 SKIP · 0 unverified.

## Anomalies — RESOLVED in commit b6274bd (2026-04-28)

### A — Greeting variable does not re-sync the live agent → FIXED

Code: [src/app/api/dashboard/variables/route.ts](src/app/api/dashboard/variables/route.ts)
Added a generalized sync block (5c) after the NAME_FIELDS safety-net (5b): when `regenerateSlots()` returns `promptChanged: true` and the safety-net didn't fire, fetch latest client row, call `updateAgent()`, rebuild `clients.tools`, and write `last_agent_sync_at` metadata. Both blocks now bump sync metadata so AgentSyncBadge and drift-detector see edits land.

### B — CLOSE_PERSON truncates to first whitespace token → INTENTIONAL, validation added

Confirmed at [src/lib/prompt-slots.ts:1101](src/lib/prompt-slots.ts#L1101) — `variables.CLOSE_PERSON = ownerNameGlobal.split(' ')[0]`. Single-word is by design (the slot template renders `${closePerson} will call ya back`). Fix applied in [src/components/dashboard/home/InlineModalsV2.tsx](src/components/dashboard/home/InlineModalsV2.tsx) `CallbackModal`: trim multi-word input to first token before sending, surface inline warning when user types a space, hint clarifies first-name-only. Test #9 updated to send a single-word value to match the contract.

### C — `HomeSideSheet` (v1 drawer) double-mount → REMOVED from v2

[src/components/dashboard/ClientHomeV2.tsx](src/components/dashboard/ClientHomeV2.tsx) — `<HomeSideSheet>` JSX deleted, `useHomeSheet` hook removed.
[src/components/dashboard/home/UnifiedHomeSectionV2.tsx](src/components/dashboard/home/UnifiedHomeSectionV2.tsx) — `sheet` prop dropped from interface; forwarding rewired to `inlineEdit.openModal('transfer')`; billing card converted to a `Link` to `/dashboard/billing`.

### D — Test client old-format prompt blocked regen → MIGRATED

`e2e-test-plumbing-co` had an old-format `system_prompt` (no `<!-- unmissed:* -->` markers) so `regenerateSlots()` returned `success: false` with the legacy-format guard. One-shot migration via [scripts/migrate-test-client-prompt.ts](scripts/migrate-test-client-prompt.ts) — runs `buildPromptFromSlots(ctx)`, writes back to DB, syncs Ultravox. Live clients (Calgary, Hasan, Windshield Hub, Urban Vibe) untouched per no-redeploy rule; they remain on D304-deferred legacy format.

## Promoted (commit b6274bd, 2026-04-28)

[src/app/dashboard/page.tsx](src/app/dashboard/page.tsx) now renders `<ClientHomeV2 />` for both non-admin and admin-preview paths. `/dashboard/v2` staging route remains available as a parallel mount for future testing. Build clean (`npm run build` green); Railway auto-deploy triggered.

## Open questions Hasan flagged

1. **Live call transfer** — "does it actually do that?" — has never been tested on Calgary Property Leasing. Need a real PSTN transfer attempt.
2. **Website chip says "Open Knowledge to browse, edit chunks"** — confusing. Plain users won't know what 23 chunks means. Redesign: rename to show "what your agent knows about your business" in plain English (facts + FAQs), not pgvector chunks.
3. **Voice picker as a chip** — discoverability bad. Hasan vote: kill in-chip picker; chip becomes read-only badge with "Change →" link to /dashboard/voices (now in top nav). Worth doing.
4. **IVR pre-filter** — "if I actually set it up, would it actually work properly?" — need test call. Inbound webhook does honor `ivr_enabled` (verified in [Architecture/Call Path Matrix](../Architecture/Call Path Matrix.md)) but Calgary Property Leasing has never been configured for IVR.

## Decision — SHIPPED 2026-04-28

**v2 replaced v1 at /dashboard.** All 9 exercisable spec rows PASS or N/A. Two skips (Gaps, Telegram) require test-data setup, not code. Live customer prompts untouched.

## Follow-up open items (deferred, not blocking)

1. **Live call transfer end-to-end** — has never been validated on Calgary Property Leasing. Need a real PSTN transfer attempt.
2. **Website chip rename** — currently labeled "Website" but opens a "knowledge chunks" modal. Plain users won't know what 23 chunks means. Redesign to surface "what your agent knows about your business" in plain English.
3. **Voice picker as a chip** — discoverability poor. Hasan vote: kill in-chip picker; chip becomes read-only badge with "Change →" link to /dashboard/voices (now in top nav).
4. **IVR pre-filter** — never validated end-to-end. Inbound webhook does honor `ivr_enabled` (verified in [Architecture/Call Path Matrix](../Architecture/Call%20Path%20Matrix.md)) but no live client has been configured for IVR.
5. **Hours-save unexpected `synced=true`** — settings PATCH triggers `needsAgentSync` for PER_CALL_CONTEXT_ONLY fields. Harmless but wastes Ultravox API calls. Tighten `needsAgentSync` predicate.
6. **D304 legacy prompt migration** — Calgary + 3 other live clients still run old-format prompts (no slot markers). Variable edits there bypass slot-regen entirely. Defer until Phase 6 proven on new clients.

See also: [[Decisions/Overview-5-Tier-Layout]] · [[Tracker/D286]] (Dashboard Hardening Plan).
