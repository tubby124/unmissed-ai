---
title: Client Nervous System Harness Design
date: 2026-05-26
project: unmissed.ai
status: approved-for-planning
---

# Client Nervous System Harness Design

## Purpose

Build a durable observability and harness layer that answers, for any client:

> What happened from onboarding to runtime, who changed what, what downstream systems changed, and what is broken or drifting now?

This is not a rewrite. It is a nervous system over the existing Unmissed / EndVoicemail control plane, prompt pipelines, tools, calls, and harnesses.

The goal is to stop guessing. A future operator should be able to inspect a client and see the full chain:

`onboarding input -> intake row -> clients row -> prompt pipeline -> prompt version -> Ultravox agent -> clients.tools -> first test call -> call logs -> transcript -> tool invocations -> notifications -> later settings edits -> drift/harness findings`

## Existing Truth Pieces

The repo already has useful but fragmented traces:

- `intake_submissions`: onboarding payload and client linkage.
- `clients`: persistent runtime configuration and derived prompt/tool state.
- `prompt_versions`: prompt audit history.
- `admin_audit_log`: cross-client admin write audit.
- `client_drift_log`: generated-vs-stored prompt drift snapshots.
- `harness_findings`: latest open/resolved/suppressed harness findings.
- `call_logs`: call state, summary, classification, duration, billing, recording, lead status.
- `call_transcripts`: raw transcript persistence.
- `tool_invocations`: voice-agent tool fire log.
- `notification_logs`: notification delivery/idempotency surface.
- `client_users.onboarding_state`: dashboard checklist/progress state.

The missing layer is a normalized append-only event ledger and a report that joins these surfaces into one narrative.

## Design Decision

Start with a CLI/report plus durable event model, then add an admin UI after the data is trustworthy.

Why:

- CLI reports are faster to ship and easier to run in CI/cron.
- Markdown/JSON output is reviewable and diffable.
- A UI without canonical truth would only make scattered state look more official.
- The existing `/dashboard/admin/harness` can keep showing actionable findings while the timeline matures.

## Core Artifact: `client_events`

Add an append-only table for normalized events. It does not replace existing tables. It links them.

Suggested columns:

- `id uuid primary key`
- `client_id uuid null`
- `client_slug text null`
- `event_version int not null default 1`
- `event_type text not null`
- `event_group text not null`
- `severity text not null default 'info'`
- `actor_type text not null`
- `actor_user_id uuid null`
- `source text not null`
- `source_route text null`
- `correlation_id text null`
- `dedupe_key text null`
- `run_id text null`
- `call_log_id uuid null`
- `ultravox_call_id text null`
- `prompt_version_id uuid null`
- `harness_finding_id uuid null`
- `status text not null`
- `visibility text not null default 'admin_only'`
- `summary text not null`
- `before jsonb not null default '{}'::jsonb`
- `after jsonb not null default '{}'::jsonb`
- `details jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Allowed `actor_type` values:

- `anonymous`
- `owner`
- `admin`
- `system`
- `cron`
- `webhook`
- `harness`

Allowed `status` values:

- `started`
- `success`
- `warning`
- `error`
- `skipped`

Allowed `severity` values:

- `debug`
- `info`
- `notice`
- `warning`
- `critical`

Allowed `visibility` values:

- `admin_only`
- `owner_safe`
- `system_only`

Event design rules:

- Use `correlation_id` to connect a multi-step operation such as onboarding, provisioning, a settings save, a call lifecycle, or a harness run.
- Use `dedupe_key` for idempotent event insertion when webhooks or cron jobs retry.
- Use `event_version` when changing the shape of `details`, not by silently changing old event meanings.
- Never store secrets, full auth payloads, API keys, raw payment tokens, or unredacted request bodies.
- Store hashes or safe summaries when full values would leak private data.
- Keep logging non-blocking for user/runtime paths, but emit a separate `observability.event_write_failed` finding when event writes fail repeatedly.

## Event Types

Use stable dotted names. These become the app's operational vocabulary.

Onboarding:

- `onboarding.draft_created`
- `onboarding.submitted`
- `onboarding.intake_saved`
- `client.created`
- `knowledge.seeded`
- `prompt.generated`
- `prompt.version_inserted`
- `agent.created`
- `tools.synced`
- `onboarding.first_test_call_started`

Settings / control plane:

- `setting.changed`
- `prompt.patched`
- `prompt.rebuilt`
- `prompt.version_inserted`
- `agent.synced`
- `tools.synced`
- `knowledge.reseeded`

Runtime:

- `call.started`
- `call.completed`
- `call.transcript_persisted`
- `tool.invoked`
- `notification.sent`
- `notification.failed`
- `billing.minutes_counted`

Harness / drift:

- `harness.run_started`
- `harness.finding_opened`
- `harness.finding_resolved`
- `drift.detected`
- `drift.clean`

Observability system:

- `observability.event_write_failed`
- `observability.backfill_started`
- `observability.backfill_completed`
- `observability.report_generated`

## Notification Model

Telegram is the fire alarm, not the full dashboard.

Surfaces:

- Client timeline report: source of truth for A-Z history.
- Harness dashboard: current open health problems.
- Telegram: actionable P0/P1 alerts only.
- Daily digest: calm summary of what changed.
- CLI report: deep investigation mode.

Telegram should alert on:

- onboarding/provisioning created partial state but agent creation failed
- prompt/settings saved but Ultravox sync failed
- `clients.tools` drift from generated tools
- call completed but transcript persistence, billing, or notification failed
- webhook signature/config failure
- P0/P1 harness finding opened or reopened
- logging/event write failures crossing a threshold

Telegram should not alert on normal successful events like every setting save, every tool invocation, every prompt version, or every routine call completion. Those belong in the timeline.

Daily digest should include:

- new onboarded clients
- failed or partial onboarding/provisioning runs
- new/reopened P0/P1 harness findings
- calls with missing transcript, billing, or notification rows
- drift summary by client
- observability write failures

## Initial Report

Add:

`scripts/client-timeline-report.ts`

Usage:

```bash
npx tsx scripts/client-timeline-report.ts --slug=hasan-sharif
npx tsx scripts/client-timeline-report.ts --slug=hasan-sharif --json
npx tsx scripts/client-timeline-report.ts --slug=hasan-sharif --since=2026-05-01
```

Report sections:

1. Client identity and current runtime state.
2. Onboarding/intake summary.
3. Prompt/version timeline.
4. Tool/runtime sync timeline.
5. Knowledge corpus state.
6. Recent calls and call lifecycle.
7. Tool invocations.
8. Notifications.
9. Harness findings and drift.
10. Open risks / missing trace points.

The report should clearly distinguish:

- confirmed facts from DB/logs
- inferred relationships
- missing data
- expected-but-absent events

## Harness Contracts

Add harness checks in priority order:

1. `clients_tools_match_generated_tools`
   Compare `clients.tools` against `buildAgentTools()` from current DB truth.

2. `per_call_context_columns_selected_and_mapped`
   Ensure fields consumed by `buildAgentContext()` are selected and passed in each call path.

3. `db_prompt_matches_live_agent_prompt_normalized`
   Compare DB prompt to live Ultravox prompt after marker stripping and template placeholder normalization.

4. `knowledge_tool_prompt_corpus_parity`
   Ensure approved chunks, `queryKnowledge` tool, and prompt retrieval instructions agree.

5. `settings_field_has_declared_runtime_consumer`
   Every accepted settings field must have a declared prompt/tool/runtime/DB-only reason and at least one reader unless explicitly future-only.

6. `call_path_capability_matrix_matches_expected`
   Verify live inbound, dashboard test, browser test, trial test, and future outbound paths differ only where documented.

7. `stored_prompt_matches_generated_prompt_or_allowed_exception`
   Detect prompt drift while respecting hand-tuned and legacy-monolithic exceptions.

8. `capability_badges_match_tool_gates`
   UI truth must match runtime tool gates.

Each harness writes to `harness_findings` and emits `client_events` entries.

## Operational Guardrails

Privacy and redaction:

- Do not store secrets, tokens, raw webhook signatures, API keys, payment tokens, or full request bodies in `client_events`.
- Redact or hash phone numbers/emails in owner-safe views when possible.
- Full transcript access remains governed by existing call detail permissions; timeline events should link to transcripts, not duplicate transcript bodies.

RLS and access:

- Admins can read all events.
- Owners can read only `visibility='owner_safe'` events for their client when an owner-facing timeline exists.
- `system_only` events are service-role/admin diagnostics only.
- Inserts happen server-side through a helper, not from arbitrary client code.

Idempotency:

- Webhook, cron, and harness events should use `dedupe_key`.
- Retried completed webhooks should update/link existing lifecycle events rather than creating confusing duplicate narratives.

Retention:

- Keep high-level timeline events indefinitely.
- Consider TTL or archive policy for verbose debug events after 90 days.
- Store large payloads in the source table/object storage and link to them from `client_events`.

Backfill:

- Phase 1 should include a read-only backfill script that reconstructs recent events from `clients`, `prompt_versions`, `call_logs`, `notification_logs`, `tool_invocations`, `client_drift_log`, and `harness_findings`.
- Backfilled events must use `source='backfill'` and `status='success' | 'warning'` depending on confidence.

Failure handling:

- `recordClientEvent()` must not break the primary user/runtime path.
- Repeated event-write failures should become a `harness_findings` row and an actionable Telegram alert.
- The report must distinguish "no event happened" from "event logging missing or backfilled."

Schema governance:

- Keep event names stable.
- Add new event types through the feature launch contract.
- Add tests that fail if settings fields, onboarding fields, tool builders, or webhook routes are added without inventory/event coverage.

## Feature Launch Contract

Any future feature that touches onboarding, settings, prompts, tools, calls, notifications, billing, or knowledge must define:

- fields it writes
- DB source of truth
- prompt impact
- tool impact
- per-call context impact
- call-path applicability
- event types emitted
- harness checks covering it
- owner/admin visibility

If a feature does not register with the nervous system, it should not ship.

Example for outbound calling:

- fields: `outbound_enabled`, `outbound_number`, `outbound_goal`, `outbound_opening`, etc.
- events: `outbound.config_changed`, `outbound.call_queued`, `outbound.call_started`, `outbound.call_completed`
- checks: call-path parity, tool/runtime parity, notification parity, lead status lifecycle.

## Parallel Agent Operating Model

Use parallel agents for independent read-only discovery and later bounded implementation slices.

Recommended audit pack:

- `truth-tracer`: trace a named field/capability from UI to runtime.
- `drift-detector`: compare DB, generated prompt, tools, and live agent state.
- `supabase-manager` or explorer: inspect audit/log tables and schema gaps.
- `ultravox-manager`: inspect live agent prompt/tool state when needed.
- `twilio-manager`: inspect call routing/webhook delivery when needed.
- `unmissed-code-reviewer`: review every implementation phase.

Agents should write findings into a common report format so their work can become harness rows and timeline events.

## Known Risks Found During Design

These should become early Phase 0/1 checks:

- No unified append-only event ledger exists.
- `call_transcripts.source` appears inconsistent: migration allows `completed_webhook`, `backfill`, `manual`, while helper code writes `ultravox`.
- Current onboarding UI may not expose the trial provisioning path; active launch path appears to call `paid`, while `/api/provision/trial` contains the full trial client/agent chain.
- Trial prompt version insertion may not set `clients.active_prompt_version_id`.
- Trial `createAgent()` may create narrower stored tools than runtime `clients.tools`.
- Some per-call context fields, including `service_areas` and `injected_note_expires_at`, may not be selected/mapped consistently across call paths.
- `harness_findings` is latest-state, not full run history; timeline events should capture run events separately.

## Phasing

### Phase 0: Surface Inventory and Spec Lock

Create `docs/harness/SURFACE-INVENTORY.md` from code-backed discovery.

Track:

- surface
- file/function
- writes
- reads
- downstream prompt/tool/runtime effect
- existing test/harness coverage
- event type
- gap status

No runtime changes except documenting urgent known risks.

### Phase 1: Ledger and Report MVP

Add:

- `client_events` migration
- `recordClientEvent()` helper
- `scripts/client-timeline-report.ts`
- read-only recent-event backfill script
- notification routing helper for P0/P1 nervous-system alerts

Wire conservative emitters:

- trial provisioning route
- settings PATCH
- prompt version insert helper
- tool sync helper
- trial/live call start
- completed webhook
- harness writer

Do not build the admin UI in Phase 1. First prove the report and event model are useful from the CLI.

### Phase 2: Harness Contract Checks

Implement the top harness checks and write findings to both `harness_findings` and `client_events`.

### Phase 3: Admin UI

Add `/dashboard/admin/client-timeline`.

The UI reads the same report service as the CLI. It should show:

- current health summary
- chronological event feed
- prompt/tool/runtime diff cards
- call lifecycle drilldown
- open harness findings

### Phase 4: New Feature Gate

Add a check or lightweight CI guard that flags new settings fields, tool builders, webhook routes, or onboarding fields that are not represented in the surface inventory and event contract.

### Phase 5: Digest and Alert Tuning

Add a daily digest and tune Telegram routing.

The goal is high signal:

- P0/P1 immediate Telegram
- P2 and normal activity in digest/report only
- no repeated alert storms for the same unresolved finding

## Verification

For each phase:

- run the relevant unit tests
- run one report for a voicemail/message-only client
- run one report for a slot-pipeline client
- run one dry-run harness pass
- verify no real outbound side effects occur unless explicitly requested

## Definition of Done

- One command can tell the full A-Z story for a client.
- Every important app action emits or links to an event.
- Every saved field has a reader or explicit justification.
- Every prompt/tool/runtime-affecting edit has a trace.
- Harness findings are visible, deduped, and linked to timeline events.
- Telegram alerts are actionable and low-noise.
- Event writes are idempotent, redacted, and monitored.
- Future features must register their fields, events, and harness coverage before shipping.
