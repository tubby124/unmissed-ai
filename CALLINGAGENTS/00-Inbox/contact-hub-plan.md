---
title: Contact Hub — Per-Client Caller Memory + Personal/Business Routing
status: planned
priority: HIGH
created: 2026-05-02
related: [[Tracker/D-NEW-returning-caller-self-id]], [[Architecture/per-call-context-contract]]
---

# Contact Hub — Plan

> **Pivot rationale:** Cross-client spam blocklist was rejected (privacy + cross-tenant contamination concerns). Reframed as a per-client Contact Hub that solves spam, personal-vs-business routing, and returning-caller intelligence in one feature.

## Problem statements (from 2026-05-02 cross-client call sweep)

| # | Problem | Evidence | Currently bleeding |
|---|---------|----------|--------------------|
| P1 | Spam volume eats minutes (60-83% JUNK rate per client) | Hasan 8/12 JUNK · Urban Vibe 10/12 · Windshield Hub 7/12 | ~30s/spam call billed even on instant hangup |
| P2 | Personal/family calls treated as wrong-number business intake | Amy calling Ray (Urban Vibe) about her son's playdate — 53s burned | Owner-operators mix personal + business; AI doesn't know who's family |
| P3 | Known automated IVRs (ShowingTime) get full conversations | Hasan: 3 ShowingTime calls today, 60-90s each | ~3-4 min/showing × 20 showings/mo for an active realtor = ~60 min/mo |
| P4 | Returning callers lose the agent's identity (THE BUG) | Brian: AI said "hey George, good to hear from you again" — caller assumed AI's name was George | Caller confusion + transcript quality degradation |
| P5 | Quality score conflates lead value with handle quality | ShowingTime IVR confirmation scored 88; real messy lead scored 22 | Owner alert fatigue; HOT badge on robots |

## Existing infrastructure (already built — 70% of feature)

`client_contacts` table exists with these columns (verified live in unmissed Supabase 2026-05-02):

```
id, client_id, phone, name, email,
tags[], notes, source ('call' | 'manual' | 'csv'),
is_vip, vip_relationship, vip_notes, transfer_enabled,
document_url, preferences, sms_opted_out,
call_count, last_call_at, last_outcome,
first_seen_at, created_at, updated_at
```

Already wired:
- Every inbound call auto-creates/updates a contact row (`call_logs.contact_id` FK)
- Returning-caller name pulled from prior `call_logs` (see [[Architecture/per-call-context-contract]] §2.1)

Missing:
- UI surface (no Contacts page yet)
- CSV import endpoint
- Manual edit/tag UI
- Contact lookup at inbound webhook entry to determine routing mode (personal-passthrough vs normal intake vs spam-block)
- Prompt-level VIP/personal routing logic in `prompt-slots.ts`

## Target design

### A. Caller routing modes (computed at inbound webhook entry)

Add a contact lookup BEFORE Ultravox bridge in [src/app/api/webhook/[slug]/inbound/route.ts](src/app/api/webhook/[slug]/inbound/route.ts):

```
contact = lookupContact(client_id, caller_phone)
mode = computeMode(contact)
   - 'spam_block'         → return 200 + hangup TwiML, no Ultravox call, log as spam_blocked
   - 'personal_passthrough' → Ultravox call with personal-message-only prompt overlay
   - 'known_business'     → Ultravox call with name + relationship in callerContext
   - 'normal_intake'      → current flow (unchanged for unknown callers)
```

`computeMode()` rules:
- `tags includes 'spam'` OR `(call_count >= 2 AND last_outcome=JUNK AND avg_duration < 15s)` → `spam_block`
- `is_vip=true AND tags includes any of [personal, family, friend]` → `personal_passthrough`
- `name IS NOT NULL AND tags includes any of [client, vendor, lead]` → `known_business`
- else → `normal_intake`

### B. Prompt-level routing (new slot)

New slot in [src/lib/prompt-slots.ts](src/lib/prompt-slots.ts): `buildContactRouting()` that reads the resolved `caller_mode` from `callerContext` and provides 3 sub-flows:

- **Personal passthrough flow:** "hey [name], [agent] here from [business] — Ray's not on the line, want me to grab a quick message?" → collect message → Telegram → hangUp. NO business intake. NO showing/quote questions.
- **Known business flow:** Greet by name, reference last_outcome briefly, skip name re-ask, jump to current need.
- **Unknown flow:** Current OPENING + TRIAGE behavior, no change.

Inject `CALLER MODE: personal_passthrough` into `callerContextBlock` in [src/lib/agent-context.ts](src/lib/agent-context.ts) so the AI knows which sub-flow to activate.

### C. Dashboard UI (3 new components)

1. **`/dashboard/contacts` page** — table view of `client_contacts`:
   - Columns: name, phone, tags (badges), call_count, last_call_at, last_outcome, VIP flag, actions
   - Filters: tag, VIP, source, has_name (yes/no), spam-flagged
   - Bulk action: tag selected, mark VIP, mark spam, delete
2. **CSV import modal** — drag-drop, column mapping (phone | name | email | tag), preview, confirm. Endpoint: `POST /api/dashboard/contacts/import`.
3. **Contact detail drawer** — opens on row click. Shows full call history for that number (joined with `call_logs`), notes field, VIP toggle, relationship dropdown, tag editor, "Block as spam" button.

### D. Spam learning loop (per-client, no cross-tenant)

After every call:
- If `duration < 15s` AND `transcript.length === 0` → increment a `spam_score` field on the contact row (add column).
- When `spam_score >= 2` AND no name learned across calls → suggest "Block?" pill on the dashboard's Recent Calls feed.
- Owner clicks once → tag added to contact. Future calls from that number hit the `spam_block` mode at the inbound webhook.

This is a per-client list curated by the owner. No data crosses tenant boundaries.

### E. Known-IVR routing (Hasan-only first slice)

Add a lightweight `automated_ivr_dids` JSONB array to `clients` config (or a small global lookup table seeded with: ShowingTime `+18773517469`, Centris confirmations, etc.).

If `caller_phone` matches → bypass Ultravox entirely → route to a transcription-only path that:
1. Records the call's first 30s
2. Runs Claude Haiku to extract appointment time + property address
3. Creates a `call_logs` row with `service_type=automated_ivr`, parsed metadata
4. Telegrams the owner: "📋 Showing confirmed: 209 Cityscape Gardens · Sat May 2 · 4:15 PM"
5. Optionally writes to Google Calendar if linked

## Build phases

### Phase A — UI foundations (1-2 days)
- [ ] `/api/dashboard/contacts/list` GET endpoint
- [ ] `/api/dashboard/contacts/[id]` GET/PATCH/DELETE endpoints
- [ ] `/api/dashboard/contacts/import` POST endpoint (CSV)
- [ ] `<ContactsPage />` table + filters + drawer
- [ ] CSV import modal

**Ship gate:** Owners can manually add/tag personal contacts. No runtime AI behavior change yet.

### Phase B — Inbound routing (2 days)
- [ ] `lookupContact()` helper in `src/lib/contact-lookup.ts`
- [ ] `computeCallerMode()` helper
- [ ] Inject `CALLER MODE` + name + tags + VIP flag into `callerContextBlock` (in `agent-context.ts`)
- [ ] New slot: `buildContactRouting()` with personal-passthrough sub-flow + known-business sub-flow
- [ ] Add slot to slot ordering registry
- [ ] Update golden snapshots
- [ ] Test on `e2e-test-plumbing-co` ONLY (per no-redeploy rule for the 4 working clients)

**Ship gate:** New clients provisioned after this phase get personal-routing for free. Old clients unchanged.

### Phase C — Spam learning loop (1 day)
- [ ] Add `spam_score INT DEFAULT 0` to `client_contacts`
- [ ] Increment in completed-call webhook when ultra-short + empty transcript
- [ ] Add "Block as spam?" pill to call rows when `contact.spam_score >= 2`
- [ ] Inbound webhook reads `tags includes 'spam'` and short-circuits to hangup TwiML

**Ship gate:** First per-client spam blocks active. Reduce minute burn measurable in dashboard.

### Phase D — Known-IVR route (Hasan-only first slice) (1 day)
- [ ] Add lookup for ShowingTime DID
- [ ] Background transcription path
- [ ] Telegram formatter for parsed-IVR alerts
- [ ] Optional Google Calendar write

**Ship gate:** Hasan stops paying for ShowingTime conversations. If clean, expand to other realtors.

### Phase E — Quality score split (UX polish, defer) (0.5 day)
- [ ] Add `lead_quality` and `handle_quality` columns to `call_logs`
- [ ] Update completed-call classifier to fill both
- [ ] Telegram alert threshold uses `lead_quality` only

## Live-client migration plan

The 4 working clients (hasan-sharif, exp-realty, windshield-hub, urban-vibe) are on the no-redeploy list. They need a **manual one-time prompt update** to opt in:

1. Enable Phase A (Contacts UI) — backend-only change, safe.
2. Owner uploads contacts via dashboard.
3. Owner triggers a "Refresh agent prompt" CTA which runs `recomposePrompt()` with the new slot included.
4. Confirm via test call before going live.

For NEW clients post-Phase B, this is automatic.

## Risks

1. **CSV column mapping is messy.** Google Contacts exports have ~50 columns. Build a sensible auto-mapper (name = "First Name" + "Last Name", phone = "Phone 1 - Value", etc.) but allow manual override.
2. **Personal contacts who ALSO have a business need.** Amy is the family contact — but what if she calls about a property she's renting? The personal-passthrough flow should still take a free-text message; AI doesn't refuse, just doesn't run business intake. Owner reads the message and decides.
3. **Phone number format normalization.** Match contacts on E.164. CSV imports must normalize. Already have `normalizePhone()` somewhere — confirm.
4. **Privacy.** Contact data is per-tenant. RLS policies on `client_contacts` already exist (verify). CSV uploads must be size-limited (10K rows max?). No cross-tenant leakage paths.
5. **Existing returning-caller flow already injects `CALLER NAME`.** Don't double-inject. The new `CALLER MODE` is additive context, not a replacement.

## Open questions for Hasan

1. **CSV format flexibility.** Should we accept Google Contacts export raw, or require a predefined schema? (Suggest: auto-detect both.)
2. **VIP relationship dropdown.** Pre-defined list (family, friend, vendor, client, lead) or freeform tag?
3. **Spam auto-block threshold.** Suggest 2+ ultra-shorts. Should owners get to tune this or is it a system default?
4. **Known-IVR lookup table.** Per-client opt-in, or system-wide default with per-client override?
5. **Backfill.** When a client uploads contacts, do we retroactively tag prior `call_logs` rows? (Probably yes for the same phone number — improves dashboard.)

## Success metrics (review at 30 days post-launch)

- % of total client minutes spent on JUNK calls (target: down 50%)
- Average call duration on personal/family calls (target: <20s)
- # contacts uploaded per active client (target: >25)
- Owner-tagged spam blocks per client per week (target: >5 = active engagement)
- Zero cross-tenant contact leakage (privacy SLA)

## Bug fixes shipped alongside this plan

- ✅ **Returning-caller self-identification** (2026-05-02) — slot pipeline updated. New clients will get correct greeting. Brian (`calgary-property-leasing`) needs manual prompt push when convenient — not in no-redeploy list.
