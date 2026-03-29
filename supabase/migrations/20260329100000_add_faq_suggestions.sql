-- Add auto-generated FAQ suggestions column to call_logs
-- Populated by the completed webhook after transcript analysis
-- Stores up to 3 {q, a} pairs from Haiku-analyzed unanswered questions
ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS faq_suggestions jsonb;

COMMENT ON COLUMN call_logs.faq_suggestions IS 'Auto-generated FAQ Q+A pairs from Haiku transcript analysis. Surfaced on home dashboard for one-click owner approval.';
