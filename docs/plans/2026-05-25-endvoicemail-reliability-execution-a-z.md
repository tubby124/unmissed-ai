# EndVoicemail Reliability Execution A-Z Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Turn EndVoicemail from “cool demo that mostly works” into a reliable owner-alerting, self-improving, adversarially-tested voice-agent system.

**Architecture:** Ship in narrow reliability phases: notification truth first, adversarial evals second, learning-loop automation third, then fallback/disaster recovery, prompt drift, billing reconciliation, and dashboard state clarity. Each phase must include tests, production smoke checks, and a clean commit/deploy.

**Tech Stack:** Next.js app in `/root/tmp/unmissed-ai`, Supabase, Railway, Ultravox, Twilio, Telegram/SMS notifications, existing `npm run test:all`, `npm run build`, Railway CLI, repo scripts under `scripts/`.

---

## Operating Rules

- Work from `/root/tmp/unmissed-ai`.
- Keep every phase narrow and independently shippable.
- Do not mix UI refactors with runtime reliability work.
- Before each commit: `npm run test:all` and `npm run build` unless the phase is docs-only.
- After each push: wait for Railway online, hit `https://endvoicemail.ai/api/health`, then run the phase-specific production smoke test.
- Never expose secrets in logs or Telegram summaries.
- Preserve unrelated dirty work in stash. Do not accidentally commit parked changes.
- Every prompt-affecting change must be tested against both voicemail and slot-pipeline paths.

---

# Phase 0 — Repo Hygiene + Reliability Baseline

**Objective:** Start from a clean, known state and capture the current production failure surface.

**Files:**
- Read: `CLAUDE.md`
- Read: `docs/architecture/control-plane-mutation-contract.md`
- Read: `docs/architecture/per-call-context-contract.md`
- Read: `docs/architecture/call-path-capability-matrix.md`
- Read: `docs/architecture/webhook-security-and-idempotency.md`
- Create: `docs/audits/2026-05-25-reliability-baseline.md`

### Task 0.1: Confirm repo cleanliness and stash state

Run:

```bash
cd /root/tmp/unmissed-ai
git status --short --untracked-files=all
git stash list | head -10
git log --oneline -5
```

Expected:
- Production commits include calendar/demo fixes.
- Any unrelated dirty work is clearly identified and not included in reliability commits.

### Task 0.2: Capture current prod health

Run:

```bash
curl -sS https://endvoicemail.ai/api/health | jq .
railway status
```

Expected:
- `supabase: ok`
- `agents_healthy` equals `agents_checked`
- Railway service online.

### Task 0.3: Create baseline audit doc

Create `docs/audits/2026-05-25-reliability-baseline.md` with:

```markdown
# Reliability Baseline — 2026-05-25

## Production Health
- Railway:
- Supabase:
- Agents checked:
- Agents healthy:

## Current Known Risks
- Notification failures / unbilled notification records
- UNKNOWN classification burying owner alerts
- Manual learning-loop patch process
- Weak adversarial voice-call eval coverage
- Prompt drift across voicemail vs slot pipeline
- Disaster fallback not recently fire-drilled
- Billing/minute reconciliation uncertainty

## Repo State
- HEAD:
- Dirty files:
- Stashes:

## Next Phase
Phase 1 — notification reliability.
```

### Task 0.4: Commit baseline doc

Run:

```bash
git add docs/audits/2026-05-25-reliability-baseline.md
git commit -m "docs: add reliability baseline audit"
```

---

# Phase 1 — Notification Reliability Audit + Retry/Fallback

**Objective:** Make it impossible for a completed call to disappear silently because Telegram/SMS/email/summary delivery failed.

**Why first:** If owner alerts fail, the product loses trust even when the voice agent performed well.

**Files:**
- Inspect: `src/app/api/cron/notification-health/route.ts`
- Inspect: `src/app/api/webhook/[slug]/completed/route.ts`
- Inspect: notification send helpers under `src/lib/`
- Inspect: `src/lib/database.types.ts`
- Create/modify tests under: `src/lib/__tests__/notification-reliability.test.ts`
- Possibly modify: notification retry helper under `src/lib/notifications*` or create `src/lib/notification-reliability.ts`

### Task 1.1: Map notification write/read paths

Search:

```bash
cd /root/tmp/unmissed-ai
rg "notification_logs|sendTelegram|telegram|sms|email|unbilled|notification-health" src supabase scripts
```

Document:
- where notification attempts are inserted
- where success/failure is stored
- where retries exist or do not exist
- which statuses suppress owner alerts

### Task 1.2: Query recent notification failures

Use service-role env from `/root/.secrets`, but never print secret values.

Run a small `npx tsx -e` query to count last 7 days:
- `notification_logs` by status/type
- failed Telegram sends
- failed SMS sends
- `unbilled` records
- completed calls with no owner notification

Expected output shape:

```text
notification_logs last_7d:
- sent: N
- failed: N
- unbilled: N
completed_calls_without_owner_alert: N
```

### Task 1.3: Add deterministic failure detector

Create `src/lib/notification-reliability.ts`:

```ts
export type NotificationReliabilityFinding = {
  severity: 'P0' | 'P1' | 'P2'
  kind: string
  callId?: string
  clientId?: string
  message: string
}

export function classifyNotificationGap(input: {
  callCompleted: boolean
  ownerAlertSent: boolean
  summaryGenerated: boolean
  classification: string | null
  notificationFailures: number
}): NotificationReliabilityFinding[] {
  const findings: NotificationReliabilityFinding[] = []

  if (input.callCompleted && !input.ownerAlertSent) {
    findings.push({
      severity: 'P0',
      kind: 'completed_call_without_owner_alert',
      message: 'Completed call has no owner alert.'
    })
  }

  if (input.callCompleted && !input.summaryGenerated) {
    findings.push({
      severity: 'P1',
      kind: 'completed_call_without_summary',
      message: 'Completed call has no generated summary.'
    })
  }

  if ((input.classification || '').toUpperCase() === 'UNKNOWN') {
    findings.push({
      severity: 'P1',
      kind: 'unknown_classification',
      message: 'Call classification is UNKNOWN; fallback owner alert required.'
    })
  }

  if (input.notificationFailures > 0) {
    findings.push({
      severity: 'P1',
      kind: 'notification_send_failures',
      message: 'One or more notification sends failed.'
    })
  }

  return findings
}
```

### Task 1.4: Test notification gap classifier

Create `src/lib/__tests__/notification-reliability.test.ts`:

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyNotificationGap } from '../notification-reliability'

test('completed call without owner alert is P0', () => {
  const findings = classifyNotificationGap({
    callCompleted: true,
    ownerAlertSent: false,
    summaryGenerated: true,
    classification: 'LEAD',
    notificationFailures: 0
  })

  assert.equal(findings[0]?.severity, 'P0')
  assert.equal(findings[0]?.kind, 'completed_call_without_owner_alert')
})

test('UNKNOWN classification requires fallback alert', () => {
  const findings = classifyNotificationGap({
    callCompleted: true,
    ownerAlertSent: true,
    summaryGenerated: true,
    classification: 'UNKNOWN',
    notificationFailures: 0
  })

  assert.ok(findings.some((f) => f.kind === 'unknown_classification'))
})
```

Run:

```bash
npx tsx --test src/lib/__tests__/notification-reliability.test.ts
```

### Task 1.5: Wire finding into notification-health endpoint

Modify `src/app/api/cron/notification-health/route.ts` so it returns:

```json
{
  "ok": false,
  "p0": [...],
  "p1": [...],
  "counts": {...}
}
```

Rules:
- P0 if any completed call lacks owner alert.
- P1 if UNKNOWN classification occurred without fallback alert.
- Do not spam Telegram on every cron run; alert only on new finding IDs or summary count changes.

### Task 1.6: Add fallback owner alert for UNKNOWN / classifier failure

In completed webhook path, ensure:

- If AI classifier fails or returns UNKNOWN, still send owner alert.
- Alert says classification failed but includes caller phone, transcript/recording link if available, and call ID.

Example owner alert copy:

```text
⚠️ Call received — classification failed
Caller: [masked phone]
Client: [business name]
Call ID: [id]
Summary may be incomplete. Review the recording/transcript in dashboard.
```

### Task 1.7: Validate Phase 1

Run:

```bash
npm run test:all
npm run build
```

Then commit:

```bash
git add src/lib/notification-reliability.ts src/lib/__tests__/notification-reliability.test.ts src/app/api/cron/notification-health/route.ts src/app/api/webhook/[slug]/completed/route.ts
git commit -m "Improve notification reliability detection"
git push origin main
```

Production smoke:

```bash
curl -sS https://endvoicemail.ai/api/health | jq .
curl -sS https://endvoicemail.ai/api/cron/notification-health -H "Authorization: Bearer $CRON_SECRET" | jq .
```

Acceptance criteria:
- Completed calls cannot silently miss owner notification.
- UNKNOWN classification still generates minimum owner alert.
- Notification health endpoint surfaces P0/P1 findings.

---

# Phase 2 — Adversarial Voice-Call Eval Harness

**Objective:** Turn ugly demo calls into repeatable regression tests.

**Files:**
- Inspect: `tests/public-demo/public-demo-transcript-eval.py`
- Create: `tests/voice-evals/adversarial-scenarios.json`
- Create: `tests/voice-evals/evaluate-transcript.ts`
- Create: `src/lib/__tests__/voice-eval-scorer.test.ts`
- Possibly create: `src/lib/voice-eval-scorer.ts`

### Task 2.1: Define scenario schema

Create `tests/voice-evals/adversarial-scenarios.json`:

```json
[
  {
    "id": "booking_off_topic_redirect",
    "title": "Off-topic interjection during booking",
    "caller_script": [
      "I want tomorrow at 5 pm.",
      "You smell that?",
      "Yes, tomorrow at 5."
    ],
    "must": [
      "acknowledge off-topic briefly",
      "redirect to booking",
      "confirm exact day and time before booking"
    ],
    "must_not": [
      "book Monday if caller said tomorrow",
      "treat nonsense as confirmation"
    ]
  },
  {
    "id": "booking_time_change",
    "title": "Caller changes requested time",
    "caller_script": [
      "Can I do Tuesday at 4:30?",
      "Actually make that 5."
    ],
    "must": [
      "use final requested time",
      "confirm final exact time"
    ],
    "must_not": [
      "book original time after caller changed it"
    ]
  }
]
```

### Task 2.2: Add deterministic transcript scorer

Create `src/lib/voice-eval-scorer.ts`:

```ts
export type VoiceEvalResult = {
  passed: boolean
  failures: string[]
}

export function scoreBookingTranscript(input: {
  transcript: string
  requestedDay?: string
  requestedTime?: string
  bookedDay?: string
  bookedTime?: string
  requiredPhrases?: string[]
  forbiddenPhrases?: string[]
}): VoiceEvalResult {
  const failures: string[] = []
  const text = input.transcript.toLowerCase()

  for (const phrase of input.requiredPhrases || []) {
    if (!text.includes(phrase.toLowerCase())) {
      failures.push(`Missing required phrase: ${phrase}`)
    }
  }

  for (const phrase of input.forbiddenPhrases || []) {
    if (text.includes(phrase.toLowerCase())) {
      failures.push(`Forbidden phrase present: ${phrase}`)
    }
  }

  if (input.requestedTime && input.bookedTime && input.requestedTime !== input.bookedTime) {
    failures.push(`Booked time ${input.bookedTime} does not match requested time ${input.requestedTime}`)
  }

  if (input.requestedDay && input.bookedDay && input.requestedDay !== input.bookedDay) {
    failures.push(`Booked day ${input.bookedDay} does not match requested day ${input.requestedDay}`)
  }

  return { passed: failures.length === 0, failures }
}
```

### Task 2.3: Test scorer

Create `src/lib/__tests__/voice-eval-scorer.test.ts` with:

- pass case: exact day/time confirmed
- fail case: caller requested tomorrow, agent booked Monday
- fail case: nonsense treated as confirmation

Run:

```bash
npx tsx --test src/lib/__tests__/voice-eval-scorer.test.ts
```

### Task 2.4: Add eval runner script

Create `tests/voice-evals/evaluate-transcript.ts`:

- Input: transcript JSON file or call ID.
- Output: pass/fail per scenario.
- No API calls by default.
- Optional live call fetch behind env flag.

Command:

```bash
npx tsx tests/voice-evals/evaluate-transcript.ts --transcript tests/fixtures/sample-booking-friction.json
```

### Task 2.5: Validate and commit Phase 2

Run:

```bash
npm run test:all
npm run build
```

Commit:

```bash
git add tests/voice-evals src/lib/voice-eval-scorer.ts src/lib/__tests__/voice-eval-scorer.test.ts
git commit -m "Add adversarial voice eval harness"
git push origin main
```

Acceptance criteria:
- Ugly transcript failures become repeatable tests.
- At least 10 scenarios exist before Phase 2 is considered complete.

---

# Phase 3 — Learning Loop Patch Queue

**Objective:** Convert learning-loop suggestions into a safe reviewed patch workflow instead of manual prompt surgery.

**Files:**
- Inspect: `src/app/api/admin/learning-bank/lessons/route.ts`
- Inspect: `src/app/api/admin/learning-bank/patterns/route.ts`
- Inspect: `src/app/api/admin/learning-bank/promote/route.ts`
- Inspect: learning-bank migrations under `supabase/migrations/`
- Create: `src/lib/learning-loop/patch-queue.ts`
- Create: `src/lib/__tests__/learning-loop-patch-queue.test.ts`

### Task 3.1: Map learning-bank data model

Search:

```bash
rg "learning_bank|learning-bank|lessons|patterns|promote" src supabase scripts
```

Document:
- existing tables
- current promotion path
- whether suggestions are tied to transcripts/call IDs
- whether application updates DB prompt, file prompt, or both

### Task 3.2: Define patch queue type

Create `src/lib/learning-loop/patch-queue.ts`:

```ts
export type LearningPatchStatus = 'suggested' | 'approved' | 'applied' | 'rejected'

export type LearningPatch = {
  id: string
  clientSlug: string
  category: 'EDGE_CASE' | 'FLOW_FIX' | 'STYLE' | 'TOOL_USE'
  rule: string
  why: string
  evidenceCallIds: string[]
  target: 'system_prompt' | 'prompt_helper' | 'tool_description'
  status: LearningPatchStatus
}

export function validateLearningPatch(patch: LearningPatch): string[] {
  const errors: string[] = []
  if (!patch.rule.trim()) errors.push('rule is required')
  if (!patch.why.trim()) errors.push('why is required')
  if (!patch.evidenceCallIds.length) errors.push('at least one evidence call is required')
  if (patch.rule.length > 500) errors.push('rule is too long; compress before applying')
  return errors
}
```

### Task 3.3: Add patch validation tests

Create `src/lib/__tests__/learning-loop-patch-queue.test.ts`:

- valid patch passes
- empty evidence fails
- long bloated rule fails

### Task 3.4: Add admin preview endpoint

Create or extend route:

`src/app/api/admin/learning-bank/preview-patch/route.ts`

Behavior:
- accepts learning patch
- returns proposed before/after prompt block
- does not mutate DB
- returns eval scenario stub

### Task 3.5: Add approved apply endpoint

Create or extend route:

`src/app/api/admin/learning-bank/apply-patch/route.ts`

Behavior:
- requires admin auth
- requires `approved: true`
- applies patch to correct target
- creates prompt version
- syncs Ultravox if live client
- records result

### Task 3.6: Validate and commit Phase 3

Run:

```bash
npm run test:all
npm run build
```

Commit:

```bash
git add src/lib/learning-loop src/lib/__tests__/learning-loop-patch-queue.test.ts src/app/api/admin/learning-bank
git commit -m "Add learning-loop patch queue"
git push origin main
```

Acceptance criteria:
- Learning suggestions can be previewed before application.
- Every applied suggestion has evidence, target, approval, prompt version, and sync result.

---

# Phase 4 — Prompt Drift Detection + Dual Pipeline Guard

**Objective:** Stop fixes from silently applying to one prompt pipeline but not the other.

**Files:**
- Inspect: `src/lib/prompt-slots.ts`
- Inspect: `src/lib/prompt-niches/voicemail-prompt.ts`
- Inspect: `src/lib/prompt-patcher.ts`
- Inspect: `src/lib/settings-patchers.ts`
- Inspect: `scripts/drift-check-all.ts`
- Create/modify: `src/lib/__tests__/prompt-dual-pipeline.test.ts`

### Task 4.1: Add dual-pipeline fixture test

Test must generate:
- one voicemail prompt
- one slot-pipeline prompt

Then assert key sections exist in both where applicable:
- booking rule section
- notification/summarization rule section
- capability/tool rules
- fallback handling rules

### Task 4.2: Add prompt patch no-op detection

Test patchers against both prompt types.

Expected:
- If patcher cannot operate on voicemail, it must explicitly route to full rebuild.
- Silent no-op is failure.

### Task 4.3: Add drift report script output

Ensure drift script reports:
- client slug
- prompt version
- chars added/dropped
- status: `ok`, `legacy_monolithic`, or `error`
- recommended action

### Task 4.4: Validate and commit

Run:

```bash
npm run test:all
npm run build
```

Commit:

```bash
git add src/lib/__tests__/prompt-dual-pipeline.test.ts scripts/drift-check-all.ts
git commit -m "Guard prompt drift across pipelines"
git push origin main
```

Acceptance criteria:
- Prompt-affecting changes fail tests if voicemail pipeline silently misses them.

---

# Phase 5 — Disaster Fallback Fire Drill

**Objective:** Prove the system degrades to fallback voicemail when primary voice path fails.

**Files:**
- Inspect: `cloudflare-workers/voice-fallback/src/index.ts`
- Inspect: `cloudflare-workers/voice-fallback/README.md`
- Inspect: `scripts/set-twilio-voice-fallback.ts`
- Inspect: `scripts/ingest-fallback-recordings.ts`
- Create: `docs/runbooks/voice-fallback-fire-drill.md`

### Task 5.1: Verify fallback worker health

Run documented worker smoke command from `cloudflare-workers/voice-fallback/README.md`.

Expected:
- `/health` returns ok.
- fallback domain resolves.

### Task 5.2: Dry-run Twilio fallback URLs

Run:

```bash
npx tsx scripts/set-twilio-voice-fallback.ts --dry-run
```

Expected:
- Lists all client numbers and expected fallback URL.
- No mutation.

### Task 5.3: Run controlled fallback test on demo number only

Do not mutate all customers.

- Select demo/test client number.
- Temporarily point primary voice route to failing endpoint or use Twilio fallback trigger method if supported.
- Place test call.
- Confirm fallback voicemail answers.
- Confirm Telegram operator alert fires.
- Confirm recording callback lands.

### Task 5.4: Test fallback ingestion

Run:

```bash
npx tsx scripts/ingest-fallback-recordings.ts --since=<ISO>
```

Expected:
- Creates or updates `call_logs` row with `source='fallback'`.
- No duplicate on repeated run.

### Task 5.5: Write fire-drill runbook

Create `docs/runbooks/voice-fallback-fire-drill.md` with:

- how to test
- how to recover
- how to backfill
- how to verify owner alert
- rollback steps

Commit:

```bash
git add docs/runbooks/voice-fallback-fire-drill.md
git commit -m "docs: add voice fallback fire drill runbook"
```

Acceptance criteria:
- Fallback path has been tested end-to-end on a safe demo number.

---

# Phase 6 — Billing / Minute Reconciliation

**Objective:** Make usage, minutes, failed calls, fallback calls, and unbilled events visible daily.

**Files:**
- Inspect: `src/app/api/cron/minute-usage-alert/route.ts`
- Inspect: billing routes under `src/app/api/billing/`
- Inspect: usage/call schemas in `src/lib/database.types.ts`
- Create: `src/lib/usage-reconciliation.ts`
- Create: `src/lib/__tests__/usage-reconciliation.test.ts`

### Task 6.1: Define reconciliation findings

Create deterministic logic:

```ts
export type UsageFinding = {
  severity: 'P0' | 'P1' | 'P2'
  kind: string
  message: string
}
```

Findings:
- completed call with null duration
- billable call not counted
- fallback call not counted
- negative/minute anomaly
- unbilled notification/call record

### Task 6.2: Add cron/report endpoint

Extend existing minute usage cron or create admin route:

`src/app/api/admin-tools/usage-reconciliation/route.ts`

Return:

```json
{
  "ok": true,
  "window": "24h",
  "calls": 123,
  "billableMinutes": 456,
  "unbilled": 0,
  "findings": []
}
```

### Task 6.3: Alert only on material anomalies

Rules:
- P0 immediately to operator Telegram.
- P1 daily summary only.
- P2 dashboard/report only.

### Task 6.4: Validate and commit

Run:

```bash
npm run test:all
npm run build
```

Commit:

```bash
git add src/lib/usage-reconciliation.ts src/lib/__tests__/usage-reconciliation.test.ts src/app/api/admin-tools/usage-reconciliation/route.ts
git commit -m "Add usage reconciliation checks"
git push origin main
```

Acceptance criteria:
- Daily report explains unbilled/uncounted usage before it becomes a customer problem.

---

# Phase 7 — Dashboard Live-State Clarity

**Objective:** Make it obvious whether a customer’s dashboard changes are live in the actual voice agent.

**Files:**
- Inspect: `src/app/dashboard/settings/*`
- Inspect: `src/app/api/dashboard/settings/sync-agent/route.ts`
- Inspect: `src/app/api/dashboard/settings/prompt-versions/route.ts`
- Possibly modify dashboard settings components

### Task 7.1: Add backend live-state payload

Route should return:

```json
{
  "clientId": "...",
  "dbPromptVersion": 16,
  "ultravoxAgentId": "...",
  "lastSyncedAt": "...",
  "toolsHash": "...",
  "promptHash": "...",
  "status": "synced|stale|error"
}
```

### Task 7.2: Add dashboard status card

UI copy:

- `Agent live and synced`
- `Changes saved but agent sync pending`
- `Sync failed — retry now`
- `Last test call: ...`

### Task 7.3: Add no-silent-save guard

After settings save:
- if prompt-affecting, show sync state
- if runtime-only, show “saved, no agent rebuild required”
- if sync fails, show visible error

### Task 7.4: Validate and commit

Run:

```bash
npm run test:all
npm run build
```

Commit:

```bash
git add src/app/api/dashboard/settings src/app/dashboard/settings src/components
git commit -m "Show live agent sync state in dashboard"
git push origin main
```

Acceptance criteria:
- User can tell if dashboard settings are actually live in the voice agent.

---

# Phase 8 — Demo Follow-Up / Conversion Engine

**Objective:** Turn impressive demos into follow-up actions and qualified leads.

**Files:**
- Inspect: `src/app/api/cron/demo-followup/route.ts`
- Inspect: demo call tables/types
- Inspect: dashboard demo pages
- Create: `src/lib/demo-lead-scoring.ts`
- Create: `src/lib/__tests__/demo-lead-scoring.test.ts`

### Task 8.1: Define demo lead score

Signals:
- requested callback
- asked price
- asked setup/how-it-works
- completed full demo
- gave valid business details
- call duration
- explicit objection

Return:

```ts
export type DemoLeadScore = {
  score: number
  temperature: 'hot' | 'warm' | 'cold'
  reasons: string[]
  nextAction: string
}
```

### Task 8.2: Add scoring tests

Cases:
- hot: pricing + setup + callback
- warm: completed demo but vague
- cold: prank/nonsense/short hangup

### Task 8.3: Add owner alert next action

Demo summary should say:

```text
Hot demo lead
Why: asked about setup + pricing
Next action: call within 10 minutes and say: “Saw you tested the demo — want me to set up your actual business line?”
```

### Task 8.4: Validate and commit

Run:

```bash
npm run test:all
npm run build
```

Commit:

```bash
git add src/lib/demo-lead-scoring.ts src/lib/__tests__/demo-lead-scoring.test.ts src/app/api/cron/demo-followup/route.ts
git commit -m "Add demo lead scoring and follow-up guidance"
git push origin main
```

Acceptance criteria:
- Every serious demo produces a clear next action for Hasan.

---

# Final Release Checklist

After all phases:

```bash
cd /root/tmp/unmissed-ai
git status --short --untracked-files=all
npm run test:all
npm run build
git log --oneline -10
git push origin main
railway status
curl -sS https://endvoicemail.ai/api/health | jq .
```

Final production verification:

- Place one ugly booking call.
- Place one ordinary voicemail call.
- Trigger one demo callback.
- Confirm owner notification for all three.
- Confirm dashboard call logs for all three.
- Confirm no failed notification health findings.
- Confirm no prompt drift P0/P1.
- Confirm usage reconciliation clean.

---

# Execution Order Summary

1. Phase 0 — baseline and repo hygiene.
2. Phase 1 — notification reliability.
3. Phase 2 — adversarial voice eval harness.
4. Phase 3 — learning-loop patch queue.
5. Phase 4 — prompt drift guard.
6. Phase 5 — fallback fire drill.
7. Phase 6 — billing/minute reconciliation.
8. Phase 7 — dashboard live-state clarity.
9. Phase 8 — demo follow-up/conversion engine.

If time is limited, ship only the first three:

1. Notification reliability.
2. Adversarial eval harness.
3. Learning-loop patch queue.

Those three most directly move the product from demo toy to dependable business system.
