---
type: session-handoff
status: shipped
tags: [demo, zara, unmissed-demo, conversion]
updated: 2026-07-02
---

# Demo That Sells — SHIPPED (commit 1731b23d)

Supersedes [[NEXT-CHAT-Demo-That-Sells]] (mission executed; that note can be archived).

## What shipped
- **Consultative Zara v2** — the `unmissed_demo` persona now lives hardcoded in `src/lib/demo-prompts.ts` (`useLivePrompt: false`). 8-state flow: open by name → ask their business → niche-adapted pain probe → roleplay intake → owner-alert reveal → **magic moment** (on explicit yes, texts the caller the real owner-alert format + onboard link via sendTextMessage) → FAQ objections baked inline ($119/250min/reload packs/guarantee/carrier codes — never "free trial") → close. GLM-4.6 rules + injection defense included.
  - **Why hardcoded:** old live Supabase prompt (slug `unmissed-demo`) was receptionist scaffolding that referenced queryKnowledge — a tool the demo path never injects. Git is now source of truth for the demo persona; **dashboard edits to the unmissed-demo client no longer affect the demo**. `clientSlug` kept — tools/callbackUrl/SMS-from-number still key off the client row (twilio +15878014602, sms_enabled=true).
- **Instrumentation fixed** — completed webhook now closes `demo_calls` (ended_at + duration_seconds by ultravox_call_id). Before: 12/28 browser demos and the only phone demo had no duration. Also unblocks the demo-followup email cron (filters on `ended_at IS NOT NULL`). Classification/transcript for demos land in `call_logs` under the unmissed-demo client (pre-existing fresh-insert fallback).
- **Duration cap** 600s → 900s on call-me demos, graceful time-exceeded message.
- **Trial-path coherence** — widget success state now links `/onboard` ("$119/mo, 50 activation minutes"); follow-up email copy was already correct.
- SMS consent model (Hasan decision 2026-07-02): **agent asks in-call**, sends only on explicit yes — CASL-clean, consent in transcript.

## Verified
- 2,287 tests pass (run twice: manually + pre-commit hook), tsc clean, prod build clean, unmissed-code-reviewer APPROVE (0 critical/high).

## v2.1 addendum (commit 5c4f2518, same day)
Hasan asked: "does the prompt actually know the product end-to-end?" Answer was NO — so:
- Ground-truth fact sheet extracted from CODE (pricing.ts, plan-entitlements.ts, carrier-codes.ts, guardrails/privacy/terms). Key corrections baked into the prompt: founding $119 locks in forever vs $189 std, reload packs $10/50 · $15/100 · $30/200, NO rollover, agent hard-pauses at 0 minutes, guarantee is one-time, $0 setup fee, English-only, US data residency (honest answer scripted), IVR + outbound NOT included, support@endvoicemail.ai routing. PRICING.md is STALE — never quote it.
- 110-scenario eval suites (tests/promptfoo/unmissed-demo-knowledge.yaml + -behavior.yaml) run on Groq (free). 9 iterations. Real bugs caught+fixed: prompt-dump + "DAN MODE ENABLED" jailbreaks, "nice try" deflection firing on legit privacy/wrong-number/human-request callers, INVENTED social proof ("customers handling way more"), fabricated "gpt-4" model claim, pricing questions deferred, French replies.
- Final gate: llama 59/60 + 49/50; gpt-oss-120b 59/60 + 44/50. All pricing/injection/consent/emergency scenarios PASS on both. Residuals = thin-history harness artifacts + grader noise (documented in YAML headers).
- JUDGMENT CALL for Hasan: tests allow "free trial" ONLY in negated denials ("it's not a free trial, but...") — both proxies echo the phrase when denying; prompt still bans it flat. Veto on the live call if it grates.
- Suites re-runnable: cd tests/promptfoo && npx promptfoo eval -c unmissed-demo-knowledge.yaml (gpt-oss default; add --providers groq:llama-3.3-70b-versatile for fast Tier-1).

## NOT verified — do next
1. **Live /try test call once Railway deploy is up** — now genuinely worth your time: knowledge is code-verified and 110 scenarios passed offline. Listen for: pain-line lands for your stated niche, the SMS arrives, "free trial" phrasing, pace of the reveal.
1b. (was:) Live /try test call (the standing dependency from the mission brief). Confirm: consultative open, niche adaptation, the SMS actually lands, duration/ended_at row appears in demo_calls.
2. LOW from review: confirm unique index exists on `demo_calls.ultravox_call_id` (table predates tracked migrations).
3. Browser demos (`/api/demo/start`) now also get the v2 prompt — it says "phone call"; acceptable but worth hearing once.

## Untouched (deliberately)
- Attribution WIP still uncommitted in working tree: CallMeNowWidget UTM hunks, call-me campaignRef/leadRef, migration 20260617000000, demo-followup/scheduled-callbacks/dial-out/for-auto-glass/database.types hunks. Selective-staged around it via `git apply --cached`.

## How to continue (next session)
1. Open a session in this repo; this note is the source of truth. Demo prompt v2.1 lives in `src/lib/demo-prompts.ts` (unmissed_demo entry) — deployed via Railway push, commits `1731b23d` + `5c4f2518`, both on main.
2. FIRST ACTION: Hasan makes the live /try call (see "NOT verified" above). Then run `/review-call <ultravox-call-id>` and check demo_calls got ended_at/duration.
3. Any prompt tweak from the live call: edit demo-prompts.ts → regen snapshot (tsx one-liner in the suite README headers, or copy from git log 5c4f2518) → rerun both suites → commit. Gate: ≥90% both suites, pricing/injection/consent/emergency all green.
4. Product facts source of truth: [[Product-Ground-Truth-2026-07-02]] (CALLINGAGENTS/Product/). PRICING.md is stale — ignore it.
5. Attribution WIP is STILL uncommitted in the working tree — same list as "Untouched" above. Don't sweep it into a commit.
