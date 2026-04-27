# Go Live Tab — Design Spec

**Date:** 2026-04-26
**Status:** Draft for review
**Owner:** Hasan
**Scope:** New top-level dashboard tab `/dashboard/go-live` that repackages existing settings surfaces into a mobile-first 5-section flow. Backend is overwhelmingly reuse — one new API route, one new constant file, one new DB column.

---

## 1. Problem

The existing settings page at `src/app/dashboard/settings/SettingsView.tsx` has 19 cards across 5 tabs. It's accurate, comprehensive, and overwhelming. New owners don't know which fields are required to actually take a call, and the friction is highest on mobile where they sign up.

The result: agents that exist but never receive a real call because the owner never completed call forwarding on their phone.

## 2. Goal

One tab that answers a single question: **"Will my agent pick up the phone and sound right?"**

If a feature doesn't move that needle, it's not on this tab. Everything else stays in the existing settings tabs, untouched.

Success state: a new owner lands on Go Live, fills five short sections in under five minutes on a phone, completes carrier forwarding, hears their agent answer a real test call, and sees a green "You're live" banner.

## 3. Non-goals

- Replacing the existing settings page (deep configuration stays where it is)
- Building any new backend logic that doesn't already exist (except call-forwarding verification + carrier codes lookup)
- Booking, calendar, IVR, transfer conditions, prompt editor, knowledge base, FAQ, business facts, Telegram alerts, email alerts, weekly digest, admin god-mode, plan billing — all stay on their current pages
- Desktop-first design (desktop is gracefully expanded, but mobile is the canonical viewport)

## 4. Information architecture

New nav entry between **Overview** and **Knowledge**:

```
Overview · Go Live · Knowledge · Calls · Leads · Other
```

Route: `/dashboard/go-live`
File: `src/app/dashboard/go-live/page.tsx` (server component, fetches client config)
View: `src/app/dashboard/go-live/GoLiveView.tsx` (client component, renders sections)

The page is single-column on all viewports, max-width 600px, centered. On mobile it uses CSS scroll-snap so each section consumes one thumb-scroll. On `lg+` a sticky right rail mirrors progress. No internal sub-tabs — sub-tabs are the disease this tab is curing.

## 5. Sections (top to bottom)

### Hero — Your number

**Visible always.** Shows the Twilio number assigned to this client.

- If `clients.twilio_number` is set: render the number large, formatted `+1 (639) 739-3885`, with a "Tap to copy" button. One subtitle: "Your agent answers this number once forwarding is set up."
- If `clients.twilio_number` is null (trial without provisioned number): render "You'll get a number when you upgrade." Soft chip linking to `/dashboard/billing`. Below it: "Set everything else up first — it takes two minutes." Keeps the tab useful pre-purchase.

No editable fields here. Pure status.

### Section 1 — How they're greeted

**Reused fields:** `business_name`, `agent_name`, `opening_line` (subset of `system_prompt` greeting block), `business_summary` or equivalent goal field, `voicemail_greeting_text`, `sms_enabled`, `sms_template`.

Four stacked text inputs:
- **Business name** — single line. Subcopy: "Your agent will say this exactly as written."
- **Agent name** — single line. Default placeholder per niche.
- **Opening line** — textarea, two lines on mobile. Niche-aware placeholder. Saves via existing greeting patcher (no new API).
- **What's the agent's job on this call** — textarea, two lines. Niche-aware placeholder ("Find out what they need, then book a showing" / "Get year/make/model and quote them"). Saves to whichever field drives goal-section prompt content (likely `business_summary` or goal slot — confirm at implementation).

Inline accordion at the bottom: **"Voicemail + missed-call text"** — collapsed by default. Opens to reveal:
- `voicemail_greeting_text` textarea (existing field, reused)
- `sms_enabled` toggle, default off, with subcopy "Send a text if I miss them"
- `sms_template` textarea, only visible when toggle is on. Default: "Hey — caught your call from {{business_name}}. What can I help with?"

Below the accordion, a single low-contrast link: **"Want to change how it handles tricky calls? Edit the full script →"** — deep-links to the existing prompt editor at `/dashboard/settings?tab=agent#prompt`. Keeps the power reachable without polluting the tab.

Save behavior: 800ms debounce after typing stops → PATCH → green ✓ chip slides in next to the field. No save button.

### Section 2 — Hours and after-hours

**Reused fields:** `business_hours_weekday`, `business_hours_weekend`, `after_hours_behavior`, `after_hours_emergency_phone`.

Three controls:
- **Weekday hours** — single line, plain English. Placeholder: "Mon–Fri 9am–5pm". Direct text passthrough to `business_hours_weekday`.
- **Weekend hours** — same, optional. Placeholder: "Closed weekends". Empty string is valid.
- **After hours** — three-radio control:
  - "Take a message" → `after_hours_behavior = 'take_message'`
  - "Forward to emergency line" → `after_hours_behavior = 'route_emergency'` + reveals an inline phone input bound to `after_hours_emergency_phone`
  - "Same as during hours" → `after_hours_behavior = 'always_open'`

These four fields are all `PER_CALL_CONTEXT_ONLY` per the mutation contract — DB write only, no Ultravox sync needed. Existing `PATCH /api/dashboard/settings` handles all four already.

### Section 3 — Voice

**Reused component:** the voice picker logic in `src/components/dashboard/settings/VoiceTab` (extract pure picker into `<VoicePickerCompact />`).

Three rules — this is the section most likely to feel broken if we get it wrong:

**1. Only show voices that actually preview.** Every voice in the list must have a working sample audio URL. Audit the current voice catalog: any voice without a usable sample → move to a separate `EXPERIMENTAL_VOICES` array, hidden from this tab entirely. They can stay in the deep settings page for admin/power users, but on Go Live they're invisible. Rule: if you can't hear it, you can't pick it.

**2. The picker is a real scrollable list.** Filter chips at the top: `Female · Male` (two chips, one selected, defaults to whatever the current `agent_voice_id` matches; fall back to Female). Below the chips, a vertical scrollable list — one row per voice, each row: ▶ play button (left) · voice name + one-line vibe descriptor · ✓ check mark when selected. Tapping ▶ plays the sample inline; tapping anywhere else on the row selects that voice. The list itself can scroll within the section if it overflows — don't truncate.

**3. Switching voices is a *moment*, not a checkbox.** The default green ✓ chip is wrong here — voices are emotional. When a new voice is selected:
- The newly-selected row pulses with the brand accent (200ms)
- The voice's sample auto-plays one time so they hear what they just chose
- A small banner slides in below the list: "**Aaron is now answering your calls.** Tap below to hear how he sounds on a real call." with a subtle arrow pointing to the orb in section 5.
- The banner dismisses on next interaction or after 8s.

Save: same wire as today — `agent_voice_id` is `DB_PLUS_TOOLS`, triggers `updateAgent()` for live voice swap. The polish above is purely client-side.

### Section 4 — Forward your phone

**The new piece.** New component `<CallForwardingCard />`.

Two controls:
- **Forwarding number** — phone input. Bound to `clients.forwarding_number`. E.164 normalization on blur. Placeholder: "Your business cell or office line".
- **Carrier dropdown** — select with options from `CARRIER_CODES` constant: Rogers, Bell, Telus, Fido, Koodo, Virgin, Freedom, Other / not sure.

Below the controls, a single large display block (`text-4xl font-mono tracking-wider`):
- **To enable forwarding:** the dial code with `{number}` substituted by the Twilio number, e.g. `*21*16397393885#` for Rogers
- **To turn it off:** the disable code, smaller (`text-lg`)
- **Tap-to-copy** wraps the whole enable code. Haptic on copy via `navigator.vibrate(10)`.
- **"Other / not sure" path:** never blank. Shows: "Most Canadian carriers use `*72<your number>` to forward and `*73` to turn off. If that doesn't work, search '[your carrier] call forwarding' or contact us."

Below that, a single CTA button: **"I forwarded my line — verify"**.

On click → POST to new route `/api/dashboard/forwarding-verify`:
- Server triggers a Twilio outbound call **from the client's Twilio number** to a static TwiML endpoint that says "Forwarding works. Press 1 to confirm, then hang up."
- Crucially, the call is placed *to the Twilio number, not to the forwarding number*. If the user's carrier forwarding is correctly set up, the call traverses the forward chain and reaches their phone. If it isn't, the call rings the Twilio number, hits the inbound webhook, and the verification fails. This is the honest signal — see Section 9 below.
- On press-1, Twilio fires a status callback that updates `clients.forwarding_verified_at = now()`.
- The button morphs into a spinner with a phone icon, then a green checkmark on success or a red X with "Try again" on fail. Visual state polled every 2s for up to 30s.

Inline status pill above the CTA reflects current state:
- Never verified: gray "Not forwarded yet"
- Verified: green "Forwarded ✓ verified [relative time]"
- Failed last attempt: amber "Last test failed — try again"

**"I already did this" affordance — important for returning users.**
Below the verify button, a low-contrast text link: **"I've already forwarded this number — mark it done"**. Click → sets `forwarding_verified_at = now()` with a `forwarding_self_attested = true` flag (new column or just a JSON field on the existing row — simplest is a separate `boolean` column). The honest verification call is preferred, but forcing returning users to re-trigger it every time they revisit the tab would be hostile.

**Once verified, Section 4 collapses.** When `forwarding_verified_at` is non-null, the section renders as a single green pill: "✓ Forwarding set up — Rogers · {twilio_number}". Tap to expand and edit/re-verify. This keeps the wall-of-dial-codes out of the way of users who are past this step. The expanded form is the same as the unverified version. New owners see the full setup; returning owners see a compact confirmation.

### Section 5 — Hear it yourself

**Reused component:** existing `TestCallCard` from `src/components/dashboard/settings/TestCallCard.tsx`.

Wrapped with `size="xl"` prop on mobile (large orb fills the section). One subtitle below: "This is exactly how a real caller will hear it."

That's it. No post-call survey, no verdict buttons. The owner knows whether the call sounded right — if it didn't, they'll scroll up and edit. Adding a feedback widget is ceremony, not value.

### Banner — You're live

Sticky at the bottom of the page once the four go-live conditions are all true (see Section 6). Otherwise hidden.

- Green pill: "✓ You're live"
- The Twilio number, formatted, with a tap-to-copy button
- Subcopy: "Callers reach your agent."

That's the whole banner. No GBP link, no pause button, no extras. The number and proof-of-life is the entire emotional payoff.

## 6. "Live" definition

Derived in `<GoLiveProgress />` from existing DB state. No new `is_live` column.

The four conditions:
1. **Greeting set:** `business_name` non-empty AND `agent_name` non-empty AND `opening_line` non-empty (the latter derived from a greeting-block lookup in `system_prompt`)
2. **Voice chosen:** `agent_voice_id` non-null
3. **Forwarding verified:** `forwarding_verified_at` is not null
4. **Made one test call:** at least one row in `call_logs` where `client_id = current` AND `call_status = 'test'`

The "You're live" banner appears at 4/4 — that's the only progress UI. No header dots, no progress bar. Five sections on a snap-scroll page is its own progress indicator. Editing fields after going live does not revert the live state — the gates are re-evaluated on each render against current DB state.

## 7. New backend pieces

### 7.1 `src/lib/carrier-codes.ts`

```ts
export const CARRIER_CODES = {
  rogers:  { name: 'Rogers',  enable: '*21*{number}#', disable: '##21#' },
  fido:    { name: 'Fido',    enable: '*21*{number}#', disable: '##21#' },
  bell:    { name: 'Bell',    enable: '*72{number}',   disable: '*73'   },
  telus:   { name: 'Telus',   enable: '*72{number}',   disable: '*73'   },
  koodo:   { name: 'Koodo',   enable: '*72{number}',   disable: '*73'   },
  virgin:  { name: 'Virgin',  enable: '*72{number}',   disable: '*73'   },
  freedom: { name: 'Freedom', enable: '*72{number}',   disable: '*73'   },
  other:   { name: 'Other / not sure', enable: null, disable: null },
} as const

export type CarrierKey = keyof typeof CARRIER_CODES
```

Codes verified by Sonar Pro before final ship. Update is a one-line PR.

### 7.2 `src/app/api/dashboard/forwarding-verify/route.ts`

POST endpoint. Auth via existing `client_users` gate (same pattern as `dashboard/test-call/route.ts`).

Flow:
1. Read `client.twilio_number` and `client.forwarding_number`. Return 400 if either missing.
2. Reuse `twilioClient.calls.create()` to place an outbound call **to** `client.twilio_number` (not to forwarding_number). The TwiML URL points to a new tiny endpoint `/api/webhook/forwarding-verify-twiml/[client_id]` that returns:
   ```xml
   <Response>
     <Say>Forwarding works. Press one to confirm, then hang up.</Say>
     <Gather numDigits="1" action="/api/webhook/forwarding-verify-confirm/[client_id]" />
   </Response>
   ```
3. The confirm endpoint receives the digit. If `Digits=1`, update `clients.forwarding_verified_at = now()`. Return TwiML `<Hangup/>`.
4. The original POST returns immediately with `{ verification_id }`. UI polls `GET /api/dashboard/forwarding-verify?id=` every 2s for up to 30s, watching for `forwarding_verified_at` to update.

Why call the Twilio number, not the forwarding number: this is the only way to test the carrier forward chain. Calling the forwarding number directly would always succeed and tell us nothing about whether real callers will reach the agent.

Cost: ~$0.02 per verification. Acceptable.

### 7.3 New DB columns

Migration: add two columns to `clients`:
- `forwarding_verified_at TIMESTAMPTZ NULL` — set by either the verify call or the self-attest button
- `forwarding_self_attested BOOLEAN DEFAULT FALSE` — true if the user clicked "I already did this" instead of running the real verification

No backfill. Add both to the settings PATCH `select()` so reads include them.

Classification per the mutation contract: **DB_ONLY**. No prompt impact, no agent sync, no knowledge pipeline. Pure status fields.

## 8. Reused components — extraction list

The following exist today and need a small adapter layer (no logic changes):

| Existing | Reused as | Adapter |
|---|---|---|
| `AgentTab` greeting fields | `<GreetingFields />` | New file, lifts business_name + agent_name + opening_line + agent's-job inputs out of the tab |
| `VoiceTab` voice list | `<VoicePickerCompact />` | New file, adds Female/Male filter, hides admin voices |
| `SmsTab` toggle + template | reused, wrapped inline in Section 1 accordion | Same `sms_enabled` + `sms_template` fields, no fork |
| `TestCallCard` | reused as-is | Adds optional `size="xl"` prop |
| `VoicemailCard` | reused as-is | Wrapped in accordion in Section 1 |
| `usePatchSettings` hook | reused as-is | Same write path as today |

All extractions are non-destructive — original tabs continue to function.

## 9. Why "verify by calling the Twilio number" matters

A naive verification would dial the user's `forwarding_number` directly and ask them to press 1. They press 1, we mark verified. But this only proves the user has a phone — it doesn't prove their carrier forwarding is set up. They could skip the carrier dial code entirely and still get a green checkmark.

By dialing the Twilio number instead:
- If carrier forwarding works → call rings their phone → they press 1 → verified
- If carrier forwarding is broken → call rings the Twilio number → hits the inbound webhook → no press-1 ever happens → verification times out at 30s → red X "Last test failed"

This makes the green checkmark mean something. It's the difference between "you set things up" and "we can prove your agent will reach you."

## 10. Mobile interaction details

Things that distinguish this from "another settings page":

- **Snap scroll:** `scroll-snap-type: y mandatory` on the container, `scroll-snap-align: start` on each section. Each section is `min-h-screen` on mobile.
- **Autosave with visual confirm:** typed → 800ms debounce → green ✓ chip slides in next to the field via Motion (`fade + 4px translate-y, 200ms ease-out`). No save buttons anywhere.
- **One animation language:** 200ms ease-out, 4px translate-y on enter, no bouncing or decorative motion. Confetti is the *only* exception, fired once when the user crosses 4/4 for the first time.
- **Haptics on copy:** `navigator.vibrate(10)` on every tap-to-copy action. iOS ignores this silently — that's fine.
- **Keyboard handling:** `scroll-padding-top: 80px` on the snap container so iOS keyboard doesn't push inputs behind the sticky header. `inputmode="tel"` on phone fields, `inputmode="text"` everywhere else. `autocomplete="off"` on agent-name and opening-line to prevent iOS suggesting the user's contacts.
- **Big tap targets:** dial code area is the largest tap target on the page when visible (`min-h-[120px]`, full width). Treat it like a one-time-password screen — the user is reading it off and typing into their phone's dialer.
- **Safe area:** `pb-[env(safe-area-inset-bottom)]` on the live banner so it doesn't sit on the iOS home indicator.
- **No progress dots, no header chrome.** The sections themselves are the progress. Adding dots is gamification cosplay.
- **Single brand accent throughout:** every CTA, every check uses the same color. Reduces cognitive load.
- **Card system:** `rounded-3xl shadow-sm bg-white p-6 border border-zinc-100`. Background of the page is a subtle `bg-gradient-to-b from-zinc-50 to-white` so cards float. Type scale tight: 32 / 24 / 16 / 14, no other sizes.

## 11. Desktop behavior

Same component tree, same single column, max-width 600px, centered. Drop snap-scroll, switch to natural vertical scroll with generous spacing (`space-y-12`). No sticky rail, no sidebar — the page is supposed to feel like one thing on every viewport. The dashboard's main nav already exists outside this tab; nothing else is needed.

## 12. Trial vs paid

| State | Behavior |
|---|---|
| Trial, no Twilio number yet | Hero card shows "You'll get a number when you upgrade" + soft upgrade chip. Sections 1, 2, 3 are fully usable. Section 4 (forwarding) shows: "This unlocks when you upgrade — your number gets activated automatically." Section 5 (test call) uses the existing trial WebRTC test path. |
| Paid, Twilio number provisioned | Full flow as designed. |
| Paid, downgrade back to trial | Twilio number stays. Tab continues to work. |

The tab stays useful at every state — never blank, never dead.

## 13. Accessibility

- Every input has a `<label>` (sr-only when visual label is the placeholder)
- Carrier dropdown is a real `<select>` (native iOS picker beats any custom solution on mobile)
- Color contrast WCAG AA throughout
- Snap-scroll degrades gracefully — keyboard users navigate via Tab, sections still scroll into view
- Focus rings visible on all interactive elements
- The post-call thumbs-up/down has text labels, not just emoji

## 14. Out of scope (explicit)

The following are deliberately not on this tab. They live in their existing settings tabs:

- SMS follow-up toggle and template (Overview / Settings → Agent)
- Telegram + email + weekly digest alerts (Settings → Alerts)
- Calendar booking, transfer conditions, IVR, prompt editor, knowledge base, FAQ, business facts, context data, plan billing, niche, agent variables, services catalog, advanced voice config

Reason: these don't gate "is my agent answering the phone?" Adding them dilutes the tab's job.

## 15. Open questions

None blocking implementation. Items to confirm during implementation:

- Niche-specific opening line placeholders: pull from existing `NICHE_CONFIG` defaults, or add new `NICHE_CONFIG.opening_line_placeholder`?
- Confetti library: `motion/react` keyframes vs adding `canvas-confetti` dependency? Lean toward keyframes — no new deps.
- Polling vs WebSocket for forwarding verification status: polling is fine for a 30-second window; WebSocket overkill.

## 16. Implementation phasing

Single phase. The whole tab is one shippable unit. Suggested sub-order for the implementation plan:

1. DB migration: `forwarding_verified_at` column
2. Constant file: `carrier-codes.ts` (with Sonar verification)
3. Forwarding verify API route + TwiML endpoints
4. Component extractions: `<GreetingFields />`, `<VoicePickerCompact />`, `<HoursFields />`, `<AfterHoursFields />`, `<CallForwardingCard />`, `<GoLiveProgress />`, `<GoLiveBanner />`
5. Page assembly: `src/app/dashboard/go-live/page.tsx` + `GoLiveView.tsx`
6. Nav addition: insert "Go Live" between Overview and Knowledge in the dashboard layout
7. Mobile polish pass: snap-scroll, haptics, keyboard handling, safe area
8. End-to-end smoke: cold start as new trial user, complete all 5 sections, hit 4/4, see live banner

## 17. Pre-ship checklist (per CLAUDE.md)

- [ ] Silent-save check: every new field has a reader (greeting fields → prompt patcher → live agent)
- [ ] Phantom data check: `forwarding_verified_at` is read by `<GoLiveProgress />` and the verification pill — not write-only
- [ ] Orphan code check: page is reachable via the new nav entry
- [ ] Dual pipeline check: greeting edits work on both voicemail-pipeline and slot-pipeline clients (uses existing `usePatchSettings` which routes correctly)
- [ ] Rule dilution: no new prompt rules added; we're editing existing fields only
- [ ] Test coverage: at least one e2e test that opens the tab as a fresh trial user and verifies all 4 sections render
- [ ] Trial / paid parity: hero card and Section 4 have explicit trial branches; verified via screenshot diff
