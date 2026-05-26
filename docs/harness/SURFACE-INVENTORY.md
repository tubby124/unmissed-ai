# Client Nervous System Surface Inventory

Date: 2026-05-26
Scope: Phase 0 / Phase 1 planning for the Client Nervous System Harness.

## Phase Plan

### Phase 0: Surface Inventory and Spec Lock

Goal: document the current truth surfaces before changing runtime behavior.

Status in this slice:
- Created this code-backed inventory.
- Confirmed `client_events` did not exist before the Phase 1 migration apply.
- Confirmed known risks that should become harness checks.
- Left admin UI and Telegram alerting out of scope.

### Phase 1: Ledger and Report MVP

Goal: add a durable event ledger and a CLI report that can tell a client story from source tables.

Status in this slice:
- Added `client_events` migration.
- Reconciled Supabase migration history by adding the missing local `20260525193000_create_learning_loop_suggestions.sql` file for the already-live migration.
- Applied `20260525000000_add_alert_channels.sql` with `--include-all`; live columns already existed and only migration history/comments were reconciled.
- Applied `20260526000000_create_client_events.sql` live.
- Regenerated `src/lib/database.types.ts`; types now include `client_events`.
- Added `recordClientEvent()` helper with redaction, idempotency support, and best-effort failure finding.
- Tightened dedupe semantics so keyed retries use `ignoreDuplicates` and do not mutate existing event rows.
- Added `scripts/client-timeline-report.ts` MVP.
- Extracted report query, normalization, redaction, JSON shape, and Markdown formatting into `src/lib/client-timeline-report.ts`; the script is now only the CLI wrapper.
- Added typed event vocabulary governance in `src/lib/client-event-types.ts` and validation in `recordClientEvent()` for current conservative emitters.
- Wired conservative emitters in central helpers only: prompt version insert, runtime tool sync, and tool invocation logging.
- Re-ran report smoke after migration apply:
  - voicemail pipeline: `mountain-view-dental`
  - slot pipeline: `hasan-sharif`, `windshield-hub`
  - `client_events` no longer reports a missing-table source error.
- Added first read-only Client Nervous System harness checks in `src/lib/client-nervous-system-harness.ts` with a thin CLI wrapper at `scripts/client-nervous-system-harness-check.ts`.
- Harness dry-run confirmed the first checks return zero findings for `mountain-view-dental`, `hasan-sharif`, and `windshield-hub`.

Deferred:
- Admin timeline UI.
- Noisy Telegram alert routing.
- Daily digest.
- Broad onboarding, call-path, prompt, or dashboard behavior fixes.

## Inventory

| Surface | File / function | Writes | Reads | Downstream effect | Existing coverage | Event contract | Gap status |
|---|---|---|---|---|---|---|---|
| Onboarding UI activation | `src/app/onboard/steps/step4-activate.tsx` `onActivate("paid")`; `src/app/onboard/page.tsx` `handleActivate()` | Chooses `/api/provision` for paid branch or `/api/provision/trial` for trial branch | User click state | Determines whether full trial provisioning chain runs | `tests/smoke-trial-flow.spec.ts` appears stale against current 4-step flow | `onboarding.submitted` later | P1: trial branch exists but no active UI button was found that calls `onActivate("trial")`. |
| Intake submission | `src/app/api/provision/trial/route.ts`; `src/app/api/provision/route.ts` | `intake_submissions` | Status pages, activation/provisioning | Links onboarding payload to client row | Partial route tests | `onboarding.intake_saved` later | Needs event coverage. |
| Client row creation | `src/app/api/provision/trial/route.ts` | `clients` | Dashboard, call paths, tool sync, prompt generation | Runtime source of truth for settings/tools/context | Provisioning guard tests | `client.created` later | Trial path creates setup row, then activation flips active. |
| Prompt generation | `buildPromptFromIntake()` in `src/lib/prompt-builder.ts` | `clients.system_prompt`, `prompt_versions` via routes/helpers | Ultravox sync, call prompt base, prompt versions UI | Stable prompt artifact | Prompt snapshot/golden tests | `prompt.generated`, `prompt.version_inserted` | `insertPromptVersion()` did not previously emit timeline events. |
| Prompt version pointer | `src/lib/prompt-version-utils.ts`; callers update `clients.active_prompt_version_id` separately | `prompt_versions`; sometimes `clients.active_prompt_version_id` | Prompt history UI, active prompt audit | Audit pointer correctness | `prompt-version-audit.test.ts` covers insert payload | `prompt.version_inserted`; future `active_prompt_pointer_drift` finding | P1: trial ignores returned version id, so `clients.active_prompt_version_id` can stay null. |
| Ultravox create agent | `src/lib/ultravox.ts` `createAgent()` | External Ultravox agent profile | Agent config, stored prompt/tools | Stored agent profile; production calls still override tools from `clients.tools` | Update-agent safety tests | `agent.created` later | P2/hygiene: createAgent call sites often pass minimal tool flags; stored tools can be narrower than runtime truth. |
| Runtime tool truth | `src/lib/sync-client-tools.ts` | `clients.tools` | Inbound/test call paths pass as `overrideTools` | Runtime-authoritative tools for production calls | Tool registration/capability tests | `tools.synced` now emitted | P0 truth: `clients.tools` is stronger than Ultravox stored selectedTools for live calls. |
| Tool assembly | `src/lib/ultravox.ts` `buildAgentTools()` | Generated tool array | `syncClientTools()`, `updateAgent()`, `createAgent()` | Tool availability, plan gates | Tool registration/capability tests | Future `generated_vs_clients_tools_drift` | P1: call-site flag parity is uneven; harness should inventory every caller. |
| Tool name normalization | `src/lib/tool-name-extractor.ts` `normalizeToolNames()` | No writes | Drift/report comparisons | Prevents phantom drift from Ultravox wire shapes | `tool-name-extractor.test.ts` | Future `tool_shape_unknown` | P1: older drift scripts have local extractors and should converge on this helper. |
| Live inbound call start | `src/app/api/webhook/[slug]/inbound/route.ts` | `call_logs` fire-and-forget insert; Ultravox call creation | Completed webhook, native webhook, dashboard calls | Production call lifecycle | Call scenario tests | `call.started` later | Good candidate for next conservative emitter, but not wired in this slice. |
| Completed webhook | `src/app/api/webhook/[slug]/completed/route.ts` | `call_logs`, `call_transcripts`, `notification_logs`, billing seconds, insights, gaps | Dashboard, reports, notifications, learning bank | Call lifecycle, billing, owner alerts | Webhook signing and notification tests | `call.completed`, `billing.minutes_counted` later | Resolved 2026-05-26: dashboard agent-test writes `call_status='test'`, so completed webhook classifies it as a test call. |
| Transcript persistence | `src/lib/call-transcripts.ts` `persistTranscript()` | `call_transcripts` | Learning bank, transcript audit | Full call transcript storage | Harness source contract test | `call.transcript_persisted` later | Resolved 2026-05-26: completed webhook writer now uses migration-allowed `source='completed_webhook'`. |
| Tool invocation logging | `src/lib/tool-invocations.ts` `recordToolInvocation()` | `tool_invocations`; now `client_events` | Promotion jobs, report timeline | Per-tool analytics | Existing route coverage varies | `tool.invoked` now emitted | P2: some tools may not call the helper. |
| Notification delivery | `src/lib/completed-notifications.ts` | `notification_logs` | Dashboard notifications, health checks | Owner/client alerts | `notification-guards.test.ts` | `notification.sent` / `notification.failed` later | P2: idempotency is coarse; any notification row skips all channels. |
| Drift snapshots | `scripts/drift-check-all.ts`; `src/lib/drift-detector.ts`; `client_drift_log` | `client_drift_log` | Admin client list, report | Prompt recomposition drift visibility | Drift-related tests | `drift.detected`, `drift.clean` later | Covers prompt drift, not full tool/runtime drift. |
| Harness findings | `src/lib/harness-writer.ts` | `harness_findings` latest-state rows | `/dashboard/admin/harness`, reports | Current open health problems | Harness scripts | `harness.finding_opened` / `resolved` later | Fleet-level null `client_slug` can duplicate because unique indexes allow multiple nulls. |
| Per-call context | `src/lib/agent-context.ts` `buildAgentContext()` | No direct writes | Inbound/test/dial paths | Runtime-only caller/time/hours/context injection | Agent context tests | Future `per_call_context_columns_selected_and_mapped` finding | P1: `service_areas` and `injected_note_expires_at` are not selected/mapped consistently. |
| Native Ultravox webhook | `src/app/api/webhook/ultravox/route.ts` | Billing duration updates; console orphan logs | Billing, orphan diagnostics | Native backup signal | Webhook security docs | Future `billing.billed`, `call.orphan_detected` | P2: orphan/stale-live detection is console-only. |
| Admin mutation audit | `src/lib/admin-audit.ts`; `admin_audit_log` | `admin_audit_log` | Future admin audit UI | Cross-client write accountability | `admin-cross-client-write.test.ts` | `setting.changed` later | Existing audit surface complements, but does not replace, timeline events. |

## Known Phase 0 Risks

- Resolved 2026-05-26: `call_transcripts.source` mismatch was fixed by changing the completed webhook helper writer to `completed_webhook`.
- P1: Trial backend exists, but the active onboarding UI appears to route only to the paid `/api/provision` path.
- P1: Trial prompt version insert does not update `clients.active_prompt_version_id`.
- P1: Trial `createAgent()` stored tools can be narrower than runtime `clients.tools`; classify this as stored-agent hygiene unless runtime `clients.tools` also drifts.
- P1: `service_areas` and `injected_note_expires_at` are consumed by `buildAgentContext()` but not selected/mapped consistently across call paths.
- Resolved 2026-05-26: dashboard agent-test rows are inserted as `call_status='test'`, so the completed webhook classifies them as test calls.
- P2: `harness_findings` latest-state rows are not a run history; `client_events` should capture run/open/reopen/resolve events.
- Resolved 2026-05-26: local/live migration history was reconciled before applying `client_events`. `notification_logs` still exists live/types without a local create migration found; leave that older history gap scheduled separately.

## Initial Harness Checks

- `client_events_table_exists`: implemented as a read-only query check; present-empty is treated as healthy.
- `client_timeline_report_sources_available`: implemented for supplied slugs; source query failures become sanitized harness findings.
- `event_registry_covers_current_emitters`: implemented for the current conservative emitter files so event vocabulary drift is caught before broad emitters are added.
- `report_redaction_contract`: implemented as a selected-column guard against raw prompts, transcripts, notification content, raw bodies, signatures, tokens, and secrets.
- `prompt_version_pointer_matches_active_version`: compare `clients.active_prompt_version_id` with active `prompt_versions` row.
- `clients_tools_match_generated_tools`: compare `clients.tools` to `buildAgentTools()` from current DB truth using `normalizeToolNames()`.
- `stored_agent_tools_classified_against_runtime_truth`: compare Ultravox stored tools to `clients.tools`, but classify as runtime-impacting only when a call path does not pass `toolOverrides`.
- `per_call_context_columns_selected_and_mapped`: verify every path that calls `buildAgentContext()` selects and maps consumed fields.
- `call_transcripts_source_allowed`: verify helper writes values allowed by migration CHECK.
- `dashboard_agent_test_status_hygiene`: verify the dashboard WebRTC agent-test route does not insert `call_logs` rows as `call_status='live'`.
- `harness_findings_fleet_null_duplicates`: detect duplicate fleet-level `(harness_name, check_name, client_slug is null)` rows.
- `tool_invocation_event_coverage`: check each tool route calls `recordToolInvocation()` or declares why not.

## Alert Routing Contract

- Timeline/report is source of truth for full history.
- Harness dashboard shows current open problems.
- Telegram should wait for later routing and only fire for actionable P0/P1.
- Daily digest should summarize calm lower-priority changes.
- Event write failures are recorded as harness findings, but event logging must never break user or runtime paths.

## Additional Design Catches for Next Phases

These did not all appear in the original spec, but they matter before the harness becomes the operational source of truth.

### Event Vocabulary Governance

Status: initial registry added in `src/lib/client-event-types.ts` for the current emitted event types:
- `prompt.version_inserted`
- `tools.synced`
- `tool.invoked`

The registry defines event group, default severity, allowed visibility, required identifiers/details, and high-cardinality classification. `recordClientEvent()` now validates registered event types before writing.

Before many more emitters are wired, keep expanding this registry instead of inventing dotted strings in route code.

Why: dotted event strings will sprawl if every route invents its own names. A registry can define:
- allowed `event_type`
- expected `event_group`
- default severity
- allowed visibility
- required IDs/details
- whether high-cardinality emission is allowed

### Correlation ID Propagation

The schema supports `correlation_id`, but Phase 1 emitters do not yet propagate one operation-wide ID.

Needed chains:
- onboarding submit -> intake -> client -> prompt -> agent -> tools -> first test call
- settings PATCH -> prompt patch/rebuild -> prompt version -> agent sync -> tools sync
- call started -> completed -> transcript -> tools -> notifications -> billing
- harness run -> findings -> report

Rule: every multi-step path should create one correlation ID near the entry point and pass it through helpers.

### Event Cardinality and Retention

`tool.invoked` can become high-volume. Before broad route coverage, define:
- which events are always emitted
- which events are debug-only
- retention/archive policy for high-volume debug events
- report defaults that summarize noisy events instead of dumping rows

Initial stance: keep `tool.invoked` admin-only, summarized in reports, and do not route to Telegram.

### Redaction Contract as a Testable Gate

Privacy cannot rely only on each emitter being careful.

Needed:
- central masking for phone/email in payloads and summaries
- denylist for sensitive keys
- tests for embedded phone/email strings
- tests for future report JSON output shape
- no full transcripts, raw webhook bodies, signatures, auth payloads, notification content, or call summaries in `client_events`

Phase 1 already fixed report raw PII and owner-safe RLS; keep this as a permanent gate.

Status update: `src/lib/__tests__/client-timeline-report.test.ts` now asserts the report shape and Markdown omit raw `system_prompt`, transcript text, notification content, raw phone/email values, webhook signatures, auth tokens, and raw request bodies.
Status update: `src/lib/__tests__/client-events.test.ts` now guards against false phone masking of dates, timestamps, and UUIDs so timeline reports do not invent drift from redacted identifiers.

### Report Service Boundary

Status: completed for the MVP boundary.

Implemented:
- `src/lib/client-timeline-report.ts` returns a redacted report object.
- `formatClientTimelineMarkdown()` preserves the CLI Markdown output surface.
- `scripts/client-timeline-report.ts` remains the thin `--slug`, `--since`, `--json`, `--help` wrapper.
- Source query statuses distinguish empty sources from source failures, including `client_events`.
- The report service no longer selects `clients.system_prompt`.

Why: the UI and CLI must not drift.

### Backfill Is a First-Class Source, Not Cleanup

Because event writes are best-effort, the report must be able to reconstruct truth from source tables.

Needed:
- read-only/dry-run backfill first
- idempotent write mode later with stable `dedupe_key`
- `source='backfill'`
- confidence/status field in details
- clear report distinction between real-time event, reconstructed event, and missing trace

### Event Write Health Threshold

The helper writes a harness finding when event writes fail, but alerting should wait for thresholds.

Needed:
- count failures by route/source over a short window
- open/reopen a P1 finding when threshold crosses
- Telegram only when repeated failures suggest observability is down
- do not alert on one-off local migration/schema-cache misses during development

### Migration History Reconciliation

Supabase discovery found live/local migration history drift:
- live had a migration not present locally: `20260525193000_create_learning_loop_suggestions`
- local had at least one migration file not listed in live history: `20260525000000_add_alert_channels.sql`
- `notification_logs` exists live/types but no local create migration was found

Resolved for the active apply path on 2026-05-26:
- added local `20260525193000_create_learning_loop_suggestions.sql`
- dry-ran `npx supabase db push --linked --dry-run --include-all`
- applied only `20260525000000_add_alert_channels.sql` and `20260526000000_create_client_events.sql`
- confirmed live migration history includes `20260525000000`, `20260525193000`, and `20260526000000`

Still open as historical cleanup: find or recreate the original `notification_logs` local migration.

### First Read-Only Harness Slice

Status: completed 2026-05-26.

Implemented:
- `src/lib/client-nervous-system-harness.ts`
- `scripts/client-nervous-system-harness-check.ts`
- `src/lib/__tests__/client-nervous-system-harness.test.ts`

Checks added:
- `client_events_table_exists`
- `client_timeline_report_sources_available`
- `event_registry_covers_current_emitters`
- `report_redaction_contract`

The CLI requires supplied slugs and can run with `--dry-run` to avoid writing `harness_findings`. When not dry-run, it uses the established `recordFindings()` upsert path with `harness='client-nervous-system'`.

Still scheduled separately:
- Historical `notification_logs` migration gap.
- P0/P1 runtime risks: trial prompt version pointer, onboarding trial route reachability, and dashboard agent-test status hygiene.

### Second Read-Only Harness Slice

Status: completed 2026-05-26.

Implemented in the existing harness module/CLI/test:
- `prompt_version_pointer_matches_active_version`
- `harness_findings_fleet_null_duplicates`
- `call_transcripts_source_allowed`
- `per_call_context_columns_selected_and_mapped`

Notes:
- These checks report findings only; they do not patch runtime behavior.
- Live dry-run against `mountain-view-dental`, `hasan-sharif`, and `windshield-hub` reported the expected scheduled risks:
  - `call_transcripts.source` helper writes `ultravox`, while the migration allows `completed_webhook`, `backfill`, and `manual`.
  - Per-call context paths are missing complete `service_areas` / `injected_note_expires_at` select-and-map coverage.
- The transcript source finding was fixed in the next runtime slice by changing the helper writer to `completed_webhook`.
- The per-call context mapping finding was fixed in the next runtime slice by selecting and mapping `service_areas` and `injected_note_expires_at` in the covered call paths.
- The same dry-run produced no prompt-version pointer findings for those three slugs and did not write `harness_findings` because `--dry-run` was used.

Still scheduled separately:
- Test-call status hygiene for dashboard agent-test rows.
- Trial provisioning route reachability.
- Broad event emitters, admin UI, Telegram alerts, and daily digest.

### Transcript Source Runtime Fix Slice

Status: completed 2026-05-26.

Implemented:
- Updated `persistTranscript()` in `src/lib/call-transcripts.ts` to write `source='completed_webhook'`, matching `supabase/migrations/20260429010000_create_call_transcripts.sql`.
- Added a regression test that runs `checkCallTranscriptsSourceAllowed()` against the real migration and helper files.

Notes:
- This fixes only the completed webhook transcript persistence risk.
- Dry-run harness now reports only the remaining scheduled per-call context mapping finding.

Still scheduled separately:
- Add dashboard agent-test status hygiene check/fix.
- Trial provisioning route reachability.
- Broad event emitters, admin UI, Telegram alerts, and daily digest.

### Per-Call Context Select/Map Runtime Fix Slice

Status: completed 2026-05-26.

Implemented:
- Added `injected_note_expires_at` to the `ClientRow` type in `src/lib/agent-context.ts`.
- Selected and mapped both `service_areas` and `injected_note_expires_at` in the covered production/test context paths:
  - `src/app/api/webhook/[slug]/inbound/route.ts`
  - `src/app/api/dashboard/agent-test/route.ts`
  - `src/app/api/dashboard/test-call/route.ts`
  - `src/app/api/dashboard/browser-test-call/route.ts`
  - `src/app/api/trial/test-call/route.ts`
- Added a regression test that runs `checkPerCallContextColumnsSelectedAndMapped()` against the real route files.

Notes:
- Dry-run harness now reports zero findings for `mountain-view-dental`, `hasan-sharif`, and `windshield-hub`.

Still scheduled separately:
- Dashboard agent-test status runtime fix.
- Trial provisioning route reachability.
- Broad event emitters, admin UI, Telegram alerts, and daily digest.

### Dashboard Agent-Test Status Hygiene Check Slice

Status: completed 2026-05-26.

Implemented:
- Added `dashboard_agent_test_status_hygiene` to the existing harness module/CLI/test.
- The check statically inspects `src/app/api/dashboard/agent-test/route.ts` and reports a P1 finding when that route inserts into `call_logs` with `call_status='live'`.
- Added tests for:
  - synthetic dashboard agent-test insert with `call_status='live'` reports a P1 finding.
  - explicit `call_status='test'` and `call_status='trial_test'` do not report.
  - the current real route reports the expected finding.

Notes:
- This slice intentionally did not change route behavior.
- Expected current finding: dashboard WebRTC agent-test rows are inserted as `live`, so completed webhook classification, notification, and billing logic can treat test calls like real live calls.
- Dry-run harness for `mountain-view-dental`, `hasan-sharif`, and `windshield-hub` reports the expected single P1 finding and skips `harness_findings` writes via `--dry-run`.
- Report smoke still passes for all three clients: `sourceErrors=0`, `client_events_status=empty`.

Validation passed:
- `npx tsx --test src/lib/__tests__/client-nervous-system-harness.test.ts`
- `npx tsx --test src/lib/__tests__/client-events.test.ts`
- `npx tsx --test src/lib/__tests__/client-timeline-report.test.ts`
- `npx tsx --test src/lib/__tests__/prompt-version-audit.test.ts`
- `npx tsc --noEmit`
- focused ESLint on touched files passed with only the existing `.eslintignore` deprecation warning

Still scheduled separately:
- Trial provisioning route reachability.
- Broad event emitters, admin UI, Telegram alerts, and daily digest.

### Dashboard Agent-Test Status Runtime Fix Slice

Status: completed 2026-05-26.

Implemented:
- Updated `src/app/api/dashboard/agent-test/route.ts` so dashboard WebRTC test rows are inserted into `call_logs` with `call_status='test'` instead of `call_status='live'`.
- Updated the real-file harness regression so `dashboard_agent_test_status_hygiene` expects the current route to produce no finding.

Notes:
- This keeps completed webhook test-call semantics aligned with the existing `isTestCall` branch and avoids treating dashboard WebRTC tests as real live calls.
- The synthetic red test remains in place so future `call_status='live'` regressions are still caught.
- Expected harness dry-run result is now zero findings for the current three smoke slugs.

Still scheduled separately:
- Trial provisioning route reachability.
- Trial prompt version pointer behavior.
- Broad event emitters, admin UI, Telegram alerts, and daily digest.

### Database Types and Schema Cache

After applying `client_events`, regenerate DB types and refresh schema cache expectations.

Needed:
- done 2026-05-26: ran repo `db:types` workflow after migration apply
- done 2026-05-26: confirmed types include `client_events`
- done 2026-05-26: confirmed reports no longer emit `client_events table missing` source warning

### Call Path Status Hygiene

Early findings show status taxonomy matters as much as event taxonomy:
- resolved 2026-05-26: dashboard agent-test now inserts `call_status='test'`, so completed webhook treats it as a test call
- browser lab test inserts a `test` row but has no completed webhook lifecycle
- trial/web/dashboard test paths need explicit status/report semantics

Add a harness check for "test call rows cannot accidentally notify/bill as real calls."

### Source Table Coverage Matrix

Every event should link back to a durable source table when one exists.

Needed mapping:
- onboarding -> `intake_submissions`, `clients`
- prompts -> `prompt_versions`
- calls -> `call_logs`
- transcripts -> `call_transcripts`
- tools -> `tool_invocations`
- notifications -> `notification_logs`
- billing -> `call_logs.seconds_counted` and native webhook billing fields
- drift -> `client_drift_log`
- current health -> `harness_findings`

If no durable source exists, the event is allowed only if it is low-risk and non-sensitive.

### CI / Feature Gate

Before this becomes reliable, add a lightweight guard that fails or warns when new surfaces bypass the nervous system.

Candidate checks:
- new `settings-schema` fields have surface inventory entries
- new `buildAgentTools()` tool names have event/harness coverage
- new webhook routes declare auth, idempotency, and event coverage
- new onboarding fields declare storage, reader, and report coverage

### Dual Client Report Fixtures

Verification should always include:
- one voicemail/message-only client
- one slot-pipeline client

The next phase should define stable fixture slugs or mock fixtures so reports can be tested without depending on a fragile production state.
