# Session Handoff — Go Live Tab — 2026-04-27

## What got built (working code, on disk, build clean)

Six tracks shipped against the spec at
`docs/superpowers/specs/2026-04-26-go-live-tab-design.md`
+ project note `CALLINGAGENTS/Project/Go-Live-Tab.md`.

**Wave 1 (parallel):**
- Track A — DB + backend
  - Migration `supabase/migrations/20260426000000_add_forwarding_verified_columns.sql` (added `forwarding_verified_at`, `forwarding_self_attested` to `clients`) — **applied to prod (qwhvblomlgeapzhnuwlb) on 2026-04-27**
  - `src/lib/carrier-codes.ts` — Rogers/Fido/Bell/Telus/Koodo/Virgin/Freedom/Other
  - `src/app/api/dashboard/forwarding-verify/route.ts` — POST + GET
  - `src/app/api/dashboard/forwarding-verify/self-attest/route.ts` — POST
  - `src/app/api/webhook/forwarding-verify-twiml/[client_id]/route.ts`
  - `src/app/api/webhook/forwarding-verify-confirm/[client_id]/route.ts`
  - `src/lib/clients/select-columns.ts` updated, `src/app/dashboard/settings/page.tsx` ClientConfig matched
- Track B — extracted components (non-destructive; originals untouched)
  - `src/components/dashboard/go-live/GreetingFields.tsx`
  - `src/components/dashboard/go-live/HoursFields.tsx`
  - `src/components/dashboard/go-live/VoicePickerCompact.tsx`
  - `src/lib/voice-presets.ts` got `EXPERIMENTAL_VOICES` (empty) + `GO_LIVE_VOICES` (curated 6: 3F/3M)
  - Goal field stored at `niche_custom_variables.PRIMARY_GOAL`
  - Opening line stored at `niche_custom_variables.GREETING_LINE`
- Track C — new components
  - `src/components/dashboard/go-live/CallForwardingCard.tsx` (column-agnostic phone input)
  - `src/components/dashboard/go-live/GoLiveBanner.tsx` (sticky pill + one-shot confetti)

**Track D — page assembly:**
- `src/app/dashboard/go-live/page.tsx` (server, auth gate)
- `src/app/dashboard/go-live/GoLiveView.tsx` (client, 5 sections + sticky banner)
- `src/components/dashboard/settings/TestCallCard.tsx` got optional `size?: 'default' | 'xl'` prop

**Track E — nav:**
- `src/components/dashboard/dashboardNav.ts` — Go Live inserted between Overview and Knowledge in Group 1; old `/dashboard/setup` entry renamed `Setup`
- `src/components/dashboard/TabBar.tsx` — Go Live inserted in CLIENT_TABS between Overview and Knowledge
- `src/components/dashboard/BottomTabBar.tsx` — Go Live inserted between Overview and Knowledge (mobile bottom)

**Track F — smoke test:** F1 build, F2 routes registered, F3 nav order, F4 isLive derivation, F5 trial branch, F6 verify endpoint, F7 confirm endpoint, F8 self-attest, F9 carrier codes — all PASS. F10 (e2e-test-plumbing-co live state read) skipped.

**Bug fix during this session:**
- `page.tsx` was redirecting to `/login` on missing client → looked like a logout. Now redirects to `/dashboard` and shows a friendly error block with migration hint. Also added `?client_id=` admin override.
- Migration cause: file existed but was never pushed. Pushed via Management API on 2026-04-27 (other prior migration `20260425000000_fix_maintenance_requests_rls.sql` blocks `supabase db push` — needs to be made idempotent in a separate cleanup).

**Build / tsc / lint:** clean for new code. 246 pre-existing warnings across the rest of the codebase (untouched).

---

## User reactions after seeing it live (THIS IS THE BRIEF FOR NEXT CHAT)

Tested as `tigeredmondson@property-policing` (hand-provisioned client, has Twilio number).

### Hero — number display
- Likes: shows the Twilio number prominently.
- Note: "this go live shouldn't be the reason this guy has a number" — number was provisioned manually. The hero is correct as a status display, just flagging it isn't proof of Go Live having done anything.

### Section 1 — How they're greeted
- Question: **"is this actually what we would want it to do?"** — uncertain whether owners should be editing greeting fields here at all.
- Agent's-job copy: "I guess all of them is to basically collect info and take a message, basically find out what they need and kind of go from there." — current placeholder copy may be too niche-specific.
- **Voicemail + missed-call accordion is duplicative** — these already live on the Overview page. Don't repeat them on Go Live.

### Section 2 — Hours and after-hours
- "Technically it's 24/7" — agent answers anytime. Hours/after-hours framing may not apply to message-taking flows.
- Weekend hours field feels unnecessary.
- Likes 3-option after-hours behavior in concept ("forward to emergency line" is a good system feature) BUT noted "I don't think we have it set up" — emergency forwarding endpoint may not be wired through to runtime.

### Section 3 — Voice
- Likes: voice can be picked here.
- **Layout: single column wastes space.** Wants a 2-column layout to see more voices at once.
- **Catalog is too small** — only 3M/3F. The full catalog has many more; curated `GO_LIVE_VOICES` was a Track B choice, not a spec mandate.

### Section 4 — Forward your phone
- Likes: carrier dropdown.
- "This is one of the most important things."
- **Wants this section to BE the focus of Go Live**: "this page should really be focused on here's the number, or if they are on a trial account then this is what they need to do to get the number."

### Section 5 — Hear it yourself (test orb)
- "I don't know if we need this feature anymore. Can you help me find this out?"
- Need a decision: keep, remove, or move to Overview/Settings.

### Overall
- "I feel like we're repeating a lot of this stuff" — duplication with Overview.
- "Is this what the original plan was for this stuff?" — wants spec re-justified or revised.

---

## Open questions to resolve in next chat (in this order)

1. **What is Go Live's actual job?** Two competing framings:
   - (a) Spec's framing: "5-section minimum-needed-to-take-a-real-call flow." Touches greeting + hours + voice + forwarding + test.
   - (b) User's emerging framing: **"Number + carrier forwarding setup"** — focused page about getting the phone live. Greeting/voice/voicemail edits live on Overview/Settings, not Go Live.
   - **Decide before any more code changes.** This determines whether to slim Go Live to ~Hero + Section 4 (forwarding) + maybe trial CTA, or keep the 5-section flow.

2. **If we slim it (likely):**
   - Remove Section 1 entirely (greeting lives on Overview).
   - Remove Section 2 entirely (hours feel inapplicable to 24/7 message-taking; emergency forward is a system feature, not a Go Live one — surface as a single optional row inside Section 4 instead).
   - Remove Section 5 (test orb already on Overview/Settings).
   - Keep Hero + Section 4 + the live banner.
   - Section 3 (voice): unclear — keep on Go Live? Or only on Settings?

3. **Voice picker (if it stays):**
   - Switch to 2-column grid.
   - Stop using curated `GO_LIVE_VOICES` (6) — show the full catalog with Female/Male filter, like the existing VoicePicker. Keep `EXPERIMENTAL_VOICES` opt-out array as the only filter.

4. **isLive definition** needs to follow whatever sections survive. Current 4 conditions:
   - greeting set, voice chosen, forwarding verified, made one test call.
   - If sections 1/3/5 are removed, only "forwarding verified" remains. That makes isLive ≈ "forwarding verified" — which is the honest definition anyway.

5. **Forwarding verification — does it actually work end to end?**
   - Backend code exists. Twilio dial happens. Confirm endpoint flips `forwarding_verified_at`.
   - **Not yet tested with a real Twilio call.** The test client is `e2e-test-plumbing-co`; Tiger Edmondson is a real provisioned client and was used for visual review only.
   - Run a real verification call before promising anything.

6. **Emergency-line forward in Section 2** — does it actually route at call time? Wired via `after_hours_emergency_phone` (PER_CALL_CONTEXT_ONLY, injected via `callerContextBlock`). User believes "I don't think we have it set up" — verify whether the runtime actually routes to it or only mentions it in prompt context.

---

## What NOT to redo

- The two new DB columns are live in prod. Don't re-migrate.
- Spec/project notes are stable; don't rewrite them — just note revisions.
- Track A's API endpoints are usable as-is — they'd survive a Go Live slim-down.
- Track B/C components can stay in `src/components/dashboard/go-live/` as building blocks even if not all are wired into the page.

## How to resume in a new chat

1. Read this file.
2. Re-read `docs/superpowers/specs/2026-04-26-go-live-tab-design.md` with fresh eyes — particularly sections 2 (Goal) and 14 (Out of scope).
3. Decide on framing question 1 above.
4. If slimming: edit `src/app/dashboard/go-live/GoLiveView.tsx` to drop Sections 1/2/5; reconsider Section 3.
5. If keeping: address layout (2-col voices), full catalog, and remove the voicemail/SMS accordion duplication.

## Things still working in current state (don't break these)

- `/dashboard/settings` and `/dashboard/setup` (renamed) — untouched.
- All four production clients (hasan-sharif, exp-realty, windshield-hub, urban-vibe) — never touched, never deployed.
- Existing `/api/dashboard/forwarding/verify/[test_id]` legacy route — coexists with new `/api/dashboard/forwarding-verify/*` routes.
- Voice catalog full export in `src/lib/voice-presets.ts` — unchanged. Only added the curated subset alongside.

## Dev server

Was running on `http://localhost:3002` via `npm run dev` (port 3000 occupied). Background task ID `bqp2ttuna`. Kill or reuse as needed.
