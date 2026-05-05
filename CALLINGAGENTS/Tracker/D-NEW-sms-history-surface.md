---
id: D-NEW-sms-history-surface
title: SMS history surface on CallRowExpanded
status: open
priority: MEDIUM
opened: 2026-05-05
related: [[D445]], [[D-NEW-tool-invocation-log]]
---

# SMS history surface on CallRowExpanded

## Origin (2026-05-05)

Surfaced during Urban Vibe (Ray) Phase E test calls. Operator's actual question after every test call: "did my agent text the caller back, and what did it say?" Today there's no dashboard answer — only Twilio console or direct DB queries. Confirmed:

- `clients.sms_template` is editable on the Overview page → Auto-text pill ✅
- `sms_logs` table records every send with `related_call_id` FK to `call_logs.id` ✅
- No UI surface joins these to show a per-call history

Adjacent finding: every outbound SMS is the **identical** template body verbatim (Ray's last 10 sends, byte-for-byte). Operators may misperceive variation across clients (each has its own `sms_template`) as variation per call. The history surface also disambiguates this.

## Build

### CallRowExpanded.tsx — add SMS section

[src/components/dashboard/CallRowExpanded.tsx](src/components/dashboard/CallRowExpanded.tsx) — slot a new collapsible section between transcript and lead summary:

```
📱 SMS follow-up
   To: +1 (403) 555-0123
   Body: "Hey! This is Alisha from Urban Vibe Properties..."
   Status: delivered · 12s after call ended
   Direction: outbound

   📩 Reply received (if inbound exists for same caller_phone within 24h)
   "It sounds way better"  · 4m after our text
```

### Data fetch

Single JOIN on the calls list query (or lazy-fetch on row expand):

```sql
select id, direction, to_number, from_number, body, delivery_status,
       error_message, created_at
from sms_logs
where related_call_id = $1
   or (client_id = $2
       and from_number = (select caller_phone from call_logs where id = $1)
       and created_at between (call_started - interval '5m')
                          and (call_ended + interval '24h'))
order by created_at;
```

The OR-branch catches inbound replies that aren't directly linked via `related_call_id`. Bound replies to the call by caller phone + time window.

### Empty state

If `sms_enabled=false` on the client at call time → no section rendered. If enabled but no SMS in log → "No follow-up text sent" with one-line reason if available (`error_message` from the row).

## Acceptance

- [ ] Expanded row on `/dashboard/calls` shows outbound SMS body + delivery status when `sms_logs.related_call_id` matches
- [ ] Inbound replies within 24h appear inline with the outbound, threaded
- [ ] No section renders when client has `sms_enabled=false` at call time
- [ ] Failed sends show error reason inline (don't hide failures)
- [ ] Same component works on `/dashboard/calls/[id]` detail page (it already imports CallRowExpanded)

## Out of scope

- **Standalone `/dashboard/sms` page** — defer until inbound-SMS or opt-out management becomes a real ops need. CallRowExpanded covers ~95% of the operator question today.
- **SMS template variables** (`{caller_name}`, `{issue_summary}`) — separate feature. File as `D-NEW-sms-template-variables` if/when there's a real ask.
- **Manual SMS send from dashboard** — out of scope; SMS is agent-driven only today.
- **Inside the Auto-text pill expansion** — anti-pattern. The pill is config (toggle + edit template). Cramming history below the textarea makes the pill heavy on every page load and conflates two concerns.

## Dependency order

Independent. No code/migration prerequisites — `sms_logs` schema already has everything needed (`related_call_id`, `direction`, `body`, `delivery_status`, `error_message`).

## Why this layer

Lowest-effort, highest-leverage SMS surface:
- 1 component edit, 1 query, 0 nav changes, 0 migrations
- Answers the actual operator question ("what got texted on this call?")
- Surfaces failed sends and inbound replies that are otherwise invisible until someone looks at Telegram or Twilio
