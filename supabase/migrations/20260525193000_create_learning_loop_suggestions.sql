-- D437 Phase 3: Telegram-first Learning Loop approval queue

CREATE TABLE IF NOT EXISTS public.learning_loop_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  source_call_id uuid NULL REFERENCES public.call_logs(id) ON DELETE SET NULL,

  category text NOT NULL DEFAULT 'knowledge_gap' CHECK (category IN (
    'knowledge_gap',
    'edge_case',
    'flow_fix',
    'prompt_drift',
    'tool_bug',
    'routing_bug',
    'ops_improvement'
  )),
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  patch_type text NOT NULL CHECK (patch_type IN (
    'extra_qa_append',
    'business_fact_append',
    'system_prompt_append'
  )),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'sent_to_client',
    'approved',
    'rejected',
    'applied',
    'needs_operator_review',
    'failed'
  )),

  title text NOT NULL,
  summary text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  proposed_patch jsonb NOT NULL DEFAULT '{}'::jsonb,

  sent_to_chat_id text NULL,
  sent_at timestamptz NULL,
  decided_by_chat_id text NULL,
  decided_at timestamptz NULL,
  applied_at timestamptz NULL,
  applied_prompt_version_id uuid NULL REFERENCES public.prompt_versions(id) ON DELETE SET NULL,
  error text NULL,

  created_by text NOT NULL DEFAULT 'learning_loop',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_loop_suggestions_client_status
  ON public.learning_loop_suggestions(client_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_loop_suggestions_source_call
  ON public.learning_loop_suggestions(source_call_id) WHERE source_call_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_learning_loop_suggestions_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_learning_loop_suggestions_updated_at ON public.learning_loop_suggestions;
CREATE TRIGGER trg_learning_loop_suggestions_updated_at
  BEFORE UPDATE ON public.learning_loop_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.touch_learning_loop_suggestions_updated_at();

ALTER TABLE public.learning_loop_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "learning_loop_admin_service_all" ON public.learning_loop_suggestions;
CREATE POLICY "learning_loop_admin_service_all"
  ON public.learning_loop_suggestions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "learning_loop_client_users_read" ON public.learning_loop_suggestions;
CREATE POLICY "learning_loop_client_users_read"
  ON public.learning_loop_suggestions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_users cu
      WHERE cu.client_id = learning_loop_suggestions.client_id
        AND cu.user_id = auth.uid()
    )
  );
