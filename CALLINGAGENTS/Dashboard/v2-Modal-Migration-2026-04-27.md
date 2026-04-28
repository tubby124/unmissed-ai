---
type: dashboard-audit
status: ship-test-complete-fail
tags: [v2, dashboard, modals, ship-test-fail, blocking-promote]
related: [[Architecture/Dashboard-Hardening-Plan]], [[Decisions/Overview-5-Tier-Layout]], [[Tracker/D286]]
updated: 2026-04-28
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

## Ship-test results — 2026-04-28

Spec: `tests/v2-modal-shiptest.spec.ts` (Playwright, drives every modal via UI on `e2e-test-plumbing-co`, asserts via Supabase service-role queries, reverts each value in `finally`).
Full matrix: `tests/v2-shiptest-results-2026-04-28.md`.

| Button | DB | Prompt | Ultravox sync | Verdict |
|--------|----|----|----|----|
| Greeting save | ✅ | ❌ | ❌ | **FAIL** — variables route skips `updateAgent()` for non-NAME fields. Live agent keeps stale greeting until next sync-triggering save. |
| Callback (CLOSE_PERSON) save | ❌ | ❌ | ❌ | **FAIL** — value displays back as first-token only ("Ship-Test Person …" → "Ship-Test"). Sync also did not advance. Two issues compound. |
| Voice select | ✅ | N/A | ✅ | **PASS** — `updateAgent` fires, `last_agent_sync_at` advances. |
| SMS template save | ✅ | N/A | ✅ | **PASS** — template saved; `sms_enabled` checkbox correctly disabled (no `twilio_number`); tools rebuild gated as designed. |
| Hours save | ✅ | N/A (PER_CALL_CONTEXT_ONLY) | unexpected `synced=true` | **PASS** with note — settings PATCH triggered sync though hours is per-call context. Likely an over-eager `needsAgentSync` field; harmless but worth tightening. |
| Today's update save | ✅ | N/A | N/A (no sync, as expected) | **PASS** |
| IVR enable | ✅ | N/A (DB_ONLY) | N/A | **PASS** |
| Voicemail text save | ✅ | N/A (DB_ONLY) | N/A | **PASS** |
| Forwarding number save | ✅ | N/A | ✅ — `tools.length` 3→5, `transferCall` registered | **PASS** — full pipeline. |
| Telegram link → token | N/A on test client | — | OOB | **SKIP** — test client already has token consumed; UI shows "already connected". Clear `clients.telegram_registration_token` before re-running. |
| Gaps → Promote to FAQ | — | — | — | **SKIP** — test client has zero entries in `knowledge_query_log` with `resolved=false`. Seed a synthetic gap before re-running. |

**Tally:** 7 PASS · 2 FAIL · 2 SKIP (not exercisable on this client) · 0 unverified.

## Anomalies blocking promote

### A — Greeting variable does not re-sync the live agent

Code: [src/app/api/dashboard/variables/route.ts:136-219](src/app/api/dashboard/variables/route.ts#L136-L219)
The PATCH only fires the safety-net `updateAgent()` when `varDef.dbField` is one of three NAME_FIELDS (`agent_name`, `owner_name`, `business_name`). `GREETING_LINE` lives in `niche_custom_variables` JSONB — `regenerateSlots()` runs but `updateAgent()` is never called. Every customer who edits their greeting via the v2 modal will see "Saved ✓" but their phone agent will keep the old greeting until something else triggers a sync (voice change, forwarding edit). Trust regression.

**Fix:** when `regenerateSlots()` returns `promptChanged: true`, call `updateAgent()` and rebuild `clients.tools` regardless of NAME_FIELDS. Mirror the pattern at lines 219-269.

### B — CLOSE_PERSON truncates to first whitespace token + safety-net sync silent

Sent `Ship-Test Person 1777…` to the variables PATCH; GET returned `Ship-Test`. The variable resolver in `clientRowToIntake` + `buildSlotContext` appears to first-word the value. Confirm in [src/lib/prompt-variable-registry.ts](src/lib/prompt-variable-registry.ts) whether single-word is intentional. If so, the modal should validate input. Sync silence is a separate question — `patchOwnerName(prompt, "our", "Ship-Test Person …")` likely returned the prompt unchanged, so the `if (patched !== latest.system_prompt)` branch was skipped.

### C — `HomeSideSheet` (v1 drawer) still mounted on /dashboard/v2

Both `HomeSideSheet` and `InlineEditModal` declare `role="dialog"`, hidden + visible respectively. Strict-mode locator violations on first run of the spec. Spec now scopes to `[aria-labelledby="inline-edit-modal-title"]` — but if v2 promotes to /dashboard, unmount the leftover drawer to avoid future testing footguns.

## Decision pending → updated

**Should v2 replace v1?** Not yet. Two FAIL rows block. Promote conditions:

1. Patch [src/app/api/dashboard/variables/route.ts](src/app/api/dashboard/variables/route.ts) to call `updateAgent()` on any `promptChanged: true` regen, not just NAME_FIELDS.
2. Investigate / fix CLOSE_PERSON first-word truncation in the registry.
3. Re-run `tests/v2-modal-shiptest.spec.ts` — must be all-PASS / N/A.
4. Unmount `HomeSideSheet` from `/dashboard/v2` (or from `/dashboard` once promoted).
5. Promote: change `/dashboard/page.tsx` to render `ClientHomeV2`, ship via Railway auto-deploy.

## Open questions Hasan flagged

1. **Live call transfer** — "does it actually do that?" — has never been tested on Calgary Property Leasing. Need a real PSTN transfer attempt.
2. **Website chip says "Open Knowledge to browse, edit chunks"** — confusing. Plain users won't know what 23 chunks means. Redesign: rename to show "what your agent knows about your business" in plain English (facts + FAQs), not pgvector chunks.
3. **Voice picker as a chip** — discoverability bad. Hasan vote: kill in-chip picker; chip becomes read-only badge with "Change →" link to /dashboard/voices (now in top nav). Worth doing.
4. **IVR pre-filter** — "if I actually set it up, would it actually work properly?" — need test call. Inbound webhook does honor `ivr_enabled` (verified in [Architecture/Call Path Matrix](../Architecture/Call Path Matrix.md)) but Calgary Property Leasing has never been configured for IVR.

## Decision pending

**Should v2 replace v1?** Not yet — too many unverified buttons. Recommend: e2e ship-test first, then promote v2 → /dashboard if all pass. Until then, v2 stays at /dashboard/v2 as staging.

See also: [[Decisions/Overview-5-Tier-Layout]] · [[Tracker/D286]] (Dashboard Hardening Plan).
