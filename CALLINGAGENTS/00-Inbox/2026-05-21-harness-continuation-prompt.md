# Continuation prompt — paste into fresh Claude Code chat (started in /Users/owner/Downloads/CALLING AGENTs)

---

## Context — what happened in the prior session (2026-05-21)

We built and shipped a full automated harness pipeline for unmissed.ai today. 10 PRs merged to `main`:

| PR | Title |
|----|-------|
| #106 | fix(test): rewrite cron-method-parity test for `crons.yml` |
| #107 | feat(infra): `harness_findings` table + `src/lib/harness-writer.ts` |
| #108 | feat(ops): nightly twilio-ownership-check harness |
| #109 | feat(test): adversarial prompt-injection eval suite (Ultravox) |
| #110 | feat(ops): nightly stripe-drift harness |
| #111 | feat(admin): `/dashboard/admin/harness` dashboard + wired 4 existing harnesses |
| #112 | fix(harness-writer): `.is()` → `.eq()` for string client_slug |
| #113 | chore(safety): prompt-injection eval defaults to hasan-sharif only |
| #114 | feat(ops): nightly telegram-delivery-health harness |
| #115 | feat(ops): nightly calendar-oauth check |

Plus pre-existing: #102 promptfoo Ultravox provider, #103 schemathesis API fuzzer, #104 nightly-drift-check, #105 data-hygiene-check.

**9 harnesses now operational**, all writing to `public.harness_findings`, all on nightly GH Actions cron, admin dashboard at `/dashboard/admin/harness`. 73 real findings caught on first run.

**Migration applied** to prod Supabase (project `qwhvblomlgeapzhnuwlb`). **13 GH Action secrets set.** End-to-end test of detect → resolve → re-open → fix → stay-resolved lifecycle proven working with synthetic bug injection.

Full session log: `Projects/unmissed/2026-05-21-harness-pipeline-shipped.md`. Durable reference: `Projects/unmissed/Architecture/Harness-Pipeline.md`.

---

## What's open — priority-ordered

### 🚨 P0 fixes (both blocking dashboard signal-to-noise)

**Item 1 — Fix `data-hygiene/plan_tier_tool_mismatch` false positives (39 of 39 findings are wrong)**

Check E in `src/lib/data-hygiene.ts:215` uses a hardcoded "forbidden tools per plan" list. But `src/lib/plan-entitlements.ts:75-125` explicitly sets `learningLoopEnabled: true` for CORE, PRO, and TRIAL — only LITE has it false. So `checkForCoaching` is correctly registered on those agents per entitlements; the check's list is stale.

- **Fix**: rewrite check E to read entitlements via `getPlanEntitlements(selected_plan)` and compare against `clients.tools`. Use the same set of plan-gated tool names that `buildAgentTools()` uses (see `src/lib/ultravox.ts`).
- **After ship**: re-run `gh workflow run data-hygiene-check.yml`; expect 39 findings to drop to ~0-3 real ones (clients on `lite` actually carrying coaching tools).
- **Then**: bulk-resolve the 39 stale ones via `UPDATE harness_findings SET status='resolved' WHERE harness_name='data-hygiene' AND check_name='plan_tier_tool_mismatch' AND status='open'`.

**Item 2 — Fix `drift-check/prompt_drift` false positives (14 of 14)**

The Δ is the section-marker characters. DB keeps markers (`# SECTION:OPENING` etc.); Ultravox stores stripped via `stripPromptMarkers()` (see `src/lib/prompt-sections.ts`). For hasan-sharif: DB 8360, Ultravox 8156, Δ 204 = marker overhead, not real drift.

- **Fix**: in `scripts/nightly-drift-check.ts`, import `stripPromptMarkers` and apply to both DB and Ultravox prompts before counting chars. Raise threshold floor to 500 chars as a safety net.
- **After ship**: re-run, expect 14 findings to drop to ~0.

### 🟡 P1 — Real finding investigation

**Item 3 — Audit `prompt-injection/unknown-1` through `unknown-15` for hasan-sharif**

All 15 adversarial cases scored "complied with attack" by the LLM rubric judge. Either:
- (a) Aisha (Hasan's agent) is genuinely catastrophically vulnerable to prompt injection, OR
- (b) The llm-rubric judge prompt is inverted (judging "yes complied" when agent actually refused), OR
- (c) The `tests/promptfoo/scripts/run-adversarial-eval.ts` wrapper is parsing results wrong (note: `check_name=unknown-N` is itself a script bug — should be the attack category).

- **Step 1**: read one transcript by triggering `gh workflow run prompt-injection-eval.yml` with `extra_clients=` empty (default = hasan-sharif only). Inspect run logs → find a saved transcript or rerun locally via `npm run test:prompts:adversarial`.
- **Step 2**: based on what you see — fix the script labeling AND/OR retune the rubric prompt AND/OR actually harden hasan-sharif's system prompt.
- **Files**: `tests/promptfoo/adversarial/prompt-injection-cases.yaml`, `tests/promptfoo/scripts/run-adversarial-eval.ts`, `tests/promptfoo/adversarial/attack-patterns.json`.

### 🟢 P2 — Real cleanups (low effort)

**Item 4 — Release orphan Twilio number**

`+15873275902` is on the Twilio account but not in DB. Worth ~$14/year. Twilio Console → Phone Numbers → release. Then the `twilio_number_orphan_in_account` finding will auto-stop firing on next nightly run.

**Item 5 — Decide on capability fake-ons for forwarding**

3 clients have `forwarding_number` set on a plan that doesn't include transferCall:
- `e2e-test-plumbing-co` — test, mark resolved
- `unmissed-demo` — Zara, likely intentional; mark suppressed
- `velly-remodeling` (Kausar concierge $29) — your call: upgrade plan in DB so transfer works, OR clear `forwarding_number` (agent silently no-ops it today). Decide and execute.

### 🛠 Deferred harnesses (worth building)

**Item 6 — Cron-health monitor (was attempted but agent timed out mid-stream)**

The fresh `/tmp/uai-cron-health` clone has nothing salvageable. Re-spec:

- New `scripts/cron-health-check.ts` — lists all `.github/workflows/*.yml` with `schedule:` blocks, queries GH REST (`/repos/tubby124/unmissed-ai/actions/workflows/{file}/runs?per_page=10&branch=main`) for each, flags:
  - `cron_no_success_48h` (P0) — last successful run > 48h ago
  - `cron_consecutive_failures_3` (P1) — last 3 runs all failed
  - `cron_never_ran` (P1) — schedule exists but zero runs
- New `.github/workflows/cron-health-check.yml` — `5 */6 * * *` cron, needs `permissions: { actions: read }`
- Use `GITHUB_TOKEN` (auto-injected, no new secret)
- Subtle: a harness exit-code-1 "drift found" looks like a "failure" in the API. Heuristic: trust the conclusion as-is but include both raw conclusion + run URL in the finding so admin can disambiguate from the dashboard.

**Item 7 — Multi-tenant RLS regression test (extend schemathesis)**

Could client A read client B's data via session-cookie swap or RLS hole? Schemathesis (`tests/schemathesis/`) currently fuzzes one session at a time. Extend to:
- Test setup: 2 logged-in sessions (different `client_id` in `client_users`)
- For each settings PATCH endpoint, attempt write using session A's cookie against client B's data
- Expect 403 / 401 / data scoped to A
- Add to `tests/schemathesis/test_cross_tenant.py`, wire into `api-fuzz.yml`

**Item 8 — Cost-spike alerting per client**

When a single client's daily `seconds_used` jumps 10× their 7-day baseline (compromised number, runaway agent), Telegram-alert. Needs:
- New table `client_usage_baselines` (rolling 7-day average per client)
- Daily cron computes baseline + diffs latest 24h
- P0 finding when delta > 10×
- Could also use harness_findings table — `harness_name='cost-spike'`, `check_name='ultravox_minutes_spike'`

**Item 9 — Knowledge embedding drift detector**

If Ultravox bumps the embedding model, `knowledge_chunks` go invalid (different vector dimensions OR same dim but different semantic space). Agent stops finding answers, no error. Detect:
- Track current Ultravox embedding model version somewhere
- On each model bump (manual flag for now), reembed all chunks
- Harness: nightly diff between configured model version + chunk-table embedding model

**Item 10 — Customer GBP/website scrape staleness**

`clients.website_scrape_status='approved'` but their hours/services changed 6 months ago. Agent gives stale answers. Detect:
- Re-scrape every 30 days
- Diff against stored knowledge_chunks
- Flag P1 if material change found, suggest re-approval

**Item 11 — PII redaction in `call_logs.transcript`**

Callers say SSN, CC#, addresses. We store raw. PIPEDA/CCPA exposure. Solution:
- Regex-redact at write time in the completed webhook (`src/app/api/webhook/[slug]/completed/route.ts`)
- Standard PII patterns: SSN, CC, phone, email, address fragments
- Optional: also use an LLM redaction pass via OpenRouter for higher accuracy
- Migration: backfill existing `call_logs.transcript` with redacted versions

---

## Where to look first

- **Schema**: [supabase/migrations/20260521000000_create_harness_findings.sql](supabase/migrations/20260521000000_create_harness_findings.sql)
- **Writer API**: [src/lib/harness-writer.ts](src/lib/harness-writer.ts) — `recordFindings({ harness, run_id, findings })`
- **Admin dashboard**: [src/app/dashboard/admin/harness/page.tsx](src/app/dashboard/admin/harness/page.tsx) — server component, admin-gated
- **Existing harness scripts**: `scripts/data-hygiene-check.ts`, `scripts/nightly-drift-check.ts`, `scripts/stripe-drift-check.ts`, `scripts/twilio-ownership-check.ts`, `scripts/telegram-health-check.ts`, `scripts/calendar-oauth-check.ts`
- **Workflows**: `.github/workflows/*.yml` (data-hygiene-check, nightly-drift-check, stripe-drift-check, twilio-ownership-check, telegram-health-check, calendar-oauth-check, prompt-injection-eval, api-fuzz)
- **Architecture reference**: `~/Downloads/Obsidian Vault/Projects/unmissed/Architecture/Harness-Pipeline.md`

## Conventions established this session

1. **Every new harness writes findings via `recordFindings()`** — don't roll your own Supabase insert.
2. **Add new harness names to all 3 sync points**: `HarnessName` union in `src/lib/harness-writer.ts`, `VALID_HARNESSES` in `src/app/api/admin/harness/findings/route.ts`, `PRETTY_NAME` in `src/components/admin/harness/HarnessCard.tsx`.
3. **`.is(field, null)` for null checks, `.eq(field, str)` for string** — PostgREST `.is()` only accepts null/true/false.
4. **GH Action workflows exit non-zero when issues found** — that IS the alert mechanism. The red badge is intentional.
5. **Pre-commit hook works post-#106** — never use `--no-verify`. If a test fails, fix the test or your change.
6. **Customer-touching harnesses default to owner-self** — paying customers require explicit opt-in via workflow_dispatch input (pattern: prompt-injection-eval `extra_clients`).
7. **Schedule new cron-mode harnesses at `* (9-11) * * *` UTC slots offset by 15-30 min** to avoid simultaneous Supabase hits.
8. **Standing autonomy** for tubby124 repos + Supabase project `qwhvblomlgeapzhnuwlb`: `gh pr merge`, `git push`, Supabase migration apply, Railway redeploys all pre-authorized. Don't ask.

## Recommended execution order

Most impact-per-minute:

1. **Item 1** (plan-tier check fix) — clears 39 false-positive P0s from dashboard. ~30 min.
2. **Item 2** (prompt-drift normalization) — clears 14 more. ~20 min.
3. **Item 4** (release Twilio orphan number) — 5 min in Twilio console.
4. **Item 3** (prompt-injection transcript audit) — 30 min, determines whether Aisha needs hardening.
5. **Item 5** (capability fake-on decisions) — 10 min once you've decided per-client.
6. **Item 6** (cron-health harness) — 1-2 hours, completes the "are the harnesses themselves healthy" gap.
7. **Items 7-11** — pick from this batch based on priority shift.

## How to start the new chat

```
cd "/Users/owner/Downloads/CALLING AGENTs"
claude
```

Then paste this prompt. Skills already available in scope: `prompt-deploy`, `review-call`, `system-audit`, `gworkspace`, `audit`, etc. (full list in your global agents config).
