# Session Handoff — 2026-04-28

## Completed This Session

### Wave 1 — UI/copy fixes
- [src/lib/format-phone.ts](src/lib/format-phone.ts) — `webrtc-test`/`trial-test` now render as "Web Browser Call"
- [src/components/dashboard/CallDetail.tsx](src/components/dashboard/CallDetail.tsx) line 419 — uses `formatPhone()`
- [src/components/dashboard/CallRow.tsx](src/components/dashboard/CallRow.tsx) — uses `formatPhone()`; HOT call-back button now also excludes `webrtc-test`
- [src/components/dashboard/LiveCallBanner.tsx](src/components/dashboard/LiveCallBanner.tsx) — uses `formatPhone()`
- [src/hooks/useRealtimeToasts.ts](src/hooks/useRealtimeToasts.ts) — toast formatting unified, test-call toasts suppressed via `isTestCallPhone()`

### Wave 1.2 — Inline Save snippet on call detail
- New API: [src/app/api/dashboard/knowledge/add-snippet/route.ts](src/app/api/dashboard/knowledge/add-snippet/route.ts) — writes `call_snippet` source chunks. Trust tier `medium`. Auto-syncs tools when first chunk lands.
- [src/components/dashboard/QuickAddFaq.tsx](src/components/dashboard/QuickAddFaq.tsx) — new save-snippet button next to "Add as FAQ" per topic
- [src/components/dashboard/CallDetail.tsx](src/components/dashboard/CallDetail.tsx) — passes `callId` to QuickAddFaq
- [src/components/dashboard/knowledge/ChunkBrowser.tsx](src/components/dashboard/knowledge/ChunkBrowser.tsx) — added `call_snippet` + `manual_text` to source filter dropdown

### Wave 1.3 + 1.4 — Trial clarity caption
- [src/components/dashboard/home/AgentIdentityCardCompact.tsx](src/components/dashboard/home/AgentIdentityCardCompact.tsx) — new `isTrial` + `hasForwarding` props. Adds an inline caption above the chip grid explaining trial-vs-paid state and forwarding readiness
- [src/components/dashboard/home/UnifiedHomeSectionV2.tsx](src/components/dashboard/home/UnifiedHomeSectionV2.tsx) — threads those two props from existing data

### Wave 1.5 — Universal recording consent (legal protection)
- DB migration: [supabase/migrations/20260428010953_add_recording_consent.sql](supabase/migrations/20260428010953_add_recording_consent.sql) — adds `recording_consent_acknowledged_at` + `recording_consent_version`
- Onboarding checkbox: [src/app/onboard/steps/step4-activate.tsx](src/app/onboard/steps/step4-activate.tsx) — required before Launch button is enabled
- New `OnboardingData.recordingConsentAcknowledged` field (types/onboarding.ts)
- Trial provision: [src/app/api/provision/trial/route.ts](src/app/api/provision/trial/route.ts) — fail-fast if missing, writes timestamp, auto-merges `RECORDING_DISCLOSURE` into `niche_custom_variables` for new clients
- Backfill flow: [src/app/api/dashboard/recording-consent/route.ts](src/app/api/dashboard/recording-consent/route.ts) (POST endpoint) + [src/components/dashboard/RecordingConsentModal.tsx](src/components/dashboard/RecordingConsentModal.tsx) + [src/components/dashboard/RecordingConsentGate.tsx](src/components/dashboard/RecordingConsentGate.tsx). Mounted in [src/app/dashboard/layout.tsx](src/app/dashboard/layout.tsx) — overlays the dashboard until acknowledgment is saved. **Does NOT auto-modify the prompt for grandfathered clients.**
- Outbound gate: [src/app/api/dashboard/leads/dial-out/route.ts](src/app/api/dashboard/leads/dial-out/route.ts) — fails 403 if consent not acknowledged
- Voicemail pipeline mirror: [src/lib/prompt-niches/voicemail-prompt.ts](src/lib/prompt-niches/voicemail-prompt.ts) — renders `RECORDING_DISCLOSURE` after OPENING block, matching slot pipeline

### Wave 2 — Surface captured data + deep links
- GBP modal enriched: [src/components/dashboard/home/InlineModalsV2.tsx](src/components/dashboard/home/InlineModalsV2.tsx) — shows business name, hours, website, rating + summary instead of just "connected"
- Knowledge page deep-link: [src/app/dashboard/knowledge/KnowledgePageView.tsx](src/app/dashboard/knowledge/KnowledgePageView.tsx) reads `?source=` param and opens chunks drawer pre-filtered
- Knowledge modal CTA: deep-links to `/dashboard/knowledge?source=<active>` based on filter pill state

### Wave 3 — AI Receptionist 400 → 200 min
- [src/lib/pricing.ts](src/lib/pricing.ts) — `PLANS[1].minutes` 400→200 + feature pill copy
- [src/lib/plan-entitlements.ts](src/lib/plan-entitlements.ts) — `CORE.minutes` 400→200
- [src/components/dashboard/UpgradeModal.tsx](src/components/dashboard/UpgradeModal.tsx) — feature pill
- [src/components/dashboard/settings/BillingTab.tsx](src/components/dashboard/settings/BillingTab.tsx) — comparison chip
- Existing AI Receptionist subscribers grandfathered (not bulk-updated)

### Wave 6 — Vault docs
- Updated: [CALLINGAGENTS/Tracker/S16a.md](CALLINGAGENTS/Tracker/S16a.md) — status flipped to `universal-consent-shipped`
- New: [CALLINGAGENTS/Features/Recording-Consent.md](CALLINGAGENTS/Features/Recording-Consent.md) — full design + jurisdictional notes
- New: [CALLINGAGENTS/Decisions/2026-04-28-ai-receptionist-200-minutes.md](CALLINGAGENTS/Decisions/2026-04-28-ai-receptionist-200-minutes.md) — ADR
- New: [CALLINGAGENTS/Features/Outbound-Realtor-ISA-Market-RAG.md](CALLINGAGENTS/Features/Outbound-Realtor-ISA-Market-RAG.md) — future spec, multi-month build

## Decisions Made
- AI Receptionist minutes: 400 → 200, grandfathered for existing subscribers
- Recording consent: universal acknowledgment required. Onboarding checkbox + grandfathered modal. Auto-enables in-call disclosure for NEW clients only — existing 4 live clients keep prompts untouched
- Wave 4 (realtor prompt rebuild + intent branching) deferred to a separate PR with promptfoo tests + live test calls
- Wave 5 (Outbound Realtor ISA + Market RAG) documented only — not implemented

## Current State
- Build: ✅ clean (`npm run build` succeeds, 6.2s compile)
- No new TypeScript errors, no warnings of note
- Migration `20260428010953_add_recording_consent.sql` is staged but **not yet applied to production Supabase project `qwhvblomlgeapzhnuwlb`**

## Pending / Next Steps
- [ ] Apply migration `20260428010953_add_recording_consent.sql` to prod Supabase
- [ ] Manually update Stripe product `prod_UCl8nni05Nk9lB` description ("AI Receptionist") to reflect 200 min
- [ ] Update marketing landing pages (hasansharif.ca + unmissed.ai) if they reference 400 min
- [ ] Realtor prompt rebuild + intent branching (Buy/Sell/Eval/Rent) — separate focused PR with promptfoo tests + live test calls. See plan Wave 4
- [ ] Settings card showing acknowledgment timestamp + downloadable PDF (open follow-up from Recording-Consent feature note)
- [ ] Two-party consent variant of `RECORDING_DISCLOSURE` for clients in CA/FL/IL/MD/MA/MT/NH/PA/WA — flag if a client serves a two-party state
- [ ] Build the actual outbound dialer per [CALLINGAGENTS/Features/Outbound-Realtor-ISA-Market-RAG.md](CALLINGAGENTS/Features/Outbound-Realtor-ISA-Market-RAG.md) — multi-month effort

## How to Continue
Build is green. To ship:
1. Apply the consent migration on Supabase project `qwhvblomlgeapzhnuwlb`
2. Push the branch and merge → Railway auto-deploys
3. Manually log into hasan-sharif/exp-realty/windshield-hub/urban-vibe to verify the backfill modal appears once and persists after acknowledgment
4. Onboard a fresh test client via `/onboard` to verify the consent checkbox blocks Launch and `RECORDING_DISCLOSURE` lands in `niche_custom_variables`
5. Try `POST /api/dashboard/leads/dial-out` for a client where `recording_consent_acknowledged_at IS NULL` — must return 403

For the realtor prompt rebuild work, start fresh from the plan at `/Users/owner/.claude/plans/yeah-okay-sounds-good-mellow-mountain.md` Wave 4.
