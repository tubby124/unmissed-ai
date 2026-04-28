---
type: session-handoff
date: 2026-04-28
status: shipped
tags: [session, realtor, recording-consent, pricing, vault]
related: [[Project/Index]], [[Features/Recording-Consent]], [[Features/Outbound-Realtor-ISA-Market-RAG]], [[Decisions/2026-04-28-ai-receptionist-200-minutes]], [[Tracker/S16a]]
---

# Session 2026-04-28 — Realtor Polish + Universal Recording Consent

## Why this session existed

Hasan onboarded a new real estate client via the auto-provision flow (GBP autoimport + website scrape). On mobile he reviewed the dashboard and surfaced a punch list of friction points. We ran them through plan mode, locked in 6 waves, and shipped them top-to-bottom.

## What shipped (build green, `npm run build` 6.2s)

### Wave 1 — UI/copy
- `src/lib/format-phone.ts` — `webrtc-test`/`trial-test` → "Web Browser Call"
- `src/components/dashboard/CallDetail.tsx` — uses `formatPhone()`
- `src/components/dashboard/CallRow.tsx` — uses `formatPhone()`, HOT call-back button excludes `webrtc-test`
- `src/components/dashboard/LiveCallBanner.tsx` — uses `formatPhone()`
- `src/hooks/useRealtimeToasts.ts` — toast formatting unified, test-call toasts suppressed

### Wave 1.2 — Inline Save snippet on call detail
- New API: `src/app/api/dashboard/knowledge/add-snippet/route.ts` — writes `call_snippet` source chunks (trust tier `medium`); auto-syncs tools when first chunk lands
- `src/components/dashboard/QuickAddFaq.tsx` — new save-snippet button per topic
- `src/components/dashboard/CallDetail.tsx` — passes `callId` to QuickAddFaq
- `src/components/dashboard/knowledge/ChunkBrowser.tsx` — added `call_snippet` + `manual_text` to source filter dropdown

### Wave 1.3 + 1.4 — Trial clarity caption
- `AgentIdentityCardCompact.tsx` — new `isTrial` + `hasForwarding` props. Inline caption above the chip grid explaining trial-vs-paid state and forwarding readiness
- `UnifiedHomeSectionV2.tsx` — threads those two props from existing data

### Wave 1.5 — Universal recording consent (legal protection)
See [[Features/Recording-Consent]] for the full design.
- Migration: `supabase/migrations/20260428010953_add_recording_consent.sql` — adds `recording_consent_acknowledged_at` + `recording_consent_version`
- Onboarding checkbox: `src/app/onboard/steps/step4-activate.tsx` — required before Launch
- New `OnboardingData.recordingConsentAcknowledged` field
- Trial provision: `src/app/api/provision/trial/route.ts` — fail-fast if missing, writes timestamp, auto-merges `RECORDING_DISCLOSURE` for new clients
- Backfill flow: `RecordingConsentModal.tsx` + `RecordingConsentGate.tsx` mounted in `src/app/dashboard/layout.tsx`
- Outbound gate: `src/app/api/dashboard/leads/dial-out/route.ts` — fails 403 if consent NULL
- Voicemail pipeline mirror: `src/lib/prompt-niches/voicemail-prompt.ts` — closed S16a follow-up

### Wave 2 — Surface captured data + deep links
- GBP modal in `InlineModalsV2.tsx` — shows business name, hours, website, rating + summary instead of just "connected"
- `KnowledgePageView.tsx` reads `?source=` param and opens chunks drawer pre-filtered
- KnowledgeModal CTA deep-links to `/dashboard/knowledge?source=<active>` based on filter pill state

### Wave 3 — AI Receptionist 400 → 200 min
See [[Decisions/2026-04-28-ai-receptionist-200-minutes]].
- `src/lib/pricing.ts` — `PLANS[1].minutes` 400→200 + feature pill copy
- `src/lib/plan-entitlements.ts` — `CORE.minutes` 400→200
- `src/components/dashboard/UpgradeModal.tsx` + `BillingTab.tsx`
- Existing AI Receptionist subscribers grandfathered (no bulk DB update)

### Wave 6 — Vault docs (this PR)
- [[Tracker/S16a]] — status flipped to `universal-consent-shipped`
- [[Features/Recording-Consent]] — full design + jurisdictional notes
- [[Decisions/2026-04-28-ai-receptionist-200-minutes]] — ADR
- [[Features/Outbound-Realtor-ISA-Market-RAG]] — future-roadmap spec
- [[Project/Index]] — Latest Session block + Features list + Decisions list refreshed

## Decisions made

1. **AI Receptionist minutes** → 200 (down from 400). Grandfathered for existing subs.
2. **Wave 4** (realtor prompt rebuild + Buy/Sell/Eval/Rent intent branching) → split into a follow-up PR with promptfoo tests + live test calls
3. **Recording consent** → universal acknowledgment required. Onboarding checkbox + grandfathered modal. Auto-enables in-call disclosure for NEW clients only — existing 4 live clients keep prompts untouched
4. **Wave 5** (Outbound Realtor ISA + Market RAG) → DOCUMENT ONLY this session. Multi-month build queued.
5. **Vault discipline** → vault updates ride alongside code, not after

## Pending / Manual ops (next session — Phase A)

The cold-start prompt for the next chat is staged. Run these BEFORE touching prompts.

- [ ] **A1** — Apply migration `20260428010953_add_recording_consent.sql` to prod Supabase project `qwhvblomlgeapzhnuwlb`. Verify with `select count(*) from clients where recording_consent_acknowledged_at is null` (should be 4)
- [ ] **A2** — Update Stripe product `prod_UCl8nni05Nk9lB` description (200 min, not 400)
- [ ] **A3** — Sweep hasansharif.ca + unmissed.ai marketing pages for "400 minute" copy
- [ ] **A4** — Manual smoke: log into hasan-sharif/exp-realty/windshield-hub/urban-vibe, confirm modal appears once and persists. Confirm none of the 4 had `RECORDING_DISCLOSURE` auto-set (intentional)
- [ ] **A5** — Onboard a fresh test client via `/onboard`, confirm checkbox blocks Launch and `RECORDING_DISCLOSURE` lands in `niche_custom_variables`. Test call should hear the disclosure
- [ ] **A6** — POST `/api/dashboard/leads/dial-out` for a client where consent NULL → must return 403

## Phase B — Wave 4 (realtor prompt rebuild)

Only after Phase A is done. Full spec in `/Users/owner/.claude/plans/yeah-okay-sounds-good-mellow-mountain.md` Wave 4.

- Audit `real_estate` vs `property_management` blocks in `src/lib/prompt-config/niche-defaults.ts`
- Read Calgary Property Leasing's deployed `system_prompt` from Supabase (Ultravox agent `a30e9023`, DID `+1 (639) 739-3885`)
- Default approach: monoprompt with branched TRIAGE_DEEP — Buy / Sell / Eval / Rent. Stay off Ultravox call stages (Pattern D, deferred per `memory/advanced-features-plan.md`)
- Set `hasBuiltinTriage: true` on the real_estate registry entry (currently `false`)
- Test on BOTH slot pipeline AND voicemail client per dual-pipeline rule
- Run `bash tests/promptfoo/run-all.sh` + `/niche-test real_estate` for each intent
- **Do NOT redeploy to active live clients** — only the new realtor client (find slug in Supabase: most recent `niche='real_estate'` row) after Hasan signs off via `/prompt-deploy [slug]`

## Phase C — Wave 5 (multi-session build)

Spec at [[Features/Outbound-Realtor-ISA-Market-RAG]]. One component per session:
- C1 — Lead-capture web widget
- C2 — Outbound dialer worker (cron + DNCL/TCPA gates)
- C3 — Per-realtor MLS RAG (CREA DDF for Canada, Bright/MRED for US)
- C4 — Outbound prompt template polish + lead-context injection

## Cold-start prompt for next chat

Hasan generated a self-contained handoff prompt to paste into a fresh session. It directs the next chat to read this handoff, the plan file, the Recording-Consent feature doc, and the Outbound-Realtor-ISA-Market-RAG spec, then walks through Phase A → B → C in order. Plan file path: `/Users/owner/.claude/plans/yeah-okay-sounds-good-mellow-mountain.md`.
