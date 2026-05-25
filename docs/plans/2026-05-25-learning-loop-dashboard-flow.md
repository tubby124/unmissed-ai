# Learning Loop dashboard flow — EndVoicemail

Date: 2026-05-25
Tracker: `docs/tracker/D437.md`

## Why

Learning Loop should not be a black-box prompt mutator. Real calls generate useful friction signals, but production prompts/tools/calendar/notifications affect real businesses. The safe model is a dashboard-backed patch queue with evidence and regression gates.

## UX shape

### Command Center card

Show a small card:

- Pending suggestions: count
- High-risk suggestions: count
- Applied this week: count
- Regressions failing: count
- CTA: `Review Learning Loop`

### `/dashboard/learning-loop`

Sections:

1. **Needs review**
   - category: edge case, flow fix, prompt drift, tool bug, routing bug, knowledge gap
   - risk: low / medium / high
   - client / demo / niche
   - source call evidence
   - suggested patch summary

2. **Suggestion detail**
   - exact caller quote/transcript excerpt
   - what went wrong
   - proposed rule/change
   - affected surfaces:
     - repo prompt/source
     - live `clients.system_prompt`
     - `business_facts`
     - `extra_qa`
     - `knowledge_chunks`
     - tool description / route code
   - regression plan
   - buttons: Reject, Edit, Approve, Apply + Sync

3. **Applied / audit trail**
   - prompt version
   - commit SHA if code changed
   - deploy ID if runtime changed
   - eval/test evidence
   - rollback link/status

## Data model sketch

Table: `learning_loop_suggestions`

Fields:

- `id`
- `client_id`
- `call_log_id` / `demo_call_id`
- `category`
- `severity`
- `risk_level`
- `status`
- `failure_summary`
- `caller_quote`
- `transcript_excerpt`
- `proposed_change`
- `affected_surfaces`
- `dedupe_key`
- `suggested_by` (`learning_loop`, `operator`, `manual`)
- `reviewed_by`
- `reviewed_at`
- `applied_at`
- `prompt_version_id`
- `commit_sha`
- `deployment_id`
- `rollback_notes`

Table: `learning_loop_regressions`

Fields:

- `suggestion_id`
- `test_type` (`unit`, `promptfoo`, `manual_smoke`, `live_call`)
- `test_path`
- `status`
- `output_summary`
- `run_at`

## Safety rules

- Low-risk copy/routing clarifications can be approved quickly but still need regression coverage.
- High-risk areas require manual approval and explicit deploy/sync confirmation:
  - pricing
  - legal/compliance
  - outbound calls/texts
  - booking/calendar
  - transfers
  - billing/minutes
  - client-specific business policy
- Suggestions are never “done” until the dashboard shows one of:
  - `rejected`
  - `applied + synced`
  - `applied + deployed`

## Example: nonsense booking case

Suggestion card:

- Category: EDGE_CASE + FLOW_FIX
- Risk: medium/high because booking/calendar
- Evidence: caller said “You smell that?” during booking confirmation
- Problem: agent treated off-topic phrase as confirmation / changed requested time
- Proposed rule: briefly acknowledge and redirect; do not book until exact day/time is confirmed
- Regression:
  - `src/lib/__tests__/learning-loop-demo-regressions.test.ts`
  - `tests/promptfoo/learning-loop-demo-regressions.yaml`
- Status after this phase: applied + deployed
