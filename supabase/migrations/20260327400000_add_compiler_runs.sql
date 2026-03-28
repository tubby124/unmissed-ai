-- Migration: compiler_runs table + compile_run_id on knowledge_chunks
-- Tracks provenance for AI Compiler sessions (model, counts, input hash)

CREATE TABLE IF NOT EXISTS compiler_runs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  model_used          TEXT        NOT NULL,
  raw_input_hash      TEXT        NOT NULL,
  total_extracted     INT         NOT NULL DEFAULT 0,
  approved_count      INT         NOT NULL DEFAULT 0,
  rejected_count      INT         NOT NULL DEFAULT 0,
  high_risk_count     INT         NOT NULL DEFAULT 0,
  faq_count           INT         NOT NULL DEFAULT 0,
  chunk_count         INT         NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_compiler_runs_client_id ON compiler_runs(client_id);

-- Add compile_run_id FK to knowledge_chunks
ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS compile_run_id UUID REFERENCES compiler_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_compile_run_id ON knowledge_chunks(compile_run_id);

-- RLS: owners see their own compiler_runs; admins see all
ALTER TABLE compiler_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compiler_runs_owner_select" ON compiler_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM client_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.client_id = compiler_runs.client_id
    )
  );

CREATE POLICY "compiler_runs_service_all" ON compiler_runs
  FOR ALL USING (auth.role() = 'service_role');
