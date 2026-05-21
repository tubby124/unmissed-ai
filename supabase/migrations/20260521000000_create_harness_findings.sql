-- harness_findings: single audit log written by every harness (data-hygiene,
-- drift-check, schemathesis, promptfoo, stripe-drift, twilio-ownership,
-- prompt-injection) and read by /admin/harness dashboard.
--
-- One row per (harness_name, run_id, check_name, client_slug). Re-runs that
-- produce identical findings update updated_at + run_id via the unique key,
-- so dashboard reads only the latest snapshot per finding.

CREATE TABLE IF NOT EXISTS public.harness_findings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  harness_name  text NOT NULL,
  run_id        text NOT NULL,
  check_name    text NOT NULL,
  severity      text NOT NULL CHECK (severity IN ('P0','P1','P2','PASS')),
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','suppressed')),
  client_slug   text,
  summary       text NOT NULL,
  details       jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  resolved_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  suppressed_until timestamptz,

  CONSTRAINT harness_findings_uniq UNIQUE (harness_name, check_name, client_slug)
);

CREATE INDEX IF NOT EXISTS harness_findings_status_idx
  ON public.harness_findings(status, severity);
CREATE INDEX IF NOT EXISTS harness_findings_last_seen_idx
  ON public.harness_findings(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS harness_findings_harness_idx
  ON public.harness_findings(harness_name, last_seen_at DESC);

ALTER TABLE public.harness_findings ENABLE ROW LEVEL SECURITY;

-- Admin reads only. Anonymous + authenticated client users get nothing.
CREATE POLICY harness_findings_admin_select ON public.harness_findings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_users
      WHERE client_users.user_id = auth.uid()
        AND client_users.role = 'admin'
    )
  );

-- Admin can mark resolved / suppressed. Insert path is service_role only
-- (harnesses use SUPABASE_SERVICE_ROLE_KEY which bypasses RLS by design).
CREATE POLICY harness_findings_admin_update ON public.harness_findings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.client_users
      WHERE client_users.user_id = auth.uid()
        AND client_users.role = 'admin'
    )
  );

COMMENT ON TABLE public.harness_findings IS
  'Findings written by every harness (data-hygiene, drift-check, schemathesis, promptfoo, stripe-drift, twilio-ownership, prompt-injection). Read by /admin/harness dashboard. See src/lib/harness-writer.ts for write API.';

COMMENT ON COLUMN public.harness_findings.harness_name IS
  'Stable identifier matching the harness''s script file: data-hygiene, drift-check, stripe-drift, twilio-ownership, prompt-injection, schemathesis, promptfoo.';

COMMENT ON COLUMN public.harness_findings.check_name IS
  'Sub-check identifier within the harness. E.g. data-hygiene has: stale_injected_note, content_red_flag, trial_status_drift, etc.';

COMMENT ON COLUMN public.harness_findings.severity IS
  'P0 = customer-visible/data-loss/billing wrong. P1 = silent fakery/latent risk. P2 = cleanup. PASS = check ran and was healthy (use sparingly — only for dashboard greens).';
