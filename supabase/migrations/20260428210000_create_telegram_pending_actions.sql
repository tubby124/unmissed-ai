-- Telegram Tier 3 — confirmable mutations + reply audit + per-client spend cap.
--
-- Three schema additions land together because Tier 3 ships as a single PR
-- and these are the only DB changes the feature needs:
--
--   1. telegram_pending_actions  — DB-backed 60s TTL store for confirm tokens
--      (cf:<uuid>). In-memory tokens would void on Railway redeploy mid-flow,
--      silently breaking destructive mutations like "mark called back".
--   2. telegram_reply_audit       — 1% sampling of NL replies for hallucination
--      review. PII-free: system prompt is hashed, raw user message is never
--      stored (inherits Tier 2 L10 no-PII rule).
--   3. clients.telegram_assistant_cap_usd — per-client monthly LLM spend cap.
--      Default $5.00. When MTD spend ≥ cap, NL Q&A throttles to a polite
--      reply; Tier 1 commands (/calls, /missed, /minutes, …) keep working.
--
-- All RLS policies are service-role-only. Telegram handlers run with the
-- service-role key; clients never read or write these tables directly.

-- ── 1. telegram_pending_actions ─────────────────────────────────────────────
-- Confirm-token TTL store. Each row is a destructive mutation (cb_lead,
-- mark_called_back) that has been *proposed* but not yet *confirmed*. The
-- token in callback_data is the row's UUID; resolvePendingAction()
-- validates (chat_id, expires_at) before consuming the row.
--
-- Multi-tenant guard: chat_id is part of the resolver SELECT. A token
-- issued in chat A cannot be redeemed from chat B — the SELECT returns
-- nothing, indistinguishable from expiry. No information leak.
--
-- Token format on the wire: "cf:<uuid_v4>" (39 bytes, well under
-- Telegram's 64-byte callback_data cap per L14).

CREATE TABLE IF NOT EXISTS public.telegram_pending_actions (
  token        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id      bigint      NOT NULL,
  client_id    uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  action_kind  text        NOT NULL CHECK (action_kind IN ('mark_called_back','call_back_lead')),
  payload      jsonb       NOT NULL,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Sweeper helper index. The resolver runs a "delete expired on every read"
-- pattern (simpler than pg_cron in Supabase). Volume is ≤5 rows in flight
-- at any moment so the index stays cheap.
CREATE INDEX IF NOT EXISTS idx_tg_pending_chat_expires
  ON public.telegram_pending_actions (chat_id, expires_at);

ALTER TABLE public.telegram_pending_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role full access" ON public.telegram_pending_actions;
CREATE POLICY "service role full access"
  ON public.telegram_pending_actions
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ── 2. telegram_reply_audit ────────────────────────────────────────────────
-- 1% sample of NL replies. Captures enough to manually review hallucination
-- rate without storing the user's free-text question (PII).
--
-- Fields:
--   system_prompt_hash — sha256 hex of the assembled prompt. Hashed because
--                        the prompt embeds business_facts + extra_qa which
--                        the customer owns.
--   reply              — the LLM's reply text. Already rendered to the user
--                        in chat, so storing it here is not new exposure.
--   recent_calls_count — how many calls were in context (size of citation pool).
--   citation_passed    — boolean from citationGuardOk(reply, recentCalls).
--   intent             — inferIntent() label (urgent/today/missed/general/…).
--
-- At ~3 audit rows per month per the L20 estimate (5 active clients × 60
-- turns/mo × 1%), retention is the 90-day DELETE in commit 7.

CREATE TABLE IF NOT EXISTS public.telegram_reply_audit (
  id                  bigserial   PRIMARY KEY,
  client_id           uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  system_prompt_hash  text        NOT NULL,
  reply               text        NOT NULL,
  recent_calls_count  integer     NOT NULL,
  citation_passed     boolean     NOT NULL,
  intent              text        NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tg_reply_audit_client_created
  ON public.telegram_reply_audit (client_id, created_at DESC);

ALTER TABLE public.telegram_reply_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role full access" ON public.telegram_reply_audit;
CREATE POLICY "service role full access"
  ON public.telegram_reply_audit
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ── 3. clients.telegram_assistant_cap_usd ──────────────────────────────────
-- Monthly LLM spend cap per client. NUMERIC(10,4) gives 6 digits before the
-- decimal and 4 after — enough for $0.0001 precision and any realistic cap
-- ($0.00 to $999,999.9999).
--
-- Default $5.00 matches the design doc spec. Existing rows pick up the
-- default on backfill (NOT NULL DEFAULT) so no per-client UPDATE is required.
-- Setting cap to 0 disables the throttle entirely (cap > 0 check in the
-- handler).

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS telegram_assistant_cap_usd numeric(10,4) NOT NULL DEFAULT 5.00;
