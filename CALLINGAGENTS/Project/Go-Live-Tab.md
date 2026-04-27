---
type: project
status: shipped-slim
tags: [dashboard, onboarding, mobile, ui-ux]
related: [[Index]] [[Architecture/control-plane-mutation-contract]] [[Decisions/Dashboard-Tab-Naming]] [[Tracker/forwarding-verify-twilio]] [[Tracker/after-hours-emergency-forward]]
updated: 2026-04-27
---

# Go Live Tab

## Status — slimmed 2026-04-27

After first user review, framing was revised from **"5-section minimum-needed-to-take-a-real-call flow"** to **"forwarding setup + how-you'll-be-notified"** — Go Live is the operator's setup checklist, Overview/Settings is where the same data is edited and monitored.

**Final 4 blocks:**
1. **Hero** — Twilio number tap-to-copy (or trial CTA)
2. **Forward your phone** — `<CallForwardingCard />` with carrier dial code + self-attest "It worked — I heard the agent" CTA. **Verify-call flow dropped from UI** — see [[Tracker/forwarding-verify-twilio]].
3. **How you'll be notified** — `<NotificationsBlock />` (NEW): Telegram + SMS auto-text reply + voicemail greeting summaries with deep-links to Settings tabs.
4. **Voice** — `<GoLiveVoicePicker />` (NEW): full Ultravox catalog from `/api/dashboard/voices`, 2-col grid, search box. Replaces the 6-voice curated `GO_LIVE_VOICES` (deprecated, file kept on disk).

**Dropped:** Section 1 (greeting fields), Section 2 (hours / after-hours / weekend), Section 5 (test orb) — all duplicated on Overview/Settings.

**isLive (revised):** `forwarding_self_attested = true OR forwarding_verified_at IS NOT NULL`. Single condition, honest.

**Components left on disk, not wired into a route:** `GreetingFields`, `HoursFields`, `VoicePickerCompact`. Future Settings refactor can pick them up.

## What this was originally

A new top-level dashboard tab — `/dashboard/go-live` — that wraps existing settings surfaces into a single mobile-first 5-section flow. Owners land here after signup and complete the minimum needed to actually take real calls: greeting, hours, voice, call forwarding, and a test call.

This is not a rebuild. It's a **repackaging tab** — every backend piece already exists. We add ~3 net-new pieces (one constant file, one API route, one DB column pair) and reuse the rest.

## Why it exists

The current settings page has 19 cards across 5 tabs. New owners can't tell which fields are required to actually receive calls, and the friction is highest on mobile where they sign up. Result: agents that exist but never receive a call because the owner never completed carrier-level call forwarding on their phone.

Go Live answers one question: **"Will my agent pick up the phone and sound right?"** Anything that doesn't move that needle stays on its existing tab.

## Canonical spec

`docs/superpowers/specs/2026-04-26-go-live-tab-design.md`

That document is the single source of truth for layout, fields, behavior, copy, animation language, and the pre-ship checklist. The summary below exists for graph navigation — read the spec before implementing.

## Page structure

```
HERO       — Your number (or "you'll get one when you upgrade")
1 — How they're greeted
    business_name · agent_name · opening_line · agent's-job
    + accordion: voicemail_greeting_text · sms_enabled · sms_template
    + low-contrast link: "Edit the full script →" (deep-links to existing prompt editor)
2 — Hours
    business_hours_weekday · business_hours_weekend · after_hours_behavior
3 — Voice
    Female/Male filter · scrollable list (working previews only)
    voice change is a *moment* — pulse + auto-play + transient banner
4 — Forward your phone
    forwarding_number + carrier dropdown
    huge dial code, tap-to-copy, "I forwarded my line — verify"
    + "I already did this" self-attest link
    + collapses to a green pill once verified
5 — Hear it yourself
    big orb (existing TestCallCard, size="xl")
✓ You're live banner
    green pill, the number, copy button. nothing else.
```

## Decisions baked in

| Question | Answer |
|---|---|
| Tab name | **Go Live** |
| Tab position | Between Overview and Knowledge |
| SMS follow-up + missed-call text | IN, inside Section 1 accordion |
| Voicemail greeting | IN, inside Section 1 accordion |
| Telegram / email alerts | OUT — stays on existing Alerts tab |
| Booking, IVR, transfer conditions, knowledge base | OUT — stays where they are |
| Forwarding verification | Real Twilio outbound to **the Twilio number** (not the forwarding number) — only honest test |
| Carrier instructions | Hardcoded constant `src/lib/carrier-codes.ts` |
| "Other / not sure" carrier | Always shows the GSM `*72/*73` family fallback — never blank |
| Self-attest "I already did this" | IN — sets `forwarding_self_attested = true` |
| Section 4 once verified | Collapses to a green pill, expandable on tap |
| Voice picker | Working previews only · scrollable · pulse + auto-play + banner on change |
| Non-working voices | Move to `EXPERIMENTAL_VOICES` array, hidden from Go Live |
| Post-call feedback widget | OUT — owners know if it sounded right |
| Progress dots / sticky rail | OUT — sections themselves are the progress |
| GBP / Pause-my-agent buttons | OUT — banner is just the green pill + number |

## New code surface

| Path | Purpose |
|---|---|
| `src/app/dashboard/go-live/page.tsx` | Server component — fetches client config |
| `src/app/dashboard/go-live/GoLiveView.tsx` | Client component — renders the 5 sections |
| `src/components/dashboard/go-live/GreetingFields.tsx` | Section 1 — extracted from AgentTab |
| `src/components/dashboard/go-live/HoursFields.tsx` | Section 2 — extracted from AgentTab |
| `src/components/dashboard/go-live/VoicePickerCompact.tsx` | Section 3 — extracted + filtered |
| `src/components/dashboard/go-live/CallForwardingCard.tsx` | Section 4 — net new |
| `src/components/dashboard/go-live/GoLiveBanner.tsx` | Bottom green pill |
| `src/lib/carrier-codes.ts` | Constant — Rogers/Bell/Telus/Fido/Koodo/Virgin/Freedom/Other |
| `src/app/api/dashboard/forwarding-verify/route.ts` | Triggers the Twilio verify call |
| `src/app/api/webhook/forwarding-verify-twiml/[client_id]/route.ts` | TwiML for the verify call |
| `src/app/api/webhook/forwarding-verify-confirm/[client_id]/route.ts` | Receives press-1, sets `forwarding_verified_at` |
| Migration | Add `forwarding_verified_at` + `forwarding_self_attested` to `clients` |

## "Live" definition (4 conditions)

Derived state — no `is_live` column.

1. `business_name`, `agent_name`, `opening_line` all non-empty
2. `agent_voice_id` non-null
3. `forwarding_verified_at` non-null (either real verification or self-attest)
4. At least one row in `call_logs` where `client_id = current AND call_status = 'test'`

Banner appears at 4/4. State re-evaluates on every render.

## Parallel execution plan

The following tracks can be built in parallel by independent agents. Each touches a different file set.

**Track A — DB + backend**
- Migration: `forwarding_verified_at` + `forwarding_self_attested` columns
- `src/lib/carrier-codes.ts` (Sonar Pro verify the codes before commit)
- `POST /api/dashboard/forwarding-verify`
- `/api/webhook/forwarding-verify-twiml/[client_id]`
- `/api/webhook/forwarding-verify-confirm/[client_id]`
- Update `settings/route.ts` `select()` to include the two new columns

**Track B — Component extractions (no logic changes)**
- `<GreetingFields />` (business_name + agent_name + opening_line + agent's-job)
- `<HoursFields />` (weekday + weekend + after-hours behavior + emergency phone)
- `<VoicePickerCompact />` (filter chips + scrollable list + pulse-on-change)
- Audit current voice catalog → `EXPERIMENTAL_VOICES` array for any without working samples

**Track C — New components**
- `<CallForwardingCard />` (carrier dropdown + dial code display + verify button + self-attest link + collapsed-when-verified state)
- `<GoLiveBanner />` (the green pill at the bottom)

**Track D — Page assembly + polish (depends on A/B/C)**
- `src/app/dashboard/go-live/page.tsx`
- `src/app/dashboard/go-live/GoLiveView.tsx`
- Snap-scroll, autosave hooks, debounce, green ✓ chip
- Trial vs paid branches in the hero card
- Mobile keyboard handling (`scroll-padding-top`, `inputmode` hints, safe area)

**Track E — Nav addition (depends on D)**
- Insert "Go Live" between Overview and Knowledge in the dashboard layout

**Track F — Smoke test (depends on E)**
- Cold-start as a fresh trial user, walk all 5 sections, verify 4/4, see live banner
- Hit the verify endpoint with carrier forwarding both correctly set up and intentionally broken
- Confirm voice change pulses, auto-plays, banner dismisses

## Pre-ship checklist

Per `CLAUDE.md` in this repo:
- Silent-save check: every new field has a downstream reader
- Phantom data: `forwarding_verified_at` is read by the page and the verification pill
- Orphan code: page reachable via the new nav entry
- Dual pipeline: greeting edits work on both voicemail-pipeline and slot-pipeline clients
- Trial / paid parity: hero card and Section 4 have explicit trial branches

## Standing rules that apply

- Do NOT redeploy to hasan-sharif, exp-realty, windshield-hub, urban-vibe (per refactor-phase-tracker)
- Test against `e2e-test-plumbing-co` only
- Run Sonar Pro to verify carrier dial codes before committing `carrier-codes.ts`
- Update D-item tracker if this becomes a numbered item

## How to resume in a new chat

```
Open the unmissed.ai project. Read:
  docs/superpowers/specs/2026-04-26-go-live-tab-design.md
  CALLINGAGENTS/Project/Go-Live-Tab.md

Then execute the plan in parallel agents — Tracks A, B, C concurrently in Wave 1, then D, then E, then F. Use the e2e-test-plumbing-co client as the test target. Do NOT touch the four protected production clients.
```
