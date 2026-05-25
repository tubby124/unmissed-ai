# Telegram-first Learning Loop approval MVP

Date: 2026-05-25
Status: implementation-ready

## Product shape

Learning Loop suggestions should reach the client where they already receive call alerts: Telegram. The dashboard remains the audit/history surface, but Telegram is the approval surface.

## Flow

1. A call ends and analysis/backfill detects a useful improvement.
2. System creates `learning_loop_suggestions` row with evidence, risk, and proposed patch.
3. If client has Telegram connected and the patch is eligible for client approval, bot sends:
   - what happened
   - suggested update
   - why it helps
   - Approve / Reject buttons
4. Telegram callback verifies:
   - private chat
   - chat belongs to same client
   - suggestion is pending/sent
   - risk + patch type allow client approval
5. Approved suggestion applies through safe mutation path:
   - FAQ/business-fact changes update DB knowledge fields
   - prompt is recomposed/synced to Ultravox when supported
   - prompt version/audit row is created by existing prompt-version path
6. Bot confirms success/failure to client.
7. Dashboard can list suggestions by status later.

## Safety model

Client-approvable in Telegram:
- `extra_qa_append`
- `business_fact_append`
- low-risk operational wording with no legal/pricing/billing/medical/financial claims

Operator-review required:
- pricing
- legal/compliance
- booking/calendar tool logic
- transfers
- outbound SMS/calls
- payment/refund policy
- anything high risk
- direct system prompt edits for normal clients

## Backfill

Backfill job can scan recent call logs for:
- `faq_suggestions`
- low-confidence/UNKNOWN calls
- repeated unanswered questions
- friction summaries from Learning Loop

Backfill should create suggestions only. It must not message clients until an operator/admin dry-run is verified.

## Verification gates

Before client-visible sends:
1. Create internal/demo suggestion.
2. Send to Hasan/internal Telegram only.
3. Approve in Telegram.
4. Verify DB status changed.
5. Verify prompt/knowledge field changed.
6. Verify prompt version or sync result recorded.
7. Smoke a demo call or prompt fetch.

Important precondition: client-approved auto-apply requires a slot-format prompt (`<!-- unmissed:identity -->`) so `recomposePrompt()` can rebuild and sync safely. Legacy monolithic prompts must be migrated first or routed to operator review. Phase 3 internal verification proved this guard: `unmissed-demo` is legacy, so the approval path refused to mutate DB knowledge before sync.

## MVP endpoints/modules

- DB: `learning_loop_suggestions`
- Library: `src/lib/learning-loop/approval.ts`
- Telegram webhook: callback `ll:approve:<id>` / `ll:reject:<id>`
- Optional internal admin/backfill route after primitives are tested.

## Phase 3 implementation checkpoint

Implemented primitives:
- durable `learning_loop_suggestions` migration
- Telegram callback handling for `ll:approve:<uuid>` and `ll:reject:<uuid>`
- low-risk client approval policy for FAQ/business-fact additions only
- system prompt appends reserved for operator path
- internal verification script proved legacy prompts are blocked before mutation

Not enabled yet:
- no automated client-visible suggestion sends
- no broad backfill sends
- no auto-apply for legacy monolithic prompts
