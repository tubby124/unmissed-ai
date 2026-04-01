---
type: architecture
status: planned
tags: [crm, contacts, calendar, agent-memory]
related: [[Phase6-Wave2-Dashboard-Matrix]], [[Per-Call Context Contract]], [[Control-Plane Mutation Contract]]
updated: 2026-04-01
---

# CRM Contacts + Calendar Dashboard

> Feature spec + implementation guide. Optimized via Lyra 4-D methodology.
> Hardened with 14 gap/risk fixes identified during adversarial review.
> Parallel workstream — can run alongside Phase 7 onboarding.

---

## Executive Summary

Build a persistent `client_contacts` table that becomes the single source of truth for caller identity. This feeds richer agent "memory" per-call, enables CRM actions from the call log UI, and surfaces Google Calendar appointments on the dashboard.

**What exists today:**
- Contacts are derived at READ TIME by aggregating `call_logs` → `/api/dashboard/callers/route.ts`
- VIP contacts live in a separate `client_vip_contacts` table, read in **3 runtime paths**
- Returning caller injection (`buildAgentContext` in `lib/agent-context.ts`) queries `call_logs` for name + count + last summary
- Calendar booking tools exist (`checkCalendarAvailability` + `bookAppointment`) with Google OAuth
- No dashboard visibility of Google Calendar events
- Trial test calls show "Your test call" instead of the agent's name

**What we're building:**
- Unified `client_contacts` table (absorbs `client_vip_contacts`)
- Richer per-call agent memory from contact records
- Google Calendar events widget on dashboard
- "Add to Contacts" from call row + "Schedule Appointment" from contact dialog

---

## 14 Gaps Found During Adversarial Review

> These are baked into the phases below. Listed here for audit trail.

| # | Gap | Severity | Fix |
|---|-----|----------|-----|
| 1 | **No backfill migration** — switching ContactsView to client_contacts would lose all existing callers | SHOWSTOPPER | Phase 1 includes backfill from call_logs |
| 2 | **VIP migration breaks 3 runtime paths** — `client_vip_contacts` is read in inbound webhook (L157+L179), transfer-status (L162), agent-test (L101) | HIGH | 2-step migration: copy → update reads → deprecate |
| 3 | **Phone normalization missing** — UNIQUE(client_id, phone) fails if "+16045551234" vs "604-555-1234" | HIGH | `normalizePhoneNA()` on ALL write paths. Currently only in demo code — extract to shared `lib/utils/phone.ts` |
| 4 | **call_count/last_summary staleness** — stored derived data drifts from actual call_logs | MEDIUM | Store for fast reads, completed webhook keeps it ~accurate. Reconcile on contact detail open. |
| 5 | **Phase 5 mini-scheduler needs NEW backend** — existing `bookAppointment` is an Ultravox tool (expects X-Tool-Secret), can't call from dashboard | MEDIUM | New `/api/dashboard/calendar/book` route using Google Calendar API directly |
| 6 | **campaign_leads ↔ client_contacts not linked** — user mentioned outbound queue; contacts should cross-reference | MEDIUM | Join by phone at read time in ContactDialog |
| 7 | **Admin multi-client ContactsView** — current ContactsView takes single clientId, admin needs cross-client view | MEDIUM | Pass clientFilter='all' support like CallsList already does |
| 8 | **SMS opt-out not reflected** — contact could be opted out but CRM doesn't show it | LOW | Derive `sms_opted_out` from `sms_opt_outs` table at read time |
| 9 | **Google Calendar token refresh** — OAuth tokens expire after 1h, events API route needs refresh logic | LOW | Reuse existing `refreshGoogleToken()` from calendar booking routes |
| 10 | **UPSERT race on high-volume** — two calls from same number complete simultaneously | LOW | Postgres function with `ON CONFLICT DO UPDATE` + COALESCE for user-edited fields |
| 11 | **Preferences JSONB has no schema** — becomes garbage dump without defined keys | LOW | Define ContactPreferences TypeScript type upfront |
| 12 | **CalendarEventsCard for unconnected clients** — visual noise | LOW | Hide entirely when `calendar_auth_status != 'connected'` |
| 13 | **caller_name persistence gap** — agent collects name, stored in call_logs but never flows to persistent contact | MEDIUM | Completed webhook upserts name to client_contacts (only if contact.name IS NULL) |
| 14 | **No normalizePhoneNA in src/lib** — exists in demo-visitor.ts only, not shared | HIGH | Extract to `lib/utils/phone.ts` before anything else |

---

## Architecture Constraints (MUST follow)

- Read `docs/architecture/control-plane-mutation-contract.md` — new fields must be classified
- Read `docs/architecture/per-call-context-contract.md` — caller enrichment flows through `buildAgentContext → templateContext.callerContext`
- One narrow phase at a time. Stop after each phase and summarize.
- Test only with `e2e-test-plumbing-co`. Never touch hasan-sharif, exp-realty, windshield-hub, urban-vibe.
- Never use `.single()` on `client_users` queries — use `.limit(1).maybeSingle()`.
- Update Obsidian tracker notes on start (`in-progress`) and completion (`done`).
- Write handoff after ~15 tool calls.

---

## Phase 0 — Phone Normalization Utility ([[Tracker/D334]])

### Why first
Every subsequent phase writes phone numbers to client_contacts. Without normalization, the UNIQUE constraint is useless and duplicates will appear.

### Task
- Check `normalizePhoneNA()` in `src/lib/demo-visitor.ts` — extract to `src/lib/utils/phone.ts`
- Function must: strip non-digits, add +1 for 10-digit NA numbers, return E.164 or null
- Add unit tests in `tests/unit/phone.test.ts`

### Gate
`normalizePhoneNA('+1 (604) 555-1234')` === `'+16045551234'` and same for `'604-555-1234'`, `'16045551234'`, etc.

---

## Phase 1 — Data Model: `client_contacts` table ([[Tracker/D335]])

### Migration SQL
```sql
CREATE TABLE client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  phone text NOT NULL,
  name text,
  email text,
  tags text[] DEFAULT '{}',
  notes text,
  source text DEFAULT 'call',  -- 'call' | 'manual' | 'import' | 'vip_migration'
  is_vip boolean DEFAULT false,
  vip_relationship text,
  vip_notes text,
  transfer_enabled boolean DEFAULT false,
  preferences jsonb DEFAULT '{}',
  sms_opted_out boolean DEFAULT false,
  first_seen_at timestamptz DEFAULT now(),
  last_call_at timestamptz,
  call_count integer DEFAULT 0,
  last_outcome text,          -- last call_status
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, phone)
);

ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own client contacts"
  ON client_contacts FOR SELECT
  USING (client_id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own client contacts"
  ON client_contacts FOR INSERT
  WITH CHECK (client_id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own client contacts"
  ON client_contacts FOR UPDATE
  USING (client_id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete own client contacts"
  ON client_contacts FOR DELETE
  USING (client_id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid()));

CREATE INDEX idx_client_contacts_lookup ON client_contacts(client_id, phone);
```

### Preferences type (define upfront — prevents JSONB garbage)
```typescript
interface ContactPreferences {
  callback_preference?: 'morning' | 'afternoon' | 'evening' | null
  language?: string
  notes_for_agent?: string  // injected into callerContext
  do_not_call?: boolean
}
```

### Backfill from call_logs (GAP #1)
```sql
INSERT INTO client_contacts (client_id, phone, name, call_count, last_call_at, last_outcome, first_seen_at, source)
SELECT
  client_id,
  caller_phone,
  (ARRAY_AGG(caller_name ORDER BY started_at DESC) FILTER (WHERE caller_name IS NOT NULL))[1],
  COUNT(*),
  MAX(started_at),
  (ARRAY_AGG(call_status ORDER BY started_at DESC) FILTER (WHERE call_status IS NOT NULL))[1],
  MIN(started_at),
  'call'
FROM call_logs
WHERE caller_phone IS NOT NULL
  AND caller_phone != 'webrtc-test'
  AND caller_phone != 'trial-test'
GROUP BY client_id, caller_phone
ON CONFLICT (client_id, phone) DO NOTHING;
```

### VIP migration — step 1 (GAP #2)
```sql
INSERT INTO client_contacts (client_id, phone, name, is_vip, vip_relationship, vip_notes, transfer_enabled, source)
SELECT client_id, phone, name, true, relationship, notes, transfer_enabled, 'vip_migration'
FROM client_vip_contacts
ON CONFLICT (client_id, phone) DO UPDATE SET
  is_vip = true,
  vip_relationship = EXCLUDED.vip_relationship,
  vip_notes = EXCLUDED.vip_notes,
  transfer_enabled = EXCLUDED.transfer_enabled,
  name = COALESCE(client_contacts.name, EXCLUDED.name);
```

### SMS opt-out sync (GAP #8)
```sql
UPDATE client_contacts cc
SET sms_opted_out = true
FROM sms_opt_outs so
WHERE cc.phone = so.phone_number AND cc.client_id = so.client_id;
```

### Postgres upsert function (for Phase 2 webhook)
```sql
CREATE OR REPLACE FUNCTION upsert_client_contact(
  p_client_id uuid, p_phone text, p_caller_name text, p_call_status text
) RETURNS void AS $$
BEGIN
  INSERT INTO client_contacts (client_id, phone, name, call_count, last_call_at, last_outcome, source)
  VALUES (p_client_id, p_phone, p_caller_name, 1, now(), p_call_status, 'call')
  ON CONFLICT (client_id, phone) DO UPDATE SET
    call_count = client_contacts.call_count + 1,
    last_call_at = now(),
    last_outcome = p_call_status,
    name = COALESCE(client_contacts.name, EXCLUDED.name),
    updated_at = now();
END;
$$ LANGUAGE plpgsql;
```

### Mutation class
`DB_ONLY` — no prompt impact, no tool impact, no agent sync. Contact data is injected at call time via `buildAgentContext()` (`PER_CALL_CONTEXT_ONLY`).

### Gate
- Migration runs clean on Supabase
- Backfill populates contacts for all existing callers
- VIP contacts appear with `is_vip=true`
- RLS works: owner sees only their contacts, admin sees all
- No UI changes yet — existing `/api/dashboard/callers` still works

---

## Phase 2 — Auto-populate on call completion + enrich agent memory ([[Tracker/D336]] + [[Tracker/D337]])

### Completed webhook upsert
In `src/app/api/webhook/[slug]/completed/route.ts`, in the `after()` block after classification:

```typescript
import { normalizePhoneNA } from '@/lib/utils/phone'

if (callerPhone && callerPhone !== 'unknown' && callerPhone !== 'webrtc-test') {
  const normalized = normalizePhoneNA(callerPhone)
  if (normalized) {
    await svc.rpc('upsert_client_contact', {
      p_client_id: clientId,
      p_phone: normalized,
      p_caller_name: callerName ?? null,
      p_call_status: classification,
    })
  }
}
```

### Enrich buildAgentContext (the "agent memory" feature)
In `src/lib/agent-context.ts`, after the existing call_logs query:

```typescript
// Fetch persistent contact record for richer memory
const { data: contact } = await supabase
  .from('client_contacts')
  .select('name, notes, preferences, is_vip, vip_relationship, tags, call_count')
  .eq('client_id', clientId)
  .eq('phone', callerPhone)
  .maybeSingle()

// Enrich callerContextBlock:
// - Name: prefer contact.name over call_logs caller_name (user may have corrected it)
// - Notes: inject preferences.notes_for_agent if set
// - VIP: flag + relationship for priority handling
// - Tags: relevant context for the agent
```

This is `PER_CALL_CONTEXT_ONLY` — assembled fresh every call, never stored in system_prompt. No agent sync needed.

### VIP read migration — step 2 (GAP #2)
Update 3 runtime paths to read `client_contacts WHERE is_vip = true`:

1. `src/app/api/webhook/[slug]/inbound/route.ts` lines 157-184 — individual VIP + VIP roster
2. `src/app/api/webhook/[slug]/transfer-status/route.ts` line 162 — VIP lookup
3. `src/app/api/dashboard/agent-test/route.ts` line 101 — VIP roster

**DO NOT drop `client_vip_contacts` yet.** Leave as dead table for 1 week safety.

### Gate
- Test call to e2e-test-plumbing-co → client_contacts row created/updated
- Agent transcript shows enriched context (name, notes if set)
- VIP greeting still works on inbound calls via client_contacts
- All 3 VIP read paths migrated

---

## Phase 3 — UI: Add to Contacts + ContactsView migration + trial name ([[Tracker/D338]] + [[Tracker/D339]] + [[Tracker/D340]])

### CallRowExpanded.tsx — "Add to Contacts" button
- If `callerPhone` exists and is not 'trial-test'/'webrtc-test':
  - Contact exists → "View Contact" → opens ContactDialog
  - No contact → "Add to Contacts" → creates record with auto-populated fields (name, tags from key_topics)

### New API: `/api/dashboard/contacts/route.ts`
CRUD for client_contacts:
- `GET` — replaces `/api/dashboard/callers` (reads from client_contacts, joins sms_opt_outs)
- `POST` — create contact (with `normalizePhoneNA()`)
- `PATCH` — update name, notes, tags, preferences, is_vip
- `DELETE` — remove contact

### ContactsView.tsx migration
- Switch from `/api/dashboard/callers` to `/api/dashboard/contacts`
- Add inline edit for name, notes, tags on ContactDialog
- Admin multi-client support (GAP #7)

### CallRow.tsx — trial agent name
Line 132: `agentName ? \`${agentName} (test)\` : 'Your test call'`
Pass `agentName` from CallsList → CallRow props.

### campaign_leads cross-reference (GAP #6)
In ContactDialog: query `campaign_leads` by phone + client_id.
- Found → "In Outbound Queue" badge
- Not found → "Add to Outbound Queue" button

### Gate
- Add contact from expanded call row works
- ContactsView shows all contacts from client_contacts
- VIP actions work through client_contacts
- Trial calls show agent name
- Contact dialog shows outbound queue status

---

## Phase 4 — Google Calendar events on dashboard ([[Tracker/D341]])

### New API: `GET /api/dashboard/calendar-events/route.ts`
- Auth: Supabase session → client_users check
- Read Google Calendar OAuth tokens (verify where booking tools store them first!)
- Handle token refresh (GAP #9)
- Fetch upcoming 7 days from Google Calendar API v3 `events.list`
- Return: `[{id, summary, start, end, attendees, location}]`
- Cache 5 minutes. `AbortSignal.timeout(10000)`.

### New component: `CalendarEventsCard.tsx`
- 3 states (GAP #12):
  - Not connected → **HIDE entirely**
  - Connected, no events → "No upcoming appointments"
  - Connected, events → grouped list (Today, Tomorrow, This Week)

### Placement
Add to `src/app/dashboard/calls/page.tsx` bottom grid.

### Gate
- Events visible for connected clients
- Hidden for unconnected clients
- Token refresh works

---

## Phase 5 — Click contact → schedule appointment ([[Tracker/D342]])

### IMPORTANT: Needs NEW backend (GAP #5)
Existing `bookAppointment` tool = Ultravox HTTP tool with X-Tool-Secret. Can't reuse from dashboard.

### New APIs
- `POST /api/dashboard/calendar/book` — create Google Calendar event directly
- `GET /api/dashboard/calendar/availability?date=YYYY-MM-DD` — free/busy slots

### ContactDialog enhancement
If `booking_enabled && calendar_auth_status === 'connected'`:
- "Schedule Appointment" button
- Mini-scheduler: date picker → available slots → confirm
- Pre-fill contact name + phone

### Simplified v1 alternative
If full scheduler is too complex: "Schedule Appointment" opens Google Calendar in new tab with pre-filled event:
```
https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=...
```
Zero backend. Ship instantly. Build full scheduler as v2.

### Gate
- Can book appointment for a contact from CRM
- Appears in Google Calendar + CalendarEventsCard

---

## Files Reference

### New
| File | Phase |
|------|-------|
| `src/lib/utils/phone.ts` | 0 |
| Supabase migration (table + RLS + backfill + function) | 1 |
| `src/app/api/dashboard/contacts/route.ts` | 3 |
| `src/app/api/dashboard/calendar-events/route.ts` | 4 |
| `src/app/api/dashboard/calendar/book/route.ts` | 5 |
| `src/app/api/dashboard/calendar/availability/route.ts` | 5 |
| `src/components/dashboard/CalendarEventsCard.tsx` | 4 |

### Edited
| File | Phase | Change |
|------|-------|--------|
| `src/app/api/webhook/[slug]/completed/route.ts` | 2 | Upsert client_contacts after classification |
| `src/lib/agent-context.ts` | 2 | Enrich returning caller from client_contacts |
| `src/app/api/webhook/[slug]/inbound/route.ts` | 2 | VIP reads from client_contacts (L157-184) |
| `src/app/api/webhook/[slug]/transfer-status/route.ts` | 2 | VIP read migration (L162) |
| `src/app/api/dashboard/agent-test/route.ts` | 2 | VIP roster from client_contacts (L101) |
| `src/components/dashboard/CallRowExpanded.tsx` | 3 | "Add to Contacts" button |
| `src/components/dashboard/CallRow.tsx` | 3 | Trial agent name (L132) |
| `src/components/dashboard/CallsList.tsx` | 3 | Pass agentName prop |
| `src/components/dashboard/ContactsView.tsx` | 3 | Read from client_contacts, inline edit, admin |
| `src/app/dashboard/calls/page.tsx` | 4 | Add CalendarEventsCard |
| `docs/architecture/control-plane-mutation-contract.md` | 1 | Add client_contacts classification |
| `docs/architecture/per-call-context-contract.md` | 2 | Enriched caller context fields |

### Deprecated (after Phase 2 gate + 1 week)
- `src/app/api/dashboard/callers/route.ts` → replaced by `/api/dashboard/contacts`
- `src/app/api/dashboard/vip-contacts/route.ts` → replaced by client_contacts `is_vip=true`
- `client_vip_contacts` table → leave 1 week, then drop

---

## Execution Order

```
Phase 0 (phone util) → Phase 1 (DB) → Phase 2 (runtime) → Phase 3 (UI) → Phase 4 (calendar) → Phase 5 (booking)
```

**Phases 0-3 = immediate value.** Phases 4-5 = independent, ship later.
**Phase 5 can ship as v1 (Google Calendar link) or v2 (in-app scheduler).**

---

## Tracker Items

| D# | Summary | Phase | Priority |
|----|---------|-------|----------|
| D334 | Phone normalization shared utility | 0 | CRITICAL |
| D335 | client_contacts table + backfill + VIP migration | 1 | CRITICAL |
| D336 | Auto-populate contacts on call completion | 2 | HIGH |
| D337 | Enrich buildAgentContext from client_contacts | 2 | HIGH |
| D338 | VIP read migration (3 runtime paths) | 2 | HIGH |
| D339 | Add to Contacts from CallRowExpanded + trial agent name | 3 | HIGH |
| D340 | ContactsView reads from client_contacts + admin support | 3 | HIGH |
| D341 | Google Calendar events dashboard widget | 4 | HIGH |
| D342 | Dashboard appointment booking from CRM | 5 | MEDIUM |
