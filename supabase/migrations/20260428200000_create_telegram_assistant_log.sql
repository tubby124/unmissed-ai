-- Telegram Tier 2 cost telemetry — token counts + outcome only.
-- PII-free by design: no message text, no reply text, no caller data.

CREATE TABLE IF NOT EXISTS public.telegram_assistant_log (
  id              bigserial PRIMARY KEY,
  chat_id         bigint      NOT NULL,
  client_id       uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  model           text        NOT NULL,
  input_tokens    integer     NOT NULL DEFAULT 0,
  output_tokens   integer     NOT NULL DEFAULT 0,
  latency_ms      integer     NOT NULL DEFAULT 0,
  outcome         text        NOT NULL CHECK (outcome IN ('ok','timeout','fallback','error')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tg_assistant_log_client_created
  ON public.telegram_assistant_log (client_id, created_at DESC);

ALTER TABLE public.telegram_assistant_log ENABLE ROW LEVEL SECURITY;

-- Service role only. Cost telemetry is operator-only — clients never read it.
DROP POLICY IF EXISTS "service role full access" ON public.telegram_assistant_log;
CREATE POLICY "service role full access"
  ON public.telegram_assistant_log
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
