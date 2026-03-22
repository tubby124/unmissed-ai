-- L5: Per-call transcript analysis results
-- Written by completed webhook (server-side keyword analysis)
-- Read by dashboard call-insights API + future L6 aggregation
--
-- How to edit:
-- - Add columns: ALTER TABLE call_insights ADD COLUMN ...
-- - Add indexes: CREATE INDEX idx_call_insights_... ON call_insights(...)
-- - The UNIQUE on call_id prevents duplicate analysis from webhook retries (R3)

CREATE TABLE IF NOT EXISTS call_insights (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id uuid REFERENCES call_logs(id) NOT NULL,
  client_id uuid REFERENCES clients(id) NOT NULL,

  -- Detected gaps (questions agent couldn't answer)
  unanswered_questions jsonb DEFAULT '[]' NOT NULL,

  -- Feature suggestions (capabilities caller tried to use but aren't enabled)
  feature_suggestions jsonb DEFAULT '[]' NOT NULL,

  -- Quality signals
  caller_frustrated boolean DEFAULT false NOT NULL,
  repeated_questions int DEFAULT 0 NOT NULL,
  agent_confused_moments int DEFAULT 0 NOT NULL,

  -- Metadata
  source text DEFAULT 'keyword' NOT NULL,  -- 'keyword' | 'llm' (for future L5b)
  created_at timestamptz DEFAULT now() NOT NULL
);

-- R3: Idempotency — prevent duplicate analysis from webhook retries
CREATE UNIQUE INDEX idx_call_insights_call_id ON call_insights(call_id);

-- Primary query pattern: insights for a client, newest first
CREATE INDEX idx_call_insights_client_created ON call_insights(client_id, created_at DESC);

-- RLS: clients can only see their own insights
ALTER TABLE call_insights ENABLE ROW LEVEL SECURITY;

-- Service role (webhooks, crons) can do everything
CREATE POLICY "service_role_all" ON call_insights
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users see only their client's insights
CREATE POLICY "users_read_own_client" ON call_insights
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM client_users WHERE user_id = auth.uid()
    )
  );
