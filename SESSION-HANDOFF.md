# Session Handoff — 2026-04-28 (evening)

## Completed This Session

### Phase A — Out-of-band manual ops (post-PR #34)
- **A1 — Migration applied to prod Supabase qwhvblomlgeapzhnuwlb.** `supabase db push` ran 3 pending migrations (20260425 RLS fix repaired-as-applied, 20260426 forwarding columns, 20260428 recording_consent). All 4 active live clients (`hasan-sharif`, `exp-realty`, `windshield-hub`, `urban-vibe`) verified `recording_consent_acknowledged_at = null` — modal will fire on next dashboard login.
- **A2 — Stripe product no-op.** `prod_UCl8nni05Nk9lB` description = "Full AI receptionist with lead scoring and website knowledge." (no "400 minutes" copy anywhere). marketing_features + metadata both empty. No change needed.
- **A3 — Marketing pages clean.** No stale "400 minute" copy in [hasansharif-website](../hasansharif-website) or in this repo's marketing routes. `settings-utils.ts:40` heuristic (`limit <= 400 → 'Core'`) intentionally covers both new (200 min) and grandfathered (400 min) Core clients.
- **A6 — Outbound gate code-verified.** [src/app/api/dashboard/leads/dial-out/route.ts:72-77](src/app/api/dashboard/leads/dial-out/route.ts#L72) returns 403 with consent error when `recording_consent_acknowledged_at IS NULL`. Live curl test requires Hasan's authenticated session.

### PR #35 — Wave 1.5/2/3/6 SHIPPED to main
**Merged 2026-04-28T11:48:47Z as commit `710bdba`.** Railway auto-deployed.

- **Wave 1.5 — Universal recording consent (legal protection)**
  - [supabase/migrations/20260428010953_add_recording_consent.sql](supabase/migrations/20260428010953_add_recording_consent.sql) — adds `recording_consent_acknowledged_at` + `recording_consent_version`
  - [src/app/onboard/steps/step4-activate.tsx](src/app/onboard/steps/step4-activate.tsx) — required checkbox before Launch
  - [src/app/api/provision/trial/route.ts](src/app/api/provision/trial/route.ts) — fail-fast if missing, writes timestamp, auto-merges `RECORDING_DISCLOSURE`
  - [src/app/api/dashboard/recording-consent/route.ts](src/app/api/dashboard/recording-consent/route.ts) + [RecordingConsentModal.tsx](src/components/dashboard/RecordingConsentModal.tsx) + [RecordingConsentGate.tsx](src/components/dashboard/RecordingConsentGate.tsx) mounted in [dashboard/layout.tsx](src/app/dashboard/layout.tsx). Does NOT auto-modify prompt for grandfathered clients.
  - [src/app/api/dashboard/leads/dial-out/route.ts](src/app/api/dashboard/leads/dial-out/route.ts) — outbound 403 gate
  - [src/lib/prompt-niches/voicemail-prompt.ts](src/lib/prompt-niches/voicemail-prompt.ts) — voicemail pipeline mirror

- **Wave 1 — UI/copy fixes** + **Wave 1.2 — Inline Save snippet** + **Wave 1.3/1.4 — Trial clarity caption** all shipped
- **Wave 2 — Surface captured data + deep links** all shipped
- **Wave 3 — AI Receptionist 400 → 200 min** ([pricing.ts](src/lib/pricing.ts), [plan-entitlements.ts](src/lib/plan-entitlements.ts), [UpgradeModal.tsx](src/components/dashboard/UpgradeModal.tsx), [BillingTab.tsx](src/components/dashboard/settings/BillingTab.tsx))
- **Wave 6 — Vault docs** ([Tracker/S16a.md](CALLINGAGENTS/Tracker/S16a.md) flipped to `universal-consent-shipped`, new feature/decision/tracker notes, Project/Index updated)

### PR #36 — Wave 4 OPEN — awaiting Hasan sign-off
**[https://github.com/tubby124/unmissed-ai/pull/36](https://github.com/tubby124/unmissed-ai/pull/36)** — branch `feat/wave4-realtor-prompt-rebuild`

Real estate niche rebuilt to property_management parity. Existing Haiku-overwritten triage replaced with hand-crafted 10-branch TRIAGE_DEEP + INFO_FLOW_OVERRIDE + CLOSING_OVERRIDE + 7 NICHE_EXAMPLES + LINGUISTIC_ANCHORS.

- 4 main intents: BUY / SELL / EVAL / RENT (Eval = home valuation, distinct from Sell)
- 6 edge intents: SHOWING REQUEST, TEAM/AGENT, VENDOR, JOB, LEGAL/MORTGAGE, INVESTMENT
- Sequenced collection per branch — name always last
- Realtor ethics: ask about existing buyer's-agent + listing-agent before booking/promising
- Fair Housing safety: forbidden demographic/coded language in FORBIDDEN_EXTRA
- Cold-call/vendor close: polite immediate hangUp, no pretend-callback
- [src/lib/niche-registry.ts](src/lib/niche-registry.ts) — `real_estate.hasBuiltinTriage` flipped `false` → `true` (stops Haiku overwrite at intelligence-seed)
- [src/lib/__tests__/snapshots/real-estate-baseline.txt](src/lib/__tests__/snapshots/real-estate-baseline.txt) regenerated
- [src/lib/__tests__/slot-ceilings.test.ts](src/lib/__tests__/slot-ceilings.test.ts) — real_estate ceiling raised 13,500 → 19,500 (parity with PM's 18,500 precedent; baseline measures 18,419)

**No Ultravox call stages.** Pattern D in `memory/advanced-features-plan.md` stays deferred per [docs/architecture/call-path-capability-matrix.md §7.4](docs/architecture/call-path-capability-matrix.md). Monoprompt with rich TRIAGE_DEEP works in the existing slot pipeline today.

## Decisions Made
- AI Receptionist minutes 400 → 200, grandfathered for existing subscribers
- Recording consent universal acknowledgment required (S16a flipped from opt-in-by-default to opt-in-on-acceptance for new clients; one-time modal for the 4 grandfathered live clients)
- Wave 4 monoprompt branching over Ultravox call stages (call_stages aren't implemented; Pattern D stays deferred)
- PR #36 held for Hasan's live-test sign-off before merge

## Current State
- **Build:** ✅ green (`npm run build`)
- **Tests:** ✅ 1700/1700 pass (after snapshot regen)
- **Migration:** ✅ applied to prod Supabase
- **PR #35:** ✅ merged + Railway auto-deployed
- **PR #36:** 🟡 open, awaiting live tests
- **Active live clients:** untouched, no redeploy

## Pending / Next Steps

### Hasan's manual smoke tests (Phase A handoff items)
- [ ] **A4** — Log into hasan-sharif/exp-realty/windshield-hub/urban-vibe one at a time. Confirm RecordingConsentModal appears once, dismisses on acknowledge, dashboard renders normally afterward. Confirm none of the 4 had `niche_custom_variables.RECORDING_DISCLOSURE` auto-set (intentional).
- [ ] **A5** — Open `/onboard` in incognito, run a test trial signup. Confirm consent checkbox blocks Launch button, `clients.recording_consent_acknowledged_at` is set after launch, `niche_custom_variables.RECORDING_DISCLOSURE = "and heads up — this call's being recorded for quality."`, WebRTC test call says the disclosure line. Delete test client when done.
- [ ] **A6 live** — Hit `POST /api/dashboard/leads/dial-out` from authenticated session for a client with null consent → expect 403 with consent error message.

### Wave 4 sign-off (PR #36)
- [ ] `/niche-test real_estate` — simulate Buy / Sell / Eval / Rent intents (one each). Use `/review-call [call-id]` after each.
- [ ] Find the realtor client onboarded 2026-04-28 (most recent `niche='real_estate'` row in Supabase). Show Hasan the diff between current stored prompt and what the new niche default would generate.
- [ ] If sign-off: merge PR #36. New realtor onboardings will get the rebuilt template automatically. Existing clients keep their stored prompts.
- [ ] Per-client deploy on the new realtor: `/prompt-deploy [slug]` only after Hasan's live test calls pass.

### Wave 4 B5 — dashboard toggle (defer until B3 lives in production)
Surface "Qualifying questions: ON / OFF" pill in [AgentRoutesOnCard.tsx](src/components/dashboard/home/AgentRoutesOnCard.tsx). Default ON for `niche='real_estate'`. Save as a new column or `niche_custom_variables.QUALIFYING_ENABLED`.

### Phase C — Wave 5 — Outbound Realtor ISA + Market RAG
Multi-month spec lives in [CALLINGAGENTS/Features/Outbound-Realtor-ISA-Market-RAG.md](CALLINGAGENTS/Features/Outbound-Realtor-ISA-Market-RAG.md). Recommended cadence: one component per session.
- C1 — Lead-capture web widget (POST /api/widget/lead-capture)
- C2 — Outbound dialer worker (cron + Twilio + DNCL + time-of-day window + 24h cooldown)
- C3 — Per-realtor Market RAG (CREA DDF feed + neighborhood briefs into knowledge_chunks)
- C4 — Outbound prompt template polish (lead-context injection at call time + tie qualifying flow into outbound)

### Open follow-ups from prior session
- [ ] Settings card showing acknowledgment timestamp + downloadable PDF (open follow-up from Recording-Consent feature note)
- [ ] Two-party consent variant of `RECORDING_DISCLOSURE` for clients in CA/FL/IL/MD/MA/MT/NH/PA/WA — flag if a client serves a two-party state
- [ ] Build the actual outbound dialer per [CALLINGAGENTS/Features/Outbound-Realtor-ISA-Market-RAG.md](CALLINGAGENTS/Features/Outbound-Realtor-ISA-Market-RAG.md) — multi-month effort

## How to Continue
1. Hasan does A4 + A5 + A6-live manual smoke tests above. Surface anything weird.
2. Hasan does `/niche-test real_estate` for the 4 intents on PR #36's branch (or just live-call the realtor client onboarded yesterday after a test deploy via `/prompt-deploy`). Sign-off triggers PR #36 merge.
3. Phase C is multi-month. Pick C1 first when ready.
